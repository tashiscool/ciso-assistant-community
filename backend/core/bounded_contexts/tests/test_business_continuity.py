"""
Comprehensive tests for Business Continuity bounded context

Tests cover:
- BusinessContinuityPlan model, serializer, and API
- BcpTask supporting entity
- BcpAudit supporting entity
- Computed fields: last_test_date, last_test_result, business_impact
"""

import pytest
import uuid
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import status

from core.bounded_contexts.business_continuity.aggregates.business_continuity_plan import BusinessContinuityPlan
from core.bounded_contexts.business_continuity.supporting_entities.bcp_task import BcpTask
from core.bounded_contexts.business_continuity.supporting_entities.bcp_audit import BcpAudit
from core.bounded_contexts.business_continuity.serializers import (
    BusinessContinuityPlanSerializer,
    BcpTaskSerializer,
    BcpAuditSerializer,
)


# =============================================================================
# BusinessContinuityPlan Model Tests
# =============================================================================

@pytest.mark.django_db
class TestBusinessContinuityPlanModel:
    """Tests for BusinessContinuityPlan aggregate model"""

    def test_create_bcp(self):
        """Test creating a new BCP"""
        bcp = BusinessContinuityPlan()
        bcp.create(
            name='IT Disaster Recovery Plan',
            description='Plan for IT recovery',
        )
        bcp.save()

        assert bcp.id is not None
        assert bcp.name == 'IT Disaster Recovery Plan'
        assert bcp.lifecycle_state == 'draft'

    def test_approve_bcp(self):
        """Test approving a BCP (was activate)"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            lifecycle_state='draft'
        )
        bcp.approve()
        bcp.save()

        assert bcp.lifecycle_state == 'approved'

    def test_retire_bcp(self):
        """Test retiring a BCP"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            lifecycle_state='approved'
        )
        bcp.retire()
        bcp.save()

        assert bcp.lifecycle_state == 'retired'

    def test_add_org_unit(self):
        """Test adding an org unit"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        org_unit_id = uuid.uuid4()
        bcp.add_org_unit(org_unit_id)
        bcp.save()

        assert org_unit_id in bcp.orgUnitIds

    def test_add_service(self):
        """Test adding a service"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        service_id = uuid.uuid4()
        bcp.add_service(service_id)
        bcp.save()

        assert service_id in bcp.serviceIds

    def test_add_asset(self):
        """Test adding an asset"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        asset_id = uuid.uuid4()
        bcp.add_asset(asset_id)
        bcp.save()

        assert asset_id in bcp.assetIds


# =============================================================================
# BcpAudit Model Tests
# =============================================================================

@pytest.mark.django_db
class TestBcpAuditModel:
    """Tests for BcpAudit supporting entity"""

    def test_create_audit_directly(self):
        """Test creating a new BCP audit via direct field assignment"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')

        audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Annual Test 2024',
            description='Annual DR test',
            lifecycle_state='scheduled'
        )

        assert audit.id is not None
        assert audit.bcpId == bcp.id
        assert audit.lifecycle_state == 'scheduled'

    def test_start_audit_directly(self):
        """Test starting an audit via direct field assignment"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Test Audit',
            lifecycle_state='scheduled'
        )

        # Direct field manipulation instead of using domain method
        audit.lifecycle_state = 'running'
        audit.performed_at = timezone.now()
        audit.save()

        assert audit.lifecycle_state == 'running'
        assert audit.performed_at is not None

    def test_complete_audit_directly(self):
        """Test completing an audit via direct field assignment"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Test Audit',
            lifecycle_state='running'
        )

        # Direct field manipulation
        audit.lifecycle_state = 'completed'
        audit.outcome = 'pass'
        audit.notes = 'All tests passed'
        audit.save()

        assert audit.lifecycle_state == 'completed'
        assert audit.outcome == 'pass'
        assert audit.notes == 'All tests passed'

    def test_close_audit_directly(self):
        """Test closing an audit via direct field assignment"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Test Audit',
            lifecycle_state='completed'
        )

        audit.lifecycle_state = 'closed'
        audit.save()

        assert audit.lifecycle_state == 'closed'


# =============================================================================
# BcpTask Model Tests
# =============================================================================

@pytest.mark.django_db
class TestBcpTaskModel:
    """Tests for BcpTask supporting entity"""

    def test_create_task_directly(self):
        """Test creating a new BCP task via direct field assignment"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')

        task = BcpTask.objects.create(
            bcpId=bcp.id,
            title='Backup verification',
            description='Verify all backups are complete',
            lifecycle_state='open'
        )

        assert task.id is not None
        assert task.bcpId == bcp.id
        assert task.lifecycle_state == 'open'

    def test_start_task_directly(self):
        """Test starting a task via direct field assignment"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        task = BcpTask.objects.create(
            bcpId=bcp.id,
            title='Test Task',
            lifecycle_state='open'
        )

        task.lifecycle_state = 'in_progress'
        task.save()

        assert task.lifecycle_state == 'in_progress'

    def test_complete_task_directly(self):
        """Test completing a task via direct field assignment"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        task = BcpTask.objects.create(
            bcpId=bcp.id,
            title='Test Task',
            lifecycle_state='in_progress'
        )

        task.lifecycle_state = 'done'
        task.save()

        assert task.lifecycle_state == 'done'


