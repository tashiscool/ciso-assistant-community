"""
Version History Models

Core models for tracking version history across all entities.
"""

from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
import json
import uuid


class VersionHistory(models.Model):
    """
    Tracks all versions of any versioned model.

    Stores complete snapshots of the model state at each version,
    along with metadata about who made the change and why.
    """

    class ChangeType(models.TextChoices):
        CREATE = 'create', 'Created'
        UPDATE = 'update', 'Updated'
        DELETE = 'delete', 'Deleted'
        RESTORE = 'restore', 'Restored'
        IMPORT = 'import', 'Imported'
        BULK = 'bulk', 'Bulk Update'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Generic relation to any model
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        related_name='version_histories'
    )
    object_id = models.CharField(max_length=255)
    content_object = GenericForeignKey('content_type', 'object_id')

    # Version information
    version_number = models.PositiveIntegerField(default=1)
    version_label = models.CharField(max_length=100, blank=True)

    # Change metadata
    change_type = models.CharField(
        max_length=20,
        choices=ChangeType.choices,
        default=ChangeType.UPDATE
    )
    change_summary = models.CharField(max_length=500, blank=True)
    change_reason = models.TextField(blank=True)

    # Complete state snapshot (JSON)
    snapshot_data = models.JSONField()

    # Changed fields (JSON list)
    changed_fields = models.JSONField(default=list)

    # Previous values for changed fields (for quick diff)
    previous_values = models.JSONField(default=dict)

    # User who made the change
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='version_changes'
    )
    created_at = models.DateTimeField(default=timezone.now)

    # Request context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    request_id = models.CharField(max_length=100, blank=True)

    # Tags for organization
    tags = models.JSONField(default=list)

    class Meta:
        verbose_name = 'Version History'
        verbose_name_plural = 'Version Histories'
        ordering = ['-version_number']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['content_type', 'object_id', 'version_number']),
            models.Index(fields=['created_at']),
            models.Index(fields=['created_by']),
            models.Index(fields=['change_type']),
        ]
        unique_together = [
            ['content_type', 'object_id', 'version_number']
        ]

    def __str__(self):
        return f"{self.content_type.model} #{self.object_id} v{self.version_number}"

    def get_diff_from_previous(self):
        """Get the diff from the previous version."""
        previous = VersionHistory.objects.filter(
            content_type=self.content_type,
            object_id=self.object_id,
            version_number=self.version_number - 1
        ).first()

        if not previous:
            return {'added': self.snapshot_data, 'removed': {}, 'changed': {}}

        return self._compute_diff(previous.snapshot_data, self.snapshot_data)

    def _compute_diff(self, old_data, new_data):
        """Compute detailed diff between two snapshots."""
        diff = {'added': {}, 'removed': {}, 'changed': {}}

        all_keys = set(old_data.keys()) | set(new_data.keys())

        for key in all_keys:
            if key not in old_data:
                diff['added'][key] = new_data[key]
            elif key not in new_data:
                diff['removed'][key] = old_data[key]
            elif old_data[key] != new_data[key]:
                diff['changed'][key] = {
                    'old': old_data[key],
                    'new': new_data[key]
                }

        return diff


class VersionSnapshot(models.Model):
    """
    Named snapshots for point-in-time recovery.

    Allows users to create named checkpoints that can be
    referenced later for comparison or restoration.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Reference to the version
    version = models.ForeignKey(
        VersionHistory,
        on_delete=models.CASCADE,
        related_name='snapshots'
    )

    # Snapshot metadata
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Can be linked to a milestone, release, or audit
    snapshot_type = models.CharField(
        max_length=50,
        choices=[
            ('manual', 'Manual Snapshot'),
            ('milestone', 'Milestone'),
            ('release', 'Release'),
            ('audit', 'Audit Point'),
            ('backup', 'Backup'),
        ],
        default='manual'
    )

    # Optional external reference
    external_reference = models.CharField(max_length=200, blank=True)

    # User who created snapshot
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='version_snapshots'
    )
    created_at = models.DateTimeField(default=timezone.now)

    # Retention policy
    expires_at = models.DateTimeField(null=True, blank=True)
    is_protected = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Version Snapshot'
        verbose_name_plural = 'Version Snapshots'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.version})"


class VersionDiff(models.Model):
    """
    Cached diff between two versions.

    Pre-computed diffs for frequently compared versions.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # The two versions being compared
    from_version = models.ForeignKey(
        VersionHistory,
        on_delete=models.CASCADE,
        related_name='diffs_from'
    )
    to_version = models.ForeignKey(
        VersionHistory,
        on_delete=models.CASCADE,
        related_name='diffs_to'
    )

    # Computed diff (JSON)
    diff_data = models.JSONField()

    # Summary statistics
    fields_added = models.PositiveIntegerField(default=0)
    fields_removed = models.PositiveIntegerField(default=0)
    fields_changed = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Version Diff'
        verbose_name_plural = 'Version Diffs'
        unique_together = [['from_version', 'to_version']]

    def __str__(self):
        return f"Diff: v{self.from_version.version_number} → v{self.to_version.version_number}"


