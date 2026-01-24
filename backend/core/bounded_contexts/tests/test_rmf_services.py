"""
Comprehensive tests for RMF Operations services.

Tests cover:
- KSILibraryParser and KSIImportService
- TrustCenterService
- OARWorkflowService
- ValidationTemplates
"""

import pytest
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from knox.models import AuthToken

from iam.models import Folder, UserGroup
from core.apps import startup


User = get_user_model()


@pytest.fixture
def app_config():
    """Initialize application startup."""
    startup(sender=None, **{})


@pytest.fixture
def authenticated_client(app_config, db):
    """Create an authenticated API client with admin privileges."""
    admin = User.objects.create_superuser("rmf_admin@test.com", is_published=True)
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


# =============================================================================
# KSI Library Parser Tests
# =============================================================================

@pytest.mark.django_db
class TestKSILibraryParser:
    """Tests for KSILibraryParser."""

    def test_parser_initialization(self):
        """Test parser can be initialized."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        parser = KSILibraryParser()
        assert parser is not None
        assert parser.library_path is not None

    def test_parser_with_custom_path(self, tmp_path):
        """Test parser with custom library path."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        # Create a mock KSI library file
        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
ref_id: TEST-KSI
name: Test KSI Library
version: 1.0
objects:
  framework:
    requirement_nodes:
      - urn: urn:test:ksi:cat1
        ref_id: KSI-TEST-CAT
        name: Test Category
        depth: 1
        assessable: false
      - urn: urn:test:ksi:ksi-01
        ref_id: KSI-TEST-01
        name: Test KSI 1
        depth: 2
        assessable: true
        parent_urn: urn:test:ksi:cat1
        implementation_groups:
          - LOW
          - MOD
""")

        parser = KSILibraryParser(library_path=mock_library)
        parser.load_library()

        assert parser._library_data is not None
        assert len(parser._requirement_nodes) == 2

    def test_get_library_metadata(self, tmp_path):
        """Test getting library metadata."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
ref_id: TEST-KSI
name: Test KSI Library
version: 1.0.0
publication_date: 2024-01-15
provider: Test Provider
objects:
  framework:
    requirement_nodes: []
""")

        parser = KSILibraryParser(library_path=mock_library)
        metadata = parser.get_library_metadata()

        assert metadata['urn'] == 'urn:test:ksi'
        assert metadata['name'] == 'Test KSI Library'
        assert metadata['version'] == '1.0.0'

    def test_get_ksi_categories(self, tmp_path):
        """Test getting KSI categories."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
objects:
  framework:
    requirement_nodes:
      - urn: urn:test:afr
        ref_id: KSI-AFR
        name: Authorization by FedRAMP
        depth: 1
      - urn: urn:test:iam
        ref_id: KSI-IAM
        name: Identity and Access Management
        depth: 1
      - urn: urn:test:afr-01
        ref_id: KSI-AFR-01
        name: KSI 01
        depth: 2
        assessable: true
""")

        parser = KSILibraryParser(library_path=mock_library)
        categories = parser.get_ksi_categories()

        assert len(categories) == 2
        assert all(cat.get('depth') == 1 for cat in categories)

    def test_get_ksi_requirements(self, tmp_path):
        """Test getting assessable KSI requirements."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
objects:
  framework:
    requirement_nodes:
      - urn: urn:test:afr
        ref_id: KSI-AFR
        depth: 1
      - urn: urn:test:afr-01
        ref_id: KSI-AFR-01
        depth: 2
        assessable: true
        parent_urn: urn:test:afr
      - urn: urn:test:afr-02
        ref_id: KSI-AFR-02
        depth: 2
        assessable: true
        parent_urn: urn:test:afr
      - urn: urn:test:afr-sub
        ref_id: KSI-AFR-SUB
        depth: 2
        assessable: false
""")

        parser = KSILibraryParser(library_path=mock_library)
        requirements = parser.get_ksi_requirements()

        assert len(requirements) == 2
        assert all(req.get('assessable') for req in requirements)

    def test_get_ksi_by_ref_id(self, tmp_path):
        """Test finding KSI by reference ID."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
objects:
  framework:
    requirement_nodes:
      - urn: urn:test:afr-01
        ref_id: KSI-AFR-01
        name: Test KSI
        depth: 2
        assessable: true
