"""
Connector Management API

REST API for managing connector configurations and sync operations.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from .base.registry import get_registry


class ConnectorRegistryView(APIView):
    """
    View to list available connector types from the registry.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all available connector types."""
        registry = get_registry()
        connectors = []

        for connector_type, metadata in registry.get_metadata().items():
            connectors.append({
                'type': connector_type,
                'name': metadata.get('name', connector_type),
                'category': metadata.get('category', 'unknown'),
                'description': metadata.get('description', ''),
                'auth_methods': metadata.get('auth_methods', ['api_key']),
                'icon': metadata.get('icon', 'fa-plug'),
            })

        return Response({
            'connectors': connectors,
            'count': len(connectors)
        })


class ConnectorConfigViewSet(viewsets.ViewSet):
    """
    ViewSet for managing connector configurations.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List all configured connectors."""
        # For now, return mock data - in production this would query the database
        return Response({
            'results': [],
            'count': 0
        })

    def create(self, request):
        """Create a new connector configuration."""
        data = request.data

        # Validate connector type exists
        registry = get_registry()
        connector_type = data.get('connector_type')

        if connector_type not in registry.get_metadata():
            return Response({
                'error': f'Unknown connector type: {connector_type}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # In production, save to database
        return Response({
            'id': 'new-connector-id',
            'name': data.get('name'),
            'connector_type': connector_type,
            'status': 'idle',
            'message': 'Connector created successfully'
        }, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        """Get a specific connector configuration."""
        return Response({
            'id': pk,
            'name': 'Sample Connector',
            'connector_type': 'snyk',
            'status': 'idle'
        })

    def destroy(self, request, pk=None):
        """Delete a connector configuration."""
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """Trigger a sync for the connector."""
        return Response({
            'id': pk,
            'status': 'syncing',
            'message': 'Sync started'
        })

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test the connector connection."""
        return Response({
            'id': pk,
            'success': True,
            'message': 'Connection test successful'
        })


class ConnectorSyncHistoryViewSet(viewsets.ViewSet):
    """
    ViewSet for viewing connector sync history.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List sync history for all connectors or a specific connector."""
        connector_id = request.query_params.get('connector_id')
        return Response({
            'results': [],
            'count': 0
        })

    def retrieve(self, request, pk=None):
        """Get details of a specific sync execution."""
        return Response({
            'id': pk,
            'connector_id': 'connector-1',
            'status': 'completed',
            'started_at': '2024-01-01T00:00:00Z',
            'completed_at': '2024-01-01T00:05:00Z',
            'records_synced': 100,
            'errors': []
        })
