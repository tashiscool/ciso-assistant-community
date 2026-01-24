"""
Governance Serializers - MIT Licensed

Clean-room implementation of governance serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from ..models_mit import (
    Framework,
    ControlFamily,
    Control,
    Policy,
    Procedure,
    AppliedControl,
)
from .organization import DomainListSerializer


class FrameworkSerializer(serializers.ModelSerializer):
    """Full serializer for Framework model."""
    control_count = serializers.SerializerMethodField()

    class Meta:
        model = Framework
        fields = [
            'id',
            'name',
            'description',
            'provider',
            'framework_version',
            'effective_date',
            'sunset_date',
            'category',
            'jurisdiction',
            'library_content',
            'source_url',
            'is_published',
            'published_at',
            'version',
            'control_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'published_at', 'created_at', 'updated_at']

    def get_control_count(self, obj):
        return obj.controls.count()


class FrameworkListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for framework lists."""

    class Meta:
        model = Framework
        fields = [
            'id',
            'name',
            'provider',
            'framework_version',
            'category',
            'is_published',
        ]


class ControlFamilySerializer(serializers.ModelSerializer):
    """Full serializer for ControlFamily model."""
    framework_name = serializers.CharField(
        source='framework.name',
        read_only=True
    )
    control_count = serializers.SerializerMethodField()

    class Meta:
        model = ControlFamily
        fields = [
            'id',
            'name',
            'description',
            'framework',
            'framework_name',
            'parent',
            'family_id',
            'order',
            'control_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_control_count(self, obj):
        return obj.controls.count()


class ControlSerializer(serializers.ModelSerializer):
    """Full serializer for Control model."""
    framework_name = serializers.CharField(
        source='framework.name',
        read_only=True
    )
    family_name = serializers.CharField(
        source='family.name',
        read_only=True,
        allow_null=True
    )
    parent_control_id = serializers.CharField(
        source='parent.control_id',
        read_only=True,
        allow_null=True
    )
    enhancement_count = serializers.SerializerMethodField()

    class Meta:
        model = Control
        fields = [
            'id',
            'control_id',
            'name',
            'description',
            'framework',
            'framework_name',
            'family',
            'family_name',
            'parent',
            'parent_control_id',
            'category',
            'objective',
            'guidance',
            'assessment_guidance',
            'parameters',
            'baseline_impact',
            'order',
            'enhancement_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_enhancement_count(self, obj):
        return obj.enhancements.count()


class ControlListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for control lists."""

    class Meta:
        model = Control
        fields = ['id', 'control_id', 'name', 'category']


class PolicySerializer(serializers.ModelSerializer):
    """Full serializer for Policy model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    controls = ControlListSerializer(many=True, read_only=True)

    class Meta:
        model = Policy
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'policy_type',
            'owner',
            'approver',
            'content',
            'effective_date',
            'review_date',
            'expiration_date',
            'controls',
            'attachments',
            'is_published',
            'published_at',
            'version',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'published_at', 'created_at', 'updated_at']


class PolicyListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for policy lists."""

    class Meta:
        model = Policy
        fields = [
            'id',
            'name',
            'policy_type',
            'is_published',
            'effective_date',
        ]


class ProcedureSerializer(serializers.ModelSerializer):
    """Full serializer for Procedure model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    policy_name = serializers.CharField(
        source='policy.name',
        read_only=True,
        allow_null=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    controls = ControlListSerializer(many=True, read_only=True)

    class Meta:
        model = Procedure
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'policy',
            'policy_name',
            'domains',
            'owner',
            'content',
            'steps',
            'frequency',
            'estimated_duration',
            'controls',
            'is_published',
            'published_at',
            'version',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'published_at', 'created_at', 'updated_at']


class AppliedControlSerializer(serializers.ModelSerializer):
    """Full serializer for AppliedControl model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    control_id = serializers.CharField(
        source='control.control_id',
        read_only=True
    )
    control_name = serializers.CharField(
        source='control.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)

    class Meta:
        model = AppliedControl
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'control',
            'control_id',
            'control_name',
            'domains',
            'implementation_status',
            'implementation_description',
            'implementation_evidence',
            'effectiveness',
            'owner',
            'implementation_date',
            'last_assessment_date',
            'next_assessment_date',
            'parameter_values',
            'implementation_cost',
            'annual_cost',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AppliedControlListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for applied control lists."""
    control_id = serializers.CharField(source='control.control_id', read_only=True)

    class Meta:
        model = AppliedControl
        fields = [
            'id',
            'name',
            'control_id',
            'implementation_status',
            'effectiveness',
        ]
