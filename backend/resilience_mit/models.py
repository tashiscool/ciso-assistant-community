"""
Resilience Management Models - MIT Licensed

Clean-room implementation of business continuity and resilience management.
Copyright (c) 2026 Tash
"""

import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class BusinessImpactAnalysis(models.Model):
    """
    Business Impact Analysis (BIA).

    Assesses the potential impact of disruptions to critical
    business processes and identifies recovery priorities.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the business process/function"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of the business process"
    )

    # Process details
    process_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_bias',
        help_text="Process owner"
    )
    department = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Department/business unit"
    )

    # Criticality assessment
    class CriticalityLevel(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'
        NON_ESSENTIAL = 'non_essential', 'Non-Essential'

    criticality = models.CharField(
        max_length=15,
        choices=CriticalityLevel.choices,
        default=CriticalityLevel.MEDIUM,
        help_text="Business criticality level"
    )

    # Recovery Time Objective (RTO)
    rto_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Recovery Time Objective in hours"
    )
    rto_justification = models.TextField(
        blank=True,
        default="",
        help_text="Justification for RTO"
    )

    # Recovery Point Objective (RPO)
    rpo_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Recovery Point Objective in hours"
    )
    rpo_justification = models.TextField(
        blank=True,
        default="",
        help_text="Justification for RPO"
    )

    # Maximum Tolerable Downtime (MTD)
    mtd_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum Tolerable Downtime in hours"
    )

    # Minimum Business Continuity Objective (MBCO)
    mbco_percentage = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MaxValueValidator(100)],
        help_text="Minimum operational capacity percentage"
    )

    # Impact assessment - Financial
    financial_impact_day = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Financial impact per day of disruption"
    )
    financial_impact_week = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Financial impact per week of disruption"
    )
    financial_notes = models.TextField(
        blank=True,
        default=""
    )

    # Impact assessment - Operational
    class ImpactRating(models.TextChoices):
        NONE = 'none', 'None'
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        SEVERE = 'severe', 'Severe'

    operational_impact = models.CharField(
        max_length=10,
        choices=ImpactRating.choices,
        default=ImpactRating.MEDIUM,
        help_text="Operational impact rating"
    )
    operational_impact_notes = models.TextField(
        blank=True,
        default=""
    )

    # Impact assessment - Reputational
    reputational_impact = models.CharField(
        max_length=10,
        choices=ImpactRating.choices,
        default=ImpactRating.MEDIUM,
        help_text="Reputational impact rating"
    )
    reputational_impact_notes = models.TextField(
        blank=True,
        default=""
    )

    # Impact assessment - Legal/Compliance
    legal_impact = models.CharField(
        max_length=10,
        choices=ImpactRating.choices,
        default=ImpactRating.MEDIUM,
        help_text="Legal/compliance impact rating"
    )
    legal_impact_notes = models.TextField(
        blank=True,
        default=""
    )

    # Impact assessment - Health & Safety
    safety_impact = models.CharField(
        max_length=10,
        choices=ImpactRating.choices,
        default=ImpactRating.NONE,
        help_text="Health & safety impact rating"
    )
    safety_impact_notes = models.TextField(
        blank=True,
        default=""
    )

    # Dependencies
    upstream_dependencies = models.TextField(
        blank=True,
        default="",
        help_text="Processes/systems this depends on"
    )
    downstream_dependencies = models.TextField(
        blank=True,
        default="",
        help_text="Processes/systems that depend on this"
    )
    key_personnel = models.TextField(
        blank=True,
        default="",
        help_text="Key personnel required for this process"
    )
    minimum_staff = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Minimum staff required to operate"
    )

    # Recovery strategy
    recovery_strategy = models.TextField(
        blank=True,
        default="",
        help_text="Recovery strategy description"
    )
    alternative_procedures = models.TextField(
        blank=True,
        default="",
        help_text="Manual or alternative procedures"
    )

    # Peak periods
    peak_periods = models.TextField(
        blank=True,
        default="",
        help_text="Peak business periods (e.g., 'Month end', 'Q4')"
    )

    # Status
    class BIAStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        UNDER_REVIEW = 'under_review', 'Under Review'
        APPROVED = 'approved', 'Approved'
        REQUIRES_UPDATE = 'requires_update', 'Requires Update'
        ARCHIVED = 'archived', 'Archived'

    status = models.CharField(
        max_length=20,
        choices=BIAStatus.choices,
        default=BIAStatus.DRAFT
    )

    # Review dates
    assessment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of this assessment"
    )
    next_review_date = models.DateField(
        null=True,
        blank=True,
        help_text="Next scheduled review"
    )
    last_test_date = models.DateField(
        null=True,
        blank=True,
        help_text="Last continuity test date"
    )

    # Approvals
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_bias'
    )
    approval_date = models.DateField(
        null=True,
        blank=True
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Business Impact Analysis"
        verbose_name_plural = "Business Impact Analyses"
        ordering = ['criticality', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_criticality_display()})"

    @property
    def overall_impact_score(self):
        """Calculate overall impact score (1-5)."""
        impact_map = {
            'none': 1,
            'low': 2,
            'medium': 3,
            'high': 4,
            'severe': 5,
        }
        scores = [
            impact_map.get(self.operational_impact, 3),
            impact_map.get(self.reputational_impact, 3),
            impact_map.get(self.legal_impact, 3),
            impact_map.get(self.safety_impact, 1),
        ]
        return round(sum(scores) / len(scores), 1)


class AssetAssessment(models.Model):
    """
    Asset criticality assessment within a BIA.

    Evaluates the criticality of specific assets
    (systems, applications, data) to business processes.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Link to BIA
    bia = models.ForeignKey(
        BusinessImpactAnalysis,
        on_delete=models.CASCADE,
        related_name='asset_assessments',
        help_text="Related Business Impact Analysis"
    )

    # Asset identification
    asset_name = models.CharField(
        max_length=255,
        help_text="Name of the asset"
    )
    asset_type = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Type of asset (Application, Server, Database, etc.)"
    )
    description = models.TextField(
        blank=True,
        default=""
    )

    # Criticality for this process
    class Criticality(models.TextChoices):
        ESSENTIAL = 'essential', 'Essential - Process cannot function'
        IMPORTANT = 'important', 'Important - Degraded operation'
        SUPPORTING = 'supporting', 'Supporting - Minor impact'
        OPTIONAL = 'optional', 'Optional - No impact'

    criticality = models.CharField(
        max_length=15,
        choices=Criticality.choices,
        default=Criticality.SUPPORTING
    )

    # Recovery requirements
    rto_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Asset-specific RTO in hours"
    )
    rpo_hours = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Asset-specific RPO in hours"
    )

    # Dependencies
    depends_on = models.TextField(
        blank=True,
        default="",
        help_text="Other assets this depends on"
    )

    # Recovery capability
    has_backup = models.BooleanField(
        default=False,
        help_text="Whether backup exists"
    )
    backup_frequency = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Backup frequency"
    )
    has_redundancy = models.BooleanField(
        default=False,
        help_text="Whether redundancy exists"
    )
    redundancy_notes = models.TextField(
        blank=True,
        default=""
    )
    has_dr_capability = models.BooleanField(
        default=False,
        help_text="Whether DR capability exists"
    )
    dr_location = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )

    # Impact if unavailable
    impact_description = models.TextField(
        blank=True,
        default="",
        help_text="Impact if this asset is unavailable"
    )

    # Notes
    notes = models.TextField(
        blank=True,
        default=""
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Asset Assessment"
        verbose_name_plural = "Asset Assessments"
        ordering = ['criticality', 'asset_name']

    def __str__(self):
        return f"{self.asset_name} - {self.bia.name}"


class EscalationThreshold(models.Model):
    """
    Escalation threshold for incidents and disruptions.

    Defines triggers and thresholds for escalating
    incidents to higher management levels.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Threshold name"
    )
    description = models.TextField(
        blank=True,
        default=""
    )

    # Threshold type
    class ThresholdType(models.TextChoices):
        TIME = 'time', 'Time-Based'
        IMPACT = 'impact', 'Impact-Based'
        SCOPE = 'scope', 'Scope-Based'
        COMBINATION = 'combination', 'Combination'

    threshold_type = models.CharField(
        max_length=15,
        choices=ThresholdType.choices,
        default=ThresholdType.TIME
    )

    # Time-based thresholds
    time_threshold_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Time threshold in minutes"
    )

    # Impact-based thresholds
    class ImpactLevel(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    impact_threshold = models.CharField(
        max_length=10,
        choices=ImpactLevel.choices,
        null=True,
        blank=True
    )

    # Scope thresholds
    affected_users_threshold = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Number of affected users to trigger"
    )
    affected_systems_threshold = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Number of affected systems to trigger"
    )

    # Escalation level
    class EscalationLevel(models.TextChoices):
        LEVEL_1 = 'level_1', 'Level 1 - Team Lead'
        LEVEL_2 = 'level_2', 'Level 2 - Manager'
        LEVEL_3 = 'level_3', 'Level 3 - Director'
        LEVEL_4 = 'level_4', 'Level 4 - Executive'
        LEVEL_5 = 'level_5', 'Level 5 - CEO/Board'

    escalation_level = models.CharField(
        max_length=10,
        choices=EscalationLevel.choices,
        default=EscalationLevel.LEVEL_1
    )

    # Escalation contacts
    primary_contact = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='primary_escalation_thresholds'
    )
    secondary_contact = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='secondary_escalation_thresholds'
    )
    contact_group = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Distribution list or group to notify"
    )

    # Notification settings
    notification_method = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Notification methods (email, phone, SMS)"
    )
    notification_template = models.TextField(
        blank=True,
        default="",
        help_text="Notification message template"
    )

    # Actions required
    required_actions = models.TextField(
        blank=True,
        default="",
        help_text="Actions required when threshold is reached"
    )

    # Priority order
    priority = models.PositiveSmallIntegerField(
        default=0,
        help_text="Priority for evaluation order"
    )

    # Status
    is_active = models.BooleanField(
        default=True
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Escalation Threshold"
        verbose_name_plural = "Escalation Thresholds"
        ordering = ['priority', 'escalation_level']

    def __str__(self):
        return f"{self.name} ({self.get_escalation_level_display()})"

    def check_threshold(self, elapsed_minutes=None, impact=None,
                        affected_users=None, affected_systems=None):
        """
        Check if this threshold has been reached.

        Returns True if any applicable threshold condition is met.
        """
        if self.threshold_type == 'time' and elapsed_minutes is not None:
            if self.time_threshold_minutes and elapsed_minutes >= self.time_threshold_minutes:
                return True

        if self.threshold_type == 'impact' and impact is not None:
            impact_order = ['low', 'medium', 'high', 'critical']
            if self.impact_threshold:
                threshold_idx = impact_order.index(self.impact_threshold)
                current_idx = impact_order.index(impact) if impact in impact_order else -1
                if current_idx >= threshold_idx:
                    return True

        if self.threshold_type == 'scope':
            if self.affected_users_threshold and affected_users is not None:
                if affected_users >= self.affected_users_threshold:
                    return True
            if self.affected_systems_threshold and affected_systems is not None:
                if affected_systems >= self.affected_systems_threshold:
                    return True

        if self.threshold_type == 'combination':
            # For combination, require all specified conditions to be met
            conditions_met = []
            if self.time_threshold_minutes and elapsed_minutes is not None:
                conditions_met.append(elapsed_minutes >= self.time_threshold_minutes)
            if self.impact_threshold and impact is not None:
                impact_order = ['low', 'medium', 'high', 'critical']
                threshold_idx = impact_order.index(self.impact_threshold)
                current_idx = impact_order.index(impact) if impact in impact_order else -1
                conditions_met.append(current_idx >= threshold_idx)
            if self.affected_users_threshold and affected_users is not None:
                conditions_met.append(affected_users >= self.affected_users_threshold)

            if conditions_met and all(conditions_met):
                return True

        return False
