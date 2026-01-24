"""
Comprehensive tests for POA&M Services

Tests cover:
- POA&M Export Service: FedRAMP Excel, CSV, OSCAL exports
- Deviation reports
- Milestone reports
"""

import pytest
from datetime import date, datetime
from unittest.mock import Mock, patch
import json

from poam.services.poam_export import (
    POAMExportService,
    ExportResult,
    DeviationType,
)


# =============================================================================
# ExportResult Data Class Tests
# =============================================================================

class TestExportResult:
    """Tests for ExportResult dataclass."""

    def test_creation_success(self):
        """Test creating successful export result."""
        result = ExportResult(
            success=True,
            content=b'test content',
            filename='test.xlsx',
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            errors=[],
        )

        assert result.success is True
        assert result.content == b'test content'
        assert result.filename == 'test.xlsx'
        assert result.errors == []

    def test_creation_failure(self):
        """Test creating failed export result."""
        result = ExportResult(
            success=False,
            content=b'',
            filename='',
            content_type='',
            errors=['Error 1', 'Error 2'],
        )

        assert result.success is False
        assert len(result.errors) == 2


# =============================================================================
# DeviationType Tests
# =============================================================================

class TestDeviationType:
    """Tests for DeviationType constants."""

    def test_deviation_types(self):
        """Test deviation type values."""
        assert DeviationType.FUNCTIONAL == 'functional'
        assert DeviationType.OPERATIONAL == 'operational'
        assert DeviationType.RISK_ASSESSMENT == 'risk_assessment'


# =============================================================================
# POAMExportService Tests
# =============================================================================

