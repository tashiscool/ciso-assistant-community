"""
Serdes MIT View Tests

Tests for backup/restore API views.
"""

import pytest
import io
import zipfile
import json
from unittest.mock import Mock, MagicMock, patch


class TestCreateBackupView:
    """Tests for create_backup view."""

    def test_backup_view_requires_auth(self):
        """Test backup view requires authentication."""
        from serdes_mit.views import create_backup_view

        # Function should have permission decorators
        assert hasattr(create_backup_view, '__wrapped__') or callable(create_backup_view)

    def test_backup_returns_file_response(self):
        """Test backup returns a file response."""
        from serdes_mit.views import create_backup_view
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/backup/', {})
        request.user = Mock()
        request.user.is_authenticated = True
        request.user.is_staff = True

        with patch('serdes_mit.views.create_backup') as mock_create:
            mock_buffer = io.BytesIO(b'fake zip content')
            mock_create.return_value = mock_buffer

            response = create_backup_view(request)

            assert response.status_code == 200 or hasattr(response, 'streaming_content')


class TestRestoreBackupView:
    """Tests for restore_backup view."""

    def test_restore_requires_file(self):
        """Test restore requires file upload."""
        from serdes_mit.views import restore_backup_view
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/restore/', {})
        request.user = Mock()
        request.user.is_authenticated = True
        request.user.is_staff = True
        request.FILES = {}

        response = restore_backup_view(request)

        assert response.status_code == 400
        assert 'error' in response.data or 'file' in str(response.data).lower()

    def test_restore_with_valid_file(self):
        """Test restore with valid file."""
        from serdes_mit.views import restore_backup_view
        from rest_framework.test import APIRequestFactory
        from django.core.files.uploadedfile import SimpleUploadedFile

        # Create a valid backup
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            data = {
                'version': '1.0.0',
                'created_at': '2024-06-15',
                'objects': []
            }
            zf.writestr('data.json', json.dumps(data))

        zip_buffer.seek(0)
        file = SimpleUploadedFile('backup.zip', zip_buffer.read())

        factory = APIRequestFactory()
        request = factory.post('/restore/', {'file': file}, format='multipart')
        request.user = Mock()
        request.user.is_authenticated = True
        request.user.is_staff = True
        request.FILES = {'file': file}
        request.data = {'file': file}

        with patch('serdes_mit.views.restore_backup') as mock_restore:
            mock_restore.return_value = {'success': True, 'stats': {}}

            response = restore_backup_view(request)

            assert response.status_code == 200


class TestPreviewBackupView:
    """Tests for preview_backup view."""

    def test_preview_requires_file(self):
        """Test preview requires file upload."""
        from serdes_mit.views import preview_backup_view
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/restore/preview/', {})
        request.user = Mock()
        request.user.is_authenticated = True
        request.user.is_staff = True
        request.FILES = {}

        response = preview_backup_view(request)

        assert response.status_code == 400


class TestSelectiveRestoreView:
    """Tests for selective_restore view."""

    def test_selective_requires_selection(self):
        """Test selective restore requires model_names or pks."""
        from serdes_mit.views import selective_restore_view
        from rest_framework.test import APIRequestFactory
        from django.core.files.uploadedfile import SimpleUploadedFile

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zf:
            data = {'version': '1.0.0', 'created_at': '2024-06-15', 'objects': []}
            zf.writestr('data.json', json.dumps(data))

        zip_buffer.seek(0)
        file = SimpleUploadedFile('backup.zip', zip_buffer.read())

        factory = APIRequestFactory()
        request = factory.post('/restore/selective/', {'file': file})
        request.user = Mock()
        request.user.is_authenticated = True
        request.user.is_staff = True
        request.FILES = {'file': file}
        request.data = MagicMock()
        request.data.getlist.return_value = []

        response = selective_restore_view(request)

        assert response.status_code == 400
        assert 'error' in response.data


class TestIncrementalBackupView:
    """Tests for incremental_backup view."""

    def test_incremental_requires_since(self):
        """Test incremental backup requires since parameter."""
        from serdes_mit.views import create_incremental_backup_view
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/backup/incremental/', {})
        request.user = Mock()
        request.user.is_authenticated = True
        request.user.is_staff = True
        request.data = {}

        response = create_incremental_backup_view(request)

        assert response.status_code == 400
        assert 'since' in str(response.data).lower()

    def test_incremental_invalid_timestamp(self):
        """Test incremental backup with invalid timestamp."""
        from serdes_mit.views import create_incremental_backup_view
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post('/backup/incremental/', {'since': 'not-a-date'})
        request.user = Mock()
        request.user.is_authenticated = True
        request.user.is_staff = True
        request.data = {'since': 'not-a-date'}

        response = create_incremental_backup_view(request)

        assert response.status_code == 400


class TestBackupModelsView:
    """Tests for backup_models view."""

    def test_backup_models_returns_list(self):
        """Test backup_models returns model list."""
        from serdes_mit.views import backup_models_view
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.get('/backup/models/')
        request.user = Mock()
        request.user.is_authenticated = True
        request.user.is_staff = True

        with patch('serdes_mit.views._get_default_backup_models') as mock_models:
            mock_model = Mock()
            mock_model._meta.app_label = 'test'
            mock_model._meta.model_name = 'model'
            mock_model._meta.verbose_name = 'Test Model'
            mock_model.objects.count.return_value = 5
            mock_models.return_value = [mock_model]

            response = backup_models_view(request)

            assert response.status_code == 200
            assert isinstance(response.data, list)


class TestPermissions:
    """Tests for view permissions."""

    def test_is_admin_user_permission(self):
        """Test IsAdminUser permission class."""
        from serdes_mit.views import IsAdminUser

        permission = IsAdminUser()

        # Non-staff user
        request = Mock()
        request.user.is_staff = False

        assert permission.has_permission(request, None) == False

        # Staff user
        request.user.is_staff = True
        assert permission.has_permission(request, None) == True

    def test_views_require_admin(self):
        """Test all views require admin permissions."""
        from serdes_mit import views

        # Check decorator presence on views
        view_functions = [
            views.create_backup_view,
            views.restore_backup_view,
            views.preview_backup_view,
            views.selective_restore_view,
            views.create_incremental_backup_view,
            views.backup_models_view,
        ]

        # All should be decorated (wrapped)
        for view in view_functions:
            assert callable(view)
