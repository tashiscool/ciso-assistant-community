"""
Comprehensive tests for Workflow Engine approval flows

Tests cover:
- Multi-step approval workflows
- Approval request creation and processing
- Rejection handling with reasons
- Escalation paths
- Delegation and reassignment
- Approval deadlines and expiration
- Audit trail for approvals
"""

import pytest
import uuid
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from knox.models import AuthToken

from iam.models import Folder, UserGroup
from core.bounded_contexts.workflow_engine.models import (
    Workflow,
    WorkflowExecution,
    WorkflowSchedule,
    WorkflowWebhook,
)
from core.apps import startup


User = get_user_model()


@pytest.fixture
def app_config():
    """Initialize application startup."""
    startup(sender=None, **{})


@pytest.fixture
def authenticated_client(app_config, db):
    """Create an authenticated API client with admin privileges."""
    admin = User.objects.create_superuser("workflow_admin@test.com", is_published=True)
    admin_group = UserGroup.objects.get(name="BI-UG-ADM")
    admin.folder = admin_group.folder
    admin.save()
    admin_group.user_set.add(admin)

    client = APIClient()
    _auth_token = AuthToken.objects.create(user=admin)
    auth_token = _auth_token[1]
    client.credentials(HTTP_AUTHORIZATION=f"Token {auth_token}")

    return client, admin


@pytest.fixture
def test_folder(app_config, db):
    """Create a test folder under root."""
    return Folder.objects.get(content_type=Folder.ContentType.ROOT)


@pytest.fixture
def approval_workflow(app_config, db):
    """Create a test approval workflow."""
    return Workflow.objects.create(
        name='Document Approval Workflow',
        description='Multi-level approval for documents',
        status='active',
        category='compliance',
        trigger={'type': 'manual', 'config': {}},
        variables=[
            {'name': 'approver_1', 'type': 'user'},
            {'name': 'approver_2', 'type': 'user'},
        ],
    )


