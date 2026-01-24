"""
Assessment Models - MIT Licensed

Clean-room implementation of assessment entities for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.conf import settings
from ..base_models_mit import AbstractGRCEntity
from .organization import Organization, Domain
from .governance import Framework


class ComplianceAssessment(AbstractGRCEntity):
    """
    A compliance assessment activity.

    Compliance assessments evaluate an organization's adherence
    to requirements from one or more frameworks.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='compliance_assessments'
    )
    framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='compliance_assessments'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='compliance_assessments'
    )

    # Assessment type
    class AssessmentType(models.TextChoices):
        SELF_ASSESSMENT = 'self_assessment', 'Self-Assessment'
        INTERNAL_AUDIT = 'internal_audit', 'Internal Audit'
        EXTERNAL_AUDIT = 'external_audit', 'External Audit'
        CERTIFICATION = 'certification', 'Certification'
        GAP_ANALYSIS = 'gap_analysis', 'Gap Analysis'

    assessment_type = models.CharField(
        max_length=20,
        choices=AssessmentType.choices,
        default=AssessmentType.SELF_ASSESSMENT
    )

    # Status
    class AssessmentStatus(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        UNDER_REVIEW = 'under_review', 'Under Review'
        DONE = 'done', 'Done'
        DEPRECATED = 'deprecated', 'Deprecated'

    status = models.CharField(
        max_length=15,
        choices=AssessmentStatus.choices,
        default=AssessmentStatus.PLANNED
    )

    # Version tracking
    version = models.CharField(
        max_length=50,
        blank=True,
        default="1.0"
    )

    # Dates
    planned_start_date = models.DateField(null=True, blank=True)
    planned_end_date = models.DateField(null=True, blank=True)
    actual_start_date = models.DateField(null=True, blank=True)
    actual_end_date = models.DateField(null=True, blank=True)
    eta = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    # Ownership
    authors = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='authored_compliance_assessments'
    )
    reviewers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='reviewed_compliance_assessments'
    )

    # Scores
    overall_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Overall compliance score (0-100)"
    )

    # Observations
    observation = models.TextField(
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Compliance Assessment"
        verbose_name_plural = "Compliance Assessments"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.framework.name}"


class FindingsAssessment(AbstractGRCEntity):
    """
    An assessment focused on findings.

    Findings assessments track and manage audit findings,
    exceptions, and remediation activities.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='findings_assessments'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='findings_assessments'
    )

    # Status
    class AssessmentStatus(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        UNDER_REVIEW = 'under_review', 'Under Review'
        DONE = 'done', 'Done'
        DEPRECATED = 'deprecated', 'Deprecated'

    status = models.CharField(
        max_length=15,
        choices=AssessmentStatus.choices,
        default=AssessmentStatus.PLANNED
    )

    # Dates
    eta = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    # Ownership
    authors = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='authored_findings_assessments'
    )
    reviewers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='reviewed_findings_assessments'
    )

    # Observations
    observation = models.TextField(
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Findings Assessment"
        verbose_name_plural = "Findings Assessments"
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class RiskAcceptance(AbstractGRCEntity):
    """
    A formal risk acceptance record.

    Documents management's decision to accept a risk
    rather than treat it.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='risk_acceptances'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='risk_acceptances'
    )

    # Acceptance details
    justification = models.TextField(
        help_text="Business justification for accepting the risk"
    )
    residual_risk_description = models.TextField(
        blank=True,
        default="",
        help_text="Description of the residual risk being accepted"
    )
    compensating_controls = models.TextField(
        blank=True,
        default="",
        help_text="Any compensating controls in place"
    )

    # Status
    class AcceptanceStatus(models.TextChoices):
        CREATED = 'created', 'Created'
        SUBMITTED = 'submitted', 'Submitted'
        ACCEPTED = 'accepted', 'Accepted'
        REJECTED = 'rejected', 'Rejected'
        REVOKED = 'revoked', 'Revoked'
        EXPIRED = 'expired', 'Expired'

    status = models.CharField(
        max_length=15,
        choices=AcceptanceStatus.choices,
        default=AcceptanceStatus.CREATED
    )

    # Approvals
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_risk_acceptances'
    )
    approval_date = models.DateField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")

    # Validity
    expiration_date = models.DateField(
        null=True,
        blank=True,
        help_text="When this acceptance expires"
    )
    review_date = models.DateField(
        null=True,
        blank=True,
        help_text="Next review date"
    )

    # Risk scenarios being accepted (UUIDs for cross-reference)
    risk_scenario_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Risk scenarios covered by this acceptance"
    )

    class Meta:
        verbose_name = "Risk Acceptance"
        verbose_name_plural = "Risk Acceptances"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    @property
    def is_expired(self):
        """Check if the acceptance has expired."""
        from django.utils import timezone
        if self.expiration_date:
            return timezone.now().date() > self.expiration_date
        return False


