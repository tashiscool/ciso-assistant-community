"""
Serializers for SecurityOperations bounded context
"""

from rest_framework import serializers
from .aggregates.security_incident import SecurityIncident
from .aggregates.awareness_program import AwarenessProgram
from .associations.awareness_campaign import AwarenessCampaign
from .associations.awareness_completion import AwarenessCompletion


class SecurityIncidentSerializer(serializers.ModelSerializer):
    """Serializer for SecurityIncident aggregate"""

    # Alias fields to match frontend expectations
    status = serializers.CharField(source='lifecycle_state', read_only=True)
    incident_title = serializers.CharField(source='title', read_only=True)
    incident_type = serializers.SerializerMethodField()
    detected_at = serializers.DateTimeField(source='reported_at', read_only=True)
    resolved_at = serializers.DateTimeField(source='closed_at', read_only=True)

    class Meta:
        model = SecurityIncident
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'title', 'description',
            'classification_id',
            'lifecycle_state', 'severity', 'detection_source',
            'affectedAssetIds', 'affectedServiceIds',
            'relatedRiskIds', 'evidenceIds',
            'timeline',
            'reported_at', 'triaged_at', 'contained_at',
            'eradicated_at', 'recovered_at', 'closed_at',
            'tags',
            # Frontend-expected alias fields
            'status', 'incident_title', 'incident_type',
            'detected_at', 'resolved_at',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

    def get_incident_type(self, obj):
        """Derive incident type from classification or detection source"""
        # Map detection source to incident type categories
        source_mapping = {
            'siem': 'security_event',
            'user_report': 'user_reported',
            'automated': 'automated_detection',
        }
        return source_mapping.get(obj.detection_source, 'other')


class AwarenessProgramSerializer(serializers.ModelSerializer):
    """Serializer for AwarenessProgram aggregate"""
    
    class Meta:
        model = AwarenessProgram
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'name', 'description',
            'lifecycle_state',
            'audienceOrgUnitIds', 'policyIds', 'campaignIds',
            'cadence_days',
            'tags',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']


class AwarenessCampaignSerializer(serializers.ModelSerializer):
    """Serializer for AwarenessCampaign association"""
    
    class Meta:
        model = AwarenessCampaign
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'programId', 'name', 'description',
            'lifecycle_state',
            'start_date', 'end_date',
            'targetUserIds', 'completionIds',
            'tags',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']


class AwarenessCompletionSerializer(serializers.ModelSerializer):
    """Serializer for AwarenessCompletion association"""
    
    class Meta:
        model = AwarenessCompletion
        fields = [
            'id', 'version', 'created_at', 'updated_at',
            'campaignId', 'userId',
            'status',
            'completed_at', 'score', 'notes',
        ]
        read_only_fields = ['id', 'version', 'created_at', 'updated_at']

