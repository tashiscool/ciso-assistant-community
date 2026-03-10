"""Assessment Artifact Package API Views."""

import logging

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from drf_spectacular.utils import extend_schema

from core.views import BaseModelViewSet as AbstractBaseModelViewSet
from ..models import ArtifactPackage, ArtifactRequestItem, EvidenceSchedule
from ..services.package_builder import PackageBuilderService
from ..services.schedule_generator import ScheduleGeneratorService
from .serializers import (
    ArtifactPackageSerializer,
    ArtifactPackageCreateSerializer,
    ArtifactPackageDetailSerializer,
    ArtifactRequestItemSerializer,
    EvidenceScheduleSerializer,
    TSVImportSerializer,
)

logger = logging.getLogger(__name__)


class BaseModelViewSet(AbstractBaseModelViewSet):
    """Base viewset for assessment-artifact models with app-specific serializers."""

    serializers_module = "assessment_artifacts.api.serializers"


class ArtifactPackageViewSet(BaseModelViewSet):
    """CRUD + import/export/generate-schedules for artifact packages."""

    model = ArtifactPackage
    permission_classes = [IsAuthenticated]
    serializer_class = ArtifactPackageSerializer
    filterset_fields = ["status", "package_type", "folder"]
    search_fields = ["name", "description", "system_name", "source_file"]
    ordering_fields = ["name", "status", "package_type", "created_at", "updated_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return ArtifactPackageCreateSerializer
        if self.action == "retrieve":
            return ArtifactPackageDetailSerializer
        return ArtifactPackageSerializer

    def perform_create(self, serializer):
        serializer.save(folder=self._get_target_folder())

    def get_queryset(self):
        qs = super().get_queryset()
        pkg_status = self.request.query_params.get("status")
        if pkg_status:
            qs = qs.filter(status=pkg_status)
        pkg_type = self.request.query_params.get("package_type")
        if pkg_type:
            qs = qs.filter(package_type=pkg_type)
        return qs.order_by("-created_at")

    def _get_target_folder(self):
        writable_folders = self.request.user.get_writable_folders()
        folder_id = self.request.data.get("folder")
        if folder_id:
            folder = writable_folders.filter(id=folder_id).first()
            if not folder:
                raise PermissionDenied(
                    "You do not have write access to the requested folder."
                )
            return folder

        folder = writable_folders.first()
        if not folder:
            raise ValidationError("No writable folder available")
        return folder

    @staticmethod
    def _as_bool(value, default: bool = True) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"1", "true", "yes", "on"}:
                return True
            if lowered in {"0", "false", "no", "off"}:
                return False
        return default

    @extend_schema(
        summary="Import TSV request list",
        description="Upload a tab-delimited assessment request list to create a new artifact package.",
        request=TSVImportSerializer,
        responses={201: ArtifactPackageDetailSerializer},
    )
    @action(detail=False, methods=["post"])
    def import_tsv(self, request):
        """Import a TSV request list and build an artifact package."""
        serializer = TSVImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        tsv_content = uploaded_file.read().decode("utf-8")
        folder = self._get_target_folder()

        with transaction.atomic():
            package = ArtifactPackage.objects.create(
                name=serializer.validated_data["name"],
                description=serializer.validated_data.get("description", ""),
                package_type=serializer.validated_data.get("package_type", "fedramp"),
                system_name=serializer.validated_data.get("system_name", ""),
                folder=folder,
            )

            builder = PackageBuilderService()
            package, _ = builder.build_from_tsv(
                tsv_content, package, source_name=uploaded_file.name
            )

            if serializer.validated_data.get("generate_schedules", True):
                generator = ScheduleGeneratorService()
                generator.generate_schedules(package)

        return Response(
            ArtifactPackageDetailSerializer(package).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="List available templates",
        description="Get available built-in assessment artifact templates.",
        responses={200: dict},
    )
    @action(detail=False, methods=["get"])
    def templates(self, request):
        """List available built-in assessment artifact templates."""
        from ..services.templates import list_templates
        return Response({"templates": list_templates()})

    @extend_schema(
        summary="Generate from template",
        description="Create a new artifact package from a built-in template.",
        responses={201: ArtifactPackageDetailSerializer},
    )
    @action(detail=False, methods=["post"])
    def generate_from_template(self, request):
        """Generate a package from a built-in template — no file upload needed."""
        template_key = request.data.get("template_key")
        if not template_key:
            return Response(
                {"error": "template_key is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from ..services.templates import get_template
        template = get_template(template_key)
        if not template:
            return Response(
                {"error": f"Unknown template: {template_key}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        name = request.data.get("name", template["meta"]["name"])
        system_name = request.data.get("system_name", "")
        folder = self._get_target_folder()

        with transaction.atomic():
            package = ArtifactPackage.objects.create(
                name=name,
                description=template["meta"]["description"],
                package_type=request.data.get("package_type", "fedramp"),
                system_name=system_name,
                folder=folder,
            )

            builder = PackageBuilderService()
            package, _ = builder.build_from_template(template_key, package)

            if self._as_bool(request.data.get("generate_schedules"), True):
                generator = ScheduleGeneratorService()
                generator.generate_schedules(package)

        return Response(
            ArtifactPackageDetailSerializer(package).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Generate evidence schedules",
        description="Analyze package items and generate periodic evidence collection schedules.",
        responses={200: EvidenceScheduleSerializer(many=True)},
    )
    @action(detail=True, methods=["post"])
    def generate_schedules(self, request, pk=None):
        """Generate or regenerate evidence schedules for this package."""
        package = self.get_object()
        generator = ScheduleGeneratorService()
        schedules = generator.generate_schedules(package)
        return Response(EvidenceScheduleSerializer(schedules, many=True).data)

    @extend_schema(
        summary="Get schedule summary",
        description="Dashboard-friendly summary of all schedules for this package.",
        responses={200: dict},
    )
    @action(detail=True, methods=["get"])
    def schedule_summary(self, request, pk=None):
        """Get a summary of all schedules for this package."""
        package = self.get_object()
        generator = ScheduleGeneratorService()
        return Response(generator.get_schedule_summary(package))

    @extend_schema(
        summary="Export package as JSON",
        description="Export the complete artifact package as a downloadable JSON file.",
        responses={200: dict},
    )
    @action(detail=True, methods=["get"])
    def export_json(self, request, pk=None):
        """Export the full package as the standard JSON format."""
        package = self.get_object()
        items = list(package.request_items.all().values(
            "request_id", "source_line", "request_date", "category",
            "controls", "control_families", "control_domains", "workstreams",
            "supplemental_references", "artifact_request", "artifact_types",
            "primary_artifact_type", "collection_channel", "platform_tags",
            "time_scopes", "periodicity", "commands", "config_paths", "bundle_hint",
        ))
        from datetime import UTC, datetime
        export = {
            "metadata": {
                "schema": "assessment-artifact-package/v1",
                "generated_at": datetime.now(UTC).isoformat(),
                "source": package.source_file or package.name,
            },
            "abstractions": {
                "workstream_types": sorted({
                    w for item in items for w in item.get("workstreams", [])
                }),
                "artifact_type_taxonomy": sorted({
                    a for item in items for a in item.get("artifact_types", [])
                }),
                "platform_tag_taxonomy": sorted({
                    p for item in items for p in item.get("platform_tags", [])
                }),
                "periodicity_types": sorted({
                    item["periodicity"] for item in items if item.get("periodicity")
                }),
            },
            "stats": package.stats,
            "items": items,
            "indexes": package.indexes,
            "collection_playbooks": package.collection_playbooks,
            "quality_report": package.quality_report,
        }

        from django.http import JsonResponse
        response = JsonResponse(export, json_dumps_params={"indent": 2})
        response["Content-Disposition"] = (
            f'attachment; filename="{package.name.replace(" ", "_")}_artifact_package.json"'
        )
        return response

    @extend_schema(
        summary="Get periodicity breakdown",
        description="Breakdown of request items by collection frequency.",
        responses={200: dict},
    )
    @action(detail=True, methods=["get"])
    def periodicity_breakdown(self, request, pk=None):
        """Get a periodicity breakdown for this package's items."""
        package = self.get_object()
        items = package.request_items.all()

        breakdown = {}
        for period_value, period_label in ArtifactRequestItem.Periodicity.choices:
            period_items = items.filter(periodicity=period_value)
            if period_items.exists():
                controls = set()
                families = set()
                for item in period_items:
                    controls.update(item.controls)
                    families.update(item.control_families)
                breakdown[period_value] = {
                    "label": period_label,
                    "count": period_items.count(),
                    "controls": sorted(controls),
                    "control_families": sorted(families),
                }

        return Response({
            "total_items": items.count(),
            "breakdown": breakdown,
        })


class ArtifactRequestItemViewSet(BaseModelViewSet):
    """Browse and filter request items within packages."""

    model = ArtifactRequestItem
    serializer_class = ArtifactRequestItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["package", "periodicity", "primary_artifact_type", "collection_channel", "folder"]
    search_fields = ["request_id", "artifact_request", "category"]
    ordering_fields = ["request_id", "source_line", "created_at", "updated_at"]

    def get_queryset(self):
        qs = super().get_queryset().select_related("package")
        package_id = self.request.query_params.get("package")
        if package_id:
            qs = qs.filter(package_id=package_id)
        control = self.request.query_params.get("control")
        if control:
            qs = qs.filter(controls__contains=[control])
        family = self.request.query_params.get("family")
        if family:
            qs = qs.filter(control_families__contains=[family])
        periodicity = self.request.query_params.get("periodicity")
        if periodicity:
            qs = qs.filter(periodicity=periodicity)
        platform = self.request.query_params.get("platform")
        if platform:
            qs = qs.filter(platform_tags__contains=[platform])
        return qs.order_by("request_id")


class EvidenceScheduleViewSet(BaseModelViewSet):
    """View and manage periodic evidence schedules."""

    model = EvidenceSchedule
    serializer_class = EvidenceScheduleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["package", "frequency", "status", "folder"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "frequency", "status", "created_at", "updated_at"]

    def get_queryset(self):
        qs = super().get_queryset().select_related("package")
        package_id = self.request.query_params.get("package")
        if package_id:
            qs = qs.filter(package_id=package_id)
        frequency = self.request.query_params.get("frequency")
        if frequency:
            qs = qs.filter(frequency=frequency)
        sched_status = self.request.query_params.get("status")
        if sched_status:
            qs = qs.filter(status=sched_status)
        return qs.order_by("frequency", "name")

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        """Pause a schedule."""
        schedule = self.get_object()
        schedule.status = EvidenceSchedule.Status.PAUSED
        schedule.save()
        return Response(EvidenceScheduleSerializer(schedule).data)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        """Resume a paused schedule."""
        schedule = self.get_object()
        schedule.status = EvidenceSchedule.Status.ACTIVE
        schedule.save()
        return Response(EvidenceScheduleSerializer(schedule).data)
