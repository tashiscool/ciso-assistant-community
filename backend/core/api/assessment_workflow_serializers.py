"""Assessment Workflow (Plans, Attestations, Timelines) API Serializers."""

from django.utils import timezone
from rest_framework import serializers
from core.governance.assessment_workflow import (
    AssessmentPlan,
    Attestation,
    AuthorizationTimeline,
)


class AssessmentPlanSerializer(serializers.ModelSerializer):
    """Read serializer for assessment plans."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    assessment_type_display = serializers.CharField(
        source="get_assessment_type_display", read_only=True
    )
    assessment_name = serializers.CharField(
        source="compliance_assessment.name", read_only=True
    )
    lead_assessor_name = serializers.CharField(
        source="lead_assessor.get_full_name", read_only=True, default=None
    )

    class Meta:
        model = AssessmentPlan
        fields = [
            "id", "name", "description",
            "compliance_assessment", "assessment_name",
            "artifact_package",
            "assessment_type", "assessment_type_display",
            "status", "status_display",
            "scope_description", "in_scope_controls", "excluded_controls",
            "system_boundary",
            "planned_start", "planned_end", "actual_start", "actual_end",
            "methodology", "test_procedures",
            "lead_assessor", "lead_assessor_name",
            "assessor_organization",
            "approved_at", "approved_by",
            "folder", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "approved_at", "approved_by",
            "created_at", "updated_at",
        ]


class AssessmentPlanDetailSerializer(AssessmentPlanSerializer):
    """Extended serializer with nested attestation count."""

    attestation_count = serializers.IntegerField(read_only=True)

    class Meta(AssessmentPlanSerializer.Meta):
        fields = AssessmentPlanSerializer.Meta.fields + [
            "attestation_count",
        ]


class AttestationSerializer(serializers.ModelSerializer):
    """Read serializer for attestations."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    attestation_type_display = serializers.CharField(
        source="get_attestation_type_display", read_only=True
    )
    authority_level_display = serializers.CharField(
        source="get_authority_level_display", read_only=True
    )
    attester_name = serializers.CharField(
        source="attester.get_full_name", read_only=True, default=None
    )

    class Meta:
        model = Attestation
        fields = [
            "id", "title",
            "compliance_assessment", "assessment_plan",
            "attestation_type", "attestation_type_display",
            "authority_level", "authority_level_display",
            "status", "status_display",
            "statement", "conditions",
            "content_type", "object_id",
            "attester", "attester_name",
            "attester_title", "attester_organization",
            "attested_at", "expires_at",
            "revoked_at", "revoked_by", "revocation_reason",
            "folder", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "attested_at", "revoked_at", "revoked_by",
            "created_at", "updated_at",
        ]


class AttestationCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating new attestations."""

    class Meta:
        model = Attestation
        fields = [
            "title",
            "compliance_assessment", "assessment_plan",
            "attestation_type", "authority_level", "status",
            "statement", "conditions",
            "content_type", "object_id",
            "attester", "attester_title", "attester_organization",
            "expires_at",
            "folder",
        ]

    def validate(self, attrs):
        assessment_plan = attrs.get("assessment_plan")
        if assessment_plan and assessment_plan.status == AssessmentPlan.Status.DRAFT:
            raise serializers.ValidationError(
                "Cannot create attestations for a plan that is still in draft status."
            )
        return attrs


class AuthorizationTimelineSerializer(serializers.ModelSerializer):
    """Read serializer for authorization timeline events."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    authorization_type_display = serializers.CharField(
        source="get_authorization_type_display", read_only=True
    )
    assessment_name = serializers.CharField(
        source="compliance_assessment.name", read_only=True
    )
    authorizing_official_name = serializers.CharField(
        source="authorizing_official.get_full_name", read_only=True, default=None
    )
    duration_days = serializers.SerializerMethodField()
    days_to_expiry = serializers.SerializerMethodField()

    class Meta:
        model = AuthorizationTimeline
        fields = [
            "id", "name", "description",
            "compliance_assessment", "assessment_name",
            "authorization_type", "authorization_type_display",
            "status", "status_display",
            "impact_level",
            "readiness_assessment_date", "sap_approved_date",
            "assessment_start_date", "assessment_complete_date",
            "sar_delivered_date", "poam_finalized_date",
            "authorization_date", "authorization_expiry",
            "conmon_start_date",
            "authorizing_official", "authorizing_official_name",
            "authorizing_official_title", "sponsoring_agency",
            "tpao_name", "tpao_entity",
            "milestones",
            "duration_days", "days_to_expiry",
            "folder", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "created_at", "updated_at",
        ]

    def get_duration_days(self, obj):
        """Compute elapsed days from assessment start to authorization (or now)."""
        if not obj.assessment_start_date:
            return None
        end = obj.authorization_date or timezone.now().date()
        return (end - obj.assessment_start_date).days

    def get_days_to_expiry(self, obj):
        """Compute days remaining until authorization expires."""
        if not obj.authorization_expiry:
            return None
        delta = obj.authorization_expiry - timezone.now().date()
        return delta.days
