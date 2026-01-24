"""
Risk Management Models - MIT Licensed

Clean-room implementation of risk management for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from ..base_models_mit import AbstractGRCEntity, MetadataMixin
from .organization import Organization, Domain


class RiskMatrix(AbstractGRCEntity):
    """
    A risk assessment matrix defining impact and likelihood scales.

    Risk matrices provide the scoring framework for risk assessments.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='risk_matrices'
    )

    # Matrix dimensions
    probability_levels = models.JSONField(
        default=list,
        help_text="List of probability/likelihood levels with scores"
    )
    impact_levels = models.JSONField(
        default=list,
        help_text="List of impact/severity levels with scores"
    )

    # Risk thresholds
    risk_thresholds = models.JSONField(
        default=list,
        help_text="Risk level thresholds (e.g., low, medium, high, critical)"
    )

    # Grid definition (probability x impact = risk)
    risk_grid = models.JSONField(
        default=list,
        blank=True,
        help_text="Risk calculation grid"
    )

    # Default matrix
    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is the default matrix for the organization"
    )

    class Meta:
        verbose_name = "Risk Matrix"
        verbose_name_plural = "Risk Matrices"

    def calculate_risk_score(self, probability: int, impact: int) -> int:
        """Calculate risk score from probability and impact."""
        return probability * impact

    def get_risk_level(self, score: int) -> str:
        """Get risk level label from score."""
        for threshold in sorted(self.risk_thresholds, key=lambda x: x.get('min_score', 0)):
            if score >= threshold.get('min_score', 0):
                level = threshold.get('level', 'unknown')
            else:
                break
        return level


class Threat(AbstractGRCEntity):
    """
    A threat that could exploit vulnerabilities.

    Threats represent potential sources of harm to assets.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='threats'
    )

    # Threat classification
    class ThreatCategory(models.TextChoices):
        NATURAL = 'natural', 'Natural'
        HUMAN_INTENTIONAL = 'human_intentional', 'Human - Intentional'
        HUMAN_UNINTENTIONAL = 'human_unintentional', 'Human - Unintentional'
        TECHNICAL = 'technical', 'Technical'
        ENVIRONMENTAL = 'environmental', 'Environmental'

    category = models.CharField(
        max_length=25,
        choices=ThreatCategory.choices,
        default=ThreatCategory.TECHNICAL
    )

    # Threat source
    class ThreatSource(models.TextChoices):
        EXTERNAL = 'external', 'External'
        INTERNAL = 'internal', 'Internal'
        PARTNER = 'partner', 'Partner/Third-Party'
        UNKNOWN = 'unknown', 'Unknown'

    source = models.CharField(
        max_length=20,
        choices=ThreatSource.choices,
        default=ThreatSource.EXTERNAL
    )

    # Threat attributes
    capability_level = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Threat actor capability (1-5)"
    )
    intent_level = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Threat actor intent (1-5)"
    )
    targeting = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="How targeted the threat is (1-5)"
    )

    # References
    mitre_attack_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="MITRE ATT&CK technique IDs"
    )

    class Meta:
        verbose_name = "Threat"
        verbose_name_plural = "Threats"
        ordering = ['name']


class Vulnerability(AbstractGRCEntity):
    """
    A vulnerability that could be exploited by threats.

    Vulnerabilities are weaknesses in systems, processes, or controls.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='vulnerabilities'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='vulnerabilities'
    )

    # Vulnerability classification
    class VulnerabilityType(models.TextChoices):
        TECHNICAL = 'technical', 'Technical'
        PROCESS = 'process', 'Process'
        PEOPLE = 'people', 'People'
        PHYSICAL = 'physical', 'Physical'

    vulnerability_type = models.CharField(
        max_length=20,
        choices=VulnerabilityType.choices,
        default=VulnerabilityType.TECHNICAL
    )

    # Severity scoring
    severity_score = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Severity score (0-10, e.g., CVSS)"
    )

    # External references
    cve_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="CVE identifiers"
    )
    cwe_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="CWE identifiers"
    )

    # Status
    class VulnerabilityStatus(models.TextChoices):
        OPEN = 'open', 'Open'
        MITIGATED = 'mitigated', 'Mitigated'
        ACCEPTED = 'accepted', 'Accepted'
        FALSE_POSITIVE = 'false_positive', 'False Positive'

    status = models.CharField(
        max_length=20,
        choices=VulnerabilityStatus.choices,
        default=VulnerabilityStatus.OPEN
    )

    # Dates
    discovered_date = models.DateField(
        null=True,
        blank=True
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Remediation due date"
    )

    class Meta:
        verbose_name = "Vulnerability"
        verbose_name_plural = "Vulnerabilities"
        ordering = ['-severity_score', '-created_at']


