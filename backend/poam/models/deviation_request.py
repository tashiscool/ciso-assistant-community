"""
Deviation Request Model for POA&M Items

Tracks false positives, vendor dependencies, risk adjustments,
compensating controls, and operational requirements that justify
deviations from standard POA&M remediation timelines.

Deviation requests follow a review workflow:
  Draft -> Submitted -> Under Review -> Approved / Denied

Approved deviations may have an expiration date after which
they must be re-evaluated.
"""

import uuid

from django.db import models
from django.utils import timezone


class DeviationRequest(models.Model):
    """
    Track deviations for POA&M items.

    A deviation request represents a formal justification for why a POA&M
    item cannot be remediated in the standard manner or timeframe. Common
    reasons include false positives, vendor dependencies, compensating
    controls, risk adjustments, and operational requirements.

    Each deviation goes through a review workflow and may be approved
    with an optional expiration date.
    """

    class DeviationType(models.TextChoices):
        FALSE_POSITIVE = "false_positive", "False Positive"
        VENDOR_DEPENDENCY = "vendor_dependency", "Vendor Dependency"
        RISK_ADJUSTMENT = "risk_adjustment", "Risk Adjustment"
        COMPENSATING_CONTROL = "compensating_control", "Compensating Control"
        OPERATIONAL_REQUIREMENT = (
            "operational_requirement",
            "Operational Requirement",
        )

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        UNDER_REVIEW = "under_review", "Under Review"
        APPROVED = "approved", "Approved"
        DENIED = "denied", "Denied"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    poam_item = models.ForeignKey(
        "poam.POAMItem",
        on_delete=models.CASCADE,
        related_name="deviation_requests",
        help_text="The POA&M item this deviation request is for",
    )
    deviation_type = models.CharField(
        max_length=30,
        choices=DeviationType.choices,
        help_text="Category of the deviation request",
    )
    justification = models.TextField(
        help_text="Detailed justification for the deviation",
    )
    compensating_controls = models.TextField(
        blank=True,
        default="",
        help_text=(
            "Description of compensating controls in place "
            "(required for compensating_control type)"
        ),
    )
    risk_assessment = models.TextField(
        blank=True,
        default="",
        help_text="Risk assessment describing residual risk with this deviation",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        help_text="Current workflow status of the deviation request",
    )
    requested_by = models.CharField(
        max_length=255,
        help_text="Name or identifier of the person requesting the deviation",
    )
    requested_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the deviation was initially requested",
    )
    reviewed_by = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Name or identifier of the reviewer",
    )
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the deviation was reviewed",
    )
    review_notes = models.TextField(
        blank=True,
        default="",
        help_text="Notes from the reviewer explaining their decision",
    )
    expiration_date = models.DateField(
        null=True,
        blank=True,
        help_text=(
            "Date when this deviation expires and must be re-evaluated. "
            "Leave blank for no expiration."
        ),
    )

    class Meta:
        app_label = "poam"
        db_table = "poam_deviation_requests"
        ordering = ["-requested_at"]
        indexes = [
            models.Index(
                fields=["poam_item", "status"],
                name="deviation_poam_status_idx",
            ),
            models.Index(
                fields=["status"],
                name="deviation_status_idx",
            ),
            models.Index(
                fields=["deviation_type"],
                name="deviation_type_idx",
            ),
            models.Index(
                fields=["expiration_date"],
                name="deviation_expiration_idx",
            ),
        ]
        verbose_name = "Deviation Request"
        verbose_name_plural = "Deviation Requests"

    def submit(self):
        """Submit the deviation request for review."""
        if self.status == self.Status.DRAFT:
            self.status = self.Status.SUBMITTED

    def start_review(self, reviewer: str):
        """Move the deviation into review status."""
        if self.status == self.Status.SUBMITTED:
            self.status = self.Status.UNDER_REVIEW
            self.reviewed_by = reviewer

    def approve(self, reviewer: str, notes: str = "", expiration_date=None):
        """Approve the deviation request."""
        if self.status in (self.Status.SUBMITTED, self.Status.UNDER_REVIEW):
            self.status = self.Status.APPROVED
            self.reviewed_by = reviewer
            self.reviewed_at = timezone.now()
            self.review_notes = notes
            if expiration_date:
                self.expiration_date = expiration_date

            # Update the parent POA&M item
            self.poam_item.has_deviation = True
            self.poam_item.deviation_approved = True
            self.poam_item.deviation_justification = self.justification
            self.poam_item.deviation_approval_date = timezone.now().date()
            self.poam_item.save()

    def deny(self, reviewer: str, notes: str = ""):
        """Deny the deviation request."""
        if self.status in (self.Status.SUBMITTED, self.Status.UNDER_REVIEW):
            self.status = self.Status.DENIED
            self.reviewed_by = reviewer
            self.reviewed_at = timezone.now()
            self.review_notes = notes

    @property
    def is_expired(self) -> bool:
        """Check if the approved deviation has expired."""
        if self.status != self.Status.APPROVED:
            return False
        if not self.expiration_date:
            return False
        return timezone.now().date() > self.expiration_date

    @property
    def days_until_expiration(self) -> int:
        """Get the number of days until expiration, or 0 if not applicable."""
        if not self.expiration_date:
            return 0
        if self.status != self.Status.APPROVED:
            return 0
        delta = self.expiration_date - timezone.now().date()
        return max(delta.days, 0)

    def __str__(self):
        return (
            f"DeviationRequest({self.get_deviation_type_display()} "
            f"for {self.poam_item} - {self.get_status_display()})"
        )
