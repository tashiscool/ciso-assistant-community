"""
Library MIT Utils Tests

Comprehensive tests for library import and validation utilities.
"""

import pytest
import json
import hashlib
from unittest.mock import Mock, MagicMock, patch


class TestValidateLibrary:
    """Tests for library validation."""

    def test_validate_library_valid(self):
        """Test validation of valid library content."""
        from library_mit.utils import validate_library

        content = {
            'name': 'Test Library',
            'ref_id': 'test-lib-001',
            'version': '1.0.0',
        }

        is_valid, errors = validate_library(content)
        assert is_valid == True
        assert len(errors) == 0

    def test_validate_library_missing_name(self):
        """Test validation fails without name."""
        from library_mit.utils import validate_library

        content = {
            'ref_id': 'test-lib-001',
            'version': '1.0.0',
        }

        is_valid, errors = validate_library(content)
        assert is_valid == False
        assert any('name' in e.lower() for e in errors)

    def test_validate_library_missing_ref_id(self):
        """Test validation fails without ref_id."""
        from library_mit.utils import validate_library

        content = {
            'name': 'Test',
            'version': '1.0.0',
        }

        is_valid, errors = validate_library(content)
        assert is_valid == False
        assert any('ref_id' in e.lower() for e in errors)

    def test_validate_library_missing_version(self):
        """Test validation fails without version."""
        from library_mit.utils import validate_library

        content = {
            'name': 'Test',
            'ref_id': 'test-001',
        }

        is_valid, errors = validate_library(content)
        assert is_valid == False
        assert any('version' in e.lower() for e in errors)

    def test_validate_library_invalid_ref_id(self):
        """Test validation fails with invalid ref_id format."""
        from library_mit.utils import validate_library

        content = {
            'name': 'Test',
            'ref_id': 'test lib with spaces!',
            'version': '1.0.0',
        }

        is_valid, errors = validate_library(content)
        assert is_valid == False
        assert any('ref_id' in e.lower() for e in errors)

    def test_validate_library_valid_ref_id_formats(self):
        """Test valid ref_id formats pass validation."""
        from library_mit.utils import validate_library

        valid_ref_ids = [
            'simple',
            'with-hyphen',
            'with_underscore',
            'mixed-ref_id-123',
        ]

        for ref_id in valid_ref_ids:
            content = {
                'name': 'Test',
                'ref_id': ref_id,
                'version': '1.0.0',
            }
            is_valid, errors = validate_library(content)
            assert is_valid == True, f"Failed for ref_id: {ref_id}"

    def test_validate_library_invalid_version(self):
        """Test validation fails with invalid version format."""
        from library_mit.utils import validate_library

        content = {
            'name': 'Test',
            'ref_id': 'test-001',
            'version': 'not-a-version',
        }

        is_valid, errors = validate_library(content)
        assert is_valid == False
        assert any('version' in e.lower() for e in errors)

    def test_validate_library_frameworks_not_array(self):
        """Test validation fails when frameworks is not an array."""
        from library_mit.utils import validate_library

        content = {
            'name': 'Test',
            'ref_id': 'test-001',
            'version': '1.0.0',
            'frameworks': 'not an array',
        }

        is_valid, errors = validate_library(content)
        assert is_valid == False
        assert any('frameworks' in e.lower() and 'array' in e.lower() for e in errors)

    def test_validate_library_frameworks_missing_ref_id(self):
        """Test validation fails when framework missing ref_id."""
        from library_mit.utils import validate_library

        content = {
            'name': 'Test',
            'ref_id': 'test-001',
            'version': '1.0.0',
            'frameworks': [{'name': 'Framework without ref_id'}],
        }

        is_valid, errors = validate_library(content)
        assert is_valid == False
        assert any('ref_id' in e.lower() for e in errors)


class TestPreviewLibrary:
    """Tests for library preview generation."""

    def test_preview_basic(self):
        """Test basic preview generation."""
        from library_mit.utils import preview_library

        content = {
            'name': 'Test Library',
            'ref_id': 'test-lib',
            'version': '2.0.0',
            'description': 'A test library',
            'provider': 'Test Provider',
            'locale': 'en',
        }

        preview = preview_library(content)

        assert preview['name'] == 'Test Library'
        assert preview['ref_id'] == 'test-lib'
        assert preview['version'] == '2.0.0'
        assert preview['description'] == 'A test library'
        assert preview['provider'] == 'Test Provider'
        assert preview['locale'] == 'en'

    def test_preview_object_counts(self):
        """Test preview includes object counts."""
        from library_mit.utils import preview_library

        content = {
            'name': 'Test',
            'ref_id': 'test',
            'version': '1.0',
            'frameworks': [{'ref_id': 'fw1'}, {'ref_id': 'fw2'}],
            'controls': [{'ref_id': 'ctrl1'}],
        }

        preview = preview_library(content)

        assert preview['object_counts']['frameworks'] == 2
        assert preview['object_counts']['controls'] == 1

    def test_preview_dependencies(self):
        """Test preview includes dependencies."""
        from library_mit.utils import preview_library

        content = {
            'name': 'Test',
            'ref_id': 'test',
            'version': '1.0',
            'dependencies': ['dep-lib-1', 'dep-lib-2'],
        }

        preview = preview_library(content)

        assert preview['dependencies'] == ['dep-lib-1', 'dep-lib-2']

    def test_preview_defaults(self):
        """Test preview uses defaults for missing fields."""
        from library_mit.utils import preview_library

        content = {}

        preview = preview_library(content)

        assert preview['name'] == 'Unknown'
        assert preview['ref_id'] == ''
        assert preview['locale'] == 'en'


