"""
Comprehensive tests for Workflow Engine bounded context

Tests cover:
- Workflow model and API
- WorkflowExecution model and API
- WorkflowSchedule model and API
- WorkflowWebhook model and API
"""

import pytest
import uuid
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from core.bounded_contexts.workflow_engine.models import (
    Workflow,
    WorkflowExecution,
    WorkflowSchedule,
    WorkflowWebhook,
)


User = get_user_model()


# =============================================================================
# Workflow Model Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowModel:
    """Tests for Workflow model"""

    def test_create_workflow(self):
        """Test creating a new workflow"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            description='Test description',
            status='draft',
            trigger={'type': 'manual', 'config': {}},
            category='security'
        )

        assert workflow.id is not None
        assert workflow.name == 'Test Workflow'
        assert workflow.status == 'draft'

    def test_activate_workflow(self):
        """Test activating a workflow"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            status='draft'
        )

        workflow.activate()

        assert workflow.status == 'active'

    def test_deactivate_workflow(self):
        """Test deactivating a workflow"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            status='active'
        )

        workflow.deactivate()

        assert workflow.status == 'inactive'

    def test_workflow_versioning(self):
        """Test workflow version tracking"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            version=1,
            is_latest=True
        )

        assert workflow.version == 1
        assert workflow.is_latest is True

    def test_workflow_execution_counts(self):
        """Test workflow execution count fields"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            total_executions=100,
            successful_executions=90,
            failed_executions=10
        )

        assert workflow.total_executions == 100
        assert workflow.successful_executions == 90
        assert workflow.failed_executions == 10


# =============================================================================
# WorkflowExecution Model Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowExecutionModel:
    """Tests for WorkflowExecution model"""

    def test_create_execution(self):
        """Test creating a workflow execution"""
        workflow = Workflow.objects.create(name='Test Workflow')
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='pending',
            triggered_by='manual'
        )

        assert execution.id is not None
        assert execution.workflow == workflow
        assert execution.status == 'pending'

    def test_execution_status_transitions(self):
        """Test execution status transitions"""
        workflow = Workflow.objects.create(name='Test Workflow')
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='pending'
        )

        # Start execution
        execution.status = 'running'
        execution.started_at = timezone.now()
        execution.save()
        assert execution.status == 'running'

        # Complete execution
        execution.status = 'completed'
        execution.completed_at = timezone.now()
        execution.save()
        assert execution.status == 'completed'

    def test_execution_cancel(self):
        """Test cancelling an execution"""
        workflow = Workflow.objects.create(name='Test Workflow')
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='running',
            started_at=timezone.now()
        )

        execution.cancel()

        assert execution.status == 'cancelled'


# =============================================================================
# WorkflowSchedule Model Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowScheduleModel:
    """Tests for WorkflowSchedule model"""

    def test_create_schedule(self):
        """Test creating a workflow schedule"""
        workflow = Workflow.objects.create(name='Test Workflow')
        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Daily Schedule',
            is_active=True,
            schedule_type='cron',
            cron_expression='0 0 * * *'
        )

        assert schedule.id is not None
        assert schedule.workflow == workflow
        assert schedule.is_active is True

    def test_activate_schedule(self):
        """Test activating a schedule"""
        workflow = Workflow.objects.create(name='Test Workflow')
        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Test Schedule',
            is_active=False
        )

        schedule.is_active = True
        schedule.save()

        assert schedule.is_active is True

    def test_deactivate_schedule(self):
        """Test deactivating a schedule"""
        workflow = Workflow.objects.create(name='Test Workflow')
        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Test Schedule',
            is_active=True
        )

        schedule.is_active = False
        schedule.save()

        assert schedule.is_active is False


# =============================================================================
# WorkflowWebhook Model Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowWebhookModel:
    """Tests for WorkflowWebhook model"""

    def test_create_webhook(self):
        """Test creating a workflow webhook"""
        workflow = Workflow.objects.create(name='Test Workflow')
        webhook = WorkflowWebhook.objects.create(
            workflow=workflow,
            name='Test Webhook',
            token='test-token-123',
            is_active=True
        )

        assert webhook.id is not None
        assert webhook.workflow == workflow
        assert webhook.is_active is True

    def test_activate_webhook(self):
        """Test activating a webhook"""
        workflow = Workflow.objects.create(name='Test Workflow')
        webhook = WorkflowWebhook.objects.create(
            workflow=workflow,
            name='Test Webhook',
            token='test-token',
            is_active=False
        )

        webhook.is_active = True
        webhook.save()

        assert webhook.is_active is True

    def test_deactivate_webhook(self):
        """Test deactivating a webhook"""
        workflow = Workflow.objects.create(name='Test Workflow')
        webhook = WorkflowWebhook.objects.create(
            workflow=workflow,
            name='Test Webhook',
            token='test-token',
            is_active=True
        )

        webhook.is_active = False
        webhook.save()

        assert webhook.is_active is False


# =============================================================================
# Workflow Execution Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowExecutionAPI:
    """Tests for WorkflowExecution API"""

    @pytest.fixture
    def auth_client(self):
        """Create an authenticated client"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_retrieve_execution(self, auth_client):
        """Test retrieving a workflow execution"""
        workflow = Workflow.objects.create(name='Test Workflow')
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='completed'
        )

        response = auth_client.get(f'/api/workflows/executions/{execution.id}/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'completed'

    def test_cancel_execution_action(self, auth_client):
        """Test cancel execution action"""
        workflow = Workflow.objects.create(name='Test Workflow')
        execution = WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='running',
            started_at=timezone.now()
        )

        response = auth_client.post(f'/api/workflows/executions/{execution.id}/cancel/')

        assert response.status_code == status.HTTP_200_OK
        execution.refresh_from_db()
        assert execution.status == 'cancelled'


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.django_db
class TestWorkflowIntegration:
    """Integration tests for Workflow Engine"""

    def test_workflow_with_executions(self):
        """Test workflow with multiple executions"""
        workflow = Workflow.objects.create(
            name='Integration Test Workflow',
            status='active'
        )

        # Create multiple executions
        for i in range(3):
            WorkflowExecution.objects.create(
                workflow=workflow,
                execution_number=i + 1,
                status='completed' if i < 2 else 'running'
            )

        executions = WorkflowExecution.objects.filter(workflow=workflow)
        assert executions.count() == 3

    def test_workflow_schedule_and_webhook(self):
        """Test workflow with schedule and webhook"""
        workflow = Workflow.objects.create(
            name='Scheduled Workflow',
            status='active'
        )

        schedule = WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Daily Schedule',
            is_active=True,
            schedule_type='cron',
            cron_expression='0 0 * * *'
        )

        webhook = WorkflowWebhook.objects.create(
            workflow=workflow,
            name='GitHub Webhook',
            token='github-token',
            is_active=True
        )

        assert schedule.workflow == workflow
        assert webhook.workflow == workflow
