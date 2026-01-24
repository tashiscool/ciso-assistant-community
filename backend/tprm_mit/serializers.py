"""
TPRM Serializers - MIT Licensed

Clean-room implementation of TPRM serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from .models import Entity, EntityAssessment, Representative, Solution, Contract


class EntitySerializer(serializers.ModelSerializer):
    """Full serializer for Entity model."""
    default_criticality = serializers.FloatField(read_only=True)
    solution_count = serializers.SerializerMethodField()
    contract_count = serializers.SerializerMethodField()

    class Meta:
        model = Entity
        fields = [
            'id',
            'name',
            'description',
            'ref_id',
            'organization_id',
            'parent',
            'entity_type',
            'is_active',
            'default_dependency',
            'default_penetration',
            'default_maturity',
            'default_trust',
            'default_criticality',
            'website',
            'contact_email',
            'contact_phone',
            'address_line1',
            'address_line2',
            'city',
            'state_province',
            'postal_code',
            'country',
            'legal_identifiers',
            'dora_entity_type',
            'dora_hierarchy',
            'assets_value',
            'competent_authority',
            'provider_person_type',
            'currency',
            'is_builtin',
            'solution_count',
            'contract_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_solution_count(self, obj):
        return obj.provided_solutions.count()

    def get_contract_count(self, obj):
        return obj.provider_contracts.count()


class EntityListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for entity lists."""
    default_criticality = serializers.FloatField(read_only=True)

    class Meta:
        model = Entity
        fields = [
            'id',
            'name',
            'ref_id',
            'entity_type',
            'is_active',
            'country',
            'default_criticality',
        ]


class RepresentativeSerializer(serializers.ModelSerializer):
    """Full serializer for Representative model."""
    full_name = serializers.CharField(read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)

    class Meta:
        model = Representative
        fields = [
            'id',
            'entity',
            'entity_name',
            'ref_id',
            'first_name',
            'last_name',
            'full_name',
            'email',
            'phone',
            'role',
            'description',
            'user',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RepresentativeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for representative lists."""
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Representative
        fields = ['id', 'full_name', 'email', 'role']


class SolutionSerializer(serializers.ModelSerializer):
    """Full serializer for Solution model."""
    provider_name = serializers.CharField(source='provider.name', read_only=True)

    class Meta:
        model = Solution
        fields = [
            'id',
            'name',
            'description',
            'ref_id',
            'provider',
            'provider_name',
            'recipient_id',
            'criticality',
            'asset_ids',
            'owner_ids',
            'ict_service_type',
            'storage_of_data',
            'data_storage_locations',
            'data_processing_locations',
            'sensitiveness',
            'reliance_level',
            'substitutability',
            'non_substitutability_reason',
            'has_exit_plan',
            'exit_plan_description',
            'reintegration_possibility',
            'discontinuing_impact',
            'alternative_providers',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SolutionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for solution lists."""
    provider_name = serializers.CharField(source='provider.name', read_only=True)

    class Meta:
        model = Solution
        fields = [
            'id',
            'name',
            'provider_name',
            'criticality',
            'ict_service_type',
        ]


class ContractSerializer(serializers.ModelSerializer):
    """Full serializer for Contract model."""
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    solutions = SolutionListSerializer(many=True, read_only=True)

    class Meta:
        model = Contract
        fields = [
            'id',
            'name',
            'description',
            'ref_id',
            'provider',
            'provider_name',
            'beneficiary_id',
            'status',
            'start_date',
            'end_date',
            'signed_date',
            'solutions',
            'overarching_contract',
            'currency',
            'annual_expense',
            'notice_period_days',
            'termination_reason',
            'governing_law_country',
            'is_intragroup',
            'evidence_ids',
            'is_expired',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContractListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for contract lists."""
    provider_name = serializers.CharField(source='provider.name', read_only=True)

    class Meta:
        model = Contract
        fields = [
            'id',
            'name',
            'provider_name',
            'status',
            'start_date',
            'end_date',
        ]


class EntityAssessmentSerializer(serializers.ModelSerializer):
    """Full serializer for EntityAssessment model."""
    entity_name = serializers.CharField(source='entity.name', read_only=True)
    calculated_criticality = serializers.FloatField(read_only=True)
    solutions = SolutionListSerializer(many=True, read_only=True)
    representatives = RepresentativeListSerializer(many=True, read_only=True)

    class Meta:
        model = EntityAssessment
        fields = [
            'id',
            'name',
            'description',
            'ref_id',
            'entity',
            'entity_name',
            'criticality',
            'dependency',
            'penetration',
            'maturity',
            'trust',
            'calculated_criticality',
            'conclusion',
            'solutions',
            'representatives',
            'evidence_ids',
            'assessment_date',
            'next_assessment_date',
            'assessor',
            'findings',
            'recommendations',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EntityAssessmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for assessment lists."""
    entity_name = serializers.CharField(source='entity.name', read_only=True)

    class Meta:
        model = EntityAssessment
        fields = [
            'id',
            'entity_name',
            'conclusion',
            'assessment_date',
            'criticality',
        ]
