"""
Comprehensive tests for Workflow Engine bounded context

Tests cover:
- Workflow model and API
- WorkflowExecution model and API
- WorkflowSchedule model and API
- WorkflowWebhook model and API
- Pagination format (results/count)
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
# Workflow API Tests - Pagination Format
# =============================================================================

@pytest.mark.django_db
class TestWorkflowAPIPagination:
    """Tests for Workflow API pagination format"""

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

    def test_workflow_list_pagination_format(self, auth_client):
        """Test workflow list returns correct pagination format"""
        Workflow.objects.create(name='Workflow 1', is_latest=True)
        Workflow.objects.create(name='Workflow 2', is_latest=True)

        response = auth_client.get('/api/workflows/workflows/')

        assert response.status_code == status.HTTP_200_OK
        # Verify pagination format
        assert 'results' in response.data
        assert 'count' in response.data
        assert isinstance(response.data['results'], list)
        assert response.data['count'] == len(response.data['results'])

    def test_workflow_list_results_content(self, auth_client):
        """Test workflow list results contain expected fields"""
        Workflow.objects.create(
            name='Test Workflow',
            description='Test description',
            status='active',
            is_latest=True,
            trigger={'type': 'manual', 'config': {}},
            category='security'
        )

        response = auth_client.get('/api/workflows/workflows/')

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['results']) >= 1

        workflow_data = response.data['results'][0]
        assert 'id' in workflow_data
        assert 'name' in workflow_data
        assert 'description' in workflow_data
        assert 'status' in workflow_data
        assert 'trigger' in workflow_data
        assert 'category' in workflow_data

    def test_workflow_execution_list_pagination_format(self, auth_client):
        """Test workflow execution list returns correct pagination format"""
        workflow = Workflow.objects.create(name='Test Workflow')
        WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='completed'
        )

        response = auth_client.get('/api/workflows/executions/')

        assert response.status_code == status.HTTP_200_OK
        # Verify pagination format
        assert 'results' in response.data
        assert 'count' in response.data

    def test_workflow_schedule_list_pagination_format(self, auth_client):
        """Test workflow schedule list returns correct pagination format"""
        workflow = Workflow.objects.create(name='Test Workflow')
        WorkflowSchedule.objects.create(
            workflow=workflow,
            name='Daily Schedule',
            is_active=True,
            schedule_type='cron',
            cron_expression='0 0 * * *'
        )

        response = auth_client.get('/api/workflows/schedules/')

        assert response.status_code == status.HTTP_200_OK
        # Verify pagination format
        assert 'results' in response.data
        assert 'count' in response.data

    def test_workflow_webhook_list_pagination_format(self, auth_client):
        """Test workflow webhook list returns correct pagination format"""
        workflow = Workflow.objects.create(name='Test Workflow')
        WorkflowWebhook.objects.create(
            workflow=workflow,
            name='Test Webhook',
            token='test-token-123',
            is_active=True
        )

        response = auth_client.get('/api/workflows/webhooks/')

        assert response.status_code == status.HTTP_200_OK
        # Verify pagination format
        assert 'results' in response.data
        assert 'count' in response.data


# =============================================================================
# Workflow API Tests - CRUD Operations
# =============================================================================

@pytest.mark.django_db
class TestWorkflowAPICrud:
    """Tests for Workflow API CRUD operations"""

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

    def test_create_workflow(self, auth_client):
        """Test creating a workflow via API"""
        data = {
            'name': 'New Workflow',
            'description': 'Test workflow',
            'trigger': {'type': 'manual', 'config': {}},
            'category': 'security',
            'tags': ['test', 'automation']
        }

        response = auth_client.post('/api/workflows/workflows/', data, format='json')

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Workflow'

    def test_retrieve_workflow(self, auth_client):
        """Test retrieving a workflow via API"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            description='Test description',
            is_latest=True
        )

        response = auth_client.get(f'/api/workflows/workflows/{workflow.id}/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Test Workflow'

    def test_update_workflow(self, auth_client):
        """Test updating a workflow via API"""
        workflow = Workflow.objects.create(
            name='Original Name',
            is_latest=True
        )

        response = auth_client.put(
            f'/api/workflows/workflows/{workflow.id}/',
            {'name': 'Updated Name', 'nodes': [], 'connections': []},
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Updated Name'

    def test_delete_workflow(self, auth_client):
        """Test deleting a workflow via API"""
        workflow = Workflow.objects.create(
            name='To Delete',
            is_latest=True
        )

        response = auth_client.delete(f'/api/workflows/workflows/{workflow.id}/')

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Workflow.objects.filter(id=workflow.id).exists()

    def test_activate_workflow_action(self, auth_client):
        """Test activate workflow action"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            status='draft',
            is_latest=True
        )

        response = auth_client.post(f'/api/workflows/workflows/{workflow.id}/activate/')

        assert response.status_code == status.HTTP_200_OK
        workflow.refresh_from_db()
        assert workflow.status == 'active'

    def test_deactivate_workflow_action(self, auth_client):
        """Test deactivate workflow action"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            status='active',
            is_latest=True
        )

        response = auth_client.post(f'/api/workflows/workflows/{workflow.id}/deactivate/')

        assert response.status_code == status.HTTP_200_OK
        workflow.refresh_from_db()
        assert workflow.status == 'inactive'

    def test_execute_workflow_action(self, auth_client):
        """Test execute workflow action"""
        workflow = Workflow.objects.create(
            name='Test Workflow',
            status='active',
            is_latest=True,
            trigger={'type': 'manual', 'config': {}}
        )

        response = auth_client.post(
            f'/api/workflows/workflows/{workflow.id}/execute/',
            {'trigger_data': {}},
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        assert 'execution_id' in response.data
        assert 'status' in response.data

    def test_duplicate_workflow_action(self, auth_client):
        """Test duplicate workflow action"""
        workflow = Workflow.objects.create(
            name='Original Workflow',
            description='Original description',
            is_latest=True
        )

        response = auth_client.post(
            f'/api/workflows/workflows/{workflow.id}/duplicate/',
            {'name': 'Duplicated Workflow'},
            format='json'
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Duplicated Workflow'


# =============================================================================
# WorkflowExecution API Tests
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

    def test_list_executions(self, auth_client):
        """Test listing workflow executions"""
        workflow = Workflow.objects.create(name='Test Workflow')
        WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=1,
            status='completed'
        )
        WorkflowExecution.objects.create(
            workflow=workflow,
            execution_number=2,
            status='running'
        )

        response = auth_client.get('/api/workflows/executions/')

        assert response.status_code == status.HTTP_200_OK
        assert 'results' in response.data
        assert response.data['count'] >= 2

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

    def test_filter_executions_by_workflow(self, auth_client):
        """Test filtering executions by workflow"""
        workflow1 = Workflow.objects.create(name='Workflow 1')
        workflow2 = Workflow.objects.create(name='Workflow 2')

        WorkflowExecution.objects.create(workflow=workflow1, execution_number=1, status='completed')
        WorkflowExecution.objects.create(workflow=workflow2, execution_number=1, status='completed')

        response = auth_client.get(f'/api/workflows/executions/?workflow={workflow1.id}')

        assert response.status_code == status.HTTP_200_OK

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

    def test_workflow_execution_flow(self, auth_client):
        """Test complete workflow execution flow"""
        # Create workflow
        workflow_data = {
            'name': 'Integration Test Workflow',
            'description': 'Test workflow for integration',
            'trigger': {'type': 'manual', 'config': {}},
            'category': 'test',
        }
        create_response = auth_client.post('/api/workflows/workflows/', workflow_data, format='json')
        assert create_response.status_code == status.HTTP_201_CREATED
        workflow_id = create_response.data['id']

        # Activate workflow
        activate_response = auth_client.post(f'/api/workflows/workflows/{workflow_id}/activate/')
        assert activate_response.status_code == status.HTTP_200_OK
        assert activate_response.data['status'] == 'active'

        # Execute workflow
        execute_response = auth_client.post(
            f'/api/workflows/workflows/{workflow_id}/execute/',
            {'trigger_data': {'test': 'data'}},
            format='json'
        )
        assert execute_response.status_code == status.HTTP_200_OK
        assert 'execution_id' in execute_response.data

        # Verify execution exists
        execution_id = execute_response.data['execution_id']
        get_execution_response = auth_client.get(f'/api/workflows/executions/{execution_id}/')
        assert get_execution_response.status_code == status.HTTP_200_OK
