"""
Campaign Models - MIT Licensed

Clean-room implementation of assessment campaigns for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.conf import settings
from ..base_models_mit import AbstractGRCEntity
from .organization import Organization, Domain
from .governance import Framework


class Campaign(AbstractGRCEntity):
    """
    An assessment campaign.

    Campaigns organize and track compliance or risk assessment
    activities across time periods. They group related assessments
    and provide reporting over the campaign lifecycle.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='campaigns'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='campaigns'
    )

    # Campaign type
    class CampaignType(models.TextChoices):
        COMPLIANCE = 'compliance', 'Compliance Assessment'
        RISK = 'risk', 'Risk Assessment'
        AUDIT = 'audit', 'Audit'
        CONTROL_TESTING = 'control_testing', 'Control Testing'
        VENDOR_ASSESSMENT = 'vendor_assessment', 'Vendor Assessment'
        SELF_ASSESSMENT = 'self_assessment', 'Self-Assessment'
        CERTIFICATION = 'certification', 'Certification'
        OTHER = 'other', 'Other'

    campaign_type = models.CharField(
        max_length=25,
        choices=CampaignType.choices,
        default=CampaignType.COMPLIANCE
    )

    # Scope
    frameworks = models.ManyToManyField(
        Framework,
        blank=True,
        related_name='campaigns',
        help_text="Frameworks covered by this campaign"
    )
    scope_description = models.TextField(
        blank=True,
        default="",
        help_text="Description of campaign scope"
    )
    objectives = models.TextField(
        blank=True,
        default="",
        help_text="Campaign objectives"
    )

    # Status
    class CampaignStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PLANNED = 'planned', 'Planned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        UNDER_REVIEW = 'under_review', 'Under Review'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    status = models.CharField(
        max_length=20,
        choices=CampaignStatus.choices,
        default=CampaignStatus.DRAFT
    )

    # Dates
    planned_start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Planned start date"
    )
    planned_end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Planned end date"
    )
    actual_start_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual start date"
    )
    actual_end_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual end date"
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_campaigns',
        help_text="Campaign owner"
    )
    team_members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='campaign_memberships',
        help_text="Team members participating in the campaign"
    )

    # Progress tracking
    total_items = models.PositiveIntegerField(
        default=0,
        help_text="Total items to assess"
    )
    completed_items = models.PositiveIntegerField(
        default=0,
        help_text="Completed assessment items"
    )

    # Results
    summary = models.TextField(
        blank=True,
        default="",
        help_text="Executive summary"
    )
    findings_summary = models.TextField(
        blank=True,
        default="",
        help_text="Summary of findings"
    )
    recommendations = models.TextField(
        blank=True,
        default="",
        help_text="Recommendations"
    )

    # Scoring
    overall_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Overall campaign score (0-100)"
    )

    # Recurrence
    is_recurring = models.BooleanField(
        default=False,
        help_text="Whether this is a recurring campaign"
    )
    recurrence_pattern = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Recurrence pattern (e.g., 'annually', 'quarterly')"
    )
    parent_campaign = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_campaigns',
        help_text="Parent campaign for recurring assessments"
    )

    class Meta:
        verbose_name = "Campaign"
        verbose_name_plural = "Campaigns"
        ordering = ['-planned_start_date', '-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    @property
    def progress_percentage(self):
        """Calculate completion percentage."""
        if self.total_items == 0:
            return 0
        return round((self.completed_items / self.total_items) * 100, 1)

    @property
    def is_overdue(self):
        """Check if the campaign is overdue."""
        from django.utils import timezone
        if self.planned_end_date and self.status not in ['completed', 'cancelled']:
            return timezone.now().date() > self.planned_end_date
        return False
