"""
OCSF to OSCAL Translator

Translates OCSF (Open Cybersecurity Schema Framework) events to
OSCAL (Open Security Controls Assessment Language) format.
"""

from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from uuid import UUID, uuid4
import logging

from .ocsf_models import (
    OCSFEvent,
    OCSFEventClass,
    OCSFSeverity,
    SecurityFinding,
    VulnerabilityFinding,
    ComplianceFinding,
    DetectionFinding,
    OCSF_SEVERITY_TO_CISO,
)

logger = logging.getLogger(__name__)


class OCSFToOSCALTranslator:
    """
    Translates OCSF events to OSCAL format.

    Supports translation to:
    - OSCAL Assessment Results
    - OSCAL POA&M items
    - OSCAL Observations
    - OSCAL Findings
    """

    def __init__(self, system_id: Optional[str] = None):
        """
        Initialize the translator.

        Args:
            system_id: Optional system identifier for OSCAL documents
        """
        self.system_id = system_id or str(uuid4())

    def translate_to_observation(self, event: OCSFEvent) -> Dict[str, Any]:
        """
        Translate OCSF event to OSCAL observation.

        Args:
            event: OCSF event to translate

        Returns:
            OSCAL observation dict
        """
        observation = {
            'uuid': str(uuid4()),
            'title': self._get_event_title(event),
            'description': event.message or f'{event.class_name} event',
            'methods': ['EXAMINE'],
            'types': [self._get_observation_type(event)],
            'collected': event.time.isoformat() if event.time else datetime.utcnow().isoformat(),
            'props': [
                {
                    'name': 'ocsf-class-uid',
                    'value': str(event.class_uid),
                },
                {
                    'name': 'ocsf-severity-id',
                    'value': str(event.severity_id),
                },
                {
                    'name': 'ocsf-status',
                    'value': event.status,
                },
            ],
        }

        # Add subjects from resources
        if event.resources:
            observation['subjects'] = [
                {
                    'subject-uuid': str(uuid4()),
                    'type': 'component',
                    'title': resource.name,
                    'props': [
                        {'name': 'resource-type', 'value': resource.type},
                        {'name': 'resource-uid', 'value': resource.uid},
                    ],
                }
                for resource in event.resources
            ]

        # Add relevant evidence
        if hasattr(event, 'evidence') and event.evidence:
            observation['relevant-evidence'] = [
                {
                    'description': str(event.evidence),
                    'href': event.evidence.get('url') if isinstance(event.evidence, dict) else None,
                }
            ]

        return observation

    def translate_to_finding(self, event: OCSFEvent) -> Dict[str, Any]:
        """
        Translate OCSF event to OSCAL finding.

        Args:
            event: OCSF event to translate

        Returns:
            OSCAL finding dict
        """
        finding_uid = self._get_finding_uid(event)

        finding = {
            'uuid': str(uuid4()),
            'title': self._get_event_title(event),
            'description': event.message or f'{event.class_name} finding',
            'target': {
                'type': 'statement-id',
                'target-id': finding_uid,
                'status': {
                    'state': self._translate_status(event.status),
                },
            },
            'props': [
                {
                    'name': 'ocsf-finding-uid',
                    'value': finding_uid,
                },
                {
                    'name': 'severity',
                    'value': OCSF_SEVERITY_TO_CISO.get(event.severity_id, 'medium'),
                },
            ],
        }

        # Add risk information if available
        risk_score = self._get_risk_score(event)
        if risk_score is not None:
            finding['props'].append({
                'name': 'risk-score',
                'value': str(risk_score),
            })

        # Add related observations
        observation = self.translate_to_observation(event)
        finding['related-observations'] = [
            {'observation-uuid': observation['uuid']}
        ]

        return {
            'finding': finding,
            'observation': observation,
        }

    def translate_to_poam_item(self, event: OCSFEvent) -> Dict[str, Any]:
        """
        Translate OCSF event to OSCAL POA&M item.

        Args:
            event: OCSF event to translate

        Returns:
            OSCAL POA&M item dict
        """
        poam_item = {
            'uuid': str(uuid4()),
            'title': self._get_event_title(event),
            'description': event.message or f'POA&M item from {event.class_name}',
            'props': [
                {
                    'name': 'risk-level',
                    'value': OCSF_SEVERITY_TO_CISO.get(event.severity_id, 'medium'),
                },
                {
                    'name': 'ocsf-class',
                    'value': event.class_name,
                },
            ],
            'related-findings': [],
            'related-observations': [],
        }

        # Add origin information
        if event.metadata.product:
            poam_item['origins'] = [
                {
                    'actors': [
                        {
                            'type': 'tool',
                            'actor-uuid': str(uuid4()),
                            'props': [
                                {'name': 'tool-name', 'value': event.metadata.product.get('name', 'Unknown')},
                                {'name': 'tool-vendor', 'value': event.metadata.product.get('vendor_name', 'Unknown')},
                            ],
                        }
                    ]
                }
            ]

        # Add remediation if available
        remediation = self._get_remediation(event)
        if remediation:
            poam_item['response'] = {
                'lifecycle': 'recommendation',
                'title': 'Recommended Remediation',
                'description': remediation.get('description', ''),
            }

        return poam_item

    def translate_to_assessment_result(
        self,
        events: List[OCSFEvent],
        assessment_title: str = 'OCSF-Imported Assessment',
    ) -> Dict[str, Any]:
        """
        Translate multiple OCSF events to OSCAL assessment results.

        Args:
            events: List of OCSF events
            assessment_title: Title for the assessment

        Returns:
            OSCAL assessment results document
        """
        results_uuid = str(uuid4())

        # Collect all observations and findings
        observations = []
        findings = []

        for event in events:
            translated = self.translate_to_finding(event)
            observations.append(translated['observation'])
            findings.append(translated['finding'])

        return {
            'assessment-results': {
                'uuid': str(uuid4()),
                'metadata': {
                    'title': assessment_title,
                    'last-modified': datetime.utcnow().isoformat(),
                    'version': '1.0.0',
                    'oscal-version': '1.1.2',
                    'props': [
                        {'name': 'source', 'value': 'OCSF Import'},
                        {'name': 'event-count', 'value': str(len(events))},
                    ],
                },
                'import-ap': {
                    'href': '#',  # Placeholder - should reference actual assessment plan
                },
                'results': [
                    {
                        'uuid': results_uuid,
                        'title': f'{assessment_title} Results',
                        'description': f'Assessment results imported from {len(events)} OCSF events',
                        'start': min(e.time for e in events if e.time).isoformat() if events else datetime.utcnow().isoformat(),
                        'end': max(e.time for e in events if e.time).isoformat() if events else datetime.utcnow().isoformat(),
                        'observations': observations,
                        'findings': findings,
                    }
                ],
            }
        }

    def translate_compliance_finding(self, finding: ComplianceFinding) -> Dict[str, Any]:
        """
        Translate OCSF Compliance Finding to OSCAL control assessment.

        Args:
            finding: OCSF compliance finding

        Returns:
            OSCAL control assessment dict
        """
        control_id = finding.compliance.control or 'unknown-control'

        return {
            'uuid': str(uuid4()),
            'control-id': control_id,
            'status': {
                'state': self._translate_compliance_status(finding.compliance.status),
            },
            'props': [
                {
                    'name': 'requirements',
                    'value': ', '.join(finding.compliance.requirements),
                },
                {
                    'name': 'standards',
                    'value': ', '.join(finding.compliance.standards),
                },
            ],
            'remarks': finding.message or finding.compliance.status_detail,
        }

    def translate_vulnerability_to_inventory(
        self,
        finding: VulnerabilityFinding,
    ) -> List[Dict[str, Any]]:
        """
        Extract inventory items from OCSF Vulnerability Finding.

        Args:
            finding: OCSF vulnerability finding

        Returns:
            List of OSCAL inventory items
        """
        inventory = []

        for resource in finding.affected_resources:
            item = {
                'uuid': str(uuid4()),
                'description': f'{resource.type}: {resource.name}',
                'props': [
                    {'name': 'asset-type', 'value': resource.type},
                    {'name': 'asset-id', 'value': resource.uid},
                ],
            }

            # Add vulnerability references
            if finding.vulnerabilities:
                vuln_refs = []
                for vuln in finding.vulnerabilities:
                    if vuln.cve:
                        vuln_refs.append(vuln.cve.get('uid', vuln.uid))
                if vuln_refs:
                    item['props'].append({
                        'name': 'vulnerabilities',
                        'value': ', '.join(vuln_refs),
                    })

            inventory.append(item)

        return inventory

    def _get_event_title(self, event: OCSFEvent) -> str:
        """Get title from event."""
        if hasattr(event, 'finding_title') and event.finding_title:
            return event.finding_title
        return event.message or f'{event.class_name} Event'

    def _get_finding_uid(self, event: OCSFEvent) -> str:
        """Get finding UID from event."""
        if hasattr(event, 'finding_uid') and event.finding_uid:
            return event.finding_uid
        return event.metadata.uid

    def _get_risk_score(self, event: OCSFEvent) -> Optional[float]:
        """Get risk score from event."""
        if hasattr(event, 'risk_score'):
            return event.risk_score
        return None

    def _get_remediation(self, event: OCSFEvent) -> Optional[Dict[str, Any]]:
        """Get remediation from event."""
        if hasattr(event, 'remediation'):
            return event.remediation
        return None

    def _get_observation_type(self, event: OCSFEvent) -> str:
        """Map OCSF class to OSCAL observation type."""
        type_map = {
            OCSFEventClass.SECURITY_FINDING: 'finding',
            OCSFEventClass.VULNERABILITY_FINDING: 'ssp-statement-issue',
            OCSFEventClass.COMPLIANCE_FINDING: 'control-objective',
            OCSFEventClass.DETECTION_FINDING: 'finding',
        }
        return type_map.get(event.class_uid, 'finding')

    def _translate_status(self, ocsf_status: str) -> str:
        """Translate OCSF status to OSCAL status."""
        status_map = {
            'New': 'open',
            'In Progress': 'investigating',
            'Suppressed': 'risk-accepted',
            'Resolved': 'closed',
        }
        return status_map.get(ocsf_status, 'open')

    def _translate_compliance_status(self, status: Optional[str]) -> str:
        """Translate OCSF compliance status to OSCAL."""
        if not status:
            return 'not-satisfied'
        status_lower = status.lower()
        if 'pass' in status_lower or 'compliant' in status_lower:
            return 'satisfied'
        elif 'fail' in status_lower or 'non-compliant' in status_lower:
            return 'not-satisfied'
        elif 'warn' in status_lower or 'partial' in status_lower:
            return 'partially-satisfied'
        return 'not-satisfied'


# Singleton instance
_ocsf_translator: Optional[OCSFToOSCALTranslator] = None


def get_ocsf_translator(system_id: Optional[str] = None) -> OCSFToOSCALTranslator:
    """Get or create the OCSF to OSCAL translator instance."""
    global _ocsf_translator
    if _ocsf_translator is None or (system_id and system_id != _ocsf_translator.system_id):
        _ocsf_translator = OCSFToOSCALTranslator(system_id)
    return _ocsf_translator
