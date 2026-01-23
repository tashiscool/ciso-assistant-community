"""
KSI Implementation Aggregate

Tracks the implementation status of individual Key Security Indicators (KSIs)
for a Cloud Service Offering under FedRAMP 20x authorization.
"""

import uuid
from typing import Optional, List, Dict, Any
from django.db import models
from django.utils import timezone
from decimal import Decimal

from core.domain.aggregate import AggregateRoot


class KSIImplementation(AggregateRoot):
    """
    Key Security Indicator Implementation aggregate.

    Tracks the implementation and compliance status of individual KSIs
    for a specific Cloud Service Offering.
    """

    class ImplementationStatus(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        IN_PROGRESS = "in_progress", "In Progress"
        IMPLEMENTED = "implemented", "Implemented"
        NOT_APPLICABLE = "not_applicable", "Not Applicable"
        PARTIALLY_IMPLEMENTED = "partial", "Partially Implemented"

    class ValidationStatus(models.TextChoices):
        NOT_VALIDATED = "not_validated", "Not Validated"
        MANUAL = "manual", "Manual Validation"
        AUTOMATED = "automated", "Automated Validation"
        HYBRID = "hybrid", "Hybrid (Manual + Automated)"

    class ComplianceStatus(models.TextChoices):
        COMPLIANT = "compliant", "Compliant"
        NON_COMPLIANT = "non_compliant", "Non-Compliant"
        PENDING_REVIEW = "pending", "Pending Review"
        UNKNOWN = "unknown", "Unknown"

    # Foreign keys (as UUIDs for DDD pattern)
    cloud_service_offering_id = models.UUIDField(
        db_index=True,
        help_text="Cloud Service Offering this KSI belongs to"
    )

    # KSI reference
    ksi_urn = models.CharField(
        max_length=255,
        help_text="URN reference to the KSI framework requirement"
    )
    ksi_ref_id = models.CharField(
        max_length=50, db_index=True,
        help_text="KSI reference ID (e.g., KSI-AFR-01)"
    )
    ksi_category = models.CharField(
        max_length=50, db_index=True,
        help_text="KSI category (e.g., AFR, CED, CMT)"
    )
    ksi_name = models.CharField(
        max_length=255,
        help_text="KSI name for display"
    )

    # Impact level applicability
    applies_to_low = models.BooleanField(default=False, help_text="Applies to Low impact")
    applies_to_moderate = models.BooleanField(default=True, help_text="Applies to Moderate impact")
    applies_to_high = models.BooleanField(default=True, help_text="Applies to High impact")

    # Implementation tracking
    implementation_status = models.CharField(
        max_length=20,
        choices=ImplementationStatus.choices,
        default=ImplementationStatus.NOT_STARTED,
        db_index=True,
        help_text="Current implementation status"
    )
    implementation_description = models.TextField(
        blank=True, null=True,
        help_text="Description of how the KSI is implemented"
    )
    implementation_date = models.DateField(
        null=True, blank=True,
        help_text="Date implementation was completed"
    )

    # Validation tracking
    validation_status = models.CharField(
        max_length=20,
        choices=ValidationStatus.choices,
        default=ValidationStatus.NOT_VALIDATED,
        help_text="How this KSI is validated"
    )
    validation_method = models.TextField(
        blank=True, null=True,
        help_text="Description of validation method/procedure"
    )
    last_validation_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date of last validation"
    )
    last_validation_result = models.BooleanField(
        null=True, blank=True,
        help_text="Result of last validation (True=pass, False=fail)"
    )
    validation_frequency_days = models.IntegerField(
        default=30,
        help_text="How often this KSI should be validated (days)"
    )

    # Persistent validation (automated)
    has_persistent_validation = models.BooleanField(
        default=False,
        help_text="Whether this KSI has automated persistent validation"
    )
    persistent_validation_rule_id = models.UUIDField(
        null=True, blank=True,
        help_text="ID of the PersistentValidationRule if automated"
    )
    validation_automation_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Percentage of validation that is automated"
    )

    # Compliance
    compliance_status = models.CharField(
        max_length=20,
        choices=ComplianceStatus.choices,
        default=ComplianceStatus.UNKNOWN,
        db_index=True,
        help_text="Current compliance status"
    )
    compliance_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes on compliance status"
    )

    # Control mappings
    nist_controls = models.JSONField(
        default=list, blank=True,
        help_text="Mapped NIST SP 800-53 controls"
    )
    applied_control_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs of applied controls that satisfy this KSI"
    )

    # Evidence
    evidence_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs of evidence artifacts supporting this KSI"
    )
    last_evidence_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date of most recent evidence"
    )

    # POA&M tracking
    poam_id = models.UUIDField(
        null=True, blank=True,
        help_text="ID of POA&M item if non-compliant"
    )
    remediation_plan = models.TextField(
        blank=True, null=True,
        help_text="Remediation plan for non-compliance"
    )
    remediation_target_date = models.DateField(
        null=True, blank=True,
        help_text="Target date for remediation"
    )

    # Metadata
    assessor_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes from assessor/auditor"
    )
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fedramp_ksi_implementations'
        verbose_name = 'KSI Implementation'
        verbose_name_plural = 'KSI Implementations'
        ordering = ['ksi_category', 'ksi_ref_id']
        unique_together = [['cloud_service_offering_id', 'ksi_urn']]
        indexes = [
            models.Index(fields=['cloud_service_offering_id', 'compliance_status']),
            models.Index(fields=['ksi_category', 'implementation_status']),
            models.Index(fields=['has_persistent_validation']),
            models.Index(fields=['last_validation_date']),
        ]

    def __str__(self):
        return f"KSI({self.ksi_ref_id}): {self.implementation_status} / {self.compliance_status}"

    # Factory method
    @classmethod
    def create(cls, cso_id: uuid.UUID, ksi_urn: str, ksi_ref_id: str,
               ksi_category: str, ksi_name: str, impact_levels: List[str] = None,
               nist_controls: List[str] = None, created_by: uuid.UUID = None) -> 'KSIImplementation':
        """Create a new KSI Implementation record"""
        impl = cls()
        impl.cloud_service_offering_id = cso_id
        impl.ksi_urn = ksi_urn
        impl.ksi_ref_id = ksi_ref_id
        impl.ksi_category = ksi_category
        impl.ksi_name = ksi_name
        impl.created_by = created_by

        # Set impact level applicability
        if impact_levels:
            impl.applies_to_low = 'LOW' in impact_levels or 'low' in impact_levels
            impl.applies_to_moderate = 'MOD' in impact_levels or 'moderate' in impact_levels
            impl.applies_to_high = 'HIGH' in impact_levels or 'high' in impact_levels

        impl.nist_controls = nist_controls or []

        from ..domain_events import KSIImplementationCreated
        impl._raise_event(KSIImplementationCreated(
            aggregate_id=impl.id,
            cso_id=str(cso_id),
            ksi_ref_id=ksi_ref_id
        ))

        return impl

    # Business methods
    def mark_implemented(self, description: str = None, implementation_date=None) -> None:
        """Mark the KSI as implemented"""
        self.implementation_status = self.ImplementationStatus.IMPLEMENTED
        self.implementation_description = description
        self.implementation_date = implementation_date or timezone.now().date()
        self.compliance_status = self.ComplianceStatus.PENDING_REVIEW

        from ..domain_events import KSIMarkedImplemented
        self._raise_event(KSIMarkedImplemented(
            aggregate_id=self.id,
            ksi_ref_id=self.ksi_ref_id,
            cso_id=str(self.cloud_service_offering_id)
        ))

    def record_validation(self, passed: bool, method: str = None,
                         notes: str = None) -> None:
        """Record a validation result"""
        self.last_validation_date = timezone.now()
        self.last_validation_result = passed
        if method:
            self.validation_method = method

        # Update compliance status based on validation
        if passed:
            self.compliance_status = self.ComplianceStatus.COMPLIANT
        else:
            self.compliance_status = self.ComplianceStatus.NON_COMPLIANT
            if notes:
                self.compliance_notes = notes

        from ..domain_events import KSIValidationRecorded
        self._raise_event(KSIValidationRecorded(
            aggregate_id=self.id,
            ksi_ref_id=self.ksi_ref_id,
            passed=passed
        ))

    def enable_persistent_validation(self, rule_id: uuid.UUID,
                                    automation_percentage: float = 100) -> None:
        """Enable persistent (automated) validation for this KSI"""
        self.has_persistent_validation = True
        self.persistent_validation_rule_id = rule_id
        self.validation_automation_percentage = Decimal(str(automation_percentage))
        self.validation_status = (
            self.ValidationStatus.AUTOMATED
            if automation_percentage >= 100
            else self.ValidationStatus.HYBRID
        )

        from ..domain_events import KSIPersistentValidationEnabled
        self._raise_event(KSIPersistentValidationEnabled(
            aggregate_id=self.id,
            ksi_ref_id=self.ksi_ref_id,
            rule_id=str(rule_id)
        ))

    def disable_persistent_validation(self) -> None:
        """Disable persistent validation"""
        self.has_persistent_validation = False
        self.persistent_validation_rule_id = None
        self.validation_automation_percentage = Decimal('0')
        self.validation_status = self.ValidationStatus.MANUAL

    def link_applied_control(self, control_id: uuid.UUID) -> None:
        """Link an applied control that satisfies this KSI"""
        if str(control_id) not in self.applied_control_ids:
            self.applied_control_ids.append(str(control_id))

    def link_evidence(self, evidence_id: uuid.UUID) -> None:
        """Link evidence artifact to this KSI"""
        if str(evidence_id) not in self.evidence_ids:
            self.evidence_ids.append(str(evidence_id))
            self.last_evidence_date = timezone.now()

    def create_poam(self, remediation_plan: str, target_date) -> None:
        """Create or link a POA&M for non-compliance"""
        self.remediation_plan = remediation_plan
        self.remediation_target_date = target_date
        self.compliance_status = self.ComplianceStatus.NON_COMPLIANT

    def mark_not_applicable(self, justification: str) -> None:
        """Mark the KSI as not applicable"""
        self.implementation_status = self.ImplementationStatus.NOT_APPLICABLE
        self.compliance_status = self.ComplianceStatus.COMPLIANT
        self.implementation_description = f"Not Applicable: {justification}"

    # Query methods
    def is_compliant(self) -> bool:
        """Check if KSI is currently compliant"""
        return self.compliance_status == self.ComplianceStatus.COMPLIANT

    def needs_validation(self) -> bool:
        """Check if KSI needs validation based on frequency"""
        if not self.last_validation_date:
            return True
        days_since = (timezone.now() - self.last_validation_date).days
        return days_since >= self.validation_frequency_days

    def is_overdue(self) -> bool:
        """Check if KSI is overdue for validation"""
        if not self.last_validation_date:
            return True
        days_since = (timezone.now() - self.last_validation_date).days
        return days_since > (self.validation_frequency_days * 1.5)

    def get_status_summary(self) -> Dict[str, Any]:
        """Get summary of KSI status"""
        return {
            'ksi_ref_id': self.ksi_ref_id,
            'ksi_name': self.ksi_name,
            'category': self.ksi_category,
            'implementation_status': self.implementation_status,
            'compliance_status': self.compliance_status,
            'has_persistent_validation': self.has_persistent_validation,
            'automation_percentage': float(self.validation_automation_percentage),
            'last_validation': self.last_validation_date.isoformat() if self.last_validation_date else None,
            'needs_validation': self.needs_validation(),
            'evidence_count': len(self.evidence_ids),
            'control_count': len(self.applied_control_ids),
        }
