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

    def test_activate_bcp(self):
        """Test activating a BCP"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            lifecycle_state='draft'
        )
        bcp.activate()
        bcp.save()

        assert bcp.lifecycle_state == 'active'

    def test_retire_bcp(self):
        """Test retiring a BCP"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            lifecycle_state='active'
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

    def test_create_audit(self):
        """Test creating a new BCP audit"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')

        audit = BcpAudit()
        audit.create(
            bcp_id=bcp.id,
            name='Annual Test 2024',
            description='Annual DR test'
        )
        audit.save()

        assert audit.id is not None
        assert audit.bcpId == bcp.id
        assert audit.lifecycle_state == 'planned'

    def test_start_audit(self):
        """Test starting an audit"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Test Audit',
            lifecycle_state='planned'
        )

        audit.start(performed_at=timezone.now())
        audit.save()

        assert audit.lifecycle_state == 'running'
        assert audit.performed_at is not None

    def test_complete_audit(self):
        """Test completing an audit"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Test Audit',
            lifecycle_state='running'
        )

        audit.complete(outcome='pass', notes='All tests passed')
        audit.save()

        assert audit.lifecycle_state == 'reported'
        assert audit.outcome == 'pass'
        assert audit.notes == 'All tests passed'

    def test_close_audit(self):
        """Test closing an audit"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        audit = BcpAudit.objects.create(
            bcpId=bcp.id,
            name='Test Audit',
            lifecycle_state='reported'
        )

        audit.close()
        audit.save()

        assert audit.lifecycle_state == 'closed'


# =============================================================================
# BcpTask Model Tests
# =============================================================================

@pytest.mark.django_db
class TestBcpTaskModel:
    """Tests for BcpTask supporting entity"""

    def test_create_task(self):
        """Test creating a new BCP task"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')

        task = BcpTask()
        task.create(
            bcp_id=bcp.id,
            title='Backup verification',
            description='Verify all backups are complete'
        )
        task.save()

        assert task.id is not None
        assert task.bcpId == bcp.id
        assert task.lifecycle_state == 'pending'

    def test_start_task(self):
        """Test starting a task"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        task = BcpTask.objects.create(
            bcpId=bcp.id,
            title='Test Task',
            lifecycle_state='pending'
        )

        task.start()
        task.save()

        assert task.lifecycle_state == 'in_progress'

    def test_complete_task(self):
        """Test completing a task"""
        bcp = BusinessContinuityPlan.objects.create(name='Test BCP')
        task = BcpTask.objects.create(
            bcpId=bcp.id,
            title='Test Task',
            lifecycle_state='in_progress'
        )

        task.complete()
        task.save()

        assert task.lifecycle_state == 'completed'


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
            lifecycle_state='active'
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
            lifecycle_state='active'
        )
        serializer = BusinessContinuityPlanSerializer(bcp)

        assert serializer.data['status'] == 'active'

    def test_plan_name_alias_field(self):
        """Test that plan_name maps to name"""
        bcp = BusinessContinuityPlan.objects.create(
            name='IT DR Plan',
            lifecycle_state='active'
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
        BusinessContinuityPlan.objects.create(name='Plan 1', lifecycle_state='active')
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

    def test_activate_bcp_action(self, authenticated_client):
        """Test activate BCP action"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            lifecycle_state='draft'
        )

        response = authenticated_client.post(
            f'/api/business-continuity/bcp-plans/{bcp.id}/activate/'
        )

        assert response.status_code == status.HTTP_200_OK
        bcp.refresh_from_db()
        assert bcp.lifecycle_state == 'active'

    def test_retire_bcp_action(self, authenticated_client):
        """Test retire BCP action"""
        bcp = BusinessContinuityPlan.objects.create(
            name='Test BCP',
            lifecycle_state='active'
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
            lifecycle_state='pending'
        )

        response = authenticated_client.get('/api/business-continuity/bcp-tasks/')

        assert response.status_code == status.HTTP_200_OK
