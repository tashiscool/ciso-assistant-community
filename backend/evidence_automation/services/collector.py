"""
Evidence Collector Service

Orchestrates automated evidence collection from configured sources.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from django.core.files.base import ContentFile
import json
import structlog

from ..models import EvidenceSource, EvidenceCollectionRule, EvidenceCollectionRun
from .connectors import get_connector, CollectedEvidence

logger = structlog.get_logger(__name__)


class EvidenceCollector:
    """
    Service for automated evidence collection.

    Handles:
    - Source connection management
    - Evidence collection orchestration
    - Evidence storage and linking
    """

    def __init__(self):
        self.active_connectors = {}

    def test_source_connection(self, source: EvidenceSource) -> Dict[str, Any]:
        """
        Test connection to an evidence source.

        Args:
            source: The EvidenceSource to test

        Returns:
            Dictionary with connection test results
        """
        connector = get_connector(source.source_type, source.config)
        if not connector:
            return {
                'success': False,
                'error': f'Unsupported source type: {source.source_type}',
            }

        # Validate configuration
        config_errors = connector.validate_config()
        if config_errors:
            return {
                'success': False,
                'error': 'Configuration validation failed',
                'details': config_errors,
            }

        # Test connection
        try:
            result = connector.test_connection()
            return result
        except Exception as e:
            logger.error("Connection test failed", source=source.name, error=str(e))
            return {
                'success': False,
                'error': str(e),
            }
        finally:
            try:
                connector.disconnect()
            except:
                pass

    def collect_evidence(
        self,
        rule: EvidenceCollectionRule,
        dry_run: bool = False
    ) -> EvidenceCollectionRun:
        """
        Execute evidence collection for a rule.

        Args:
            rule: The collection rule to execute
            dry_run: If True, don't actually store evidence

        Returns:
            EvidenceCollectionRun with results
        """
        from core.models import Evidence, EvidenceRevision

        # Create run record
        run = EvidenceCollectionRun.objects.create(
            rule=rule,
            status=EvidenceCollectionRun.Status.RUNNING,
            started_at=timezone.now(),
        )

        try:
            source = rule.source
            connector = get_connector(source.source_type, source.config)

            if not connector:
                raise ValueError(f'Unsupported source type: {source.source_type}')

            # Connect
            if not connector.connect():
                raise ConnectionError(f'Failed to connect to {source.name}')

            # Build parameters
            parameters = dict(rule.parameters)
            parameters['collection_type'] = rule.collection_type

            # Collect evidence
            collected_items = connector.collect(rule.query or '', parameters)

            run.items_collected = len(collected_items)
            run.run_log.append({
                'timestamp': timezone.now().isoformat(),
                'message': f'Collected {len(collected_items)} items',
            })

            if not dry_run and collected_items:
                # Store evidence
                evidence = self._store_evidence(rule, collected_items, run)
                run.evidence_created = evidence

            run.status = EvidenceCollectionRun.Status.SUCCESS
            run.completed_at = timezone.now()

            # Update source last collection
            source.last_collection_at = timezone.now()
            source.last_collection_status = 'success'
            source.last_error = None
            source.save()

        except Exception as e:
            logger.error(
                "Evidence collection failed",
                rule=rule.name,
                error=str(e)
            )
            run.status = EvidenceCollectionRun.Status.FAILED
            run.error_message = str(e)
            run.completed_at = timezone.now()
            run.run_log.append({
                'timestamp': timezone.now().isoformat(),
                'error': str(e),
            })

            # Update source error status
            rule.source.last_collection_status = 'error'
            rule.source.last_error = str(e)
            rule.source.save()

        finally:
            try:
                if connector:
                    connector.disconnect()
            except:
                pass

        run.save()
        return run

    def _store_evidence(
        self,
        rule: EvidenceCollectionRule,
        collected_items: List[CollectedEvidence],
        run: EvidenceCollectionRun
    ) -> 'Evidence':
        """
        Store collected evidence items.

        Creates Evidence and EvidenceRevision records.
        """
        from core.models import Evidence, EvidenceRevision

        with transaction.atomic():
            # Create main evidence record
            evidence = Evidence.objects.create(
                name=f"[Auto] {rule.name} - {timezone.now().strftime('%Y-%m-%d')}",
                description=f"Automatically collected from {rule.source.name}\n\n"
                           f"Collection type: {rule.get_collection_type_display()}\n"
                           f"Collected at: {timezone.now().isoformat()}\n"
                           f"Items collected: {len(collected_items)}",
                status=Evidence.Status.IN_REVIEW,
                folder=rule.folder,
            )

            # Create revision with collected data
            for item in collected_items:
                # Prepare content
                if item.content_type == 'json':
                    content = json.dumps(item.data, indent=2, default=str).encode('utf-8')
                    filename = item.filename or 'evidence.json'
                elif item.content_type == 'text':
                    content = str(item.data).encode('utf-8')
                    filename = item.filename or 'evidence.txt'
                else:
                    content = item.data if isinstance(item.data, bytes) else str(item.data).encode('utf-8')
                    filename = item.filename or 'evidence.bin'

                # Get or increment version
                last_version = EvidenceRevision.objects.filter(
                    evidence=evidence
                ).order_by('-version').first()
                new_version = (last_version.version + 1) if last_version else 1

                # Create revision
                revision = EvidenceRevision(
                    evidence=evidence,
                    version=new_version,
                    folder=evidence.folder,
                    observation=f"Collected: {item.description}\n\nMetadata: {json.dumps(item.metadata, indent=2)}",
                )
                revision.attachment.save(filename, ContentFile(content))
                revision.save()

            # Link to target controls
            if rule.target_controls.exists():
                for control in rule.target_controls.all():
                    control.evidences.add(evidence)

            # Link to target requirements
            if rule.target_requirements.exists():
                for req in rule.target_requirements.all():
                    req.evidences.add(evidence)

            return evidence

    def run_scheduled_collections(self) -> Dict[str, Any]:
        """
        Run all enabled scheduled collections.

        Called by the scheduler/celery task.
        """
        results = {
            'total': 0,
            'success': 0,
            'failed': 0,
            'runs': [],
        }

        # Get all enabled rules
        rules = EvidenceCollectionRule.objects.filter(
            enabled=True,
            source__collection_enabled=True,
            source__status=EvidenceSource.Status.ACTIVE,
        ).select_related('source')

        for rule in rules:
            results['total'] += 1

            try:
                run = self.collect_evidence(rule)
                results['runs'].append({
                    'rule': rule.name,
                    'status': run.status,
                    'items': run.items_collected,
                })

                if run.status == EvidenceCollectionRun.Status.SUCCESS:
                    results['success'] += 1
                else:
                    results['failed'] += 1

            except Exception as e:
                results['failed'] += 1
                results['runs'].append({
                    'rule': rule.name,
                    'status': 'error',
                    'error': str(e),
                })

        return results

    def get_collection_status(self, source_id: str) -> Dict[str, Any]:
        """Get collection status for a source."""
        try:
            source = EvidenceSource.objects.get(id=source_id)

            # Get recent runs
            recent_runs = EvidenceCollectionRun.objects.filter(
                rule__source=source
            ).order_by('-created_at')[:10]

            return {
                'source': {
                    'id': str(source.id),
                    'name': source.name,
                    'status': source.status,
                    'last_collection': source.last_collection_at.isoformat() if source.last_collection_at else None,
                    'last_status': source.last_collection_status,
                    'last_error': source.last_error,
                },
                'recent_runs': [
                    {
                        'id': str(run.id),
                        'rule': run.rule.name,
                        'status': run.status,
                        'started_at': run.started_at.isoformat() if run.started_at else None,
                        'completed_at': run.completed_at.isoformat() if run.completed_at else None,
                        'items_collected': run.items_collected,
                        'error': run.error_message,
                    }
                    for run in recent_runs
                ],
            }

        except EvidenceSource.DoesNotExist:
            return {'error': 'Source not found'}


# Singleton instance
evidence_collector = EvidenceCollector()
