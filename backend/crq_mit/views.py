"""
CRQ Views - MIT Licensed

Clean-room implementation of CRQ API views.
Copyright (c) 2026 Tash
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    QuantitativeRiskStudy,
    QuantitativeRiskScenario,
    QuantitativeRiskHypothesis,
)
from .serializers import (
    QuantitativeRiskStudySerializer,
    QuantitativeRiskStudyListSerializer,
    QuantitativeRiskScenarioSerializer,
    QuantitativeRiskScenarioListSerializer,
    QuantitativeRiskHypothesisSerializer,
    QuantitativeRiskHypothesisListSerializer,
)
from .utils import (
    simulate_portfolio,
    calculate_combined_simulation,
    format_currency,
)


class IsAdminOrReadOnly(permissions.BasePermission):
    """Allow read-only for authenticated, write for admins."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.is_staff


class QuantitativeRiskStudyViewSet(viewsets.ModelViewSet):
    """
    API endpoint for quantitative risk study management.
    """
    queryset = QuantitativeRiskStudy.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return QuantitativeRiskStudyListSerializer
        return QuantitativeRiskStudySerializer

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
        """Get study status choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in QuantitativeRiskStudy.StudyStatus.choices
        ])

    @action(detail=False, methods=['get'])
    def distribution_model_choices(self, request):
        """Get distribution model choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in QuantitativeRiskStudy.DistributionModel.choices
        ])

    @action(detail=True, methods=['get'])
    def combined_ale(self, request, pk=None):
        """Get combined ALE metrics for all selected scenarios."""
        study = self.get_object()

        current_scenarios = []
        residual_scenarios = []

        for scenario in study.scenarios.filter(is_selected=True):
            for hyp in scenario.hypotheses.all():
                params = {
                    'probability': hyp.get_probability(),
                    'lower_bound': hyp.get_impact_bounds()[0],
                    'upper_bound': hyp.get_impact_bounds()[1],
                }
                if hyp.stage == 'current':
                    current_scenarios.append(params)
                elif hyp.stage == 'residual':
                    residual_scenarios.append(params)

        result = calculate_combined_simulation(
            current_scenarios,
            residual_scenarios
        )

        # Format currency values
        currency = study.currency
        if 'current' in result and 'metrics' in result['current']:
            mal = result['current']['metrics'].get('mean_annual_loss', 0)
            result['current']['formatted_mal'] = format_currency(mal, currency)
        if 'residual' in result and 'metrics' in result['residual']:
            mal = result['residual']['metrics'].get('mean_annual_loss', 0)
            result['residual']['formatted_mal'] = format_currency(mal, currency)

        return Response(result)

    @action(detail=True, methods=['post'])
    def run_portfolio_simulation(self, request, pk=None):
        """Run portfolio simulation for the study."""
        study = self.get_object()

        scenarios = []
        for scenario in study.scenarios.filter(is_selected=True):
            try:
                current = scenario.hypotheses.get(stage='current')
                scenarios.append({
                    'probability': current.get_probability(),
                    'lower_bound': current.get_impact_bounds()[0],
                    'upper_bound': current.get_impact_bounds()[1],
                })
            except QuantitativeRiskHypothesis.DoesNotExist:
                continue

        num_iterations = request.data.get('iterations', 50000)
        result = simulate_portfolio(scenarios, num_iterations)

        # Cache the results
        from django.utils import timezone
        study.portfolio_simulation = result
        study.simulation_timestamp = timezone.now()
        study.save(update_fields=['portfolio_simulation', 'simulation_timestamp'])

        return Response(result)

    @action(detail=True, methods=['get'])
    def risk_tolerance_curve(self, request, pk=None):
        """Get or generate risk tolerance curve."""
        study = self.get_object()

        if study.risk_tolerance:
            return Response(study.risk_tolerance)

        # Generate default risk tolerance curve
        default_tolerance = {
            'points': [
                {'probability': 0.5, 'acceptable_loss': 10000},
                {'probability': 0.1, 'acceptable_loss': 100000},
                {'probability': 0.01, 'acceptable_loss': 500000},
                {'probability': 0.001, 'acceptable_loss': 1000000},
            ],
            'curve_data': []
        }

        return Response(default_tolerance)


