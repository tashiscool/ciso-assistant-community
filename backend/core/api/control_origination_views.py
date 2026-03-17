"""Control Origination & Shared Responsibility API Views."""

import logging
from collections import defaultdict

from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from core.views import BaseModelViewSet
from core.governance.control_origination import (
    ControlOrigination,
    SharedResponsibilityMatrix,
    ResponsibilityAssignment,
)
from .control_origination_serializers import (
    ControlOriginationSerializer,
    ControlOriginationCreateSerializer,
    SharedResponsibilityMatrixSerializer,
    SharedResponsibilityMatrixDetailSerializer,
    ResponsibilityAssignmentSerializer,
)

logger = logging.getLogger(__name__)


class ControlOriginationViewSet(BaseModelViewSet):
    """CRUD for control origination records with bulk create and assessment grouping."""

    model = ControlOrigination
    permission_classes = [IsAuthenticated]
    serializer_class = ControlOriginationSerializer
    filterset_fields = ["compliance_assessment", "applied_control", "origination_type", "implementation_status"]
    search_fields = ["name", "description", "responsible_role", "implementation_narrative"]
    ordering_fields = ["name", "origination_type", "implementation_status", "created_at", "updated_at"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ControlOriginationCreateSerializer
        return ControlOriginationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if qs is None:
            return ControlOrigination.objects.none()
        return qs.select_related(
            "applied_control", "compliance_assessment", "responsible_entity",
        ).order_by("applied_control__ref_id", "origination_type")

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        """Create multiple control originations at once.

        Expects a list of origination objects in the request body under
        the ``items`` key.  All records are created atomically.
        """
        items = request.data.get("items", [])
        if not items:
            raise ValidationError("The 'items' field is required and must be a non-empty list.")

        serializers = []
        for item_data in items:
            ser = ControlOriginationCreateSerializer(data=item_data)
            ser.is_valid(raise_exception=True)
            serializers.append(ser)

        created = []
        with transaction.atomic():
            for ser in serializers:
                instance = ser.save()
                created.append(instance)

        return Response(
            ControlOriginationSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path=r"by-assessment/(?P<assessment_id>[0-9a-f-]+)",
    )
    def by_assessment(self, request, assessment_id=None):
        """List all originations for an assessment, grouped by control family.

        Returns a dict keyed by the applied control's ref_id prefix
        (the family portion, i.e. everything before the last dot/dash).
        """
        qs = self.get_queryset().filter(compliance_assessment_id=assessment_id)

        grouped = defaultdict(list)
        for origination in qs:
            ref_id = origination.applied_control.ref_id or ""
            # Derive family from ref_id (e.g., "AC-1" -> "AC")
            parts = ref_id.split("-")
            family = parts[0] if parts else "Ungrouped"
            grouped[family].append(ControlOriginationSerializer(origination).data)

        return Response({
            "assessment_id": str(assessment_id),
            "total": qs.count(),
            "families": dict(grouped),
        })


class SharedResponsibilityMatrixViewSet(BaseModelViewSet):
    """CRUD for shared responsibility matrices with approval and export."""

    model = SharedResponsibilityMatrix
    permission_classes = [IsAuthenticated]
    serializer_class = SharedResponsibilityMatrixSerializer
    filterset_fields = ["compliance_assessment", "status"]
    search_fields = ["name", "description", "provider_name", "customer_name"]
    ordering_fields = ["name", "status", "provider_name", "created_at", "updated_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return SharedResponsibilityMatrixDetailSerializer
        return SharedResponsibilityMatrixSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if qs is None:
            return SharedResponsibilityMatrix.objects.none()
        return qs.select_related(
            "compliance_assessment", "provider_entity", "customer_entity",
        ).annotate(
            assignment_count=Count("assignments"),
        ).order_by("-created_at")

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Set matrix status to approved and record approval metadata."""
        matrix = self.get_object()
        if matrix.status == SharedResponsibilityMatrix.Status.APPROVED:
            raise ValidationError("This matrix is already approved.")

        with transaction.atomic():
            matrix.status = SharedResponsibilityMatrix.Status.APPROVED
            matrix.approved_at = timezone.now()
            matrix.approved_by = request.user
            matrix.save(update_fields=["status", "approved_at", "approved_by"])

        return Response(SharedResponsibilityMatrixSerializer(matrix).data)

    @action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        """Export the shared responsibility matrix as a JSON document."""
        matrix = self.get_object()
        assignments = matrix.assignments.select_related("reference_control").all()

        export_data = {
            "matrix": {
                "id": str(matrix.id),
                "name": matrix.name,
                "description": matrix.description,
                "provider_name": matrix.provider_name,
                "customer_name": matrix.customer_name,
                "status": matrix.status,
                "approved_at": matrix.approved_at.isoformat() if matrix.approved_at else None,
            },
            "assignments": [
                {
                    "reference_control": assignment.reference_control.ref_id,
                    "reference_control_name": assignment.reference_control.name,
                    "responsible_party": assignment.responsible_party,
                    "provider_percentage": assignment.provider_percentage,
                    "customer_percentage": assignment.customer_percentage,
                    "provider_narrative": assignment.provider_narrative,
                    "customer_narrative": assignment.customer_narrative,
                }
                for assignment in assignments
            ],
            "summary": {
                "total_controls": assignments.count(),
                "provider_full": assignments.filter(
                    responsible_party=ResponsibilityAssignment.ResponsibleParty.PROVIDER_FULL
                ).count(),
                "customer_full": assignments.filter(
                    responsible_party=ResponsibilityAssignment.ResponsibleParty.CUSTOMER_FULL
                ).count(),
                "shared": assignments.filter(
                    responsible_party=ResponsibilityAssignment.ResponsibleParty.SHARED
                ).count(),
                "not_applicable": assignments.filter(
                    responsible_party=ResponsibilityAssignment.ResponsibleParty.NOT_APPLICABLE
                ).count(),
            },
        }

        return Response(export_data)


class ResponsibilityAssignmentViewSet(BaseModelViewSet):
    """CRUD for individual responsibility assignments within a matrix."""

    model = ResponsibilityAssignment
    permission_classes = [IsAuthenticated]
    serializer_class = ResponsibilityAssignmentSerializer
    filterset_fields = ["matrix", "responsible_party", "reference_control"]
    search_fields = ["name", "description", "provider_narrative", "customer_narrative"]
    ordering_fields = ["name", "responsible_party", "created_at", "updated_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        if qs is None:
            return ResponsibilityAssignment.objects.none()
        return qs.select_related(
            "matrix", "reference_control",
        ).order_by("reference_control__ref_id")
