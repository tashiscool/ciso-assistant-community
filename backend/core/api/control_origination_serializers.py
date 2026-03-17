"""Control Origination & Shared Responsibility API Serializers."""

from rest_framework import serializers
from core.governance.control_origination import (
    ControlOrigination,
    SharedResponsibilityMatrix,
    ResponsibilityAssignment,
)


class ControlOriginationSerializer(serializers.ModelSerializer):
    """Read serializer for control originations with computed display fields."""

    origination_type_display = serializers.CharField(
        source="get_origination_type_display", read_only=True
    )
    implementation_status_display = serializers.CharField(
        source="get_implementation_status_display", read_only=True
    )
    control_name = serializers.CharField(
        source="applied_control.name", read_only=True
    )
    control_ref_id = serializers.CharField(
        source="applied_control.ref_id", read_only=True
    )
    assessment_name = serializers.CharField(
        source="compliance_assessment.name", read_only=True
    )
    responsible_entity_name = serializers.CharField(
        source="responsible_entity.name", read_only=True, default=None
    )

    class Meta:
        model = ControlOrigination
        fields = [
            "id", "name", "description",
            "applied_control", "control_name", "control_ref_id",
            "compliance_assessment", "assessment_name",
            "origination_type", "origination_type_display",
            "implementation_status", "implementation_status_display",
            "responsibility_percentage",
            "responsible_role", "responsible_entity", "responsible_entity_name",
            "inherited_from", "inherited_from_system",
            "implementation_narrative", "parameters",
            "folder", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ControlOriginationCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating/updating control originations."""

    class Meta:
        model = ControlOrigination
        fields = [
            "name", "description",
            "applied_control", "compliance_assessment",
            "origination_type", "implementation_status",
            "responsibility_percentage",
            "responsible_role", "responsible_entity",
            "inherited_from", "inherited_from_system",
            "implementation_narrative", "parameters",
            "folder",
        ]

    def validate_responsibility_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError(
                "Responsibility percentage must be between 0 and 100."
            )
        return value

    def validate(self, attrs):
        origination_type = attrs.get("origination_type")
        # Inherited controls should reference a parent
        if origination_type == ControlOrigination.OriginationType.INHERITED:
            if not attrs.get("inherited_from") and not attrs.get("inherited_from_system"):
                raise serializers.ValidationError(
                    "Inherited controls must specify inherited_from or inherited_from_system."
                )
        return attrs


class SharedResponsibilityMatrixSerializer(serializers.ModelSerializer):
    """Read serializer for shared responsibility matrices."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    assessment_name = serializers.CharField(
        source="compliance_assessment.name", read_only=True
    )
    provider_entity_name = serializers.CharField(
        source="provider_entity.name", read_only=True, default=None
    )
    customer_entity_name = serializers.CharField(
        source="customer_entity.name", read_only=True, default=None
    )
    assignment_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = SharedResponsibilityMatrix
        fields = [
            "id", "name", "description",
            "compliance_assessment", "assessment_name",
            "provider_name", "provider_entity", "provider_entity_name",
            "customer_name", "customer_entity", "customer_entity_name",
            "status", "status_display",
            "approved_at", "approved_by",
            "assignment_count",
            "folder", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "approved_at", "approved_by", "created_at", "updated_at"]


class ResponsibilityAssignmentSerializer(serializers.ModelSerializer):
    """Read serializer for individual responsibility assignments."""

    responsible_party_display = serializers.CharField(
        source="get_responsible_party_display", read_only=True
    )
    reference_control_name = serializers.CharField(
        source="reference_control.name", read_only=True
    )
    reference_control_ref_id = serializers.CharField(
        source="reference_control.ref_id", read_only=True
    )
    matrix_name = serializers.CharField(
        source="matrix.name", read_only=True
    )

    class Meta:
        model = ResponsibilityAssignment
        fields = [
            "id", "name", "description",
            "matrix", "matrix_name",
            "reference_control", "reference_control_name", "reference_control_ref_id",
            "responsible_party", "responsible_party_display",
            "provider_percentage", "customer_percentage",
            "provider_narrative", "customer_narrative",
            "provider_controls", "customer_controls",
            "folder", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SharedResponsibilityMatrixDetailSerializer(SharedResponsibilityMatrixSerializer):
    """Extended serializer with nested assignments."""

    assignments = ResponsibilityAssignmentSerializer(many=True, read_only=True)

    class Meta(SharedResponsibilityMatrixSerializer.Meta):
        fields = SharedResponsibilityMatrixSerializer.Meta.fields + [
            "assignments",
        ]
