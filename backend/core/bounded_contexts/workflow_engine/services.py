"""
Workflow Engine Services

Business logic for workflow management and execution.
"""

import logging
import json
import re
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction

from .models import (
    Workflow,
    WorkflowNode,
    WorkflowConnection,
    WorkflowExecution,
    WorkflowStep,
    WorkflowSchedule,
    WorkflowWebhook,
)

logger = logging.getLogger(__name__)


class WorkflowService:
    """
    Service for managing workflow definitions.
    """

    def create_workflow(
        self,
        name: str,
        description: str = '',
        trigger: Dict = None,
        created_by=None,
        **kwargs
    ) -> Workflow:
        """Create a new workflow."""
        workflow = Workflow.objects.create(
            name=name,
            description=description,
            trigger=trigger or {'type': 'manual', 'config': {}},
            created_by=created_by,
            owned_by=created_by,
            **kwargs
        )
        return workflow

    def update_workflow(
        self,
        workflow: Workflow,
        nodes: List[Dict],
        connections: List[Dict],
        trigger: Dict = None,
        variables: List[Dict] = None,
        **kwargs
    ) -> Workflow:
        """Update workflow definition with nodes and connections."""
        with transaction.atomic():
            # Update basic info
            for key, value in kwargs.items():
                if hasattr(workflow, key):
                    setattr(workflow, key, value)

            if trigger:
                workflow.trigger = trigger
            if variables:
                workflow.variables = variables

            workflow.save()

            # Clear existing nodes and connections
            workflow.nodes.all().delete()
            workflow.connections.all().delete()

            # Create new nodes
            for node_data in nodes:
                WorkflowNode.objects.create(
                    workflow=workflow,
                    node_id=node_data['id'],
                    node_type=node_data['type'],
                    name=node_data.get('name', ''),
                    position_x=node_data.get('position', {}).get('x', 0),
                    position_y=node_data.get('position', {}).get('y', 0),
                    config=node_data.get('config', {}),
                )

            # Create new connections
            for conn_data in connections:
                WorkflowConnection.objects.create(
                    workflow=workflow,
                    connection_id=conn_data['id'],
                    source_node_id=conn_data['sourceNodeId'],
                    source_port=conn_data['sourcePort'],
                    target_node_id=conn_data['targetNodeId'],
                    target_port=conn_data['targetPort'],
                    condition=conn_data.get('condition', ''),
                )

            workflow.version += 1
            workflow.save()

        return workflow

    def validate_workflow(self, workflow: Workflow) -> Dict:
        """Validate workflow definition."""
        errors = []
        warnings = []

        nodes = list(workflow.nodes.all())
        connections = list(workflow.connections.all())

        # Check for triggers
        triggers = [n for n in nodes if n.node_type.startswith('trigger_')]
        if not triggers:
            errors.append('Workflow must have at least one trigger node')

        # Check for end nodes
        end_nodes = [n for n in nodes if n.node_type.startswith('end_')]
        if not end_nodes:
            warnings.append('Workflow should have at least one end node')

        # Check for disconnected nodes
        node_ids = {n.node_id for n in nodes}
        connected_targets = {c.target_node_id for c in connections}
        connected_sources = {c.source_node_id for c in connections}

        for node in nodes:
            if not node.node_type.startswith('trigger_'):
                if node.node_id not in connected_targets:
                    errors.append(f'Node "{node.name}" has no incoming connections')

            if not node.node_type.startswith('end_'):
                if node.node_id not in connected_sources:
                    warnings.append(f'Node "{node.name}" has no outgoing connections')

        # Check for invalid connections
        for conn in connections:
            if conn.source_node_id not in node_ids:
                errors.append(f'Connection references non-existent source node: {conn.source_node_id}')
            if conn.target_node_id not in node_ids:
                errors.append(f'Connection references non-existent target node: {conn.target_node_id}')

        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
        }

    def duplicate_workflow(self, workflow: Workflow, new_name: str = None) -> Workflow:
        """Create a duplicate of a workflow."""
        new_workflow = Workflow.objects.create(
            name=new_name or f"{workflow.name} (Copy)",
            description=workflow.description,
            trigger=workflow.trigger,
            variables=workflow.variables,
            canvas_settings=workflow.canvas_settings,
            tags=workflow.tags,
            category=workflow.category,
            created_by=workflow.created_by,
            owned_by=workflow.owned_by,
        )

        # Copy nodes
        for node in workflow.nodes.all():
            WorkflowNode.objects.create(
                workflow=new_workflow,
                node_id=node.node_id,
                node_type=node.node_type,
                name=node.name,
                position_x=node.position_x,
                position_y=node.position_y,
                config=node.config,
            )

        # Copy connections
        for conn in workflow.connections.all():
            WorkflowConnection.objects.create(
                workflow=new_workflow,
                connection_id=conn.connection_id,
                source_node_id=conn.source_node_id,
                source_port=conn.source_port,
                target_node_id=conn.target_node_id,
                target_port=conn.target_port,
                condition=conn.condition,
            )

        return new_workflow

    def export_workflow(self, workflow: Workflow) -> Dict:
        """Export workflow to JSON format."""
        return {
            'name': workflow.name,
            'description': workflow.description,
            'version': workflow.version,
            'trigger': workflow.trigger,
            'variables': workflow.variables,
            'nodes': [
                {
                    'id': n.node_id,
                    'type': n.node_type,
                    'name': n.name,
                    'position': {'x': n.position_x, 'y': n.position_y},
                    'config': n.config,
                }
                for n in workflow.nodes.all()
            ],
            'connections': [
                {
                    'id': c.connection_id,
                    'sourceNodeId': c.source_node_id,
                    'sourcePort': c.source_port,
                    'targetNodeId': c.target_node_id,
                    'targetPort': c.target_port,
                    'condition': c.condition,
                }
                for c in workflow.connections.all()
            ],
        }

    def import_workflow(self, data: Dict, created_by=None) -> Workflow:
        """Import workflow from JSON format."""
        workflow = self.create_workflow(
            name=data['name'],
            description=data.get('description', ''),
            trigger=data.get('trigger', {'type': 'manual', 'config': {}}),
            variables=data.get('variables', []),
            created_by=created_by,
        )

        return self.update_workflow(
            workflow,
            nodes=data.get('nodes', []),
            connections=data.get('connections', []),
        )


