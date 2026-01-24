# MIT License - See LICENSE-MIT.txt in repository root
"""
Portfolio Management Models - Clean-room MIT implementation

Provides portfolio/project management functionality including:
- Generic collections for grouping GRC objects
- Accreditation tracking and lifecycle management
"""

import uuid
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class GenericCollection(models.Model):
    """
    Groups related GRC objects together for portfolio management.

    Collections can include compliance assessments, risk assessments,
    policies, documents, and other GRC artifacts.
    """

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Identification
    ref_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Reference ID')
    )
    name = models.CharField(
        max_length=200,
        verbose_name=_('Name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )

    # Related GRC objects (stored as lists of UUIDs)
    compliance_assessment_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Compliance Assessments')
    )
    risk_assessment_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Risk Assessments')
    )
    crq_study_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('CRQ Studies')
    )
    ebios_study_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('EBIOS Studies')
    )
    entity_assessment_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Entity Assessments')
    )
    findings_assessment_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Findings Assessments')
    )
    document_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Documents')
    )
    security_exception_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Security Exceptions')
    )
    policy_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Policies')
    )

    # Collection dependencies
    dependency_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Dependencies'),
        help_text=_('Other collections this one depends on')
    )

    # Labels for filtering
    label_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Labels')
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
        verbose_name = _('Generic Collection')
        verbose_name_plural = _('Generic Collections')

    def __str__(self):
        return f"{self.ref_id} - {self.name}" if self.ref_id else self.name

    @property
    def total_items(self) -> int:
        """Count total items in collection."""
        count = 0
        for field in [
            'compliance_assessment_ids', 'risk_assessment_ids', 'crq_study_ids',
            'ebios_study_ids', 'entity_assessment_ids', 'findings_assessment_ids',
            'document_ids', 'security_exception_ids', 'policy_ids'
        ]:
            items = getattr(self, field, [])
            if items:
                count += len(items)
        return count

    @property
    def has_dependencies(self) -> bool:
        """Check if collection has dependencies."""
        return bool(self.dependency_ids)

    def add_compliance_assessment(self, assessment_id: str):
        """Add a compliance assessment to the collection."""
        if str(assessment_id) not in [str(a) for a in self.compliance_assessment_ids]:
            self.compliance_assessment_ids.append(str(assessment_id))
            self.save(update_fields=['compliance_assessment_ids', 'updated_at'])

    def add_risk_assessment(self, assessment_id: str):
        """Add a risk assessment to the collection."""
        if str(assessment_id) not in [str(a) for a in self.risk_assessment_ids]:
            self.risk_assessment_ids.append(str(assessment_id))
            self.save(update_fields=['risk_assessment_ids', 'updated_at'])

    def add_document(self, document_id: str):
        """Add a document to the collection."""
        if str(document_id) not in [str(d) for d in self.document_ids]:
            self.document_ids.append(str(document_id))
            self.save(update_fields=['document_ids', 'updated_at'])

    def add_dependency(self, collection_id: str):
        """Add a dependency on another collection."""
        if str(collection_id) not in [str(c) for c in self.dependency_ids]:
            self.dependency_ids.append(str(collection_id))
            self.save(update_fields=['dependency_ids', 'updated_at'])