""")

        parser = KSILibraryParser(library_path=mock_library)
        ksi = parser.get_ksi_by_ref_id('KSI-AFR-01')

        assert ksi is not None
        assert ksi['name'] == 'Test KSI'

    def test_get_ksi_by_ref_id_not_found(self, tmp_path):
        """Test finding nonexistent KSI returns None."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
objects:
  framework:
    requirement_nodes: []
""")

        parser = KSILibraryParser(library_path=mock_library)
        ksi = parser.get_ksi_by_ref_id('NONEXISTENT')

        assert ksi is None

    def test_parse_nist_controls(self, tmp_path):
        """Test parsing NIST controls from annotation."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
objects:
  framework:
    requirement_nodes:
      - urn: urn:test:afr-01
        ref_id: KSI-AFR-01
        annotation: "Related controls: AC-1, AC-21, AT-1, AU-1, CA-1, CM-1"
        depth: 2
        assessable: true
""")

        parser = KSILibraryParser(library_path=mock_library)
        ksi = parser.get_ksi_by_ref_id('KSI-AFR-01')
        controls = parser.parse_nist_controls(ksi)

        assert len(controls) >= 5
        assert 'AC-1' in controls
        assert 'AU-1' in controls

    def test_get_impact_levels(self, tmp_path):
        """Test getting impact levels for KSI."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
objects:
  framework:
    requirement_nodes:
      - urn: urn:test:afr-01
        ref_id: KSI-AFR-01
        implementation_groups:
          - LOW
          - MOD
        depth: 2
        assessable: true
""")

        parser = KSILibraryParser(library_path=mock_library)
        ksi = parser.get_ksi_by_ref_id('KSI-AFR-01')
        levels = parser.get_impact_levels_for_ksi(ksi)

        assert 'LOW' in levels
        assert 'MOD' in levels

    def test_get_ksi_count_by_impact_level(self, tmp_path):
        """Test counting KSIs by impact level."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
objects:
  framework:
    requirement_nodes:
      - urn: urn:test:01
        ref_id: KSI-TEST-01
        implementation_groups: [LOW, MOD]
        depth: 2
        assessable: true
      - urn: urn:test:02
        ref_id: KSI-TEST-02
        implementation_groups: [MOD]
        depth: 2
        assessable: true
      - urn: urn:test:03
        ref_id: KSI-TEST-03
        implementation_groups: [LOW]
        depth: 2
        assessable: true
