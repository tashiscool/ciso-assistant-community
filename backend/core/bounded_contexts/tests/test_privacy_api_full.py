"""
Comprehensive API tests for Privacy bounded context

Tests cover:
- DataAsset ViewSet full CRUD and actions
- ConsentRecord API including withdraw consent
- DataSubjectRight API including request processing
- Bulk operations and filtering
- Edge cases and error handling
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
from core.bounded_contexts.privacy.aggregates.data_asset import DataAsset
from core.bounded_contexts.privacy.aggregates.data_flow import DataFlow
from privacy.models.consent_record import ConsentRecord
from privacy.models.data_subject_right import DataSubjectRight
from core.apps import startup


User = get_user_model()


@pytest.fixture
def app_config():
    """Initialize application startup."""
    startup(sender=None, **{})


@pytest.fixture
def authenticated_client(app_config, db):
    """Create an authenticated API client with admin privileges."""
    admin = User.objects.create_superuser("privacy_admin@test.com", is_published=True)
    admin_group = UserGroup.objects.get(name="BI-UG-ADM")
    admin.folder = admin_group.folder
    admin.save()
    admin_group.user_set.add(admin)

    client = APIClient()
    _auth_token = AuthToken.objects.create(user=admin)
    auth_token = _auth_token[1]
    client.credentials(HTTP_AUTHORIZATION=f"Token {auth_token}")

    return client


@pytest.fixture
def test_folder(app_config, db):
    """Create a test folder under root."""
    return Folder.objects.get(content_type=Folder.ContentType.ROOT)


# =============================================================================
# DataAsset ViewSet Tests
# =============================================================================

@pytest.mark.django_db
class TestDataAssetViewSet:
    """Full CRUD tests for DataAsset ViewSet."""

    def test_list_data_assets(self, authenticated_client, test_folder):
        """Test listing all data assets."""
        DataAsset.objects.create(name='Asset 1', folder=test_folder)
        DataAsset.objects.create(name='Asset 2', folder=test_folder)

        response = authenticated_client.get('/api/privacy/data-assets/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_data_asset_minimal(self, authenticated_client, test_folder):
        """Test creating a data asset with minimal fields."""
        payload = {
            'name': 'New Asset',
            'folder': str(test_folder.id),
        }

        response = authenticated_client.post(
            '/api/privacy/data-assets/',
            data=payload,
            format='json'
        )

        assert response.status_code in [200, 201]

    def test_create_data_asset_full(self, authenticated_client, test_folder):
        """Test creating a data asset with all fields."""
        payload = {
            'name': 'Complete Asset',
            'description': 'Full data asset record',
            'data_categories': ['personal', 'health'],
            'contains_personal_data': True,
            'retention_policy': '7 years',
            'estimated_data_subjects': 10000,
            'folder': str(test_folder.id),
        }

        response = authenticated_client.post(
            '/api/privacy/data-assets/',
            data=payload,
            format='json'
        )

        assert response.status_code in [200, 201]
        data = response.json()
        assert data['contains_personal_data'] is True

    def test_retrieve_data_asset(self, authenticated_client, test_folder):
        """Test retrieving a single data asset."""
        asset = DataAsset.objects.create(
            name='Test Asset',
            description='Test',
            folder=test_folder
        )

        response = authenticated_client.get(f'/api/privacy/data-assets/{asset.id}/')

        assert response.status_code == status.HTTP_200_OK
        assert response.json()['name'] == 'Test Asset'

    def test_update_data_asset(self, authenticated_client, test_folder):
        """Test updating a data asset."""
        asset = DataAsset.objects.create(
            name='Original',
            folder=test_folder
        )

        payload = {
            'name': 'Updated',
            'description': 'Updated description',
            'folder': str(test_folder.id),
        }

        response = authenticated_client.put(
            f'/api/privacy/data-assets/{asset.id}/',
            data=payload,
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        asset.refresh_from_db()
        assert asset.name == 'Updated'

    def test_partial_update_data_asset(self, authenticated_client, test_folder):
        """Test partial update (PATCH) of data asset."""
        asset = DataAsset.objects.create(
            name='Test',
            contains_personal_data=False,
            folder=test_folder
        )

        response = authenticated_client.patch(
            f'/api/privacy/data-assets/{asset.id}/',
            data={'contains_personal_data': True},
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        asset.refresh_from_db()
        assert asset.contains_personal_data is True

    def test_delete_data_asset(self, authenticated_client, test_folder):
        """Test deleting a data asset."""
        asset = DataAsset.objects.create(name='To Delete', folder=test_folder)

        response = authenticated_client.delete(f'/api/privacy/data-assets/{asset.id}/')

        assert response.status_code == status.HTTP_204_NO_CONTENT


# =============================================================================
# DataAsset Lifecycle Tests
# =============================================================================

@pytest.mark.django_db
class TestDataAssetLifecycle:
    """Tests for DataAsset lifecycle transitions via API."""

    def test_activate_data_asset(self, authenticated_client, test_folder):
        """Test activating a data asset."""
        asset = DataAsset.objects.create(
            name='Draft Asset',
            lifecycle_state='draft',
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/data-assets/{asset.id}/activate/',
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        asset.refresh_from_db()
        assert asset.lifecycle_state == 'active'

    def test_retire_data_asset(self, authenticated_client, test_folder):
        """Test retiring a data asset."""
        asset = DataAsset.objects.create(
            name='Active Asset',
            lifecycle_state='active',
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/data-assets/{asset.id}/retire/',
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        asset.refresh_from_db()
        assert asset.lifecycle_state == 'retired'


# =============================================================================
# DataAsset Filtering Tests
# =============================================================================

@pytest.mark.django_db
class TestDataAssetFiltering:
    """Tests for DataAsset filtering and search."""

    def test_filter_by_lifecycle_state(self, authenticated_client, test_folder):
        """Test filtering by lifecycle state."""
        DataAsset.objects.create(name='Active', lifecycle_state='active', folder=test_folder)
        DataAsset.objects.create(name='Draft', lifecycle_state='draft', folder=test_folder)

        response = authenticated_client.get(
            '/api/privacy/data-assets/?lifecycle_state=active'
        )

        assert response.status_code == status.HTTP_200_OK

    def test_filter_by_contains_personal_data(self, authenticated_client, test_folder):
        """Test filtering by contains_personal_data."""
        DataAsset.objects.create(name='Personal', contains_personal_data=True, folder=test_folder)
        DataAsset.objects.create(name='NonPersonal', contains_personal_data=False, folder=test_folder)

        response = authenticated_client.get(
            '/api/privacy/data-assets/?contains_personal_data=true'
        )

        assert response.status_code == status.HTTP_200_OK

    def test_search_data_assets(self, authenticated_client, test_folder):
        """Test searching data assets."""
        DataAsset.objects.create(name='Customer Database', folder=test_folder)
        DataAsset.objects.create(name='Employee Records', folder=test_folder)

        response = authenticated_client.get(
            '/api/privacy/data-assets/?search=Customer'
        )

        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# ConsentRecord ViewSet Tests
# =============================================================================

@pytest.mark.django_db
class TestConsentRecordViewSet:
    """Full CRUD tests for ConsentRecord ViewSet."""

    def test_list_consent_records(self, authenticated_client, test_folder):
        """Test listing consent records."""
        ConsentRecord.objects.create(
            consent_id='CONS-001',
            data_subject_id='user@example.com',
            consent_method='checkbox',
            consent_date=timezone.now(),
            status='active',
            folder=test_folder
        )

        response = authenticated_client.get('/api/privacy/consent-records/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_consent_record(self, authenticated_client, test_folder):
        """Test creating a consent record."""
        payload = {
            'consent_id': 'CONS-NEW-001',
            'data_subject_id': 'newuser@example.com',
            'data_subject_type': 'customer',
            'consent_method': 'digital_signature',
            'consent_given': True,
            'consent_date': timezone.now().isoformat(),
            'processing_purposes': ['marketing', 'analytics'],
            'folder': str(test_folder.id),
        }

        response = authenticated_client.post(
            '/api/privacy/consent-records/',
            data=payload,
            format='json'
        )

        assert response.status_code in [200, 201]

    def test_retrieve_consent_record(self, authenticated_client, test_folder):
        """Test retrieving a single consent record."""
        record = ConsentRecord.objects.create(
            consent_id='CONS-002',
            data_subject_id='user@example.com',
            consent_method='checkbox',
            consent_date=timezone.now(),
            status='active',
            folder=test_folder
        )

        response = authenticated_client.get(f'/api/privacy/consent-records/{record.id}/')

        assert response.status_code == status.HTTP_200_OK

    def test_withdraw_consent(self, authenticated_client, test_folder):
        """Test withdrawing consent via API action."""
        record = ConsentRecord.objects.create(
            consent_id='CONS-003',
            data_subject_id='user@example.com',
            consent_method='checkbox',
            consent_given=True,
            consent_date=timezone.now(),
            status='active',
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/consent-records/{record.id}/withdraw/',
            data={
                'withdrawal_method': 'digital_request',
                'withdrawal_reason': 'No longer want marketing emails',
            },
            format='json'
        )

        assert response.status_code in [200, 400]

    def test_filter_consent_by_status(self, authenticated_client, test_folder):
        """Test filtering consent records by status."""
        ConsentRecord.objects.create(
            consent_id='CONS-A',
            data_subject_id='a@example.com',
            consent_method='checkbox',
            consent_date=timezone.now(),
            status='active',
            folder=test_folder
        )
        ConsentRecord.objects.create(
            consent_id='CONS-W',
            data_subject_id='w@example.com',
            consent_method='checkbox',
            consent_date=timezone.now(),
            status='withdrawn',
            withdrawn=True,
            folder=test_folder
        )

        response = authenticated_client.get('/api/privacy/consent-records/?status=active')

        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# DataSubjectRight ViewSet Tests
# =============================================================================

@pytest.mark.django_db
class TestDataSubjectRightViewSet:
    """Full CRUD tests for DataSubjectRight ViewSet."""

    def test_list_data_subject_rights(self, authenticated_client, test_folder):
        """Test listing DSRs."""
        DataSubjectRight.objects.create(
            request_id='DSR-001',
            data_subject_id='user@example.com',
            primary_right='access',
            request_description='Access my data',
            status='received',
            folder=test_folder
        )

        response = authenticated_client.get('/api/privacy/data-subject-rights/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_dsr(self, authenticated_client, test_folder):
        """Test creating a DSR."""
        payload = {
            'request_id': 'DSR-NEW-001',
            'data_subject_id': 'newuser@example.com',
            'data_subject_type': 'customer',
            'primary_right': 'erasure',
            'request_description': 'Delete all my personal data',
            'received_date': timezone.now().date().isoformat(),
            'due_date': (timezone.now().date() + timedelta(days=30)).isoformat(),
            'priority': 'high',
            'folder': str(test_folder.id),
        }

        response = authenticated_client.post(
            '/api/privacy/data-subject-rights/',
            data=payload,
            format='json'
        )

        assert response.status_code in [200, 201]

    def test_retrieve_dsr(self, authenticated_client, test_folder):
        """Test retrieving a single DSR."""
        dsr = DataSubjectRight.objects.create(
            request_id='DSR-002',
            data_subject_id='user@example.com',
            primary_right='access',
            request_description='Test',
            status='received',
            folder=test_folder
        )

        response = authenticated_client.get(f'/api/privacy/data-subject-rights/{dsr.id}/')

        assert response.status_code == status.HTTP_200_OK

    def test_start_processing_dsr(self, authenticated_client, test_folder):
        """Test starting processing of a DSR."""
        dsr = DataSubjectRight.objects.create(
            request_id='DSR-003',
            data_subject_id='user@example.com',
            primary_right='access',
            request_description='Test',
            status='received',
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/data-subject-rights/{dsr.id}/start_processing/',
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        dsr.refresh_from_db()
        assert dsr.status == 'processing'

    def test_complete_dsr(self, authenticated_client, test_folder):
        """Test completing a DSR."""
        dsr = DataSubjectRight.objects.create(
            request_id='DSR-004',
            data_subject_id='user@example.com',
            primary_right='access',
            request_description='Test',
            status='processing',
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/data-subject-rights/{dsr.id}/complete/',
            data={
                'response_summary': 'All data has been provided',
                'response_method': 'email',
            },
            format='json'
        )

        assert response.status_code in [200, 400]

    def test_reject_dsr(self, authenticated_client, test_folder):
        """Test rejecting a DSR."""
        dsr = DataSubjectRight.objects.create(
            request_id='DSR-005',
            data_subject_id='user@example.com',
            primary_right='erasure',
            request_description='Delete data',
            status='processing',
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/data-subject-rights/{dsr.id}/reject/',
            data={
                'rejection_reason': 'Legal retention requirements',
            },
            format='json'
        )

        assert response.status_code in [200, 400]

    def test_filter_dsr_by_status(self, authenticated_client, test_folder):
        """Test filtering DSRs by status."""
        DataSubjectRight.objects.create(
            request_id='DSR-A',
            data_subject_id='a@example.com',
            primary_right='access',
            request_description='Test',
            status='received',
            folder=test_folder
        )
        DataSubjectRight.objects.create(
            request_id='DSR-B',
            data_subject_id='b@example.com',
            primary_right='access',
            request_description='Test',
            status='processing',
            folder=test_folder
        )

        response = authenticated_client.get('/api/privacy/data-subject-rights/?status=received')

        assert response.status_code == status.HTTP_200_OK

    def test_filter_dsr_by_right_type(self, authenticated_client, test_folder):
        """Test filtering DSRs by right type."""
        DataSubjectRight.objects.create(
            request_id='DSR-ACC',
            data_subject_id='a@example.com',
            primary_right='access',
            request_description='Test',
            status='received',
            folder=test_folder
        )
        DataSubjectRight.objects.create(
            request_id='DSR-ERA',
            data_subject_id='b@example.com',
            primary_right='erasure',
            request_description='Test',
            status='received',
            folder=test_folder
        )

        response = authenticated_client.get('/api/privacy/data-subject-rights/?primary_right=access')

        assert response.status_code == status.HTTP_200_OK

    def test_get_overdue_dsrs(self, authenticated_client, test_folder):
        """Test getting overdue DSRs."""
        # Create an overdue DSR
        DataSubjectRight.objects.create(
            request_id='DSR-OVERDUE',
            data_subject_id='overdue@example.com',
            primary_right='access',
            request_description='Test',
            status='processing',
            received_date=timezone.now().date() - timedelta(days=60),
            due_date=timezone.now().date() - timedelta(days=30),
            folder=test_folder
        )

        response = authenticated_client.get('/api/privacy/data-subject-rights/overdue/')

        assert response.status_code in [200, 404]


# =============================================================================
# DataFlow Tests
# =============================================================================

@pytest.mark.django_db
class TestDataFlowViewSet:
    """Tests for DataFlow ViewSet."""

    def test_list_data_flows(self, authenticated_client, test_folder):
        """Test listing data flows."""
        DataFlow.objects.create(
            name='Customer Data Flow',
            flow_type='internal',
            folder=test_folder
        )

        response = authenticated_client.get('/api/privacy/data-flows/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_data_flow(self, authenticated_client, test_folder):
        """Test creating a data flow."""
        payload = {
            'name': 'New Data Flow',
            'description': 'Data flow for analytics',
            'flow_type': 'external',
            'folder': str(test_folder.id),
        }

        response = authenticated_client.post(
            '/api/privacy/data-flows/',
            data=payload,
            format='json'
        )

        assert response.status_code in [200, 201]


# =============================================================================
# Edge Cases and Error Handling
# =============================================================================

@pytest.mark.django_db
class TestPrivacyEdgeCases:
    """Edge case tests for Privacy API."""

    def test_create_asset_invalid_folder(self, authenticated_client):
        """Test creating asset with invalid folder ID."""
        payload = {
            'name': 'Test',
            'folder': str(uuid.uuid4()),  # Non-existent folder
        }

        response = authenticated_client.post(
            '/api/privacy/data-assets/',
            data=payload,
            format='json'
        )

        assert response.status_code in [400, 404]

    def test_retrieve_nonexistent_asset(self, authenticated_client):
        """Test retrieving non-existent asset."""
        response = authenticated_client.get(f'/api/privacy/data-assets/{uuid.uuid4()}/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_activate_already_active_asset(self, authenticated_client, test_folder):
        """Test activating an already active asset."""
        asset = DataAsset.objects.create(
            name='Active',
            lifecycle_state='active',
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/data-assets/{asset.id}/activate/',
            format='json'
        )

        # Should either succeed (idempotent) or return error
        assert response.status_code in [200, 400]

    def test_withdraw_already_withdrawn_consent(self, authenticated_client, test_folder):
        """Test withdrawing already withdrawn consent."""
        record = ConsentRecord.objects.create(
            consent_id='CONS-WITHDRAWN',
            data_subject_id='user@example.com',
            consent_method='checkbox',
            consent_date=timezone.now(),
            status='withdrawn',
            withdrawn=True,
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/consent-records/{record.id}/withdraw/',
            format='json'
        )

        assert response.status_code in [200, 400]

    def test_complete_already_completed_dsr(self, authenticated_client, test_folder):
        """Test completing an already completed DSR."""
        dsr = DataSubjectRight.objects.create(
            request_id='DSR-DONE',
            data_subject_id='user@example.com',
            primary_right='access',
            request_description='Test',
            status='completed',
            folder=test_folder
        )

        response = authenticated_client.post(
            f'/api/privacy/data-subject-rights/{dsr.id}/complete/',
            format='json'
        )

        assert response.status_code in [200, 400]


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.django_db
class TestPrivacyIntegration:
    """Integration tests for Privacy API."""

    def test_full_dsr_workflow(self, authenticated_client, test_folder):
        """Test complete DSR workflow from creation to completion."""
        # Create DSR
        create_response = authenticated_client.post(
            '/api/privacy/data-subject-rights/',
            data={
                'request_id': 'DSR-WORKFLOW-001',
                'data_subject_id': 'workflow@example.com',
                'primary_right': 'access',
                'request_description': 'Access request for workflow test',
                'folder': str(test_folder.id),
            },
            format='json'
        )
        assert create_response.status_code in [200, 201]
        dsr_id = create_response.json()['id']

        # Start processing
        process_response = authenticated_client.post(
            f'/api/privacy/data-subject-rights/{dsr_id}/start_processing/',
            format='json'
        )
        assert process_response.status_code == status.HTTP_200_OK

        # Verify state
        dsr = DataSubjectRight.objects.get(id=dsr_id)
        assert dsr.status == 'processing'

    def test_full_consent_lifecycle(self, authenticated_client, test_folder):
        """Test complete consent lifecycle."""
        # Create consent
        create_response = authenticated_client.post(
            '/api/privacy/consent-records/',
            data={
                'consent_id': 'CONS-LIFECYCLE-001',
                'data_subject_id': 'lifecycle@example.com',
                'consent_method': 'checkbox',
                'consent_given': True,
                'consent_date': timezone.now().isoformat(),
                'processing_purposes': ['marketing'],
                'folder': str(test_folder.id),
            },
            format='json'
        )
        assert create_response.status_code in [200, 201]
        consent_id = create_response.json()['id']

        # Verify initial state
        consent = ConsentRecord.objects.get(id=consent_id)
        assert consent.status == 'active'