class VersionComment(models.Model):
    """
    Comments on specific versions.

    Allows users to annotate versions with notes, questions, or approvals.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Reference to version
    version = models.ForeignKey(
        VersionHistory,
        on_delete=models.CASCADE,
        related_name='comments'
    )

    # Comment content
    comment = models.TextField()
    comment_type = models.CharField(
        max_length=20,
        choices=[
            ('note', 'Note'),
            ('question', 'Question'),
            ('approval', 'Approval'),
            ('rejection', 'Rejection'),
            ('review', 'Review'),
        ],
        default='note'
    )

    # User
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='version_comments'
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Version Comment'
        verbose_name_plural = 'Version Comments'
        ordering = ['created_at']

    def __str__(self):
        return f"Comment on {self.version} by {self.created_by}"


class VersionedModel(models.Model):
    """
    Abstract base class for models that support versioning.

    Provides automatic version tracking when save() is called.
    """

    # Current version number
    current_version = models.PositiveIntegerField(default=1, editable=False)

    # Versioning settings
    version_tracking_enabled = models.BooleanField(default=True)

    class Meta:
        abstract = True

    def get_version_history(self):
        """Get all version history for this object."""
        content_type = ContentType.objects.get_for_model(self)
        return VersionHistory.objects.filter(
            content_type=content_type,
            object_id=str(self.pk)
        ).order_by('-version_number')

    def get_version(self, version_number):
        """Get a specific version."""
        content_type = ContentType.objects.get_for_model(self)
        return VersionHistory.objects.filter(
            content_type=content_type,
            object_id=str(self.pk),
            version_number=version_number
        ).first()

    def get_version_at_time(self, timestamp):
        """Get the version that was current at a specific time."""
        content_type = ContentType.objects.get_for_model(self)
        return VersionHistory.objects.filter(
            content_type=content_type,
            object_id=str(self.pk),
            created_at__lte=timestamp
        ).order_by('-version_number').first()

    def create_snapshot(self, name, description='', snapshot_type='manual', user=None):
        """Create a named snapshot of the current version."""
        content_type = ContentType.objects.get_for_model(self)
        current = VersionHistory.objects.filter(
            content_type=content_type,
            object_id=str(self.pk),
            version_number=self.current_version
        ).first()

        if current:
            return VersionSnapshot.objects.create(
                version=current,
                name=name,
                description=description,
                snapshot_type=snapshot_type,
                created_by=user
            )
        return None

    def rollback_to_version(self, version_number, user=None, reason=''):
        """Rollback to a previous version."""
        version = self.get_version(version_number)
        if not version:
            raise ValueError(f"Version {version_number} not found")

        # Apply the snapshot data
        for field, value in version.snapshot_data.items():
            if hasattr(self, field):
                setattr(self, field, value)

        # Save with rollback metadata
        self._rollback_version = version_number
        self._rollback_user = user
        self._rollback_reason = reason
        self.save()

        return self

    def compare_versions(self, from_version, to_version):
        """Compare two versions of this object."""
        v1 = self.get_version(from_version)
        v2 = self.get_version(to_version)

        if not v1 or not v2:
            raise ValueError("One or both versions not found")

        # Check for cached diff
        cached = VersionDiff.objects.filter(
            from_version=v1,
            to_version=v2
        ).first()

        if cached:
            return cached.diff_data

        # Compute diff
        return v2._compute_diff(v1.snapshot_data, v2.snapshot_data)
