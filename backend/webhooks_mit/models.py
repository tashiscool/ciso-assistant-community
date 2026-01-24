# MIT License - See LICENSE-MIT.txt in repository root
"""
Webhooks Models - Clean-room MIT implementation

Provides webhook functionality for event-driven notifications including:
- Event type registration
- Endpoint configuration with security
- Delivery tracking and retry
"""

import uuid
import hashlib
import hmac
import ipaddress
from urllib.parse import urlparse
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError


class WebhookEventType(models.Model):
    """
    Represents a subscribable webhook event type.

    Event types follow a model.action pattern (e.g., "appliedcontrol.created").
    """

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Event identification
    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name=_('Event Type'),
        help_text=_('Event type string (e.g., "appliedcontrol.created")')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description'),
        help_text=_('Description of when this event is triggered')
    )

    # Categorization
    model_name = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_('Model Name'),
        help_text=_('The model this event relates to')
    )
    action = models.CharField(
        max_length=20,
        blank=True,
        verbose_name=_('Action'),
        help_text=_('Action type (created, updated, deleted)')
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active'),
        help_text=_('Whether this event type can be subscribed to')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = _('Webhook Event Type')
        verbose_name_plural = _('Webhook Event Types')

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Auto-populate model_name and action from name if not set."""
        if not self.model_name or not self.action:
            parts = self.name.rsplit('.', 1)
            if len(parts) == 2:
                self.model_name = parts[0]
                self.action = parts[1]
        super().save(*args, **kwargs)

    @classmethod
    def get_or_create_for_event(cls, model_name: str, action: str) -> 'WebhookEventType':
        """Get or create an event type for a model/action pair."""
        event_name = f"{model_name}.{action}"
        event_type, _ = cls.objects.get_or_create(
            name=event_name,
            defaults={
                'model_name': model_name,
                'action': action,
            }
        )
        return event_type


class WebhookEndpoint(models.Model):
    """
    Consumer endpoint configuration for receiving webhook events.

    Endpoints can subscribe to multiple event types and optionally
    scope their subscriptions to specific folders.
    """

    class PayloadFormat(models.TextChoices):
        """Format of webhook payload."""
        THIN = 'thin', _('Thin (IDs only)')
        FULL = 'full', _('Full (Complete data)')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Identification
    name = models.CharField(
        max_length=200,
        verbose_name=_('Name'),
        help_text=_('Friendly name for this endpoint')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )

    # Endpoint configuration
    url = models.URLField(
        max_length=512,
        verbose_name=_('URL'),
        help_text=_('Consumer URL to send webhook events to')
    )
    secret = models.CharField(
        max_length=100,
        verbose_name=_('Secret'),
        help_text=_('HMAC signing secret for payload verification')
    )

    # Payload options
    payload_format = models.CharField(
        max_length=10,
        choices=PayloadFormat.choices,
        default=PayloadFormat.FULL,
        verbose_name=_('Payload Format')
    )

    # Event subscriptions (list of event type IDs)
    subscribed_event_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Subscribed Events'),
        help_text=_('List of event type UUIDs to subscribe to')
    )

    # Folder scoping (list of folder IDs)
    target_folder_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Target Folders'),
        help_text=_('Scope to specific folders (empty = all folders)')
    )

    # Owner
    owner_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Owner'),
        help_text=_('Actor that owns this endpoint')
    )

    # Status
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active'),
        help_text=_('Enable/disable sending events')
    )

    # Security settings
    allow_private_ips = models.BooleanField(
        default=False,
        verbose_name=_('Allow Private IPs'),
        help_text=_('Allow internal/private IP addresses')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping (for the endpoint itself)
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Webhook Endpoint')
        verbose_name_plural = _('Webhook Endpoints')

    def __str__(self):
        return f"{self.name} ({self.url})"

    def clean(self):
        """Validate URL for SSRF prevention."""
        super().clean()

        try:
            hostname = urlparse(self.url).hostname
            if not hostname:
                raise ValidationError({'url': _('Invalid URL provided.')})

            # Try to parse as IP address
            try:
                ip = ipaddress.ip_address(hostname)
                if not self.allow_private_ips:
                    if ip.is_private or ip.is_loopback or ip.is_reserved:
                        raise ValidationError({
                            'url': _('URL cannot be an internal, loopback, or reserved IP address.')
                        })
            except ValueError:
                # It's a domain name, not an IP - that's fine
                pass
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            raise ValidationError({'url': _('Invalid URL format.')})

    def save(self, *args, **kwargs):
        """Validate before saving."""
        self.full_clean()
        super().save(*args, **kwargs)

    def sign_payload(self, payload: bytes) -> str:
        """Generate HMAC signature for payload."""
        return hmac.new(
            self.secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify HMAC signature for payload."""
        expected = self.sign_payload(payload)
        return hmac.compare_digest(expected, signature)

    @property
    def is_folder_scoped(self) -> bool:
        """Check if endpoint is scoped to specific folders."""
        return bool(self.target_folder_ids)

    def is_subscribed_to(self, event_type_id: str) -> bool:
        """Check if endpoint subscribes to an event type."""
        return str(event_type_id) in [str(e) for e in self.subscribed_event_ids]

    def activate(self):
        """Activate this endpoint."""
        self.is_active = True
        self.save(update_fields=['is_active', 'updated_at'])

    def deactivate(self):
        """Deactivate this endpoint."""
        self.is_active = False
        self.save(update_fields=['is_active', 'updated_at'])


class WebhookDelivery(models.Model):
    """
    Tracks webhook delivery attempts.

    Records each delivery attempt with status, timing, and response details
    for debugging and retry purposes.
    """

    class Status(models.TextChoices):
        """Delivery status."""
        PENDING = 'pending', _('Pending')
        SUCCESS = 'success', _('Success')
        FAILED = 'failed', _('Failed')
        RETRYING = 'retrying', _('Retrying')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # References
    endpoint_id = models.UUIDField(
        verbose_name=_('Endpoint'),
        db_index=True
    )
    event_type = models.CharField(
        max_length=100,
        verbose_name=_('Event Type')
    )

    # Payload
    payload = models.JSONField(
        default=dict,
        verbose_name=_('Payload')
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name=_('Status'),
        db_index=True
    )

    # Timing
    scheduled_at = models.DateTimeField(
        default=timezone.now,
        verbose_name=_('Scheduled At')
    )
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Sent At')
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Completed At')
    )

    # Response
    response_status_code = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name=_('Response Status Code')
    )
    response_body = models.TextField(
        blank=True,
        verbose_name=_('Response Body')
    )
    error_message = models.TextField(
        blank=True,
        verbose_name=_('Error Message')
    )

    # Retry tracking
    attempt_number = models.PositiveSmallIntegerField(
        default=1,
        verbose_name=_('Attempt Number')
    )
    max_attempts = models.PositiveSmallIntegerField(
        default=5,
        verbose_name=_('Max Attempts')
    )
    next_retry_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Next Retry At')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = _('Webhook Delivery')
        verbose_name_plural = _('Webhook Deliveries')
        indexes = [
            models.Index(fields=['endpoint_id', 'status']),
            models.Index(fields=['status', 'next_retry_at']),
        ]

    def __str__(self):
        return f"{self.event_type} -> {self.endpoint_id} ({self.get_status_display()})"

    @property
    def duration_ms(self) -> int:
        """Calculate delivery duration in milliseconds."""
        if self.sent_at and self.completed_at:
            delta = self.completed_at - self.sent_at
            return int(delta.total_seconds() * 1000)
        return 0

    @property
    def is_success(self) -> bool:
        """Check if delivery was successful."""
        return self.status == self.Status.SUCCESS

    @property
    def can_retry(self) -> bool:
        """Check if delivery can be retried."""
        if self.status == self.Status.SUCCESS:
            return False
        return self.attempt_number < self.max_attempts

    def mark_success(self, status_code: int, response_body: str = ''):
        """Mark delivery as successful."""
        now = timezone.now()
        self.status = self.Status.SUCCESS
        self.completed_at = now
        self.response_status_code = status_code
        self.response_body = response_body[:10000]  # Limit size
        self.save(update_fields=[
            'status', 'completed_at', 'response_status_code',
            'response_body', 'updated_at'
        ])

    def mark_failed(self, error: str, status_code: int = None, response_body: str = ''):
        """Mark delivery as failed and schedule retry if possible."""
        now = timezone.now()
        self.completed_at = now
        self.error_message = error
        self.response_status_code = status_code
        self.response_body = response_body[:10000] if response_body else ''

        if self.can_retry:
            self.status = self.Status.RETRYING
            self.attempt_number += 1
            # Exponential backoff: 1m, 2m, 4m, 8m, 16m
            delay_minutes = 2 ** (self.attempt_number - 1)
            self.next_retry_at = now + timezone.timedelta(minutes=delay_minutes)
        else:
            self.status = self.Status.FAILED

        self.save(update_fields=[
            'status', 'completed_at', 'error_message',
            'response_status_code', 'response_body',
            'attempt_number', 'next_retry_at', 'updated_at'
        ])

    def mark_sent(self):
        """Mark delivery as sent (in progress)."""
        self.sent_at = timezone.now()
        self.save(update_fields=['sent_at', 'updated_at'])

    @classmethod
    def create_delivery(cls, endpoint_id: str, event_type: str, payload: dict) -> 'WebhookDelivery':
        """Create a new delivery record."""
        return cls.objects.create(
            endpoint_id=endpoint_id,
            event_type=event_type,
            payload=payload,
            status=cls.Status.PENDING,
        )

    @classmethod
    def get_pending_retries(cls):
        """Get deliveries ready for retry."""
        now = timezone.now()
        return cls.objects.filter(
            status=cls.Status.RETRYING,
            next_retry_at__lte=now
        )
