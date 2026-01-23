"""
Version History Services

Services for managing version history, snapshots, diffs, and auditing.
"""

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
from typing import Any, Dict, List, Optional, Type
from datetime import datetime, timedelta
import json
import difflib

from .models import VersionHistory, VersionSnapshot, VersionDiff, VersionComment


class VersionService:
    """
    Core service for version management.

    Handles creating, retrieving, and managing version history.
    """

    @classmethod
    def create_version(
        cls,
        instance: Any,
        change_type: str = 'update',
        change_summary: str = '',
        change_reason: str = '',
        user=None,
        request=None,
        changed_fields: List[str] = None,
        previous_values: Dict = None,
    ) -> VersionHistory:
        """
        Create a new version entry for an instance.

        Args:
            instance: The model instance to version
            change_type: Type of change (create, update, delete, restore)
            change_summary: Brief summary of changes
            change_reason: Reason for the change
            user: User who made the change
            request: HTTP request (for IP/UA tracking)
            changed_fields: List of field names that changed
            previous_values: Dict of previous field values
        """
        content_type = ContentType.objects.get_for_model(instance)

        # Get current version number
        last_version = VersionHistory.objects.filter(
            content_type=content_type,
            object_id=str(instance.pk)
        ).order_by('-version_number').first()

        version_number = (last_version.version_number + 1) if last_version else 1

        # Create snapshot of current state
        snapshot_data = cls._serialize_instance(instance)

        # Extract request info
        ip_address = None
        user_agent = ''
        request_id = ''
        if request:
            ip_address = cls._get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
            request_id = request.META.get('HTTP_X_REQUEST_ID', '')

        version = VersionHistory.objects.create(
            content_type=content_type,
            object_id=str(instance.pk),
            version_number=version_number,
            change_type=change_type,
            change_summary=change_summary or cls._generate_change_summary(change_type, changed_fields),
            change_reason=change_reason,
            snapshot_data=snapshot_data,
            changed_fields=changed_fields or [],
            previous_values=previous_values or {},
            created_by=user,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )

        # Update instance version number if it has the field
        if hasattr(instance, 'current_version'):
            instance.current_version = version_number
            # Use update to avoid recursion
            type(instance).objects.filter(pk=instance.pk).update(current_version=version_number)

        return version

    @classmethod
    def get_history(
        cls,
        instance: Any = None,
        model_class: Type = None,
        object_id: str = None,
        limit: int = 100,
        offset: int = 0,
        change_types: List[str] = None,
        user=None,
        from_date: datetime = None,
        to_date: datetime = None,
    ) -> List[VersionHistory]:
        """
        Get version history for an instance or model.
        """
        if instance:
            content_type = ContentType.objects.get_for_model(instance)
            queryset = VersionHistory.objects.filter(
                content_type=content_type,
                object_id=str(instance.pk)
            )
        elif model_class and object_id:
            content_type = ContentType.objects.get_for_model(model_class)
            queryset = VersionHistory.objects.filter(
                content_type=content_type,
                object_id=object_id
            )
        else:
            queryset = VersionHistory.objects.all()

        if change_types:
            queryset = queryset.filter(change_type__in=change_types)
        if user:
            queryset = queryset.filter(created_by=user)
        if from_date:
            queryset = queryset.filter(created_at__gte=from_date)
        if to_date:
            queryset = queryset.filter(created_at__lte=to_date)

        return list(queryset.order_by('-version_number')[offset:offset + limit])

    @classmethod
    def restore_version(
        cls,
        instance: Any,
        version_number: int,
        user=None,
        reason: str = '',
    ) -> Any:
        """
        Restore an instance to a previous version.
        """
        content_type = ContentType.objects.get_for_model(instance)
        version = VersionHistory.objects.filter(
            content_type=content_type,
            object_id=str(instance.pk),
            version_number=version_number
        ).first()

        if not version:
            raise ValueError(f"Version {version_number} not found")

        # Store current state before restoration
        current_data = cls._serialize_instance(instance)

        with transaction.atomic():
            # Apply snapshot data
            cls._deserialize_to_instance(instance, version.snapshot_data)
            instance.save()

            # Create restoration version entry
            cls.create_version(
                instance,
                change_type='restore',
                change_summary=f'Restored to version {version_number}',
                change_reason=reason,
                user=user,
                previous_values=current_data,
            )

        return instance

    @classmethod
    def _serialize_instance(cls, instance: Any) -> Dict:
        """Serialize a model instance to a dictionary."""
        data = {}

        for field in instance._meta.get_fields():
            if field.is_relation:
                if field.many_to_many:
                    if hasattr(instance, field.name):
                        related_manager = getattr(instance, field.name)
                        data[field.name] = list(related_manager.values_list('pk', flat=True))
                elif field.many_to_one or field.one_to_one:
                    if hasattr(instance, field.name + '_id'):
                        data[field.name + '_id'] = getattr(instance, field.name + '_id')
            elif field.concrete:
                value = getattr(instance, field.name, None)
                # Convert to JSON-serializable format
                try:
                    json.dumps(value, cls=DjangoJSONEncoder)
                    data[field.name] = value
                except (TypeError, ValueError):
                    data[field.name] = str(value)

        return data

    @classmethod
    def _deserialize_to_instance(cls, instance: Any, data: Dict):
        """Apply snapshot data to an instance."""
        for field_name, value in data.items():
            if hasattr(instance, field_name):
                field = instance._meta.get_field(field_name.replace('_id', ''))
                if not field.is_relation:
                    setattr(instance, field_name, value)

    @classmethod
    def _generate_change_summary(cls, change_type: str, changed_fields: List[str] = None) -> str:
        """Generate a summary of changes."""
        if change_type == 'create':
            return 'Created'
        elif change_type == 'delete':
            return 'Deleted'
        elif change_type == 'restore':
            return 'Restored from previous version'
        elif changed_fields:
            if len(changed_fields) <= 3:
                return f"Updated: {', '.join(changed_fields)}"
            return f"Updated {len(changed_fields)} fields"
        return 'Updated'

    @classmethod
    def _get_client_ip(cls, request) -> Optional[str]:
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class SnapshotService:
    """
    Service for managing named snapshots.
    """

    @classmethod
    def create_snapshot(
        cls,
        instance: Any,
        name: str,
        description: str = '',
        snapshot_type: str = 'manual',
        external_reference: str = '',
        user=None,
        expires_at: datetime = None,
        is_protected: bool = False,
    ) -> VersionSnapshot:
        """Create a named snapshot."""
        content_type = ContentType.objects.get_for_model(instance)
        current_version = VersionHistory.objects.filter(
            content_type=content_type,
            object_id=str(instance.pk)
        ).order_by('-version_number').first()

        if not current_version:
            # Create a version first
            current_version = VersionService.create_version(
                instance,
                change_type='create',
                change_summary='Initial version for snapshot',
                user=user
            )

        return VersionSnapshot.objects.create(
            version=current_version,
            name=name,
            description=description,
            snapshot_type=snapshot_type,
            external_reference=external_reference,
            created_by=user,
            expires_at=expires_at,
            is_protected=is_protected,
        )

    @classmethod
    def list_snapshots(
        cls,
        instance: Any = None,
        snapshot_type: str = None,
        include_expired: bool = False,
    ) -> List[VersionSnapshot]:
        """List snapshots, optionally filtered."""
        queryset = VersionSnapshot.objects.all()

        if instance:
            content_type = ContentType.objects.get_for_model(instance)
            queryset = queryset.filter(
                version__content_type=content_type,
                version__object_id=str(instance.pk)
            )

        if snapshot_type:
            queryset = queryset.filter(snapshot_type=snapshot_type)

        if not include_expired:
            queryset = queryset.filter(
                models.Q(expires_at__isnull=True) |
                models.Q(expires_at__gt=timezone.now())
            )

        return list(queryset.order_by('-created_at'))

    @classmethod
    def restore_from_snapshot(
        cls,
        snapshot: VersionSnapshot,
        user=None,
        reason: str = '',
    ) -> Any:
        """Restore an instance from a snapshot."""
        return VersionService.restore_version(
            snapshot.version.content_object,
            snapshot.version.version_number,
            user=user,
            reason=reason or f"Restored from snapshot: {snapshot.name}",
        )

    @classmethod
    def cleanup_expired_snapshots(cls, delete_unprotected: bool = True) -> int:
        """Remove expired snapshots."""
        queryset = VersionSnapshot.objects.filter(
            expires_at__lt=timezone.now()
        )

        if not delete_unprotected:
            queryset = queryset.filter(is_protected=False)

        count = queryset.count()
        queryset.delete()
        return count