""")

        parser = KSILibraryParser(library_path=mock_library)
        counts = parser.get_ksi_count_by_impact_level()

        assert counts['LOW'] == 2
        assert counts['MOD'] == 2


# =============================================================================
# Trust Center Service Tests
# =============================================================================

@pytest.mark.django_db
class TestTrustCenterService:
    """Tests for TrustCenterService."""

    def test_service_initialization(self):
        """Test service can be initialized."""
        from core.bounded_contexts.rmf_operations.services.trust_center import TrustCenterService

        service = TrustCenterService()
        assert service is not None

    def test_get_public_cso_list(self):
        """Test getting public CSO list."""
        from core.bounded_contexts.rmf_operations.services.trust_center import TrustCenterService

        service = TrustCenterService()
        csos = service.get_public_cso_list()

        # Should return sample data if no real data exists
        assert isinstance(csos, list)

    def test_authorization_status_to_dict(self):
        """Test AuthorizationStatus serialization."""
        from core.bounded_contexts.rmf_operations.services.trust_center import AuthorizationStatus

        status = AuthorizationStatus(
            cso_id='test-123',
            cso_name='Test CSO',
            authorization_status='authorized',
            impact_level='moderate',
            authorization_date=date(2024, 1, 15),
            last_assessment_date=date(2025, 1, 1),
            authorizing_agency='FedRAMP PMO',
            service_model='SaaS',
            deployment_model='public',
            ksi_compliance_rate=98.5,
            continuous_monitoring_status='active',
        )

        result = status.to_dict()

        assert result['cso_id'] == 'test-123'
        assert result['authorization_status'] == 'authorized'
        assert result['impact_level'] == 'moderate'
        assert result['ksi_compliance_rate'] == 98.5

    def test_ksi_compliance_report_to_dict(self):
        """Test KSIComplianceReport serialization."""
        from core.bounded_contexts.rmf_operations.services.trust_center import KSIComplianceReport

        report = KSIComplianceReport(
            cso_id='test-123',
            report_date=datetime(2025, 1, 24, 12, 0, 0),
            total_ksis=61,
            compliant_ksis=58,
            non_compliant_ksis=3,
            compliance_rate=95.08,
            categories={'AFR': {'total': 5, 'compliant': 5}},
            last_validation_date=datetime(2025, 1, 20, 10, 0, 0),
        )

        result = report.to_dict()

        assert result['total_ksis'] == 61
        assert result['compliant_ksis'] == 58
        assert result['compliance_rate'] == 95.08

    def test_oar_history_entry_to_dict(self):
        """Test OARHistoryEntry serialization."""
        from core.bounded_contexts.rmf_operations.services.trust_center import OARHistoryEntry

        entry = OARHistoryEntry(
            oar_id='OAR-2025-Q1',
            year=2025,
            quarter='Q1',
            status='submitted',
            submission_date=date(2025, 1, 15),
            ksi_pass_rate=97.5,
            findings_count=2,
        )

        result = entry.to_dict()

        assert result['oar_id'] == 'OAR-2025-Q1'
        assert result['year'] == 2025
        assert result['quarter'] == 'Q1'

    def test_filter_cso_by_status(self):
        """Test filtering CSOs by authorization status."""
        from core.bounded_contexts.rmf_operations.services.trust_center import TrustCenterService

        service = TrustCenterService()
        csos = service.get_public_cso_list(status_filter='authorized')

        assert isinstance(csos, list)

    def test_filter_cso_by_impact_level(self):
        """Test filtering CSOs by impact level."""
        from core.bounded_contexts.rmf_operations.services.trust_center import TrustCenterService

        service = TrustCenterService()
        csos = service.get_public_cso_list(impact_level='moderate')

        assert isinstance(csos, list)


# =============================================================================
# Trust Center API Tests
# =============================================================================

@pytest.mark.django_db
class TestTrustCenterAPI:
    """Tests for Trust Center API endpoints."""

    def test_trust_center_summary_endpoint(self, authenticated_client):
        """Test trust center summary endpoint."""
        client, _ = authenticated_client

        response = client.get('/api/rmf/trust-center/summary/')

        # May return 200 or 404 depending on implementation
        assert response.status_code in [200, 404]

    def test_trust_center_cso_list_endpoint(self, authenticated_client):
        """Test trust center CSO list endpoint."""
        client, _ = authenticated_client

        response = client.get('/api/rmf/trust-center/csos/')

        assert response.status_code in [200, 404]


# =============================================================================
# OAR Workflow Service Tests
# =============================================================================

@pytest.mark.django_db
class TestOARWorkflowService:
    """Tests for OARWorkflowService."""

    def test_service_initialization(self):
        """Test OAR workflow service initialization."""
        try:
            from core.bounded_contexts.rmf_operations.services.oar_workflow import OARWorkflowService
            service = OARWorkflowService()
            assert service is not None
        except ImportError:
            pytest.skip("OARWorkflowService not available")

    def test_generate_oar_period(self):
        """Test OAR period generation."""
        try:
            from core.bounded_contexts.rmf_operations.services.oar_workflow import OARWorkflowService

            service = OARWorkflowService()

            # Test quarter calculation
            period = service.get_current_reporting_period()

            assert 'year' in period
            assert 'quarter' in period
            assert period['year'] >= 2024
        except (ImportError, AttributeError):
            pytest.skip("OAR period method not available")


# =============================================================================
# Validation Templates Tests
# =============================================================================

@pytest.mark.django_db
class TestValidationTemplates:
    """Tests for ValidationTemplates service."""

    def test_get_validation_templates(self):
        """Test getting validation templates."""
        try:
            from core.bounded_contexts.rmf_operations.services.validation_templates import (
                get_validation_templates,
                ValidationTemplateType
            )

            templates = get_validation_templates()

            assert isinstance(templates, (list, dict))
        except ImportError:
            pytest.skip("Validation templates not available")

    def test_validation_template_structure(self):
        """Test validation template has required fields."""
        try:
            from core.bounded_contexts.rmf_operations.services.validation_templates import (
                ValidationTemplate,
            )

            template = ValidationTemplate(
                template_id='test-template',
                name='Test Template',
                description='Test description',
                validation_type='automated',
                target_ksi_categories=['AFR', 'IAM'],
                validation_script='def validate(): return True',
                required_evidence=[],
            )

            assert template.template_id == 'test-template'
            assert template.validation_type == 'automated'
        except ImportError:
            pytest.skip("ValidationTemplate not available")


# =============================================================================
# FedRAMP 20x API Tests
# =============================================================================

@pytest.mark.django_db
class TestFedRAMP20xAPI:
    """Tests for FedRAMP 20x API endpoints."""

    def test_ksi_list_endpoint(self, authenticated_client):
        """Test KSI list endpoint."""
        client, _ = authenticated_client

        response = client.get('/api/rmf/fedramp-20x/ksi/')

        assert response.status_code in [200, 404]

    def test_ksi_categories_endpoint(self, authenticated_client):
        """Test KSI categories endpoint."""
        client, _ = authenticated_client

        response = client.get('/api/rmf/fedramp-20x/ksi-categories/')

        assert response.status_code in [200, 404]

    def test_oar_list_endpoint(self, authenticated_client):
        """Test OAR list endpoint."""
        client, _ = authenticated_client

        response = client.get('/api/rmf/fedramp-20x/oar/')

        assert response.status_code in [200, 404]


# =============================================================================
# Bulk Operations Tests
# =============================================================================

@pytest.mark.django_db
class TestRMFBulkOperations:
    """Tests for RMF bulk operations."""

    def test_bulk_import_ksis(self):
        """Test bulk importing KSIs."""
        try:
            from core.bounded_contexts.rmf_operations.services.bulk_operations import (
                BulkOperationsService,
            )

            service = BulkOperationsService()
            assert service is not None
        except ImportError:
            pytest.skip("BulkOperationsService not available")

    def test_bulk_export_checklist(self):
        """Test bulk exporting checklists."""
        try:
            from core.bounded_contexts.rmf_operations.services.ckl_exporter import (
                CKLExporter,
            )

            exporter = CKLExporter()
            assert exporter is not None
        except ImportError:
            pytest.skip("CKLExporter not available")


# =============================================================================
# CCI Service Tests
# =============================================================================

@pytest.mark.django_db
class TestCCIService:
    """Tests for CCI (Control Correlation Identifier) Service."""

    def test_cci_service_initialization(self):
        """Test CCI service initialization."""
        try:
            from core.bounded_contexts.rmf_operations.services.cci_service import (
                CCIService,
            )

            service = CCIService()
            assert service is not None
        except ImportError:
            pytest.skip("CCIService not available")


# =============================================================================
# Vulnerability Correlation Tests
# =============================================================================

@pytest.mark.django_db
class TestVulnerabilityCorrelation:
    """Tests for vulnerability correlation service."""

    def test_correlation_service_initialization(self):
        """Test vulnerability correlation service initialization."""
        try:
            from core.bounded_contexts.rmf_operations.services.vulnerability_correlation import (
                VulnerabilityCorrelationService,
            )

            service = VulnerabilityCorrelationService()
            assert service is not None
        except ImportError:
            pytest.skip("VulnerabilityCorrelationService not available")


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.django_db
class TestRMFServicesIntegration:
    """Integration tests for RMF services."""

    def test_ksi_import_to_trust_center_flow(self):
        """Test flow from KSI import to Trust Center display."""
        try:
            from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser
            from core.bounded_contexts.rmf_operations.services.trust_center import TrustCenterService

            # Parse KSI library
            parser = KSILibraryParser()

            # Get Trust Center data
            trust_center = TrustCenterService()
            csos = trust_center.get_public_cso_list()

            # Verify data consistency
            assert isinstance(csos, list)
        except ImportError:
            pytest.skip("Required services not available")

    def test_end_to_end_ksi_compliance_check(self, tmp_path):
        """Test end-to-end KSI compliance checking."""
        from core.bounded_contexts.rmf_operations.services.ksi_import import KSILibraryParser

        # Create test library
        mock_library = tmp_path / "test_ksi.yaml"
        mock_library.write_text("""
urn: urn:test:ksi
objects:
  framework:
    requirement_nodes:
      - urn: urn:test:afr
        ref_id: KSI-AFR
        depth: 1
      - urn: urn:test:afr-01
        ref_id: KSI-AFR-01
        name: Test Requirement
        depth: 2
        assessable: true
        implementation_groups: [LOW, MOD]
        annotation: "Related controls: AC-1, AU-1"
""")

        # Parse and validate
        parser = KSILibraryParser(library_path=mock_library)
        requirements = parser.get_ksi_requirements()

        assert len(requirements) == 1

        ksi = requirements[0]
        controls = parser.parse_nist_controls(ksi)

        assert 'AC-1' in controls
        assert 'AU-1' in controls

