"""API views for connector management."""

import logging

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

logger = logging.getLogger(__name__)


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

            registry = ConnectorRegistry()
            connector_cls = registry.get(instance.connector_type)
            if not connector_cls:
                return Response(
                    {"error": f"Unknown connector type: {instance.connector_type}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            connector = connector_cls(instance.config)
            # Validate config
            errors = connector.validate_config()
            if errors:
                instance.status = "error"
                instance.last_error = "; ".join(errors)
                instance.save()
                return Response(
                    {"success": False, "errors": errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            instance.status = "connected"
            instance.last_error = ""
            instance.save()

            return Response({"success": True, "message": "Connection successful"})
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

        # Create sync execution record
        execution = SyncExecution.objects.create(
            connector_instance=instance,
            trigger="manual",
        )

        try:
            from .base.registry import ConnectorRegistry

            registry = ConnectorRegistry()
            connector_cls = registry.get(instance.connector_type)
            if not connector_cls:
                execution.fail(f"Unknown connector type: {instance.connector_type}")
                return Response(
                    {"error": f"Unknown connector type: {instance.connector_type}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            connector = connector_cls(instance.config)
            results = connector.fetch_data()

            items_fetched = len(results) if isinstance(results, list) else 0
            execution.complete(items_fetched=items_fetched)

            from django.utils import timezone
            instance.last_sync_at = timezone.now()
            instance.status = "connected"
            instance.last_error = ""
            instance.save()

            return Response({
                "execution_id": str(execution.id),
                "status": "completed",
                "items_fetched": items_fetched,
            })
        except Exception as e:
            execution.fail(str(e))
            instance.status = "error"
            instance.last_error = str(e)
            instance.save()
            logger.error(f"Sync failed for {instance.name}: {e}")
            return Response(
                {"execution_id": str(execution.id), "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Get sync execution history for a connector."""
        instance = self.get_object()
        executions = instance.sync_executions.all()[:50]
        serializer = SyncExecutionSerializer(executions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def available_types(self, request):
        """List all available connector types from the registry."""
        try:
            from .base.registry import ConnectorRegistry

            registry = ConnectorRegistry()
            types = []
            for key, cls in registry._connectors.items():
                types.append({
                    "type": key,
                    "name": getattr(cls, "name", key),
                    "category": getattr(cls, "category", "unknown"),
                    "description": getattr(cls, "__doc__", "") or "",
                })
            return Response({"connector_types": types})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SyncExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to sync execution history."""

    queryset = SyncExecution.objects.select_related("connector_instance").all()
    serializer_class = SyncExecutionSerializer
    permission_classes = [IsAuthenticated]
