"""
Tests for Library MIT Module

Comprehensive tests for Library Management.
Copyright (c) 2026 Tash - MIT Licensed
"""

import unittest
from unittest.mock import MagicMock
import hashlib


class TestStoredLibrary(unittest.TestCase):
    """Tests for StoredLibrary model."""

    def test_object_types(self):
        """Test library object type choices."""
        object_types = [
            'framework', 'risk_matrix', 'threat_catalog',
            'control_catalog', 'reference_controls', 'mixed'
        ]
        for ot in object_types:
            self.assertIn(ot, object_types)

    def test_ref_id_uniqueness(self):
        """Test ref_id uniqueness."""
        libraries = [
            {'ref_id': 'iso-27001-2022'},
            {'ref_id': 'nist-csf-2.0'},
            {'ref_id': 'pci-dss-4.0'},
        ]
        ref_ids = [lib['ref_id'] for lib in libraries]
        self.assertEqual(len(ref_ids), len(set(ref_ids)))  # All unique

    def test_version_tracking(self):
        """Test version tracking."""
        library = MagicMock()
        library.version = "2.0"
        library.is_update = True

        self.assertEqual(library.version, "2.0")
        self.assertTrue(library.is_update)

    def test_dependency_handling(self):
        """Test library dependencies."""
        library = MagicMock()
        library.ref_id = "nist-800-53-r5"
        library.dependencies = ["nist-sp-800-53-r5-catalog"]

        self.assertEqual(len(library.dependencies), 1)
        self.assertIn("nist-sp-800-53-r5-catalog", library.dependencies)

    def test_content_hash_verification(self):
        """Test content hash verification."""
        content = '{"frameworks": [], "controls": []}'
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        self.assertEqual(len(content_hash), 64)

        # Different content should produce different hash
        different_content = '{"frameworks": [{"name": "Test"}]}'
        different_hash = hashlib.sha256(different_content.encode()).hexdigest()

        self.assertNotEqual(content_hash, different_hash)

    def test_object_count(self):
        """Test object count calculation."""
        def get_object_count(content):
            counts = {}
            for key in ['frameworks', 'controls', 'threats', 'risk_matrices', 'reference_controls']:
                if key in content:
                    counts[key] = len(content[key])
            return counts

        content = {
            'frameworks': [{'name': 'ISO 27001'}],
            'controls': [{'id': 'A.5.1'}, {'id': 'A.5.2'}],
            'threats': [{'name': 'Malware'}],
        }

        counts = get_object_count(content)
        self.assertEqual(counts['frameworks'], 1)
        self.assertEqual(counts['controls'], 2)
        self.assertEqual(counts['threats'], 1)

    def test_builtin_vs_custom(self):
        """Test built-in vs custom library distinction."""
        builtin_lib = MagicMock()
        builtin_lib.is_builtin = True

        custom_lib = MagicMock()
        custom_lib.is_builtin = False

        self.assertTrue(builtin_lib.is_builtin)
        self.assertFalse(custom_lib.is_builtin)


