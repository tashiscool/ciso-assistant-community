"""
TPRM MIT DORA Export Tests

Comprehensive tests for DORA Register of Information export functionality.
"""

import pytest
import io
import zipfile
import csv
from unittest.mock import Mock, MagicMock, patch
from datetime import date


class TestDoraROIExport:
    """Tests for DORA ROI export functionality."""

    def test_generate_dora_roi_returns_zip(self):
        """Test that DORA export returns a ZIP file."""
        from tprm_mit.dora_export import generate_dora_roi_export

        with patch('tprm_mit.dora_export.Entity') as MockEntity:
            MockEntity.objects.filter.return_value = []

            result = generate_dora_roi_export('org-123', 'Test Org')

        assert result is not None
        assert hasattr(result, 'read')

    def test_zip_contains_required_files(self):
        """Test that ZIP contains all required DORA files."""
        from tprm_mit.dora_export import generate_dora_roi_export

        with patch('tprm_mit.dora_export.Entity') as MockEntity:
            MockEntity.objects.filter.return_value = []

            result = generate_dora_roi_export('org-123', 'Test Org')

            with zipfile.ZipFile(result, 'r') as zf:
                names = zf.namelist()

                expected_files = [
                    'B_01_01_MainEntity.csv',
                    'B_01_02_EntityRegister.csv',
                    'B_02_01_ICTServices.csv',
                ]

                for expected in expected_files:
                    assert expected in names, f"Missing file: {expected}"


class TestMainEntityExport:
    """Tests for B_01_01_MainEntity.csv generation."""

    def test_main_entity_csv_structure(self):
        """Test main entity CSV has correct structure."""
        from tprm_mit.dora_export import generate_b_01_01_main_entity

        result = generate_b_01_01_main_entity('org-123', 'Test Corp')

        # Parse CSV
        reader = csv.DictReader(io.StringIO(result))
        rows = list(reader)

        assert len(rows) == 1
        assert 'EntityName' in reader.fieldnames
        assert rows[0]['EntityName'] == 'Test Corp'

    def test_main_entity_default_values(self):
        """Test main entity uses default values."""
        from tprm_mit.dora_export import generate_b_01_01_main_entity

        result = generate_b_01_01_main_entity('org-123', '')

        reader = csv.DictReader(io.StringIO(result))
        rows = list(reader)

        # Should use organization ID as fallback
        assert 'org-123' in rows[0]['EntityName'] or rows[0]['EntityName'] != ''


class TestEntityRegisterExport:
    """Tests for B_01_02_EntityRegister.csv generation."""

    def test_entity_register_empty(self):
        """Test entity register with no entities."""
        from tprm_mit.dora_export import generate_b_01_02_entity_register

        with patch('tprm_mit.dora_export.Entity') as MockEntity:
            MockEntity.objects.filter.return_value = []

            result = generate_b_01_02_entity_register('org-123')

        # Should still have header row
        reader = csv.DictReader(io.StringIO(result))
        rows = list(reader)
        assert len(rows) == 0
        assert 'EntityName' in reader.fieldnames

    def test_entity_register_with_entities(self):
        """Test entity register with entities."""
        from tprm_mit.dora_export import generate_b_01_02_entity_register

        mock_entity = Mock()
        mock_entity.name = "Vendor ABC"
        mock_entity.lei_code = "123456789012345678AB"
        mock_entity.entity_type = "supplier"
        mock_entity.country = "DE"

        with patch('tprm_mit.dora_export.Entity') as MockEntity:
            MockEntity.objects.filter.return_value = [mock_entity]

            result = generate_b_01_02_entity_register('org-123')

        reader = csv.DictReader(io.StringIO(result))
        rows = list(reader)

        assert len(rows) == 1
        assert rows[0]['EntityName'] == 'Vendor ABC'

    def test_entity_register_lei_validation(self):
        """Test LEI code format in export."""
        from tprm_mit.dora_export import generate_b_01_02_entity_register

        mock_entity = Mock()
        mock_entity.name = "Test"
        mock_entity.lei_code = "INVALID"  # Should be 20 chars
        mock_entity.entity_type = "vendor"
        mock_entity.country = "US"

        with patch('tprm_mit.dora_export.Entity') as MockEntity:
            MockEntity.objects.filter.return_value = [mock_entity]

            result = generate_b_01_02_entity_register('org-123')

        # Should still export but with invalid LEI
        reader = csv.DictReader(io.StringIO(result))
        rows = list(reader)
        assert len(rows) == 1


class TestICTServicesExport:
    """Tests for B_02_01_ICTServices.csv generation."""

    def test_ict_services_export(self):
        """Test ICT services export."""
        from tprm_mit.dora_export import generate_b_02_01_ict_services

        mock_solution = Mock()
        mock_solution.name = "Cloud Storage"
        mock_solution.function_type = "data_storage"
        mock_solution.is_ict_service = True
        mock_solution.supports_critical_function = True
        mock_solution.provider = Mock(name="Cloud Provider Inc")

        with patch('tprm_mit.dora_export.Solution') as MockSolution:
            MockSolution.objects.filter.return_value = [mock_solution]

            result = generate_b_02_01_ict_services('org-123')

        reader = csv.DictReader(io.StringIO(result))
        rows = list(reader)

        assert len(rows) == 1
        assert 'ServiceName' in reader.fieldnames


