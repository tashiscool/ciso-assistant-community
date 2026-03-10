"""Assessment Artifact Package API Serializers."""

from rest_framework import serializers
from ..models import ArtifactPackage, ArtifactRequestItem, EvidenceSchedule


class ArtifactRequestItemSerializer(serializers.ModelSerializer):
    periodicity_display = serializers.CharField(
        source="get_periodicity_display", read_only=True
    )

    class Meta:
        model = ArtifactRequestItem
        fields = [
            "id", "request_id", "source_line", "category", "artifact_request",
            "request_date", "controls", "control_families", "control_domains",
            "workstreams", "supplemental_references", "primary_artifact_type",
            "artifact_types", "collection_channel", "platform_tags",
            "time_scopes", "periodicity", "periodicity_display",
            "commands", "config_paths", "bundle_hint", "evidence",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class EvidenceScheduleSerializer(serializers.ModelSerializer):
    frequency_display = serializers.CharField(
        source="get_frequency_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = EvidenceSchedule
        fields = [
            "id", "name", "description", "frequency", "frequency_display",
            "status", "status_display", "cron_expression", "control_families",
            "controls", "evidence_types", "platform_tags", "collection_actions",
            "evidence_rule", "conmon_activity", "last_collected_at",
            "next_due_at", "items_count", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ArtifactPackageSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    package_type_display = serializers.CharField(
        source="get_package_type_display", read_only=True
    )
    total_items = serializers.IntegerField(read_only=True)
    schedule_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ArtifactPackage
        fields = [
            "id", "name", "description", "status", "status_display",
            "package_type", "package_type_display", "system_name",
            "system_description", "compliance_assessment",
            "platform_tags", "stats", "collection_playbooks",
            "quality_report", "indexes", "source_file",
            "total_items", "schedule_count",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "stats", "collection_playbooks", "quality_report",
            "indexes", "created_at", "updated_at",
        ]


class ArtifactPackageCreateSerializer(serializers.ModelSerializer):
    """Used when creating a package (without TSV import)."""

    class Meta:
        model = ArtifactPackage
        fields = [
            "name", "description", "package_type", "system_name",
            "system_description", "compliance_assessment", "platform_tags",
        ]


class ArtifactPackageDetailSerializer(ArtifactPackageSerializer):
    """Extended serializer with nested items and schedules."""
    request_items = ArtifactRequestItemSerializer(many=True, read_only=True)
    evidence_schedules = EvidenceScheduleSerializer(many=True, read_only=True)

    class Meta(ArtifactPackageSerializer.Meta):
        fields = ArtifactPackageSerializer.Meta.fields + [
            "request_items", "evidence_schedules",
        ]


class TSVImportSerializer(serializers.Serializer):
    """Serializer for TSV file upload to create a package."""
    file = serializers.FileField(help_text="Tab-delimited request list file")
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default="")
    package_type = serializers.ChoiceField(
        choices=ArtifactPackage.PackageType.choices,
        default=ArtifactPackage.PackageType.FEDRAMP,
    )
    system_name = serializers.CharField(max_length=255, required=False, default="")
    generate_schedules = serializers.BooleanField(
        default=True,
        help_text="Auto-generate periodic evidence schedules from the imported items",
    )
