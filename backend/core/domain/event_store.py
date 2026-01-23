"""
Event Store Model

This file is separate from events.py to avoid circular import issues
with Django's app loading mechanism.
"""

import uuid
from django.db import models


class EventStore(models.Model):
    """
    Event store for domain events.

    Uses PostgreSQL JSONB for efficient storage and querying.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    event_id = models.UUIDField(unique=True, db_index=True)
    aggregate_id = models.UUIDField(db_index=True, null=True, blank=True)
    aggregate_version = models.IntegerField(default=0)
    occurred_at = models.DateTimeField(db_index=True)
    event_type = models.CharField(max_length=255, db_index=True)
    payload = models.JSONField()

    class Meta:
        app_label = "core"
        db_table = "domain_events"
        ordering = ["occurred_at"]
        indexes = [
            models.Index(fields=["aggregate_id", "aggregate_version"]),
            models.Index(fields=["event_type", "occurred_at"]),
        ]

    def __str__(self):
        return f"{self.event_type} ({self.event_id})"
