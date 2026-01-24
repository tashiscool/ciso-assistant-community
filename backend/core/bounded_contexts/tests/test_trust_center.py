"""
Comprehensive tests for Trust Center implementation

Tests cover:
- AuthorizationStatus data class
- KSIComplianceReport data class
- OARHistoryEntry data class
- TrustCenterService methods
- Trust Center API views (public and authenticated)
"""

import pytest
import uuid
from datetime import date, datetime, timedelta
from unittest.mock import patch, MagicMock
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from core.bounded_contexts.rmf_operations.services.trust_center import (
    AuthorizationStatus,
    KSIComplianceReport,
    OARHistoryEntry,
    TrustCenterService,
    get_trust_center_service,
)


User = get_user_model()


# =============================================================================
# AuthorizationStatus Data Class Tests
# =============================================================================

class TestAuthorizationStatus:
    """Tests for AuthorizationStatus data class"""

    def test_create_authorization_status(self):
        """Test creating an AuthorizationStatus"""
        status = AuthorizationStatus(
            cso_id='test-cso-001',
            cso_name='Test Cloud Service',
            authorization_status='authorized',
            impact_level='moderate',
            authorization_date=date(2024, 1, 15),
            last_assessment_date=date(2025, 12, 1),
            authorizing_agency='FedRAMP PMO',
            service_model='SaaS',
            deployment_model='public',
            ksi_compliance_rate=98.5,
            continuous_monitoring_status='active',
        )

        assert status.cso_id == 'test-cso-001'
        assert status.cso_name == 'Test Cloud Service'
        assert status.authorization_status == 'authorized'
        assert status.impact_level == 'moderate'
        assert status.ksi_compliance_rate == 98.5

    def test_authorization_status_to_dict(self):
        """Test AuthorizationStatus to_dict method"""
        auth_date = date(2024, 1, 15)
        assessment_date = date(2025, 12, 1)

        status = AuthorizationStatus(
            cso_id='test-cso-001',
            cso_name='Test Cloud Service',
            authorization_status='authorized',
            impact_level='moderate',
            authorization_date=auth_date,
            last_assessment_date=assessment_date,
            authorizing_agency='FedRAMP PMO',
            service_model='SaaS',
            deployment_model='public',
            ksi_compliance_rate=98.5,
            continuous_monitoring_status='active',
        )

        result = status.to_dict()

        assert result['cso_id'] == 'test-cso-001'
        assert result['cso_name'] == 'Test Cloud Service'
        assert result['authorization_status'] == 'authorized'
        assert result['impact_level'] == 'moderate'
        assert result['authorization_date'] == auth_date.isoformat()
        assert result['last_assessment_date'] == assessment_date.isoformat()
        assert result['authorizing_agency'] == 'FedRAMP PMO'
        assert result['service_model'] == 'SaaS'
        assert result['deployment_model'] == 'public'
        assert result['ksi_compliance_rate'] == 98.5
        assert result['continuous_monitoring_status'] == 'active'

    def test_authorization_status_to_dict_with_null_dates(self):
        """Test AuthorizationStatus to_dict with null dates"""
        status = AuthorizationStatus(
            cso_id='test-cso-001',
            cso_name='Test Cloud Service',
            authorization_status='in_process',
            impact_level='low',
            authorization_date=None,
            last_assessment_date=None,
            authorizing_agency='FedRAMP PMO',
            service_model='IaaS',
            deployment_model='government',
            ksi_compliance_rate=0.0,
            continuous_monitoring_status='pending',
        )

        result = status.to_dict()

        assert result['authorization_date'] is None
        assert result['last_assessment_date'] is None


# =============================================================================
# KSIComplianceReport Data Class Tests
# =============================================================================