class Accreditation(models.Model):
    """
    Tracks system accreditation status and lifecycle.

    Accreditation represents formal authorization to operate a system
    based on assessment of its security posture.
    """

    class AccreditationStatus(models.TextChoices):
        """Accreditation lifecycle status."""
        DRAFT = 'draft', _('Draft')
        IN_PROGRESS = 'in_progress', _('In Progress')
        ACCREDITED = 'accredited', _('Accredited')
        NOT_ACCREDITED = 'not_accredited', _('Not Accredited')
        SUSPENDED = 'suspended', _('Suspended')
        REVOKED = 'revoked', _('Revoked')
        EXPIRED = 'expired', _('Expired')
        OBSOLETE = 'obsolete', _('Obsolete')

    class AccreditationCategory(models.TextChoices):
        """Type/level of accreditation."""
        SIMPLIFIED = 'simplified', _('Simplified')
        ELABORATED = 'elaborated', _('Elaborated')
        ADVANCED = 'advanced', _('Advanced')
        SENSITIVE = 'sensitive', _('Sensitive')
        RESTRICTED = 'restricted', _('Restricted')
        OTHER = 'other', _('Other')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Identification
    ref_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Reference ID')
    )
    name = models.CharField(
        max_length=200,
        verbose_name=_('Name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description')
    )

    # Classification
    category = models.CharField(
        max_length=20,
        choices=AccreditationCategory.choices,
        default=AccreditationCategory.OTHER,
        verbose_name=_('Category')
    )
    status = models.CharField(
        max_length=20,
        choices=AccreditationStatus.choices,
        default=AccreditationStatus.DRAFT,
        verbose_name=_('Status')
    )

    # Authority
    authority_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Accreditation Authority'),
        help_text=_('Entity providing the accreditation')
    )
    author_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Author'),
        help_text=_('Actor who authored the accreditation')
    )

    # Dates
    issued_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('Issued Date')
    )
    expiry_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('Expiry Date')
    )

    # Related objects
    collection_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Linked Collection'),
        help_text=_('Collection this accreditation is based on')
    )
    checklist_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Checklist Assessment'),
        help_text=_('Compliance assessment used as checklist')
    )

    # Observations
    observation = models.TextField(
        blank=True,
        verbose_name=_('Observation'),
        help_text=_('Notes and observations about the accreditation')
    )
    conditions = models.TextField(
        blank=True,
        verbose_name=_('Conditions'),
        help_text=_('Conditions attached to the accreditation')
    )

    # Labels for filtering
    label_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Labels')
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
        ordering = ['-updated_at']
        verbose_name = _('Accreditation')
        verbose_name_plural = _('Accreditations')

    def __str__(self):
        return f"{self.ref_id} - {self.name}" if self.ref_id else self.name

    @property
    def is_active(self) -> bool:
        """Check if accreditation is currently active."""
        if self.status != self.AccreditationStatus.ACCREDITED:
            return False
        if self.expiry_date and self.expiry_date < timezone.now().date():
            return False
        return True

    @property
    def is_expired(self) -> bool:
        """Check if accreditation has expired."""
        if self.expiry_date:
            return self.expiry_date < timezone.now().date()
        return False

    @property
    def days_until_expiry(self) -> int:
        """Days until expiry (negative if expired)."""
        if self.expiry_date:
            delta = self.expiry_date - timezone.now().date()
            return delta.days
        return 999999  # No expiry set

    @property
    def needs_renewal(self) -> bool:
        """Check if accreditation needs renewal (within 90 days)."""
        return 0 < self.days_until_expiry <= 90

    def grant(self, issued_date=None, expiry_date=None):
        """Grant the accreditation."""
        self.status = self.AccreditationStatus.ACCREDITED
        self.issued_date = issued_date or timezone.now().date()
        if expiry_date:
            self.expiry_date = expiry_date
        self.save(update_fields=['status', 'issued_date', 'expiry_date', 'updated_at'])

    def deny(self, observation: str = ''):
        """Deny the accreditation."""
        self.status = self.AccreditationStatus.NOT_ACCREDITED
        if observation:
            self.observation = observation
        self.save(update_fields=['status', 'observation', 'updated_at'])

    def suspend(self, observation: str = ''):
        """Suspend the accreditation."""
        self.status = self.AccreditationStatus.SUSPENDED
        if observation:
            self.observation = observation
        self.save(update_fields=['status', 'observation', 'updated_at'])

    def revoke(self, observation: str = ''):
        """Revoke the accreditation."""
        self.status = self.AccreditationStatus.REVOKED
        if observation:
            self.observation = observation
        self.save(update_fields=['status', 'observation', 'updated_at'])

    def mark_expired(self):
        """Mark as expired."""
        self.status = self.AccreditationStatus.EXPIRED
        self.save(update_fields=['status', 'updated_at'])

    def renew(self, new_expiry_date):
        """Renew the accreditation with a new expiry date."""
        if self.status not in [
            self.AccreditationStatus.ACCREDITED,
            self.AccreditationStatus.EXPIRED
        ]:
            raise ValueError("Can only renew accredited or expired accreditations")
        self.status = self.AccreditationStatus.ACCREDITED
        self.expiry_date = new_expiry_date
        self.save(update_fields=['status', 'expiry_date', 'updated_at'])