class OrganisationIssue(AbstractGRCEntity):
    """
    An organizational issue or challenge.

    Tracks issues that could affect the organization's
    ability to achieve its objectives.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='organisation_issues'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='organisation_issues'
    )

    # Issue type
    class IssueType(models.TextChoices):
        INTERNAL = 'internal', 'Internal'
        EXTERNAL = 'external', 'External'
        REGULATORY = 'regulatory', 'Regulatory'
        COMPETITIVE = 'competitive', 'Competitive'
        TECHNOLOGICAL = 'technological', 'Technological'
        MARKET = 'market', 'Market'
        OTHER = 'other', 'Other'

    issue_type = models.CharField(
        max_length=20,
        choices=IssueType.choices,
        default=IssueType.OTHER
    )

    # Gravity
    class Gravity(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    gravity = models.CharField(
        max_length=10,
        choices=Gravity.choices,
        default=Gravity.MEDIUM
    )

    # Treatment
    treatment = models.TextField(
        blank=True,
        default="",
        help_text="How the issue is being addressed"
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_organisation_issues'
    )

    class Meta:
        verbose_name = "Organisation Issue"
        verbose_name_plural = "Organisation Issues"
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class OrganisationObjective(AbstractGRCEntity):
    """
    An organizational objective.

    Tracks strategic objectives that the GRC program
    should support.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='organisation_objectives'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='organisation_objectives'
    )

    # Objective type
    class ObjectiveType(models.TextChoices):
        STRATEGIC = 'strategic', 'Strategic'
        TACTICAL = 'tactical', 'Tactical'
        OPERATIONAL = 'operational', 'Operational'
        COMPLIANCE = 'compliance', 'Compliance'
        SECURITY = 'security', 'Security'
        OTHER = 'other', 'Other'

    objective_type = models.CharField(
        max_length=15,
        choices=ObjectiveType.choices,
        default=ObjectiveType.STRATEGIC
    )

    # Target date
    target_date = models.DateField(
        null=True,
        blank=True
    )

    # Status
    class ObjectiveStatus(models.TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        IN_PROGRESS = 'in_progress', 'In Progress'
        ACHIEVED = 'achieved', 'Achieved'
        NOT_ACHIEVED = 'not_achieved', 'Not Achieved'
        DEFERRED = 'deferred', 'Deferred'

    status = models.CharField(
        max_length=15,
        choices=ObjectiveStatus.choices,
        default=ObjectiveStatus.NOT_STARTED
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_organisation_objectives'
    )

    class Meta:
        verbose_name = "Organisation Objective"
        verbose_name_plural = "Organisation Objectives"
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Team(AbstractGRCEntity):
    """
    A team for collaboration.

    Teams group users for assignment and notification purposes.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='teams'
    )

    # Members
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='teams'
    )

    # Team lead
    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='led_teams'
    )

    # Contact
    email = models.EmailField(blank=True, default="")

    class Meta:
        verbose_name = "Team"
        verbose_name_plural = "Teams"
        ordering = ['name']

    def __str__(self):
        return self.name