class DiffService:
    """
    Service for computing and caching diffs between versions.
    """

    @classmethod
    def get_diff(
        cls,
        from_version: VersionHistory,
        to_version: VersionHistory,
        use_cache: bool = True,
    ) -> Dict:
        """Get diff between two versions."""
        if use_cache:
            cached = VersionDiff.objects.filter(
                from_version=from_version,
                to_version=to_version
            ).first()
            if cached:
                return cached.diff_data

        diff = cls._compute_diff(from_version.snapshot_data, to_version.snapshot_data)

        # Cache the result
        VersionDiff.objects.create(
            from_version=from_version,
            to_version=to_version,
            diff_data=diff,
            fields_added=len(diff.get('added', {})),
            fields_removed=len(diff.get('removed', {})),
            fields_changed=len(diff.get('changed', {})),
        )

        return diff

    @classmethod
    def get_text_diff(
        cls,
        from_version: VersionHistory,
        to_version: VersionHistory,
        field_name: str,
    ) -> str:
        """Get unified text diff for a specific field."""
        old_value = str(from_version.snapshot_data.get(field_name, ''))
        new_value = str(to_version.snapshot_data.get(field_name, ''))

        diff = difflib.unified_diff(
            old_value.splitlines(keepends=True),
            new_value.splitlines(keepends=True),
            fromfile=f'v{from_version.version_number}',
            tofile=f'v{to_version.version_number}',
        )

        return ''.join(diff)

    @classmethod
    def get_timeline_diff(
        cls,
        instance: Any,
        from_version: int = None,
        to_version: int = None,
    ) -> List[Dict]:
        """Get a timeline of all changes between versions."""
        history = VersionService.get_history(instance)

        if from_version:
            history = [v for v in history if v.version_number >= from_version]
        if to_version:
            history = [v for v in history if v.version_number <= to_version]

        timeline = []
        for i, version in enumerate(reversed(history)):
            entry = {
                'version': version.version_number,
                'change_type': version.change_type,
                'change_summary': version.change_summary,
                'changed_fields': version.changed_fields,
                'created_at': version.created_at,
                'created_by': str(version.created_by) if version.created_by else None,
            }

            if i > 0:
                prev = history[-(i)]
                entry['diff'] = cls._compute_diff(prev.snapshot_data, version.snapshot_data)

            timeline.append(entry)

        return timeline

    @classmethod
    def _compute_diff(cls, old_data: Dict, new_data: Dict) -> Dict:
        """Compute detailed diff between two snapshots."""
        diff = {
            'added': {},
            'removed': {},
            'changed': {},
        }

        all_keys = set(old_data.keys()) | set(new_data.keys())

        for key in all_keys:
            if key not in old_data:
                diff['added'][key] = new_data[key]
            elif key not in new_data:
                diff['removed'][key] = old_data[key]
            elif old_data[key] != new_data[key]:
                diff['changed'][key] = {
                    'old': old_data[key],
                    'new': new_data[key],
                }

        return diff


