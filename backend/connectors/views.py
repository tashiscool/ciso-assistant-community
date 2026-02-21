"""API views for connector management."""

import logging

from asgiref.sync import async_to_sync
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ConnectorInstance, SyncExecution
from .serializers import (
    ConnectorInstanceSerializer,
    ConnectorInstanceCreateSerializer,
    SyncExecutionSerializer,
)
from .base.connector import ConnectorConfig

logger = logging.getLogger(__name__)


def _build_config(instance: ConnectorInstance) -> ConnectorConfig:
    """
    Build a ConnectorConfig dataclass from a ConnectorInstance model.
    The model stores auth fields inside the `config` JSON field as:
      { "auth_method": "api_key", "api_key": "..." }
    """
    cfg = instance.config or {}
    return ConnectorConfig(
        connector_type=instance.connector_type,
        name=instance.name,
        auth_type=cfg.get("auth_method", "api_key"),
        credentials={k: v for k, v in cfg.items() if k != "auth_method"},
    )


class ConnectorInstanceViewSet(viewsets.ModelViewSet):
    """CRUD and operations for connector instances."""

    queryset = ConnectorInstance.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return ConnectorInstanceCreateSerializer
        return ConnectorInstanceSerializer

    @action(detail=True, methods=["post"])
    def test_connection(self, request, pk=None):
        """Test connectivity for a connector instance."""
        instance = self.get_object()
        try:
            from .base.registry import ConnectorRegistry

            connector_cls = ConnectorRegistry().get(instance.connector_type)
            if not connector_cls:
                return Response(
                    {"error": f"Unknown connector type: {instance.connector_type}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            connector = connector_cls(_build_config(instance))

            # validate_config() and test_connection() are async — bridge to sync context
            validate_result = async_to_sync(connector.validate_config)()
            if not validate_result.success:
                instance.status = "error"
                instance.last_error = validate_result.error_message or "Config validation failed"
                instance.save()
                return Response(
                    {"success": False, "errors": [instance.last_error]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            test_result = async_to_sync(connector.test_connection)()
            if test_result.success:
                instance.status = "connected"
                instance.last_error = ""
                instance.save()
                return Response({"success": True, "message": "Connection successful"})

            instance.status = "error"
            instance.last_error = test_result.error_message or "Connection test failed"
            instance.save()
            return Response(
                {"success": False, "error": instance.last_error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            instance.status = "error"
            instance.last_error = str(e)
            instance.save()
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def sync(self, request, pk=None):
        """Trigger a manual sync for a connector instance."""
        instance = self.get_object()

        if not instance.is_active:
            return Response(
                {"error": "Connector is not active"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        execution = SyncExecution.objects.create(
            connector_instance=instance,
            trigger="manual",
        )

        try:
            from .base.registry import ConnectorRegistry

            connector_cls = ConnectorRegistry().get(instance.connector_type)
            if not connector_cls:
                execution.fail(f"Unknown connector type: {instance.connector_type}")
                return Response(
                    {"error": f"Unknown connector type: {instance.connector_type}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            connector = connector_cls(_build_config(instance))

            # connector.sync() runs authenticate → fetch_data → transform_data (all async)
            sync_result = async_to_sync(connector.sync)()

            items_fetched = sync_result.items_processed if sync_result.success else 0
            if sync_result.success:
                execution.complete(items_fetched=items_fetched)
            else:
                execution.fail(sync_result.error_message or "Sync failed")

            from django.utils import timezone

            instance.last_sync_at = timezone.now()
            instance.status = "connected" if sync_result.success else "error"
            instance.last_error = "" if sync_result.success else (sync_result.error_message or "")
            instance.save()

            if sync_result.success:
                return Response({
                    "execution_id": str(execution.id),
                    "status": "completed",
                    "items_fetched": items_fetched,
                })
            return Response(
                {"execution_id": str(execution.id), "error": sync_result.error_message},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        except Exception as e:
            execution.fail(str(e))
            instance.status = "error"
            instance.last_error = str(e)
            instance.save()
            logger.error("Sync failed for %s: %s", instance.name, e)
            return Response(
                {"execution_id": str(execution.id), "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Get sync execution history for a connector."""
        instance = self.get_object()
        executions = instance.sync_executions.all()[:50]
        return Response(SyncExecutionSerializer(executions, many=True).data)

    @action(detail=False, methods=["get"])
    def available_types(self, request):
        """List all available connector types from the registry."""
        try:
            from .base.registry import ConnectorRegistry

            registry = ConnectorRegistry()
            types = [
                {
                    "type": key,
                    "name": getattr(cls, "display_name", key),
                    "category": getattr(cls, "category", "unknown"),
                    "description": getattr(cls, "description", "") or "",
                }
                for key, cls in registry._connectors.items()
            ]
            return Response({"connector_types": types})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SyncExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to sync execution history."""

    queryset = SyncExecution.objects.select_related("connector_instance").all()
    serializer_class = SyncExecutionSerializer
    permission_classes = [IsAuthenticated]
