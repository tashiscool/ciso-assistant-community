"""
Significant Change Request Aggregate

Represents a change request that may require FedRAMP Significant Change Notification (SCN).
Implements the managed change control lifecycle: impact analysis → determination → SCN if needed → approval.

Per FedRAMP 20x KSI-AFR-05: Significant Change Notifications requirement.
"""

import uuid
from typing import Optional, List, Dict, Any
from django.db import models
from django.utils import timezone
from datetime import date, timedelta

from core.domain.aggregate import AggregateRoot


class SignificantChangeRequest(AggregateRoot):
    """
    Significant Change Request aggregate.

    Tracks changes to a Cloud Service Offering that may require FedRAMP
    Significant Change Notification (SCN). Implements impact analysis
    workflow and SCN submission tracking.
    """

    class ChangeStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted for Review"
        IMPACT_ANALYSIS = "impact_analysis", "Impact Analysis In Progress"
        IMPACT_ASSESSED = "impact_assessed", "Impact Assessed"
        SCN_REQUIRED = "scn_required", "SCN Required"
        SCN_NOT_REQUIRED = "scn_not_required", "SCN Not Required"
        SCN_SUBMITTED = "scn_submitted", "SCN Submitted to FedRAMP"
        SCN_ACKNOWLEDGED = "scn_acknowledged", "SCN Acknowledged by FedRAMP"
        APPROVED = "approved", "Change Approved"
        REJECTED = "rejected", "Change Rejected"
        IMPLEMENTED = "implemented", "Change Implemented"
        WITHDRAWN = "withdrawn", "Withdrawn"

    class ChangeType(models.TextChoices):
        BOUNDARY = "boundary", "Authorization Boundary Change"
        TECHNOLOGY = "technology", "Technology/Architecture Change"
        PERSONNEL = "personnel", "Key Personnel Change"
        PROCESS = "process", "Process/Procedure Change"
        VENDOR = "vendor", "Third-Party Vendor Change"
        DATA_FLOW = "data_flow", "Data Flow Change"
        ENCRYPTION = "encryption", "Encryption Change"
        AUTHENTICATION = "authentication", "Authentication/Access Control Change"
        NETWORK = "network", "Network Architecture Change"
        STORAGE = "storage", "Data Storage Change"
        INTERCONNECTION = "interconnection", "Interconnection Change"
        PHYSICAL = "physical", "Physical Security Change"
        INCIDENT_RESPONSE = "incident_response", "Incident Response Change"
        CONTINGENCY = "contingency", "Contingency Planning Change"
        OTHER = "other", "Other Change"

    class ImpactLevel(models.TextChoices):
        NONE = "none", "No Impact"
        LOW = "low", "Low Impact"
        MODERATE = "moderate", "Moderate Impact"
        HIGH = "high", "High Impact"
        CRITICAL = "critical", "Critical Impact"

    class SCNCategory(models.TextChoices):
        """FedRAMP SCN categories per guidance"""
        CAT1_BOUNDARY = "cat1_boundary", "Category 1: Authorization Boundary"
        CAT2_SERVICES = "cat2_services", "Category 2: Services/Features"
        CAT3_ARCHITECTURE = "cat3_architecture", "Category 3: Architecture"
        CAT4_INTERCONNECTIONS = "cat4_interconnections", "Category 4: Interconnections"
        CAT5_ENCRYPTION = "cat5_encryption", "Category 5: Cryptographic Modules"
        CAT6_CONTROLS = "cat6_controls", "Category 6: Control Implementation"
        CAT7_PERSONNEL = "cat7_personnel", "Category 7: Key Personnel"
        CAT8_PHYSICAL = "cat8_physical", "Category 8: Physical Environment"
        NOT_APPLICABLE = "not_applicable", "Not Applicable"

    # Foreign key
    cloud_service_offering_id = models.UUIDField(
        db_index=True,
        help_text="Cloud Service Offering this change applies to"
    )

    # Change identification
    change_number = models.CharField(
        max_length=50, blank=True, null=True, unique=True,
        help_text="Unique change request number (e.g., SCR-2026-001)"
    )
    title = models.CharField(
        max_length=255,
        help_text="Brief title describing the change"
    )
    description = models.TextField(
        help_text="Detailed description of the proposed change"
    )

    # Change classification
    change_type = models.CharField(
        max_length=30,
        choices=ChangeType.choices,
        default=ChangeType.OTHER,
        db_index=True,
        help_text="Type of change"
    )
    scn_category = models.CharField(
        max_length=30,
        choices=SCNCategory.choices,
        default=SCNCategory.NOT_APPLICABLE,
        help_text="FedRAMP SCN category if applicable"
    )

    # Status tracking
    status = models.CharField(
        max_length=30,
        choices=ChangeStatus.choices,
        default=ChangeStatus.DRAFT,
        db_index=True,
        help_text="Current status of the change request"
    )

    # Dates
    requested_date = models.DateTimeField(
        auto_now_add=True,
        help_text="Date the change was requested"
    )
    planned_implementation_date = models.DateField(
        null=True, blank=True,
        help_text="Planned date for implementing the change"
    )
    actual_implementation_date = models.DateField(
        null=True, blank=True,
        help_text="Actual date the change was implemented"
    )

    # Requestor information
    requestor_name = models.CharField(
        max_length=255,
        help_text="Name of person requesting the change"
    )
    requestor_email = models.EmailField(
        blank=True, null=True,
        help_text="Email of requestor"
    )
    requestor_organization = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Organization of requestor"
    )

    # Impact Analysis
    impact_level = models.CharField(
        max_length=20,
        choices=ImpactLevel.choices,
        default=ImpactLevel.NONE,
        help_text="Assessed impact level of the change"
    )
    impact_analysis = models.JSONField(
        default=dict, blank=True,
        help_text="Detailed impact analysis"
    )
    impact_analysis_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date impact analysis was completed"
    )
    impact_analyst = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Person who performed impact analysis"
    )

    # Affected components
    affected_components = models.JSONField(
        default=list, blank=True,
        help_text="List of affected system components"
    )
    affected_ksi_ids = models.JSONField(
        default=list, blank=True,
        help_text="List of affected KSI reference IDs"
    )
    affected_control_ids = models.JSONField(
        default=list, blank=True,
        help_text="List of affected NIST control IDs"
    )
    affected_data_types = models.JSONField(
        default=list, blank=True,
        help_text="Types of data affected by the change"
    )

    # Risk assessment
    risk_before_change = models.TextField(
        blank=True, null=True,
        help_text="Risk assessment before the change"
    )
    risk_after_change = models.TextField(
        blank=True, null=True,
        help_text="Risk assessment after the change"
    )
    risk_delta = models.CharField(
        max_length=20,
        choices=[
            ("decreased", "Risk Decreased"),
            ("unchanged", "Risk Unchanged"),
            ("increased", "Risk Increased"),
            ("unknown", "Unknown"),
        ],
        default="unknown",
        help_text="How the change affects overall risk"
    )
    mitigation_measures = models.TextField(
        blank=True, null=True,
        help_text="Mitigation measures for any increased risk"
    )

    # SCN tracking
    scn_required = models.BooleanField(
        default=False,
        help_text="Whether this change requires FedRAMP SCN"
    )
    scn_determination_rationale = models.TextField(
        blank=True, null=True,
        help_text="Rationale for SCN determination"
    )
    scn_determination_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date SCN determination was made"
    )
    scn_submission_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date SCN was submitted to FedRAMP"
    )
    scn_reference_number = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="FedRAMP SCN reference number"
    )
    scn_acknowledgment_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date FedRAMP acknowledged the SCN"
    )
    scn_response = models.TextField(
        blank=True, null=True,
        help_text="FedRAMP response to SCN"
    )

    # Approval workflow
    security_review_required = models.BooleanField(
        default=True,
        help_text="Whether security team review is required"
    )
    security_review_completed = models.BooleanField(
        default=False,
        help_text="Whether security review has been completed"
    )
    security_reviewer = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Security reviewer name"
    )
    security_review_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date of security review"
    )
    security_review_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes from security review"
    )

    approver_name = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Name of person who approved/rejected"
    )
    approval_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date of approval/rejection"
    )
    approval_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes from approver"
    )

    # Rejection/withdrawal
    rejection_reason = models.TextField(
        blank=True, null=True,
        help_text="Reason for rejection"
    )
    withdrawal_reason = models.TextField(
        blank=True, null=True,
        help_text="Reason for withdrawal"
    )

    # Implementation tracking
    implementation_plan = models.TextField(
        blank=True, null=True,
        help_text="Plan for implementing the change"
    )
    rollback_plan = models.TextField(
        blank=True, null=True,
        help_text="Plan for rolling back if issues occur"
    )
    implementation_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes from implementation"
    )
    verification_completed = models.BooleanField(
        default=False,
        help_text="Whether post-implementation verification is complete"
    )
    verification_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date of post-implementation verification"
    )
    verification_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes from verification"
    )

    # Related records
    related_incident_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs of related security incidents"
    )
    related_poam_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs of related POA&M items"
    )
    related_change_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs of related change requests"
    )

    # Attachments
    attachments = models.JSONField(
        default=list, blank=True,
        help_text="List of attachment references"
    )

    # OAR reporting
    reported_in_oar_id = models.UUIDField(
        null=True, blank=True,
        help_text="OAR where this change was reported"
    )

    # Audit trail
    audit_trail = models.JSONField(
        default=list, blank=True,
        help_text="Audit trail of status changes"
    )

    # Metadata
    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fedramp_significant_change_requests'
        verbose_name = 'Significant Change Request'
        verbose_name_plural = 'Significant Change Requests'
        ordering = ['-requested_date']
        indexes = [
            models.Index(fields=['cloud_service_offering_id', 'status']),
            models.Index(fields=['status', 'scn_required']),
            models.Index(fields=['change_type', 'status']),
            models.Index(fields=['planned_implementation_date']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"SCR({self.change_number or self.id}): {self.title} [{self.status}]"

    # Factory method
    @classmethod
    def create(cls, cso_id: uuid.UUID, title: str, description: str,
               change_type: str, requestor_name: str,
               planned_date: date = None,
               created_by: uuid.UUID = None) -> 'SignificantChangeRequest':
        """Create a new Significant Change Request"""
        scr = cls()
        scr.cloud_service_offering_id = cso_id
        scr.title = title
        scr.description = description
        scr.change_type = change_type
        scr.requestor_name = requestor_name
        scr.planned_implementation_date = planned_date
        scr.created_by = created_by
        scr.status = cls.ChangeStatus.DRAFT

        # Generate change number
        year = timezone.now().year
        scr.change_number = f"SCR-{year}-{str(scr.id)[:8].upper()}"

        scr._add_audit_entry("created", "Change request created")

        from ..domain_events import SignificantChangeRequestCreated
        scr._raise_event(SignificantChangeRequestCreated(
            aggregate_id=scr.id,
            cso_id=str(cso_id),
            title=title,
            change_type=change_type
        ))

        return scr

    # Business methods
    def submit_for_review(self) -> None:
        """Submit change request for review"""
        if self.status != self.ChangeStatus.DRAFT:
            raise ValueError("Can only submit from DRAFT status")

        self.status = self.ChangeStatus.SUBMITTED
        self._add_audit_entry("submitted", "Submitted for review")

        from ..domain_events import SignificantChangeSubmitted
        self._raise_event(SignificantChangeSubmitted(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            title=self.title
        ))

    def start_impact_analysis(self, analyst: str = None) -> None:
        """Begin impact analysis"""
        if self.status not in [self.ChangeStatus.SUBMITTED, self.ChangeStatus.DRAFT]:
            raise ValueError("Cannot start impact analysis from current status")

        self.status = self.ChangeStatus.IMPACT_ANALYSIS
        self.impact_analyst = analyst
        self._add_audit_entry("impact_analysis_started", f"Impact analysis started by {analyst}")

    def complete_impact_analysis(
        self,
        impact_level: str,
        affected_components: List[str] = None,
        affected_ksi_ids: List[str] = None,
        affected_control_ids: List[str] = None,
        analysis_details: Dict[str, Any] = None,
        risk_before: str = None,
        risk_after: str = None,
        risk_delta: str = None,
        mitigation: str = None,
        analyst: str = None
    ) -> None:
        """Complete impact analysis with findings"""
        if self.status != self.ChangeStatus.IMPACT_ANALYSIS:
            raise ValueError("Impact analysis must be in progress")

        self.impact_level = impact_level
        self.affected_components = affected_components or []
        self.affected_ksi_ids = affected_ksi_ids or []
        self.affected_control_ids = affected_control_ids or []
        self.impact_analysis = analysis_details or {}
        self.risk_before_change = risk_before
        self.risk_after_change = risk_after
        self.risk_delta = risk_delta or "unknown"
        self.mitigation_measures = mitigation
        self.impact_analysis_date = timezone.now()
        if analyst:
            self.impact_analyst = analyst

        self.status = self.ChangeStatus.IMPACT_ASSESSED
        self._add_audit_entry(
            "impact_analysis_completed",
            f"Impact analysis completed: {impact_level} impact, {len(self.affected_ksi_ids)} KSIs affected"
        )

        from ..domain_events import SignificantChangeImpactAssessed
        self._raise_event(SignificantChangeImpactAssessed(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            impact_level=impact_level,
            affected_ksi_count=len(self.affected_ksi_ids)
        ))

    def determine_scn_required(
        self,
        scn_required: bool,
        scn_category: str = None,
        rationale: str = None
    ) -> None:
        """Determine whether SCN is required"""
        if self.status != self.ChangeStatus.IMPACT_ASSESSED:
            raise ValueError("Impact must be assessed before SCN determination")

        self.scn_required = scn_required
        self.scn_category = scn_category or self.SCNCategory.NOT_APPLICABLE
        self.scn_determination_rationale = rationale
        self.scn_determination_date = timezone.now()

        if scn_required:
            self.status = self.ChangeStatus.SCN_REQUIRED
            self._add_audit_entry("scn_required", f"SCN required: {scn_category}")
        else:
            self.status = self.ChangeStatus.SCN_NOT_REQUIRED
            self._add_audit_entry("scn_not_required", "SCN not required")

        from ..domain_events import SignificantChangeSCNDetermined
        self._raise_event(SignificantChangeSCNDetermined(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            scn_required=scn_required,
            scn_category=scn_category
        ))

    def submit_scn(self, scn_reference: str = None) -> None:
        """Submit SCN to FedRAMP"""
        if self.status != self.ChangeStatus.SCN_REQUIRED:
            raise ValueError("SCN must be required to submit")

        self.status = self.ChangeStatus.SCN_SUBMITTED
        self.scn_submission_date = timezone.now()
        self.scn_reference_number = scn_reference
        self._add_audit_entry("scn_submitted", f"SCN submitted: {scn_reference}")

        from ..domain_events import SignificantChangeSCNSubmitted
        self._raise_event(SignificantChangeSCNSubmitted(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            scn_reference=scn_reference
        ))

    def record_scn_acknowledgment(self, response: str = None) -> None:
        """Record FedRAMP acknowledgment of SCN"""
        if self.status != self.ChangeStatus.SCN_SUBMITTED:
            raise ValueError("SCN must be submitted to acknowledge")

        self.status = self.ChangeStatus.SCN_ACKNOWLEDGED
        self.scn_acknowledgment_date = timezone.now()
        self.scn_response = response
        self._add_audit_entry("scn_acknowledged", "SCN acknowledged by FedRAMP")

    def complete_security_review(
        self,
        reviewer: str,
        approved: bool,
        notes: str = None
    ) -> None:
        """Complete security review"""
        self.security_review_completed = True
        self.security_reviewer = reviewer
        self.security_review_date = timezone.now()
        self.security_review_notes = notes
        self._add_audit_entry(
            "security_review_completed",
            f"Security review completed by {reviewer}: {'Approved' if approved else 'Not Approved'}"
        )

    def approve(self, approver: str, notes: str = None) -> None:
        """Approve the change request"""
        # Can approve from several states
        valid_states = [
            self.ChangeStatus.SCN_NOT_REQUIRED,
            self.ChangeStatus.SCN_ACKNOWLEDGED,
            self.ChangeStatus.IMPACT_ASSESSED,  # For low-impact changes
        ]
        if self.status not in valid_states:
            raise ValueError(f"Cannot approve from {self.status} status")

        if self.security_review_required and not self.security_review_completed:
            raise ValueError("Security review must be completed before approval")

        self.status = self.ChangeStatus.APPROVED
        self.approver_name = approver
        self.approval_date = timezone.now()
        self.approval_notes = notes
        self._add_audit_entry("approved", f"Approved by {approver}")

        from ..domain_events import SignificantChangeApproved
        self._raise_event(SignificantChangeApproved(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            approver=approver
        ))

    def reject(self, rejector: str, reason: str) -> None:
        """Reject the change request"""
        if self.status in [self.ChangeStatus.IMPLEMENTED, self.ChangeStatus.WITHDRAWN]:
            raise ValueError("Cannot reject implemented or withdrawn change")

        self.status = self.ChangeStatus.REJECTED
        self.approver_name = rejector
        self.approval_date = timezone.now()
        self.rejection_reason = reason
        self._add_audit_entry("rejected", f"Rejected by {rejector}: {reason}")

        from ..domain_events import SignificantChangeRejected
        self._raise_event(SignificantChangeRejected(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            reason=reason
        ))

    def withdraw(self, reason: str = None) -> None:
        """Withdraw the change request"""
        if self.status == self.ChangeStatus.IMPLEMENTED:
            raise ValueError("Cannot withdraw implemented change")

        self.status = self.ChangeStatus.WITHDRAWN
        self.withdrawal_reason = reason
        self._add_audit_entry("withdrawn", f"Withdrawn: {reason}")

    def mark_implemented(
        self,
        implementation_date: date = None,
        notes: str = None
    ) -> None:
        """Mark the change as implemented"""
        if self.status != self.ChangeStatus.APPROVED:
            raise ValueError("Change must be approved before implementation")

        self.status = self.ChangeStatus.IMPLEMENTED
        self.actual_implementation_date = implementation_date or timezone.now().date()
        self.implementation_notes = notes
        self._add_audit_entry("implemented", "Change implemented")

        from ..domain_events import SignificantChangeImplemented
        self._raise_event(SignificantChangeImplemented(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            implementation_date=str(self.actual_implementation_date)
        ))

    def verify_implementation(self, verifier: str, notes: str = None) -> None:
        """Verify post-implementation"""
        if self.status != self.ChangeStatus.IMPLEMENTED:
            raise ValueError("Change must be implemented to verify")

        self.verification_completed = True
        self.verification_date = timezone.now()
        self.verification_notes = notes
        self._add_audit_entry("verified", f"Implementation verified by {verifier}")

    def link_to_incident(self, incident_id: uuid.UUID) -> None:
        """Link this change to a security incident"""
        incident_str = str(incident_id)
        if incident_str not in self.related_incident_ids:
            self.related_incident_ids.append(incident_str)

    def link_to_poam(self, poam_id: uuid.UUID) -> None:
        """Link this change to a POA&M item"""
        poam_str = str(poam_id)
        if poam_str not in self.related_poam_ids:
            self.related_poam_ids.append(poam_str)

    def add_attachment(self, name: str, path: str, attachment_type: str = None) -> None:
        """Add an attachment reference"""
        self.attachments.append({
            'name': name,
            'path': path,
            'type': attachment_type,
            'added_at': timezone.now().isoformat()
        })

    # Helper methods
    def _add_audit_entry(self, action: str, description: str) -> None:
        """Add an entry to the audit trail"""
        self.audit_trail.append({
            'action': action,
            'description': description,
            'timestamp': timezone.now().isoformat(),
            'status': self.status
        })

    # Query methods
    def is_pending_scn(self) -> bool:
        """Check if change is pending SCN submission"""
        return self.status == self.ChangeStatus.SCN_REQUIRED

    def is_approved(self) -> bool:
        """Check if change has been approved"""
        return self.status in [self.ChangeStatus.APPROVED, self.ChangeStatus.IMPLEMENTED]

    def is_complete(self) -> bool:
        """Check if change process is complete"""
        return self.status in [
            self.ChangeStatus.IMPLEMENTED,
            self.ChangeStatus.REJECTED,
            self.ChangeStatus.WITHDRAWN
        ]

    def requires_fedramp_notification(self) -> bool:
        """Check if this change requires FedRAMP notification"""
        return self.scn_required

    def get_status_summary(self) -> Dict[str, Any]:
        """Get summary of change request status"""
        return {
            'change_number': self.change_number,
            'title': self.title,
            'status': self.status,
            'change_type': self.change_type,
            'impact_level': self.impact_level,
            'scn_required': self.scn_required,
            'scn_category': self.scn_category if self.scn_required else None,
            'scn_reference': self.scn_reference_number,
            'planned_date': str(self.planned_implementation_date) if self.planned_implementation_date else None,
            'actual_date': str(self.actual_implementation_date) if self.actual_implementation_date else None,
            'affected_ksi_count': len(self.affected_ksi_ids),
            'affected_control_count': len(self.affected_control_ids),
            'security_reviewed': self.security_review_completed,
            'verified': self.verification_completed
        }

    def to_oar_format(self) -> Dict[str, Any]:
        """Format change for OAR reporting"""
        return {
            'change_number': self.change_number,
            'type': self.change_type,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'scn_required': self.scn_required,
            'scn_category': self.scn_category,
            'scn_reference': self.scn_reference_number,
            'impact_level': self.impact_level,
            'planned_date': str(self.planned_implementation_date) if self.planned_implementation_date else None,
            'implementation_date': str(self.actual_implementation_date) if self.actual_implementation_date else None,
            'affected_ksis': self.affected_ksi_ids,
            'risk_delta': self.risk_delta
        }