class AuditService:
    """
    Service for audit trail and compliance reporting.
    """

    @classmethod
    def get_audit_trail(
        cls,
        model_class: Type = None,
        user=None,
        from_date: datetime = None,
        to_date: datetime = None,
        change_types: List[str] = None,
        limit: int = 1000,
    ) -> List[Dict]:
        """Get audit trail for compliance reporting."""
        queryset = VersionHistory.objects.all()

        if model_class:
            content_type = ContentType.objects.get_for_model(model_class)
            queryset = queryset.filter(content_type=content_type)

        if user:
            queryset = queryset.filter(created_by=user)

        if from_date:
            queryset = queryset.filter(created_at__gte=from_date)

        if to_date:
            queryset = queryset.filter(created_at__lte=to_date)

        if change_types:
            queryset = queryset.filter(change_type__in=change_types)

        trail = []
        for version in queryset.order_by('-created_at')[:limit]:
            trail.append({
                'id': str(version.id),
                'timestamp': version.created_at.isoformat(),
                'model': version.content_type.model,
                'object_id': version.object_id,
                'version': version.version_number,
                'action': version.change_type,
                'summary': version.change_summary,
                'reason': version.change_reason,
                'user': str(version.created_by) if version.created_by else None,
                'ip_address': version.ip_address,
                'changed_fields': version.changed_fields,
            })

        return trail

    @classmethod
    def generate_compliance_report(
        cls,
        model_classes: List[Type],
        from_date: datetime,
        to_date: datetime,
    ) -> Dict:
        """Generate a compliance report for specified models."""
        report = {
            'period': {
                'from': from_date.isoformat(),
                'to': to_date.isoformat(),
            },
            'models': {},
            'summary': {
                'total_changes': 0,
                'by_change_type': {},
                'by_user': {},
            }
        }

        for model_class in model_classes:
            content_type = ContentType.objects.get_for_model(model_class)
            versions = VersionHistory.objects.filter(
                content_type=content_type,
                created_at__gte=from_date,
                created_at__lte=to_date,
            )

            model_name = model_class.__name__
            report['models'][model_name] = {
                'total_changes': versions.count(),
                'creates': versions.filter(change_type='create').count(),
                'updates': versions.filter(change_type='update').count(),
                'deletes': versions.filter(change_type='delete').count(),
                'restores': versions.filter(change_type='restore').count(),
            }

            report['summary']['total_changes'] += versions.count()

            # Aggregate by change type
            for v in versions:
                report['summary']['by_change_type'][v.change_type] = \
                    report['summary']['by_change_type'].get(v.change_type, 0) + 1

                if v.created_by:
                    user_key = str(v.created_by)
                    report['summary']['by_user'][user_key] = \
                        report['summary']['by_user'].get(user_key, 0) + 1

        return report

    @classmethod
    def export_audit_log(
        cls,
        format: str = 'json',
        **filters,
    ) -> str:
        """Export audit log in specified format."""
        trail = cls.get_audit_trail(**filters)

        if format == 'json':
            return json.dumps(trail, indent=2, default=str)
        elif format == 'csv':
            import csv
            import io
            output = io.StringIO()
            if trail:
                writer = csv.DictWriter(output, fieldnames=trail[0].keys())
                writer.writeheader()
                writer.writerows(trail)
            return output.getvalue()
        else:
            raise ValueError(f"Unsupported format: {format}")
