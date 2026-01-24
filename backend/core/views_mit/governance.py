"""
Governance Views - MIT Licensed

Clean-room implementation of governance API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from django.utils import timezone

from ..models_mit import (
    Framework,
    ControlFamily,
    Control,
    Policy,
    Procedure,
    AppliedControl,
)
from ..serializers_mit import (
    FrameworkSerializer,
    FrameworkListSerializer,
    ControlFamilySerializer,
    ControlSerializer,
    ControlListSerializer,
    PolicySerializer,
    PolicyListSerializer,
    ProcedureSerializer,
    AppliedControlSerializer,
    AppliedControlListSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class FrameworkViewSet(viewsets.ModelViewSet):
    """
    API endpoint for framework management.
    """
    queryset = Framework.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return FrameworkListSerializer
        return FrameworkSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        published_only = self.request.query_params.get('published') == 'true'
        if published_only:
            queryset = queryset.filter(is_published=True)
        return queryset

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a framework."""
        framework = self.get_object()
        framework.is_published = True
        framework.published_at = timezone.now()
        framework.save()
        return Response({'message': 'Framework published'})

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """Unpublish a framework."""
        framework = self.get_object()
        framework.is_published = False
        framework.save()
        return Response({'message': 'Framework unpublished'})

    @action(detail=True, methods=['get'])
    def controls(self, request, pk=None):
        """Get all controls for a framework."""
        framework = self.get_object()
        controls = framework.controls.all()
        serializer = ControlListSerializer(controls, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def structure(self, request, pk=None):
        """Get framework structure (families and controls)."""
        framework = self.get_object()

        def build_control_tree(parent=None):
            controls = framework.controls.filter(parent=parent).order_by('order')
            return [
                {
                    'id': str(c.id),
                    'control_id': c.control_id,
                    'name': c.name,
                    'category': c.category,
                    'children': build_control_tree(c)
                }
                for c in controls
            ]

        families = framework.control_families.filter(parent__isnull=True).order_by('order')
        structure = [
            {
                'id': str(f.id),
                'family_id': f.family_id,
                'name': f.name,
                'controls': [
                    {
                        'id': str(c.id),
                        'control_id': c.control_id,
                        'name': c.name,
                        'children': build_control_tree(c)
                    }
                    for c in f.controls.filter(parent__isnull=True).order_by('order')
                ]
            }
            for f in families
        ]

        return Response(structure)


class ControlFamilyViewSet(viewsets.ModelViewSet):
    """
    API endpoint for control family management.
    """
    queryset = ControlFamily.objects.all()
    serializer_class = ControlFamilySerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        framework_id = self.request.query_params.get('framework_id')
        if framework_id:
            queryset = queryset.filter(framework_id=framework_id)
        return queryset.order_by('order')


class ControlViewSet(viewsets.ModelViewSet):
    """
    API endpoint for control management.
    """
    queryset = Control.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return ControlListSerializer
        return ControlSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        framework_id = self.request.query_params.get('framework_id')
        if framework_id:
            queryset = queryset.filter(framework_id=framework_id)
        family_id = self.request.query_params.get('family_id')
        if family_id:
            queryset = queryset.filter(family_id=family_id)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(control_id__icontains=search) |
                Q(name__icontains=search) |
                Q(description__icontains=search)
            )
        return queryset.order_by('order')

    @action(detail=True, methods=['get'])
    def implementations(self, request, pk=None):
        """Get all implementations of this control."""
        control = self.get_object()
        implementations = control.implementations.all()
        serializer = AppliedControlListSerializer(implementations, many=True)
        return Response(serializer.data)


class PolicyViewSet(viewsets.ModelViewSet):
    """
    API endpoint for policy management.
    """
    queryset = Policy.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return PolicyListSerializer
        return PolicySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        policy_type = self.request.query_params.get('type')
        if policy_type:
            queryset = queryset.filter(policy_type=policy_type)
        published_only = self.request.query_params.get('published') == 'true'
        if published_only:
            queryset = queryset.filter(is_published=True)
        return queryset

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a policy."""
        policy = self.get_object()
        policy.is_published = True
        policy.published_at = timezone.now()
        policy.save()
        return Response({'message': 'Policy published'})

    @action(detail=False, methods=['get'])
    def due_for_review(self, request):
        """Get policies due for review."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        due = queryset.filter(review_date__lte=today).order_by('review_date')
        serializer = PolicyListSerializer(due, many=True)
        return Response(serializer.data)


class ProcedureViewSet(viewsets.ModelViewSet):
    """
    API endpoint for procedure management.
    """
    queryset = Procedure.objects.all()
    serializer_class = ProcedureSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        policy_id = self.request.query_params.get('policy_id')
        if policy_id:
            queryset = queryset.filter(policy_id=policy_id)
        return queryset


class AppliedControlViewSet(viewsets.ModelViewSet):
    """
    API endpoint for applied control management.
    """
    queryset = AppliedControl.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return AppliedControlListSerializer
        return AppliedControlSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        control_id = self.request.query_params.get('control_id')
        if control_id:
            queryset = queryset.filter(control_id=control_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(implementation_status=status_filter)
        effectiveness = self.request.query_params.get('effectiveness')
        if effectiveness:
            queryset = queryset.filter(effectiveness=effectiveness)
        return queryset

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get implementation statistics."""
        queryset = self.get_queryset()
        stats = {
            'total': queryset.count(),
            'by_status': list(
                queryset.values('implementation_status')
                .annotate(count=Count('id'))
                .order_by('implementation_status')
            ),
            'by_effectiveness': list(
                queryset.values('effectiveness')
                .annotate(count=Count('id'))
                .order_by('effectiveness')
            ),
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def due_for_assessment(self, request):
        """Get controls due for assessment."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        due = queryset.filter(next_assessment_date__lte=today).order_by('next_assessment_date')
        serializer = AppliedControlListSerializer(due, many=True)
        return Response(serializer.data)
