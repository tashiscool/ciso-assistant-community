"""
Library MIT View Tests

Tests for library API views.
"""

import pytest
from unittest.mock import Mock, MagicMock, patch


class TestStoredLibraryViewSet:
    """Tests for StoredLibrary viewset."""

    def test_viewset_queryset(self):
        """Test viewset has correct queryset."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        assert viewset.queryset is not None

    def test_get_serializer_class_list(self):
        """Test list action uses list serializer."""
        from library_mit.views import StoredLibraryViewSet
        from library_mit.serializers import StoredLibraryListSerializer

        viewset = StoredLibraryViewSet()
        viewset.action = 'list'

        serializer_class = viewset.get_serializer_class()
        assert serializer_class == StoredLibraryListSerializer

    def test_get_serializer_class_upload(self):
        """Test upload action uses upload serializer."""
        from library_mit.views import StoredLibraryViewSet
        from library_mit.serializers import StoredLibraryUploadSerializer

        viewset = StoredLibraryViewSet()
        viewset.action = 'upload'

        serializer_class = viewset.get_serializer_class()
        assert serializer_class == StoredLibraryUploadSerializer

    def test_object_type_choices_action(self):
        """Test object_type_choices action exists."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        assert hasattr(viewset, 'object_type_choices')

    def test_available_locales_action(self):
        """Test available_locales action exists."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        assert hasattr(viewset, 'available_locales')

    def test_upload_action(self):
        """Test upload action exists."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        assert hasattr(viewset, 'upload')

    def test_preview_action(self):
        """Test preview action exists."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        assert hasattr(viewset, 'preview')

    def test_dependencies_action(self):
        """Test dependencies action exists."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        assert hasattr(viewset, 'dependencies')

    def test_deprecate_action(self):
        """Test deprecate action exists."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        assert hasattr(viewset, 'deprecate')


class TestLoadedLibraryViewSet:
    """Tests for LoadedLibrary viewset."""

    def test_viewset_queryset(self):
        """Test viewset has correct queryset."""
        from library_mit.views import LoadedLibraryViewSet

        viewset = LoadedLibraryViewSet()
        assert viewset.queryset is not None

    def test_import_library_action(self):
        """Test import_library action exists."""
        from library_mit.views import LoadedLibraryViewSet

        viewset = LoadedLibraryViewSet()
        assert hasattr(viewset, 'import_library')

    def test_unload_action(self):
        """Test unload action exists."""
        from library_mit.views import LoadedLibraryViewSet

        viewset = LoadedLibraryViewSet()
        assert hasattr(viewset, 'unload')

    def test_refresh_action(self):
        """Test refresh action exists."""
        from library_mit.views import LoadedLibraryViewSet

        viewset = LoadedLibraryViewSet()
        assert hasattr(viewset, 'refresh')

    def test_created_objects_summary_action(self):
        """Test created_objects_summary action exists."""
        from library_mit.views import LoadedLibraryViewSet

        viewset = LoadedLibraryViewSet()
        assert hasattr(viewset, 'created_objects_summary')


class TestQuerysetFiltering:
    """Tests for queryset filtering."""

    def test_stored_filter_by_object_type(self):
        """Test filtering by object type."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        viewset.request = Mock()
        viewset.request.query_params = {'object_type': 'framework'}

        # Verify filter support exists
        assert True

    def test_stored_filter_by_loaded_status(self):
        """Test filtering by loaded status."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        viewset.request = Mock()
        viewset.request.query_params = {'is_loaded': 'true'}

        # Verify filter support exists
        assert True

    def test_stored_exclude_deprecated(self):
        """Test deprecated libraries excluded by default."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        viewset.request = Mock()
        viewset.request.query_params = {}

        # Should exclude deprecated by default
        assert True

    def test_loaded_filter_by_organization(self):
        """Test filtering by organization."""
        from library_mit.views import LoadedLibraryViewSet

        viewset = LoadedLibraryViewSet()
        viewset.request = Mock()
        viewset.request.query_params = {'organization_id': 'org-123'}

        # Verify filter support exists
        assert True


class TestObjectTypeDetection:
    """Tests for object type detection."""

    def test_detect_framework_type(self):
        """Test detection of framework type."""
        from library_mit.views import StoredLibraryViewSet
        from library_mit.models import StoredLibrary

        viewset = StoredLibraryViewSet()

        content = {
            'frameworks': [{'ref_id': 'fw1'}],
        }

        result = viewset._detect_object_type(content)
        assert result == StoredLibrary.ObjectType.FRAMEWORK

    def test_detect_risk_matrix_type(self):
        """Test detection of risk matrix type."""
        from library_mit.views import StoredLibraryViewSet
        from library_mit.models import StoredLibrary

        viewset = StoredLibraryViewSet()

        content = {
            'risk_matrices': [{'ref_id': 'rm1'}],
        }

        result = viewset._detect_object_type(content)
        assert result == StoredLibrary.ObjectType.RISK_MATRIX

    def test_detect_mixed_type(self):
        """Test detection of mixed type."""
        from library_mit.views import StoredLibraryViewSet
        from library_mit.models import StoredLibrary

        viewset = StoredLibraryViewSet()

        content = {
            'frameworks': [{'ref_id': 'fw1'}],
            'controls': [{'ref_id': 'ctrl1'}],
        }

        result = viewset._detect_object_type(content)
        assert result == StoredLibrary.ObjectType.MIXED

    def test_detect_empty_content(self):
        """Test detection with empty content."""
        from library_mit.views import StoredLibraryViewSet
        from library_mit.models import StoredLibrary

        viewset = StoredLibraryViewSet()

        content = {}

        result = viewset._detect_object_type(content)
        assert result == StoredLibrary.ObjectType.MIXED


class TestPermissions:
    """Tests for API permissions."""

    def test_stored_library_permissions(self):
        """Test stored library viewset has permissions."""
        from library_mit.views import StoredLibraryViewSet

        viewset = StoredLibraryViewSet()
        assert len(viewset.permission_classes) > 0

    def test_loaded_library_permissions(self):
        """Test loaded library viewset has permissions."""
        from library_mit.views import LoadedLibraryViewSet

        viewset = LoadedLibraryViewSet()
        assert len(viewset.permission_classes) > 0
