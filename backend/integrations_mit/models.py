# MIT License - See LICENSE-MIT.txt in repository root
"""
Integrations Models - Clean-room MIT implementation

Provides external tool integration functionality including:
- Integration provider registry
- Configuration management
- Bi-directional sync mapping
- Sync event audit trail
"""

import uuid
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class IntegrationProvider(models.Model):
    """
    Registry of available integration types.

    Defines the available connectors for external tools like
    Jira, ServiceNow, GitHub, etc.
    """

    class ProviderType(models.TextChoices):
        """Type categories for integration providers."""
        ITSM = 'itsm', _('IT Service Management')
        SECURITY = 'security', _('Security Tools')
        CLOUD = 'cloud', _('Cloud Platforms')
        SCM = 'scm', _('Source Control')
        COMMUNICATION = 'communication', _('Communication')
        IDENTITY = 'identity', _('Identity Provider')
        OTHER = 'other', _('Other')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Identification
    name = models.CharField(
        max_length=100,
        verbose_name=_('Name'),
        help_text=_('Provider identifier (e.g., jira, servicenow, github)')
    )
    display_name = models.CharField(
        max_length=200,
        blank=True,
        verbose_name=_('Display Name'),
        help_text=_('Human-readable name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )

    # Classification
    provider_type = models.CharField(
        max_length=20,
        choices=ProviderType.choices,
        default=ProviderType.OTHER,
        verbose_name=_('Provider Type')
    )

    # Provider capabilities
    supports_push = models.BooleanField(
        default=True,
        verbose_name=_('Supports Push'),
        help_text=_('Can push changes to remote system')
    )
    supports_pull = models.BooleanField(
        default=True,
        verbose_name=_('Supports Pull'),
        help_text=_('Can pull changes from remote system')
    )
    supports_webhook = models.BooleanField(
        default=False,
        verbose_name=_('Supports Webhooks'),
        help_text=_('Can receive webhook notifications')
    )

    # Configuration schema
    config_schema = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Configuration Schema'),
        help_text=_('JSON Schema for provider configuration')
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Integration Provider')
        verbose_name_plural = _('Integration Providers')
        unique_together = ['name', 'folder_id']

    def __str__(self):
        return self.display_name or self.name


class IntegrationConfiguration(models.Model):
    """
    Instance of an integration for a specific folder.

    Stores credentials and settings for connecting to
    an external system.
    """

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # References
    provider = models.ForeignKey(
        IntegrationProvider,
        on_delete=models.CASCADE,
        related_name='configurations',
        verbose_name=_('Provider')
    )

    # Identification
    name = models.CharField(
        max_length=200,
        verbose_name=_('Name'),
        help_text=_('Instance name for this configuration')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )

    # Authentication (encrypted in production)
    credentials = models.JSONField(
        default=dict,
        verbose_name=_('Credentials'),
        help_text=_('Authentication credentials (API keys, tokens, etc.)')
    )

    # Provider-specific settings
    settings = models.JSONField(
        default=dict,
        verbose_name=_('Settings'),
        help_text=_('Provider-specific configuration')
    )

    # Webhook configuration
    webhook_secret = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_('Webhook Secret'),
        help_text=_('Secret for validating incoming webhooks')
    )
    webhook_url = models.URLField(
        blank=True,
        verbose_name=_('Webhook URL'),
        help_text=_('URL registered with remote system')
    )

    # Sync settings
    sync_interval_minutes = models.PositiveIntegerField(
        default=60,
        verbose_name=_('Sync Interval'),
        help_text=_('Minutes between automatic syncs (0 = manual only)')
    )
    last_sync_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Last Sync')
    )
    last_sync_status = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_('Last Sync Status')
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Integration Configuration')
        verbose_name_plural = _('Integration Configurations')
        unique_together = ['provider', 'folder_id']

    def __str__(self):
        return f"{self.name} ({self.provider.name})"

    @property
    def is_sync_due(self) -> bool:
        """Check if sync is due based on interval."""
        if not self.sync_interval_minutes or self.sync_interval_minutes == 0:
            return False
        if not self.last_sync_at:
            return True

        next_sync = self.last_sync_at + timezone.timedelta(minutes=self.sync_interval_minutes)
        return timezone.now() >= next_sync

    def mark_synced(self, status: str = 'success'):
        """Mark sync as completed."""
        self.last_sync_at = timezone.now()
        self.last_sync_status = status
        self.save(update_fields=['last_sync_at', 'last_sync_status', 'updated_at'])

    def activate(self):
        """Activate this configuration."""
        self.is_active = True
        self.save(update_fields=['is_active', 'updated_at'])

    def deactivate(self):
        """Deactivate this configuration."""
        self.is_active = False
        self.save(update_fields=['is_active', 'updated_at'])


