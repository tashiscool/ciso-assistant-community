"""
TPRM Views - MIT Licensed

Clean-room implementation of TPRM API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.db.models import Count, Q

from .models import Entity, EntityAssessment, Representative, Solution, Contract
from .serializers import (
    EntitySerializer,
    EntityListSerializer,
    EntityAssessmentSerializer,
    EntityAssessmentListSerializer,
    RepresentativeSerializer,
    RepresentativeListSerializer,
    SolutionSerializer,
    SolutionListSerializer,
    ContractSerializer,
    ContractListSerializer,
)
from .dora_export import generate_dora_roi_export


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class EntityViewSet(viewsets.ModelViewSet):
    """
    API endpoint for entity management.
    """
    queryset = Entity.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return EntityListSerializer
        return EntitySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        entity_type = self.request.query_params.get('type')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        active_only = self.request.query_params.get('active') == 'true'
        if active_only:
            queryset = queryset.filter(is_active=True)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(ref_id__icontains=search)
            )
        return queryset

    @action(detail=False, methods=['get'])
    def type_choices(self, request):
        """Get entity type choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in Entity.EntityType.choices
        ])

    @action(detail=False, methods=['get'])
    def dora_type_choices(self, request):
        """Get DORA entity type choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in Entity.DORAEntityType.choices
        ])

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get entity statistics."""
        queryset = self.get_queryset()
        stats = {
            'total': queryset.count(),
            'active': queryset.filter(is_active=True).count(),
            'by_type': list(
                queryset.values('entity_type')
                .annotate(count=Count('id'))
            ),
            'by_dora_type': list(
                queryset.values('dora_entity_type')
                .annotate(count=Count('id'))
            ),
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def criticality_ranking(self, request):
        """Get entities ranked by criticality."""
        queryset = self.get_queryset().filter(is_active=True)
        entities = list(queryset)
        entities.sort(key=lambda e: e.default_criticality, reverse=True)
        serializer = EntityListSerializer(entities[:20], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def generate_dora_roi(self, request):
        """
        Generate DORA Register of Information export.

        Returns a ZIP file containing all required CSV files.
        """
        org_id = request.query_params.get('organization_id')
        if not org_id:
            return Response(
                {'error': 'organization_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        main_entity_name = request.query_params.get('main_entity_name', '')

        try:
            zip_buffer = generate_dora_roi_export(org_id, main_entity_name)

            response = HttpResponse(
                zip_buffer.getvalue(),
                content_type='application/zip'
            )
            response['Content-Disposition'] = 'attachment; filename="DORA_ROI_Export.zip"'
            return response

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RepresentativeViewSet(viewsets.ModelViewSet):
    """
    API endpoint for representative management.
    """
    queryset = Representative.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return RepresentativeListSerializer
        return RepresentativeSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        return queryset


class SolutionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for solution management.
    """
    queryset = Solution.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return SolutionListSerializer
        return SolutionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        provider_id = self.request.query_params.get('provider_id')
        if provider_id:
            queryset = queryset.filter(provider_id=provider_id)
        recipient_id = self.request.query_params.get('recipient_id')
        if recipient_id:
            queryset = queryset.filter(recipient_id=recipient_id)
        criticality = self.request.query_params.get('criticality')
        if criticality:
            queryset = queryset.filter(criticality=criticality)
        return queryset

    @action(detail=False, methods=['get'])
    def criticality_choices(self, request):
        """Get criticality level choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in Solution.CriticalityLevel.choices
        ])

    @action(detail=False, methods=['get'])
    def ict_service_type_choices(self, request):
        """Get ICT service type choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in Solution.ICTServiceType.choices
        ])

    @action(detail=False, methods=['get'])
    def critical_solutions(self, request):
        """Get critical solutions requiring attention."""
        queryset = self.get_queryset().filter(
            criticality__in=['high', 'critical']
        )
        serializer = SolutionListSerializer(queryset, many=True)
        return Response(serializer.data)


class ContractViewSet(viewsets.ModelViewSet):
    """
    API endpoint for contract management.
    """
    queryset = Contract.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return ContractListSerializer
        return ContractSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        provider_id = self.request.query_params.get('provider_id')
        if provider_id:
            queryset = queryset.filter(provider_id=provider_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=False, methods=['get'])
    def status_choices(self, request):
        """Get contract status choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in Contract.ContractStatus.choices
        ])

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get contracts expiring soon."""
        from django.utils import timezone
        from datetime import timedelta

        queryset = self.get_queryset()
        today = timezone.now().date()
        expiring = queryset.filter(
            end_date__lte=today + timedelta(days=90),
            end_date__gte=today,
            status='active'
        ).order_by('end_date')
        serializer = ContractListSerializer(expiring, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def expired(self, request):
        """Get expired contracts."""
        from django.utils import timezone

        queryset = self.get_queryset()
        today = timezone.now().date()
        expired = queryset.filter(
            end_date__lt=today,
            status='active'
        )
        serializer = ContractListSerializer(expired, many=True)
        return Response(serializer.data)


class EntityAssessmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for entity assessment management.
    """
    queryset = EntityAssessment.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return EntityAssessmentListSerializer
        return EntityAssessmentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        conclusion = self.request.query_params.get('conclusion')
        if conclusion:
            queryset = queryset.filter(conclusion=conclusion)
        return queryset

    @action(detail=False, methods=['get'])
    def conclusion_choices(self, request):
        """Get conclusion choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in EntityAssessment.AssessmentConclusion.choices
        ])

    @action(detail=False, methods=['get'])
    def due_for_review(self, request):
        """Get assessments due for review."""
        from django.utils import timezone

        queryset = self.get_queryset()
        today = timezone.now().date()
        due = queryset.filter(
            next_assessment_date__lte=today
        ).order_by('next_assessment_date')
        serializer = EntityAssessmentListSerializer(due, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def blockers(self, request):
        """Get entities with blocker assessments."""
        queryset = self.get_queryset().filter(conclusion='blocker')
        serializer = EntityAssessmentListSerializer(queryset, many=True)
        return Response(serializer.data)