class WorkflowExecutionEngine:
    """
    Engine for executing workflows.
    """

    def __init__(self):
        self.node_handlers = {
            # Triggers
            'trigger_manual': self._handle_trigger,
            'trigger_schedule': self._handle_trigger,
            'trigger_event': self._handle_trigger,
            'trigger_webhook': self._handle_trigger,
            # Actions
            'action_create': self._handle_action_create,
            'action_update': self._handle_action_update,
            'action_delete': self._handle_action_delete,
            'action_assign': self._handle_action_assign,
            'action_notify': self._handle_action_notify,
            'action_email': self._handle_action_email,
            'action_http': self._handle_action_http,
            'action_script': self._handle_action_script,
            # Logic
            'logic_condition': self._handle_logic_condition,
            'logic_switch': self._handle_logic_switch,
            'logic_loop': self._handle_logic_loop,
            'logic_delay': self._handle_logic_delay,
            'logic_parallel': self._handle_logic_parallel,
            # Data
            'data_query': self._handle_data_query,
            'data_transform': self._handle_data_transform,
            'data_filter': self._handle_data_filter,
            'data_aggregate': self._handle_data_aggregate,
            # Integration
            'integration_connector': self._handle_integration_connector,
            'integration_api': self._handle_integration_api,
            # End
            'end_success': self._handle_end_success,
            'end_failure': self._handle_end_failure,
        }

    def execute(
        self,
        workflow: Workflow,
        trigger_type: str = 'manual',
        trigger_data: Dict = None,
        executed_by=None,
    ) -> WorkflowExecution:
        """Execute a workflow."""
        # Create execution record
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=workflow.total_executions + 1,
            triggered_by=trigger_type,
            trigger_data=trigger_data or {},
            executed_by=executed_by,
            variables={v['name']: v.get('defaultValue') for v in workflow.variables},
        )

        try:
            execution.start()
            self._run_workflow(execution)
            execution.complete()
        except Exception as e:
            logger.error(f"Workflow execution failed: {e}")
            execution.fail(str(e))

        return execution

    def _run_workflow(self, execution: WorkflowExecution):
        """Run the workflow execution."""
        workflow = execution.workflow
        nodes = {n.node_id: n for n in workflow.nodes.all()}
        connections = list(workflow.connections.all())

        # Find trigger nodes
        trigger_nodes = [n for n in nodes.values() if n.node_type.startswith('trigger_')]
        if not trigger_nodes:
            raise ValueError("No trigger nodes found")

        # Build adjacency list
        adjacency = {}
        for conn in connections:
            if conn.source_node_id not in adjacency:
                adjacency[conn.source_node_id] = []
            adjacency[conn.source_node_id].append({
                'target': conn.target_node_id,
                'port': conn.target_port,
                'source_port': conn.source_port,
                'condition': conn.condition,
            })

        # Execute from trigger
        sequence = 0
        context = {
            'trigger_data': execution.trigger_data,
            'variables': execution.variables,
        }

        for trigger in trigger_nodes:
            sequence = self._execute_node(
                execution, trigger, context, adjacency, nodes, sequence
            )

        execution.context = context
        execution.save()

    def _execute_node(
        self,
        execution: WorkflowExecution,
        node: WorkflowNode,
        context: Dict,
        adjacency: Dict,
        all_nodes: Dict,
        sequence: int,
    ) -> int:
        """Execute a single node and its successors."""
        # Create step record
        step = WorkflowStep.objects.create(
            execution=execution,
            node_id=node.node_id,
            node_type=node.node_type,
            node_name=node.name,
            sequence=sequence,
            input_data=context,
        )

        try:
            step.start()

            # Get handler
            handler = self.node_handlers.get(node.node_type)
            if not handler:
                raise ValueError(f"Unknown node type: {node.node_type}")

            # Execute handler
            result = handler(node, context, execution)
            step.complete(result.get('output', {}))

            # Update context
            if result.get('output'):
                context[node.node_id] = result['output']

            # Get next nodes
            next_nodes = adjacency.get(node.node_id, [])
            next_port = result.get('next_port', 'out')

            for next_info in next_nodes:
                # Check if this connection matches the output port
                if next_info['source_port'] != next_port:
                    continue

                # Check condition if present
                if next_info['condition']:
                    if not self._evaluate_condition(next_info['condition'], context):
                        continue

                next_node = all_nodes.get(next_info['target'])
                if next_node:
                    sequence = self._execute_node(
                        execution, next_node, context, adjacency, all_nodes, sequence + 1
                    )

        except Exception as e:
            step.fail(str(e))
            raise

        return sequence

    def _evaluate_condition(self, condition: str, context: Dict) -> bool:
        """Evaluate a condition expression."""
        try:
            # Simple expression evaluation
            # Replace {{variable}} with actual values
            expr = condition
            for match in re.finditer(r'\{\{([^}]+)\}\}', condition):
                path = match.group(1).strip()
                value = self._resolve_path(path, context)
                expr = expr.replace(match.group(0), json.dumps(value))

            # Evaluate (simplified, in production use a proper expression evaluator)
            return eval(expr, {"__builtins__": {}}, {})
        except Exception as e:
            logger.warning(f"Condition evaluation failed: {e}")
            return False

    def _resolve_path(self, path: str, context: Dict) -> Any:
        """Resolve a dotted path in context."""
        parts = path.split('.')
        value = context
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        return value

    def _interpolate_string(self, template: str, context: Dict) -> str:
        """Interpolate {{expressions}} in a string."""
        result = template
        for match in re.finditer(r'\{\{([^}]+)\}\}', template):
            path = match.group(1).strip()
            value = self._resolve_path(path, context)
            result = result.replace(match.group(0), str(value) if value is not None else '')
        return result

    # Node Handlers

    def _handle_trigger(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle trigger nodes."""
        return {'output': context.get('trigger_data', {})}

    def _handle_action_create(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle create action."""
        config = node.config
        entity_type = config.get('entityType')
        data = config.get('data', {})

        # Interpolate data values
        interpolated_data = {}
        for key, value in data.items():
            if isinstance(value, str):
                interpolated_data[key] = self._interpolate_string(value, context)
            else:
                interpolated_data[key] = value

        # In production, actually create the record
        logger.info(f"Creating {entity_type} with data: {interpolated_data}")

        return {'output': {'created': True, 'entity_type': entity_type, 'data': interpolated_data}}

    def _handle_action_update(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle update action."""
        config = node.config
        entity_type = config.get('entityType')
        record_id = self._interpolate_string(config.get('recordId', ''), context)
        updates = config.get('updates', {})

        logger.info(f"Updating {entity_type} {record_id} with: {updates}")

        return {'output': {'updated': True, 'entity_type': entity_type, 'record_id': record_id}}

    def _handle_action_delete(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle delete action."""
        config = node.config
        entity_type = config.get('entityType')
        record_id = self._interpolate_string(config.get('recordId', ''), context)

        logger.info(f"Deleting {entity_type} {record_id}")

        return {'output': {'deleted': True, 'entity_type': entity_type, 'record_id': record_id}}

    def _handle_action_assign(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle assign action."""
        config = node.config
        assignee = self._interpolate_string(config.get('assignee', ''), context)

        logger.info(f"Assigning to: {assignee}")

        return {'output': {'assigned': True, 'assignee': assignee}}

    def _handle_action_notify(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle notification action."""
        config = node.config
        recipients = self._interpolate_string(config.get('recipients', ''), context)
        title = self._interpolate_string(config.get('title', ''), context)
        message = self._interpolate_string(config.get('message', ''), context)

        logger.info(f"Sending notification to {recipients}: {title}")

        return {'output': {'notified': True, 'recipients': recipients}}

    def _handle_action_email(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle email action."""
        config = node.config
        to = self._interpolate_string(config.get('to', ''), context)
        subject = self._interpolate_string(config.get('subject', ''), context)
        body = self._interpolate_string(config.get('body', ''), context)

        logger.info(f"Sending email to {to}: {subject}")

        return {'output': {'sent': True, 'to': to, 'subject': subject}}

    def _handle_action_http(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle HTTP request action."""
        import requests

        config = node.config
        method = config.get('method', 'GET')
        url = self._interpolate_string(config.get('url', ''), context)
        headers = config.get('headers', {})
        body = config.get('body')

        try:
            response = requests.request(method, url, headers=headers, json=body, timeout=30)
            return {
                'output': {
                    'status_code': response.status_code,
                    'body': response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text,
                }
            }
        except Exception as e:
            return {'output': {'error': str(e)}}

    def _handle_action_script(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle script action (placeholder)."""
        return {'output': {'executed': True}}

    def _handle_logic_condition(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle condition logic."""
        config = node.config
        condition = config.get('condition', 'true')

        result = self._evaluate_condition(condition, context)

        return {
            'output': {'condition_result': result},
            'next_port': 'true' if result else 'false',
        }

    def _handle_logic_switch(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle switch logic."""
        config = node.config
        expression = self._interpolate_string(config.get('expression', ''), context)
        cases = config.get('cases', {})

        next_port = 'default'
        for case_value, port in cases.items():
            if str(expression) == str(case_value):
                next_port = port
                break

        return {
            'output': {'switch_value': expression, 'matched_case': next_port},
            'next_port': next_port,
        }

    def _handle_logic_loop(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle loop logic."""
        # Loops are handled specially - for now just pass through
        return {'output': {'looped': True}}

    def _handle_logic_delay(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle delay logic."""
        import time

        config = node.config
        duration = config.get('duration', 0)
        unit = config.get('unit', 'seconds')

        multipliers = {'seconds': 1, 'minutes': 60, 'hours': 3600, 'days': 86400}
        sleep_seconds = duration * multipliers.get(unit, 1)

        # In production, use async or task queue
        time.sleep(min(sleep_seconds, 30))  # Cap at 30 seconds for demo

        return {'output': {'delayed': True, 'duration': duration, 'unit': unit}}

    def _handle_logic_parallel(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle parallel logic (placeholder)."""
        return {'output': {'parallel': True}}

    def _handle_data_query(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle data query."""
        config = node.config
        entity_type = config.get('entityType')
        filters = config.get('filters', {})
        limit = config.get('limit', 100)

        # In production, actually query the database
        logger.info(f"Querying {entity_type} with filters: {filters}")

        return {'output': {'results': [], 'count': 0}}

    def _handle_data_transform(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle data transformation."""
        config = node.config
        input_data = self._resolve_path(config.get('input', ''), context)
        transformation = config.get('transformation', {})

        # Apply transformation (simplified)
        result = input_data

        return {'output': {'result': result}}

    def _handle_data_filter(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle data filtering."""
        return {'output': {'filtered': []}}

    def _handle_data_aggregate(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle data aggregation."""
        return {'output': {'aggregated': {}}}

    def _handle_integration_connector(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle connector integration."""
        config = node.config
        connector_id = config.get('connectorId')
        operation = config.get('operation', 'sync')

        logger.info(f"Running connector {connector_id}: {operation}")

        return {'output': {'connector_result': {}}}

    def _handle_integration_api(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle API integration."""
        return self._handle_action_http(node, context, execution)

    def _handle_end_success(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle success end."""
        config = node.config
        message = config.get('message', 'Workflow completed successfully')

        return {'output': {'success': True, 'message': message}}

    def _handle_end_failure(self, node: WorkflowNode, context: Dict, execution: WorkflowExecution) -> Dict:
        """Handle failure end."""
        config = node.config
        message = config.get('message', 'Workflow failed')

        if config.get('notify', True):
            logger.warning(f"Workflow failure notification: {message}")

        raise Exception(message)


class WorkflowScheduler:
    """
    Scheduler for workflow executions.
    """

    def __init__(self):
        self.engine = WorkflowExecutionEngine()

    def process_schedules(self):
        """Process due workflow schedules."""
        now = timezone.now()

        # Find due schedules
        due_schedules = WorkflowSchedule.objects.filter(
            is_active=True,
            next_run_at__lte=now,
            workflow__status=Workflow.Status.ACTIVE,
        )

        for schedule in due_schedules:
            try:
                self._execute_schedule(schedule)
            except Exception as e:
                logger.error(f"Failed to execute schedule {schedule.id}: {e}")

    def _execute_schedule(self, schedule: WorkflowSchedule):
        """Execute a scheduled workflow."""
        # Check max runs
        if schedule.max_runs and schedule.run_count >= schedule.max_runs:
            schedule.is_active = False
            schedule.save()
            return

        # Execute workflow
        self.engine.execute(
            workflow=schedule.workflow,
            trigger_type='schedule',
            trigger_data={'schedule_id': str(schedule.id)},
        )

        # Update schedule
        schedule.run_count += 1
        schedule.last_run_at = timezone.now()
        schedule.next_run_at = self._calculate_next_run(schedule)
        schedule.save()

    def _calculate_next_run(self, schedule: WorkflowSchedule) -> Optional[datetime]:
        """Calculate next run time for a schedule."""
        if schedule.schedule_type == 'once':
            return None

        if schedule.schedule_type == 'interval':
            return timezone.now() + timedelta(minutes=schedule.interval_minutes or 60)

        if schedule.schedule_type == 'cron':
            # In production, use croniter library
            # For now, default to next hour
            return timezone.now() + timedelta(hours=1)

        return None

    def create_schedule(
        self,
        workflow: Workflow,
        name: str,
        schedule_type: str,
        **kwargs
    ) -> WorkflowSchedule:
        """Create a new workflow schedule."""
        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name=name,
            schedule_type=schedule_type,
            **kwargs
        )

        schedule.next_run_at = self._calculate_next_run(schedule)
        schedule.save()

        return schedule
