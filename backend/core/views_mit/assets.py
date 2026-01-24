"""
Asset Views - MIT Licensed

Clean-room implementation of asset management API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q

from ..models_mit import Asset, AssetCategory, AssetClassification, AssetRelationship
from ..serializers_mit import (
    AssetCategorySerializer,
    AssetClassificationSerializer,
    AssetSerializer,
    AssetListSerializer,
    AssetRelationshipSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class AssetCategoryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for asset category management.
    """
    queryset = AssetCategory.objects.all()
    serializer_class = AssetCategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        parent_id = self.request.query_params.get('parent_id')
        if parent_id:
            queryset = queryset.filter(parent_id=parent_id)
        elif self.request.query_params.get('root_only') == 'true':
            queryset = queryset.filter(parent__isnull=True)
        return queryset

    @action(detail=True, methods=['get'])
    def tree(self, request, pk=None):
        """Get category tree structure."""
        category = self.get_object()

        def build_tree(node):
            return {
                'id': str(node.id),
                'name': node.name,
                'icon': node.icon,
                'color': node.color,
                'asset_count': node.assets.count(),
                'children': [build_tree(child) for child in node.children.all()]
            }

        return Response(build_tree(category))


class AssetClassificationViewSet(viewsets.ModelViewSet):
    """
    API endpoint for asset classification management.
    """
    queryset = AssetClassification.objects.all()
    serializer_class = AssetClassificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset.order_by('level')


class AssetViewSet(viewsets.ModelViewSet):
    """
    API endpoint for asset management.
    """
    queryset = Asset.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return AssetListSerializer
        return AssetSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        category_id = self.request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        classification_id = self.request.query_params.get('classification_id')
        if classification_id:
            queryset = queryset.filter(classification_id=classification_id)
        asset_type = self.request.query_params.get('type')
        if asset_type:
            queryset = queryset.filter(asset_type=asset_type)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        criticality = self.request.query_params.get('criticality')
        if criticality:
            queryset = queryset.filter(business_criticality=criticality)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(asset_id__icontains=search) |
                Q(description__icontains=search) |
                Q(serial_number__icontains=search)
            )
        return queryset

    @action(detail=True, methods=['get'])
    def dependencies(self, request, pk=None):
        """Get asset dependencies."""
        asset = self.get_object()
        dependencies = asset.depends_on.all()
        serializer = AssetListSerializer(dependencies, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def dependents(self, request, pk=None):
        """Get assets that depend on this asset."""
        asset = self.get_object()
        dependents = asset.dependents.all()
        serializer = AssetListSerializer(dependents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def impact_chain(self, request, pk=None):
        """Get full dependency impact chain."""
        asset = self.get_object()

        # Get all dependents recursively
        all_dependents = asset.get_all_dependents()

        return Response({
            'asset': {
                'id': str(asset.id),
                'name': asset.name,
                'business_criticality': asset.business_criticality,
            },
            'impact_chain': [
                {
                    'id': str(a.id),
                    'name': a.name,
                    'business_criticality': a.business_criticality,
                }
                for a in all_dependents
            ],
            'total_impacted': len(all_dependents),
        })

    @action(detail=True, methods=['get'])
    def relationships(self, request, pk=None):
        """Get all relationships for an asset."""
        asset = self.get_object()
        outgoing = AssetRelationship.objects.filter(source_asset=asset)
        incoming = AssetRelationship.objects.filter(target_asset=asset)

        return Response({
            'outgoing': AssetRelationshipSerializer(outgoing, many=True).data,
            'incoming': AssetRelationshipSerializer(incoming, many=True).data,
        })

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get asset statistics."""
        queryset = self.get_queryset()
        stats = {
            'total': queryset.count(),
            'active': queryset.filter(status='active').count(),
            'by_type': list(
                queryset.values('asset_type')
                .annotate(count=Count('id'))
                .order_by('asset_type')
            ),
            'by_status': list(
                queryset.values('status')
                .annotate(count=Count('id'))
                .order_by('status')
            ),
            'by_criticality': list(
                queryset.values('business_criticality')
                .annotate(count=Count('id'))
                .order_by('business_criticality')
            ),
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def critical(self, request):
        """Get critical assets."""
        queryset = self.get_queryset()
        critical = queryset.filter(
            business_criticality='critical',
            status='active'
        )
        serializer = AssetListSerializer(critical, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def end_of_life(self, request):
        """Get assets approaching end of life."""
        from django.utils import timezone
        from datetime import timedelta

        queryset = self.get_queryset()
        today = timezone.now().date()
        eol_soon = queryset.filter(
            end_of_life_date__lte=today + timedelta(days=90),
            end_of_life_date__gte=today,
            status='active'
        ).order_by('end_of_life_date')
        serializer = AssetListSerializer(eol_soon, many=True)
        return Response(serializer.data)


class AssetRelationshipViewSet(viewsets.ModelViewSet):
    """
    API endpoint for asset relationship management.
    """
    queryset = AssetRelationship.objects.all()
    serializer_class = AssetRelationshipSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        source_id = self.request.query_params.get('source_asset_id')
        if source_id:
            queryset = queryset.filter(source_asset_id=source_id)
        target_id = self.request.query_params.get('target_asset_id')
        if target_id:
            queryset = queryset.filter(target_asset_id=target_id)
        rel_type = self.request.query_params.get('type')
        if rel_type:
            queryset = queryset.filter(relationship_type=rel_type)
        return queryset
