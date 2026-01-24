"""
CRQ Serializers - MIT Licensed

Clean-room implementation of CRQ serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from .models import (
    QuantitativeRiskStudy,
    QuantitativeRiskScenario,
    QuantitativeRiskHypothesis,
)


class QuantitativeRiskHypothesisSerializer(serializers.ModelSerializer):
    """Full serializer for QuantitativeRiskHypothesis."""
    ale = serializers.SerializerMethodField()

    class Meta:
        model = QuantitativeRiskHypothesis
        fields = [
            'id',
            'scenario',
            'stage',
            'existing_control_ids',
            'added_control_ids',
            'removed_control_ids',
            'parameters',
            'simulation_data',
            'simulation_timestamp',
            'ale',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'simulation_data',
            'simulation_timestamp',
            'created_at',
            'updated_at',
        ]

    def get_ale(self, obj):
        return round(obj.get_ale(), 2) if obj.get_ale() else None


class QuantitativeRiskHypothesisListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for hypothesis lists."""
    ale = serializers.SerializerMethodField()

    class Meta:
        model = QuantitativeRiskHypothesis
        fields = ['id', 'stage', 'ale']

    def get_ale(self, obj):
        return round(obj.get_ale(), 2) if obj.get_ale() else None


class QuantitativeRiskScenarioSerializer(serializers.ModelSerializer):
    """Full serializer for QuantitativeRiskScenario."""
    hypotheses = QuantitativeRiskHypothesisListSerializer(many=True, read_only=True)
    current_ale = serializers.FloatField(read_only=True)
    residual_ale = serializers.FloatField(read_only=True)

    class Meta:
        model = QuantitativeRiskScenario
        fields = [
            'id',
            'study',
            'name',
            'description',
            'ref_id',
            'priority',
            'status',
            'asset_ids',
            'threat_ids',
            'vulnerability_ids',
            'owner_ids',
            'is_selected',
            'hypotheses',
            'current_ale',
            'residual_ale',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class QuantitativeRiskScenarioListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for scenario lists."""
    current_ale = serializers.FloatField(read_only=True)

    class Meta:
        model = QuantitativeRiskScenario
        fields = [
            'id',
            'name',
            'ref_id',
            'priority',
            'status',
            'is_selected',
            'current_ale',
        ]


class QuantitativeRiskStudySerializer(serializers.ModelSerializer):
    """Full serializer for QuantitativeRiskStudy."""
    scenario_count = serializers.SerializerMethodField()
    total_current_ale = serializers.SerializerMethodField()
    total_residual_ale = serializers.SerializerMethodField()

    class Meta:
        model = QuantitativeRiskStudy
        fields = [
            'id',
            'name',
            'description',
            'ref_id',
            'organization_id',
            'status',
            'distribution_model',
            'risk_tolerance',
            'loss_threshold',
            'currency',
            'portfolio_simulation',
            'simulation_timestamp',
            'authors',
            'reviewers',
            'observation',
            'scenario_count',
            'total_current_ale',
            'total_residual_ale',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'portfolio_simulation',
            'simulation_timestamp',
            'created_at',
            'updated_at',
        ]

    def get_scenario_count(self, obj):
        return obj.scenarios.count()

    def get_total_current_ale(self, obj):
        total = 0
        for scenario in obj.scenarios.filter(is_selected=True):
            ale = scenario.current_ale
            if ale:
                total += ale
        return round(total, 2)

    def get_total_residual_ale(self, obj):
        total = 0
        for scenario in obj.scenarios.filter(is_selected=True):
            ale = scenario.residual_ale
            if ale:
                total += ale
        return round(total, 2)


class QuantitativeRiskStudyListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for study lists."""

    class Meta:
        model = QuantitativeRiskStudy
        fields = [
            'id',
            'name',
            'ref_id',
            'status',
            'currency',
        ]
