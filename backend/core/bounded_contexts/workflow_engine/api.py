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
from .templates import (
    get_workflow_template_service,
    WORKFLOW_TEMPLATES,
)
from .assessment import (
    get_assessment_service,
    MasterAssessment,
    AssessmentTask,
    TaskGenerationOptions,
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


class WorkflowTemplateViewSet(viewsets.ViewSet):
    """
    ViewSet for workflow templates.

    Provides read-only access to pre-built workflow templates and
    the ability to instantiate new workflows from templates.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """List all available workflow templates."""
        service = get_workflow_template_service()

        # Apply filters
        category = request.query_params.get('category')
        tags = request.query_params.get('tags')
        if tags:
            tags = tags.split(',')

        templates = service.list_templates(category=category, tags=tags)

        data = []
        for t in templates:
            data.append({
                'id': t.id,
                'name': t.name,
                'description': t.description,
                'category': t.category,
                'tags': t.tags,
                'version': t.version,
                'author': t.author,
                'requires_integrations': t.requires_integrations,
                'trigger_type': t.trigger.get('type', 'manual'),
                'variable_count': len(t.variables),
                'node_count': len(t.nodes),
            })

        return Response({
            'templates': data,
            'total': len(data),
        })

    def retrieve(self, request, pk=None):
        """Get details of a specific template."""
        service = get_workflow_template_service()
        template = service.get_template(pk)

        if not template:
            return Response(
                {'error': f'Template not found: {pk}'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'category': template.category,
            'tags': template.tags,
            'version': template.version,
            'author': template.author,
            'trigger': template.trigger,
            'variables': template.variables,
            'nodes': template.nodes,
            'connections': template.connections,
            'requires_integrations': template.requires_integrations,
        })

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Preview how a workflow would look when instantiated from this template."""
        service = get_workflow_template_service()
        preview = service.preview_template(pk)

        if not preview:
            return Response(
                {'error': f'Template not found: {pk}'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(preview)

    @action(detail=True, methods=['post'])
    def instantiate(self, request, pk=None):
        """Create a new workflow from this template."""
        service = get_workflow_template_service()

        name = request.data.get('name')
        variable_values = request.data.get('variables', {})

        workflow = service.instantiate_template(
            template_id=pk,
            name=name,
            variable_values=variable_values,
            created_by=request.user,
        )

        if not workflow:
            return Response(
                {'error': f'Template not found: {pk}'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            'workflow_id': str(workflow.id),
            'name': workflow.name,
            'description': workflow.description,
            'status': workflow.status,
            'version': workflow.version,
            'created_at': workflow.created_at.isoformat() if workflow.created_at else None,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get available template categories with counts."""
        service = get_workflow_template_service()
        categories = service.get_categories()

        return Response({
            'categories': [
                {'name': name, 'count': count}
                for name, count in categories.items()
            ],
            'total': len(categories),
        })


class MasterAssessmentViewSet(viewsets.ViewSet):
    """
    ViewSet for master assessments.

    Handles assessment creation, task generation, tracking, and reporting.
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_data(self, assessment, include_tasks=False):
        """Serialize assessment data."""
        data = {
            'id': str(assessment.id),
            'name': assessment.name,
            'description': assessment.description,
            'assessment_type': assessment.assessment_type,
            'status': assessment.status,
            'target_systems': assessment.target_systems,
            'target_frameworks': assessment.target_frameworks,
            'planned_start_date': assessment.planned_start_date.isoformat() if assessment.planned_start_date else None,
            'planned_end_date': assessment.planned_end_date.isoformat() if assessment.planned_end_date else None,
            'actual_start_date': assessment.actual_start_date.isoformat() if assessment.actual_start_date else None,
            'actual_end_date': assessment.actual_end_date.isoformat() if assessment.actual_end_date else None,
            'lead_assessor_id': str(assessment.lead_assessor_id) if assessment.lead_assessor_id else None,
            'summary': assessment.summary,
            'completion_percentage': assessment.completion_percentage,
            'is_overdue': assessment.is_overdue,
            'created_at': assessment.created_at.isoformat() if assessment.created_at else None,
            'updated_at': assessment.updated_at.isoformat() if assessment.updated_at else None,
        }

        if include_tasks:
            data['tasks'] = [
                {
                    'id': str(t.id),
                    'name': t.name,
                    'task_type': t.task_type,
                    'status': t.status,
                    'result': t.result,
                    'reference_id': t.reference_id,
                    'assigned_to_id': str(t.assigned_to_id) if t.assigned_to_id else None,
                    'due_date': t.due_date.isoformat() if t.due_date else None,
                    'sequence': t.sequence,
                }
                for t in assessment.tasks.all().order_by('sequence')
            ]

        return data

    def list(self, request):
        """List all master assessments."""
        queryset = MasterAssessment.objects.all()

        # Filter by status
        assessment_status = request.query_params.get('status')
        if assessment_status:
            queryset = queryset.filter(status=assessment_status)

        # Filter by type
        assessment_type = request.query_params.get('type')
        if assessment_type:
            queryset = queryset.filter(assessment_type=assessment_type)

        queryset = queryset.order_by('-created_at')[:100]
        data = [self.get_serializer_data(a) for a in queryset]

        return Response({
            'assessments': data,
            'total': len(data),
        })

    def retrieve(self, request, pk=None):
        """Get a specific assessment with tasks."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        return Response(self.get_serializer_data(assessment, include_tasks=True))

    def create(self, request):
        """Create a new master assessment."""
        data = request.data
        service = get_assessment_service()

        target_systems = data.get('target_systems', [])
        if not target_systems:
            return Response(
                {'error': 'target_systems is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from datetime import datetime, date as date_type

        planned_start = None
        planned_end = None
        if data.get('planned_start_date'):
            planned_start = datetime.fromisoformat(data['planned_start_date']).date()
        if data.get('planned_end_date'):
            planned_end = datetime.fromisoformat(data['planned_end_date']).date()

        assessment = service.create_assessment(
            name=data.get('name', 'New Assessment'),
            assessment_type=data.get('assessment_type', 'custom'),
            target_systems=[UUID(s) for s in target_systems],
            target_frameworks=data.get('target_frameworks', []),
            lead_assessor_id=UUID(data['lead_assessor_id']) if data.get('lead_assessor_id') else None,
            planned_start=planned_start,
            planned_end=planned_end,
            description=data.get('description', ''),
            settings=data.get('settings', {}),
            created_by=request.user.id if request.user else None,
        )

        return Response(
            self.get_serializer_data(assessment),
            status=status.HTTP_201_CREATED
        )

    def destroy(self, request, pk=None):
        """Delete an assessment."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        assessment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def generate_tasks(self, request, pk=None):
        """Generate assessment tasks based on targets."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        service = get_assessment_service()

        options = TaskGenerationOptions(
            include_ksis=request.data.get('include_ksis', True),
            include_controls=request.data.get('include_controls', True),
            ksi_categories=request.data.get('ksi_categories', []),
            control_families=request.data.get('control_families', []),
            sampling_rate=request.data.get('sampling_rate', 1.0),
        )

        tasks = service.generate_tasks(assessment, options)

        return Response({
            'tasks_generated': len(tasks),
            'assessment': self.get_serializer_data(assessment),
        })

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start the assessment."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        service = get_assessment_service()
        service.start_assessment(assessment)
        return Response(self.get_serializer_data(assessment))

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark assessment as complete."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        service = get_assessment_service()
        service.complete_assessment(assessment)
        return Response(self.get_serializer_data(assessment))

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        """Generate assessment report."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        service = get_assessment_service()
        report = service.generate_assessment_report(assessment)
        return Response(report)

    @action(detail=True, methods=['post'])
    def assign_tasks(self, request, pk=None):
        """Bulk assign tasks to assessors."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        service = get_assessment_service()

        assignments = request.data.get('assignments', {})
        # Convert string UUIDs to UUID objects
        converted = {}
        for user_id, task_ids in assignments.items():
            converted[UUID(user_id)] = [UUID(t) for t in task_ids]

        service.assign_tasks(assessment, converted)

        return Response({
            'message': 'Tasks assigned successfully',
            'assessment': self.get_serializer_data(assessment),
        })


class AssessmentTaskViewSet(viewsets.ViewSet):
    """
    ViewSet for assessment tasks.
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_data(self, task, include_details=False):
        """Serialize task data."""
        data = {
            'id': str(task.id),
            'assessment_id': str(task.master_assessment_id),
            'task_type': task.task_type,
            'name': task.name,
            'status': task.status,
            'result': task.result,
            'reference_id': task.reference_id,
            'assigned_to_id': str(task.assigned_to_id) if task.assigned_to_id else None,
            'due_date': task.due_date.isoformat() if task.due_date else None,
            'started_at': task.started_at.isoformat() if task.started_at else None,
            'completed_at': task.completed_at.isoformat() if task.completed_at else None,
            'sequence': task.sequence,
            'is_blocked': task.is_blocked,
        }

        if include_details:
            data.update({
                'description': task.description,
                'target_ksi_id': str(task.target_ksi_id) if task.target_ksi_id else None,
                'target_control_id': str(task.target_control_id) if task.target_control_id else None,
                'target_system_id': str(task.target_system_id) if task.target_system_id else None,
                'test_procedures': task.test_procedures,
                'evidence': task.evidence,
                'findings': task.findings,
                'notes': task.notes,
                'score': float(task.score) if task.score else None,
                'max_score': float(task.max_score) if task.max_score else None,
            })

        return data

    def list(self, request):
        """List assessment tasks."""
        queryset = AssessmentTask.objects.all()

        # Filter by assessment
        assessment_id = request.query_params.get('assessment')
        if assessment_id:
            queryset = queryset.filter(master_assessment_id=assessment_id)

        # Filter by status
        task_status = request.query_params.get('status')
        if task_status:
            queryset = queryset.filter(status=task_status)

        # Filter by assigned user
        assigned_to = request.query_params.get('assigned_to')
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)

        queryset = queryset.order_by('sequence')[:200]
        data = [self.get_serializer_data(t) for t in queryset]

        return Response({
            'tasks': data,
            'total': len(data),
        })

    def retrieve(self, request, pk=None):
        """Get a specific task with details."""
        task = get_object_or_404(AssessmentTask, pk=pk)
        return Response(self.get_serializer_data(task, include_details=True))

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update task status and results."""
        task = get_object_or_404(AssessmentTask, pk=pk)
        service = get_assessment_service()

        updated_task = service.update_task_status(
            task_id=task.id,
            status=request.data.get('status', task.status),
            result=request.data.get('result'),
            findings=request.data.get('findings'),
            notes=request.data.get('notes'),
            score=request.data.get('score'),
            completed_by=request.user.id if request.user else None,
        )

        return Response(self.get_serializer_data(updated_task, include_details=True))

    @action(detail=True, methods=['post'])
    def add_evidence(self, request, pk=None):
        """Add evidence to a task."""
        task = get_object_or_404(AssessmentTask, pk=pk)

        evidence = task.evidence or []
        new_evidence = request.data.get('evidence', {})
        evidence.append(new_evidence)
        task.evidence = evidence
        task.save()

        return Response(self.get_serializer_data(task, include_details=True))

    @action(detail=True, methods=['post'])
    def add_finding(self, request, pk=None):
        """Add a finding to a task."""
        task = get_object_or_404(AssessmentTask, pk=pk)

        findings = task.findings or []
        new_finding = request.data.get('finding', {})
        findings.append(new_finding)
        task.findings = findings
        task.save()

        return Response(self.get_serializer_data(task, include_details=True))


# Analytics imports
from rest_framework.views import APIView
from .analytics import get_workflow_analytics
from datetime import datetime
from uuid import UUID


class WorkflowAnalyticsView(APIView):
    """Global workflow analytics."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get global workflow statistics."""
        analytics = get_workflow_analytics()
        return Response(analytics.get_global_statistics())


class WorkflowMetricsView(APIView):
    """Workflow metrics endpoint."""
    permission_classes = [IsAuthenticated]

    def get(self, request, workflow_id=None):
        """
        Get workflow metrics.

        Query params:
        - start_date: ISO date string
        - end_date: ISO date string
        """
        analytics = get_workflow_analytics()

        start_date = None
        end_date = None

        start_str = request.query_params.get('start_date')
        end_str = request.query_params.get('end_date')

        if start_str:
            start_date = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
        if end_str:
            end_date = datetime.fromisoformat(end_str.replace('Z', '+00:00'))

        workflow_uuid = UUID(workflow_id) if workflow_id else None
        metrics = analytics.get_workflow_metrics(
            workflow_id=workflow_uuid,
            start_date=start_date,
            end_date=end_date,
        )

        return Response({
            'metrics': [m.to_dict() for m in metrics],
            'total': len(metrics),
        })


class WorkflowStepPerformanceView(APIView):
    """Step performance analytics."""
    permission_classes = [IsAuthenticated]

    def get(self, request, workflow_id):
        """Get step performance for a workflow."""
        analytics = get_workflow_analytics()

        start_date = None
        end_date = None

        start_str = request.query_params.get('start_date')
        end_str = request.query_params.get('end_date')

        if start_str:
            start_date = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
        if end_str:
            end_date = datetime.fromisoformat(end_str.replace('Z', '+00:00'))

        performance = analytics.get_step_performance(
            workflow_id=UUID(workflow_id),
            start_date=start_date,
            end_date=end_date,
        )

        return Response({
            'steps': [p.to_dict() for p in performance],
            'total': len(performance),
            'bottlenecks': [p.node_id for p in performance if p.is_bottleneck],
        })


class WorkflowTrendsView(APIView):
    """Execution trends endpoint."""
    permission_classes = [IsAuthenticated]

    def get(self, request, workflow_id=None):
        """
        Get execution trends.

        Query params:
        - period: 'hour', 'day', 'week' (default: 'day')
        - start_date: ISO date string
        - end_date: ISO date string
        """
        analytics = get_workflow_analytics()

        period = request.query_params.get('period', 'day')
        start_date = None
        end_date = None

        start_str = request.query_params.get('start_date')
        end_str = request.query_params.get('end_date')

        if start_str:
            start_date = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
        if end_str:
            end_date = datetime.fromisoformat(end_str.replace('Z', '+00:00'))

        workflow_uuid = UUID(workflow_id) if workflow_id else None
        trends = analytics.get_execution_trends(
            workflow_id=workflow_uuid,
            period=period,
            start_date=start_date,
            end_date=end_date,
        )

        return Response({
            'trends': [t.to_dict() for t in trends],
            'period': period,
            'total_points': len(trends),
        })


class WorkflowOptimizationsView(APIView):
    """Optimization recommendations endpoint."""
    permission_classes = [IsAuthenticated]

    def get(self, request, workflow_id=None):
        """Get optimization recommendations."""
        analytics = get_workflow_analytics()

        workflow_uuid = UUID(workflow_id) if workflow_id else None
        recommendations = analytics.get_optimization_recommendations(
            workflow_id=workflow_uuid,
        )

        return Response({
            'recommendations': [r.to_dict() for r in recommendations],
            'total': len(recommendations),
            'by_priority': {
                'high': sum(1 for r in recommendations if r.priority == 'high'),
                'medium': sum(1 for r in recommendations if r.priority == 'medium'),
                'low': sum(1 for r in recommendations if r.priority == 'low'),
            },
        })
