"""
Continuous Monitoring Models

Defines models for configuring and tracking continuous monitoring activities.
These models integrate with the ConMon Schedule framework library and support
framework-agnostic monitoring configurations.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from core.base_models import AbstractBaseModel, NameDescriptionMixin
from iam.models import FolderMixin
import uuid


class ConMonProfile(NameDescriptionMixin, AbstractBaseModel, FolderMixin):
    """
    A Continuous Monitoring Profile defines which ConMon activities are enabled
    for a specific system, project, or organization.

    Profiles can be based on compliance frameworks (FedRAMP, ISO 27001, etc.)
    or custom configurations. Each profile references a base framework and
    can enable/disable specific activities.
    """

    class ProfileType(models.TextChoices):
        FEDRAMP_LOW = 'fedramp_low', 'FedRAMP Low'
        FEDRAMP_MODERATE = 'fedramp_moderate', 'FedRAMP Moderate'
        FEDRAMP_HIGH = 'fedramp_high', 'FedRAMP High'
        ISO_27001 = 'iso_27001', 'ISO 27001'
        SOC_2 = 'soc_2', 'SOC 2'
        NIST_CSF = 'nist_csf', 'NIST CSF'
        CMMC_L1 = 'cmmc_l1', 'CMMC Level 1'
        CMMC_L2 = 'cmmc_l2', 'CMMC Level 2'
        CMMC_L3 = 'cmmc_l3', 'CMMC Level 3'
        CUSTOM = 'custom', 'Custom'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        ARCHIVED = 'archived', 'Archived'

    profile_type = models.CharField(
        max_length=50,
        choices=ProfileType.choices,
        default=ProfileType.CUSTOM,
        verbose_name=_('Profile Type')
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name=_('Status')
    )

    # Link to a compliance framework for automatic activity mapping
    base_framework = models.ForeignKey(
        'core.Framework',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conmon_profiles',
        verbose_name=_('Base Framework'),
        help_text=_('Framework to use as basis for ConMon activities')
    )

    # Link to a compliance assessment for tracking
    compliance_assessment = models.ForeignKey(
        'core.ComplianceAssessment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conmon_profiles',
        verbose_name=_('Compliance Assessment')
    )

    # Implementation group filter (e.g., L/M/H for FedRAMP, BASIC/STANDARD/ENHANCED for generic)
    implementation_groups = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Implementation Groups'),
        help_text=_('List of implementation group ref_ids to include')
    )

    # Notification settings
    notification_lead_days = models.IntegerField(
        default=7,
        validators=[MinValueValidator(0)],
        verbose_name=_('Notification Lead Days'),
        help_text=_('Days before due date to send reminders')
    )
    notification_enabled = models.BooleanField(
        default=True,
        verbose_name=_('Notifications Enabled')
    )

    # Assigned team
    assigned_actors = models.ManyToManyField(
        'core.Actor',
        blank=True,
        related_name='conmon_profiles',
        verbose_name=_('Assigned Actors')
    )

    class Meta:
        verbose_name = _('ConMon Profile')
        verbose_name_plural = _('ConMon Profiles')

    def __str__(self):
        return f"{self.name} ({self.get_profile_type_display()})"


class ConMonActivityConfig(AbstractBaseModel, FolderMixin):
    """
    Configuration for a specific ConMon activity within a profile.

    Allows enabling/disabling individual activities and customizing their
    schedules, assignments, and evidence collection rules.
    """

    class FrequencyOverride(models.TextChoices):
        INHERIT = 'inherit', 'Use Default'
        CONTINUOUS = 'continuous', 'Continuous'
        DAILY = 'daily', 'Daily'
        WEEKLY = 'weekly', 'Weekly'
        BIWEEKLY = 'biweekly', 'Every 2 Weeks'
        MONTHLY = 'monthly', 'Monthly'
        QUARTERLY = 'quarterly', 'Quarterly'
        SEMI_ANNUAL = 'semi_annual', 'Semi-Annual'
        ANNUAL = 'annual', 'Annual'
        BIENNIAL = 'biennial', 'Every 2 Years'
        TRIENNIAL = 'triennial', 'Every 3 Years'
        EVENT_DRIVEN = 'event_driven', 'Event-Driven'

    profile = models.ForeignKey(
        ConMonProfile,
        on_delete=models.CASCADE,
        related_name='activity_configs',
        verbose_name=_('Profile')
    )

    # Reference to the requirement node URN from the ConMon Schedule framework
    requirement_urn = models.CharField(
        max_length=500,
        verbose_name=_('Requirement URN'),
        help_text=_('URN of the ConMon schedule requirement')
    )

    # Reference ID for display (e.g., CONT-01, MONTHLY-SCAN-01)
    ref_id = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Reference ID')
    )

    # Activity name (cached from framework for display)
    name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_('Activity Name')
    )

    # Enable/disable this activity
    enabled = models.BooleanField(
        default=True,
        verbose_name=_('Enabled')
    )

    # Schedule customization
    frequency_override = models.CharField(
        max_length=20,
        choices=FrequencyOverride.choices,
        default=FrequencyOverride.INHERIT,
        verbose_name=_('Frequency Override')
    )
    custom_schedule = models.JSONField(
        null=True,
        blank=True,
        verbose_name=_('Custom Schedule'),
        help_text=_('Custom schedule JSON matching TaskTemplate schedule format')
    )

    # Assignment override
    assigned_actors = models.ManyToManyField(
        'core.Actor',
        blank=True,
        related_name='conmon_activity_configs',
        verbose_name=_('Assigned Actors'),
        help_text=_('Override profile-level assignment for this activity')
    )

    # Link to evidence collection rules
    evidence_rules = models.ManyToManyField(
        'evidence_automation.EvidenceCollectionRule',
        blank=True,
        related_name='conmon_activities',
        verbose_name=_('Evidence Collection Rules')
    )

    # Link to applied controls
    applied_controls = models.ManyToManyField(
        'core.AppliedControl',
        blank=True,
        related_name='conmon_activities',
        verbose_name=_('Applied Controls')
    )

    # Link to generated task template
    task_template = models.ForeignKey(
        'core.TaskTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conmon_activity_config',
        verbose_name=_('Task Template')
    )

    # Notes for customization rationale
    notes = models.TextField(
        blank=True,
        verbose_name=_('Notes')
    )

    class Meta:
        verbose_name = _('ConMon Activity Configuration')
        verbose_name_plural = _('ConMon Activity Configurations')
        unique_together = [['profile', 'requirement_urn']]

    def __str__(self):
        status = 'enabled' if self.enabled else 'disabled'
        return f"{self.ref_id or self.requirement_urn} ({status})"


class ConMonExecution(AbstractBaseModel, FolderMixin):
    """
    Tracks execution/completion of a ConMon activity for a specific period.

    Each execution represents one instance of completing a ConMon activity
    (e.g., "January 2025 Monthly Vulnerability Scan").
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        COMPLETED_LATE = 'completed_late', 'Completed Late'
        MISSED = 'missed', 'Missed'
        NOT_APPLICABLE = 'not_applicable', 'Not Applicable'

    class CompletionResult(models.TextChoices):
        PASS = 'pass', 'Pass'
        FAIL = 'fail', 'Fail'
        PARTIAL = 'partial', 'Partial'
        NOT_ASSESSED = 'not_assessed', 'Not Assessed'

    activity_config = models.ForeignKey(
        ConMonActivityConfig,
        on_delete=models.CASCADE,
        related_name='executions',
        verbose_name=_('Activity Configuration')
    )

    # Period identification
    period_start = models.DateField(
        verbose_name=_('Period Start')
    )
    period_end = models.DateField(
        verbose_name=_('Period End')
    )
    due_date = models.DateField(
        verbose_name=_('Due Date')
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name=_('Status')
    )
    result = models.CharField(
        max_length=20,
        choices=CompletionResult.choices,
        default=CompletionResult.NOT_ASSESSED,
        verbose_name=_('Result')
    )

    # Execution details
    completed_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('Completed Date')
    )
    completed_by = models.ForeignKey(
        'iam.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conmon_executions',
        verbose_name=_('Completed By')
    )

    # Link to task node for this execution
    task_node = models.ForeignKey(
        'core.TaskNode',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conmon_executions',
        verbose_name=_('Task Node')
    )

    # Evidence and findings
    evidences = models.ManyToManyField(
        'core.Evidence',
        blank=True,
        related_name='conmon_executions',
        verbose_name=_('Evidences')
    )
    findings = models.TextField(
        blank=True,
        verbose_name=_('Findings')
    )
    observations = models.TextField(
        blank=True,
        verbose_name=_('Observations')
    )

    class Meta:
        verbose_name = _('ConMon Execution')
        verbose_name_plural = _('ConMon Executions')
        ordering = ['-period_start', '-due_date']

    def __str__(self):
        return f"{self.activity_config.ref_id} - {self.period_start} ({self.get_status_display()})"

    @property
    def is_overdue(self):
        """Check if execution is overdue."""
        from django.utils import timezone
        if self.status in [self.Status.COMPLETED, self.Status.COMPLETED_LATE,
                          self.Status.MISSED, self.Status.NOT_APPLICABLE]:
            return False
        return timezone.localdate() > self.due_date