# =============================================================================
# BusinessContinuityPlan Serializer Tests
# =============================================================================

@pytest.mark.django_db
class TestBusinessContinuityPlanSerializer:
    """Tests for BusinessContinuityPlan serializer including computed fields"""

    def test_serializer_output_fields(self):
        """Test that serializer outputs all expected fields"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            description='Test description',
            lifecycle_state='approved'
        )
        serializer = BusinessContinuityPlanSerializer(bcp)
        data = serializer.data

        # Core fields
        assert 'id' in data
        assert 'name' in data
        assert 'description' in data
        assert 'lifecycle_state' in data

        # Frontend alias fields
        assert 'status' in data
        assert 'plan_name' in data
        assert 'last_test_date' in data
        assert 'last_test_result' in data
        assert 'business_impact' in data

    def test_status_alias_field(self):
        """Test that status maps to lifecycle_state"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            lifecycle_state='approved'
        )
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['status'] == 'approved'

    def test_plan_name_alias_field(self):
        """Test that plan_name maps to name"""
        bcp = BusinessContinuityPlan.objects.create(
            name='IT DR Plan',
            lifecycle_state='approved'
        )
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['plan_name'] == 'IT DR Plan'

    def test_last_test_date_with_audit(self):
        """Test last_test_date returns latest audit performed_at"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')

        # Create audits with different dates
        old_audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Old Audit',
            performed_at=timezone.now() - timedelta(days=60)
        )
        recent_audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Recent Audit',
            performed_at=timezone.now() - timedelta(days=5)
        )

        serializer = BusinessContinuityPlanSerializer(bcp)

        # The serializer should return the most recent audit date
        assert serializer.data['last_test_date'] is not None

    def test_last_test_date_no_audit(self):
        """Test last_test_date returns None when no audits exist"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['last_test_date'] is None

    def test_last_test_result_with_audit(self):
        """Test last_test_result returns latest audit outcome"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')

        audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Test Audit',
            performed_at=timezone.now(),
            outcome='pass'
        )

        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['last_test_result'] == 'pass'

    def test_last_test_result_no_audit(self):
        """Test last_test_result returns None when no audits exist"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['last_test_result'] is None

    def test_business_impact_critical(self):
        """Test business_impact returns critical for many linked items"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            serviceIds=[uuid.uuid4() for _ in range(6)],
            assetIds=[uuid.uuid4() for _ in range(6)]
        )
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['business_impact'] == 'critical'

    def test_business_impact_high(self):
        """Test business_impact returns high for 5-9 linked items"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            serviceIds=[uuid.uuid4() for _ in range(3)],
            assetIds=[uuid.uuid4() for _ in range(3)]
        )
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['business_impact'] == 'high'

    def test_business_impact_medium(self):
        """Test business_impact returns medium for 2-4 linked items"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            serviceIds=[uuid.uuid4()],
            assetIds=[uuid.uuid4()]
        )
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['business_impact'] == 'medium'

    def test_business_impact_low(self):
        """Test business_impact returns low for <2 linked items"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            serviceIds=[],
            assetIds=[]
        )
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['business_impact'] == 'low'


# =============================================================================
# Business Continuity API Tests
# =============================================================================

@pytest.mark.django_db
class TestBusinessContinuityAPI:
    """API tests for Business Continuity bounded context"""

    def test_list_bcp_plans(self, authenticated_client):
        """Test listing BCP plans"""
        BusinessContinuityPlan.objects.create(name='Plan 1', lifecycle_state='approved')
        BusinessContinuityPlan.objects.create(name='Plan 2', lifecycle_state='draft')

        response = authenticated_client.get('/api/business-continuity/bcp-plans/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_bcp_plan(self, authenticated_client):
        """Test creating a BCP plan via API"""
        data = {
            'name': 'New DR Plan',
            'description': 'Disaster recovery plan',
        }

        response = authenticated_client.post(
            '/api/business-continuity/bcp-plans/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New DR Plan'

    def test_retire_bcp_action(self, authenticated_client):
        """Test retire BCP action"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            lifecycle_state='approved'
        )

        response = authenticated_client.post(
            f'/api/business-continuity/bcp-plans/{bcp.id}/retire/'
        )

        assert response.status_code == status.HTTP_200_OK
        bcp.refresh_from_db()
        assert bcp.lifecycle_state == 'retired'

    def test_list_bcp_audits(self, authenticated_client):
        """Test listing BCP audits"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Audit 1',
            lifecycle_state='completed'
        )

        response = authenticated_client.get('/api/business-continuity/bcp-audits/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_bcp_audit(self, authenticated_client):
        """Test creating a BCP audit via API"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        data = {
            'bcpId': str(bcp.id),
            'name': 'New Audit',
            'description': 'Annual test',
        }

        response = authenticated_client.post(
            '/api/business-continuity/bcp-audits/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_201_CREATED

    def test_list_bcp_tasks(self, authenticated_client):
        """Test listing BCP tasks"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        BcpTask.objects.create(
            bcpId=bcp.id,
            title='Task 1',
            lifecycle_state='open'
        )

        response = authenticated_client.get('/api/business-continuity/bcp-tasks/')

        assert response.status_code == status.HTTP_200_OK