class SyncMapping(models.Model):
    """
    Maps local GRC objects to remote objects.

    Tracks the relationship between local entities and their
    corresponding objects in external systems for bi-directional sync.
    """

    class SyncStatus(models.TextChoices):
        """Synchronization status."""
        SYNCED = 'synced', _('Synced')
        PENDING = 'pending', _('Pending')
        FAILED = 'failed', _('Failed')
        CONFLICT = 'conflict', _('Conflict')

    class SyncDirection(models.TextChoices):
        """Direction of last sync."""
        PUSH = 'push', _('Push (Local to Remote)')
        PULL = 'pull', _('Pull (Remote to Local)')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Configuration reference
    configuration = models.ForeignKey(
        IntegrationConfiguration,
        on_delete=models.CASCADE,
        related_name='sync_mappings',
        verbose_name=_('Configuration')
    )

    # Local object reference
    local_object_type = models.CharField(
        max_length=100,
        verbose_name=_('Local Object Type'),
        help_text=_('Model name (e.g., AppliedControl)')
    )
    local_object_id = models.UUIDField(
        verbose_name=_('Local Object ID')
    )

    # Remote object reference
    remote_id = models.CharField(
        max_length=255,
        verbose_name=_('Remote ID'),
        help_text=_('Identifier in remote system (e.g., Jira issue key)')
    )
    remote_url = models.URLField(
        blank=True,
        verbose_name=_('Remote URL'),
        help_text=_('Link to remote object')
    )
    remote_data = models.JSONField(
        default=dict,
        verbose_name=_('Remote Data'),
        help_text=_('Cached state of remote object')
    )

    # Sync metadata
    sync_status = models.CharField(
        max_length=20,
        choices=SyncStatus.choices,
        default=SyncStatus.SYNCED,
        verbose_name=_('Sync Status')
    )
    last_synced_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_('Last Synced')
    )
    last_sync_direction = models.CharField(
        max_length=10,
        choices=SyncDirection.choices,
        blank=True,
        verbose_name=_('Last Sync Direction')
    )

    # Versioning for conflict detection
    local_version = models.PositiveIntegerField(
        default=1,
        verbose_name=_('Local Version')
    )
    remote_version = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Remote Version'),
        help_text=_('Version/etag from remote system')
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        verbose_name=_('Error Message')
    )
    error_count = models.PositiveSmallIntegerField(
        default=0,
        verbose_name=_('Error Count')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['-last_synced_at']
        verbose_name = _('Sync Mapping')
        verbose_name_plural = _('Sync Mappings')
        unique_together = ['configuration', 'local_object_type', 'local_object_id']
        indexes = [
            models.Index(fields=['configuration', 'remote_id']),
            models.Index(fields=['sync_status']),
        ]

    def __str__(self):
        return f"{self.local_object_type}:{self.local_object_id} <-> {self.remote_id}"

    @property
    def is_synced(self) -> bool:
        """Check if mapping is in sync."""
        return self.sync_status == self.SyncStatus.SYNCED

    @property
    def has_conflict(self) -> bool:
        """Check if there's a sync conflict."""
        return self.sync_status == self.SyncStatus.CONFLICT

    def mark_synced(self, direction: str, remote_version: str = ''):
        """Mark mapping as successfully synced."""
        self.sync_status = self.SyncStatus.SYNCED
        self.last_sync_direction = direction
        self.remote_version = remote_version
        self.error_message = ''
        self.error_count = 0
        self.local_version += 1
        self.save()

    def mark_failed(self, error: str):
        """Mark sync as failed."""
        self.sync_status = self.SyncStatus.FAILED
        self.error_message = error
        self.error_count += 1
        self.save(update_fields=['sync_status', 'error_message', 'error_count', 'last_synced_at'])

    def mark_conflict(self, error: str = 'Conflicting changes detected'):
        """Mark mapping as having a conflict."""
        self.sync_status = self.SyncStatus.CONFLICT
        self.error_message = error
        self.save(update_fields=['sync_status', 'error_message', 'last_synced_at'])

    def resolve_conflict(self, direction: str):
        """Resolve conflict by choosing a direction."""
        self.mark_synced(direction)


class SyncEvent(models.Model):
    """
    Audit trail of sync operations.

    Records each sync attempt with details about what changed,
    who triggered it, and whether it succeeded.
    """

    class TriggeredBy(models.TextChoices):
        """How the sync was triggered."""
        USER = 'user', _('User Action')
        WEBHOOK = 'webhook', _('Webhook')
        SCHEDULED = 'scheduled', _('Scheduled Job')
        SYSTEM = 'system', _('System')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Mapping reference
    mapping = models.ForeignKey(
        SyncMapping,
        on_delete=models.CASCADE,
        related_name='sync_events',
        verbose_name=_('Mapping')
    )

    # Event details
    direction = models.CharField(
        max_length=10,
        choices=SyncMapping.SyncDirection.choices,
        verbose_name=_('Direction')
    )
    triggered_by = models.CharField(
        max_length=50,
        choices=TriggeredBy.choices,
        verbose_name=_('Triggered By')
    )
    triggered_by_user_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Triggered By User')
    )

    # Change details
    changes = models.JSONField(
        default=dict,
        verbose_name=_('Changes'),
        help_text=_('What fields changed during sync')
    )
    local_state_before = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Local State Before')
    )
    remote_state_before = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Remote State Before')
    )

    # Result
    success = models.BooleanField(
        default=True,
        verbose_name=_('Success')
    )
    error_details = models.TextField(
        blank=True,
        verbose_name=_('Error Details')
    )

    # Timing
    started_at = models.DateTimeField(
        default=timezone.now,
        verbose_name=_('Started At')
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Completed At')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = _('Sync Event')
        verbose_name_plural = _('Sync Events')
        indexes = [
            models.Index(fields=['mapping', 'created_at']),
            models.Index(fields=['success', 'created_at']),
        ]

    def __str__(self):
        status = "Success" if self.success else "Failed"
        return f"{self.mapping} - {self.get_direction_display()} ({status})"

    @property
    def duration_ms(self) -> int:
        """Calculate sync duration in milliseconds."""
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return int(delta.total_seconds() * 1000)
        return 0

    def complete_success(self):
        """Mark event as successfully completed."""
        self.success = True
        self.completed_at = timezone.now()
        self.save(update_fields=['success', 'completed_at'])

    def complete_failure(self, error: str):
        """Mark event as failed."""
        self.success = False
        self.completed_at = timezone.now()
        self.error_details = error
        self.save(update_fields=['success', 'completed_at', 'error_details'])

    @classmethod
    def create_event(
        cls,
        mapping: SyncMapping,
        direction: str,
        triggered_by: str,
        changes: dict = None,
        user_id: str = None
    ) -> 'SyncEvent':
        """Create a new sync event."""
        return cls.objects.create(
            mapping=mapping,
            direction=direction,
            triggered_by=triggered_by,
            triggered_by_user_id=user_id,
            changes=changes or {},
        )