class QuantitativeRiskScenarioViewSet(viewsets.ModelViewSet):
    """
    API endpoint for quantitative risk scenario management.
    """
    queryset = QuantitativeRiskScenario.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return QuantitativeRiskScenarioListSerializer
        return QuantitativeRiskScenarioSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        study_id = self.request.query_params.get('study_id')
        if study_id:
            queryset = queryset.filter(study_id=study_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)
        return queryset

    @action(detail=False, methods=['get'])
    def priority_choices(self, request):
        """Get priority choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in QuantitativeRiskScenario.Priority.choices
        ])

    @action(detail=False, methods=['get'])
    def status_choices(self, request):
        """Get status choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in QuantitativeRiskScenario.ScenarioStatus.choices
        ])

    @action(detail=True, methods=['get'])
    def roc_analysis(self, request, pk=None):
        """Get Return on Controls analysis for this scenario."""
        scenario = self.get_object()

        try:
            current = scenario.hypotheses.get(stage='current')
            residual = scenario.hypotheses.get(stage='residual')
        except QuantitativeRiskHypothesis.DoesNotExist:
            return Response(
                {'error': 'Both current and residual hypotheses are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        current_ale = current.get_ale()
        residual_ale = residual.get_ale()
        treatment_cost = residual.get_treatment_cost()

        roc = residual.calculate_roc(current)

        currency = scenario.study.currency
        return Response({
            'current_ale': round(current_ale, 2),
            'current_ale_formatted': format_currency(current_ale, currency),
            'residual_ale': round(residual_ale, 2),
            'residual_ale_formatted': format_currency(residual_ale, currency),
            'ale_reduction': round(current_ale - residual_ale, 2),
            'ale_reduction_formatted': format_currency(current_ale - residual_ale, currency),
            'treatment_cost': round(treatment_cost, 2),
            'treatment_cost_formatted': format_currency(treatment_cost, currency),
            'roc': round(roc, 2) if roc else None,
            'roc_percent': round(roc * 100, 1) if roc else None,
        })


class QuantitativeRiskHypothesisViewSet(viewsets.ModelViewSet):
    """
    API endpoint for quantitative risk hypothesis management.
    """
    queryset = QuantitativeRiskHypothesis.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.action == 'list':
            return QuantitativeRiskHypothesisListSerializer
        return QuantitativeRiskHypothesisSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        scenario_id = self.request.query_params.get('scenario_id')
        if scenario_id:
            queryset = queryset.filter(scenario_id=scenario_id)
        stage = self.request.query_params.get('stage')
        if stage:
            queryset = queryset.filter(stage=stage)
        return queryset

    @action(detail=False, methods=['get'])
    def stage_choices(self, request):
        """Get stage choices."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in QuantitativeRiskHypothesis.RiskStage.choices
        ])

    @action(detail=True, methods=['post'])
    def run_simulation(self, request, pk=None):
        """Run Monte Carlo simulation for this hypothesis."""
        hypothesis = self.get_object()

        num_iterations = request.data.get('iterations', 50000)
        result = hypothesis.run_simulation(num_iterations)

        return Response(result)

    @action(detail=True, methods=['get'])
    def simulation_results(self, request, pk=None):
        """Get cached simulation results."""
        hypothesis = self.get_object()

        if not hypothesis.simulation_data:
            return Response(
                {'error': 'No simulation data available. Run simulation first.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check freshness
        is_fresh = hypothesis.is_simulation_fresh()

        return Response({
            'data': hypothesis.simulation_data,
            'timestamp': hypothesis.simulation_timestamp,
            'is_fresh': is_fresh,
        })

    @action(detail=True, methods=['post'])
    def invalidate_cache(self, request, pk=None):
        """Invalidate cached simulation results."""
        hypothesis = self.get_object()
        hypothesis.invalidate_simulation()
        return Response({'message': 'Simulation cache invalidated'})
