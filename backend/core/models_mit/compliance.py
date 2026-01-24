"""
Compliance Models - MIT Licensed

Clean-room implementation of compliance management for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.conf import settings
from ..base_models_mit import AbstractGRCEntity
from .organization import Organization, Domain
from .governance import Framework, Control, AppliedControl


class ComplianceRequirement(AbstractGRCEntity):
    """
    A compliance requirement from a framework.

    Requirements are specific obligations that must be met
    for compliance with a framework.
    """
    framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='requirements'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )

    # Requirement identifier
    requirement_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Requirement identifier"
    )

    # Requirement details
    requirement_text = models.TextField(
        blank=True,
        default="",
        help_text="Full text of the requirement"
    )
    guidance = models.TextField(
        blank=True,
        default="",
        help_text="Implementation guidance"
    )

    # Classification
    class RequirementType(models.TextChoices):
        MANDATORY = 'mandatory', 'Mandatory'
        RECOMMENDED = 'recommended', 'Recommended'
        OPTIONAL = 'optional', 'Optional'

    requirement_type = models.CharField(
        max_length=20,
        choices=RequirementType.choices,
        default=RequirementType.MANDATORY
    )

    # Related controls
    controls = models.ManyToManyField(
        Control,
        blank=True,
        related_name='requirements',
        help_text="Controls that address this requirement"
    )

    # Order for display
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Compliance Requirement"
        verbose_name_plural = "Compliance Requirements"
        ordering = ['order', 'requirement_id']
        unique_together = [['framework', 'requirement_id']]

    def __str__(self):
        return f"{self.requirement_id}: {self.name}"


class RequirementAssessment(AbstractGRCEntity):
    """
    Assessment of a requirement's compliance status.

    Documents whether an organization meets a specific requirement.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='requirement_assessments'
    )
    requirement = models.ForeignKey(
        ComplianceRequirement,
        on_delete=models.CASCADE,
        related_name='assessments'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='requirement_assessments'
    )

    # Compliance status
    class ComplianceStatus(models.TextChoices):
        NOT_ASSESSED = 'not_assessed', 'Not Assessed'
        COMPLIANT = 'compliant', 'Compliant'
        PARTIALLY_COMPLIANT = 'partially_compliant', 'Partially Compliant'
        NON_COMPLIANT = 'non_compliant', 'Non-Compliant'
        NOT_APPLICABLE = 'not_applicable', 'Not Applicable'

    status = models.CharField(
        max_length=25,
        choices=ComplianceStatus.choices,
        default=ComplianceStatus.NOT_ASSESSED
    )

    # Compliance score (0-100)
    compliance_score = models.PositiveSmallIntegerField(
        default=0,
        help_text="Compliance percentage (0-100)"
    )

    # Assessment details
    assessment_notes = models.TextField(
        blank=True,
        default="",
        help_text="Notes from the assessment"
    )
    gaps_identified = models.TextField(
        blank=True,
        default="",
        help_text="Description of compliance gaps"
    )
    remediation_plan = models.TextField(
        blank=True,
        default="",
        help_text="Plan to address gaps"
    )

    # Applied controls addressing this requirement
    applied_controls = models.ManyToManyField(
        AppliedControl,
        blank=True,
        related_name='requirement_assessments'
    )

    # Dates
    assessment_date = models.DateField(
        null=True,
        blank=True
    )
    next_assessment_date = models.DateField(
        null=True,
        blank=True
    )
    remediation_due_date = models.DateField(
        null=True,
        blank=True
    )

    # Assessor
    assessor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_requirement_assessments'
    )

    class Meta:
        verbose_name = "Requirement Assessment"
        verbose_name_plural = "Requirement Assessments"
        ordering = ['-assessment_date']
        unique_together = [['organization', 'requirement']]


