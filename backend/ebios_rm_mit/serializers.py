"""
EBIOS RM Serializers - MIT Licensed

Clean-room implementation of EBIOS RM serializers.
Copyright (c) 2026 Tash
"""

from rest_framework import serializers
from .models import (
    EbiosRMStudy,
    FearedEvent,
    RiskOrigin,
    TargetObjective,
    RoTo,
    Stakeholder,
    StrategicScenario,
    AttackPath,
    OperationalScenario,
    ElementaryAction,
    OperatingMode,
)


class EbiosRMStudySerializer(serializers.ModelSerializer):
    """Full serializer for EbiosRMStudy."""
    feared_event_count = serializers.SerializerMethodField()
    strategic_scenario_count = serializers.SerializerMethodField()
    operational_scenario_count = serializers.SerializerMethodField()

    class Meta:
        model = EbiosRMStudy
        fields = [
            'id',
            'name',
            'description',
            'ref_id',
            'organization_id',
            'status',
            'quotation_method',
            'risk_matrix_id',
            'workshop_metadata',
            'version',
            'observation',
            'authors',
            'reviewers',
            'feared_event_count',
            'strategic_scenario_count',
            'operational_scenario_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_feared_event_count(self, obj):
        return obj.feared_events.count()

    def get_strategic_scenario_count(self, obj):
        return obj.strategic_scenarios.count()

    def get_operational_scenario_count(self, obj):
        count = 0
        for ss in obj.strategic_scenarios.all():
            for ap in ss.attack_paths.all():
                count += ap.operational_scenarios.count()
        return count


class EbiosRMStudyListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for study lists."""

    class Meta:
        model = EbiosRMStudy
        fields = ['id', 'name', 'ref_id', 'status', 'version']


class FearedEventSerializer(serializers.ModelSerializer):
    """Full serializer for FearedEvent."""

    class Meta:
        model = FearedEvent
        fields = [
            'id',
            'study',
            'name',
            'description',
            'ref_id',
            'gravity',
            'is_selected',
            'selection_justification',
            'asset_ids',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class FearedEventListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for feared event lists."""

    class Meta:
        model = FearedEvent
        fields = ['id', 'name', 'ref_id', 'gravity', 'is_selected']


class RiskOriginSerializer(serializers.ModelSerializer):
    """Full serializer for RiskOrigin."""

    class Meta:
        model = RiskOrigin
        fields = [
            'id',
            'study',
            'name',
            'description',
            'ref_id',
            'category',
            'motivation',
            'resources',
            'activity',
            'is_selected',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RiskOriginListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for risk origin lists."""

    class Meta:
        model = RiskOrigin
        fields = ['id', 'name', 'category', 'motivation', 'resources', 'is_selected']


class TargetObjectiveSerializer(serializers.ModelSerializer):
    """Full serializer for TargetObjective."""

    class Meta:
        model = TargetObjective
        fields = [
            'id',
            'study',
            'name',
            'description',
            'ref_id',
            'is_selected',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RoToSerializer(serializers.ModelSerializer):
    """Full serializer for RoTo."""
    risk_origin_name = serializers.CharField(source='risk_origin.name', read_only=True)
    target_objective_name = serializers.CharField(source='target_objective.name', read_only=True)
    feared_events = FearedEventListSerializer(many=True, read_only=True)

    class Meta:
        model = RoTo
        fields = [
            'id',
            'study',
            'risk_origin',
            'risk_origin_name',
            'target_objective',
            'target_objective_name',
            'feared_events',
            'pertinence',
            'activity',
            'is_selected',
            'justification',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'pertinence', 'created_at', 'updated_at']

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        instance.calculate_pertinence()
        instance.save()
        return instance


class RoToListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for RoTo lists."""
    risk_origin_name = serializers.CharField(source='risk_origin.name', read_only=True)
    target_objective_name = serializers.CharField(source='target_objective.name', read_only=True)

    class Meta:
        model = RoTo
        fields = [
            'id',
            'risk_origin_name',
            'target_objective_name',
            'pertinence',
            'is_selected',
        ]


class StakeholderSerializer(serializers.ModelSerializer):
    """Full serializer for Stakeholder."""
    current_criticality = serializers.FloatField(read_only=True)
    residual_criticality = serializers.FloatField(read_only=True)

    class Meta:
        model = Stakeholder
        fields = [
            'id',
            'study',
            'name',
            'description',
            'ref_id',
            'category',
            'entity_id',
            'current_dependency',
            'current_penetration',
            'current_maturity',
            'current_trust',
            'residual_dependency',
            'residual_penetration',
            'residual_maturity',
            'residual_trust',
            'applied_control_ids',
            'is_selected',
            'current_criticality',
            'residual_criticality',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class StakeholderListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for stakeholder lists."""
    current_criticality = serializers.FloatField(read_only=True)

    class Meta:
        model = Stakeholder
        fields = [
            'id',
            'name',
            'category',
            'current_criticality',
            'is_selected',
        ]


class ElementaryActionSerializer(serializers.ModelSerializer):
    """Full serializer for ElementaryAction."""

    class Meta:
        model = ElementaryAction
        fields = [
            'id',
            'study',
            'name',
            'description',
            'ref_id',
            'stage',
            'icon_type',
            'threat_id',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ElementaryActionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for elementary action lists."""

    class Meta:
        model = ElementaryAction
        fields = ['id', 'name', 'stage', 'icon_type']


class OperatingModeSerializer(serializers.ModelSerializer):
    """Full serializer for OperatingMode."""
    elementary_actions = ElementaryActionListSerializer(many=True, read_only=True)

    class Meta:
        model = OperatingMode
        fields = [
            'id',
            'operational_scenario',
            'name',
            'description',
            'ref_id',
            'elementary_actions',
            'likelihood',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OperationalScenarioSerializer(serializers.ModelSerializer):
    """Full serializer for OperationalScenario."""
    operating_modes = OperatingModeSerializer(many=True, read_only=True)
    gravity = serializers.IntegerField(read_only=True)
    risk_level = serializers.IntegerField(read_only=True)

    class Meta:
        model = OperationalScenario
        fields = [
            'id',
            'attack_path',
            'name',
            'description',
            'ref_id',
            'likelihood',
            'threat_ids',
            'is_selected',
            'operating_modes',
            'gravity',
            'risk_level',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OperationalScenarioListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for operational scenario lists."""
    risk_level = serializers.IntegerField(read_only=True)

    class Meta:
        model = OperationalScenario
        fields = ['id', 'name', 'ref_id', 'likelihood', 'risk_level', 'is_selected']


class AttackPathSerializer(serializers.ModelSerializer):
    """Full serializer for AttackPath."""
    stakeholders = StakeholderListSerializer(many=True, read_only=True)
    operational_scenarios = OperationalScenarioListSerializer(many=True, read_only=True)

    class Meta:
        model = AttackPath
        fields = [
            'id',
            'strategic_scenario',
            'name',
            'description',
            'ref_id',
            'stakeholders',
            'is_selected',
            'justification',
            'operational_scenarios',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AttackPathListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for attack path lists."""
    stakeholder_count = serializers.SerializerMethodField()

    class Meta:
        model = AttackPath
        fields = ['id', 'name', 'ref_id', 'is_selected', 'stakeholder_count']

    def get_stakeholder_count(self, obj):
        return obj.stakeholders.count()


class StrategicScenarioSerializer(serializers.ModelSerializer):
    """Full serializer for StrategicScenario."""
    roto_display = serializers.SerializerMethodField()
    feared_events = FearedEventListSerializer(many=True, read_only=True)
    attack_paths = AttackPathListSerializer(many=True, read_only=True)

    class Meta:
        model = StrategicScenario
        fields = [
            'id',
            'study',
            'name',
            'description',
            'ref_id',
            'roto',
            'roto_display',
            'feared_events',
            'gravity',
            'is_selected',
            'attack_paths',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_roto_display(self, obj):
        return str(obj.roto)


class StrategicScenarioListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for strategic scenario lists."""

    class Meta:
        model = StrategicScenario
        fields = ['id', 'name', 'ref_id', 'gravity', 'is_selected']