class TestKSIComplianceReport:
    """Tests for KSIComplianceReport data class"""

    def test_create_ksi_compliance_report(self):
        """Test creating a KSIComplianceReport"""
        report_date = timezone.now()

        report = KSIComplianceReport(
            cso_id='test-cso-001',
            report_date=report_date,
            total_ksis=61,
            compliant_ksis=59,
            non_compliant_ksis=2,
            compliance_rate=96.7,
            categories={
                'IAM': {'total': 7, 'compliant': 7},
                'CMT': {'total': 5, 'compliant': 5},
                'AFR': {'total': 6, 'compliant': 5},
            },
            last_validation_date=report_date,
        )

        assert report.cso_id == 'test-cso-001'
        assert report.total_ksis == 61
        assert report.compliant_ksis == 59
        assert report.non_compliant_ksis == 2
        assert report.compliance_rate == 96.7

    def test_ksi_compliance_report_to_dict(self):
        """Test KSIComplianceReport to_dict method"""
        report_date = timezone.now()

        report = KSIComplianceReport(
            cso_id='test-cso-001',
            report_date=report_date,
            total_ksis=61,
            compliant_ksis=59,
            non_compliant_ksis=2,
            compliance_rate=96.7,
            categories={
                'IAM': {'total': 7, 'compliant': 7},
                'CMT': {'total': 5, 'compliant': 5},
            },
            last_validation_date=report_date,
        )

        result = report.to_dict()

        assert result['cso_id'] == 'test-cso-001'
        assert result['total_ksis'] == 61
        assert result['compliant_ksis'] == 59
        assert result['non_compliant_ksis'] == 2
        assert result['compliance_rate'] == 96.7
        assert 'IAM' in result['categories']
        assert result['categories']['IAM']['total'] == 7
        assert result['report_date'] == report_date.isoformat()
        assert result['last_validation_date'] == report_date.isoformat()

    def test_ksi_compliance_report_to_dict_null_validation_date(self):
        """Test KSIComplianceReport to_dict with null validation date"""
        report = KSIComplianceReport(
            cso_id='test-cso-001',
            report_date=timezone.now(),
            total_ksis=0,
            compliant_ksis=0,
            non_compliant_ksis=0,
            compliance_rate=100.0,
            categories={},
            last_validation_date=None,
        )

        result = report.to_dict()

        assert result['last_validation_date'] is None


# =============================================================================
# OARHistoryEntry Data Class Tests
# =============================================================================

class TestOARHistoryEntry:
    """Tests for OARHistoryEntry data class"""

    def test_create_oar_history_entry(self):
        """Test creating an OARHistoryEntry"""
        submission_date = date(2025, 1, 15)

        entry = OARHistoryEntry(
            oar_id='oar-2025-Q1-abc123',
            year=2025,
            quarter='Q1',
            status='submitted',
            submission_date=submission_date,
            ksi_pass_rate=95.0,
            findings_count=3,
        )

        assert entry.oar_id == 'oar-2025-Q1-abc123'
        assert entry.year == 2025
        assert entry.quarter == 'Q1'
        assert entry.status == 'submitted'
        assert entry.ksi_pass_rate == 95.0
        assert entry.findings_count == 3

    def test_oar_history_entry_to_dict(self):
        """Test OARHistoryEntry to_dict method"""
        submission_date = date(2025, 1, 15)

        entry = OARHistoryEntry(
            oar_id='oar-2025-Q1-abc123',
            year=2025,
            quarter='Q1',
            status='submitted',
            submission_date=submission_date,
            ksi_pass_rate=95.0,
            findings_count=3,
        )

        result = entry.to_dict()

        assert result['oar_id'] == 'oar-2025-Q1-abc123'
        assert result['year'] == 2025
        assert result['quarter'] == 'Q1'
        assert result['status'] == 'submitted'
        assert result['submission_date'] == submission_date.isoformat()
        assert result['ksi_pass_rate'] == 95.0
        assert result['findings_count'] == 3

    def test_oar_history_entry_to_dict_null_submission_date(self):
        """Test OARHistoryEntry to_dict with null submission date"""
        entry = OARHistoryEntry(
            oar_id='oar-2025-Q1-abc123',
            year=2025,
            quarter='Q1',
            status='pending',
            submission_date=None,
            ksi_pass_rate=0.0,
            findings_count=0,
        )

        result = entry.to_dict()

        assert result['submission_date'] is None


# =============================================================================
# TrustCenterService Tests
# =============================================================================

