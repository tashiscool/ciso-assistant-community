"""
Workflow Templates

Pre-built workflow templates for common FedRAMP and GRC processes.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import UUID

from .models import Workflow, WorkflowNode, WorkflowConnection
from .services import WorkflowService


@dataclass
class WorkflowTemplate:
    """Definition of a workflow template."""

    id: str
    name: str
    description: str
    category: str
    tags: List[str] = field(default_factory=list)

    # Template definition
    trigger: Dict[str, Any] = field(default_factory=dict)
    variables: List[Dict[str, Any]] = field(default_factory=list)
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    connections: List[Dict[str, Any]] = field(default_factory=list)

    # Metadata
    version: str = '1.0'
    author: str = 'CISO Assistant'
    requires_integrations: List[str] = field(default_factory=list)


# =============================================================================
# Pre-built Workflow Templates
# =============================================================================

WORKFLOW_TEMPLATES: Dict[str, WorkflowTemplate] = {}


def _register_template(template: WorkflowTemplate):
    """Register a workflow template."""
    WORKFLOW_TEMPLATES[template.id] = template
    return template


# -----------------------------------------------------------------------------
# FedRAMP KSI Validation Workflow
# -----------------------------------------------------------------------------
_register_template(WorkflowTemplate(
    id='fedramp_ksi_validation',
    name='FedRAMP KSI Daily Validation',
    description='Automated daily validation of FedRAMP Key Security Indicators. '
                'Runs validation rules for all active KSIs and generates compliance report.',
    category='fedramp',
    tags=['fedramp', 'ksi', 'validation', 'compliance', 'daily'],
    trigger={
        'type': 'schedule',
        'config': {
            'schedule_type': 'cron',
            'cron_expression': '0 6 * * *',  # Daily at 6 AM
            'timezone': 'UTC',
        },
    },
    variables=[
        {'name': 'cso_id', 'type': 'uuid', 'description': 'Cloud Service Offering ID'},
        {'name': 'notify_on_failure', 'type': 'boolean', 'defaultValue': True},
        {'name': 'failure_threshold', 'type': 'number', 'defaultValue': 0},
    ],
    nodes=[
        {
            'id': 'trigger_1',
            'type': 'trigger_schedule',
            'name': 'Daily Schedule',
            'position': {'x': 100, 'y': 200},
            'config': {},
        },
        {
            'id': 'query_ksis',
            'type': 'data_query',
            'name': 'Get Active KSIs',
            'position': {'x': 300, 'y': 200},
            'config': {
                'entityType': 'KSIImplementation',
                'filters': {
                    'cloud_service_offering_id': '{{variables.cso_id}}',
                    'status__in': ['implemented', 'partially_implemented'],
                },
            },
        },
        {
            'id': 'loop_ksis',
            'type': 'logic_loop',
            'name': 'For Each KSI',
            'position': {'x': 500, 'y': 200},
            'config': {
                'collection': '{{query_ksis.results}}',
                'itemVariable': 'current_ksi',
            },
        },
        {
            'id': 'run_validation',
            'type': 'action_script',
            'name': 'Run Validation Rules',
            'position': {'x': 700, 'y': 200},
            'config': {
                'script': 'validate_ksi',
                'params': {
                    'ksi_id': '{{current_ksi.id}}',
                },
            },
        },
        {
            'id': 'check_result',
            'type': 'logic_condition',
            'name': 'Check Validation Result',
            'position': {'x': 900, 'y': 200},
            'config': {
                'condition': '{{run_validation.passed}} == true',
            },
        },
        {
            'id': 'update_ksi_pass',
            'type': 'action_update',
            'name': 'Update KSI Status (Pass)',
            'position': {'x': 1100, 'y': 100},
            'config': {
                'entityType': 'KSIImplementation',
                'recordId': '{{current_ksi.id}}',
                'updates': {
                    'last_validated': '{{now()}}',
                    'validation_status': 'passed',
                },
            },
        },
        {
            'id': 'update_ksi_fail',
            'type': 'action_update',
            'name': 'Update KSI Status (Fail)',
            'position': {'x': 1100, 'y': 300},
            'config': {
                'entityType': 'KSIImplementation',
                'recordId': '{{current_ksi.id}}',
                'updates': {
                    'last_validated': '{{now()}}',
                    'validation_status': 'failed',
                },
            },
        },
        {
            'id': 'aggregate_results',
            'type': 'data_aggregate',
            'name': 'Aggregate Results',
            'position': {'x': 1300, 'y': 200},
            'config': {
                'operations': [
                    {'field': 'passed', 'operation': 'count', 'filter': {'passed': True}},
                    {'field': 'failed', 'operation': 'count', 'filter': {'passed': False}},
                    {'field': 'total', 'operation': 'count'},
                ],
            },
        },
        {
            'id': 'check_failures',
            'type': 'logic_condition',
            'name': 'Check Failure Threshold',
            'position': {'x': 1500, 'y': 200},
            'config': {
                'condition': '{{aggregate_results.failed}} > {{variables.failure_threshold}} && {{variables.notify_on_failure}} == true',
            },
        },
        {
            'id': 'notify_failures',
            'type': 'action_notify',
            'name': 'Notify Stakeholders',
            'position': {'x': 1700, 'y': 100},
            'config': {
                'recipients': 'security-team',
                'title': 'KSI Validation Failures Detected',
                'message': '{{aggregate_results.failed}} KSIs failed validation. Review required.',
                'severity': 'high',
            },
        },
        {
            'id': 'generate_report',
            'type': 'action_create',
            'name': 'Generate Validation Report',
            'position': {'x': 1700, 'y': 300},
            'config': {
                'entityType': 'ValidationReport',
                'data': {
                    'cso_id': '{{variables.cso_id}}',
                    'report_date': '{{now()}}',
                    'total_ksis': '{{aggregate_results.total}}',
                    'passed': '{{aggregate_results.passed}}',
                    'failed': '{{aggregate_results.failed}}',
                    'compliance_rate': '{{aggregate_results.passed / aggregate_results.total * 100}}',
                },
            },
        },
        {
            'id': 'end_success',
            'type': 'end_success',
            'name': 'Validation Complete',
            'position': {'x': 1900, 'y': 200},
            'config': {
                'message': 'Daily KSI validation completed',
            },
        },
    ],
    connections=[
        {'id': 'c1', 'sourceNodeId': 'trigger_1', 'sourcePort': 'out', 'targetNodeId': 'query_ksis', 'targetPort': 'in'},
        {'id': 'c2', 'sourceNodeId': 'query_ksis', 'sourcePort': 'out', 'targetNodeId': 'loop_ksis', 'targetPort': 'in'},
        {'id': 'c3', 'sourceNodeId': 'loop_ksis', 'sourcePort': 'item', 'targetNodeId': 'run_validation', 'targetPort': 'in'},
        {'id': 'c4', 'sourceNodeId': 'run_validation', 'sourcePort': 'out', 'targetNodeId': 'check_result', 'targetPort': 'in'},
        {'id': 'c5', 'sourceNodeId': 'check_result', 'sourcePort': 'true', 'targetNodeId': 'update_ksi_pass', 'targetPort': 'in'},
        {'id': 'c6', 'sourceNodeId': 'check_result', 'sourcePort': 'false', 'targetNodeId': 'update_ksi_fail', 'targetPort': 'in'},
        {'id': 'c7', 'sourceNodeId': 'update_ksi_pass', 'sourcePort': 'out', 'targetNodeId': 'loop_ksis', 'targetPort': 'next'},
        {'id': 'c8', 'sourceNodeId': 'update_ksi_fail', 'sourcePort': 'out', 'targetNodeId': 'loop_ksis', 'targetPort': 'next'},
        {'id': 'c9', 'sourceNodeId': 'loop_ksis', 'sourcePort': 'done', 'targetNodeId': 'aggregate_results', 'targetPort': 'in'},
        {'id': 'c10', 'sourceNodeId': 'aggregate_results', 'sourcePort': 'out', 'targetNodeId': 'check_failures', 'targetPort': 'in'},
        {'id': 'c11', 'sourceNodeId': 'check_failures', 'sourcePort': 'true', 'targetNodeId': 'notify_failures', 'targetPort': 'in'},
        {'id': 'c12', 'sourceNodeId': 'check_failures', 'sourcePort': 'false', 'targetNodeId': 'generate_report', 'targetPort': 'in'},
        {'id': 'c13', 'sourceNodeId': 'notify_failures', 'sourcePort': 'out', 'targetNodeId': 'generate_report', 'targetPort': 'in'},
        {'id': 'c14', 'sourceNodeId': 'generate_report', 'sourcePort': 'out', 'targetNodeId': 'end_success', 'targetPort': 'in'},
    ],
))


# -----------------------------------------------------------------------------
# FedRAMP OAR Generation Workflow
# -----------------------------------------------------------------------------
_register_template(WorkflowTemplate(
    id='fedramp_oar_generation',
    name='FedRAMP Quarterly OAR Generation',
    description='Automated generation of FedRAMP Ongoing Authorization Report (OAR). '
                'Captures KSI snapshots, vulnerability data, incidents, and changes for the quarter.',
    category='fedramp',
    tags=['fedramp', 'oar', 'quarterly', 'report', 'authorization'],
    trigger={
        'type': 'schedule',
        'config': {
            'schedule_type': 'cron',
            'cron_expression': '0 8 1 1,4,7,10 *',  # First day of each quarter at 8 AM
            'timezone': 'UTC',
        },
    },
    variables=[
        {'name': 'cso_id', 'type': 'uuid', 'description': 'Cloud Service Offering ID'},
        {'name': 'year', 'type': 'number', 'description': 'Reporting year'},
        {'name': 'quarter', 'type': 'string', 'description': 'Quarter (Q1, Q2, Q3, Q4)'},
        {'name': 'include_ai_summary', 'type': 'boolean', 'defaultValue': False},
        {'name': 'auto_submit', 'type': 'boolean', 'defaultValue': False},
    ],
    nodes=[
        {
            'id': 'trigger_1',
            'type': 'trigger_schedule',
            'name': 'Quarterly Schedule',
            'position': {'x': 100, 'y': 300},
            'config': {},
        },
        {
            'id': 'create_oar',
            'type': 'action_create',
            'name': 'Create OAR Record',
            'position': {'x': 300, 'y': 300},
            'config': {
                'entityType': 'OngoingAuthorizationReport',
                'data': {
                    'cloud_service_offering_id': '{{variables.cso_id}}',
                    'year': '{{variables.year}}',
                    'quarter': '{{variables.quarter}}',
                    'status': 'draft',
                    'generated_at': '{{now()}}',
                },
            },
        },
        {
            'id': 'snapshot_ksis',
            'type': 'action_script',
            'name': 'Capture KSI Snapshot',
            'position': {'x': 500, 'y': 200},
            'config': {
                'script': 'capture_ksi_snapshot',
                'params': {
                    'oar_id': '{{create_oar.id}}',
                    'cso_id': '{{variables.cso_id}}',
                },
            },
        },
        {
            'id': 'snapshot_vulns',
            'type': 'action_script',
            'name': 'Capture Vulnerability Snapshot',
            'position': {'x': 500, 'y': 400},
            'config': {
                'script': 'capture_vulnerability_snapshot',
                'params': {
                    'oar_id': '{{create_oar.id}}',
                    'cso_id': '{{variables.cso_id}}',
                },
            },
        },
        {
            'id': 'parallel_join',
            'type': 'logic_parallel',
            'name': 'Join Snapshots',
            'position': {'x': 700, 'y': 300},
            'config': {'mode': 'join'},
        },
        {
            'id': 'query_incidents',
            'type': 'data_query',
            'name': 'Get Quarter Incidents',
            'position': {'x': 900, 'y': 200},
            'config': {
                'entityType': 'SecurityIncident',
                'filters': {
                    'cloud_service_offering_id': '{{variables.cso_id}}',
                    'reported_at__gte': '{{quarter_start_date}}',
                    'reported_at__lt': '{{quarter_end_date}}',
                },
            },
        },
        {
            'id': 'query_changes',
            'type': 'data_query',
            'name': 'Get Quarter Changes',
            'position': {'x': 900, 'y': 400},
            'config': {
                'entityType': 'SignificantChangeRequest',
                'filters': {
                    'cloud_service_offering_id': '{{variables.cso_id}}',
                    'created_at__gte': '{{quarter_start_date}}',
                    'created_at__lt': '{{quarter_end_date}}',
                },
            },
        },
        {
            'id': 'join_data',
            'type': 'logic_parallel',
            'name': 'Join Query Results',
            'position': {'x': 1100, 'y': 300},
            'config': {'mode': 'join'},
        },
        {
            'id': 'update_oar_data',
            'type': 'action_update',
            'name': 'Update OAR with Data',
            'position': {'x': 1300, 'y': 300},
            'config': {
                'entityType': 'OngoingAuthorizationReport',
                'recordId': '{{create_oar.id}}',
                'updates': {
                    'ksi_snapshot': '{{snapshot_ksis.data}}',
                    'vulnerability_snapshot': '{{snapshot_vulns.data}}',
                    'incidents': '{{query_incidents.results}}',
                    'significant_changes': '{{query_changes.results}}',
                },
            },
        },
        {
            'id': 'check_ai',
            'type': 'logic_condition',
            'name': 'Include AI Summary?',
            'position': {'x': 1500, 'y': 300},
            'config': {
                'condition': '{{variables.include_ai_summary}} == true',
            },
        },
        {
            'id': 'generate_ai_summary',
            'type': 'action_script',
            'name': 'Generate AI Summary',
            'position': {'x': 1700, 'y': 200},
            'config': {
                'script': 'ai_generate_oar_summary',
                'params': {
                    'oar_id': '{{create_oar.id}}',
                },
            },
        },
        {
            'id': 'finalize_oar',
            'type': 'action_update',
            'name': 'Finalize OAR',
            'position': {'x': 1900, 'y': 300},
            'config': {
                'entityType': 'OngoingAuthorizationReport',
                'recordId': '{{create_oar.id}}',
                'updates': {
                    'status': 'ready_for_review',
                    'finalized_at': '{{now()}}',
                },
            },
        },
        {
            'id': 'notify_reviewers',
            'type': 'action_notify',
            'name': 'Notify Reviewers',
            'position': {'x': 2100, 'y': 300},
            'config': {
                'recipients': 'authorizing-official',
                'title': 'OAR Ready for Review',
                'message': '{{variables.quarter}} {{variables.year}} OAR is ready for review.',
                'severity': 'medium',
            },
        },
        {
            'id': 'end_success',
            'type': 'end_success',
            'name': 'OAR Generation Complete',
            'position': {'x': 2300, 'y': 300},
            'config': {
                'message': 'OAR generated successfully',
            },
        },
    ],
    connections=[
        {'id': 'c1', 'sourceNodeId': 'trigger_1', 'sourcePort': 'out', 'targetNodeId': 'create_oar', 'targetPort': 'in'},
        {'id': 'c2', 'sourceNodeId': 'create_oar', 'sourcePort': 'out', 'targetNodeId': 'snapshot_ksis', 'targetPort': 'in'},
        {'id': 'c3', 'sourceNodeId': 'create_oar', 'sourcePort': 'out', 'targetNodeId': 'snapshot_vulns', 'targetPort': 'in'},
        {'id': 'c4', 'sourceNodeId': 'snapshot_ksis', 'sourcePort': 'out', 'targetNodeId': 'parallel_join', 'targetPort': 'in'},
        {'id': 'c5', 'sourceNodeId': 'snapshot_vulns', 'sourcePort': 'out', 'targetNodeId': 'parallel_join', 'targetPort': 'in'},
        {'id': 'c6', 'sourceNodeId': 'parallel_join', 'sourcePort': 'out', 'targetNodeId': 'query_incidents', 'targetPort': 'in'},
        {'id': 'c7', 'sourceNodeId': 'parallel_join', 'sourcePort': 'out', 'targetNodeId': 'query_changes', 'targetPort': 'in'},
        {'id': 'c8', 'sourceNodeId': 'query_incidents', 'sourcePort': 'out', 'targetNodeId': 'join_data', 'targetPort': 'in'},
        {'id': 'c9', 'sourceNodeId': 'query_changes', 'sourcePort': 'out', 'targetNodeId': 'join_data', 'targetPort': 'in'},
        {'id': 'c10', 'sourceNodeId': 'join_data', 'sourcePort': 'out', 'targetNodeId': 'update_oar_data', 'targetPort': 'in'},
        {'id': 'c11', 'sourceNodeId': 'update_oar_data', 'sourcePort': 'out', 'targetNodeId': 'check_ai', 'targetPort': 'in'},
        {'id': 'c12', 'sourceNodeId': 'check_ai', 'sourcePort': 'true', 'targetNodeId': 'generate_ai_summary', 'targetPort': 'in'},
        {'id': 'c13', 'sourceNodeId': 'check_ai', 'sourcePort': 'false', 'targetNodeId': 'finalize_oar', 'targetPort': 'in'},
        {'id': 'c14', 'sourceNodeId': 'generate_ai_summary', 'sourcePort': 'out', 'targetNodeId': 'finalize_oar', 'targetPort': 'in'},
        {'id': 'c15', 'sourceNodeId': 'finalize_oar', 'sourcePort': 'out', 'targetNodeId': 'notify_reviewers', 'targetPort': 'in'},
        {'id': 'c16', 'sourceNodeId': 'notify_reviewers', 'sourcePort': 'out', 'targetNodeId': 'end_success', 'targetPort': 'in'},
    ],
))


# -----------------------------------------------------------------------------
# Significant Change Notification (SCN) Workflow
# -----------------------------------------------------------------------------
_register_template(WorkflowTemplate(
    id='fedramp_scn_workflow',
    name='FedRAMP Significant Change Notification',
    description='Workflow for processing significant changes per FedRAMP requirements. '
                'Routes changes through appropriate review and notification channels based on impact.',
    category='fedramp',
    tags=['fedramp', 'scn', 'change', 'notification', 'compliance'],
    trigger={
        'type': 'event',
        'config': {
            'event_type': 'significant_change_created',
            'entity_type': 'SignificantChangeRequest',
        },
    },
    variables=[
        {'name': 'change_id', 'type': 'uuid', 'description': 'Change Request ID'},
        {'name': 'auto_approve_minor', 'type': 'boolean', 'defaultValue': False},
        {'name': 'notify_fedramp', 'type': 'boolean', 'defaultValue': True},
    ],
    nodes=[
        {
            'id': 'trigger_1',
            'type': 'trigger_event',
            'name': 'Change Created',
            'position': {'x': 100, 'y': 300},
            'config': {},
        },
        {
            'id': 'get_change',
            'type': 'data_query',
            'name': 'Get Change Details',
            'position': {'x': 300, 'y': 300},
            'config': {
                'entityType': 'SignificantChangeRequest',
                'filters': {'id': '{{variables.change_id}}'},
            },
        },
        {
            'id': 'check_impact',
            'type': 'logic_switch',
            'name': 'Check Impact Level',
            'position': {'x': 500, 'y': 300},
            'config': {
                'expression': '{{get_change.results[0].impact_level}}',
                'cases': {
                    'high': 'high_impact',
                    'moderate': 'moderate_impact',
                    'low': 'low_impact',
                },
            },
        },
        {
            'id': 'high_impact_review',
            'type': 'action_create',
            'name': 'Create High Impact Review',
            'position': {'x': 700, 'y': 100},
            'config': {
                'entityType': 'ReviewTask',
                'data': {
                    'related_to': '{{variables.change_id}}',
                    'review_type': 'high_impact_change',
                    'required_approvers': ['3pao', 'authorizing_official'],
                    'priority': 'critical',
                },
            },
        },
        {
            'id': 'notify_3pao',
            'type': 'action_notify',
            'name': 'Notify 3PAO',
            'position': {'x': 900, 'y': 100},
            'config': {
                'recipients': '3pao',
                'title': 'High Impact Change - Review Required',
                'message': 'A high impact change requires 3PAO review: {{get_change.results[0].title}}',
                'severity': 'critical',
            },
        },
        {
            'id': 'moderate_impact_review',
            'type': 'action_create',
            'name': 'Create Moderate Impact Review',
            'position': {'x': 700, 'y': 300},
            'config': {
                'entityType': 'ReviewTask',
                'data': {
                    'related_to': '{{variables.change_id}}',
                    'review_type': 'moderate_impact_change',
                    'required_approvers': ['security_officer'],
                    'priority': 'high',
                },
            },
        },
        {
            'id': 'low_impact_check',
            'type': 'logic_condition',
            'name': 'Auto-approve Minor?',
            'position': {'x': 700, 'y': 500},
            'config': {
                'condition': '{{variables.auto_approve_minor}} == true',
            },
        },
        {
            'id': 'auto_approve',
            'type': 'action_update',
            'name': 'Auto-approve Change',
            'position': {'x': 900, 'y': 450},
            'config': {
                'entityType': 'SignificantChangeRequest',
                'recordId': '{{variables.change_id}}',
                'updates': {
                    'status': 'approved',
                    'approved_by': 'auto',
                    'approved_at': '{{now()}}',
                },
            },
        },
        {
            'id': 'create_low_review',
            'type': 'action_create',
            'name': 'Create Low Impact Review',
            'position': {'x': 900, 'y': 550},
            'config': {
                'entityType': 'ReviewTask',
                'data': {
                    'related_to': '{{variables.change_id}}',
                    'review_type': 'low_impact_change',
                    'required_approvers': ['change_manager'],
                    'priority': 'medium',
                },
            },
        },
        {
            'id': 'join_reviews',
            'type': 'logic_parallel',
            'name': 'Join Review Paths',
            'position': {'x': 1100, 'y': 300},
            'config': {'mode': 'join'},
        },
        {
            'id': 'check_fedramp_notify',
            'type': 'logic_condition',
            'name': 'Notify FedRAMP?',
            'position': {'x': 1300, 'y': 300},
            'config': {
                'condition': '{{variables.notify_fedramp}} == true && {{get_change.results[0].impact_level}} != "low"',
            },
        },
        {
            'id': 'fedramp_notification',
            'type': 'action_http',
            'name': 'Submit FedRAMP Notification',
            'position': {'x': 1500, 'y': 200},
            'config': {
                'method': 'POST',
                'url': '{{fedramp_api_url}}/notifications/scn',
                'headers': {
                    'Authorization': 'Bearer {{fedramp_api_token}}',
                    'Content-Type': 'application/json',
                },
                'body': {
                    'cso_id': '{{get_change.results[0].cloud_service_offering_id}}',
                    'change_type': '{{get_change.results[0].change_type}}',
                    'impact_level': '{{get_change.results[0].impact_level}}',
                    'description': '{{get_change.results[0].description}}',
                    'planned_date': '{{get_change.results[0].planned_implementation_date}}',
                },
            },
        },
        {
            'id': 'update_status',
            'type': 'action_update',
            'name': 'Update Change Status',
            'position': {'x': 1700, 'y': 300},
            'config': {
                'entityType': 'SignificantChangeRequest',
                'recordId': '{{variables.change_id}}',
                'updates': {
                    'workflow_status': 'notification_sent',
                    'fedramp_notified': '{{check_fedramp_notify.condition_result}}',
                },
            },
        },
        {
            'id': 'end_success',
            'type': 'end_success',
            'name': 'SCN Process Complete',
            'position': {'x': 1900, 'y': 300},
            'config': {
                'message': 'Significant change notification processed',
            },
        },
    ],
    connections=[
        {'id': 'c1', 'sourceNodeId': 'trigger_1', 'sourcePort': 'out', 'targetNodeId': 'get_change', 'targetPort': 'in'},
        {'id': 'c2', 'sourceNodeId': 'get_change', 'sourcePort': 'out', 'targetNodeId': 'check_impact', 'targetPort': 'in'},
        {'id': 'c3', 'sourceNodeId': 'check_impact', 'sourcePort': 'high_impact', 'targetNodeId': 'high_impact_review', 'targetPort': 'in'},
        {'id': 'c4', 'sourceNodeId': 'check_impact', 'sourcePort': 'moderate_impact', 'targetNodeId': 'moderate_impact_review', 'targetPort': 'in'},
        {'id': 'c5', 'sourceNodeId': 'check_impact', 'sourcePort': 'low_impact', 'targetNodeId': 'low_impact_check', 'targetPort': 'in'},
        {'id': 'c6', 'sourceNodeId': 'high_impact_review', 'sourcePort': 'out', 'targetNodeId': 'notify_3pao', 'targetPort': 'in'},
        {'id': 'c7', 'sourceNodeId': 'notify_3pao', 'sourcePort': 'out', 'targetNodeId': 'join_reviews', 'targetPort': 'in'},
        {'id': 'c8', 'sourceNodeId': 'moderate_impact_review', 'sourcePort': 'out', 'targetNodeId': 'join_reviews', 'targetPort': 'in'},
        {'id': 'c9', 'sourceNodeId': 'low_impact_check', 'sourcePort': 'true', 'targetNodeId': 'auto_approve', 'targetPort': 'in'},
        {'id': 'c10', 'sourceNodeId': 'low_impact_check', 'sourcePort': 'false', 'targetNodeId': 'create_low_review', 'targetPort': 'in'},
        {'id': 'c11', 'sourceNodeId': 'auto_approve', 'sourcePort': 'out', 'targetNodeId': 'join_reviews', 'targetPort': 'in'},
        {'id': 'c12', 'sourceNodeId': 'create_low_review', 'sourcePort': 'out', 'targetNodeId': 'join_reviews', 'targetPort': 'in'},
        {'id': 'c13', 'sourceNodeId': 'join_reviews', 'sourcePort': 'out', 'targetNodeId': 'check_fedramp_notify', 'targetPort': 'in'},
        {'id': 'c14', 'sourceNodeId': 'check_fedramp_notify', 'sourcePort': 'true', 'targetNodeId': 'fedramp_notification', 'targetPort': 'in'},
        {'id': 'c15', 'sourceNodeId': 'check_fedramp_notify', 'sourcePort': 'false', 'targetNodeId': 'update_status', 'targetPort': 'in'},
        {'id': 'c16', 'sourceNodeId': 'fedramp_notification', 'sourcePort': 'out', 'targetNodeId': 'update_status', 'targetPort': 'in'},
        {'id': 'c17', 'sourceNodeId': 'update_status', 'sourcePort': 'out', 'targetNodeId': 'end_success', 'targetPort': 'in'},
    ],
))


# -----------------------------------------------------------------------------
# Risk Assessment Workflow
# -----------------------------------------------------------------------------
_register_template(WorkflowTemplate(
    id='risk_assessment_workflow',
    name='Risk Assessment Automation',
    description='Automated risk assessment workflow. Identifies threats, calculates risk scores, '
                'creates risk scenarios, and generates treatment recommendations.',
    category='risk',
    tags=['risk', 'assessment', 'threats', 'analysis'],
    trigger={
        'type': 'manual',
        'config': {},
    },
    variables=[
        {'name': 'scope_id', 'type': 'uuid', 'description': 'Assessment scope (perimeter/system ID)'},
        {'name': 'methodology', 'type': 'string', 'defaultValue': 'qualitative'},
        {'name': 'threat_library', 'type': 'string', 'defaultValue': 'mitre_att&ck'},
        {'name': 'auto_generate_scenarios', 'type': 'boolean', 'defaultValue': True},
    ],
    nodes=[
        {
            'id': 'trigger_1',
            'type': 'trigger_manual',
            'name': 'Start Assessment',
            'position': {'x': 100, 'y': 300},
            'config': {},
        },
        {
            'id': 'create_assessment',
            'type': 'action_create',
            'name': 'Create Risk Assessment',
            'position': {'x': 300, 'y': 300},
            'config': {
                'entityType': 'RiskAssessment',
                'data': {
                    'scope_id': '{{variables.scope_id}}',
                    'methodology': '{{variables.methodology}}',
                    'status': 'in_progress',
                    'started_at': '{{now()}}',
                },
            },
        },
        {
            'id': 'query_assets',
            'type': 'data_query',
            'name': 'Get Assets in Scope',
            'position': {'x': 500, 'y': 200},
            'config': {
                'entityType': 'Asset',
                'filters': {
                    'perimeter_id': '{{variables.scope_id}}',
                    'is_active': True,
                },
            },
        },
        {
            'id': 'query_threats',
            'type': 'data_query',
            'name': 'Get Threat Library',
            'position': {'x': 500, 'y': 400},
            'config': {
                'entityType': 'Threat',
                'filters': {
                    'library': '{{variables.threat_library}}',
                },
            },
        },
        {
            'id': 'join_data',
            'type': 'logic_parallel',
            'name': 'Join Asset & Threat Data',
            'position': {'x': 700, 'y': 300},
            'config': {'mode': 'join'},
        },
        {
            'id': 'check_auto_scenarios',
            'type': 'logic_condition',
            'name': 'Auto-generate Scenarios?',
            'position': {'x': 900, 'y': 300},
            'config': {
                'condition': '{{variables.auto_generate_scenarios}} == true',
            },
        },
        {
            'id': 'generate_scenarios',
            'type': 'action_script',
            'name': 'Generate Risk Scenarios',
            'position': {'x': 1100, 'y': 200},
            'config': {
                'script': 'generate_risk_scenarios',
                'params': {
                    'assessment_id': '{{create_assessment.id}}',
                    'assets': '{{query_assets.results}}',
                    'threats': '{{query_threats.results}}',
                    'methodology': '{{variables.methodology}}',
                },
            },
        },
        {
            'id': 'loop_scenarios',
            'type': 'logic_loop',
            'name': 'For Each Scenario',
            'position': {'x': 1300, 'y': 300},
            'config': {
                'collection': '{{generate_scenarios.scenarios}}',
                'itemVariable': 'current_scenario',
            },
        },
        {
            'id': 'calculate_risk',
            'type': 'action_script',
            'name': 'Calculate Risk Score',
            'position': {'x': 1500, 'y': 300},
            'config': {
                'script': 'calculate_risk_score',
                'params': {
                    'scenario': '{{current_scenario}}',
                    'methodology': '{{variables.methodology}}',
                },
            },
        },
        {
            'id': 'create_scenario',
            'type': 'action_create',
            'name': 'Save Risk Scenario',
            'position': {'x': 1700, 'y': 300},
            'config': {
                'entityType': 'RiskScenario',
                'data': {
                    'assessment_id': '{{create_assessment.id}}',
                    'threat_id': '{{current_scenario.threat_id}}',
                    'asset_id': '{{current_scenario.asset_id}}',
                    'likelihood': '{{calculate_risk.likelihood}}',
                    'impact': '{{calculate_risk.impact}}',
                    'current_risk': '{{calculate_risk.risk_score}}',
                    'risk_level': '{{calculate_risk.risk_level}}',
                },
            },
        },
        {
            'id': 'aggregate_risks',
            'type': 'data_aggregate',
            'name': 'Aggregate Risk Summary',
            'position': {'x': 1900, 'y': 300},
            'config': {
                'operations': [
                    {'field': 'critical', 'operation': 'count', 'filter': {'risk_level': 'critical'}},
                    {'field': 'high', 'operation': 'count', 'filter': {'risk_level': 'high'}},
                    {'field': 'medium', 'operation': 'count', 'filter': {'risk_level': 'medium'}},
                    {'field': 'low', 'operation': 'count', 'filter': {'risk_level': 'low'}},
                    {'field': 'avg_risk', 'operation': 'average', 'sourceField': 'current_risk'},
                ],
            },
        },
        {
            'id': 'finalize_assessment',
            'type': 'action_update',
            'name': 'Finalize Assessment',
            'position': {'x': 2100, 'y': 300},
            'config': {
                'entityType': 'RiskAssessment',
                'recordId': '{{create_assessment.id}}',
                'updates': {
                    'status': 'completed',
                    'completed_at': '{{now()}}',
                    'summary': '{{aggregate_risks}}',
                },
            },
        },
        {
            'id': 'notify_risk_owner',
            'type': 'action_notify',
            'name': 'Notify Risk Owner',
            'position': {'x': 2300, 'y': 300},
            'config': {
                'recipients': 'risk-owner',
                'title': 'Risk Assessment Complete',
                'message': 'Risk assessment completed. Critical: {{aggregate_risks.critical}}, High: {{aggregate_risks.high}}',
                'severity': 'medium',
            },
        },
        {
            'id': 'end_success',
            'type': 'end_success',
            'name': 'Assessment Complete',
            'position': {'x': 2500, 'y': 300},
            'config': {
                'message': 'Risk assessment completed successfully',
            },
        },
    ],
    connections=[
        {'id': 'c1', 'sourceNodeId': 'trigger_1', 'sourcePort': 'out', 'targetNodeId': 'create_assessment', 'targetPort': 'in'},
        {'id': 'c2', 'sourceNodeId': 'create_assessment', 'sourcePort': 'out', 'targetNodeId': 'query_assets', 'targetPort': 'in'},
        {'id': 'c3', 'sourceNodeId': 'create_assessment', 'sourcePort': 'out', 'targetNodeId': 'query_threats', 'targetPort': 'in'},
        {'id': 'c4', 'sourceNodeId': 'query_assets', 'sourcePort': 'out', 'targetNodeId': 'join_data', 'targetPort': 'in'},
        {'id': 'c5', 'sourceNodeId': 'query_threats', 'sourcePort': 'out', 'targetNodeId': 'join_data', 'targetPort': 'in'},
        {'id': 'c6', 'sourceNodeId': 'join_data', 'sourcePort': 'out', 'targetNodeId': 'check_auto_scenarios', 'targetPort': 'in'},
        {'id': 'c7', 'sourceNodeId': 'check_auto_scenarios', 'sourcePort': 'true', 'targetNodeId': 'generate_scenarios', 'targetPort': 'in'},
        {'id': 'c8', 'sourceNodeId': 'check_auto_scenarios', 'sourcePort': 'false', 'targetNodeId': 'loop_scenarios', 'targetPort': 'in'},
        {'id': 'c9', 'sourceNodeId': 'generate_scenarios', 'sourcePort': 'out', 'targetNodeId': 'loop_scenarios', 'targetPort': 'in'},
        {'id': 'c10', 'sourceNodeId': 'loop_scenarios', 'sourcePort': 'item', 'targetNodeId': 'calculate_risk', 'targetPort': 'in'},
        {'id': 'c11', 'sourceNodeId': 'calculate_risk', 'sourcePort': 'out', 'targetNodeId': 'create_scenario', 'targetPort': 'in'},
        {'id': 'c12', 'sourceNodeId': 'create_scenario', 'sourcePort': 'out', 'targetNodeId': 'loop_scenarios', 'targetPort': 'next'},
        {'id': 'c13', 'sourceNodeId': 'loop_scenarios', 'sourcePort': 'done', 'targetNodeId': 'aggregate_risks', 'targetPort': 'in'},
        {'id': 'c14', 'sourceNodeId': 'aggregate_risks', 'sourcePort': 'out', 'targetNodeId': 'finalize_assessment', 'targetPort': 'in'},
        {'id': 'c15', 'sourceNodeId': 'finalize_assessment', 'sourcePort': 'out', 'targetNodeId': 'notify_risk_owner', 'targetPort': 'in'},
        {'id': 'c16', 'sourceNodeId': 'notify_risk_owner', 'sourcePort': 'out', 'targetNodeId': 'end_success', 'targetPort': 'in'},
    ],
))


# -----------------------------------------------------------------------------
# Incident Response Workflow
# -----------------------------------------------------------------------------
_register_template(WorkflowTemplate(
    id='incident_response_workflow',
    name='Incident Response Playbook',
    description='Automated incident response workflow following NIST SP 800-61 guidelines. '
                'Handles detection, analysis, containment, eradication, and recovery phases.',
    category='incident',
    tags=['incident', 'response', 'security', 'nist', 'playbook'],
    trigger={
        'type': 'event',
        'config': {
            'event_type': 'security_incident_created',
            'entity_type': 'SecurityIncident',
        },
    },
    variables=[
        {'name': 'incident_id', 'type': 'uuid', 'description': 'Security Incident ID'},
        {'name': 'auto_contain', 'type': 'boolean', 'defaultValue': False},
        {'name': 'notify_legal', 'type': 'boolean', 'defaultValue': False},
        {'name': 'notify_fedramp', 'type': 'boolean', 'defaultValue': True},
    ],
    nodes=[
        {
            'id': 'trigger_1',
            'type': 'trigger_event',
            'name': 'Incident Created',
            'position': {'x': 100, 'y': 300},
            'config': {},
        },
        {
            'id': 'get_incident',
            'type': 'data_query',
            'name': 'Get Incident Details',
            'position': {'x': 300, 'y': 300},
            'config': {
                'entityType': 'SecurityIncident',
                'filters': {'id': '{{variables.incident_id}}'},
            },
        },
        {
            'id': 'check_severity',
            'type': 'logic_switch',
            'name': 'Check Severity',
            'position': {'x': 500, 'y': 300},
            'config': {
                'expression': '{{get_incident.results[0].severity}}',
                'cases': {
                    'critical': 'critical_path',
                    'high': 'high_path',
                    'medium': 'medium_path',
                    'low': 'low_path',
                },
            },
        },
        {
            'id': 'critical_response',
            'type': 'action_notify',
            'name': 'Alert Critical Response Team',
            'position': {'x': 700, 'y': 100},
            'config': {
                'recipients': 'incident-response-team,executive-team',
                'title': 'CRITICAL Security Incident',
                'message': 'Critical security incident requires immediate response: {{get_incident.results[0].title}}',
                'severity': 'critical',
                'channels': ['sms', 'email', 'slack'],
            },
        },
        {
            'id': 'high_response',
            'type': 'action_notify',
            'name': 'Alert IRT',
            'position': {'x': 700, 'y': 250},
            'config': {
                'recipients': 'incident-response-team',
                'title': 'HIGH Severity Security Incident',
                'message': 'High severity incident: {{get_incident.results[0].title}}',
                'severity': 'high',
            },
        },
        {
            'id': 'medium_response',
            'type': 'action_notify',
            'name': 'Alert Security Team',
            'position': {'x': 700, 'y': 400},
            'config': {
                'recipients': 'security-team',
                'title': 'MEDIUM Severity Security Incident',
                'message': 'Medium severity incident: {{get_incident.results[0].title}}',
                'severity': 'medium',
            },
        },
        {
            'id': 'low_response',
            'type': 'action_notify',
            'name': 'Log Low Severity',
            'position': {'x': 700, 'y': 550},
            'config': {
                'recipients': 'security-ops',
                'title': 'Low Severity Security Incident',
                'message': 'Low severity incident logged: {{get_incident.results[0].title}}',
                'severity': 'low',
            },
        },
        {
            'id': 'join_severity',
            'type': 'logic_parallel',
            'name': 'Join Severity Paths',
            'position': {'x': 900, 'y': 300},
            'config': {'mode': 'join'},
        },
        {
            'id': 'create_timeline',
            'type': 'action_create',
            'name': 'Create Incident Timeline',
            'position': {'x': 1100, 'y': 300},
            'config': {
                'entityType': 'IncidentTimeline',
                'data': {
                    'incident_id': '{{variables.incident_id}}',
                    'event': 'Incident reported',
                    'timestamp': '{{now()}}',
                    'phase': 'detection',
                },
            },
        },
        {
            'id': 'check_auto_contain',
            'type': 'logic_condition',
            'name': 'Auto-containment Enabled?',
            'position': {'x': 1300, 'y': 300},
            'config': {
                'condition': '{{variables.auto_contain}} == true && {{get_incident.results[0].severity}} in ["critical", "high"]',
            },
        },
        {
            'id': 'auto_containment',
            'type': 'action_script',
            'name': 'Execute Containment',
            'position': {'x': 1500, 'y': 200},
            'config': {
                'script': 'execute_containment',
                'params': {
                    'incident_id': '{{variables.incident_id}}',
                    'incident_type': '{{get_incident.results[0].incident_type}}',
                    'affected_systems': '{{get_incident.results[0].affected_systems}}',
                },
            },
        },
        {
            'id': 'update_phase_containment',
            'type': 'action_update',
            'name': 'Update Phase: Containment',
            'position': {'x': 1700, 'y': 200},
            'config': {
                'entityType': 'SecurityIncident',
                'recordId': '{{variables.incident_id}}',
                'updates': {
                    'status': 'containment',
                    'containment_started': '{{now()}}',
                },
            },
        },
        {
            'id': 'join_containment',
            'type': 'logic_parallel',
            'name': 'Join Containment',
            'position': {'x': 1900, 'y': 300},
            'config': {'mode': 'join'},
        },
        {
            'id': 'check_fedramp_notify',
            'type': 'logic_condition',
            'name': 'Notify FedRAMP?',
            'position': {'x': 2100, 'y': 300},
            'config': {
                'condition': '{{variables.notify_fedramp}} == true && {{get_incident.results[0].severity}} in ["critical", "high"]',
            },
        },
        {
            'id': 'fedramp_notification',
            'type': 'action_http',
            'name': 'Submit FedRAMP Incident Report',
            'position': {'x': 2300, 'y': 200},
            'config': {
                'method': 'POST',
                'url': '{{fedramp_api_url}}/incidents',
                'headers': {
                    'Authorization': 'Bearer {{fedramp_api_token}}',
                    'Content-Type': 'application/json',
                },
                'body': {
                    'incident_type': '{{get_incident.results[0].incident_type}}',
                    'severity': '{{get_incident.results[0].severity}}',
                    'description': '{{get_incident.results[0].description}}',
                    'reported_at': '{{get_incident.results[0].reported_at}}',
                    'impact': '{{get_incident.results[0].impact_assessment}}',
                },
            },
        },
        {
            'id': 'check_legal_notify',
            'type': 'logic_condition',
            'name': 'Notify Legal?',
            'position': {'x': 2300, 'y': 400},
            'config': {
                'condition': '{{variables.notify_legal}} == true && {{get_incident.results[0].data_breach}} == true',
            },
        },
        {
            'id': 'legal_notification',
            'type': 'action_notify',
            'name': 'Notify Legal Team',
            'position': {'x': 2500, 'y': 400},
            'config': {
                'recipients': 'legal-team',
                'title': 'Potential Data Breach - Legal Review Required',
                'message': 'Security incident may involve data breach. Review required for {{get_incident.results[0].title}}',
                'severity': 'high',
            },
        },
        {
            'id': 'join_notifications',
            'type': 'logic_parallel',
            'name': 'Join Notifications',
            'position': {'x': 2700, 'y': 300},
            'config': {'mode': 'join'},
        },
        {
            'id': 'assign_investigator',
            'type': 'action_assign',
            'name': 'Assign Investigator',
            'position': {'x': 2900, 'y': 300},
            'config': {
                'assignee': '{{get_round_robin_assignee("incident-response-team")}}',
                'entity_type': 'SecurityIncident',
                'entity_id': '{{variables.incident_id}}',
            },
        },
        {
            'id': 'end_success',
            'type': 'end_success',
            'name': 'Initial Response Complete',
            'position': {'x': 3100, 'y': 300},
            'config': {
                'message': 'Initial incident response workflow completed',
            },
        },
    ],
    connections=[
        {'id': 'c1', 'sourceNodeId': 'trigger_1', 'sourcePort': 'out', 'targetNodeId': 'get_incident', 'targetPort': 'in'},
        {'id': 'c2', 'sourceNodeId': 'get_incident', 'sourcePort': 'out', 'targetNodeId': 'check_severity', 'targetPort': 'in'},
        {'id': 'c3', 'sourceNodeId': 'check_severity', 'sourcePort': 'critical_path', 'targetNodeId': 'critical_response', 'targetPort': 'in'},
        {'id': 'c4', 'sourceNodeId': 'check_severity', 'sourcePort': 'high_path', 'targetNodeId': 'high_response', 'targetPort': 'in'},
        {'id': 'c5', 'sourceNodeId': 'check_severity', 'sourcePort': 'medium_path', 'targetNodeId': 'medium_response', 'targetPort': 'in'},
        {'id': 'c6', 'sourceNodeId': 'check_severity', 'sourcePort': 'low_path', 'targetNodeId': 'low_response', 'targetPort': 'in'},
        {'id': 'c7', 'sourceNodeId': 'critical_response', 'sourcePort': 'out', 'targetNodeId': 'join_severity', 'targetPort': 'in'},
        {'id': 'c8', 'sourceNodeId': 'high_response', 'sourcePort': 'out', 'targetNodeId': 'join_severity', 'targetPort': 'in'},
        {'id': 'c9', 'sourceNodeId': 'medium_response', 'sourcePort': 'out', 'targetNodeId': 'join_severity', 'targetPort': 'in'},
        {'id': 'c10', 'sourceNodeId': 'low_response', 'sourcePort': 'out', 'targetNodeId': 'join_severity', 'targetPort': 'in'},
        {'id': 'c11', 'sourceNodeId': 'join_severity', 'sourcePort': 'out', 'targetNodeId': 'create_timeline', 'targetPort': 'in'},
        {'id': 'c12', 'sourceNodeId': 'create_timeline', 'sourcePort': 'out', 'targetNodeId': 'check_auto_contain', 'targetPort': 'in'},
        {'id': 'c13', 'sourceNodeId': 'check_auto_contain', 'sourcePort': 'true', 'targetNodeId': 'auto_containment', 'targetPort': 'in'},
        {'id': 'c14', 'sourceNodeId': 'check_auto_contain', 'sourcePort': 'false', 'targetNodeId': 'join_containment', 'targetPort': 'in'},
        {'id': 'c15', 'sourceNodeId': 'auto_containment', 'sourcePort': 'out', 'targetNodeId': 'update_phase_containment', 'targetPort': 'in'},
        {'id': 'c16', 'sourceNodeId': 'update_phase_containment', 'sourcePort': 'out', 'targetNodeId': 'join_containment', 'targetPort': 'in'},
        {'id': 'c17', 'sourceNodeId': 'join_containment', 'sourcePort': 'out', 'targetNodeId': 'check_fedramp_notify', 'targetPort': 'in'},
        {'id': 'c18', 'sourceNodeId': 'check_fedramp_notify', 'sourcePort': 'true', 'targetNodeId': 'fedramp_notification', 'targetPort': 'in'},
        {'id': 'c19', 'sourceNodeId': 'check_fedramp_notify', 'sourcePort': 'false', 'targetNodeId': 'check_legal_notify', 'targetPort': 'in'},
        {'id': 'c20', 'sourceNodeId': 'fedramp_notification', 'sourcePort': 'out', 'targetNodeId': 'check_legal_notify', 'targetPort': 'in'},
        {'id': 'c21', 'sourceNodeId': 'check_legal_notify', 'sourcePort': 'true', 'targetNodeId': 'legal_notification', 'targetPort': 'in'},
        {'id': 'c22', 'sourceNodeId': 'check_legal_notify', 'sourcePort': 'false', 'targetNodeId': 'join_notifications', 'targetPort': 'in'},
        {'id': 'c23', 'sourceNodeId': 'legal_notification', 'sourcePort': 'out', 'targetNodeId': 'join_notifications', 'targetPort': 'in'},
        {'id': 'c24', 'sourceNodeId': 'join_notifications', 'sourcePort': 'out', 'targetNodeId': 'assign_investigator', 'targetPort': 'in'},
        {'id': 'c25', 'sourceNodeId': 'assign_investigator', 'sourcePort': 'out', 'targetNodeId': 'end_success', 'targetPort': 'in'},
    ],
))


# -----------------------------------------------------------------------------
# POAM Remediation Workflow
# -----------------------------------------------------------------------------
_register_template(WorkflowTemplate(
    id='poam_remediation_workflow',
    name='POA&M Remediation Tracking',
    description='Workflow for tracking and managing Plan of Action & Milestones remediation. '
                'Monitors deadlines, sends reminders, and escalates overdue items.',
    category='compliance',
    tags=['poam', 'remediation', 'compliance', 'tracking'],
    trigger={
        'type': 'schedule',
        'config': {
            'schedule_type': 'cron',
            'cron_expression': '0 9 * * 1-5',  # Weekdays at 9 AM
            'timezone': 'UTC',
        },
    },
    variables=[
        {'name': 'reminder_days', 'type': 'number', 'defaultValue': 7},
        {'name': 'escalation_days', 'type': 'number', 'defaultValue': 0},
        {'name': 'auto_extend', 'type': 'boolean', 'defaultValue': False},
    ],
    nodes=[
        {
            'id': 'trigger_1',
            'type': 'trigger_schedule',
            'name': 'Daily Check',
            'position': {'x': 100, 'y': 300},
            'config': {},
        },
        {
            'id': 'query_open_poams',
            'type': 'data_query',
            'name': 'Get Open POA&Ms',
            'position': {'x': 300, 'y': 300},
            'config': {
                'entityType': 'AppliedControl',
                'filters': {
                    'status__in': ['open', 'in_progress'],
                    'is_poam': True,
                },
            },
        },
        {
            'id': 'loop_poams',
            'type': 'logic_loop',
            'name': 'For Each POA&M',
            'position': {'x': 500, 'y': 300},
            'config': {
                'collection': '{{query_open_poams.results}}',
                'itemVariable': 'current_poam',
            },
        },
        {
            'id': 'check_due_date',
            'type': 'logic_switch',
            'name': 'Check Due Date',
            'position': {'x': 700, 'y': 300},
            'config': {
                'expression': '{{days_until(current_poam.due_date)}}',
                'cases': {
                    'overdue': 'overdue',
                    'due_soon': 'reminder',
                    'on_track': 'skip',
                },
            },
        },
        {
            'id': 'overdue_escalation',
            'type': 'action_notify',
            'name': 'Escalate Overdue',
            'position': {'x': 900, 'y': 150},
            'config': {
                'recipients': '{{current_poam.owner}},management',
                'title': 'OVERDUE: POA&M Item Requires Immediate Attention',
                'message': 'POA&M item "{{current_poam.name}}" is {{abs(days_until(current_poam.due_date))}} days overdue.',
                'severity': 'critical',
            },
        },
        {
            'id': 'reminder_notification',
            'type': 'action_notify',
            'name': 'Send Reminder',
            'position': {'x': 900, 'y': 300},
            'config': {
                'recipients': '{{current_poam.owner}}',
                'title': 'POA&M Deadline Approaching',
                'message': 'POA&M item "{{current_poam.name}}" is due in {{days_until(current_poam.due_date)}} days.',
                'severity': 'medium',
            },
        },
        {
            'id': 'skip_node',
            'type': 'action_script',
            'name': 'Skip (On Track)',
            'position': {'x': 900, 'y': 450},
            'config': {
                'script': 'noop',
            },
        },
        {
            'id': 'join_paths',
            'type': 'logic_parallel',
            'name': 'Join Paths',
            'position': {'x': 1100, 'y': 300},
            'config': {'mode': 'join'},
        },
        {
            'id': 'aggregate_status',
            'type': 'data_aggregate',
            'name': 'Aggregate Status',
            'position': {'x': 1300, 'y': 300},
            'config': {
                'operations': [
                    {'field': 'overdue', 'operation': 'count', 'filter': {'status': 'overdue'}},
                    {'field': 'due_soon', 'operation': 'count', 'filter': {'status': 'reminder'}},
                    {'field': 'on_track', 'operation': 'count', 'filter': {'status': 'skip'}},
                ],
            },
        },
        {
            'id': 'generate_report',
            'type': 'action_create',
            'name': 'Generate Daily Report',
            'position': {'x': 1500, 'y': 300},
            'config': {
                'entityType': 'POAMStatusReport',
                'data': {
                    'report_date': '{{now()}}',
                    'overdue_count': '{{aggregate_status.overdue}}',
                    'due_soon_count': '{{aggregate_status.due_soon}}',
                    'on_track_count': '{{aggregate_status.on_track}}',
                },
            },
        },
        {
            'id': 'end_success',
            'type': 'end_success',
            'name': 'Check Complete',
            'position': {'x': 1700, 'y': 300},
            'config': {
                'message': 'POA&M status check completed',
            },
        },
    ],
    connections=[
        {'id': 'c1', 'sourceNodeId': 'trigger_1', 'sourcePort': 'out', 'targetNodeId': 'query_open_poams', 'targetPort': 'in'},
        {'id': 'c2', 'sourceNodeId': 'query_open_poams', 'sourcePort': 'out', 'targetNodeId': 'loop_poams', 'targetPort': 'in'},
        {'id': 'c3', 'sourceNodeId': 'loop_poams', 'sourcePort': 'item', 'targetNodeId': 'check_due_date', 'targetPort': 'in'},
        {'id': 'c4', 'sourceNodeId': 'check_due_date', 'sourcePort': 'overdue', 'targetNodeId': 'overdue_escalation', 'targetPort': 'in'},
        {'id': 'c5', 'sourceNodeId': 'check_due_date', 'sourcePort': 'reminder', 'targetNodeId': 'reminder_notification', 'targetPort': 'in'},
        {'id': 'c6', 'sourceNodeId': 'check_due_date', 'sourcePort': 'skip', 'targetNodeId': 'skip_node', 'targetPort': 'in'},
        {'id': 'c7', 'sourceNodeId': 'overdue_escalation', 'sourcePort': 'out', 'targetNodeId': 'join_paths', 'targetPort': 'in'},
        {'id': 'c8', 'sourceNodeId': 'reminder_notification', 'sourcePort': 'out', 'targetNodeId': 'join_paths', 'targetPort': 'in'},
        {'id': 'c9', 'sourceNodeId': 'skip_node', 'sourcePort': 'out', 'targetNodeId': 'join_paths', 'targetPort': 'in'},
        {'id': 'c10', 'sourceNodeId': 'join_paths', 'sourcePort': 'out', 'targetNodeId': 'loop_poams', 'targetPort': 'next'},
        {'id': 'c11', 'sourceNodeId': 'loop_poams', 'sourcePort': 'done', 'targetNodeId': 'aggregate_status', 'targetPort': 'in'},
        {'id': 'c12', 'sourceNodeId': 'aggregate_status', 'sourcePort': 'out', 'targetNodeId': 'generate_report', 'targetPort': 'in'},
        {'id': 'c13', 'sourceNodeId': 'generate_report', 'sourcePort': 'out', 'targetNodeId': 'end_success', 'targetPort': 'in'},
    ],
))


# =============================================================================
# Workflow Template Service
# =============================================================================

class WorkflowTemplateService:
    """Service for managing and instantiating workflow templates."""

    def __init__(self):
        self.workflow_service = WorkflowService()

    def list_templates(
        self,
        category: str = None,
        tags: List[str] = None,
    ) -> List[WorkflowTemplate]:
        """List available workflow templates with optional filtering."""
        templates = list(WORKFLOW_TEMPLATES.values())

        if category:
            templates = [t for t in templates if t.category == category]

        if tags:
            templates = [
                t for t in templates
                if any(tag in t.tags for tag in tags)
            ]

        return templates

    def get_template(self, template_id: str) -> Optional[WorkflowTemplate]:
        """Get a specific workflow template by ID."""
        return WORKFLOW_TEMPLATES.get(template_id)

    def get_categories(self) -> Dict[str, int]:
        """Get list of categories with template counts."""
        categories = {}
        for template in WORKFLOW_TEMPLATES.values():
            categories[template.category] = categories.get(template.category, 0) + 1
        return categories

    def instantiate_template(
        self,
        template_id: str,
        name: str = None,
        variable_values: Dict[str, Any] = None,
        created_by=None,
    ) -> Optional[Workflow]:
        """
        Create a new workflow from a template.

        Args:
            template_id: Template ID to instantiate
            name: Custom name for the workflow (uses template name if not provided)
            variable_values: Default values for workflow variables
            created_by: User creating the workflow

        Returns:
            Created Workflow instance or None if template not found
        """
        template = self.get_template(template_id)
        if not template:
            return None

        # Prepare variables with overrides
        variables = []
        for var in template.variables:
            var_copy = var.copy()
            if variable_values and var['name'] in variable_values:
                var_copy['defaultValue'] = variable_values[var['name']]
            variables.append(var_copy)

        # Create workflow
        workflow = self.workflow_service.create_workflow(
            name=name or template.name,
            description=template.description,
            trigger=template.trigger,
            created_by=created_by,
            category=template.category,
            tags=template.tags,
        )

        # Update with nodes and connections
        workflow = self.workflow_service.update_workflow(
            workflow=workflow,
            nodes=template.nodes,
            connections=template.connections,
            variables=variables,
        )

        return workflow

    def preview_template(self, template_id: str) -> Optional[Dict]:
        """
        Get a preview of what a workflow would look like from a template.

        Returns the template definition as a workflow-compatible dictionary.
        """
        template = self.get_template(template_id)
        if not template:
            return None

        return {
            'name': template.name,
            'description': template.description,
            'category': template.category,
            'tags': template.tags,
            'trigger': template.trigger,
            'variables': template.variables,
            'nodes': template.nodes,
            'connections': template.connections,
            'requires_integrations': template.requires_integrations,
        }


# Singleton instance
_template_service: Optional[WorkflowTemplateService] = None


def get_workflow_template_service() -> WorkflowTemplateService:
    """Get singleton instance of workflow template service."""
    global _template_service
    if _template_service is None:
        _template_service = WorkflowTemplateService()
    return _template_service
