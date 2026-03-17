"""Assessment Workflow (Plans, Attestations, Timelines) API Views."""

import logging

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from core.views import BaseModelViewSet
from core.governance.assessment_workflow import (
    AssessmentPlan,
    Attestation,
    AuthorizationTimeline,
)
from .assessment_workflow_serializers import (
    AssessmentPlanSerializer,
    AssessmentPlanDetailSerializer,
    AttestationSerializer,
    AttestationCreateSerializer,
    AuthorizationTimelineSerializer,
)

logger = logging.getLogger(__name__)


class AssessmentPlanViewSet(BaseModelViewSet):
    """CRUD for Security Assessment Plans (SAP) with lifecycle transitions."""

    model = AssessmentPlan
    permission_classes = [IsAuthenticated]
    serializer_class = AssessmentPlanSerializer
    filterset_fields = ["compliance_assessment", "status", "assessment_type", "folder"]
    search_fields = ["name", "description", "assessor_organization"]
    ordering_fields = ["name", "status", "assessment_type", "created_at", "updated_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return AssessmentPlanDetailSerializer
        return AssessmentPlanSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if qs is None:
            return AssessmentPlan.objects.none()
        return qs.select_related(
            "compliance_assessment", "approved_by", "lead_assessor",
        ).annotate(
            attestation_count=Count("attestations"),
        ).order_by("-created_at")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve the Security Assessment Plan."""
        plan = self.get_object()
        if plan.status == AssessmentPlan.Status.APPROVED:
            raise ValidationError("This plan is already approved.")
        if plan.status not in (AssessmentPlan.Status.DRAFT, AssessmentPlan.Status.IN_REVIEW):
            raise ValidationError(
                f"Cannot approve a plan with status '{plan.get_status_display()}'."
            )

        with transaction.atomic():
            plan.status = AssessmentPlan.Status.APPROVED
            plan.approved_at = timezone.now()
            plan.approved_by = request.user
            plan.save(update_fields=["status", "approved_at", "approved_by"])

        return Response(AssessmentPlanSerializer(plan).data)

    @action(detail=True, methods=["post"], url_path="start-execution")
    def start_execution(self, request, pk=None):
        """Transition the plan to in-execution status."""
        plan = self.get_object()
        if plan.status != AssessmentPlan.Status.APPROVED:
            raise ValidationError(
                "Only approved plans can be moved to execution."
            )

        with transaction.atomic():
            plan.status = AssessmentPlan.Status.IN_EXECUTION
            plan.actual_start = timezone.now().date()
            plan.save(update_fields=["status", "actual_start"])

        return Response(AssessmentPlanSerializer(plan).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Mark the plan as completed."""
        plan = self.get_object()
        if plan.status != AssessmentPlan.Status.IN_EXECUTION:
            raise ValidationError(
                "Only plans in execution can be completed."
            )

        with transaction.atomic():
            plan.status = AssessmentPlan.Status.COMPLETED
            plan.actual_end = timezone.now().date()
            plan.save(update_fields=["status", "actual_end"])

        return Response(AssessmentPlanSerializer(plan).data)


class AttestationViewSet(BaseModelViewSet):
    """CRUD for attestation records with approve/reject/revoke actions."""

    model = Attestation
    permission_classes = [IsAuthenticated]
    serializer_class = AttestationSerializer
    filterset_fields = [
        "assessment_plan", "attestation_type", "status",
        "attester", "authority_level", "folder",
    ]
    search_fields = ["title", "statement"]
    ordering_fields = ["title", "status", "attestation_type", "created_at"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AttestationCreateSerializer
        return AttestationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if qs is None:
            return Attestation.objects.none()
        return qs.select_related(
            "assessment_plan", "attester", "compliance_assessment",
        ).order_by("-created_at")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve the attestation: set attested_at and status to approved."""
        attestation = self.get_object()
        if attestation.status == Attestation.Status.APPROVED:
            raise ValidationError("This attestation is already approved.")

        with transaction.atomic():
            attestation.status = Attestation.Status.APPROVED
            attestation.attested_at = timezone.now()
            attestation.save(update_fields=["status", "attested_at"])

        return Response(AttestationSerializer(attestation).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject the attestation."""
        attestation = self.get_object()
        if attestation.status == Attestation.Status.REVOKED:
            raise ValidationError("Cannot reject a revoked attestation.")

        with transaction.atomic():
            attestation.status = Attestation.Status.REJECTED
            attestation.save(update_fields=["status"])

        return Response(AttestationSerializer(attestation).data)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        """Revoke the attestation: set revoked_at and status to revoked."""
        attestation = self.get_object()
        if attestation.status == Attestation.Status.REVOKED:
            raise ValidationError("This attestation is already revoked.")

        reason = request.data.get("reason", "")

        with transaction.atomic():
            attestation.status = Attestation.Status.REVOKED
            attestation.revoked_at = timezone.now()
            attestation.revoked_by = request.user
            attestation.revocation_reason = reason
            attestation.save(update_fields=[
                "status", "revoked_at", "revoked_by", "revocation_reason",
            ])

        return Response(AttestationSerializer(attestation).data)


class AuthorizationTimelineViewSet(BaseModelViewSet):
    """CRUD for authorization timeline tracking with lifecycle advancement."""

    model = AuthorizationTimeline
    permission_classes = [IsAuthenticated]
    serializer_class = AuthorizationTimelineSerializer
    filterset_fields = ["compliance_assessment", "status", "authorization_type", "folder"]
    search_fields = ["name", "description", "sponsoring_agency", "tpao_name"]
    ordering_fields = [
        "name", "status", "authorization_type",
        "authorization_date", "created_at", "updated_at",
    ]

    def get_queryset(self):
        qs = super().get_queryset()
        if qs is None:
            return AuthorizationTimeline.objects.none()
        return qs.select_related(
            "compliance_assessment", "authorizing_official", "tpao_entity",
        ).order_by("-created_at")

    @action(detail=True, methods=["post"])
    def advance(self, request, pk=None):
        """Advance to the next status in the authorization lifecycle.

        The lifecycle follows: not_started -> in_preparation ->
        ready_for_assessment -> in_assessment -> in_remediation ->
        awaiting_authorization -> authorized -> continuous_monitoring.
        Each transition is validated to prevent skipping stages.
        """
        timeline = self.get_object()

        lifecycle_order = [
            AuthorizationTimeline.Status.NOT_STARTED,
            AuthorizationTimeline.Status.IN_PREPARATION,
            AuthorizationTimeline.Status.READY_FOR_ASSESSMENT,
            AuthorizationTimeline.Status.IN_ASSESSMENT,
            AuthorizationTimeline.Status.IN_REMEDIATION,
            AuthorizationTimeline.Status.AWAITING_AUTHORIZATION,
            AuthorizationTimeline.Status.AUTHORIZED,
            AuthorizationTimeline.Status.CONTINUOUS_MONITORING,
        ]

        try:
            current_idx = lifecycle_order.index(timeline.status)
        except ValueError:
            raise ValidationError(
                f"Status '{timeline.get_status_display()}' is not part of "
                "the standard lifecycle and cannot be advanced."
            )

        if current_idx >= len(lifecycle_order) - 1:
            raise ValidationError(
                "This timeline has already reached the final lifecycle stage."
            )

        next_status = lifecycle_order[current_idx + 1]

        with transaction.atomic():
            update_fields = ["status"]
            timeline.status = next_status

            # Record key dates at specific transitions
            today = timezone.now().date()
            if next_status == AuthorizationTimeline.Status.IN_ASSESSMENT and not timeline.assessment_start_date:
                timeline.assessment_start_date = today
                update_fields.append("assessment_start_date")
            elif next_status == AuthorizationTimeline.Status.AUTHORIZED and not timeline.authorization_date:
                timeline.authorization_date = today
                update_fields.append("authorization_date")
            elif next_status == AuthorizationTimeline.Status.CONTINUOUS_MONITORING and not timeline.conmon_start_date:
                timeline.conmon_start_date = today
                update_fields.append("conmon_start_date")

            timeline.save(update_fields=update_fields)

        return Response(AuthorizationTimelineSerializer(timeline).data)

    @action(detail=True, methods=["get", "patch"])
    def milestones(self, request, pk=None):
        """Get or update the milestones for this timeline.

        GET returns the current milestones list.  PATCH accepts a
        ``milestones`` list that replaces the existing value.
        """
        timeline = self.get_object()

        if request.method == "GET":
            return Response({
                "timeline_id": str(timeline.id),
                "milestones": timeline.milestones or [],
            })

        # PATCH: replace milestones
        new_milestones = request.data.get("milestones")
        if not isinstance(new_milestones, list):
            raise ValidationError("The 'milestones' field must be a JSON array.")

        with transaction.atomic():
            timeline.milestones = new_milestones
            timeline.save(update_fields=["milestones"])

        return Response({
            "timeline_id": str(timeline.id),
            "milestones": timeline.milestones,
        })