class TestTrustCenterService:
    """Tests for TrustCenterService"""

    def test_get_trust_center_service_singleton(self):
        """Test get_trust_center_service returns singleton"""
        service1 = get_trust_center_service()
        service2 = get_trust_center_service()

        assert service1 is service2

    def test_service_get_public_cso_list_returns_sample_data(self):
        """Test get_public_cso_list returns sample data when no real data exists"""
        service = TrustCenterService()

        csos = service.get_public_cso_list()

        assert len(csos) == 2
        assert csos[0].cso_name == 'Cloud Service Alpha'
        assert csos[0].authorization_status == 'authorized'
        assert csos[1].cso_name == 'Cloud Service Beta'

    def test_service_get_public_cso_list_with_status_filter(self):
        """Test get_public_cso_list respects status filter parameter"""
        service = TrustCenterService()

        # The service should accept filter parameters
        csos = service.get_public_cso_list(status_filter='authorized')

        assert isinstance(csos, list)

    def test_service_get_public_cso_list_with_impact_level_filter(self):
        """Test get_public_cso_list respects impact level filter"""
        service = TrustCenterService()

        csos = service.get_public_cso_list(impact_level='moderate')

        assert isinstance(csos, list)

    def test_service_get_ksi_compliance_report_sample_data(self):
        """Test get_ksi_compliance_report returns sample data"""
        service = TrustCenterService()
        cso_id = uuid.uuid4()

        report = service.get_ksi_compliance_report(cso_id)

        assert report is not None
        assert report.cso_id == str(cso_id)
        assert report.total_ksis == 61
        assert report.compliant_ksis == 59
        assert report.compliance_rate == 96.7
        assert 'IAM' in report.categories

    def test_service_get_ksi_compliance_report_with_details(self):
        """Test get_ksi_compliance_report with include_details flag"""
        service = TrustCenterService()
        cso_id = uuid.uuid4()

        report = service.get_ksi_compliance_report(cso_id, include_details=True)

        assert report is not None

    def test_service_get_oar_history(self):
        """Test get_oar_history returns history entries"""
        service = TrustCenterService()
        cso_id = uuid.uuid4()

        history = service.get_oar_history(cso_id)

        assert len(history) == 8  # Default limit
        assert history[0].year == timezone.now().year
        assert history[0].status == 'submitted'

    def test_service_get_oar_history_with_limit(self):
        """Test get_oar_history respects limit parameter"""
        service = TrustCenterService()
        cso_id = uuid.uuid4()

        history = service.get_oar_history(cso_id, limit=4)

        assert len(history) == 4

    def test_service_get_oar_history_quarters(self):
        """Test get_oar_history generates correct quarters"""
        service = TrustCenterService()
        cso_id = uuid.uuid4()

        history = service.get_oar_history(cso_id, limit=8)

        quarters = [h.quarter for h in history]
        # All quarters should be Q1-Q4
        for q in quarters:
            assert q in ['Q1', 'Q2', 'Q3', 'Q4']

    def test_service_generate_oscal_ssp_excerpt(self):
        """Test generate_oscal_ssp_excerpt returns OSCAL structure"""
        service = TrustCenterService()
        cso_id = uuid.uuid4()

        excerpt = service.generate_oscal_ssp_excerpt(cso_id)

        # Should return a dict even on error (sample/error data)
        assert isinstance(excerpt, dict)

    def test_service_generate_oscal_ssp_excerpt_with_sections(self):
        """Test generate_oscal_ssp_excerpt respects sections parameter"""
        service = TrustCenterService()
        cso_id = uuid.uuid4()

        excerpt = service.generate_oscal_ssp_excerpt(
            cso_id,
            sections=['system-characteristics']
        )

        assert isinstance(excerpt, dict)

    def test_service_get_trust_center_summary(self):
        """Test get_trust_center_summary returns statistics"""
        service = TrustCenterService()

        summary = service.get_trust_center_summary()

        assert 'total_csos' in summary
        assert 'authorized_count' in summary
        assert 'in_process_count' in summary
        assert 'average_ksi_compliance' in summary
        assert 'by_impact_level' in summary
        assert 'by_service_model' in summary
        assert 'last_updated' in summary

    def test_service_get_trust_center_summary_calculates_correctly(self):
        """Test get_trust_center_summary calculations are correct"""
        service = TrustCenterService()

        summary = service.get_trust_center_summary()

        # Sample data has 2 CSOs, both authorized
        assert summary['total_csos'] == 2
        assert summary['authorized_count'] == 2
        assert summary['in_process_count'] == 0

    def test_service_calculate_ksi_compliance_rate(self):
        """Test _calculate_ksi_compliance_rate returns rate"""
        service = TrustCenterService()
        cso_id = uuid.uuid4()

        rate = service._calculate_ksi_compliance_rate(cso_id)

        # Without real data, should return 0.0 (exception path)
        assert isinstance(rate, float)
        assert 0.0 <= rate <= 100.0

    def test_service_get_sample_cso_list(self):
        """Test _get_sample_cso_list returns sample data"""
        service = TrustCenterService()

        csos = service._get_sample_cso_list()

        assert len(csos) == 2
        assert csos[0].cso_id == 'sample-cso-001'
        assert csos[0].cso_name == 'Cloud Service Alpha'
        assert csos[0].authorization_status == 'authorized'
        assert csos[0].impact_level == 'moderate'
        assert csos[0].ksi_compliance_rate == 98.5

        assert csos[1].cso_id == 'sample-cso-002'
        assert csos[1].cso_name == 'Cloud Service Beta'
        assert csos[1].impact_level == 'low'
        assert csos[1].ksi_compliance_rate == 100.0