class TestComputeContentHash:
    """Tests for content hash computation."""

    def test_compute_hash_basic(self):
        """Test basic hash computation."""
        from library_mit.utils import compute_content_hash

        content = {'name': 'Test', 'ref_id': 'test'}
        hash_result = compute_content_hash(content)

        # Should be 64 character hex string (SHA-256)
        assert len(hash_result) == 64
        assert all(c in '0123456789abcdef' for c in hash_result)

    def test_compute_hash_deterministic(self):
        """Test hash is deterministic."""
        from library_mit.utils import compute_content_hash

        content = {'name': 'Test', 'ref_id': 'test', 'version': '1.0'}

        hash1 = compute_content_hash(content)
        hash2 = compute_content_hash(content)

        assert hash1 == hash2

    def test_compute_hash_different_content(self):
        """Test different content produces different hash."""
        from library_mit.utils import compute_content_hash

        content1 = {'name': 'Test1'}
        content2 = {'name': 'Test2'}

        hash1 = compute_content_hash(content1)
        hash2 = compute_content_hash(content2)

        assert hash1 != hash2

    def test_compute_hash_order_independent(self):
        """Test hash is independent of key order."""
        from library_mit.utils import compute_content_hash

        content1 = {'a': 1, 'b': 2}
        content2 = {'b': 2, 'a': 1}

        hash1 = compute_content_hash(content1)
        hash2 = compute_content_hash(content2)

        # sort_keys=True ensures order independence
        assert hash1 == hash2


class TestValidateFileExtension:
    """Tests for file extension validation."""

    def test_valid_json_extension(self):
        """Test .json extension is valid."""
        from library_mit.utils import validate_file_extension

        assert validate_file_extension('library.json') == True

    def test_valid_yaml_extension(self):
        """Test .yaml extension is valid."""
        from library_mit.utils import validate_file_extension

        assert validate_file_extension('library.yaml') == True

    def test_valid_yml_extension(self):
        """Test .yml extension is valid."""
        from library_mit.utils import validate_file_extension

        assert validate_file_extension('library.yml') == True

    def test_invalid_extension(self):
        """Test invalid extensions are rejected."""
        from library_mit.utils import validate_file_extension

        assert validate_file_extension('library.txt') == False
        assert validate_file_extension('library.xml') == False
        assert validate_file_extension('library') == False

    def test_case_insensitive(self):
        """Test extension validation is case-insensitive."""
        from library_mit.utils import validate_file_extension

        assert validate_file_extension('library.JSON') == True
        assert validate_file_extension('library.YAML') == True


class TestParseLibraryFile:
    """Tests for library file parsing."""

    def test_parse_json_file(self):
        """Test parsing JSON file."""
        from library_mit.utils import parse_library_file

        content = json.dumps({'name': 'Test', 'ref_id': 'test'}).encode('utf-8')

        result = parse_library_file(content, 'library.json')

        assert result['name'] == 'Test'
        assert result['ref_id'] == 'test'

    def test_parse_yaml_not_implemented(self):
        """Test YAML parsing raises NotImplementedError."""
        from library_mit.utils import parse_library_file

        with pytest.raises(NotImplementedError):
            parse_library_file(b'name: Test', 'library.yaml')

    def test_parse_invalid_format(self):
        """Test parsing invalid format raises ValueError."""
        from library_mit.utils import parse_library_file

        with pytest.raises(ValueError):
            parse_library_file(b'content', 'library.txt')

    def test_parse_invalid_json(self):
        """Test parsing invalid JSON raises error."""
        from library_mit.utils import parse_library_file

        with pytest.raises(json.JSONDecodeError):
            parse_library_file(b'not valid json', 'library.json')


class TestLibraryImporter:
    """Tests for LibraryImporter class."""

    def test_importer_initialization(self):
        """Test importer initialization."""
        from library_mit.utils import LibraryImporter

        importer = LibraryImporter(organization_id='org-123', user=Mock())

        assert importer.organization_id == 'org-123'
        assert importer.errors == []
        assert importer.created_objects == {}

    def test_importer_import_library_new(self):
        """Test importing a new library."""
        from library_mit.utils import LibraryImporter

        importer = LibraryImporter(organization_id='org-123')

        # Mock StoredLibrary
        mock_stored = Mock()
        mock_stored.version = '1.0.0'
        mock_stored.content = {'frameworks': []}
        mock_stored.dependencies = []

        with patch('library_mit.utils.LoadedLibrary') as MockLoaded:
            mock_loaded = Mock()
            MockLoaded.objects.filter.return_value.first.return_value = None
            MockLoaded.objects.create.return_value = mock_loaded

            result = importer.import_library(mock_stored)

            MockLoaded.objects.create.assert_called_once()

    def test_importer_check_dependencies(self):
        """Test dependency checking."""
        from library_mit.utils import LibraryImporter

        importer = LibraryImporter(organization_id='org-123')

        mock_library = Mock()
        mock_library.dependencies = ['dep-1', 'dep-2']

        with patch('library_mit.utils.StoredLibrary') as MockStored:
            # First dep exists and loaded
            mock_dep1 = Mock()
            mock_dep1.is_loaded = True

            # Second dep missing
            MockStored.objects.filter.return_value.first.side_effect = [mock_dep1, None]

            importer._check_dependencies(mock_library)

            assert len(importer.errors) == 1
            assert 'dep-2' in importer.errors[0]
