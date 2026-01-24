"""
Risk Serializers - MIT Licensed

Clean-room implementation of risk management serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from ..models_mit import (
    RiskMatrix,
    Threat,
    Vulnerability,
    RiskScenario,
    RiskAssessment,
    RiskTreatment,
)
from .organization import DomainListSerializer


class RiskMatrixSerializer(serializers.ModelSerializer):
    """Full serializer for RiskMatrix model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )

    class Meta:
        model = RiskMatrix
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'probability_levels',
            'impact_levels',
            'risk_thresholds',
            'risk_grid',
            'is_default',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ThreatSerializer(serializers.ModelSerializer):
    """Full serializer for Threat model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )

    class Meta:
        model = Threat
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'category',
            'source',
            'capability_level',
            'intent_level',
            'targeting',
            'mitre_attack_ids',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ThreatListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for threat lists."""

    class Meta:
        model = Threat
        fields = ['id', 'name', 'category', 'source']


class VulnerabilitySerializer(serializers.ModelSerializer):
    """Full serializer for Vulnerability model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)

    class Meta:
        model = Vulnerability
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'vulnerability_type',
            'severity_score',
            'cve_ids',
            'cwe_ids',
            'status',
            'discovered_date',
            'due_date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class VulnerabilityListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for vulnerability lists."""

    class Meta:
        model = Vulnerability
        fields = ['id', 'name', 'severity_score', 'status']


class RiskScenarioSerializer(serializers.ModelSerializer):
    """Full serializer for RiskScenario model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    threats = ThreatListSerializer(many=True, read_only=True)
    vulnerabilities = VulnerabilityListSerializer(many=True, read_only=True)
    inherent_risk_score = serializers.IntegerField(read_only=True)
    residual_risk_score = serializers.IntegerField(read_only=True)
    risk_level = serializers.SerializerMethodField()

    class Meta:
        model = RiskScenario
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'risk_matrix',
            'threats',
            'vulnerabilities',
            'category',
            'inherent_probability',
            'inherent_impact',
            'inherent_risk_score',
            'residual_probability',
            'residual_impact',
            'residual_risk_score',
            'risk_level',
            'treatment_strategy',
            'treatment_description',
            'status',
            'owner',
            'estimated_loss_min',
            'estimated_loss_max',
            'estimated_loss_expected',
            'metadata',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_risk_level(self, obj):
        """Get risk level from matrix if available."""
        if obj.risk_matrix:
            return obj.risk_matrix.get_risk_level(obj.residual_risk_score)
        return None


class RiskScenarioListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for risk scenario lists."""
    inherent_risk_score = serializers.IntegerField(read_only=True)
    residual_risk_score = serializers.IntegerField(read_only=True)

    class Meta:
        model = RiskScenario
        fields = [
            'id',
            'name',
            'category',
            'status',
            'treatment_strategy',
            'inherent_risk_score',
            'residual_risk_score',
        ]


class RiskAssessmentSerializer(serializers.ModelSerializer):
    """Full serializer for RiskAssessment model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    domains = DomainListSerializer(many=True, read_only=True)
    risk_scenarios = RiskScenarioListSerializer(many=True, read_only=True)
    risk_scenario_count = serializers.SerializerMethodField()

    class Meta:
        model = RiskAssessment
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'domains',
            'risk_matrix',
            'assessment_date',
            'next_assessment_date',
            'scope_description',
            'assessor',
            'status',
            'risk_scenarios',
            'risk_scenario_count',
            'summary',
            'recommendations',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_risk_scenario_count(self, obj):
        return obj.risk_scenarios.count()


class RiskTreatmentSerializer(serializers.ModelSerializer):
    """Full serializer for RiskTreatment model."""
    organization_name = serializers.CharField(
        source='organization.name',
        read_only=True
    )
    risk_scenario_name = serializers.CharField(
        source='risk_scenario.name',
        read_only=True
    )

    class Meta:
        model = RiskTreatment
        fields = [
            'id',
            'name',
            'description',
            'organization',
            'organization_name',
            'risk_scenario',
            'risk_scenario_name',
            'treatment_type',
            'action_plan',
            'owner',
            'start_date',
            'due_date',
            'completion_date',
            'status',
            'estimated_cost',
            'actual_cost',
            'expected_risk_reduction',
            'actual_risk_reduction',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
