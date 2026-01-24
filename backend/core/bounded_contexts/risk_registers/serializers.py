"""
Serializers for Risk Registers bounded context
"""

from rest_framework import serializers
from .aggregates.asset_risk import AssetRisk
from .aggregates.third_party_risk import ThirdPartyRisk
from .aggregates.business_risk import BusinessRisk
from .supporting_entities.risk_treatment_plan import RiskTreatmentPlan
from .supporting_entities.risk_exception import RiskException


class AssetRiskSerializer(serializers.ModelSerializer):
    """Serializer for AssetRisk aggregate"""

    # Alias fields to match frontend expectations
    status = serializers.CharField(source='lifecycle_state', read_only=True)
    risk_title = serializers.CharField(source='title', read_only=True)
    risk_level = serializers.SerializerMethodField()
    calculated_risk_score = serializers.SerializerMethodField()

    class Meta:
        model = AssetRisk
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'title', 'description', 'threat', 'vulnerability',
            'lifecycle_state',
            'assetIds', 'controlImplementationIds', 'exceptionIds', 'relatedRiskIds',
            'scoring', 'treatmentPlanId',
            'tags',
            # Frontend-expected alias fields
            'status', 'risk_title', 'risk_level', 'calculated_risk_score',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

    def get_risk_level(self, obj):
        """Derive risk level from scoring"""
        scoring = obj.scoring or {}
        score = scoring.get('inherent_score', 0)
        if score >= 8:
            return 'critical'
        elif score >= 6:
            return 'high'
        elif score >= 4:
            return 'medium'
        return 'low'

    def get_calculated_risk_score(self, obj):
        """Extract numeric score from scoring object"""
        scoring = obj.scoring or {}
        return scoring.get('inherent_score', 0)


class ThirdPartyRiskSerializer(serializers.ModelSerializer):
    """Serializer for ThirdPartyRisk aggregate"""

    class Meta:
        model = ThirdPartyRisk
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'title', 'description',
            'lifecycle_state',
            'thirdPartyIds', 'serviceIds', 'controlImplementationIds',
            'assessmentRunIds', 'exceptionIds',
            'scoring', 'treatmentPlanId',
            'tags',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']


class BusinessRiskSerializer(serializers.ModelSerializer):
    """Serializer for BusinessRisk aggregate"""

    class Meta:
        model = BusinessRisk
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'title', 'description',
            'lifecycle_state',
            'processIds', 'orgUnitIds', 'controlImplementationIds', 'exceptionIds',
            'scoring', 'treatmentPlanId',
            'tags',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']


class RiskTreatmentPlanSerializer(serializers.ModelSerializer):
    """Serializer for RiskTreatmentPlan supporting entity"""
    
    class Meta:
        model = RiskTreatmentPlan
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'riskId', 'name', 'description',
            'strategy', 'lifecycle_state',
            'tasks', 'started_at', 'completed_at',
            'tags',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']


class RiskExceptionSerializer(serializers.ModelSerializer):
    """Serializer for RiskException supporting entity"""
    
    class Meta:
        model = RiskException
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'riskId', 'reason', 'description',
            'lifecycle_state',
            'approved_by_user_id', 'approved_at',
            'expires_at',
            'tags',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

