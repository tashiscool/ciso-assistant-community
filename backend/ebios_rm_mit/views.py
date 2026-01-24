"""
EBIOS RM Views - MIT Licensed

Clean-room implementation of EBIOS RM API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Max, Avg

from .models import (
    EbiosRMStudy,
    FearedEvent,
    RiskOrigin,
    TargetObjective,
    RoTo,
    Stakeholder,
    StrategicScenario,
    AttackPath,
    OperationalScenario,
    ElementaryAction,
    OperatingMode,
)
from .serializers import (
    EbiosRMStudySerializer,
    EbiosRMStudyListSerializer,
    FearedEventSerializer,
    FearedEventListSerializer,
    RiskOriginSerializer,
    RiskOriginListSerializer,
    TargetObjectiveSerializer,
    RoToSerializer,
    RoToListSerializer,
    StakeholderSerializer,
    StakeholderListSerializer,
    StrategicScenarioSerializer,
    StrategicScenarioListSerializer,
    AttackPathSerializer,
    AttackPathListSerializer,
    OperationalScenarioSerializer,
    OperationalScenarioListSerializer,
    ElementaryActionSerializer,
    ElementaryActionListSerializer,
    OperatingModeSerializer,
)
from .helpers import (
    generate_ecosystem_radar_chart,
    generate_ecosystem_circular_chart,
    generate_visual_analysis,
    generate_report_data,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class EbiosRMStudyViewSet(viewsets.ModelViewSet):
    """
    API endpoint for EBIOS RM study management.
    """
    queryset = EbiosRMStudy.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return EbiosRMStudyListSerializer
        return EbiosRMStudySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization_id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=False, methods=['get'])
    def status_choices(self, request):
        """Get available status choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in EbiosRMStudy.StudyStatus.choices
        ])

    @action(detail=False, methods=['get'])
    def quotation_method_choices(self, request):
        """Get available quotation method choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in EbiosRMStudy.QuotationMethod.choices
        ])

    @action(detail=True, methods=['patch'])
    def update_workshop_step(self, request, pk=None):
        """Update a specific workshop step status."""
        study = self.get_object()
        workshop = request.data.get('workshop')
        step = request.data.get('step')
        step_status = request.data.get('status')

        if not all([workshop, step, step_status]):
            return Response(
                {'error': 'workshop, step, and status are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        study.set_workshop_step_status(workshop, step, step_status)
        return Response({'message': 'Workshop step updated'})

    @action(detail=True, methods=['get'])
    def ecosystem_chart(self, request, pk=None):
        """Get ecosystem radar chart data for stakeholder analysis."""
        study = self.get_object()
        chart_data = generate_ecosystem_radar_chart(study)
        return Response(chart_data)

    @action(detail=True, methods=['get'])
    def ecosystem_circular_chart(self, request, pk=None):
        """Get ecosystem circular chart data."""
        study = self.get_object()
        chart_data = generate_ecosystem_circular_chart(study)
        return Response(chart_data)

    @action(detail=True, methods=['get'])
    def visual_analysis(self, request, pk=None):
        """Get visual analysis data for the study."""
        study = self.get_object()
        analysis = generate_visual_analysis(study)
        return Response(analysis)

    @action(detail=True, methods=['get'])
    def report_data(self, request, pk=None):
        """Get comprehensive report data for the study."""
        study = self.get_object()
        report = generate_report_data(study)
        return Response(report)

    @action(detail=True, methods=['get'])
    def statistics(self, request, pk=None):
        """Get study statistics."""
        study = self.get_object()

        # Count entities
        feared_events = study.feared_events.count()
        selected_feared_events = study.feared_events.filter(is_selected=True).count()
        risk_origins = study.risk_origins.count()
        target_objectives = study.target_objectives.count()
        rotos = study.rotos.count()
        selected_rotos = study.rotos.filter(is_selected=True).count()
        stakeholders = study.stakeholders.count()
        strategic_scenarios = study.strategic_scenarios.count()

        # Count operational scenarios
        op_scenarios = 0
        for ss in study.strategic_scenarios.all():
            for ap in ss.attack_paths.all():
                op_scenarios += ap.operational_scenarios.count()

        return Response({
            'feared_events': {
                'total': feared_events,
                'selected': selected_feared_events,
            },
            'risk_origins': risk_origins,
            'target_objectives': target_objectives,
            'rotos': {
                'total': rotos,
                'selected': selected_rotos,
            },
            'stakeholders': stakeholders,
            'strategic_scenarios': strategic_scenarios,
            'operational_scenarios': op_scenarios,
        })


class FearedEventViewSet(viewsets.ModelViewSet):
    """API endpoint for feared event management."""
    queryset = FearedEvent.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return FearedEventListSerializer
        return FearedEventSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        study_id = self.request.query_params.get('study_id')
        if study_id:
            queryset = queryset.filter(study_id=study_id)
        selected = self.request.query_params.get('selected')
        if selected == 'true':
            queryset = queryset.filter(is_selected=True)
        return queryset


class RiskOriginViewSet(viewsets.ModelViewSet):
    """API endpoint for risk origin management."""
    queryset = RiskOrigin.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return RiskOriginListSerializer
        return RiskOriginSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        study_id = self.request.query_params.get('study_id')
        if study_id:
            queryset = queryset.filter(study_id=study_id)
        return queryset

    @action(detail=False, methods=['get'])
    def category_choices(self, request):
        """Get available category choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in RiskOrigin.OriginCategory.choices
        ])