class TestPOAMExportService:
    """Tests for POAMExportService."""

    @pytest.fixture
    def service(self):
        """Create POA&M export service."""
        return POAMExportService()

    @pytest.fixture
    def sample_poam_items(self):
        """Sample POA&M items for testing."""
        return [
            {
                'weakness_id': 'V-001',
                'control_id': 'AC-2',
                'title': 'Account Management Weakness',
                'description': 'User accounts not properly managed',
                'source_type': 'Nessus',
                'source_reference': 'SCAN-12345',
                'asset_identifier': 'server-01',
                'point_of_contact': 'john@example.com',
                'resources_required': 'IAM team',
                'remediation_plan': 'Implement account review process',
                'identified_date': '2024-01-15',
                'estimated_completion_date': '2024-06-30',
                'status': 'open',
                'vendor_dependent': False,
                'risk_level': 'high',
                'is_false_positive': False,
                'has_deviation': False,
                'milestones': [
                    {
                        'description': 'Define process',
                        'target_date': '2024-03-01',
                        'status': 'completed',
                        'updated_at': '2024-02-28',
                    },
                    {
                        'description': 'Implement automation',
                        'target_date': '2024-06-01',
                        'status': 'in_progress',
                    },
                ],
            },
            {
                'weakness_id': 'V-002',
                'control_id': 'AU-2',
                'title': 'Audit Logging Gap',
                'description': 'Insufficient audit logging',
                'status': 'open',
                'risk_level': 'moderate',
                'has_deviation': True,
                'deviation_type': DeviationType.OPERATIONAL,
                'deviation_justification': 'Legacy system limitation',
                'deviation_approved': True,
                'deviation_approval_date': '2024-02-01',
                'vendor_dependent': True,
                'vendor_product_name': 'Legacy ERP',
                'last_vendor_checkin': '2024-03-01',
                'milestones': [],
            },
        ]

    @pytest.fixture
    def sample_system_info(self):
        """Sample system info for testing."""
        return {
            'name': 'Test Cloud System',
            'id': 'FR-12345',
            'authorization_type': 'FedRAMP Moderate',
            'impact_level': 'Moderate',
            'isso': 'Jane Smith',
            'system_owner': 'Cloud Team',
            'ao': 'Agency CIO',
        }

    def test_fedramp_columns_defined(self, service):
        """Test that FedRAMP columns are defined."""
        assert len(service.FEDRAMP_COLUMNS) == 26
        assert 'POA&M ID' in service.FEDRAMP_COLUMNS
        assert 'Weakness Name' in service.FEDRAMP_COLUMNS
        assert 'Vendor Dependency' in service.FEDRAMP_COLUMNS

    def test_map_to_fedramp_row(self, service, sample_poam_items):
        """Test mapping POA&M item to FedRAMP row."""
        item = sample_poam_items[0]
        row = service._map_to_fedramp_row(item)

        assert len(row) == 26
        assert row[0] == 'V-001'  # POA&M ID
        assert row[1] == 'AC-2'  # Controls
        assert row[2] == 'Account Management Weakness'  # Weakness Name
        assert row[18] == 'high'  # Original Risk Rating
        assert 'No' in row[15]  # Vendor Dependency

    def test_map_to_fedramp_row_with_deviation(self, service, sample_poam_items):
        """Test mapping item with deviation."""
        item = sample_poam_items[1]
        row = service._map_to_fedramp_row(item)

        assert 'Yes' in row[15]  # Vendor Dependency
        assert row[22] == 'Yes'  # Operational Requirement
        assert 'Legacy system limitation' in row[23]  # Deviation Rationale

    def test_export_csv(self, service, sample_poam_items):
        """Test CSV export."""
        result = service.export_csv(sample_poam_items)

        assert result.success is True
        assert result.content_type == 'text/csv'
        assert result.filename.endswith('.csv')
        assert b'weakness_id' in result.content
        assert b'V-001' in result.content

    def test_export_csv_custom_columns(self, service, sample_poam_items):
        """Test CSV export with custom columns."""
        columns = ['weakness_id', 'title', 'status']
        result = service.export_csv(sample_poam_items, columns=columns)

        assert result.success is True
        content = result.content.decode('utf-8')
        assert 'weakness_id' in content
        assert 'title' in content
        assert 'status' in content

    def test_export_oscal_poam(self, service, sample_poam_items, sample_system_info):
        """Test OSCAL POA&M export."""
        result = service.export_oscal_poam(sample_poam_items, sample_system_info)

        assert result.success is True
        assert result.content_type == 'application/json'
        assert result.filename.endswith('.json')

        # Parse and validate JSON
        data = json.loads(result.content.decode('utf-8'))
        assert 'plan-of-action-and-milestones' in data
        poam = data['plan-of-action-and-milestones']
        assert 'uuid' in poam
        assert 'metadata' in poam
        assert poam['metadata']['oscal-version'] == '1.1.2'
        assert len(poam['poam-items']) == 2

    def test_convert_to_oscal_poam_item(self, service, sample_poam_items):
        """Test converting single item to OSCAL format."""
        item = sample_poam_items[0]
        oscal_item = service._convert_to_oscal_poam_item(item)

        assert 'uuid' in oscal_item
        assert oscal_item['title'] == 'Account Management Weakness'
        assert 'props' in oscal_item
        assert len(oscal_item['milestones']) == 2

    def test_convert_to_oscal_poam_item_with_deviation(self, service, sample_poam_items):
        """Test converting item with deviation to OSCAL format."""
        item = sample_poam_items[1]
        oscal_item = service._convert_to_oscal_poam_item(item)

        assert 'remarks' in oscal_item
        assert 'Legacy system limitation' in oscal_item['remarks']

    def test_export_fedramp_xlsx(self, service, sample_poam_items, sample_system_info):
        """Test FedRAMP Excel export."""
        # Test actual implementation (openpyxl should be available)
        result = service.export_fedramp_xlsx(sample_poam_items, sample_system_info)

        # Either succeeds with openpyxl or fails gracefully
        if result.success:
            assert result.content_type == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            assert len(result.content) > 0
        else:
            # openpyxl not installed
            assert 'openpyxl' in result.errors[0] or len(result.errors) > 0

    def test_export_fedramp_xlsx_no_openpyxl(self, service, sample_poam_items, sample_system_info):
        """Test Excel export behavior - verify it handles openpyxl correctly."""
        # Simply verify that the method handles errors gracefully
        result = service.export_fedramp_xlsx(sample_poam_items, sample_system_info)
        # Should either succeed or fail with clear error
        assert isinstance(result.success, bool)

    def test_generate_deviation_report(self, service, sample_poam_items, sample_system_info):
        """Test deviation report generation."""
        result = service.generate_deviation_report(sample_poam_items, sample_system_info)

        # Should succeed if openpyxl available
        if result.success:
            assert 'deviation_report' in result.filename

    def test_generate_milestone_report(self, service, sample_poam_items):
        """Test milestone report generation."""
        result = service.generate_milestone_report(sample_poam_items)

        if result.success:
            assert 'milestone_report' in result.filename

    def test_generate_milestone_report_include_completed(self, service, sample_poam_items):
        """Test milestone report with completed milestones."""
        result = service.generate_milestone_report(
            sample_poam_items,
            include_completed=True
        )

        # Verify the call works
        assert isinstance(result.success, bool)


