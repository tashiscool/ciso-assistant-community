"""
Serializers for Privacy bounded context
"""

from rest_framework import serializers
from .aggregates.data_asset import DataAsset
from .aggregates.data_flow import DataFlow
from privacy.models.consent_record import ConsentRecord
from privacy.models.data_subject_right import DataSubjectRight


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
    estimated_data_subjects = serializers.IntegerField(read_only=True)

    class Meta:
        model = DataAsset
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'name', 'description',
            'data_categories', 'contains_personal_data', 'retention_policy',
            'lifecycle_state',
            'assetIds', 'ownerOrgUnitIds',
            # PIA fields
            'pia_completed_at', 'pia_ref_id', 'estimated_data_subjects',
            'tags',
            # Frontend-expected alias fields
            'status', 'asset_id', 'asset_name', 'primary_data_category',
            'sensitivity_level', 'compliance_status', 'pia_required',
            'pia_completed',
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
        """Check if PIA is completed based on pia_completed_at timestamp"""
        return obj.pia_completed_at is not None


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


class ConsentRecordSerializer(serializers.ModelSerializer):
    """Serializer for ConsentRecord aggregate"""

    # Alias fields to match frontend expectations
    processing_purposes_count = serializers.SerializerMethodField()
    is_valid_consent = serializers.SerializerMethodField()

    class Meta:
        model = ConsentRecord
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'consent_id', 'data_subject_id', 'data_subject_type',
            'consent_method', 'consent_date', 'valid_until',
            'status', 'withdrawn', 'withdrawal_date',
            'processing_purposes', 'related_data_assets',
            'consent_text', 'consent_language',
            'tags',
            # Frontend-expected alias fields
            'processing_purposes_count', 'is_valid_consent',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

    def get_processing_purposes_count(self, obj):
        """Return count of processing purposes"""
        return len(obj.processing_purposes or [])

    def get_is_valid_consent(self, obj):
        """Check if consent is still valid"""
        return obj.is_valid


class DataSubjectRightSerializer(serializers.ModelSerializer):
    """Serializer for DataSubjectRight aggregate"""

    # Alias fields to match frontend expectations
    is_overdue_flag = serializers.SerializerMethodField()
    days_until_due = serializers.SerializerMethodField()

    class Meta:
        model = DataSubjectRight
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'request_id', 'data_subject_id', 'contact_email',
            'primary_right', 'request_description', 'priority',
            'status',
            'received_date', 'due_date', 'completion_date',
            'assigned_to_user_id',
            'related_data_assets', 'data_located',
            'response_summary', 'rejection_reason',
            'tags',
            # Frontend-expected alias fields
            'is_overdue_flag', 'days_until_due',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

    def get_is_overdue_flag(self, obj):
        """Check if the request is overdue"""
        return obj.is_overdue

    def get_days_until_due(self, obj):
        """Get number of days until due date"""
        return obj.days_to_due

