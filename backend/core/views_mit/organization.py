"""
Organization Views - MIT Licensed

Clean-room implementation of organization API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q

from ..models_mit import Organization, Domain, Perimeter, OrganizationalUnit
from ..serializers_mit import (
    OrganizationSerializer,
    OrganizationListSerializer,
    DomainSerializer,
    DomainListSerializer,
    PerimeterSerializer,
    OrganizationalUnitSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    API endpoint for organization management.
    """
    queryset = Organization.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return OrganizationListSerializer
        return OrganizationSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if not self.request.user.is_staff:
            # Filter to user's organizations
            org_id = getattr(self.request.user, 'primary_organization_id', None)
            if org_id:
                queryset = queryset.filter(id=org_id)
        return queryset.filter(is_active=True)

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get organization statistics."""
        org = self.get_object()
        stats = {
            'domains': org.domains.count(),
            'perimeters': org.perimeters.count(),
            'assets': getattr(org, 'assets', org.domains).count(),
            'risk_scenarios': getattr(org, 'risk_scenarios', org.domains).count(),
            'policies': getattr(org, 'policies', org.domains).count(),
            'audits': getattr(org, 'audits', org.domains).count(),
        }
        return Response(stats)


class DomainViewSet(viewsets.ModelViewSet):
    """
    API endpoint for domain management.
    """
    queryset = Domain.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return DomainListSerializer
        return DomainSerializer

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
        return queryset.filter(is_active=True)

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['get'])
    def tree(self, request, pk=None):
        """Get domain and all descendants as a tree."""
        domain = self.get_object()

        def build_tree(node):
            return {
                'id': str(node.id),
                'name': node.name,
                'color': node.color,
                'icon': node.icon,
                'children': [build_tree(child) for child in node.children.filter(is_active=True)]
            }

        return Response(build_tree(domain))

    @action(detail=True, methods=['get'])
    def ancestors(self, request, pk=None):
        """Get all ancestor domains."""
        domain = self.get_object()
        ancestors = domain.get_ancestors()
        serializer = DomainListSerializer(ancestors, many=True)
        return Response(serializer.data)


class PerimeterViewSet(viewsets.ModelViewSet):
    """
    API endpoint for perimeter management.
    """
    queryset = Perimeter.objects.all()
    serializer_class = PerimeterSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        perimeter_type = self.request.query_params.get('type')
        if perimeter_type:
            queryset = queryset.filter(perimeter_type=perimeter_type)
        return queryset


class OrganizationalUnitViewSet(viewsets.ModelViewSet):
    """
    API endpoint for organizational unit management.
    """
    queryset = OrganizationalUnit.objects.all()
    serializer_class = OrganizationalUnitSerializer
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
