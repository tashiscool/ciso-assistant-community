"""
Workflow Engine API Views

REST API endpoints for workflow management and execution.
"""

import secrets
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import (
    Workflow,
    WorkflowNode,
    WorkflowConnection,
    WorkflowExecution,
    WorkflowStep,
    WorkflowSchedule,
    WorkflowWebhook,
)
from .services import (
    WorkflowService,
    WorkflowExecutionEngine,
    WorkflowScheduler,
)


class WorkflowViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Workflow CRUD operations.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Workflow.objects.filter(is_latest=True)

        # Filter by status
        workflow_status = self.request.query_params.get('status')
        if workflow_status:
            queryset = queryset.filter(status=workflow_status)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        return queryset.order_by('-updated_at')

    def get_serializer_data(self, instance, include_definition=False):
        data = {
            'id': str(instance.id),
            'name': instance.name,
            'description': instance.description,
            'version': instance.version,
            'status': instance.status,
            'trigger': instance.trigger,
            'variables': instance.variables,
            'tags': instance.tags,
            'category': instance.category,
            'total_executions': instance.total_executions,
            'successful_executions': instance.successful_executions,
            'failed_executions': instance.failed_executions,
            'last_executed_at': instance.last_executed_at.isoformat() if instance.last_executed_at else None,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
            'updated_at': instance.updated_at.isoformat() if instance.updated_at else None,
        }

        if include_definition:
            data['nodes'] = [
                {
                    'id': n.node_id,
                    'type': n.node_type,
                    'name': n.name,
                    'position': {'x': n.position_x, 'y': n.position_y},
                    'config': n.config,
                    'inputs': [],  # Will be populated from node type
                    'outputs': [],
                }
                for n in instance.nodes.all()
            ]
            data['connections'] = [
                {
                    'id': c.connection_id,
                    'sourceNodeId': c.source_node_id,
                    'sourcePort': c.source_port,
                    'targetNodeId': c.target_node_id,
                    'targetPort': c.target_port,
                    'condition': c.condition,
                }
                for c in instance.connections.all()
            ]
            data['canvas_settings'] = instance.canvas_settings

        return data

    def list(self, request):
        queryset = self.get_queryset()
        data = [self.get_serializer_data(w) for w in queryset]
        return Response(data)

    def retrieve(self, request, pk=None):
        workflow = get_object_or_404(Workflow, pk=pk)
        return Response(self.get_serializer_data(workflow, include_definition=True))

    def create(self, request):
        data = request.data
        service = WorkflowService()

        workflow = service.create_workflow(
            name=data.get('name'),
            description=data.get('description', ''),
            trigger=data.get('trigger', {'type': 'manual', 'config': {}}),
            created_by=request.user,
            tags=data.get('tags', []),
            category=data.get('category', ''),
        )

        # If nodes/connections provided, update
        if data.get('nodes') or data.get('connections'):
            workflow = service.update_workflow(
                workflow,
                nodes=data.get('nodes', []),
                connections=data.get('connections', []),
                variables=data.get('variables', []),
            )

        return Response(self.get_serializer_data(workflow, include_definition=True), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        workflow = get_object_or_404(Workflow, pk=pk)
        data = request.data
        service = WorkflowService()

        workflow = service.update_workflow(
            workflow,
            nodes=data.get('nodes', []),
            connections=data.get('connections', []),
            trigger=data.get('trigger'),
            variables=data.get('variables'),
            name=data.get('name', workflow.name),
            description=data.get('description', workflow.description),
            tags=data.get('tags', workflow.tags),
            category=data.get('category', workflow.category),
            canvas_settings=data.get('canvas_settings', workflow.canvas_settings),
        )

        return Response(self.get_serializer_data(workflow, include_definition=True))

    def destroy(self, request, pk=None):
        workflow = get_object_or_404(Workflow, pk=pk)
        workflow.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate the workflow."""
        workflow = get_object_or_404(Workflow, pk=pk)
        workflow.activate()
        return Response(self.get_serializer_data(workflow))

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate the workflow."""
        workflow = get_object_or_404(Workflow, pk=pk)
        workflow.deactivate()
        return Response(self.get_serializer_data(workflow))

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute the workflow manually."""
        workflow = get_object_or_404(Workflow, pk=pk)
        trigger_data = request.data.get('trigger_data', {})

        engine = WorkflowExecutionEngine()
        execution = engine.execute(
            workflow=workflow,
            trigger_type='manual',
            trigger_data=trigger_data,
            executed_by=request.user,
        )

        return Response({
            'execution_id': str(execution.id),
            'status': execution.status,
            'started_at': execution.started_at.isoformat() if execution.started_at else None,
            'completed_at': execution.completed_at.isoformat() if execution.completed_at else None,
        })

    @action(detail=True, methods=['get'])
    def validate(self, request, pk=None):
        """Validate the workflow definition."""
        workflow = get_object_or_404(Workflow, pk=pk)
        service = WorkflowService()
        result = service.validate_workflow(workflow)
        return Response(result)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Duplicate the workflow."""
        workflow = get_object_or_404(Workflow, pk=pk)
        new_name = request.data.get('name')
        service = WorkflowService()
        new_workflow = service.duplicate_workflow(workflow, new_name)
        return Response(self.get_serializer_data(new_workflow, include_definition=True), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """Export the workflow definition."""
        workflow = get_object_or_404(Workflow, pk=pk)
        service = WorkflowService()
        return Response(service.export_workflow(workflow))

    @action(detail=False, methods=['post'])
    def import_workflow(self, request):
        """Import a workflow from JSON."""
        data = request.data
        service = WorkflowService()
        workflow = service.import_workflow(data, created_by=request.user)
        return Response(self.get_serializer_data(workflow, include_definition=True), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def create_version(self, request, pk=None):
        """Create a new version of the workflow."""
        workflow = get_object_or_404(Workflow, pk=pk)
        new_version = workflow.create_new_version()
        return Response(self.get_serializer_data(new_version, include_definition=True), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions of a workflow."""
        workflow = get_object_or_404(Workflow, pk=pk)

        # Find the root version
        root = workflow
        while root.parent_version:
            root = root.parent_version

        # Get all versions
        versions = Workflow.objects.filter(
            name=workflow.name
        ).order_by('-version')

        return Response([
            {
                'id': str(v.id),
                'version': v.version,
                'status': v.status,
                'is_latest': v.is_latest,
                'created_at': v.created_at.isoformat() if v.created_at else None,
            }
            for v in versions
        ])


class WorkflowExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for workflow execution history.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = WorkflowExecution.objects.all()

        # Filter by workflow
        workflow_id = self.request.query_params.get('workflow')
        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        # Filter by status
        exec_status = self.request.query_params.get('status')
        if exec_status:
            queryset = queryset.filter(status=exec_status)

        return queryset.order_by('-created_at')

    def get_serializer_data(self, instance, include_steps=False):
        data = {
            'id': str(instance.id),
            'workflow_id': str(instance.workflow_id),
            'workflow_name': instance.workflow.name,
            'execution_number': instance.execution_number,
            'status': instance.status,
            'triggered_by': instance.triggered_by,
            'trigger_data': instance.trigger_data,
            'started_at': instance.started_at.isoformat() if instance.started_at else None,
            'completed_at': instance.completed_at.isoformat() if instance.completed_at else None,
            'duration_seconds': instance.duration_seconds,
            'output': instance.output,
            'error': instance.error,
            'executed_by': instance.executed_by.username if instance.executed_by else None,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
        }

        if include_steps:
            data['steps'] = [
                {
                    'id': str(s.id),
                    'node_id': s.node_id,
                    'node_type': s.node_type,
                    'node_name': s.node_name,
                    'sequence': s.sequence,
                    'status': s.status,
                    'started_at': s.started_at.isoformat() if s.started_at else None,
                    'completed_at': s.completed_at.isoformat() if s.completed_at else None,
                    'input_data': s.input_data,
                    'output_data': s.output_data,
                    'error': s.error,
                }
                for s in instance.steps.all().order_by('sequence')
            ]

        return data

    def list(self, request):
        queryset = self.get_queryset()[:100]  # Limit to 100
        data = [self.get_serializer_data(e) for e in queryset]
        return Response(data)

    def retrieve(self, request, pk=None):
        execution = get_object_or_404(WorkflowExecution, pk=pk)
        return Response(self.get_serializer_data(execution, include_steps=True))

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a running execution."""
        execution = get_object_or_404(WorkflowExecution, pk=pk)

        if execution.status == WorkflowExecution.Status.RUNNING:
            execution.cancel()

        return Response(self.get_serializer_data(execution))

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Retry a failed execution."""
        execution = get_object_or_404(WorkflowExecution, pk=pk)

        if execution.status != WorkflowExecution.Status.FAILED:
            return Response(
                {'error': 'Can only retry failed executions'},
                status=status.HTTP_400_BAD_REQUEST
            )

        engine = WorkflowExecutionEngine()
        new_execution = engine.execute(
            workflow=execution.workflow,
            trigger_type='manual',
            trigger_data=execution.trigger_data,
            executed_by=request.user,
        )

        return Response(self.get_serializer_data(new_execution))


class WorkflowScheduleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for workflow schedules.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = WorkflowSchedule.objects.all()

        # Filter by workflow
        workflow_id = self.request.query_params.get('workflow')
        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        return queryset.order_by('next_run_at')

    def get_serializer_data(self, instance):
        return {
            'id': str(instance.id),
            'workflow_id': str(instance.workflow_id),
            'workflow_name': instance.workflow.name,
            'name': instance.name,
            'is_active': instance.is_active,
            'schedule_type': instance.schedule_type,
            'cron_expression': instance.cron_expression,
            'interval_minutes': instance.interval_minutes,
            'run_at': instance.run_at.isoformat() if instance.run_at else None,
            'timezone': instance.timezone,
            'next_run_at': instance.next_run_at.isoformat() if instance.next_run_at else None,
            'last_run_at': instance.last_run_at.isoformat() if instance.last_run_at else None,
            'run_count': instance.run_count,
            'max_runs': instance.max_runs,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
        }

    def list(self, request):
        queryset = self.get_queryset()
        data = [self.get_serializer_data(s) for s in queryset]
        return Response(data)

    def retrieve(self, request, pk=None):
        schedule = get_object_or_404(WorkflowSchedule, pk=pk)
        return Response(self.get_serializer_data(schedule))

    def create(self, request):
        data = request.data
        workflow = get_object_or_404(Workflow, pk=data.get('workflow_id'))

        scheduler = WorkflowScheduler()
        schedule = scheduler.create_schedule(
            workflow=workflow,
            name=data.get('name'),
            schedule_type=data.get('schedule_type', 'interval'),
            cron_expression=data.get('cron_expression', ''),
            interval_minutes=data.get('interval_minutes'),
            run_at=data.get('run_at'),
            timezone=data.get('timezone', 'UTC'),
            max_runs=data.get('max_runs'),
        )

        return Response(self.get_serializer_data(schedule), status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        schedule = get_object_or_404(WorkflowSchedule, pk=pk)
        schedule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate the schedule."""
        schedule = get_object_or_404(WorkflowSchedule, pk=pk)
        schedule.is_active = True
        schedule.save()
        return Response(self.get_serializer_data(schedule))

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate the schedule."""
        schedule = get_object_or_404(WorkflowSchedule, pk=pk)
        schedule.is_active = False
        schedule.save()
        return Response(self.get_serializer_data(schedule))


class WorkflowWebhookViewSet(viewsets.ModelViewSet):
    """
    ViewSet for workflow webhooks.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = WorkflowWebhook.objects.all()

        # Filter by workflow
        workflow_id = self.request.query_params.get('workflow')
        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        return queryset.order_by('-created_at')

    def get_serializer_data(self, instance, include_token=False):
        data = {
            'id': str(instance.id),
            'workflow_id': str(instance.workflow_id),
            'workflow_name': instance.workflow.name,
            'name': instance.name,
            'is_active': instance.is_active,
            'allowed_methods': instance.allowed_methods,
            'rate_limit_per_minute': instance.rate_limit_per_minute,
            'total_calls': instance.total_calls,
            'last_called_at': instance.last_called_at.isoformat() if instance.last_called_at else None,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
        }

        if include_token:
            data['token'] = instance.token
            data['webhook_url'] = f"/api/webhooks/workflow/{instance.token}/"

        return data

    def list(self, request):
        queryset = self.get_queryset()
        data = [self.get_serializer_data(w) for w in queryset]
        return Response(data)

    def retrieve(self, request, pk=None):
        webhook = get_object_or_404(WorkflowWebhook, pk=pk)
        return Response(self.get_serializer_data(webhook, include_token=True))

    def create(self, request):
        data = request.data
        workflow = get_object_or_404(Workflow, pk=data.get('workflow_id'))

        webhook = WorkflowWebhook.objects.create(
            workflow=workflow,
            name=data.get('name'),
            token=secrets.token_urlsafe(32),
            allowed_methods=data.get('allowed_methods', ['POST']),
            rate_limit_per_minute=data.get('rate_limit_per_minute', 60),
        )

        return Response(self.get_serializer_data(webhook, include_token=True), status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        webhook = get_object_or_404(WorkflowWebhook, pk=pk)
        webhook.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def regenerate_token(self, request, pk=None):
        """Regenerate the webhook token."""
        webhook = get_object_or_404(WorkflowWebhook, pk=pk)
        webhook.token = secrets.token_urlsafe(32)
        webhook.save()
        return Response(self.get_serializer_data(webhook, include_token=True))
