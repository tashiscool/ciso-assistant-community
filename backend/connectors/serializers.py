"""Serializers for connector management API."""

from rest_framework import serializers
from .models import ConnectorInstance, SyncExecution


class ConnectorInstanceSerializer(serializers.ModelSerializer):
    # Frontend-compatible aliases
    last_sync = serializers.SerializerMethodField()
    next_sync = serializers.SerializerMethodField()
    error_message = serializers.SerializerMethodField()
    total_syncs = serializers.SerializerMethodField()
    successful_syncs = serializers.SerializerMethodField()
    sync_frequency = serializers.SerializerMethodField()
    last_sync_status = serializers.SerializerMethodField()

    class Meta:
        model = ConnectorInstance
        fields = [
            "id", "connector_type", "name", "description", "is_active",
            "config", "sync_interval_minutes", "last_sync_at", "next_sync_at",
            "status", "last_error", "created_at", "updated_at",
            # frontend-compatible fields
            "last_sync", "next_sync", "error_message",
            "total_syncs", "successful_syncs", "sync_frequency",
            "last_sync_status",
        ]
        read_only_fields = ["id", "last_sync_at", "next_sync_at", "status", "last_error", "created_at", "updated_at"]

    def get_last_sync(self, obj):
        return obj.last_sync_at.isoformat() if obj.last_sync_at else None

    def get_next_sync(self, obj):
        return obj.next_sync_at.isoformat() if obj.next_sync_at else None

    def get_error_message(self, obj):
        return obj.last_error or None

    def get_total_syncs(self, obj):
        return obj.sync_executions.count()

    def get_successful_syncs(self, obj):
        return obj.sync_executions.filter(status="completed").count()

    def get_sync_frequency(self, obj):
        minutes = obj.sync_interval_minutes
        if not minutes:
            return "Manual"
        if minutes < 60:
            return f"Every {minutes}m"
        hours = minutes // 60
        if hours < 24:
            return f"Every {hours}h"
        days = hours // 24
        return f"Every {days}d"

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
