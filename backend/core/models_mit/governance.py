"""
Governance Models - MIT Licensed

Clean-room implementation of governance entities for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.conf import settings
from ..base_models_mit import (
    AbstractGRCEntity,
    PublishableModel,
    VersionedMixin,
    OrderedModel,
)
from .organization import Organization, Domain


class Framework(AbstractGRCEntity, PublishableModel, VersionedMixin):
    """
    A compliance or security framework.

    Frameworks define a structured set of requirements, controls,
    or guidelines. Examples: ISO 27001, NIST CSF, SOC 2.
    """
    # Framework metadata
    provider = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Organization that published the framework"
    )
    framework_version = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Version of the framework (e.g., '2022', 'v2.0')"
    )
    effective_date = models.DateField(
        null=True,
        blank=True,
        help_text="When this framework version became effective"
    )
    sunset_date = models.DateField(
        null=True,
        blank=True,
        help_text="When this framework version will be deprecated"
    )

    # Classification
    class FrameworkCategory(models.TextChoices):
        SECURITY = 'security', 'Security'
        PRIVACY = 'privacy', 'Privacy'
        COMPLIANCE = 'compliance', 'Compliance'
        RISK = 'risk', 'Risk Management'
        GOVERNANCE = 'governance', 'Governance'
        INDUSTRY = 'industry', 'Industry Specific'

    category = models.CharField(
        max_length=20,
        choices=FrameworkCategory.choices,
        default=FrameworkCategory.SECURITY
    )

    # Geographic scope
    jurisdiction = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Geographic jurisdiction (e.g., 'US', 'EU', 'Global')"
    )

    # Framework content
    library_content = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured framework content (controls, requirements)"
    )

    # Source information
    source_url = models.URLField(
        blank=True,
        default="",
        help_text="URL to official framework documentation"
    )

    class Meta:
        verbose_name = "Framework"
        verbose_name_plural = "Frameworks"
        ordering = ['name']

    def get_controls(self):
        """Get all controls in this framework."""
        return self.controls.all()

    def get_control_count(self):
        """Get count of controls in this framework."""
        return self.controls.count()


class ControlFamily(AbstractGRCEntity, OrderedModel):
    """
    A grouping of related controls within a framework.

    Control families organize controls into logical categories.
    Example: Access Control (AC), Audit (AU) in NIST 800-53.
    """
    framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='control_families'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )

    # Identifiers
    family_id = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Family identifier (e.g., 'AC', 'AU')"
    )

    class Meta:
        verbose_name = "Control Family"
        verbose_name_plural = "Control Families"
        ordering = ['order', 'family_id']
        unique_together = [['framework', 'family_id']]


class Control(AbstractGRCEntity, OrderedModel):
    """
    A security or compliance control.

    Controls are specific measures or safeguards that address
    risks or meet compliance requirements.
    """
    framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='controls'
    )
    family = models.ForeignKey(
        ControlFamily,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='controls'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='enhancements',
        help_text="Parent control for control enhancements"
    )

    # Control identifiers
    control_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Control identifier (e.g., 'AC-2', 'A.5.1.1')"
    )

    # Control classification
    class ControlCategory(models.TextChoices):
        TECHNICAL = 'technical', 'Technical'
        OPERATIONAL = 'operational', 'Operational'
        MANAGEMENT = 'management', 'Management'

    category = models.CharField(
        max_length=20,
        choices=ControlCategory.choices,
        default=ControlCategory.TECHNICAL
    )

    # Control details
    objective = models.TextField(
        blank=True,
        default="",
        help_text="Control objective"
    )
    guidance = models.TextField(
        blank=True,
        default="",
        help_text="Implementation guidance"
    )
    assessment_guidance = models.TextField(
        blank=True,
        default="",
        help_text="Guidance for assessing the control"
    )

    # Parameters
    parameters = models.JSONField(
        default=list,
        blank=True,
        help_text="Control parameters that need organization-specific values"
    )

    # Baselines (for frameworks like NIST 800-53)
    baseline_impact = models.JSONField(
        default=list,
        blank=True,
        help_text="Baseline impact levels (low, moderate, high)"
    )

    # Relationships
    related_controls = models.ManyToManyField(
        'self',
        blank=True,
        symmetrical=True,
        help_text="Related controls"
    )

    class Meta:
        verbose_name = "Control"
        verbose_name_plural = "Controls"
        ordering = ['order', 'control_id']
        unique_together = [['framework', 'control_id']]

    def __str__(self):
        return f"{self.control_id}: {self.name}"


class Policy(AbstractGRCEntity, PublishableModel, VersionedMixin):
    """
    An organizational policy document.

    Policies define organizational rules, standards, and guidelines.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='policies'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='policies'
    )

    # Policy classification
    class PolicyType(models.TextChoices):
        POLICY = 'policy', 'Policy'
        STANDARD = 'standard', 'Standard'
        GUIDELINE = 'guideline', 'Guideline'
        PROCEDURE = 'procedure', 'Procedure'

    policy_type = models.CharField(
        max_length=20,
        choices=PolicyType.choices,
        default=PolicyType.POLICY
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_policies'
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_policies'
    )

    # Content
    content = models.TextField(
        blank=True,
        default="",
        help_text="Policy content in markdown format"
    )

    # Dates
    effective_date = models.DateField(
        null=True,
        blank=True
    )
    review_date = models.DateField(
        null=True,
        blank=True,
        help_text="Next review date"
    )
    expiration_date = models.DateField(
        null=True,
        blank=True
    )

    # Related controls
    controls = models.ManyToManyField(
        Control,
        blank=True,
        related_name='policies',
        help_text="Controls this policy helps implement"
    )

    # Attachments stored as JSON references
    attachments = models.JSONField(
        default=list,
        blank=True
    )

    class Meta:
        verbose_name = "Policy"
        verbose_name_plural = "Policies"
        ordering = ['-created_at']


