"""
ConsentRecord Aggregate

Represents a consent record from a data subject for data processing purposes.
"""

import uuid
from typing import List, Optional
from datetime import datetime
from django.db import models
from django.utils import timezone

from core.domain.aggregate import AggregateRoot
from core.domain.fields import EmbeddedIdArrayField


class ConsentRecord(AggregateRoot):
    """
    Consent Record aggregate root.

    Represents a consent record capturing a data subject's consent
    for specific data processing purposes.
    """

    class LifecycleState(models.TextChoices):
        ACTIVE = "active", "Active"
        WITHDRAWN = "withdrawn", "Withdrawn"
        EXPIRED = "expired", "Expired"

    class ConsentMethod(models.TextChoices):
        WEB_FORM = "web_form", "Web Form"
        EMAIL = "email", "Email"
        PAPER = "paper", "Paper"
        VERBAL = "verbal", "Verbal"
        CHECKBOX = "checkbox", "Checkbox"
        DOUBLE_OPT_IN = "double_opt_in", "Double Opt-In"

    class DataSubjectType(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        EMPLOYEE = "employee", "Employee"
        PROSPECT = "prospect", "Prospect"
        VENDOR = "vendor", "Vendor"
        PARTNER = "partner", "Partner"
        OTHER = "other", "Other"

    # Data subject identification (pseudonymized)
    data_subject_email = models.EmailField(
        db_index=True,
        help_text="Email of the data subject (may be hashed)"
    )
    data_subject_type = models.CharField(
        max_length=20,
        choices=DataSubjectType.choices,
        default=DataSubjectType.CUSTOMER,
        db_index=True
    )
    data_subject_reference = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="External reference ID for the data subject"
    )

    # Consent details
    consent_method = models.CharField(
        max_length=20,
        choices=ConsentMethod.choices,
        default=ConsentMethod.WEB_FORM
    )
    consent_date = models.DateTimeField(db_index=True)
    valid_until = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="When the consent expires"
    )

    # Lifecycle
    lifecycle_state = models.CharField(
        max_length=20,
        choices=LifecycleState.choices,
        default=LifecycleState.ACTIVE,
        db_index=True
    )
    withdrawn_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When consent was withdrawn"
    )

    # Related processing purposes and data assets
    processing_purpose_ids = EmbeddedIdArrayField(
        models.UUIDField(),
        default=list,
        blank=True,
        help_text="Array of processing purpose IDs this consent covers"
    )
    data_asset_ids = EmbeddedIdArrayField(
        models.UUIDField(),
        default=list,
        blank=True,
        help_text="Array of data asset IDs this consent covers"
    )

    # Audit trail
    consent_text = models.TextField(
        blank=True,
        null=True,
        help_text="The consent text that was presented"
    )
    consent_version = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Version of the consent form used"
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address where consent was given"
    )

    # Additional fields
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "privacy_consent_records"
        verbose_name = "Consent Record"
        verbose_name_plural = "Consent Records"
        indexes = [
            models.Index(fields=["data_subject_email", "lifecycle_state"]),
            models.Index(fields=["consent_date"]),
            models.Index(fields=["valid_until"]),
        ]

    def create(self, data_subject_email: str, consent_method: str,
               consent_date: Optional[datetime] = None,
               data_subject_type: str = None,
               valid_until: Optional[datetime] = None,
               consent_text: str = None,
               consent_version: str = None):
        """
        Create a new consent record.

        Domain method that enforces business rules.
        """
        self.data_subject_email = data_subject_email
        self.consent_method = consent_method
        self.consent_date = consent_date or timezone.now()
        self.data_subject_type = data_subject_type or self.DataSubjectType.CUSTOMER
        self.valid_until = valid_until
        self.consent_text = consent_text
        self.consent_version = consent_version
        self.lifecycle_state = self.LifecycleState.ACTIVE

    def withdraw(self):
        """Withdraw consent"""
        if self.lifecycle_state == self.LifecycleState.ACTIVE:
            self.lifecycle_state = self.LifecycleState.WITHDRAWN
            self.withdrawn_at = timezone.now()

    def expire(self):
        """Mark consent as expired"""
        if self.lifecycle_state == self.LifecycleState.ACTIVE:
            self.lifecycle_state = self.LifecycleState.EXPIRED

    def add_processing_purpose(self, purpose_id: uuid.UUID):
        """Add a processing purpose to this consent"""
        if purpose_id not in self.processing_purpose_ids:
            self.processing_purpose_ids.append(purpose_id)

    def add_data_asset(self, data_asset_id: uuid.UUID):
        """Add a data asset to this consent"""
        if data_asset_id not in self.data_asset_ids:
            self.data_asset_ids.append(data_asset_id)

    def is_valid(self) -> bool:
        """Check if consent is still valid"""
        if self.lifecycle_state != self.LifecycleState.ACTIVE:
            return False
        if self.valid_until and self.valid_until < timezone.now():
            return False
        return True

    def __str__(self):
        return f"Consent({self.data_subject_email}, {self.consent_date.date()})"