class TargetObjectiveViewSet(viewsets.ModelViewSet):
    """API endpoint for target objective management."""
    queryset = TargetObjective.objects.all()
    serializer_class = TargetObjectiveSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        study_id = self.request.query_params.get('study_id')
        if study_id:
            queryset = queryset.filter(study_id=study_id)
        return queryset


class RoToViewSet(viewsets.ModelViewSet):
    """API endpoint for RoTo management."""
    queryset = RoTo.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return RoToListSerializer
        return RoToSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        study_id = self.request.query_params.get('study_id')
        if study_id:
            queryset = queryset.filter(study_id=study_id)
        selected = self.request.query_params.get('selected')
        if selected == 'true':
            queryset = queryset.filter(is_selected=True)
        return queryset.order_by('-pertinence')

    @action(detail=True, methods=['post'])
    def recalculate_pertinence(self, request, pk=None):
        """Recalculate pertinence for this RoTo."""
        roto = self.get_object()
        pertinence = roto.calculate_pertinence()
        roto.save()
        return Response({'pertinence': pertinence})


class StakeholderViewSet(viewsets.ModelViewSet):
    """API endpoint for stakeholder management."""
    queryset = Stakeholder.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return StakeholderListSerializer
        return StakeholderSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        study_id = self.request.query_params.get('study_id')
        if study_id:
            queryset = queryset.filter(study_id=study_id)
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset

    @action(detail=False, methods=['get'])
    def category_choices(self, request):
        """Get available category choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in Stakeholder.StakeholderCategory.choices
        ])

    @action(detail=False, methods=['get'])
    def criticality_ranking(self, request):
        """Get stakeholders ranked by criticality."""
        queryset = self.get_queryset()
        stakeholders = list(queryset)
        stakeholders.sort(key=lambda s: s.current_criticality, reverse=True)
        serializer = StakeholderListSerializer(stakeholders, many=True)
        return Response(serializer.data)


class StrategicScenarioViewSet(viewsets.ModelViewSet):
    """API endpoint for strategic scenario management."""
    queryset = StrategicScenario.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return StrategicScenarioListSerializer
        return StrategicScenarioSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        study_id = self.request.query_params.get('study_id')
        if study_id:
            queryset = queryset.filter(study_id=study_id)
        return queryset

    @action(detail=True, methods=['post'])
    def recalculate_gravity(self, request, pk=None):
        """Recalculate gravity from feared events."""
        scenario = self.get_object()
        gravity = scenario.calculate_gravity()
        scenario.save()
        return Response({'gravity': gravity})


class AttackPathViewSet(viewsets.ModelViewSet):
    """API endpoint for attack path management."""
    queryset = AttackPath.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return AttackPathListSerializer
        return AttackPathSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        scenario_id = self.request.query_params.get('strategic_scenario_id')
        if scenario_id:
            queryset = queryset.filter(strategic_scenario_id=scenario_id)
        return queryset


class OperationalScenarioViewSet(viewsets.ModelViewSet):
    """API endpoint for operational scenario management."""
    queryset = OperationalScenario.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return OperationalScenarioListSerializer
        return OperationalScenarioSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        attack_path_id = self.request.query_params.get('attack_path_id')
        if attack_path_id:
            queryset = queryset.filter(attack_path_id=attack_path_id)
        return queryset

    @action(detail=False, methods=['get'])
    def risk_matrix(self, request):
        """Get risk matrix data from operational scenarios."""
        queryset = self.get_queryset()
        matrix = {}

        for scenario in queryset:
            key = f"{scenario.likelihood},{scenario.gravity}"
            if key not in matrix:
                matrix[key] = {
                    'likelihood': scenario.likelihood,
                    'gravity': scenario.gravity,
                    'count': 0,
                    'scenarios': []
                }
            matrix[key]['count'] += 1
            matrix[key]['scenarios'].append({
                'id': str(scenario.id),
                'name': scenario.name,
            })

        return Response(list(matrix.values()))


class ElementaryActionViewSet(viewsets.ModelViewSet):
    """API endpoint for elementary action management."""
    queryset = ElementaryAction.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return ElementaryActionListSerializer
        return ElementaryActionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        study_id = self.request.query_params.get('study_id')
        if study_id:
            queryset = queryset.filter(study_id=study_id)
        stage = self.request.query_params.get('stage')
        if stage:
            queryset = queryset.filter(stage=stage)
        return queryset

    @action(detail=False, methods=['get'])
    def stage_choices(self, request):
        """Get available stage choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in ElementaryAction.AttackStage.choices
        ])

    @action(detail=False, methods=['get'])
    def icon_choices(self, request):
        """Get available icon type choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in ElementaryAction.IconType.choices
        ])


class OperatingModeViewSet(viewsets.ModelViewSet):
    """API endpoint for operating mode management."""
    queryset = OperatingMode.objects.all()
    serializer_class = OperatingModeSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        scenario_id = self.request.query_params.get('operational_scenario_id')
        if scenario_id:
            queryset = queryset.filter(operational_scenario_id=scenario_id)
        return queryset
