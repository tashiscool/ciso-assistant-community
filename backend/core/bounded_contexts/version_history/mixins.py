"""
Version History Mixins

Mixins for adding automatic version tracking to Django models.
"""

from django.db import models
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from typing import List, Optional
import threading

from .services import VersionService


# Thread-local storage for request context
_thread_locals = threading.local()


def set_version_context(user=None, request=None, reason='', skip_versioning=False):
    """Set the versioning context for the current thread."""
    _thread_locals.version_user = user
    _thread_locals.version_request = request
    _thread_locals.version_reason = reason
    _thread_locals.skip_versioning = skip_versioning


def get_version_context():
    """Get the versioning context for the current thread."""
    return {
        'user': getattr(_thread_locals, 'version_user', None),
        'request': getattr(_thread_locals, 'version_request', None),
        'reason': getattr(_thread_locals, 'version_reason', ''),
        'skip_versioning': getattr(_thread_locals, 'skip_versioning', False),
    }


def clear_version_context():
    """Clear the versioning context."""
    _thread_locals.version_user = None
    _thread_locals.version_request = None
    _thread_locals.version_reason = ''
    _thread_locals.skip_versioning = False


class VersionedModelMixin(models.Model):
    """
    Mixin that adds automatic version tracking to a model.

    Usage:
        class MyModel(VersionedModelMixin, models.Model):
            name = models.CharField(max_length=100)
            # ... other fields

            class Meta:
                # Optional: specify fields to track (default: all)
                versioned_fields = ['name', 'description']

                # Optional: specify fields to exclude from versioning
                version_exclude_fields = ['updated_at', 'internal_counter']
    """

    # Track the current version number
    current_version = models.PositiveIntegerField(default=0, editable=False)

    # Enable/disable versioning for this instance
    _version_tracking_enabled = models.BooleanField(default=True, editable=False)

    # Store original state for change detection
    _original_state = None

    class Meta:
        abstract = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._capture_original_state()

    def _capture_original_state(self):
        """Capture the current state for change detection."""
        if self.pk:
            self._original_state = self._get_field_values()
        else:
            self._original_state = {}

    def _get_field_values(self) -> dict:
        """Get current values of tracked fields."""
        values = {}
        for field in self._get_versioned_fields():
            if hasattr(self, field):
                values[field] = getattr(self, field)
        return values

    def _get_versioned_fields(self) -> List[str]:
        """Get the list of fields to track."""
        # Check for explicit field list in Meta
        if hasattr(self._meta, 'versioned_fields'):
            return self._meta.versioned_fields

        # Default: all concrete fields except excluded ones
        exclude = getattr(self._meta, 'version_exclude_fields', [])
        exclude.extend(['id', 'pk', 'current_version', '_version_tracking_enabled'])

        fields = []
        for field in self._meta.get_fields():
            if field.concrete and not field.is_relation:
                if field.name not in exclude:
                    fields.append(field.name)

        return fields

    def _get_changed_fields(self) -> tuple:
        """Detect which fields have changed since load."""
        if not self._original_state:
            # New instance - all fields are "changed"
            return self._get_versioned_fields(), {}

        current = self._get_field_values()
        changed = []
        previous = {}

        for field in self._get_versioned_fields():
            original_value = self._original_state.get(field)
            current_value = current.get(field)

            if original_value != current_value:
                changed.append(field)
                previous[field] = original_value

        return changed, previous

    def save(self, *args, **kwargs):
        """Override save to create version history."""
        context = get_version_context()

        # Check if versioning should be skipped
        skip = context.get('skip_versioning', False)
        skip = skip or not self._version_tracking_enabled
        skip = skip or kwargs.pop('skip_versioning', False)

        # Detect if this is a create or update
        is_new = self.pk is None

        # Detect changed fields
        changed_fields, previous_values = self._get_changed_fields()

        # Save the model first
        super().save(*args, **kwargs)

        # Create version entry if not skipping
        if not skip and (is_new or changed_fields):
            change_type = 'create' if is_new else 'update'

            # Check for rollback context
            if hasattr(self, '_rollback_version'):
                change_type = 'restore'
                delattr(self, '_rollback_version')

            VersionService.create_version(
                self,
                change_type=change_type,
                change_reason=context.get('reason', ''),
                user=context.get('user'),
                request=context.get('request'),
                changed_fields=changed_fields,
                previous_values=previous_values,
            )

        # Update original state
        self._capture_original_state()

    def delete(self, *args, **kwargs):
        """Override delete to create version history."""
        context = get_version_context()
        skip = context.get('skip_versioning', False) or not self._version_tracking_enabled

        if not skip:
            VersionService.create_version(
                self,
                change_type='delete',
                change_reason=context.get('reason', ''),
                user=context.get('user'),
                request=context.get('request'),
            )

        return super().delete(*args, **kwargs)

    def get_version_history(self, limit: int = 100):
        """Get version history for this instance."""
        return VersionService.get_history(self, limit=limit)

    def get_version(self, version_number: int):
        """Get a specific version."""
        history = VersionService.get_history(self)
        for v in history:
            if v.version_number == version_number:
                return v
        return None

    def rollback_to(self, version_number: int, reason: str = ''):
        """Rollback to a previous version."""
        context = get_version_context()
        return VersionService.restore_version(
            self,
            version_number,
            user=context.get('user'),
            reason=reason or context.get('reason', ''),
        )

    def create_snapshot(self, name: str, description: str = '', snapshot_type: str = 'manual'):
        """Create a named snapshot of current state."""
        from .services import SnapshotService
        context = get_version_context()
        return SnapshotService.create_snapshot(
            self,
            name=name,
            description=description,
            snapshot_type=snapshot_type,
            user=context.get('user'),
        )

    def compare_to_version(self, version_number: int) -> dict:
        """Compare current state to a specific version."""
        from .services import DiffService
        current = VersionService.get_history(self, limit=1)
        if not current:
            return {}

        target = self.get_version(version_number)
        if not target:
            return {}

        return DiffService.get_diff(target, current[0])

    @classmethod
    def bulk_save_with_versioning(cls, instances: list, user=None, reason: str = ''):
        """
        Bulk save instances with a single version entry per instance.

        More efficient than saving one by one.
        """
        set_version_context(user=user, reason=reason)
        try:
            for instance in instances:
                instance.save()
        finally:
            clear_version_context()


class VersionContextMiddleware:
    """
    Django middleware to automatically capture user and request context
    for version tracking.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Set version context from request
        user = request.user if hasattr(request, 'user') and request.user.is_authenticated else None
        set_version_context(user=user, request=request)

        try:
            response = self.get_response(request)
        finally:
            clear_version_context()

        return response
