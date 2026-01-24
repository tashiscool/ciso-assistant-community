# MIT License - See LICENSE-MIT.txt in repository root
"""
Tests for data_wizard_mit module (Excel import/export)

Standalone tests that can run without Django or openpyxl using unittest and mocking.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from io import BytesIO


class TestDataWizardMitModuleExports(unittest.TestCase):
    """Test module exports and lazy loading."""

    def test_module_exports(self):
        """Test that module exports expected items."""
        import data_wizard_mit
        expected = [
            'ArmExcelImporter', 'EbiosExcelExporter', 'EbiosExcelImporter',
            'ExcelReader', 'ExcelWriter', 'find_sheet_by_name',
            'find_sheet_by_prefix', 'get_sheet_rows', 'parse_multiline'
        ]
        self.assertEqual(sorted(data_wizard_mit.__all__), expected)

    def test_lazy_import_invalid_raises(self):
        """Test that invalid attribute raises AttributeError."""
        import data_wizard_mit
        with self.assertRaises(AttributeError):
            _ = data_wizard_mit.NonExistentClass


class TestExcelHelperFunctions(unittest.TestCase):
    """Test Excel helper utility functions."""

    def test_parse_multiline_string(self):
        """Test parsing multiline string."""
        from data_wizard_mit.excel_helpers import parse_multiline
        result = parse_multiline("line1\nline2\nline3")
        self.assertEqual(result, ["line1", "line2", "line3"])

    def test_parse_multiline_empty(self):
        """Test parsing empty value."""
        from data_wizard_mit.excel_helpers import parse_multiline
        result = parse_multiline(None)
        self.assertEqual(result, [])
        result = parse_multiline("")
        self.assertEqual(result, [])

    def test_parse_multiline_with_blanks(self):
        """Test parsing multiline with blank lines."""
        from data_wizard_mit.excel_helpers import parse_multiline
        result = parse_multiline("line1\n\nline2\n   \nline3")
        self.assertEqual(result, ["line1", "line2", "line3"])

    def test_parse_multiline_non_string(self):
        """Test parsing non-string value."""
        from data_wizard_mit.excel_helpers import parse_multiline
        result = parse_multiline(42)
        self.assertEqual(result, ["42"])

    def test_normalize_header(self):
        """Test header normalization."""
        from data_wizard_mit.excel_helpers import normalize_header
        self.assertEqual(normalize_header("My Header"), "my_header")
        self.assertEqual(normalize_header("Ref."), "ref.")
        self.assertEqual(normalize_header(""), "")
        self.assertEqual(normalize_header(None), "")

    def test_coalesce(self):
        """Test coalesce function."""
        from data_wizard_mit.excel_helpers import coalesce
        self.assertEqual(coalesce(None, None, "value"), "value")
        self.assertEqual(coalesce("first", "second"), "first")
        self.assertEqual(coalesce(None, None), None)
        self.assertEqual(coalesce(0, 1), 0)  # 0 is not None


class TestSheetData(unittest.TestCase):
    """Test SheetData dataclass."""

    def test_sheet_data_creation(self):
        """Test SheetData initialization."""
        from data_wizard_mit.excel_helpers import SheetData
        data = SheetData(
            name="Test Sheet",
            headers=["col1", "col2"],
            rows=[{"col1": "a", "col2": "b"}]
        )
        self.assertEqual(data.name, "Test Sheet")
        self.assertEqual(len(data.headers), 2)
        self.assertEqual(len(data.rows), 1)

    def test_sheet_data_defaults(self):
        """Test SheetData default values."""
        from data_wizard_mit.excel_helpers import SheetData
        data = SheetData(name="Test")
        self.assertEqual(data.headers, [])
        self.assertEqual(data.rows, [])
        self.assertEqual(data.raw_rows, [])


class TestEbiosStudyData(unittest.TestCase):
    """Test EbiosStudyData dataclass."""

    def test_ebios_study_data_creation(self):
        """Test EbiosStudyData initialization."""
        from data_wizard_mit.ebios_excel import EbiosStudyData
        data = EbiosStudyData(
            ref_id="EBIOS-001",
            name="Test Study",
            description="Test description"
        )
        self.assertEqual(data.ref_id, "EBIOS-001")
        self.assertEqual(data.name, "Test Study")

    def test_ebios_study_data_defaults(self):
        """Test EbiosStudyData default values."""
        from data_wizard_mit.ebios_excel import EbiosStudyData
        data = EbiosStudyData()
        self.assertEqual(data.assets, [])
        self.assertEqual(data.feared_events, [])
        self.assertEqual(data.ro_to_pairs, [])
        self.assertEqual(data.stakeholders, [])


class TestEbiosExcelImporter(unittest.TestCase):
    """Test EbiosExcelImporter class."""

    def test_importer_initialization(self):
        """Test importer can be initialized with bytes."""
        from data_wizard_mit.ebios_excel import EbiosExcelImporter
        content = b"fake excel content"
        importer = EbiosExcelImporter(content)
        self.assertIsNotNone(importer)

    def test_parse_selected_true_values(self):
        """Test _parse_selected with true values."""
        from data_wizard_mit.ebios_excel import EbiosExcelImporter
        importer = EbiosExcelImporter(b"")

        # Test various true values
        self.assertTrue(importer._parse_selected({"selected": True}))
        self.assertTrue(importer._parse_selected({"selected": "true"}))
        self.assertTrue(importer._parse_selected({"selected": "yes"}))
        self.assertTrue(importer._parse_selected({"selected": "1"}))
        self.assertTrue(importer._parse_selected({"✓": "✓"}))

    def test_parse_selected_false_values(self):
        """Test _parse_selected with false values."""
        from data_wizard_mit.ebios_excel import EbiosExcelImporter
        importer = EbiosExcelImporter(b"")

        self.assertFalse(importer._parse_selected({"selected": False}))
        self.assertFalse(importer._parse_selected({"selected": "no"}))
        self.assertFalse(importer._parse_selected({}))


class TestEbiosExcelExporter(unittest.TestCase):
    """Test EbiosExcelExporter class."""

    def test_exporter_initialization(self):
        """Test exporter can be initialized."""
        from data_wizard_mit.ebios_excel import EbiosExcelExporter
        exporter = EbiosExcelExporter()
        self.assertIsNotNone(exporter)


class TestArmExcelImporter(unittest.TestCase):
    """Test ArmExcelImporter class."""

    def test_importer_initialization(self):
        """Test ARM importer can be initialized."""
        from data_wizard_mit.arm_helpers import ArmExcelImporter
        content = b"fake excel content"
        importer = ArmExcelImporter(content)
        self.assertIsNotNone(importer)

    def test_parse_selected_french(self):
        """Test _parse_selected with French values."""
        from data_wizard_mit.arm_helpers import ArmExcelImporter
        importer = ArmExcelImporter(b"")

        self.assertTrue(importer._parse_selected("oui"))
        self.assertTrue(importer._parse_selected("✓"))
        self.assertFalse(importer._parse_selected("non"))
        self.assertFalse(importer._parse_selected(None))


class TestSheetVariants(unittest.TestCase):
    """Test sheet name variant mappings."""

    def test_sheet_prefixes_defined(self):
        """Test that SHEET_PREFIXES are defined."""
        from data_wizard_mit.ebios_excel import SHEET_PREFIXES
        self.assertIn("study", SHEET_PREFIXES)
        self.assertIn("feared_events", SHEET_PREFIXES)
        self.assertIn("ro_to", SHEET_PREFIXES)
        self.assertIn("stakeholders", SHEET_PREFIXES)

    def test_arm_sheet_variants_defined(self):
        """Test that ARM SHEET_VARIANTS are defined."""
        from data_wizard_mit.arm_helpers import SHEET_VARIANTS
        self.assertIn("business_values", SHEET_VARIANTS)
        self.assertIn("feared_events", SHEET_VARIANTS)
        self.assertIn("roto_couples", SHEET_VARIANTS)

    def test_arm_column_variants_defined(self):
        """Test that ARM COLUMN_VARIANTS are defined."""
        from data_wizard_mit.arm_helpers import COLUMN_VARIANTS
        self.assertIn("name", COLUMN_VARIANTS)
        self.assertIn("description", COLUMN_VARIANTS)
        self.assertIn("risk_origin", COLUMN_VARIANTS)


if __name__ == '__main__':
    unittest.main()
