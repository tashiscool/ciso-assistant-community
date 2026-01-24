"""
Library MIT Model Tests

Comprehensive tests for library management models.
"""

import pytest
import uuid
from unittest.mock import Mock, MagicMock


class TestStoredLibraryModel:
    """Tests for StoredLibrary model."""

    def test_object_type_choices(self):
        """Test object type enum values."""
        from library_mit.models import StoredLibrary

        expected = ['framework', 'risk_matrix', 'threat_catalog', 'control_catalog', 'reference_controls', 'mixed']
        actual = [c[0] for c in StoredLibrary.ObjectType.choices]
        assert actual == expected

    def test_stored_library_str_representation(self):
        """Test stored library string representation."""
        from library_mit.models import StoredLibrary

        lib = StoredLibrary(name="ISO 27001:2022", version="1.0")
        assert str(lib) == "ISO 27001:2022 (1.0)"

    def test_stored_library_default_version(self):
        """Test default version is 1.0."""
        from library_mit.models import StoredLibrary

        lib = StoredLibrary(name="Test")
        assert lib.version == "1.0"

    def test_stored_library_default_locale(self):
        """Test default locale is en."""
        from library_mit.models import StoredLibrary

        lib = StoredLibrary(name="Test")
        assert lib.locale == "en"

    def test_stored_library_ordering(self):
        """Test library ordering by name."""
        from library_mit.models import StoredLibrary
        assert StoredLibrary._meta.ordering == ['name']

    def test_ref_id_unique(self):
        """Test ref_id is unique."""
        from library_mit.models import StoredLibrary

        field = None
        for f in StoredLibrary._meta.get_fields():
            if f.name == 'ref_id':
                field = f
                break

        assert field is not None
        assert field.unique == True

    def test_get_object_count_empty(self):
        """Test object count with empty content."""
        from library_mit.models import StoredLibrary

        lib = StoredLibrary(name="Test", content={})
        counts = lib.get_object_count()
        assert counts == {}

    def test_get_object_count_with_content(self):
        """Test object count with content."""
        from library_mit.models import StoredLibrary

        lib = StoredLibrary(name="Test", content={
            'frameworks': [{'ref_id': 'fw1'}, {'ref_id': 'fw2'}],
            'controls': [{'ref_id': 'ctrl1'}],
            'threats': [],
        })

        counts = lib.get_object_count()
        assert counts['frameworks'] == 2
        assert counts['controls'] == 1
        assert counts['threats'] == 0


class TestLoadedLibraryModel:
    """Tests for LoadedLibrary model."""

    def test_import_status_choices(self):
        """Test import status enum values."""
        from library_mit.models import LoadedLibrary

        expected = ['pending', 'in_progress', 'completed', 'failed']
        actual = [c[0] for c in LoadedLibrary.ImportStatus.choices]
        assert actual == expected

    def test_loaded_library_str(self):
        """Test loaded library string representation."""
        from library_mit.models import LoadedLibrary, StoredLibrary

        stored = StoredLibrary(name="NIST CSF")
        loaded = LoadedLibrary(
            stored_library=stored,
            organization_id=uuid.uuid4()
        )
        result = str(loaded)
        assert "NIST CSF" in result

    def test_loaded_library_ordering(self):
        """Test loaded library ordering."""
        from library_mit.models import LoadedLibrary
        assert '-loaded_at' in LoadedLibrary._meta.ordering

    def test_default_is_current(self):
        """Test default is_current is True."""
        from library_mit.models import LoadedLibrary

        loaded = LoadedLibrary()
        assert loaded.is_current == True

    def test_default_import_status(self):
        """Test default import status is pending."""
        from library_mit.models import LoadedLibrary

        loaded = LoadedLibrary()
        assert loaded.import_status == LoadedLibrary.ImportStatus.PENDING


class TestLibraryRelationships:
    """Tests for library model relationships."""

    def test_stored_loaded_relationship(self):
        """Test stored library to loaded library relationship."""
        from library_mit.models import StoredLibrary, LoadedLibrary

        # Check FK field exists
        fk_field = None
        for f in LoadedLibrary._meta.get_fields():
            if f.name == 'stored_library':
                fk_field = f
                break

        assert fk_field is not None

    def test_loaded_library_user_relationship(self):
        """Test loaded_by user relationship."""
        from library_mit.models import LoadedLibrary

        field_names = [f.name for f in LoadedLibrary._meta.get_fields()]
        assert 'loaded_by' in field_names


class TestLibraryConstraints:
    """Tests for library model constraints."""

    def test_stored_library_content_hash_length(self):
        """Test content hash field length."""
        from library_mit.models import StoredLibrary

        for f in StoredLibrary._meta.get_fields():
            if f.name == 'content_hash':
                assert f.max_length == 64  # SHA-256 hex length
                break

    def test_dependencies_default(self):
        """Test dependencies default to empty list."""
        from library_mit.models import StoredLibrary

        lib = StoredLibrary(name="Test")
        assert lib.dependencies == [] or lib.dependencies is None