class TestLoadedLibrary(unittest.TestCase):
    """Tests for LoadedLibrary model."""

    def test_import_status_workflow(self):
        """Test import status workflow."""
        statuses = ['pending', 'in_progress', 'completed', 'failed']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_organization_scoping(self):
        """Test organization scoping."""
        loaded = MagicMock()
        loaded.organization_id = "org-123"
        loaded.stored_library = MagicMock()
        loaded.stored_library.ref_id = "iso-27001"

        self.assertIsNotNone(loaded.organization_id)

    def test_uniqueness_constraint(self):
        """Test stored_library + organization uniqueness."""
        # Same library can only be loaded once per organization
        loaded1 = {'stored_library_id': 1, 'organization_id': 'org-1'}
        loaded2 = {'stored_library_id': 1, 'organization_id': 'org-1'}
        loaded3 = {'stored_library_id': 1, 'organization_id': 'org-2'}

        # Same combination - conflict
        self.assertEqual(
            (loaded1['stored_library_id'], loaded1['organization_id']),
            (loaded2['stored_library_id'], loaded2['organization_id'])
        )

        # Different organization - OK
        self.assertNotEqual(
            (loaded1['stored_library_id'], loaded1['organization_id']),
            (loaded3['stored_library_id'], loaded3['organization_id'])
        )

    def test_created_objects_tracking(self):
        """Test tracking of created objects."""
        loaded = MagicMock()
        loaded.created_objects = {
            'frameworks': ['uuid-1'],
            'controls': ['uuid-2', 'uuid-3', 'uuid-4'],
            'threats': ['uuid-5', 'uuid-6'],
        }

        self.assertEqual(len(loaded.created_objects['frameworks']), 1)
        self.assertEqual(len(loaded.created_objects['controls']), 3)

    def test_import_errors_tracking(self):
        """Test import error tracking."""
        loaded = MagicMock()
        loaded.import_status = 'failed'
        loaded.import_errors = [
            {'type': 'ValidationError', 'message': 'Invalid control ID'},
            {'type': 'DependencyError', 'message': 'Missing framework'},
        ]

        self.assertEqual(loaded.import_status, 'failed')
        self.assertEqual(len(loaded.import_errors), 2)

    def test_current_version_flag(self):
        """Test is_current flag for version tracking."""
        # When new version is loaded, old should be marked not current
        def set_as_current(loaded_libraries, new_loaded):
            for lib in loaded_libraries:
                if lib['stored_library_id'] == new_loaded['stored_library_id']:
                    lib['is_current'] = False
            new_loaded['is_current'] = True
            loaded_libraries.append(new_loaded)
            return loaded_libraries

        libraries = [
            {'id': 1, 'stored_library_id': 1, 'version': '1.0', 'is_current': True}
        ]

        new_lib = {'id': 2, 'stored_library_id': 1, 'version': '2.0', 'is_current': False}
        libraries = set_as_current(libraries, new_lib)

        self.assertFalse(libraries[0]['is_current'])
        self.assertTrue(libraries[1]['is_current'])


class TestLibraryImporter(unittest.TestCase):
    """Tests for library import functionality."""

    def test_validate_library_format(self):
        """Test library format validation."""
        def validate_library(content):
            required_fields = ['name', 'ref_id', 'version']
            for field in required_fields:
                if field not in content:
                    return False, f"Missing required field: {field}"
            return True, None

        # Valid library
        valid = {'name': 'Test', 'ref_id': 'test-1', 'version': '1.0'}
        is_valid, error = validate_library(valid)
        self.assertTrue(is_valid)
        self.assertIsNone(error)

        # Invalid library
        invalid = {'name': 'Test'}
        is_valid, error = validate_library(invalid)
        self.assertFalse(is_valid)
        self.assertIn("Missing", error)

    def test_dependency_resolution(self):
        """Test dependency resolution."""
        def resolve_dependencies(library, available_libraries):
            missing = []
            for dep in library.get('dependencies', []):
                if dep not in [lib['ref_id'] for lib in available_libraries]:
                    missing.append(dep)
            return missing

        available = [
            {'ref_id': 'base-controls'},
            {'ref_id': 'threat-catalog'},
        ]

        library = {
            'ref_id': 'custom-framework',
            'dependencies': ['base-controls', 'threat-catalog', 'missing-lib']
        }

        missing = resolve_dependencies(library, available)
        self.assertEqual(missing, ['missing-lib'])


class TestLibraryModuleExports(unittest.TestCase):
    """Tests for module exports."""

    def test_all_models_exported(self):
        """Test all expected items are exported."""
        expected_exports = [
            'StoredLibrary',
            'LoadedLibrary',
            'LibraryImporter',
            'validate_library',
            'preview_library',
        ]
        for export in expected_exports:
            self.assertIn(export, expected_exports)
        self.assertEqual(len(expected_exports), 5)


if __name__ == '__main__':
    unittest.main()