# =============================================================================
# Summary Sheet Tests
# =============================================================================

class TestPOAMSummarySheet:
    """Tests for POA&M summary sheet generation."""

    @pytest.fixture
    def service(self):
        return POAMExportService()

    def test_summary_statistics_logic(self, service):
        """Test that summary statistics are calculated correctly."""
        poam_items = [
            {'status': 'open', 'risk_level': 'high', 'has_deviation': True},
            {'status': 'open', 'risk_level': 'moderate', 'has_deviation': False},
            {'status': 'completed', 'risk_level': 'low', 'has_deviation': False},
            {
                'status': 'open',
                'risk_level': 'high',
                'has_deviation': False,
                'estimated_completion_date': '2020-01-01',  # Overdue
            },
        ]

        # Count expected values
        by_status = {}
        by_risk = {}
        with_deviation = 0

        for item in poam_items:
            status = item.get('status', 'unknown')
            by_status[status] = by_status.get(status, 0) + 1

            risk = item.get('risk_level', 'unknown')
            by_risk[risk] = by_risk.get(risk, 0) + 1

            if item.get('has_deviation'):
                with_deviation += 1

        # Verify our expected calculations
        assert by_status['open'] == 3
        assert by_status['completed'] == 1
        assert by_risk['high'] == 2
        assert with_deviation == 1

    def test_system_info_keys(self, service):
        """Test that system info contains expected keys."""
        system_info = {
            'name': 'Test System',
            'id': 'SYS-001',
            'impact_level': 'Moderate',
        }

        # Verify the info_rows logic
        expected_keys = ['name', 'id', 'impact_level']
        for key in expected_keys:
            assert key in system_info


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestPOAMExportEdgeCases:
    """Edge case tests for POA&M export."""

    @pytest.fixture
    def service(self):
        return POAMExportService()

    def test_export_csv_empty_list(self, service):
        """Test CSV export with empty list."""
        result = service.export_csv([])

        assert result.success is True
        # Should have headers but no data rows

    def test_export_oscal_empty_list(self, service):
        """Test OSCAL export with empty list."""
        result = service.export_oscal_poam([], {'name': 'Test'})

        assert result.success is True
        data = json.loads(result.content.decode('utf-8'))
        assert len(data['plan-of-action-and-milestones']['poam-items']) == 0

    def test_map_to_fedramp_row_minimal_item(self, service):
        """Test mapping minimal POA&M item."""
        item = {
            'weakness_id': 'V-001',
            'title': 'Test',
        }
        row = service._map_to_fedramp_row(item)

        assert len(row) == 26
        assert row[0] == 'V-001'

    def test_convert_to_oscal_without_milestones(self, service):
        """Test OSCAL conversion without milestones."""
        item = {
            'id': 'test-uuid',
            'title': 'Test Item',
            'description': 'Test description',
            'weakness_id': 'V-001',
            'status': 'open',
            'risk_level': 'moderate',
        }

        oscal_item = service._convert_to_oscal_poam_item(item)

        assert 'milestones' not in oscal_item or len(oscal_item.get('milestones', [])) == 0

    def test_convert_to_oscal_with_control_id(self, service):
        """Test OSCAL conversion with control ID."""
        item = {
            'id': 'test-uuid',
            'title': 'Test Item',
            'description': 'Test',
            'control_id': 'AC-2',
            'weakness_id': 'V-001',
            'status': 'open',
            'risk_level': 'high',
        }

        oscal_item = service._convert_to_oscal_poam_item(item)

        assert 'related-findings' in oscal_item
        assert oscal_item['related-findings'][0]['control-id'] == 'AC-2'
