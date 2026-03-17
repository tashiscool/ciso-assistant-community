"""
Assessment Workflow Models - MIT Licensed

Clean-room implementation of assessment workflow orchestration and
attestation models for FedRAMP/ATO lifecycle management.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey

from iam.models import FolderMixin

from ..base_models import (
    AbstractBaseModel,
    NameDescriptionMixin,
)


class AssessmentPlan(NameDescriptionMixin, FolderMixin):
    """Security Assessment Plan (SAP) — defines scope, methodology, and schedule."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_REVIEW = "in_review", "In Review"
        APPROVED = "approved", "Approved"
        IN_EXECUTION = "in_execution", "In Execution"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class AssessmentType(models.TextChoices):
        INITIAL = "initial", "Initial Assessment"
        ANNUAL = "annual", "Annual Assessment"
        SIGNIFICANT_CHANGE = "significant_change", "Significant Change"
        AD_HOC = "ad_hoc", "Ad Hoc / Targeted"

    compliance_assessment = models.ForeignKey(
        "core.ComplianceAssessment",
        on_delete=models.CASCADE,
        related_name="assessment_plans",
    )
    artifact_package = models.ForeignKey(
        "assessment_artifacts.ArtifactPackage",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessment_plans",
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    assessment_type = models.CharField(
        max_length=30, choices=AssessmentType.choices, default=AssessmentType.ANNUAL
    )

    # Scope
    scope_description = models.TextField(blank=True)
    in_scope_controls = models.JSONField(
        default=list, blank=True, help_text="Control IDs in scope"
    )
    excluded_controls = models.JSONField(
        default=list, blank=True, help_text="Control IDs excluded with rationale"
    )
    system_boundary = models.TextField(
        blank=True, help_text="System boundary description"
    )

    # Schedule
    planned_start = models.DateField(null=True, blank=True)
    planned_end = models.DateField(null=True, blank=True)
    actual_start = models.DateField(null=True, blank=True)
    actual_end = models.DateField(null=True, blank=True)

    # Methodology
    methodology = models.TextField(
        blank=True, help_text="Assessment methodology description"
    )
    test_procedures = models.JSONField(
        default=list, blank=True, help_text="Test procedure references"
    )

    # Assessor team
    lead_assessor = models.ForeignKey(
        "iam.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_assessment_plans",
    )
    assessor_organization = models.CharField(
        max_length=255, blank=True, help_text="3PAO or assessor org name"
    )
    assessor_team = models.ManyToManyField(
        "iam.User", blank=True, related_name="assessment_plan_teams"
    )

    # Approval
    approved_by = models.ForeignKey(
        "iam.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Assessment Plan"
        verbose_name_plural = "Assessment Plans"
        ordering = ["-created_at"]


class Attestation(AbstractBaseModel, FolderMixin):
    """Formal attestation / sign-off on a compliance artifact."""

    class AttestationType(models.TextChoices):
        ATO_AUTHORIZATION = "ato_authorization", "ATO Authorization"
        ASSESSMENT_APPROVAL = "assessment_approval", "Assessment Approval"
        EVIDENCE_SIGN_OFF = "evidence_sign_off", "Evidence Sign-Off"
        POAM_APPROVAL = "poam_approval", "POA&M Approval"
        RISK_ACCEPTANCE = "risk_acceptance", "Risk Acceptance"
        POLICY_APPROVAL = "policy_approval", "Policy Approval"
        SYSTEM_AUTHORIZATION = "system_authorization", "System Authorization"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    class AuthorityLevel(models.TextChoices):
        AUTHORIZING_OFFICIAL = "authorizing_official", "Authorizing Official"
        ISSO = "isso", "ISSO"
        ISSM = "issm", "ISSM"
        SYSTEM_OWNER = "system_owner", "System Owner"
        ASSESSOR_LEAD = "assessor_lead", "Lead Assessor"
        EXECUTIVE = "executive", "Executive"

    attestation_type = models.CharField(
        max_length=30, choices=AttestationType.choices
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    authority_level = models.CharField(
        max_length=30, choices=AuthorityLevel.choices
    )

    # What is being attested
    title = models.CharField(max_length=500)
    statement = models.TextField(
        help_text="The attestation statement being signed"
    )
    conditions = models.TextField(
        blank=True, help_text="Conditions or caveats on this attestation"
    )

    # Generic FK — can attest to ComplianceAssessment, Evidence, POAMItem, etc.
    content_type = models.ForeignKey(
        "contenttypes.ContentType", on_delete=models.CASCADE
    )
    object_id = models.UUIDField()
    content_object = GenericForeignKey("content_type", "object_id")

    # Specific convenience FKs for common targets
    compliance_assessment = models.ForeignKey(
        "core.ComplianceAssessment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attestations",
    )
    assessment_plan = models.ForeignKey(
        AssessmentPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attestations",
    )

    # Who
    attester = models.ForeignKey(
        "iam.User",
        on_delete=models.PROTECT,
        related_name="attestations_given",
    )
    attester_title = models.CharField(
        max_length=255,
        blank=True,
        help_text="Official title at time of attestation",
    )
    attester_organization = models.CharField(max_length=255, blank=True)

    # When
    attested_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # Revocation
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        "iam.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    revocation_reason = models.TextField(blank=True)

    # Supporting evidence
    supporting_evidence = models.ManyToManyField(
        "core.Evidence", blank=True, related_name="attestations"
    )

    class Meta:
        verbose_name = "Attestation"
        verbose_name_plural = "Attestations"
        ordering = ["-attested_at", "-created_at"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["attestation_type", "status"]),
        ]


class AuthorizationTimeline(NameDescriptionMixin, FolderMixin):
    """Tracks the authorization journey for a system (FedRAMP ATO timeline)."""

    class AuthorizationType(models.TextChoices):
        FEDRAMP_JAB = "fedramp_jab", "FedRAMP JAB P-ATO"
        FEDRAMP_AGENCY = "fedramp_agency", "FedRAMP Agency ATO"
        FEDRAMP_LI_SAAS = "fedramp_li_saas", "FedRAMP LI-SaaS"
        DISA_IL = "disa_il", "DISA Impact Level"
        INTERNAL_ATO = "internal_ato", "Internal ATO"
        STATEAMP = "stateamp", "StateRAMP"

    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        IN_PREPARATION = "in_preparation", "In Preparation"
        READY_FOR_ASSESSMENT = "ready_for_assessment", "Ready for Assessment"
        IN_ASSESSMENT = "in_assessment", "In Assessment"
        IN_REMEDIATION = "in_remediation", "In Remediation"
        AWAITING_AUTHORIZATION = "awaiting_authorization", "Awaiting Authorization"
        AUTHORIZED = "authorized", "Authorized"
        CONTINUOUS_MONITORING = "continuous_monitoring", "Continuous Monitoring"
        SUSPENDED = "suspended", "Suspended"
        REVOKED = "revoked", "Revoked"

    compliance_assessment = models.OneToOneField(
        "core.ComplianceAssessment",
        on_delete=models.CASCADE,
        related_name="authorization_timeline",
    )

    authorization_type = models.CharField(
        max_length=30, choices=AuthorizationType.choices
    )
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.NOT_STARTED
    )
    impact_level = models.CharField(
        max_length=20,
        blank=True,
        help_text="e.g., Low, Moderate, High, IL4, IL5",
    )

    # Key dates
    readiness_assessment_date = models.DateField(null=True, blank=True)
    sap_approved_date = models.DateField(null=True, blank=True)
    assessment_start_date = models.DateField(null=True, blank=True)
    assessment_complete_date = models.DateField(null=True, blank=True)
    sar_delivered_date = models.DateField(null=True, blank=True)
    poam_finalized_date = models.DateField(null=True, blank=True)
    authorization_date = models.DateField(null=True, blank=True)
    authorization_expiry = models.DateField(null=True, blank=True)
    conmon_start_date = models.DateField(null=True, blank=True)

    # Authority
    authorizing_official = models.ForeignKey(
        "iam.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authorized_systems",
    )
    authorizing_official_title = models.CharField(max_length=255, blank=True)
    sponsoring_agency = models.CharField(max_length=255, blank=True)

    # 3PAO
    tpao_name = models.CharField(
        max_length=255, blank=True, verbose_name="3PAO Name"
    )
    tpao_entity = models.ForeignKey(
        "tprm.Entity",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assessed_timelines",
    )

    # Milestone tracking
    milestones = models.JSONField(
        default=list,
        blank=True,
        help_text="List of {name, target_date, actual_date, status}",
    )

    class Meta:
        verbose_name = "Authorization Timeline"
        verbose_name_plural = "Authorization Timelines"
        ordering = ["-authorization_date", "-created_at"]
