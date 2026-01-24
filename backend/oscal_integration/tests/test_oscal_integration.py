"""
Comprehensive tests for OSCAL Integration Services

Tests cover:
- OSCAL Exporter: SSP, Catalog, Assessment Plan, Assessment Results, POA&M export
- OSCAL Importer: Format detection, SSP import, Catalog import, POA&M import
- FedRAMP Validator: Baseline validation, compliance reporting
"""

import pytest
import json
import uuid
from unittest.mock import Mock, patch

from oscal_integration.services.oscal_exporter import OSCALExporter
from oscal_integration.services.oscal_importer import OSCALImporter
from oscal_integration.services.fedramp_validator import FedRAMPValidator


# =============================================================================
# OSCAL Exporter Tests
# =============================================================================

class TestOSCALExporter:
    """Tests for OSCAL export functionality."""

    def test_exporter_initialization(self):
        """Test OSCAL exporter initializes with correct version."""
        exporter = OSCALExporter()
        assert exporter.oscal_version == "1.1.2"

    def test_export_compliance_assessment_returns_valid_json(self):
        """Test exporting compliance assessment produces valid JSON."""
        exporter = OSCALExporter()
        assessment_id = uuid.uuid4()

        result = exporter.export_compliance_assessment(assessment_id)

        data = json.loads(result)
        assert 'oscal-version' in data
        assert 'system-security-plan' in data
        assert data['oscal-version'] == '1.1.2'

    def test_export_compliance_assessment_has_required_sections(self):
        """Test SSP export contains all required OSCAL sections."""
        exporter = OSCALExporter()
        assessment_id = uuid.uuid4()

        result = exporter.export_compliance_assessment(assessment_id)
        data = json.loads(result)

        ssp = data['system-security-plan']
        assert 'uuid' in ssp
        assert 'metadata' in ssp
        assert 'import-profile' in ssp
        assert 'system-characteristics' in ssp
        assert 'system-implementation' in ssp
        assert 'control-implementation' in ssp

    def test_export_framework_as_catalog(self):
        """Test exporting framework as OSCAL catalog."""
        exporter = OSCALExporter()
        framework_id = uuid.uuid4()

        result = exporter.export_framework_as_catalog(framework_id)
        data = json.loads(result)

        assert 'oscal-version' in data
        assert 'catalog' in data
        assert 'uuid' in data['catalog']

    def test_export_assessment_plan(self):
        """Test exporting assessment plan."""
        exporter = OSCALExporter()
        assessment_id = uuid.uuid4()

        result = exporter.export_assessment_plan(assessment_id)
        data = json.loads(result)

        assert 'oscal-version' in data
        assert 'assessment-plan' in data

    def test_export_assessment_results(self):
        """Test exporting assessment results."""
        exporter = OSCALExporter()
        assessment_id = uuid.uuid4()

        result = exporter.export_assessment_results(assessment_id)
        data = json.loads(result)

        assert 'oscal-version' in data
        assert 'assessment-results' in data

    def test_export_poam(self):
        """Test exporting Plan of Action and Milestones."""
        exporter = OSCALExporter()
        assessment_id = uuid.uuid4()

        result = exporter.export_poam(assessment_id)
        data = json.loads(result)

        assert 'oscal-version' in data
        assert 'plan-of-action-and-milestones' in data

    def test_validate_export_valid_ssp(self):
        """Test validation of valid SSP export."""
        exporter = OSCALExporter()
        assessment_id = uuid.uuid4()

        oscal_json = exporter.export_compliance_assessment(assessment_id)
        result = exporter.validate_export(oscal_json)

        assert result['valid'] is True
        assert result['format_detected'] == 'system-security-plan'

    def test_validate_export_invalid_json(self):
        """Test validation rejects invalid JSON."""
        exporter = OSCALExporter()

        result = exporter.validate_export("{invalid json}")

        assert result['valid'] is False
        assert 'Invalid JSON' in result['errors'][0]


# =============================================================================
# OSCAL Importer Tests
# =============================================================================

class TestOSCALImporter:
    """Tests for OSCAL import functionality."""

    def test_importer_initialization(self):
        """Test OSCAL importer initializes with supported formats."""
        importer = OSCALImporter()

        assert 'system-security-plan' in importer.supported_formats
        assert 'catalog' in importer.supported_formats
        assert 'plan-of-action-and-milestones' in importer.supported_formats

    def test_detect_format_ssp(self):
        """Test format detection for SSP."""
        importer = OSCALImporter()
        content = json.dumps({
            'oscal-version': '1.1.2',
            'system-security-plan': {'uuid': 'test'}
        })

        result = importer.detect_format(content)
        assert result == 'system-security-plan'

    def test_detect_format_catalog(self):
        """Test format detection for catalog."""
        importer = OSCALImporter()
        content = json.dumps({
            'oscal-version': '1.1.2',
            'catalog': {'uuid': 'test'}
        })

        result = importer.detect_format(content)
        assert result == 'catalog'

    def test_detect_format_poam(self):
        """Test format detection for POA&M."""
        importer = OSCALImporter()
        content = json.dumps({
            'oscal-version': '1.1.2',
            'plan-of-action-and-milestones': {'uuid': 'test'}
        })

        result = importer.detect_format(content)
        assert result == 'plan-of-action-and-milestones'

    def test_detect_format_invalid_json(self):
        """Test format detection returns None for invalid JSON."""
        importer = OSCALImporter()

        result = importer.detect_format("{invalid json}")
        assert result is None

    def test_validate_oscal_content_valid_ssp(self):
        """Test validation of valid SSP content."""
        importer = OSCALImporter()
        content = json.dumps({
            'oscal-version': '1.1.2',
            'metadata': {'title': 'Test SSP'},
            'system-security-plan': {
                'uuid': 'test',
                'system-characteristics': {'system-name': 'Test'}
            }
        })

        result = importer.validate_oscal_content(content)

        assert result['valid'] is True
        assert result['format_detected'] == 'system-security-plan'