class ConMonMetric(AbstractBaseModel, FolderMixin):
    """
    Tracks ConMon metrics and KPIs over time.

    Captures health indicators like completion rates, on-time completion,
    evidence freshness, and remediation timelines.
    """

    class MetricType(models.TextChoices):
        COMPLETION_RATE = 'completion_rate', 'Activity Completion Rate'
        ON_TIME_RATE = 'on_time_rate', 'On-Time Completion Rate'
        EVIDENCE_FRESHNESS = 'evidence_freshness', 'Evidence Freshness'
        VULN_REMEDIATION_TIME = 'vuln_remediation_time', 'Vulnerability Remediation Time'
        POAM_AGING = 'poam_aging', 'POA&M Aging'
        SCAN_COMPLIANCE = 'scan_compliance', 'Scan Compliance'
        CONTROL_EFFECTIVENESS = 'control_effectiveness', 'Control Effectiveness'
        INCIDENT_RESPONSE_TIME = 'incident_response_time', 'Incident Response Time'

    class Trend(models.TextChoices):
        UP = 'up', 'Improving'
        DOWN = 'down', 'Declining'
        STABLE = 'stable', 'Stable'

    profile = models.ForeignKey(
        ConMonProfile,
        on_delete=models.CASCADE,
        related_name='metrics',
        verbose_name=_('Profile')
    )

    metric_type = models.CharField(
        max_length=50,
        choices=MetricType.choices,
        verbose_name=_('Metric Type')
    )

    # Measurement period
    period_start = models.DateField(
        verbose_name=_('Period Start')
    )
    period_end = models.DateField(
        verbose_name=_('Period End')
    )

    # Values
    value = models.FloatField(
        verbose_name=_('Value')
    )
    target = models.FloatField(
        null=True,
        blank=True,
        verbose_name=_('Target')
    )
    unit = models.CharField(
        max_length=20,
        default='%',
        verbose_name=_('Unit')
    )

    # Status indicators
    trend = models.CharField(
        max_length=10,
        choices=Trend.choices,
        default=Trend.STABLE,
        verbose_name=_('Trend')
    )
    trend_value = models.FloatField(
        default=0,
        verbose_name=_('Trend Value'),
        help_text=_('Change from previous period')
    )

    # Breakdown data (for detailed analysis)
    breakdown = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Breakdown'),
        help_text=_('Detailed breakdown of metric components')
    )

    class Meta:
        verbose_name = _('ConMon Metric')
        verbose_name_plural = _('ConMon Metrics')
        ordering = ['-period_end', 'metric_type']

    def __str__(self):
        return f"{self.get_metric_type_display()} - {self.period_end}: {self.value}{self.unit}"

    @property
    def status(self):
        """Calculate status based on value vs target."""
        if self.target is None:
            return 'unknown'
        if self.value >= self.target:
            return 'good'
        elif self.value >= self.target * 0.8:
            return 'warning'
        else:
            return 'critical'
