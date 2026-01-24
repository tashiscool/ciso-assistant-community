"""
Comprehensive tests for OSCAL Integration Services

Tests cover:
- SSP Generator: Document generation, baseline validation, preview
- FedRAMP Enhanced: Control origination, roles, SSP enhancement, validation
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import json
import uuid
from datetime import datetime

from oscal_integration.services.ssp_generator import SSPGenerator
from oscal_integration.services.fedramp_enhanced import (
    FedRAMPEnhancedService,
    ControlOrigination,
    FedRAMPImplementationStatus,
    FedRAMPBaseline,
    ControlOriginationInfo,
    ResponsibleRole,
    FedRAMPValidationResult,
)


# =============================================================================
# FedRAMP Enhanced - Enum Tests
# =============================================================================

class TestFedRAMPEnums:
    """Tests for FedRAMP enums."""

    def test_control_origination_values(self):
        """Test ControlOrigination enum values."""
        assert ControlOrigination.SP_CORPORATE.value == 'sp-corporate'
        assert ControlOrigination.SP_SYSTEM.value == 'sp-system'
        assert ControlOrigination.CUSTOMER_CONFIGURED.value == 'customer-configured'
        assert ControlOrigination.CUSTOMER_PROVIDED.value == 'customer-provided'
        assert ControlOrigination.INHERITED.value == 'inherited'
        assert ControlOrigination.SHARED.value == 'shared'
        assert ControlOrigination.HYBRID.value == 'hybrid'

    def test_implementation_status_values(self):
        """Test FedRAMPImplementationStatus enum values."""
        assert FedRAMPImplementationStatus.IMPLEMENTED.value == 'implemented'
        assert FedRAMPImplementationStatus.PARTIALLY_IMPLEMENTED.value == 'partially-implemented'
        assert FedRAMPImplementationStatus.PLANNED.value == 'planned'
        assert FedRAMPImplementationStatus.ALTERNATIVE_IMPLEMENTATION.value == 'alternative-implementation'
        assert FedRAMPImplementationStatus.NOT_APPLICABLE.value == 'not-applicable'

    def test_fedramp_baseline_values(self):
        """Test FedRAMPBaseline enum values."""
        assert FedRAMPBaseline.LOW.value == 'low'
        assert FedRAMPBaseline.MODERATE.value == 'moderate'
        assert FedRAMPBaseline.HIGH.value == 'high'
        assert FedRAMPBaseline.LI_SAAS.value == 'li-saas'


# =============================================================================
# FedRAMP Enhanced - Data Class Tests
# =============================================================================

class TestFedRAMPDataClasses:
    """Tests for FedRAMP data classes."""

    def test_control_origination_info(self):
        """Test ControlOriginationInfo dataclass."""
        info = ControlOriginationInfo(
            control_id='AC-2',
            originations=[ControlOrigination.SP_SYSTEM],
            description='Account Management',
            responsible_roles=['isso', 'system-admin'],
            implementation_status=FedRAMPImplementationStatus.IMPLEMENTED
        )

        assert info.control_id == 'AC-2'
        assert len(info.originations) == 1
        assert info.implementation_status == FedRAMPImplementationStatus.IMPLEMENTED

    def test_responsible_role(self):
        """Test ResponsibleRole dataclass."""
        role = ResponsibleRole(
            role_id='isso',
            title='Information System Security Officer',
            party_uuids=['party-1', 'party-2'],
            description='Manages security'
        )

        assert role.role_id == 'isso'
        assert len(role.party_uuids) == 2

    def test_validation_result(self):
        """Test FedRAMPValidationResult dataclass."""
        result = FedRAMPValidationResult(
            valid=True,
            baseline=FedRAMPBaseline.MODERATE,
            compliance_percentage=85.5,
            total_controls=325,
            implemented_controls=250,
            partially_implemented=30,
            planned_controls=20,
            not_applicable=25,
        )

        assert result.valid is True
        assert result.compliance_percentage == 85.5
        assert result.total_controls == 325


# =============================================================================
# FedRAMP Enhanced Service Tests
# =============================================================================

class TestFedRAMPEnhancedService:
    """Tests for FedRAMPEnhancedService."""

    @pytest.fixture
    def service(self):
        """Create FedRAMP enhanced service."""
        return FedRAMPEnhancedService()

    def test_service_initialization(self, service):
        """Test service initializes with default roles."""
        assert len(service.responsible_roles) > 0
        assert 'isso' in service.responsible_roles
        assert 'system-owner' in service.responsible_roles

    def test_baseline_controls_defined(self, service):
        """Test baseline controls are defined."""
        assert FedRAMPBaseline.LOW in service.BASELINE_CONTROLS
        assert FedRAMPBaseline.MODERATE in service.BASELINE_CONTROLS
        assert FedRAMPBaseline.HIGH in service.BASELINE_CONTROLS
        assert FedRAMPBaseline.LI_SAAS in service.BASELINE_CONTROLS

    def test_baseline_control_counts(self, service):
        """Test baseline control counts."""
        assert service.BASELINE_CONTROLS[FedRAMPBaseline.LOW]['total'] == 125
        assert service.BASELINE_CONTROLS[FedRAMPBaseline.MODERATE]['total'] == 325
        assert service.BASELINE_CONTROLS[FedRAMPBaseline.HIGH]['total'] == 421
        assert service.BASELINE_CONTROLS[FedRAMPBaseline.LI_SAAS]['total'] == 36

    # Control Origination Tests

    def test_set_control_origination(self, service):
        """Test setting control origination."""
        info = service.set_control_origination(
            control_id='AC-2',
            originations=[ControlOrigination.SP_SYSTEM],
            description='Account Management',
            responsible_roles=['isso'],
            implementation_status=FedRAMPImplementationStatus.IMPLEMENTED
        )

        assert info.control_id == 'AC-2'
        assert 'AC-2' in service.control_originations

    def test_set_control_origination_uppercase(self, service):
        """Test control ID is normalized to uppercase."""
        service.set_control_origination(
            control_id='ac-2',
            originations=[ControlOrigination.SP_SYSTEM]
        )

        assert 'AC-2' in service.control_originations

    def test_get_control_origination(self, service):
        """Test getting control origination."""
        service.set_control_origination(
            control_id='AC-3',
            originations=[ControlOrigination.SHARED]
        )

        info = service.get_control_origination('AC-3')
        assert info is not None
        assert ControlOrigination.SHARED in info.originations

    def test_get_control_origination_not_found(self, service):
        """Test getting non-existent control origination."""
        info = service.get_control_origination('XX-99')
        assert info is None

    def test_bulk_set_origination(self, service):
        """Test bulk setting origination."""
        controls = ['AC-1', 'AC-2', 'AC-3']
        count = service.bulk_set_origination(
            control_ids=controls,
            origination=ControlOrigination.SP_CORPORATE,
            implementation_status=FedRAMPImplementationStatus.IMPLEMENTED
        )

        assert count == 3
        for ctrl in controls:
            info = service.get_control_origination(ctrl)
            assert info is not None
            assert ControlOrigination.SP_CORPORATE in info.originations

    def test_get_controls_by_origination(self, service):
        """Test getting controls by origination type."""
        service.set_control_origination('AC-1', [ControlOrigination.SP_CORPORATE])
        service.set_control_origination('AC-2', [ControlOrigination.SP_SYSTEM])
        service.set_control_origination('AC-3', [ControlOrigination.SP_CORPORATE])

        corporate_controls = service.get_controls_by_origination(ControlOrigination.SP_CORPORATE)

        assert 'AC-1' in corporate_controls
        assert 'AC-3' in corporate_controls
        assert 'AC-2' not in corporate_controls

    # Responsible Roles Tests

    def test_add_responsible_role(self, service):
        """Test adding a new responsible role."""
        role = service.add_responsible_role(
            role_id='custom-role',
            title='Custom Role',
            description='A custom role',
            party_uuids=['party-1']
        )

        assert role.role_id == 'custom-role'
        assert 'custom-role' in service.responsible_roles

    def test_assign_role_to_control(self, service):
        """Test assigning role to control."""
        service.set_control_origination('AC-2', [ControlOrigination.SHARED])
        result = service.assign_role_to_control('AC-2', ['isso', 'system-admin'])

        assert result is True
        info = service.get_control_origination('AC-2')
        assert 'isso' in info.responsible_roles

    def test_assign_role_creates_origination(self, service):
        """Test assigning role creates origination if not exists."""
        result = service.assign_role_to_control('NEW-1', ['isso'])

        assert result is True
        info = service.get_control_origination('NEW-1')
        assert info is not None

    def test_get_roles_for_control(self, service):
        """Test getting roles for a control."""
        service.set_control_origination(
            'AC-2',
            [ControlOrigination.SHARED],
            responsible_roles=['isso', 'system-admin']
        )

        roles = service.get_roles_for_control('AC-2')

        assert len(roles) == 2
        role_ids = [r.role_id for r in roles]
        assert 'isso' in role_ids

    def test_get_controls_by_role(self, service):
        """Test getting controls by role."""
        service.set_control_origination('AC-2', [ControlOrigination.SHARED], responsible_roles=['isso'])
        service.set_control_origination('AU-2', [ControlOrigination.SP_SYSTEM], responsible_roles=['isso'])
        service.set_control_origination('SC-7', [ControlOrigination.SP_SYSTEM], responsible_roles=['network-admin'])

        isso_controls = service.get_controls_by_role('isso')

        assert 'AC-2' in isso_controls
        assert 'AU-2' in isso_controls
        assert 'SC-7' not in isso_controls

    # SSP Enhancement Tests

    def test_enhance_ssp_with_fedramp(self, service):
        """Test enhancing SSP with FedRAMP information."""
        # Setup originations
        service.set_control_origination(
            'AC-2',
            [ControlOrigination.SHARED],
            responsible_roles=['isso'],
            implementation_status=FedRAMPImplementationStatus.IMPLEMENTED
        )

        ssp = {
            'system-security-plan': {
                'uuid': str(uuid.uuid4()),
                'metadata': {'title': 'Test SSP'},
                'control-implementation': {
                    'implemented-requirements': [
                        {'control-id': 'ac-2'}
                    ]
                }
            }
        }

        result = service.enhance_ssp_with_fedramp(
            json.dumps(ssp),
            FedRAMPBaseline.MODERATE
        )

        # Check FedRAMP props added
        ssp_obj = result['system-security-plan']
        props = ssp_obj.get('props', [])
        prop_names = [p['name'] for p in props]
        assert 'fedramp-baseline' in prop_names

    def test_extract_fedramp_info_from_ssp(self, service):
        """Test extracting FedRAMP info from SSP."""
        ssp = {
            'system-security-plan': {
                'uuid': str(uuid.uuid4()),
                'metadata': {
                    'title': 'Test SSP',
                    'roles': [{'id': 'isso', 'title': 'ISSO'}]
                },
                'props': [
                    {'name': 'fedramp-baseline', 'value': 'moderate'},
                    {'name': 'authorization-type', 'value': 'fedramp-agency'}
                ],
                'control-implementation': {
                    'implemented-requirements': [
                        {
                            'control-id': 'AC-2',
                            'props': [
                                {'name': 'control-origination', 'value': 'shared'},
                                {'name': 'implementation-status', 'value': 'implemented'}
                            ],
                            'responsible-roles': [{'role-id': 'isso'}]
                        }
                    ]
                }
            }
        }

        result = service.extract_fedramp_info_from_ssp(json.dumps(ssp))

        assert result['baseline'] == 'moderate'
        assert 'AC-2' in result['control_originations']
        assert result['implementation_summary']['implemented'] == 1

    # Validation Tests

    def test_validate_fedramp_ssp_valid(self, service):
        """Test validating a valid SSP."""
        ssp = {
            'system-security-plan': {
                'uuid': str(uuid.uuid4()),
                'metadata': {
                    'title': 'Test SSP',
                    'roles': [{'id': 'isso', 'title': 'ISSO'}]
                },
                'system-characteristics': {
                    'authorization-boundary': {'description': 'Test boundary'}
                },
                'control-implementation': {
                    'implemented-requirements': [
                        {
                            'control-id': 'AC-2',
                            'props': [
                                {'name': 'control-origination', 'value': 'sp-system'},
                                {'name': 'implementation-status', 'value': 'implemented'}
                            ],
                            'responsible-roles': [{'role-id': 'isso'}]
                        }
                    ]
                }
            }
        }

        result = service.validate_fedramp_ssp(json.dumps(ssp), FedRAMPBaseline.MODERATE)

        assert result.valid is True

    def test_validate_fedramp_ssp_missing_roles(self, service):
        """Test validation catches missing roles."""
        ssp = {
            'system-security-plan': {
                'uuid': str(uuid.uuid4()),
                'metadata': {'title': 'Test SSP'},
                'control-implementation': {
                    'implemented-requirements': []
                }
            }
        }

        result = service.validate_fedramp_ssp(json.dumps(ssp), FedRAMPBaseline.MODERATE)

        assert 'No roles defined' in result.errors[0]

    def test_validate_fedramp_ssp_invalid_json(self, service):
        """Test validation handles invalid JSON."""
        result = service.validate_fedramp_ssp('{invalid json}', FedRAMPBaseline.MODERATE)

        assert result.valid is False
        assert any('Invalid JSON' in e for e in result.errors)

    # LI-SaaS Tests

    def test_get_li_saas_controls(self, service):
        """Test getting LI-SaaS controls."""
        controls = service.get_li_saas_controls()

        assert len(controls) > 0
        # Check for expected controls
        control_ids = [c['id'] for c in controls]
        assert 'AC-1' in control_ids
        assert 'IA-2' in control_ids

    def test_initialize_li_saas_originations(self, service):
        """Test initializing LI-SaaS originations."""
        count = service.initialize_li_saas_originations()

        assert count > 0
        # Verify some controls were set
        info = service.get_control_origination('AC-1')
        assert info is not None

    # Reporting Tests

    def test_generate_control_matrix(self, service):
        """Test generating control matrix."""
        service.set_control_origination(
            'AC-2',
            [ControlOrigination.SHARED],
            responsible_roles=['isso'],
            implementation_status=FedRAMPImplementationStatus.IMPLEMENTED
        )

        matrix = service.generate_control_matrix(FedRAMPBaseline.MODERATE)

        assert matrix['baseline'] == 'moderate'
        assert len(matrix['controls']) > 0
        assert matrix['summary']['total'] > 0

    def test_generate_role_responsibility_report(self, service):
        """Test generating role responsibility report."""
        service.set_control_origination('AC-2', [ControlOrigination.SHARED], responsible_roles=['isso'])
        service.set_control_origination('AU-2', [ControlOrigination.SP_SYSTEM], responsible_roles=['isso'])

        report = service.generate_role_responsibility_report()

        assert 'roles' in report
        isso_role = next((r for r in report['roles'] if r['role_id'] == 'isso'), None)
        assert isso_role is not None
        assert isso_role['control_count'] == 2


# =============================================================================
# SSP Generator Tests
# =============================================================================

class TestSSPGenerator:
    """Tests for SSPGenerator service."""

    @pytest.fixture
    def generator(self):
        """Create SSP generator."""
        return SSPGenerator()

    def test_supported_baselines(self, generator):
        """Test supported baselines."""
        assert 'low' in generator.SUPPORTED_BASELINES
        assert 'moderate' in generator.SUPPORTED_BASELINES
        assert 'high' in generator.SUPPORTED_BASELINES
        assert 'li-saas' in generator.SUPPORTED_BASELINES

    def test_get_supported_baselines(self, generator):
        """Test getting supported baselines."""
        baselines = generator.get_supported_baselines()
        assert len(baselines) == 4
        assert baselines is not generator.baselines  # Should be a copy

    def test_get_baseline_info_low(self, generator):
        """Test getting baseline info for low."""
        info = generator.get_baseline_info('low')

        assert info['name'] == 'FedRAMP Low Baseline'
        assert info['impact_level'] == 'Low'

    def test_get_baseline_info_moderate(self, generator):
        """Test getting baseline info for moderate."""
        info = generator.get_baseline_info('moderate')

        assert info['name'] == 'FedRAMP Moderate Baseline'
        assert 'Artifact References' in info['document_sections']

    def test_get_baseline_info_unknown(self, generator):
        """Test getting baseline info for unknown baseline."""
        info = generator.get_baseline_info('unknown')

        assert 'Unknown Baseline' in info['name']

    def test_generate_appendix_a_invalid_baseline(self, generator):
        """Test generation with invalid baseline."""
        with pytest.raises(ValueError) as exc_info:
            generator.generate_appendix_a('test-id', 'invalid_baseline')

        assert 'Unsupported baseline' in str(exc_info.value)

    @patch.object(SSPGenerator, '_run_ssp_transform')
    @patch('oscal_integration.services.ssp_generator.OSCALExporter')
    def test_generate_appendix_a_transform_failure(
        self, mock_exporter_class, mock_transform, generator
    ):
        """Test generation when transform fails."""
        mock_exporter = Mock()
        mock_exporter.export_compliance_assessment.return_value = '{"system-security-plan": {}}'
        mock_exporter_class.return_value = mock_exporter

        mock_transform.return_value = {
            'success': False,
            'error': 'Transform command not found'
        }

        # Re-initialize generator with mocked exporter
        generator.exporter = mock_exporter

        with pytest.raises(Exception) as exc_info:
            generator.generate_appendix_a('test-id', 'moderate')

        assert 'SSP generation failed' in str(exc_info.value)

    def test_run_ssp_transform_file_not_found(self, generator):
        """Test transform when command not found."""
        result = generator._run_ssp_transform(
            '/fake/path.json',
            'moderate',
            '/fake/output.docx'
        )

        # Should handle gracefully
        assert result['success'] is False

    @patch('oscal_integration.services.fedramp_validator.FedRAMPValidator')
    def test_validate_ssp_for_baseline(self, mock_validator_class, generator):
        """Test SSP validation for baseline."""
        mock_exporter = Mock()
        mock_exporter.export_compliance_assessment.return_value = '{"system-security-plan": {}}'
        generator.exporter = mock_exporter

        mock_validator = Mock()
        mock_validator.validate_ssp.return_value = {
            'validation_passed': True,
            'total_assertions': 100,
            'passed_assertions': 95,
            'errors': [],
            'warnings': []
        }
        mock_validator_class.return_value = mock_validator

        result = generator.validate_ssp_for_baseline('test-id', 'moderate')

        assert result['assessment_id'] == 'test-id'
        assert result['baseline'] == 'moderate'
        assert result['validation_passed'] is True

    def test_calculate_compliance_percentage_zero(self, generator):
        """Test compliance percentage with zero assertions."""
        result = generator._calculate_compliance_percentage({'total_assertions': 0})
        assert result == 0.0

    def test_calculate_compliance_percentage(self, generator):
        """Test compliance percentage calculation."""
        result = generator._calculate_compliance_percentage({
            'total_assertions': 100,
            'passed_assertions': 85
        })
        assert result == 85.0

    def test_generate_recommendations_low_compliance(self, generator):
        """Test recommendations for low compliance."""
        recommendations = generator._generate_generation_recommendations({
            'validation_passed': False,
            'total_assertions': 100,
            'passed_assertions': 50,
            'errors': ['Critical error']
        })

        assert any('Low compliance' in r for r in recommendations)
        assert any('validation failures' in r for r in recommendations)

    def test_generate_recommendations_ready(self, generator):
        """Test recommendations when ready."""
        recommendations = generator._generate_generation_recommendations({
            'validation_passed': True,
            'total_assertions': 100,
            'passed_assertions': 100
        })

        assert any('ready for FedRAMP' in r for r in recommendations)

    @patch('oscal_integration.services.ssp_generator.OSCALExporter')
    def test_preview_ssp_content(self, mock_exporter_class, generator):
        """Test SSP content preview."""
        ssp_json = json.dumps({
            'system-security-plan': {
                'system-characteristics': {
                    'system-name': 'Test System'
                },
                'control-implementation': {
                    'implemented-requirements': [
                        {'control-id': 'AC-2', 'statements': [{}]},
                        {'control-id': 'AU-2', 'statements': [{}]},
                    ]
                }
            }
        })

        mock_exporter = Mock()
        mock_exporter.export_compliance_assessment.return_value = ssp_json
        generator.exporter = mock_exporter

        preview = generator.preview_ssp_content('test-id', 'moderate')

        assert preview['system_name'] == 'Test System'
        assert preview['total_controls'] == 2

    def test_extract_control_families(self, generator):
        """Test extracting control families."""
        impl_reqs = [
            {'control-id': 'AC-1'},
            {'control-id': 'AC-2'},
            {'control-id': 'AU-1'},
            {'control-id': 'SC-7'},
        ]

        families = generator._extract_control_families(impl_reqs)

        assert 'AC' in families
        assert 'AU' in families
        assert 'SC' in families

    def test_estimate_document_length(self, generator):
        """Test document length estimation."""
        short = generator._estimate_document_length([{} for _ in range(30)])
        assert 'Short' in short

        medium = generator._estimate_document_length([{} for _ in range(100)])
        assert 'Medium' in medium

        long_doc = generator._estimate_document_length([{} for _ in range(200)])
        assert 'Long' in long_doc

    def test_list_generated_documents(self, generator):
        """Test listing generated documents."""
        docs = generator.list_generated_documents('test-id')
        assert isinstance(docs, list)

    def test_cleanup_generated_documents(self, generator):
        """Test cleanup returns zero (placeholder)."""
        count = generator.cleanup_generated_documents()
        assert count == 0

    def test_get_import_statistics(self, generator):
        """Test getting import statistics."""
        stats = generator.get_import_statistics()

        assert 'capabilities' in stats
        assert '.docx' in stats['supported_extensions']

    def test_convert_imported_ssp_invalid(self, generator):
        """Test converting invalid import result."""
        result = generator.convert_imported_ssp_to_assessment({
            'success': False
        })

        assert result['success'] is False

    def test_convert_imported_ssp_valid(self, generator):
        """Test converting valid import result."""
        import_result = {
            'success': True,
            'ciso_entities': {
                'compliance_assessment': {
                    'name': 'Test System',
                    'framework': {'name': 'NIST 800-53'},
                    'controls': []
                },
                'assets': [],
                'findings': []
            },
            'import_metadata': {
                'import_timestamp': '2024-01-01T00:00:00'
            },
            'oscal_ssp': {
                'oscal-version': '1.1.2'
            },
            'validation': {
                'warnings': ['Test warning']
            }
        }

        result = generator.convert_imported_ssp_to_assessment(import_result)

        assert result['success'] is True
        assert 'Imported SSP' in result['assessment_data']['name']
