"""
DataSubjectRight Aggregate

Represents a data subject right request (DSAR) such as access, erasure, or portability.
"""

import uuid
from typing import List, Optional
from datetime import datetime, timedelta
from django.db import models
from django.utils import timezone

from core.domain.aggregate import AggregateRoot
from core.domain.fields import EmbeddedIdArrayField


class DataSubjectRight(AggregateRoot):
    """
    Data Subject Right aggregate root.

    Represents a data subject rights request (DSAR) tracking
    requests for access, erasure, rectification, portability, etc.
    """

    class LifecycleState(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    class RightType(models.TextChoices):
        ACCESS = "access", "Right of Access"
        ERASURE = "erasure", "Right to Erasure"
        RECTIFICATION = "rectification", "Right to Rectification"
        PORTABILITY = "portability", "Right to Data Portability"
        RESTRICTION = "restriction", "Right to Restriction"
        OBJECTION = "objection", "Right to Object"
        AUTOMATED_DECISION = "automated_decision", "Rights Related to Automated Decision Making"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    # Request identification
    reference_number = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique reference number for this request"
    )

    # Data subject information
    data_subject_email = models.EmailField(
        db_index=True,
        help_text="Email of the data subject"
    )
    data_subject_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Name of the data subject"
    )

    # Request details
    right_type = models.CharField(
        max_length=30,
        choices=RightType.choices,
        db_index=True,
        help_text="Type of right being exercised"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Description of the request"
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True
    )

    # Lifecycle
    lifecycle_state = models.CharField(
        max_length=20,
        choices=LifecycleState.choices,
        default=LifecycleState.PENDING,
        db_index=True
    )

    # Timeline
    received_date = models.DateTimeField(db_index=True)
    due_date = models.DateTimeField(db_index=True)
    response_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the request was responded to"
    )

    # Assignment
    assigned_to_user_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="User ID of the person handling this request"
    )

    # Related data assets
    data_asset_ids = EmbeddedIdArrayField(
        models.UUIDField(),
        default=list,
        blank=True,
        help_text="Array of data asset IDs affected by this request"
    )

    # Response details
    response_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Notes about the response"
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for rejection if applicable"
    )

    # Evidence
    evidence_ids = EmbeddedIdArrayField(
        models.UUIDField(),
        default=list,
        blank=True,
        help_text="Array of evidence/document IDs"
    )

    # Additional fields
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "privacy_data_subject_rights"
        verbose_name = "Data Subject Right"
        verbose_name_plural = "Data Subject Rights"
        indexes = [
            models.Index(fields=["lifecycle_state", "due_date"]),
            models.Index(fields=["data_subject_email"]),
            models.Index(fields=["right_type"]),
            models.Index(fields=["received_date"]),
        ]

    def create(self, data_subject_email: str, right_type: str,
               received_date: Optional[datetime] = None,
               description: str = None,
               priority: str = None,
               response_deadline_days: int = 30):
        """
        Create a new data subject right request.

        Domain method that enforces business rules.
        """
        import uuid as uuid_module
        self.reference_number = f"DSAR-{uuid_module.uuid4().hex[:8].upper()}"
        self.data_subject_email = data_subject_email
        self.right_type = right_type
        self.description = description
        self.priority = priority or self.Priority.MEDIUM
        self.received_date = received_date or timezone.now()
        self.due_date = self.received_date + timedelta(days=response_deadline_days)
        self.lifecycle_state = self.LifecycleState.PENDING

    def start_processing(self, assigned_to_user_id: uuid.UUID = None):
        """Start processing the request"""
        if self.lifecycle_state == self.LifecycleState.PENDING:
            self.lifecycle_state = self.LifecycleState.IN_PROGRESS
            if assigned_to_user_id:
                self.assigned_to_user_id = assigned_to_user_id

    def complete(self, response_notes: str = None):
        """Complete the request"""
        if self.lifecycle_state == self.LifecycleState.IN_PROGRESS:
            self.lifecycle_state = self.LifecycleState.COMPLETED
            self.response_date = timezone.now()
            self.response_notes = response_notes

    def reject(self, rejection_reason: str):
        """Reject the request"""
        if self.lifecycle_state in [self.LifecycleState.PENDING, self.LifecycleState.IN_PROGRESS]:
            self.lifecycle_state = self.LifecycleState.REJECTED
            self.response_date = timezone.now()
            self.rejection_reason = rejection_reason

    def cancel(self):
        """Cancel the request"""
        if self.lifecycle_state in [self.LifecycleState.PENDING, self.LifecycleState.IN_PROGRESS]:
            self.lifecycle_state = self.LifecycleState.CANCELLED
            self.response_date = timezone.now()

    def add_data_asset(self, data_asset_id: uuid.UUID):
        """Add a data asset affected by this request"""
        if data_asset_id not in self.data_asset_ids:
            self.data_asset_ids.append(data_asset_id)

    def add_evidence(self, evidence_id: uuid.UUID):
        """Add evidence/documentation"""
        if evidence_id not in self.evidence_ids:
            self.evidence_ids.append(evidence_id)

    def is_overdue(self) -> bool:
        """Check if the request is overdue"""
        if self.lifecycle_state in [self.LifecycleState.COMPLETED, self.LifecycleState.REJECTED, self.LifecycleState.CANCELLED]:
            return False
        return timezone.now() > self.due_date

    def days_until_due(self) -> int:
        """Get number of days until due date (negative if overdue)"""
        delta = self.due_date - timezone.now()
        return delta.days

    def __str__(self):
        return f"{self.reference_number} ({self.right_type})"
