"""
Serializers for Privacy bounded context
"""

from rest_framework import serializers
from .aggregates.data_asset import DataAsset
from .aggregates.data_flow import DataFlow


class DataAssetSerializer(serializers.ModelSerializer):
    """Serializer for DataAsset aggregate"""

    # Alias fields to match frontend expectations
    status = serializers.CharField(source='lifecycle_state', read_only=True)
    asset_id = serializers.UUIDField(source='id', read_only=True)
    asset_name = serializers.CharField(source='name', read_only=True)
    primary_data_category = serializers.SerializerMethodField()
    sensitivity_level = serializers.SerializerMethodField()
    compliance_status = serializers.SerializerMethodField()
    pia_required = serializers.SerializerMethodField()
    pia_completed = serializers.SerializerMethodField()
    estimated_data_subjects = serializers.SerializerMethodField()

    class Meta:
        model = DataAsset
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'name', 'description',
            'data_categories', 'contains_personal_data', 'retention_policy',
            'lifecycle_state',
            'assetIds', 'ownerOrgUnitIds',
            'tags',
            # Frontend-expected alias fields
            'status', 'asset_id', 'asset_name', 'primary_data_category',
            'sensitivity_level', 'compliance_status', 'pia_required',
            'pia_completed', 'estimated_data_subjects',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

    def get_primary_data_category(self, obj):
        """Return first data category or None"""
        categories = obj.data_categories or []
        return categories[0] if categories else None

    def get_sensitivity_level(self, obj):
        """Derive sensitivity level from contains_personal_data and categories"""
        if obj.contains_personal_data:
            categories = obj.data_categories or []
            if any(cat in ['health', 'financial', 'biometric'] for cat in categories):
                return 'high'
            return 'medium'
        return 'low'

    def get_compliance_status(self, obj):
        """Derive compliance status from lifecycle state"""
        if obj.lifecycle_state == 'active':
            return 'compliant'
        elif obj.lifecycle_state == 'draft':
            return 'pending_review'
        return 'non_compliant'

    def get_pia_required(self, obj):
        """Determine if PIA is required based on personal data"""
        return obj.contains_personal_data

    def get_pia_completed(self, obj):
        """Check if PIA is completed - default False until PIA tracking is added"""
        return False  # TODO: Add PIA tracking to model

    def get_estimated_data_subjects(self, obj):
        """Return estimated data subjects count - placeholder"""
        return 0  # TODO: Add to model or calculate


class DataFlowSerializer(serializers.ModelSerializer):
    """Serializer for DataFlow aggregate"""
    
    class Meta:
        model = DataFlow
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'name', 'description', 'purpose',
            'source_system_asset_id', 'destination_system_asset_id',
            'lifecycle_state',
            'dataAssetIds', 'thirdPartyIds',
            'controlImplementationIds', 'privacyRiskIds',
            'transfer_mechanisms', 'encryption_in_transit',
            'tags',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