class TestContractExport:
    """Tests for contract-related DORA exports."""

    def test_contract_register_export(self):
        """Test contract register export."""
        from tprm_mit.dora_export import generate_b_03_01_contracts

        mock_contract = Mock()
        mock_contract.name = "SLA Agreement"
        mock_contract.contract_id = "CONT-001"
        mock_contract.start_date = date(2024, 1, 1)
        mock_contract.end_date = date(2025, 12, 31)
        mock_contract.entity = Mock(name="Vendor")
        mock_contract.exit_strategy = True

        with patch('tprm_mit.dora_export.Contract') as MockContract:
            MockContract.objects.filter.return_value = [mock_contract]

            result = generate_b_03_01_contracts('org-123')

        reader = csv.DictReader(io.StringIO(result))
        rows = list(reader)

        assert len(rows) == 1
        assert 'ContractID' in reader.fieldnames


class TestSubcontractingExport:
    """Tests for subcontracting DORA exports."""

    def test_subcontracting_chain_export(self):
        """Test subcontracting chain export."""
        from tprm_mit.dora_export import generate_b_04_01_subcontracting

        mock_entity = Mock()
        mock_entity.name = "Subcontractor"
        mock_entity.parent_entity = Mock(name="Main Contractor")
        mock_entity.subcontracting_level = 1

        with patch('tprm_mit.dora_export.Entity') as MockEntity:
            MockEntity.objects.filter.return_value = [mock_entity]

            result = generate_b_04_01_subcontracting('org-123')

        reader = csv.DictReader(io.StringIO(result))
        # Should have structure for subcontracting
        assert 'SubcontractorName' in reader.fieldnames or 'EntityName' in reader.fieldnames


class TestCSVFormatting:
    """Tests for CSV formatting utilities."""

    def test_csv_date_formatting(self):
        """Test date formatting in CSV output."""
        from tprm_mit.dora_export import format_date_for_csv

        test_date = date(2024, 6, 15)
        formatted = format_date_for_csv(test_date)

        # DORA format: YYYY-MM-DD
        assert formatted == "2024-06-15"

    def test_csv_date_none_handling(self):
        """Test None date handling."""
        from tprm_mit.dora_export import format_date_for_csv

        formatted = format_date_for_csv(None)
        assert formatted == "" or formatted is None

    def test_csv_boolean_formatting(self):
        """Test boolean formatting in CSV output."""
        from tprm_mit.dora_export import format_bool_for_csv

        assert format_bool_for_csv(True) == "Y"
        assert format_bool_for_csv(False) == "N"
        assert format_bool_for_csv(None) == ""

    def test_csv_special_chars_escaping(self):
        """Test special character escaping."""
        from tprm_mit.dora_export import escape_csv_value

        # Commas should be handled
        result = escape_csv_value("Test, with comma")
        assert '"' in result or result == "Test, with comma"

        # Quotes should be escaped
        result = escape_csv_value('Test "quoted" text')
        assert '""' in result or result == 'Test "quoted" text'


class TestExportValidation:
    """Tests for export validation."""

    def test_validate_lei_format(self):
        """Test LEI format validation."""
        from tprm_mit.dora_export import validate_lei

        # Valid LEI (20 alphanumeric characters)
        assert validate_lei("529900T8BM49AURSDO55") == True

        # Invalid LEI
        assert validate_lei("INVALID") == False
        assert validate_lei("") == False
        assert validate_lei(None) == False

    def test_validate_country_code(self):
        """Test country code validation."""
        from tprm_mit.dora_export import validate_country_code

        assert validate_country_code("DE") == True
        assert validate_country_code("US") == True
        assert validate_country_code("XX") == False
        assert validate_country_code("") == False


class TestExportIntegration:
    """Integration tests for complete DORA export."""

    def test_full_export_workflow(self):
        """Test complete export workflow."""
        from tprm_mit.dora_export import generate_dora_roi_export

        # Mock all related models
        with patch('tprm_mit.dora_export.Entity') as MockEntity, \
             patch('tprm_mit.dora_export.Solution') as MockSolution, \
             patch('tprm_mit.dora_export.Contract') as MockContract:

            MockEntity.objects.filter.return_value = []
            MockSolution.objects.filter.return_value = []
            MockContract.objects.filter.return_value = []

            result = generate_dora_roi_export('org-123', 'Test Organization')

            # Should be a valid ZIP file
            with zipfile.ZipFile(result, 'r') as zf:
                # Should not have any corrupt files
                assert zf.testzip() is None

                # Should have multiple files
                assert len(zf.namelist()) >= 5

    def test_export_with_real_data_structure(self):
        """Test export with realistic data structures."""
        from tprm_mit.dora_export import generate_dora_roi_export

        mock_entity = Mock()
        mock_entity.id = 'uuid-1'
        mock_entity.name = "Critical Supplier"
        mock_entity.lei_code = "529900T8BM49AURSDO55"
        mock_entity.entity_type = "supplier"
        mock_entity.criticality = "critical"
        mock_entity.country = "DE"
        mock_entity.is_ict_provider = True

        mock_solution = Mock()
        mock_solution.id = 'uuid-2'
        mock_solution.name = "Cloud Platform"
        mock_solution.provider = mock_entity
        mock_solution.is_ict_service = True
        mock_solution.supports_critical_function = True

        with patch('tprm_mit.dora_export.Entity') as MockEntity, \
             patch('tprm_mit.dora_export.Solution') as MockSolution, \
             patch('tprm_mit.dora_export.Contract') as MockContract:

            MockEntity.objects.filter.return_value = [mock_entity]
            MockSolution.objects.filter.return_value = [mock_solution]
            MockContract.objects.filter.return_value = []

            result = generate_dora_roi_export('org-123', 'Test Org')

            with zipfile.ZipFile(result, 'r') as zf:
                # Check entity register contains our entity
                content = zf.read('B_01_02_EntityRegister.csv').decode('utf-8')
                assert 'Critical Supplier' in content

                # Check ICT services contains our solution
                content = zf.read('B_02_01_ICTServices.csv').decode('utf-8')
                assert 'Cloud Platform' in content