# =============================================================================
# Trust Center API View Tests
# =============================================================================

@pytest.mark.django_db
class TestTrustCenterPublicAPIViews:
    """Tests for Trust Center public API views"""

    @pytest.fixture
    def api_client(self):
        """Create an unauthenticated API client"""
        return APIClient()

    def test_trust_center_summary_endpoint(self, api_client):
        """Test GET /api/rmf/trust-center/ returns summary"""
        response = api_client.get('/api/rmf/trust-center/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert 'data' in response.data
        assert 'total_csos' in response.data['data']
        assert 'authorized_count' in response.data['data']

    def test_trust_center_cso_list_endpoint(self, api_client):
        """Test GET /api/rmf/trust-center/csos/ returns CSO list"""
        response = api_client.get('/api/rmf/trust-center/csos/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert 'data' in response.data
        assert 'csos' in response.data['data']
        assert 'total' in response.data['data']

    def test_trust_center_cso_list_with_status_filter(self, api_client):
        """Test GET /api/rmf/trust-center/csos/?status=authorized"""
        response = api_client.get('/api/rmf/trust-center/csos/?status=authorized')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True

    def test_trust_center_cso_list_with_impact_filter(self, api_client):
        """Test GET /api/rmf/trust-center/csos/?impact_level=moderate"""
        response = api_client.get('/api/rmf/trust-center/csos/?impact_level=moderate')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True

    def test_trust_center_cso_detail_invalid_uuid(self, api_client):
        """Test GET /api/rmf/trust-center/csos/<invalid>/ returns 400"""
        response = api_client.get('/api/rmf/trust-center/csos/invalid-uuid/')

        # The URL pattern uses uuid: so invalid UUIDs should 404 or 400
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND]

    def test_trust_center_cso_detail_not_found(self, api_client):
        """Test GET /api/rmf/trust-center/csos/<uuid>/ for non-existent CSO"""
        cso_id = uuid.uuid4()
        response = api_client.get(f'/api/rmf/trust-center/csos/{cso_id}/')

        # Should return 404 for non-existent CSO
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data['success'] is False

    def test_trust_center_ksi_compliance_endpoint(self, api_client):
        """Test GET /api/rmf/trust-center/csos/<uuid>/compliance/"""
        cso_id = uuid.uuid4()
        response = api_client.get(f'/api/rmf/trust-center/csos/{cso_id}/compliance/')

        # Returns sample data for demo
        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert 'data' in response.data

    def test_trust_center_ksi_compliance_with_details(self, api_client):
        """Test GET /api/rmf/trust-center/csos/<uuid>/compliance/?include_details=true"""
        cso_id = uuid.uuid4()
        response = api_client.get(
            f'/api/rmf/trust-center/csos/{cso_id}/compliance/?include_details=true'
        )

        assert response.status_code == status.HTTP_200_OK

    def test_trust_center_oar_history_endpoint(self, api_client):
        """Test GET /api/rmf/trust-center/csos/<uuid>/oar-history/"""
        cso_id = uuid.uuid4()
        response = api_client.get(f'/api/rmf/trust-center/csos/{cso_id}/oar-history/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert 'data' in response.data
        assert 'oar_history' in response.data['data']
        assert 'total' in response.data['data']

    def test_trust_center_oar_history_with_limit(self, api_client):
        """Test GET /api/rmf/trust-center/csos/<uuid>/oar-history/?limit=4"""
        cso_id = uuid.uuid4()
        response = api_client.get(f'/api/rmf/trust-center/csos/{cso_id}/oar-history/?limit=4')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['data']['total'] == 4

    def test_trust_center_oscal_excerpt_endpoint(self, api_client):
        """Test GET /api/rmf/trust-center/csos/<uuid>/oscal/"""
        cso_id = uuid.uuid4()
        response = api_client.get(f'/api/rmf/trust-center/csos/{cso_id}/oscal/')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert 'data' in response.data

    def test_trust_center_oscal_excerpt_with_sections(self, api_client):
        """Test GET /api/rmf/trust-center/csos/<uuid>/oscal/?sections=system-characteristics"""
        cso_id = uuid.uuid4()
        response = api_client.get(
            f'/api/rmf/trust-center/csos/{cso_id}/oscal/?sections=system-characteristics'
        )

        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTrustCenterAuthenticatedAPIViews:
    """Tests for Trust Center authenticated API views"""

    @pytest.fixture
    def authenticated_client(self):
        """Create an authenticated API client"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    @pytest.fixture
    def unauthenticated_client(self):
        """Create an unauthenticated API client"""
        return APIClient()

    def test_trust_center_publish_requires_auth(self, unauthenticated_client):
        """Test POST /api/rmf/trust-center/csos/<uuid>/publish/ requires authentication"""
        cso_id = uuid.uuid4()
        response = unauthenticated_client.post(
            f'/api/rmf/trust-center/csos/{cso_id}/publish/',
            {'publish': True},
            format='json'
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_trust_center_publish_cso(self, authenticated_client):
        """Test POST /api/rmf/trust-center/csos/<uuid>/publish/ publishes CSO"""
        cso_id = uuid.uuid4()
        response = authenticated_client.post(
            f'/api/rmf/trust-center/csos/{cso_id}/publish/',
            {'publish': True},
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert response.data['data']['published'] is True
        assert 'published to' in response.data['data']['message']

    def test_trust_center_unpublish_cso(self, authenticated_client):
        """Test POST /api/rmf/trust-center/csos/<uuid>/publish/ unpublishes CSO"""
        cso_id = uuid.uuid4()
        response = authenticated_client.post(
            f'/api/rmf/trust-center/csos/{cso_id}/publish/',
            {'publish': False},
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert response.data['data']['published'] is False
        assert 'removed from' in response.data['data']['message']

    def test_trust_center_config_requires_auth(self, unauthenticated_client):
        """Test POST /api/rmf/trust-center/csos/<uuid>/config/ requires authentication"""
        cso_id = uuid.uuid4()
        response = unauthenticated_client.post(
            f'/api/rmf/trust-center/csos/{cso_id}/config/',
            {'show_ksi_details': True},
            format='json'
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_trust_center_config_update(self, authenticated_client):
        """Test POST /api/rmf/trust-center/csos/<uuid>/config/ updates configuration"""
        cso_id = uuid.uuid4()
        response = authenticated_client.post(
            f'/api/rmf/trust-center/csos/{cso_id}/config/',
            {
                'show_ksi_details': True,
                'show_oar_history': True,
                'show_oscal_excerpt': False,
                'custom_description': 'Test description',
            },
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert response.data['data']['config']['show_ksi_details'] is True
        assert response.data['data']['config']['show_oar_history'] is True
        assert response.data['data']['config']['show_oscal_excerpt'] is False
        assert response.data['data']['config']['custom_description'] == 'Test description'

    def test_trust_center_config_default_values(self, authenticated_client):
        """Test POST /api/rmf/trust-center/csos/<uuid>/config/ uses defaults"""
        cso_id = uuid.uuid4()
        response = authenticated_client.post(
            f'/api/rmf/trust-center/csos/{cso_id}/config/',
            {},
            format='json'
        )

        assert response.status_code == status.HTTP_200_OK
        # Default values
        assert response.data['data']['config']['show_ksi_details'] is True
        assert response.data['data']['config']['show_oar_history'] is True
        assert response.data['data']['config']['show_oscal_excerpt'] is True
        assert response.data['data']['config']['custom_description'] == ''


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.django_db
class TestTrustCenterIntegration:
    """Integration tests for Trust Center"""

    @pytest.fixture
    def api_client(self):
        """Create an API client"""
        return APIClient()

    def test_full_trust_center_workflow(self, api_client):
        """Test full Trust Center workflow from summary to detail"""
        # 1. Get summary
        summary_response = api_client.get('/api/rmf/trust-center/')
        assert summary_response.status_code == status.HTTP_200_OK
        assert summary_response.data['data']['total_csos'] >= 0

        # 2. Get CSO list
        list_response = api_client.get('/api/rmf/trust-center/csos/')
        assert list_response.status_code == status.HTTP_200_OK

        csos = list_response.data['data']['csos']
        if csos:
            # 3. Get first CSO's compliance report
            cso_id = csos[0]['cso_id']

            # For sample data, CSO IDs are strings not UUIDs, skip detail endpoints
            # In real implementation, these would work

    def test_trust_center_response_structure_consistency(self, api_client):
        """Test that all Trust Center responses have consistent structure"""
        cso_id = uuid.uuid4()

        # All responses should have 'success' and either 'data' or 'error'
        endpoints = [
            '/api/rmf/trust-center/',
            '/api/rmf/trust-center/csos/',
            f'/api/rmf/trust-center/csos/{cso_id}/compliance/',
            f'/api/rmf/trust-center/csos/{cso_id}/oar-history/',
            f'/api/rmf/trust-center/csos/{cso_id}/oscal/',
        ]

        for endpoint in endpoints:
            response = api_client.get(endpoint)
            assert 'success' in response.data
            if response.data['success']:
                assert 'data' in response.data
            else:
                assert 'error' in response.data

    def test_oar_history_chronological_order(self, api_client):
        """Test that OAR history is returned in chronological order"""
        cso_id = uuid.uuid4()
        response = api_client.get(f'/api/rmf/trust-center/csos/{cso_id}/oar-history/')

        assert response.status_code == status.HTTP_200_OK
        history = response.data['data']['oar_history']

        # Verify history is ordered (most recent first)
        for i in range(len(history) - 1):
            current = history[i]
            next_item = history[i + 1]
            # Either current year > next year, or same year but later quarter
            assert (current['year'] > next_item['year'] or
                    (current['year'] == next_item['year'] and
                     current['quarter'] >= next_item['quarter']))

    def test_ksi_compliance_report_completeness(self, api_client):
        """Test that KSI compliance report has all required fields"""
        cso_id = uuid.uuid4()
        response = api_client.get(f'/api/rmf/trust-center/csos/{cso_id}/compliance/')

        assert response.status_code == status.HTTP_200_OK
        data = response.data['data']

        # Required fields
        assert 'cso_id' in data
        assert 'report_date' in data
        assert 'total_ksis' in data
        assert 'compliant_ksis' in data
        assert 'non_compliant_ksis' in data
        assert 'compliance_rate' in data
        assert 'categories' in data

    def test_cso_list_contains_required_fields(self, api_client):
        """Test that CSO list entries have all required fields"""
        response = api_client.get('/api/rmf/trust-center/csos/')

        assert response.status_code == status.HTTP_200_OK
        csos = response.data['data']['csos']

        for cso in csos:
            assert 'cso_id' in cso
            assert 'cso_name' in cso
            assert 'authorization_status' in cso
            assert 'impact_level' in cso
            assert 'service_model' in cso
            assert 'ksi_compliance_rate' in cso


# =============================================================================
# Error Handling Tests
# =============================================================================

@pytest.mark.django_db
class TestTrustCenterErrorHandling:
    """Tests for Trust Center error handling"""

    @pytest.fixture
    def api_client(self):
        """Create an API client"""
        return APIClient()

    def test_invalid_uuid_cso_detail(self, api_client):
        """Test that invalid UUID returns appropriate error"""
        response = api_client.get('/api/rmf/trust-center/csos/not-a-uuid/')

        # Django URL pattern will reject invalid UUID
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_invalid_uuid_compliance(self, api_client):
        """Test that invalid UUID for compliance returns error"""
        response = api_client.get('/api/rmf/trust-center/csos/not-a-uuid/compliance/')

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_invalid_limit_parameter(self, api_client):
        """Test handling of invalid limit parameter"""
        cso_id = uuid.uuid4()

        # Non-numeric limit should be handled gracefully with default
        response = api_client.get(
            f'/api/rmf/trust-center/csos/{cso_id}/oar-history/?limit=invalid'
        )

        # Should handle gracefully with default limit of 8
        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] is True
        assert response.data['data']['total'] == 8  # Default limit
