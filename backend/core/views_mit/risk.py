"""
Risk Views - MIT Licensed

Clean-room implementation of risk management API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Avg, Q
from django.utils import timezone

from ..models_mit import (
    RiskMatrix,
    Threat,
    Vulnerability,
    RiskScenario,
    RiskAssessment,
    RiskTreatment,
)
from ..serializers_mit import (
    RiskMatrixSerializer,
    ThreatSerializer,
    ThreatListSerializer,
    VulnerabilitySerializer,
    VulnerabilityListSerializer,
    RiskScenarioSerializer,
    RiskScenarioListSerializer,
    RiskAssessmentSerializer,
    RiskTreatmentSerializer,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class RiskMatrixViewSet(viewsets.ModelViewSet):
    """
    API endpoint for risk matrix management.
    """
    queryset = RiskMatrix.objects.all()
    serializer_class = RiskMatrixSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set this matrix as the default for the organization."""
        matrix = self.get_object()
        # Unset other defaults
        RiskMatrix.objects.filter(
            organization=matrix.organization,
            is_default=True
        ).update(is_default=False)
        matrix.is_default = True
        matrix.save()
        return Response({'message': 'Matrix set as default'})

    @action(detail=True, methods=['post'])
    def calculate_risk(self, request, pk=None):
        """Calculate risk score using this matrix."""
        matrix = self.get_object()
        probability = request.data.get('probability', 1)
        impact = request.data.get('impact', 1)

        score = matrix.calculate_risk_score(probability, impact)
        level = matrix.get_risk_level(score)

        return Response({
            'probability': probability,
            'impact': impact,
            'score': score,
            'level': level,
        })


class ThreatViewSet(viewsets.ModelViewSet):
    """
    API endpoint for threat management.
    """
    queryset = Threat.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return ThreatListSerializer
        return ThreatSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        source = self.request.query_params.get('source')
        if source:
            queryset = queryset.filter(source=source)
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search)
            )
        return queryset


class VulnerabilityViewSet(viewsets.ModelViewSet):
    """
    API endpoint for vulnerability management.
    """
    queryset = Vulnerability.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return VulnerabilityListSerializer
        return VulnerabilitySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        vuln_type = self.request.query_params.get('type')
        if vuln_type:
            queryset = queryset.filter(vulnerability_type=vuln_type)
        min_severity = self.request.query_params.get('min_severity')
        if min_severity:
            queryset = queryset.filter(severity_score__gte=min_severity)
        return queryset

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue vulnerabilities."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        overdue = queryset.filter(
            due_date__lt=today,
            status='open'
        ).order_by('due_date')
        serializer = VulnerabilityListSerializer(overdue, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get vulnerability statistics."""
        queryset = self.get_queryset()
        stats = {
            'total': queryset.count(),
            'open': queryset.filter(status='open').count(),
            'by_status': list(
                queryset.values('status')
                .annotate(count=Count('id'))
            ),
            'by_type': list(
                queryset.values('vulnerability_type')
                .annotate(count=Count('id'))
            ),
            'avg_severity': queryset.filter(
                severity_score__isnull=False
            ).aggregate(avg=Avg('severity_score'))['avg'],
        }
        return Response(stats)


class RiskScenarioViewSet(viewsets.ModelViewSet):
    """
    API endpoint for risk scenario management.
    """
    queryset = RiskScenario.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return RiskScenarioListSerializer
        return RiskScenarioSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        treatment = self.request.query_params.get('treatment')
        if treatment:
            queryset = queryset.filter(treatment_strategy=treatment)
        min_score = self.request.query_params.get('min_residual_score')
        if min_score:
            # Filter in Python since it's a computed property
            queryset = [
                r for r in queryset
                if r.residual_risk_score >= int(min_score)
            ]
        return queryset

    @action(detail=False, methods=['get'])
    def heatmap(self, request):
        """Get risk heatmap data."""
        queryset = self.get_queryset()
        heatmap = {}
        for scenario in queryset:
            key = f"{scenario.residual_probability},{scenario.residual_impact}"
            if key not in heatmap:
                heatmap[key] = {
                    'probability': scenario.residual_probability,
                    'impact': scenario.residual_impact,
                    'count': 0,
                    'scenarios': []
                }
            heatmap[key]['count'] += 1
            heatmap[key]['scenarios'].append({
                'id': str(scenario.id),
                'name': scenario.name,
            })
        return Response(list(heatmap.values()))

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get risk statistics."""
        queryset = self.get_queryset()
        if isinstance(queryset, list):
            total = len(queryset)
            by_status = {}
            by_treatment = {}
            by_category = {}
            for r in queryset:
                by_status[r.status] = by_status.get(r.status, 0) + 1
                by_treatment[r.treatment_strategy] = by_treatment.get(r.treatment_strategy, 0) + 1
                by_category[r.category] = by_category.get(r.category, 0) + 1
        else:
            total = queryset.count()
            by_status = list(queryset.values('status').annotate(count=Count('id')))
            by_treatment = list(queryset.values('treatment_strategy').annotate(count=Count('id')))
            by_category = list(queryset.values('category').annotate(count=Count('id')))

        stats = {
            'total': total,
            'by_status': by_status,
            'by_treatment': by_treatment,
            'by_category': by_category,
        }
        return Response(stats)

    @action(detail=True, methods=['get'])
    def treatments(self, request, pk=None):
        """Get all treatments for this risk scenario."""
        scenario = self.get_object()
        treatments = scenario.treatments.all()
        serializer = RiskTreatmentSerializer(treatments, many=True)
        return Response(serializer.data)


class RiskAssessmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for risk assessment management.
    """
    queryset = RiskAssessment.objects.all()
    serializer_class = RiskAssessmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark assessment as completed."""
        assessment = self.get_object()
        assessment.status = 'completed'
        assessment.save()
        return Response({'message': 'Assessment marked as completed'})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve the assessment."""
        assessment = self.get_object()
        assessment.status = 'approved'
        assessment.save()
        return Response({'message': 'Assessment approved'})


class RiskTreatmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for risk treatment management.
    """
    queryset = RiskTreatment.objects.all()
    serializer_class = RiskTreatmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        scenario_id = self.request.query_params.get('risk_scenario_id')
        if scenario_id:
            queryset = queryset.filter(risk_scenario_id=scenario_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue treatments."""
        queryset = self.get_queryset()
        today = timezone.now().date()
        overdue = queryset.filter(
            due_date__lt=today,
            status__in=['planned', 'in_progress']
        ).order_by('due_date')
        serializer = RiskTreatmentSerializer(overdue, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark treatment as completed."""
        treatment = self.get_object()
        treatment.status = 'completed'
        treatment.completion_date = timezone.now().date()
        treatment.save()
        return Response({'message': 'Treatment marked as completed'})