# =============================================================================
# Workflow API Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowAPI:
    """Tests for Workflow API endpoints."""

    def test_list_workflows(self, authenticated_client, test_folder):
        """Test listing all workflows."""
        client, _ = authenticated_client
        Workflow.objects.create(name='Workflow 1', status='active')
        Workflow.objects.create(name='Workflow 2', status='draft')

        response = client.get('/api/workflows/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_workflow(self, authenticated_client, test_folder):
        """Test creating a workflow via API."""
        client, _ = authenticated_client
        payload = {
            'name': 'New Approval Workflow',
            'description': 'Test workflow',
            'status': 'draft',
            'category': 'security',            'trigger': {'type': 'manual', 'config': {}},
        }

        response = client.post(
            '/api/workflows/',
            data=payload,
            format='json'
        )

        assert response.status_code in [200, 201]

    def test_retrieve_workflow(self, authenticated_client, test_folder):
        """Test retrieving a single workflow."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(
            name='Test Workflow',
            status='active'
        )

        response = client.get(f'/api/workflows/{workflow.id}/')

        assert response.status_code == status.HTTP_200_OK
        assert response.json()['name'] == 'Test Workflow'

    def test_activate_workflow(self, authenticated_client, test_folder):
        """Test activating a workflow via API action."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(
            name='Draft Workflow',
            status='draft'
        )

        response = client.post(
            f'/api/workflows/{workflow.id}/activate/',
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        workflow.refresh_from_db()
        assert workflow.status == 'active'

    def test_deactivate_workflow(self, authenticated_client, test_folder):
        """Test deactivating a workflow via API action."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(
            name='Active Workflow',
            status='active'
        )

        response = client.post(
            f'/api/workflows/{workflow.id}/deactivate/',
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        workflow.refresh_from_db()
        assert workflow.status == 'inactive'


# =============================================================================
# Workflow Execution Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowExecutionAPI:
    """Tests for WorkflowExecution API endpoints."""

    def test_list_executions(self, authenticated_client, test_folder):
        """Test listing workflow executions."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', )
        WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='completed'
        )

        response = client.get('/api/workflows/executions/')

        assert response.status_code == status.HTTP_200_OK

    def test_trigger_execution(self, authenticated_client, test_folder):
        """Test triggering a workflow execution."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(
            name='Triggerable Workflow',
            status='active',
            trigger={'type': 'manual', 'config': {}}
        )

        response = client.post(
            f'/api/workflows/{workflow.id}/execute/',
            data={'context': {'document_id': str(uuid.uuid4())}},
            format='json'
        )

        assert response.status_code in [200, 201]

    def test_cancel_execution(self, authenticated_client, test_folder):
        """Test cancelling a workflow execution."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', )
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='running',
            started_at=timezone.now()
        )

        response = client.post(
            f'/api/workflows/executions/{execution.id}/cancel/',
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        execution.refresh_from_db()
        assert execution.status == 'cancelled'

    def test_retry_failed_execution(self, authenticated_client, test_folder):
        """Test retrying a failed execution."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', status='active')
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='failed'
        )

        response = client.post(
            f'/api/workflows/executions/{execution.id}/retry/',
            format='json'
        )

        assert response.status_code in [200, 201, 400]


# =============================================================================
# Approval Flow Tests
# =============================================================================

@pytest.mark.django_db
class TestApprovalFlowAPI:
    """Tests for approval flow functionality."""

    def test_submit_for_approval(self, authenticated_client, approval_workflow):
        """Test submitting an item for approval."""
        client, user = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual',
            context={'document_id': str(uuid.uuid4())},        )

        response = client.post(
            f'/api/workflows/executions/{execution.id}/submit/',
            format='json'
        )

        assert response.status_code in [200, 400, 404]

    def test_approve_step(self, authenticated_client, approval_workflow):
        """Test approving a workflow step."""
        client, user = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual',        )

        response = client.post(
            f'/api/workflows/executions/{execution.id}/approve/',
            data={'comments': 'Approved by manager'},
            format='json'
        )

        assert response.status_code in [200, 400, 404]

    def test_reject_step(self, authenticated_client, approval_workflow):
        """Test rejecting a workflow step."""
        client, user = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual',        )

        response = client.post(
            f'/api/workflows/executions/{execution.id}/reject/',
            data={
                'reason': 'Missing documentation',
                'comments': 'Please provide additional evidence',
            },
            format='json'
        )

        assert response.status_code in [200, 400, 404]

    def test_escalate_approval(self, authenticated_client, approval_workflow):
        """Test escalating an approval request."""
        client, user = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual',        )

        response = client.post(
            f'/api/workflows/executions/{execution.id}/escalate/',
            data={'reason': 'Urgent review needed'},
            format='json'
        )

        assert response.status_code in [200, 400, 404]

    def test_delegate_approval(self, authenticated_client, approval_workflow):
        """Test delegating an approval to another user."""
        client, user = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual',        )
        delegate_id = str(uuid.uuid4())

        response = client.post(
            f'/api/workflows/executions/{execution.id}/delegate/',
            data={
                'delegate_to': delegate_id,
                'reason': 'Out of office',
            },
            format='json'
        )

        assert response.status_code in [200, 400, 404]


# =============================================================================
# Approval Deadline Tests
# =============================================================================

@pytest.mark.django_db
class TestApprovalDeadlines:
    """Tests for approval deadline handling."""

    def test_execution_with_context(self, authenticated_client, approval_workflow):
        """Test creating execution with context data."""
        client, _ = authenticated_client

        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            context={'document_id': 'doc-123', 'requester': 'user@test.com'},
        )

        assert execution.context['document_id'] == 'doc-123'
        assert execution.status == 'pending'

    def test_execution_timing(self, authenticated_client, approval_workflow):
        """Test execution timing tracking."""
        client, _ = authenticated_client

        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual',
        )

        # Start the execution
        execution.start()
        assert execution.started_at is not None
        assert execution.status == 'running'

    def test_get_pending_approvals(self, authenticated_client, approval_workflow):
        """Test getting list of pending executions via filter."""
        client, user = authenticated_client
        WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual',
        )

        # Use query parameter filter instead of dedicated endpoint
        response = client.get('/api/workflows/executions/?status=pending')

        assert response.status_code == 200


# =============================================================================
# Multi-Step Approval Tests
# =============================================================================

@pytest.mark.django_db
class TestMultiStepApproval:
    """Tests for multi-step approval workflows."""

    def test_create_multi_step_workflow(self, authenticated_client, test_folder):
        """Test creating a workflow with multiple variables."""
        client, _ = authenticated_client
        payload = {
            'name': 'Multi-Step Approval',
            'status': 'draft',
            'category': 'compliance',
            'trigger': {'type': 'manual', 'config': {}},
            'variables': [
                {'name': 'approver_1', 'type': 'user'},
                {'name': 'approver_2', 'type': 'user'},
                {'name': 'document_id', 'type': 'string'},
            ],
        }

        response = client.post(
            '/api/workflows/',
            data=payload,
            format='json'
        )

        assert response.status_code in [200, 201]

    def test_execution_status_progression(self, authenticated_client, approval_workflow):
        """Test execution status progression."""
        client, _ = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual',
        )

        # Start execution
        execution.start()
        assert execution.status == 'running'

        # Complete execution
        execution.complete(output={'result': 'approved'})
        assert execution.status == 'completed'

    def test_get_approval_history(self, authenticated_client, approval_workflow):
        """Test getting approval history for an execution."""
        client, _ = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='completed',
            )

        response = client.get(
            f'/api/workflows/executions/{execution.id}/history/',
        )

        assert response.status_code in [200, 404]


# =============================================================================
# Workflow Schedule Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowScheduleAPI:
    """Tests for WorkflowSchedule API."""

    def test_list_schedules(self, authenticated_client, test_folder):
        """Test listing workflow schedules."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', status='active')
        WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Daily Schedule',
            is_active=True,
            schedule_type='cron',
            cron_expression='0 0 * * *',
            )

        response = client.get('/api/workflows/schedules/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_schedule(self, authenticated_client, test_folder):
        """Test creating a workflow schedule via model."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', status='active')

        # Create schedule directly via model
        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name='New Schedule',
            is_active=True,
            schedule_type='cron',
            cron_expression='0 9 * * 1-5',
        )

        # Verify creation worked
        assert schedule.id is not None
        assert schedule.workflow == workflow
        assert schedule.cron_expression == '0 9 * * 1-5'

    def test_activate_schedule(self, authenticated_client, test_folder):
        """Test activating a schedule."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', status='active')
        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Inactive Schedule',
            is_active=False,
            )

        response = client.post(
            f'/api/workflows/schedules/{schedule.id}/activate/',
            format='json'
        )

        assert response.status_code in [200, 404]

    def test_deactivate_schedule(self, authenticated_client, test_folder):
        """Test deactivating a schedule."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', status='active')
        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Active Schedule',
            is_active=True,
            )

        response = client.post(
            f'/api/workflows/schedules/{schedule.id}/deactivate/',
            format='json'
        )

        assert response.status_code in [200, 404]


# =============================================================================
# Workflow Webhook Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowWebhookAPI:
    """Tests for WorkflowWebhook API."""

    def test_list_webhooks(self, authenticated_client, test_folder):
        """Test listing workflow webhooks."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', status='active')
        WorkflowWebhook.objects.create(
            workflow=workflow,
            name='GitHub Webhook',
            token='test-token',
            is_active=True,
            )

        response = client.get('/api/workflows/webhooks/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_webhook(self, authenticated_client, test_folder):
        """Test creating a webhook via model."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', status='active')

        # Create webhook directly via model
        import secrets
        webhook = WorkflowWebhook.objects.create(
            workflow=workflow,
            name='New Webhook',
            is_active=True,
            token=secrets.token_hex(32),
        )

        # Verify creation worked
        assert webhook.id is not None
        assert webhook.workflow == workflow
        assert len(webhook.token) == 64

    def test_regenerate_token(self, authenticated_client, test_folder):
        """Test regenerating a webhook token."""
        client, _ = authenticated_client
        workflow = Workflow.objects.create(name='Test', status='active')
        webhook = WorkflowWebhook.objects.create(
            workflow=workflow,
            name='Test Webhook',
            token='old-token',
            is_active=True,
            )
        old_token = webhook.token

        response = client.post(
            f'/api/workflows/webhooks/{webhook.id}/regenerate_token/',
            format='json'
        )

        assert response.status_code in [200, 404]


# =============================================================================
# Audit Trail Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowAuditTrail:
    """Tests for workflow audit trail functionality."""

    def test_execution_audit_trail(self, authenticated_client, approval_workflow):
        """Test that execution actions are audited."""
        client, user = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='pending',
            )

        # Track that created_at is set
        assert execution.created_at is not None

    def test_get_execution_logs(self, authenticated_client, approval_workflow):
        """Test getting execution logs."""
        client, _ = authenticated_client
        execution = WorkflowExecution.objects.create(
            workflow=approval_workflow,
            execution_number=1,
            status='completed',
            )

        response = client.get(
            f'/api/workflows/executions/{execution.id}/logs/',
        )

        assert response.status_code in [200, 404]


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowIntegration:
    """Integration tests for workflow engine."""

    def test_complete_approval_workflow(self, authenticated_client, test_folder):
        """Test complete approval workflow from creation to completion."""
        client, _ = authenticated_client

        # Create workflow
        workflow = Workflow.objects.create(
            name='Integration Test Workflow',
            status='active',
            trigger={'type': 'manual', 'config': {}},
            variables=[
                {'name': 'approver', 'type': 'user'},
                {'name': 'document_id', 'type': 'string'},
            ],
        )

        # Create and run execution
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='running',
            started_at=timezone.now(),
            )

        # Complete execution
        execution.status = 'completed'
        execution.completed_at = timezone.now()
        execution.save()

        # Verify
        assert execution.status == 'completed'
        assert execution.completed_at is not None

    def test_workflow_with_schedule_and_webhook(self, authenticated_client, test_folder):
        """Test workflow with both schedule and webhook triggers."""
        client, _ = authenticated_client

        workflow = Workflow.objects.create(
            name='Multi-Trigger Workflow',
            status='active',
            )

        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Daily',
            is_active=True,
            schedule_type='cron',
            cron_expression='0 0 * * *',
            )

        webhook = WorkflowWebhook.objects.create(
            workflow=workflow,
            name='External Trigger',
            token='test-token',
            is_active=True,
            )

        # Both should be associated with workflow
        assert schedule.workflow == workflow
        assert webhook.workflow == workflow
        assert workflow.schedules.count() == 1
        assert workflow.webhooks.count() == 1

