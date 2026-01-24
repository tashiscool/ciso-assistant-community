"""
Compliance Serializers - MIT Licensed

Clean-room implementation of compliance serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from ..models_mit import (
    ComplianceRequirement,
    RequirementAssessment,
    Audit,
    Finding,
    Evidence,
    ComplianceException,
)
from .organization import DomainListSerializer
from .governance import ControlListSerializer, AppliedControlListSerializer


class ComplianceRequirementSerializer(serializers.ModelSerializer):
    """Full serializer for ComplianceRequirement model."""
    framework_name = serializers.CharField(
        source='framework.name',
        read_only=True
    )
    parent_name = serializers.CharField(
        source='parent.name',
        read_only=True,
        allow_null=True
    )
    controls = ControlListSerializer(many=True, read_only=True)

    class Meta:
        model = ComplianceRequirement
        fields = [
            'id',
            'name',
            'description',
            'framework',
            'framework_name',
            'parent',
            'parent_name',
            'requirement_id',
            'requirement_text',
            'guidance',
            'requirement_type',
            'controls',
            'order',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RequirementAssessmentSerializer(serializers.ModelSerializer):
    """Full serializer for RequirementAssessment model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    requirement_name = serializers.CharField(
        source='requirement.name',
        read_only=True
    )
    requirement_id = serializers.CharField(
        source='requirement.requirement_id',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    applied_controls = AppliedControlListSerializer(many=True, read_only=True)

    class Meta:
        model = RequirementAssessment
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'requirement',
            'requirement_id',
            'requirement_name',
            'domains',
            'status',
            'compliance_score',
            'assessment_notes',
            'gaps_identified',
            'remediation_plan',
            'applied_controls',
            'assessment_date',
            'next_assessment_date',
            'remediation_due_date',
            'assessor',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AuditSerializer(serializers.ModelSerializer):
    """Full serializer for Audit model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    finding_count = serializers.SerializerMethodField()

    class Meta:
        model = Audit
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'frameworks',
            'audit_type',
            'status',
            'planned_start_date',
            'planned_end_date',
            'actual_start_date',
            'actual_end_date',
            'scope_description',
            'objectives',
            'lead_auditor',
            'audit_team',
            'external_auditor',
            'executive_summary',
            'overall_conclusion',
            'recommendations',
            'finding_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_finding_count(self, obj):
        return obj.findings.count()


class AuditListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for audit lists."""

    class Meta:
        model = Audit
        fields = [
            'id',
            'name',
            'audit_type',
            'status',
            'planned_start_date',
        ]


class FindingSerializer(serializers.ModelSerializer):
    """Full serializer for Finding model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    audit_name = serializers.CharField(
        source='audit.name',
        read_only=True,
        allow_null=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    requirements = serializers.SerializerMethodField()
    applied_controls = AppliedControlListSerializer(many=True, read_only=True)

    class Meta:
        model = Finding
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'audit',
            'audit_name',
            'domains',
            'finding_type',
            'severity',
            'status',
            'detailed_description',
            'root_cause',
            'business_impact',
            'recommendation',
            'requirements',
            'applied_controls',
            'owner',
            'identified_date',
            'due_date',
            'remediation_date',
            'verification_date',
            'remediation_plan',
            'remediation_notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_requirements(self, obj):
        return [
            {
                'id': str(r.id),
                'requirement_id': r.requirement_id,
                'name': r.name
            }
            for r in obj.requirements.all()
        ]


class FindingListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for finding lists."""

    class Meta:
        model = Finding
        fields = [
            'id',
            'name',
            'finding_type',
            'severity',
            'status',
            'due_date',
        ]


class EvidenceSerializer(serializers.ModelSerializer):
    """Full serializer for Evidence model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    is_valid = serializers.SerializerMethodField()

    class Meta:
        model = Evidence
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'evidence_type',
            'file_path',
            'file_name',
            'file_size',
            'mime_type',
            'file_hash',
            'content',
            'collected_date',
            'valid_from',
            'valid_until',
            'is_valid',
            'applied_controls',
            'requirements',
            'findings',
            'collected_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'file_hash', 'created_at', 'updated_at']

    def get_is_valid(self, obj):
        """Check if evidence is currently valid."""
        from django.utils import timezone
        now = timezone.now().date()
        if obj.valid_from and obj.valid_from > now:
            return False
        if obj.valid_until and obj.valid_until < now:
            return False
        return True


class ComplianceExceptionSerializer(serializers.ModelSerializer):
    """Full serializer for ComplianceException model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    requirements = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = ComplianceException
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'requirements',
            'justification',
            'compensating_controls',
            'residual_risk',
            'status',
            'requested_date',
            'approval_date',
            'expiration_date',
            'requester',
            'approver',
            'next_review_date',
            'is_expired',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'requested_date', 'created_at', 'updated_at']

    def get_requirements(self, obj):
        return [
            {
                'id': str(r.id),
                'requirement_id': r.requirement_id,
                'name': r.name
            }
            for r in obj.requirements.all()
        ]

    def get_is_expired(self, obj):
        """Check if exception is expired."""
        from django.utils import timezone
        if obj.expiration_date:
            return obj.expiration_date < timezone.now().date()
        return False
