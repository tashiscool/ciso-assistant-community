"""
ConMon API Views

Provides REST API endpoints for ConMon functionality following existing patterns.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from core.views import BaseModelViewSet as AbstractBaseModelViewSet
from continuous_monitoring.models import (
    ConMonProfile,
    ConMonActivityConfig,
    ConMonExecution,
    ConMonMetric,
)
from continuous_monitoring.api.serializers import (
    ConMonProfileSerializer,
    ConMonProfileListSerializer,
    ConMonActivityConfigSerializer,
    ConMonActivityConfigListSerializer,
    ConMonExecutionSerializer,
    ConMonExecutionListSerializer,
    ConMonMetricSerializer,
    ConMonDashboardSerializer,
    ConMonSetupSerializer,
    ConMonSetupResponseSerializer,
)
from continuous_monitoring.services import ConMonService, ConMonTaskGenerator


class BaseModelViewSet(AbstractBaseModelViewSet):
    """Base viewset for ConMon models with app-specific serializers."""
    serializers_module = "continuous_monitoring.api.serializers"


class ConMonProfileViewSet(BaseModelViewSet):
    """
    ViewSet for ConMon Profiles.

    Provides CRUD operations and dashboard endpoint.
    """

    model = ConMonProfile
    serializer_class = ConMonProfileSerializer
    filterset_fields = ['profile_type', 'status', 'folder']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'updated_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ConMonProfileListSerializer
        return ConMonProfileSerializer

    @action(detail=True, methods=['get'])
    def dashboard(self, request, pk=None):
        """Get dashboard data for a profile."""
        profile = self.get_object()
        service = ConMonService(profile_id=str(profile.id))
        dashboard_data = service.get_dashboard_data()

        serializer = ConMonDashboardSerializer(dashboard_data.to_dict())
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a draft profile."""
        profile = self.get_object()

        if profile.status != 'draft':
            return Response(
                {'error': 'Only draft profiles can be activated'},
                status=status.HTTP_400_BAD_REQUEST
            )

        profile.status = 'active'
        profile.save()

        return Response({'status': 'activated'})

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive a profile."""
        profile = self.get_object()
        profile.status = 'archived'
        profile.save()

        return Response({'status': 'archived'})

    @action(detail=True, methods=['post'])
    def generate_tasks(self, request, pk=None):
        """Generate TaskTemplates and TaskNodes for a profile."""
        profile = self.get_object()

        generator = ConMonTaskGenerator(folder=profile.folder)
        results = generator.generate_tasks_from_profile(profile)

        return Response(results)

    @action(detail=False, methods=['post'])
    def setup(self, request):
        """
        Set up a new ConMon profile from a framework.

        This is the main wizard endpoint for creating a ConMon configuration.
        """
        serializer = ConMonSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data

        # Get folder from request (use user's default or specified)
        folder = request.user.get_writable_folders().first()
        if not folder:
            return Response(
                {'error': 'No writable folder available'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Set up profile and activities from framework
            setup_results = ConMonTaskGenerator.setup_from_framework(
                folder=folder,
                framework_urn=data['framework_urn'],
                profile_name=data['profile_name'],
                profile_type=data['profile_type'],
                implementation_groups=data.get('implementation_groups', [])
            )

            if setup_results['errors']:
                return Response(
                    {'errors': setup_results['errors']},
                    status=status.HTTP_400_BAD_REQUEST
                )

            response_data = {
                'profile_id': setup_results['profile_id'],
                'activities_created': setup_results['activities_created'],
                'tasks_created': 0,
                'task_nodes_created': 0,
                'errors': setup_results['errors'],
            }

            # Generate tasks if requested
            if data.get('generate_tasks', True) and setup_results['profile_id']:
                profile = ConMonProfile.objects.get(id=setup_results['profile_id'])
                generator = ConMonTaskGenerator(folder=folder)
                task_results = generator.generate_tasks_from_profile(profile)

                response_data['tasks_created'] = (
                    task_results['created_templates'] + task_results['updated_templates']
                )
                response_data['task_nodes_created'] = task_results['created_nodes']
                response_data['errors'].extend(task_results['errors'])

        response_serializer = ConMonSetupResponseSerializer(response_data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class ConMonActivityConfigViewSet(BaseModelViewSet):
    """
    ViewSet for ConMon Activity Configurations.

    Provides CRUD operations for individual activity settings.
    """

    model = ConMonActivityConfig
    serializer_class = ConMonActivityConfigSerializer
    filterset_fields = ['profile', 'enabled', 'frequency_override', 'folder']
    search_fields = ['ref_id', 'name', 'requirement_urn']
    ordering_fields = ['ref_id', 'name', 'created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ConMonActivityConfigListSerializer
        return ConMonActivityConfigSerializer

    @action(detail=True, methods=['post'])
    def enable(self, request, pk=None):
        """Enable an activity."""
        activity = self.get_object()
        activity.enabled = True
        activity.save()
        return Response({'status': 'enabled'})

    @action(detail=True, methods=['post'])
    def disable(self, request, pk=None):
        """Disable an activity."""
        activity = self.get_object()
        activity.enabled = False
        activity.save()
        return Response({'status': 'disabled'})

    @action(detail=False, methods=['post'])
    def bulk_enable(self, request):
        """Enable multiple activities."""
        ids = request.data.get('ids', [])
        updated = ConMonActivityConfig.objects.filter(id__in=ids).update(enabled=True)
        return Response({'updated': updated})

    @action(detail=False, methods=['post'])
    def bulk_disable(self, request):
        """Disable multiple activities."""
        ids = request.data.get('ids', [])
        updated = ConMonActivityConfig.objects.filter(id__in=ids).update(enabled=False)
        return Response({'updated': updated})


class ConMonExecutionViewSet(BaseModelViewSet):
    """
    ViewSet for ConMon Executions.

    Tracks completion of individual ConMon activities.
    """

    model = ConMonExecution
    serializer_class = ConMonExecutionSerializer
    filterset_fields = ['activity_config', 'status', 'result', 'folder']
    search_fields = ['activity_config__ref_id', 'activity_config__name']
    ordering_fields = ['due_date', 'period_start', 'completed_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return ConMonExecutionListSerializer
        return ConMonExecutionSerializer

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark an execution as complete."""
        from django.utils import timezone

        execution = self.get_object()

        # Determine if on time
        today = timezone.localdate()
        if today <= execution.due_date:
            execution.status = 'completed'
        else:
            execution.status = 'completed_late'

        execution.completed_date = today
        execution.completed_by = request.user
        execution.result = request.data.get('result', 'pass')
        execution.findings = request.data.get('findings', '')
        execution.observations = request.data.get('observations', '')
        execution.save()

        # Update linked task node if exists
        if execution.task_node:
            execution.task_node.status = 'completed'
            execution.task_node.save()

        return Response(ConMonExecutionSerializer(execution).data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming executions."""
        from django.utils import timezone
        from datetime import timedelta

        today = timezone.localdate()
        days = int(request.query_params.get('days', 14))
        upcoming_date = today + timedelta(days=days)

        executions = self.filter_queryset(self.get_queryset()).filter(
            status='pending',
            due_date__gte=today,
            due_date__lte=upcoming_date
        ).order_by('due_date')[:20]

        serializer = ConMonExecutionListSerializer(executions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue executions."""
        from django.utils import timezone

        today = timezone.localdate()

        executions = self.filter_queryset(self.get_queryset()).filter(
            status__in=['pending', 'in_progress'],
            due_date__lt=today
        ).order_by('due_date')[:20]

        serializer = ConMonExecutionListSerializer(executions, many=True)
        return Response(serializer.data)


class ConMonMetricViewSet(BaseModelViewSet):
    """
    ViewSet for ConMon Metrics.

    Provides access to historical metrics data.
    """

    model = ConMonMetric
    serializer_class = ConMonMetricSerializer
    filterset_fields = ['profile', 'metric_type', 'folder']
    ordering_fields = ['period_end', 'metric_type', 'value']

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest metrics for each type."""
        from django.db.models import Max

        profile_id = request.query_params.get('profile')
        if not profile_id:
            return Response(
                {'error': 'profile parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get latest period for each metric type
        latest_dates = ConMonMetric.objects.filter(
            profile_id=profile_id
        ).values('metric_type').annotate(latest=Max('period_end'))

        metrics = []
        for item in latest_dates:
            metric = ConMonMetric.objects.filter(
                profile_id=profile_id,
                metric_type=item['metric_type'],
                period_end=item['latest']
            ).first()
            if metric:
                metrics.append(metric)

        serializer = ConMonMetricSerializer(metrics, many=True)
        return Response(serializer.data)


class ConMonDashboardView(viewsets.ViewSet):
    """
    ViewSet for the main ConMon dashboard.

    Provides aggregate dashboard data across all profiles or for a specific profile.
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Get dashboard data."""
        profile_id = request.query_params.get('profile')

        service = ConMonService(
            profile_id=profile_id,
            folder_id=request.query_params.get('folder')
        )

        dashboard_data = service.get_dashboard_data()

        serializer = ConMonDashboardSerializer(dashboard_data.to_dict())
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def health(self, request):
        """Get overall health summary."""
        profile_id = request.query_params.get('profile')

        service = ConMonService(profile_id=profile_id)

        if profile_id:
            profile = ConMonProfile.objects.get(id=profile_id)
            health = service._calculate_overall_health(profile)
        else:
            health = service._get_default_health()

        return Response(health)