# =============================================================================
# FedRAMP Validator Tests
# =============================================================================

class TestFedRAMPValidator:
    """Tests for FedRAMP validation functionality."""

    def test_validator_initialization(self):
        """Test FedRAMP validator initializes with supported baselines."""
        validator = FedRAMPValidator()

        assert 'low' in validator.baselines
        assert 'moderate' in validator.baselines
        assert 'high' in validator.baselines
        assert 'li-saas' in validator.baselines

    def test_list_available_baselines(self):
        """Test listing available baselines."""
        validator = FedRAMPValidator()

        baselines = validator.list_available_baselines()

        assert len(baselines) == 4
        assert 'low' in baselines
        assert 'moderate' in baselines
        assert 'high' in baselines

    def test_get_baseline_requirements_low(self):
        """Test getting requirements for Low baseline."""
        validator = FedRAMPValidator()

        requirements = validator.get_baseline_requirements('low')

        assert requirements['name'] == 'FedRAMP Low Baseline'
        assert requirements['impact_level'] == 'Low'
        assert requirements['total_controls'] == 125

    def test_get_baseline_requirements_moderate(self):
        """Test getting requirements for Moderate baseline."""
        validator = FedRAMPValidator()

        requirements = validator.get_baseline_requirements('moderate')

        assert requirements['name'] == 'FedRAMP Moderate Baseline'
        assert requirements['total_controls'] == 325

    def test_get_baseline_requirements_high(self):
        """Test getting requirements for High baseline."""
        validator = FedRAMPValidator()

        requirements = validator.get_baseline_requirements('high')

        assert requirements['name'] == 'FedRAMP High Baseline'
        assert requirements['total_controls'] == 421

    def test_validate_ssp_unsupported_baseline(self):
        """Test validation rejects unsupported baseline."""
        validator = FedRAMPValidator()

        with pytest.raises(ValueError) as exc_info:
            validator.validate_ssp('{}', baseline='invalid')

        assert 'Unsupported baseline' in str(exc_info.value)

    def test_generate_compliance_summary_full_compliance(self):
        """Test compliance summary for fully compliant system."""
        validator = FedRAMPValidator()
        validation_result = {
            'total_assertions': 100,
            'passed_assertions': 100,
            'failed_assertions': [],
        }

        summary = validator._generate_compliance_summary(validation_result)

        assert summary['overall_compliance_percentage'] == 100.0
        assert summary['compliance_level'] == 'compliant'

    def test_generate_compliance_summary_partial_compliance(self):
        """Test compliance summary for partially compliant system."""
        validator = FedRAMPValidator()
        validation_result = {
            'total_assertions': 100,
            'passed_assertions': 85,
            'failed_assertions': [{'text': 'Missing control'}] * 15,
        }

        summary = validator._generate_compliance_summary(validation_result)

        assert summary['overall_compliance_percentage'] == 85.0
        assert summary['compliance_level'] == 'conditionally-compliant'

    def test_determine_compliance_level_compliant(self):
        """Test compliance level determination for compliant."""
        validator = FedRAMPValidator()

        level = validator._determine_compliance_level(95.0, 0)
        assert level == 'compliant'

    def test_determine_compliance_level_non_compliant(self):
        """Test compliance level determination for non-compliant."""
        validator = FedRAMPValidator()

        level = validator._determine_compliance_level(70.0, 0)
        assert level == 'non-compliant'


# =============================================================================
# Integration Tests
# =============================================================================

class TestOSCALRoundTrip:
    """Tests for OSCAL export/import round-trip."""

    def test_ssp_export_import_roundtrip(self):
        """Test exporting and re-importing SSP maintains data integrity."""
        exporter = OSCALExporter()
        importer = OSCALImporter()

        assessment_id = uuid.uuid4()
        exported_json = exporter.export_compliance_assessment(assessment_id)

        format_type = importer.detect_format(exported_json)
        assert format_type == 'system-security-plan'

        validation = importer.validate_oscal_content(exported_json)
        assert validation['valid'] is True

    def test_catalog_export_import_roundtrip(self):
        """Test exporting and re-importing catalog."""
        exporter = OSCALExporter()
        importer = OSCALImporter()

        framework_id = uuid.uuid4()
        exported_json = exporter.export_framework_as_catalog(framework_id)

        format_type = importer.detect_format(exported_json)
        assert format_type == 'catalog'