class Audit(AbstractGRCEntity):
    """
    A compliance audit activity.

    Audits are formal evaluations of compliance status.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='audits'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='audits'
    )
    frameworks = models.ManyToManyField(
        Framework,
        blank=True,
        related_name='audits',
        help_text="Frameworks being audited"
    )

    # Audit type
    class AuditType(models.TextChoices):
        INTERNAL = 'internal', 'Internal'
        EXTERNAL = 'external', 'External'
        SELF_ASSESSMENT = 'self_assessment', 'Self-Assessment'
        REGULATORY = 'regulatory', 'Regulatory'
        CERTIFICATION = 'certification', 'Certification'

    audit_type = models.CharField(
        max_length=20,
        choices=AuditType.choices,
        default=AuditType.INTERNAL
    )

    # Status
    class AuditStatus(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    status = models.CharField(
        max_length=20,
        choices=AuditStatus.choices,
        default=AuditStatus.PLANNED
    )

    # Dates
    planned_start_date = models.DateField(
        null=True,
        blank=True
    )
    planned_end_date = models.DateField(
        null=True,
        blank=True
    )
    actual_start_date = models.DateField(
        null=True,
        blank=True
    )
    actual_end_date = models.DateField(
        null=True,
        blank=True
    )

    # Scope
    scope_description = models.TextField(
        blank=True,
        default=""
    )
    objectives = models.TextField(
        blank=True,
        default=""
    )

    # Auditor information
    lead_auditor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='led_audits'
    )
    audit_team = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='participated_audits'
    )
    external_auditor = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="External auditor/firm name"
    )

    # Results
    executive_summary = models.TextField(
        blank=True,
        default=""
    )
    overall_conclusion = models.TextField(
        blank=True,
        default=""
    )
    recommendations = models.TextField(
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Audit"
        verbose_name_plural = "Audits"
        ordering = ['-planned_start_date']


class Finding(AbstractGRCEntity):
    """
    An audit finding or observation.

    Findings document issues discovered during audits or assessments.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='findings'
    )
    audit = models.ForeignKey(
        Audit,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='findings'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='findings'
    )

    # Finding classification
    class FindingType(models.TextChoices):
        NON_CONFORMITY = 'non_conformity', 'Non-Conformity'
        OBSERVATION = 'observation', 'Observation'
        OPPORTUNITY = 'opportunity', 'Opportunity for Improvement'
        STRENGTH = 'strength', 'Strength'

    finding_type = models.CharField(
        max_length=20,
        choices=FindingType.choices,
        default=FindingType.OBSERVATION
    )

    # Severity
    class Severity(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'
        INFORMATIONAL = 'informational', 'Informational'

    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MEDIUM
    )

    # Status
    class FindingStatus(models.TextChoices):
        OPEN = 'open', 'Open'
        IN_PROGRESS = 'in_progress', 'In Progress'
        REMEDIATED = 'remediated', 'Remediated'
        VERIFIED = 'verified', 'Verified Closed'
        ACCEPTED = 'accepted', 'Risk Accepted'
        FALSE_POSITIVE = 'false_positive', 'False Positive'

    status = models.CharField(
        max_length=20,
        choices=FindingStatus.choices,
        default=FindingStatus.OPEN
    )

    # Finding details
    detailed_description = models.TextField(
        blank=True,
        default=""
    )
    root_cause = models.TextField(
        blank=True,
        default=""
    )
    business_impact = models.TextField(
        blank=True,
        default=""
    )
    recommendation = models.TextField(
        blank=True,
        default=""
    )

    # Related entities
    requirements = models.ManyToManyField(
        ComplianceRequirement,
        blank=True,
        related_name='findings'
    )
    applied_controls = models.ManyToManyField(
        AppliedControl,
        blank=True,
        related_name='findings'
    )

    # Ownership and tracking
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_findings'
    )
    identified_date = models.DateField(
        null=True,
        blank=True
    )
    due_date = models.DateField(
        null=True,
        blank=True
    )
    remediation_date = models.DateField(
        null=True,
        blank=True
    )
    verification_date = models.DateField(
        null=True,
        blank=True
    )

    # Remediation
    remediation_plan = models.TextField(
        blank=True,
        default=""
    )
    remediation_notes = models.TextField(
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Finding"
        verbose_name_plural = "Findings"
        ordering = ['-identified_date', '-severity']


class Evidence(AbstractGRCEntity):
    """
    Evidence supporting compliance or control implementation.

    Evidence documents proof of compliance, control implementation,
    or audit findings.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='evidence'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='evidence'
    )

    # Evidence type
    class EvidenceType(models.TextChoices):
        DOCUMENT = 'document', 'Document'
        SCREENSHOT = 'screenshot', 'Screenshot'
        LOG = 'log', 'Log/Report'
        CONFIGURATION = 'configuration', 'Configuration'
        INTERVIEW = 'interview', 'Interview Notes'
        OBSERVATION = 'observation', 'Observation'
        TEST_RESULT = 'test_result', 'Test Result'
        ATTESTATION = 'attestation', 'Attestation'

    evidence_type = models.CharField(
        max_length=20,
        choices=EvidenceType.choices,
        default=EvidenceType.DOCUMENT
    )

    # File information
    file_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Path to evidence file"
    )
    file_name = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    file_size = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="File size in bytes"
    )
    mime_type = models.CharField(
        max_length=100,
        blank=True,
        default=""
    )
    file_hash = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="SHA-256 hash of file"
    )

    # Evidence content (for text-based evidence)
    content = models.TextField(
        blank=True,
        default="",
        help_text="Evidence content or notes"
    )

    # Validity
    collected_date = models.DateField(
        null=True,
        blank=True
    )
    valid_from = models.DateField(
        null=True,
        blank=True
    )
    valid_until = models.DateField(
        null=True,
        blank=True
    )

    # Related entities
    applied_controls = models.ManyToManyField(
        AppliedControl,
        blank=True,
        related_name='evidence'
    )
    requirements = models.ManyToManyField(
        ComplianceRequirement,
        blank=True,
        related_name='evidence'
    )
    findings = models.ManyToManyField(
        Finding,
        blank=True,
        related_name='evidence'
    )

    # Collector
    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='collected_evidence'
    )

    class Meta:
        verbose_name = "Evidence"
        verbose_name_plural = "Evidence"
        ordering = ['-collected_date']


class ComplianceException(AbstractGRCEntity):
    """
    A documented exception to compliance requirements.

    Exceptions document approved deviations from requirements
    with justification and compensating controls.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='compliance_exceptions'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='compliance_exceptions'
    )

    # Related requirements
    requirements = models.ManyToManyField(
        ComplianceRequirement,
        blank=True,
        related_name='exceptions'
    )

    # Exception details
    justification = models.TextField(
        help_text="Business justification for the exception"
    )
    compensating_controls = models.TextField(
        blank=True,
        default="",
        help_text="Compensating controls in place"
    )
    residual_risk = models.TextField(
        blank=True,
        default="",
        help_text="Description of residual risk"
    )

    # Status
    class ExceptionStatus(models.TextChoices):
        PENDING = 'pending', 'Pending Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        EXPIRED = 'expired', 'Expired'
        REVOKED = 'revoked', 'Revoked'

    status = models.CharField(
        max_length=20,
        choices=ExceptionStatus.choices,
        default=ExceptionStatus.PENDING
    )

    # Dates
    requested_date = models.DateField(
        auto_now_add=True
    )
    approval_date = models.DateField(
        null=True,
        blank=True
    )
    expiration_date = models.DateField(
        null=True,
        blank=True
    )

    # Ownership
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_exceptions'
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_exceptions'
    )

    # Review
    next_review_date = models.DateField(
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = "Compliance Exception"
        verbose_name_plural = "Compliance Exceptions"
        ordering = ['-requested_date']
