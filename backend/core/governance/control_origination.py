"""
Control Origination & Shared Responsibility Models - MIT Licensed

Clean-room implementation of FedRAMP control origination tracking
and shared responsibility matrices for cloud assessments.
Copyright (c) 2026 Tash
"""

from django.db import models

from iam.models import FolderMixin

from ..base_models import (
    AbstractBaseModel,
    NameDescriptionMixin,
)


class ControlOrigination(NameDescriptionMixin, FolderMixin):
    """
    Stores how each control is originated for a specific system/assessment.

    In FedRAMP and other cloud authorization frameworks, each control must
    declare its origination type (e.g., service-provider corporate,
    customer-configured, inherited, shared). This model tracks that
    origination along with implementation status and responsibility details.
    """

    class OriginationType(models.TextChoices):
        SP_CORPORATE = "sp_corporate", "Service Provider Corporate"
        SP_SYSTEM = "sp_system", "Service Provider System-Specific"
        CUSTOMER_CONFIGURED = "customer_configured", "Configured by Customer"
        CUSTOMER_PROVIDED = "customer_provided", "Provided by Customer"
        INHERITED = "inherited", "Inherited"
        SHARED = "shared", "Shared"
        HYBRID = "hybrid", "Hybrid"

    class ImplementationStatus(models.TextChoices):
        IMPLEMENTED = "implemented", "Implemented"
        PARTIALLY_IMPLEMENTED = "partially_implemented", "Partially Implemented"
        PLANNED = "planned", "Planned"
        ALTERNATIVE = "alternative", "Alternative Implementation"
        NOT_APPLICABLE = "not_applicable", "Not Applicable"

    applied_control = models.ForeignKey(
        "core.AppliedControl",
        on_delete=models.CASCADE,
        related_name="originations",
        help_text="The applied control this origination describes",
    )
    compliance_assessment = models.ForeignKey(
        "core.ComplianceAssessment",
        on_delete=models.CASCADE,
        related_name="control_originations",
        help_text="The compliance assessment context",
    )

    origination_type = models.CharField(
        max_length=30,
        choices=OriginationType.choices,
        help_text="How this control is originated (FedRAMP origination type)",
    )
    implementation_status = models.CharField(
        max_length=30,
        choices=ImplementationStatus.choices,
        default=ImplementationStatus.IMPLEMENTED,
        help_text="Current implementation status of this control origination",
    )

    # What percentage does this origination cover (for shared/hybrid)
    responsibility_percentage = models.IntegerField(
        default=100,
        help_text="Percentage of control responsibility (0-100)",
    )

    # Who is responsible
    responsible_role = models.CharField(
        max_length=255,
        blank=True,
        help_text="Role responsible for this origination (e.g., ISSO, System Admin)",
    )
    responsible_entity = models.ForeignKey(
        "tprm.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="control_originations",
        help_text="Entity responsible for this control origination",
    )

    # Parent system for inherited controls
    inherited_from = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inherited_by",
        help_text="Parent origination this was inherited from",
    )
    inherited_from_system = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of parent system (if external)",
    )

    # Implementation details
    implementation_narrative = models.TextField(
        blank=True,
        help_text="Control implementation statement",
    )
    parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Control parameter values (e.g., password age=90)",
    )

    class Meta:
        verbose_name = "Control Origination"
        verbose_name_plural = "Control Originations"
        ordering = ["applied_control", "origination_type"]
        unique_together = [
            ["applied_control", "compliance_assessment", "origination_type"]
        ]

    def __str__(self):
        return f"{self.applied_control} - {self.get_origination_type_display()}"


class SharedResponsibilityMatrix(NameDescriptionMixin, FolderMixin):
    """
    Defines the CSP/customer responsibility split for a system.

    A Shared Responsibility Matrix (also called a Customer Responsibility
    Matrix or CRM) documents which controls are the responsibility of the
    cloud service provider, which are the customer's, and which are shared.
    """

    compliance_assessment = models.ForeignKey(
        "core.ComplianceAssessment",
        on_delete=models.CASCADE,
        related_name="responsibility_matrices",
        help_text="The compliance assessment this matrix belongs to",
    )

    # Provider info
    provider_name = models.CharField(
        max_length=255,
        help_text="Cloud Service Provider name",
    )
    provider_entity = models.ForeignKey(
        "tprm.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="provided_responsibility_matrices",
        help_text="Entity record for the cloud service provider",
    )

    # Customer info
    customer_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Customer organization name",
    )
    customer_entity = models.ForeignKey(
        "tprm.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customer_responsibility_matrices",
        help_text="Entity record for the customer organization",
    )

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_REVIEW = "in_review", "In Review"
        APPROVED = "approved", "Approved"
        DEPRECATED = "deprecated", "Deprecated"

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        help_text="Current lifecycle status of this matrix",
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this matrix was approved",
    )
    approved_by = models.ForeignKey(
        "iam.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="User who approved this matrix",
    )

    class Meta:
        verbose_name = "Shared Responsibility Matrix"
        verbose_name_plural = "Shared Responsibility Matrices"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.provider_name})"


class ResponsibilityAssignment(NameDescriptionMixin, FolderMixin):
    """
    Individual control assignment in a Shared Responsibility Matrix.

    Each assignment maps a reference control to a responsible party
    (provider, customer, or shared) with percentage splits and
    narrative descriptions of each party's obligations.
    """

    matrix = models.ForeignKey(
        SharedResponsibilityMatrix,
        on_delete=models.CASCADE,
        related_name="assignments",
        help_text="The shared responsibility matrix this assignment belongs to",
    )
    reference_control = models.ForeignKey(
        "core.ReferenceControl",
        on_delete=models.CASCADE,
        related_name="responsibility_assignments",
        help_text="The reference control being assigned",
    )

    class ResponsibleParty(models.TextChoices):
        PROVIDER_FULL = "provider_full", "Provider (Full)"
        CUSTOMER_FULL = "customer_full", "Customer (Full)"
        SHARED = "shared", "Shared"
        NOT_APPLICABLE = "not_applicable", "Not Applicable"

    responsible_party = models.CharField(
        max_length=20,
        choices=ResponsibleParty.choices,
        help_text="Which party is responsible for this control",
    )
    provider_percentage = models.IntegerField(
        default=0,
        help_text="Provider responsibility %",
    )
    customer_percentage = models.IntegerField(
        default=0,
        help_text="Customer responsibility %",
    )

    provider_narrative = models.TextField(
        blank=True,
        help_text="What the provider does for this control",
    )
    customer_narrative = models.TextField(
        blank=True,
        help_text="What the customer must do for this control",
    )

    # Link to actual implementations
    provider_controls = models.ManyToManyField(
        "core.AppliedControl",
        blank=True,
        related_name="provider_responsibilities",
        help_text="Provider's applied controls implementing this responsibility",
    )
    customer_controls = models.ManyToManyField(
        "core.AppliedControl",
        blank=True,
        related_name="customer_responsibilities",
        help_text="Customer's applied controls implementing this responsibility",
    )

    class Meta:
        verbose_name = "Responsibility Assignment"
        verbose_name_plural = "Responsibility Assignments"
        ordering = ["reference_control"]
        unique_together = [["matrix", "reference_control"]]

    def __str__(self):
        return f"{self.reference_control} - {self.get_responsible_party_display()}"