class RiskScenario(AbstractGRCEntity, MetadataMixin):
    """
    A risk scenario combining threat, vulnerability, and impact.

    Risk scenarios describe specific ways that threats could
    exploit vulnerabilities to impact the organization.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='risk_scenarios'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='risk_scenarios'
    )
    risk_matrix = models.ForeignKey(
        RiskMatrix,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='risk_scenarios'
    )

    # Risk components
    threats = models.ManyToManyField(
        Threat,
        blank=True,
        related_name='risk_scenarios'
    )
    vulnerabilities = models.ManyToManyField(
        Vulnerability,
        blank=True,
        related_name='risk_scenarios'
    )

    # Risk category
    class RiskCategory(models.TextChoices):
        STRATEGIC = 'strategic', 'Strategic'
        OPERATIONAL = 'operational', 'Operational'
        FINANCIAL = 'financial', 'Financial'
        COMPLIANCE = 'compliance', 'Compliance'
        REPUTATIONAL = 'reputational', 'Reputational'
        TECHNOLOGY = 'technology', 'Technology'
        SECURITY = 'security', 'Security'

    category = models.CharField(
        max_length=20,
        choices=RiskCategory.choices,
        default=RiskCategory.SECURITY
    )

    # Inherent risk (before controls)
    inherent_probability = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Inherent probability (1-5)"
    )
    inherent_impact = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Inherent impact (1-5)"
    )

    # Residual risk (after controls)
    residual_probability = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Residual probability (1-5)"
    )
    residual_impact = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Residual impact (1-5)"
    )

    # Risk treatment
    class TreatmentStrategy(models.TextChoices):
        ACCEPT = 'accept', 'Accept'
        MITIGATE = 'mitigate', 'Mitigate'
        TRANSFER = 'transfer', 'Transfer'
        AVOID = 'avoid', 'Avoid'
        UNTREATED = 'untreated', 'Untreated'

    treatment_strategy = models.CharField(
        max_length=20,
        choices=TreatmentStrategy.choices,
        default=TreatmentStrategy.UNTREATED
    )
    treatment_description = models.TextField(
        blank=True,
        default=""
    )

    # Risk status
    class RiskStatus(models.TextChoices):
        IDENTIFIED = 'identified', 'Identified'
        ASSESSED = 'assessed', 'Assessed'
        TREATED = 'treated', 'Treated'
        MONITORING = 'monitoring', 'Monitoring'
        CLOSED = 'closed', 'Closed'

    status = models.CharField(
        max_length=20,
        choices=RiskStatus.choices,
        default=RiskStatus.IDENTIFIED
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_risk_scenarios'
    )

    # Financial impact (optional)
    estimated_loss_min = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Minimum estimated loss"
    )
    estimated_loss_max = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum estimated loss"
    )
    estimated_loss_expected = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Expected loss"
    )

    class Meta:
        verbose_name = "Risk Scenario"
        verbose_name_plural = "Risk Scenarios"
        ordering = ['-created_at']

    @property
    def inherent_risk_score(self) -> int:
        """Calculate inherent risk score."""
        return self.inherent_probability * self.inherent_impact

    @property
    def residual_risk_score(self) -> int:
        """Calculate residual risk score."""
        return self.residual_probability * self.residual_impact


class RiskAssessment(AbstractGRCEntity):
    """
    A formal risk assessment activity.

    Risk assessments document the evaluation of risks at a point in time.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='risk_assessments'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='risk_assessments'
    )
    risk_matrix = models.ForeignKey(
        RiskMatrix,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Assessment metadata
    assessment_date = models.DateField(
        help_text="Date the assessment was performed"
    )
    next_assessment_date = models.DateField(
        null=True,
        blank=True
    )

    # Assessment scope
    scope_description = models.TextField(
        blank=True,
        default="",
        help_text="Description of assessment scope"
    )

    # Assessor
    assessor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_risk_assessments'
    )

    # Status
    class AssessmentStatus(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        APPROVED = 'approved', 'Approved'

    status = models.CharField(
        max_length=20,
        choices=AssessmentStatus.choices,
        default=AssessmentStatus.PLANNED
    )

    # Risk scenarios assessed
    risk_scenarios = models.ManyToManyField(
        RiskScenario,
        blank=True,
        related_name='assessments'
    )

    # Summary findings
    summary = models.TextField(
        blank=True,
        default=""
    )
    recommendations = models.TextField(
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Risk Assessment"
        verbose_name_plural = "Risk Assessments"
        ordering = ['-assessment_date']


class RiskTreatment(AbstractGRCEntity):
    """
    A risk treatment plan or action.

    Risk treatments document specific actions to address identified risks.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='risk_treatments'
    )
    risk_scenario = models.ForeignKey(
        RiskScenario,
        on_delete=models.CASCADE,
        related_name='treatments'
    )

    # Treatment details
    treatment_type = models.CharField(
        max_length=20,
        choices=RiskScenario.TreatmentStrategy.choices,
        default=RiskScenario.TreatmentStrategy.MITIGATE
    )
    action_plan = models.TextField(
        help_text="Description of treatment actions"
    )

    # Ownership and timeline
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_risk_treatments'
    )
    start_date = models.DateField(
        null=True,
        blank=True
    )
    due_date = models.DateField(
        null=True,
        blank=True
    )
    completion_date = models.DateField(
        null=True,
        blank=True
    )

    # Status
    class TreatmentStatus(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'
        ON_HOLD = 'on_hold', 'On Hold'

    status = models.CharField(
        max_length=20,
        choices=TreatmentStatus.choices,
        default=TreatmentStatus.PLANNED
    )

    # Cost
    estimated_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    actual_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Effectiveness tracking
    expected_risk_reduction = models.PositiveSmallIntegerField(
        default=0,
        validators=[MaxValueValidator(100)],
        help_text="Expected risk reduction percentage"
    )
    actual_risk_reduction = models.PositiveSmallIntegerField(
        default=0,
        validators=[MaxValueValidator(100)],
        help_text="Actual risk reduction percentage"
    )

    class Meta:
        verbose_name = "Risk Treatment"
        verbose_name_plural = "Risk Treatments"
        ordering = ['-created_at']
