"""
Django models for connector management.

Provides persistence for connector configurations and sync execution history.
"""

import uuid
from django.db import models
from django.utils import timezone


class ConnectorInstance(models.Model):
    """A configured instance of a connector."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    connector_type = models.CharField(
        max_length=100,
        help_text="Registry key for the connector (e.g., 'snyk', 'aws_security_hub')",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    # Connection config stored as JSON (credentials excluded from serialization)
    config = models.JSONField(default=dict, blank=True)

    # Scheduling
    sync_interval_minutes = models.PositiveIntegerField(
        default=0,
        help_text="Auto-sync interval in minutes. 0 = manual only.",
    )
    last_sync_at = models.DateTimeField(null=True, blank=True)
    next_sync_at = models.DateTimeField(null=True, blank=True)

    # Health
    status = models.CharField(
        max_length=20,
        choices=[
            ("configured", "Configured"),
            ("connected", "Connected"),
            ("error", "Error"),
            ("disabled", "Disabled"),
        ],
        default="configured",
    )
    last_error = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "connectors"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.name} ({self.connector_type})"


class SyncExecution(models.Model):
    """Record of a connector sync execution."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    connector_instance = models.ForeignKey(
        ConnectorInstance,
        on_delete=models.CASCADE,
        related_name="sync_executions",
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ("running", "Running"),
            ("completed", "Completed"),
            ("failed", "Failed"),
            ("cancelled", "Cancelled"),
        ],
        default="running",
    )
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Results
    items_fetched = models.PositiveIntegerField(default=0)
    items_created = models.PositiveIntegerField(default=0)
    items_updated = models.PositiveIntegerField(default=0)
    items_skipped = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list, blank=True)

    # Metadata
    trigger = models.CharField(
        max_length=20,
        choices=[
            ("manual", "Manual"),
            ("scheduled", "Scheduled"),
            ("webhook", "Webhook"),
        ],
        default="manual",
    )
    duration_seconds = models.FloatField(null=True, blank=True)

    class Meta:
        app_label = "connectors"
        ordering = ["-started_at"]

    def __str__(self):
        return f"Sync {self.connector_instance.name} @ {self.started_at}"

    def complete(self, items_fetched=0, items_created=0, items_updated=0, items_skipped=0):
        self.status = "completed"
        self.completed_at = timezone.now()
        self.items_fetched = items_fetched
        self.items_created = items_created
        self.items_updated = items_updated
        self.items_skipped = items_skipped
        if self.started_at:
            self.duration_seconds = (self.completed_at - self.started_at).total_seconds()
        self.save()

    def fail(self, error_message):
        self.status = "failed"
        self.completed_at = timezone.now()
        self.errors = [error_message]
        if self.started_at:
            self.duration_seconds = (self.completed_at - self.started_at).total_seconds()
        self.save()
