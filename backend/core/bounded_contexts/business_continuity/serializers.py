"""
Serializers for BusinessContinuity bounded context
"""

from rest_framework import serializers
from .aggregates.business_continuity_plan import BusinessContinuityPlan
from .supporting_entities.bcp_task import BcpTask
from .supporting_entities.bcp_audit import BcpAudit


class BusinessContinuityPlanSerializer(serializers.ModelSerializer):
    """Serializer for BusinessContinuityPlan aggregate"""

    # Alias fields to match frontend expectations
    status = serializers.CharField(source='lifecycle_state', read_only=True)
    plan_name = serializers.CharField(source='name', read_only=True)
    last_test_date = serializers.SerializerMethodField()
    last_test_result = serializers.SerializerMethodField()
    business_impact = serializers.SerializerMethodField()

    class Meta:
        model = BusinessContinuityPlan
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'name', 'description',
            'lifecycle_state',
            'orgUnitIds', 'processIds', 'assetIds', 'serviceIds',
            'taskIds', 'auditIds',
            'tags',
            # Frontend-expected alias fields
            'status', 'plan_name', 'last_test_date',
            'last_test_result', 'business_impact',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

    def get_last_test_date(self, obj):
        """Get the most recent audit date as last test date"""
        # Check for optimized data from view context (list optimization)
        optimized_data = self.context.get("optimized_data")
        if optimized_data:
            audit_data = optimized_data.get("latest_audits", {}).get(obj.id)
            if audit_data:
                return audit_data.get("performed_at")

        # Fallback: query for latest audit by bcpId
        latest_audit = BcpAudit.objects.filter(
            bcpId=obj.id,
            performed_at__isnull=False
        ).order_by('-performed_at').first()

        return latest_audit.performed_at if latest_audit else None

    def get_last_test_result(self, obj):
        """Get the most recent audit outcome as last test result"""
        # Check for optimized data from view context
        optimized_data = self.context.get("optimized_data")
        if optimized_data:
            audit_data = optimized_data.get("latest_audits", {}).get(obj.id)
            if audit_data:
                return audit_data.get("outcome")

        # Fallback: query for latest audit with outcome by bcpId
        latest_audit = BcpAudit.objects.filter(
            bcpId=obj.id,
            outcome__isnull=False
        ).order_by('-performed_at').first()

        return latest_audit.outcome if latest_audit else None

    def get_business_impact(self, obj):
        """Derive business impact from linked services/assets count"""
        # Simple heuristic: more linked services/assets = higher impact
        total_linked = len(obj.serviceIds or []) + len(obj.assetIds or [])

        if total_linked >= 10:
            return 'critical'
        elif total_linked >= 5:
            return 'high'
        elif total_linked >= 2:
            return 'medium'
        return 'low'


class BcpTaskSerializer(serializers.ModelSerializer):
    """Serializer for BcpTask supporting entity"""
    
    class Meta:
        model = BcpTask
        fields = [
            'id', 'created_at', 'updated_at',
            'bcpId', 'title', 'description',
            'lifecycle_state',
            'owner_user_id', 'due_date',
            'evidenceIds',
            'tags',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BcpAuditSerializer(serializers.ModelSerializer):
    """Serializer for BcpAudit supporting entity"""
    
    class Meta:
        model = BcpAudit
        fields = [
            'id', 'created_at', 'updated_at',
            'bcpId', 'name', 'description',
            'lifecycle_state',
            'performed_at', 'outcome', 'notes',
            'evidenceIds',
            'tags',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

