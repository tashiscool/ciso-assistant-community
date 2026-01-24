"""
Serializers for ThirdPartyManagement bounded context
"""

from rest_framework import serializers
from .aggregates.third_party import ThirdParty


class ThirdPartySerializer(serializers.ModelSerializer):
    """Serializer for ThirdParty aggregate"""

    # Alias fields to match frontend expectations
    status = serializers.CharField(source='lifecycle_state', read_only=True)
    entity_name = serializers.CharField(source='name', read_only=True)
    entity_type = serializers.SerializerMethodField()
    risk_level = serializers.SerializerMethodField()
    compliance_status = serializers.SerializerMethodField()
    contract_status = serializers.SerializerMethodField()

    class Meta:
        model = ThirdParty
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'name', 'description',
            'criticality', 'lifecycle_state',
            'serviceIds', 'contractIds',
            'assessmentRunIds', 'riskIds', 'controlImplementationIds',
            'tags',
            # Frontend-expected alias fields
            'status', 'entity_name', 'entity_type',
            'risk_level', 'compliance_status', 'contract_status',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

    def get_entity_type(self, obj):
        """Derive entity type - default to vendor"""
        # TODO: Add entity_type field to model
        return 'vendor'

    def get_risk_level(self, obj):
        """Map criticality to risk level"""
        criticality_mapping = {
            'critical': 'critical',
            'high': 'high',
            'medium': 'medium',
            'low': 'low',
        }
        return criticality_mapping.get(obj.criticality, 'medium')

    def get_compliance_status(self, obj):
        """Derive compliance status from lifecycle state and assessments"""
        if obj.lifecycle_state == 'active':
            # Check if has completed assessments
            if obj.assessmentRunIds:
                return 'compliant'
            return 'under_review'
        return 'non_compliant'

    def get_contract_status(self, obj):
        """Derive contract status from lifecycle state"""
        if obj.lifecycle_state == 'active':
            return 'active'
        elif obj.lifecycle_state == 'offboarding':
            return 'expiring_soon'
        return 'expired'

