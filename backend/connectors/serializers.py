"""Serializers for connector management API."""

from rest_framework import serializers
from .models import ConnectorInstance, SyncExecution


class ConnectorInstanceSerializer(serializers.ModelSerializer):
    last_sync_status = serializers.SerializerMethodField()

    class Meta:
        model = ConnectorInstance
        fields = [
            "id", "connector_type", "name", "description", "is_active",
            "config", "sync_interval_minutes", "last_sync_at", "next_sync_at",
            "status", "last_error", "created_at", "updated_at", "last_sync_status",
        ]
        read_only_fields = ["id", "last_sync_at", "next_sync_at", "status", "last_error", "created_at", "updated_at"]

    def get_last_sync_status(self, obj):
        last = obj.sync_executions.first()
        if last:
            return {
                "id": str(last.id),
                "status": last.status,
                "started_at": last.started_at.isoformat() if last.started_at else None,
                "items_fetched": last.items_fetched,
            }
        return None


class ConnectorInstanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConnectorInstance
        fields = ["connector_type", "name", "description", "config", "sync_interval_minutes"]


class SyncExecutionSerializer(serializers.ModelSerializer):
    connector_name = serializers.CharField(source="connector_instance.name", read_only=True)

    class Meta:
        model = SyncExecution
        fields = [
            "id", "connector_instance", "connector_name", "status",
            "started_at", "completed_at", "items_fetched", "items_created",
            "items_updated", "items_skipped", "errors", "trigger", "duration_seconds",
        ]
        read_only_fields = fields