class Procedure(AbstractGRCEntity, PublishableModel, VersionedMixin):
    """
    A documented procedure or process.

    Procedures describe step-by-step instructions for
    implementing controls or policies.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='procedures'
    )
    policy = models.ForeignKey(
        Policy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='procedures',
        help_text="Parent policy this procedure supports"
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='procedures'
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_procedures'
    )

    # Content
    content = models.TextField(
        blank=True,
        default=""
    )
    steps = models.JSONField(
        default=list,
        blank=True,
        help_text="Structured procedure steps"
    )

    # Timing
    frequency = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="How often this procedure should be performed"
    )
    estimated_duration = models.DurationField(
        null=True,
        blank=True,
        help_text="Estimated time to complete"
    )

    # Related controls
    controls = models.ManyToManyField(
        Control,
        blank=True,
        related_name='procedures'
    )

    class Meta:
        verbose_name = "Procedure"
        verbose_name_plural = "Procedures"
        ordering = ['-created_at']


class AppliedControl(AbstractGRCEntity):
    """
    An implementation of a control within an organization.

    Applied controls represent how an organization has implemented
    a specific control from a framework.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='applied_controls'
    )
    control = models.ForeignKey(
        Control,
        on_delete=models.CASCADE,
        related_name='implementations'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='applied_controls'
    )

    # Implementation status
    class ImplementationStatus(models.TextChoices):
        NOT_STARTED = 'not_started', 'Not Started'
        IN_PROGRESS = 'in_progress', 'In Progress'
        IMPLEMENTED = 'implemented', 'Implemented'
        PARTIALLY_IMPLEMENTED = 'partially_implemented', 'Partially Implemented'
        NOT_APPLICABLE = 'not_applicable', 'Not Applicable'
        PLANNED = 'planned', 'Planned'

    implementation_status = models.CharField(
        max_length=30,
        choices=ImplementationStatus.choices,
        default=ImplementationStatus.NOT_STARTED
    )

    # Implementation details
    implementation_description = models.TextField(
        blank=True,
        default="",
        help_text="Description of how the control is implemented"
    )
    implementation_evidence = models.TextField(
        blank=True,
        default="",
        help_text="Evidence of implementation"
    )

    # Effectiveness
    class EffectivenessRating(models.TextChoices):
        NOT_ASSESSED = 'not_assessed', 'Not Assessed'
        INEFFECTIVE = 'ineffective', 'Ineffective'
        PARTIALLY_EFFECTIVE = 'partially_effective', 'Partially Effective'
        LARGELY_EFFECTIVE = 'largely_effective', 'Largely Effective'
        FULLY_EFFECTIVE = 'fully_effective', 'Fully Effective'

    effectiveness = models.CharField(
        max_length=25,
        choices=EffectivenessRating.choices,
        default=EffectivenessRating.NOT_ASSESSED
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_applied_controls'
    )

    # Dates
    implementation_date = models.DateField(
        null=True,
        blank=True
    )
    last_assessment_date = models.DateField(
        null=True,
        blank=True
    )
    next_assessment_date = models.DateField(
        null=True,
        blank=True
    )

    # Parameter values
    parameter_values = models.JSONField(
        default=dict,
        blank=True,
        help_text="Organization-specific parameter values"
    )

    # Cost and effort
    implementation_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    annual_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Related entities
    policies = models.ManyToManyField(
        Policy,
        blank=True,
        related_name='applied_controls'
    )
    procedures = models.ManyToManyField(
        Procedure,
        blank=True,
        related_name='applied_controls'
    )

    class Meta:
        verbose_name = "Applied Control"
        verbose_name_plural = "Applied Controls"
        ordering = ['-created_at']
        unique_together = [['organization', 'control']]

    def __str__(self):
        return f"{self.organization.name}: {self.control.control_id}"
