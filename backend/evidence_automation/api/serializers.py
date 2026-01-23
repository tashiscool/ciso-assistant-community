"""
Evidence Automation API Serializers
"""

from rest_framework import serializers
from ..models import EvidenceSource, EvidenceCollectionRule, EvidenceCollectionRun


class EvidenceSourceSerializer(serializers.ModelSerializer):
    """Serializer for EvidenceSource model."""

    source_type_display = serializers.CharField(
        source='get_source_type_display',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    rules_count = serializers.SerializerMethodField()

    class Meta:
        model = EvidenceSource
        fields = [
            'id', 'name', 'description', 'source_type', 'source_type_display',
            'status', 'status_display', 'config', 'collection_enabled',
            'collection_schedule', 'last_collection_at', 'last_collection_status',
            'last_error', 'rules_count', 'created_at', 'updated_at', 'folder'
        ]
        read_only_fields = [
            'id', 'last_collection_at', 'last_collection_status', 'last_error',
            'created_at', 'updated_at'
        ]

    def get_rules_count(self, obj):
        return obj.collection_rules.count()


class EvidenceSourceWriteSerializer(serializers.ModelSerializer):
    """Write serializer for EvidenceSource with config handling."""

    class Meta:
        model = EvidenceSource
        fields = [
            'id', 'name', 'description', 'source_type', 'config',
            'collection_enabled', 'collection_schedule', 'folder'
        ]

    def validate_config(self, value):
        """Validate config based on source type."""
        source_type = self.initial_data.get('source_type')

        required_fields = {
            'aws': ['access_key_id', 'secret_access_key', 'region'],
            'azure': ['tenant_id', 'client_id', 'client_secret'],
            'azure_ad': ['tenant_id', 'client_id', 'client_secret'],
            'github': ['access_token'],
            'api': ['base_url'],
        }

        if source_type in required_fields:
            missing = [f for f in required_fields[source_type] if f not in value or not value[f]]
            if missing:
                raise serializers.ValidationError(
                    f"Missing required fields for {source_type}: {', '.join(missing)}"
                )

        return value


class EvidenceCollectionRuleSerializer(serializers.ModelSerializer):
    """Serializer for EvidenceCollectionRule model."""

    source_name = serializers.CharField(source='source.name', read_only=True)
    collection_type_display = serializers.CharField(
        source='get_collection_type_display',
        read_only=True
    )
    last_run = serializers.SerializerMethodField()

    class Meta:
        model = EvidenceCollectionRule
        fields = [
            'id', 'source', 'source_name', 'name', 'description',
            'collection_type', 'collection_type_display', 'query', 'parameters',
            'target_controls', 'target_requirements', 'enabled', 'schedule',
            'retention_days', 'last_run', 'created_at', 'updated_at', 'folder'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_last_run(self, obj):
        last_run = obj.runs.order_by('-created_at').first()
        if last_run:
            return {
                'id': str(last_run.id),
                'status': last_run.status,
                'started_at': last_run.started_at.isoformat() if last_run.started_at else None,
                'items_collected': last_run.items_collected,
            }
        return None


class EvidenceCollectionRunSerializer(serializers.ModelSerializer):
    """Serializer for EvidenceCollectionRun model."""

    rule_name = serializers.CharField(source='rule.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = EvidenceCollectionRun
        fields = [
            'id', 'rule', 'rule_name', 'status', 'status_display',
            'started_at', 'completed_at', 'evidence_created',
            'items_collected', 'error_message', 'run_log', 'created_at'
        ]
        read_only_fields = '__all__'


class TestConnectionSerializer(serializers.Serializer):
    """Serializer for connection test requests."""

    source_type = serializers.ChoiceField(choices=EvidenceSource.SourceType.choices)
    config = serializers.JSONField()


class RunCollectionSerializer(serializers.Serializer):
    """Serializer for manual collection run requests."""

    dry_run = serializers.BooleanField(default=False)
