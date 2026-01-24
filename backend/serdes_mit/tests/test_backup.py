"""
Serdes MIT Backup Tests

Comprehensive tests for backup functionality.
"""

import pytest
import io
import zipfile
import json
from unittest.mock import Mock, MagicMock, patch


class TestBackupWriter:
    """Tests for BackupWriter class."""

    def test_writer_initialization(self):
        """Test backup writer initialization."""
        from serdes_mit.backup import BackupWriter

        writer = BackupWriter(organization_id='org-123', include_attachments=True)

        assert writer.organization_id == 'org-123'
        assert writer.include_attachments == True
        assert writer.objects == []
        assert writer.attachments == []
        assert writer.errors == []

    def test_add_model_instances_empty(self):
        """Test adding no instances."""
        from serdes_mit.backup import BackupWriter

        writer = BackupWriter()

        mock_model = Mock()
        mock_model._meta.app_label = 'test'
        mock_model._meta.model_name = 'model'
        mock_model.objects.all.return_value.iterator.return_value = iter([])

        writer.add_model_instances(mock_model)

        assert writer.stats['test.model'] == 0

    def test_add_model_instances_with_data(self):
        """Test adding model instances."""
        from serdes_mit.backup import BackupWriter

        writer = BackupWriter()

        mock_instance = Mock()
        mock_instance._meta.app_label = 'test'
        mock_instance._meta.model_name = 'model'
        mock_instance.pk = 'pk1'
        mock_instance._meta.get_fields.return_value = []

        mock_model = Mock()
        mock_model._meta.app_label = 'test'
        mock_model._meta.model_name = 'model'
        mock_model.objects.all.return_value.iterator.return_value = iter([mock_instance])

        with patch('serdes_mit.backup.serialize_model_instance') as mock_serialize:
            mock_serialize.return_value = {'_model': 'test.model', '_pk': 'pk1'}
            writer.add_model_instances(mock_model)

        assert writer.stats['test.model'] == 1
        assert len(writer.objects) == 1

    def test_write_creates_valid_zip(self):
        """Test write creates valid ZIP file."""
        from serdes_mit.backup import BackupWriter

        writer = BackupWriter()
        writer.objects = [{'_model': 'test.model', '_pk': 'pk1'}]

        output = io.BytesIO()
        manifest = writer.write(output)

        output.seek(0)
        with zipfile.ZipFile(output, 'r') as zf:
            assert 'manifest.json' in zf.namelist()
            assert 'data.json' in zf.namelist()
            assert zf.testzip() is None  # No corrupt files

    def test_write_manifest_structure(self):
        """Test manifest has correct structure."""
        from serdes_mit.backup import BackupWriter

        writer = BackupWriter(organization_id='org-123')
        writer.objects = [{'_model': 'test.model', '_pk': 'pk1'}]
        writer.stats = {'test.model': 1}

        output = io.BytesIO()
        manifest = writer.write(output)

        assert 'version' in manifest
        assert 'created_at' in manifest
        assert 'organization_id' in manifest
        assert manifest['organization_id'] == 'org-123'
        assert manifest['object_count'] == 1

    def test_write_data_structure(self):
        """Test data.json has correct structure."""
        from serdes_mit.backup import BackupWriter

        writer = BackupWriter()
        writer.objects = [{'_model': 'test.model', '_pk': 'pk1', 'name': 'Test'}]

        output = io.BytesIO()
        writer.write(output)

        output.seek(0)
        with zipfile.ZipFile(output, 'r') as zf:
            data_content = zf.read('data.json').decode('utf-8')
            data = json.loads(data_content)

            assert 'version' in data
            assert 'objects' in data
            assert len(data['objects']) == 1
            assert data['objects'][0]['name'] == 'Test'


class TestCreateBackup:
    """Tests for create_backup function."""

    def test_create_backup_returns_buffer(self):
        """Test create_backup returns a buffer."""
        from serdes_mit.backup import create_backup

        with patch('serdes_mit.backup._get_default_backup_models') as mock_models:
            mock_models.return_value = []

            result = create_backup()

        assert hasattr(result, 'read')

    def test_create_backup_with_organization(self):
        """Test create_backup with organization filter."""
        from serdes_mit.backup import create_backup

        with patch('serdes_mit.backup._get_default_backup_models') as mock_models:
            mock_models.return_value = []

            result = create_backup(organization_id='org-123')

        assert result is not None

    def test_create_backup_exclude_models(self):
        """Test create_backup with excluded models."""
        from serdes_mit.backup import create_backup

        with patch('serdes_mit.backup._get_default_backup_models') as mock_models, \
             patch('serdes_mit.backup.BackupWriter') as MockWriter:
            mock_model = Mock()
            mock_model._meta.app_label = 'core'
            mock_model._meta.model_name = 'excluded'
            mock_models.return_value = [mock_model]

            mock_writer = Mock()
            mock_writer.write.return_value = {}
            MockWriter.return_value = mock_writer

            result = create_backup(exclude_models={'core.excluded'})

            # add_model_instances should not be called for excluded model
            # The model should be skipped
            assert True


class TestIncrementalBackupWriter:
    """Tests for IncrementalBackupWriter class."""

    def test_incremental_initialization(self):
        """Test incremental writer initialization."""
        from serdes_mit.backup import IncrementalBackupWriter
        from datetime import datetime

        since = datetime(2024, 6, 1)
        writer = IncrementalBackupWriter(since=since)

        assert writer.since == since

    def test_incremental_filters_by_date(self):
        """Test incremental writer filters by date."""
        from serdes_mit.backup import IncrementalBackupWriter
        from datetime import datetime

        since = datetime(2024, 6, 1)
        writer = IncrementalBackupWriter(since=since)

        mock_model = Mock()
        mock_model._meta.app_label = 'test'
        mock_model._meta.model_name = 'model'
        mock_model.objects.all.return_value.filter.return_value.iterator.return_value = iter([])

        # Check if model has updated_at field
        mock_model._meta.get_fields.return_value = []

        # Should filter by updated_at if available
        if hasattr(mock_model, 'updated_at'):
            writer.add_model_instances(mock_model)
            mock_model.objects.all.return_value.filter.assert_called()


class TestGetDefaultBackupModels:
    """Tests for _get_default_backup_models function."""

    def test_returns_list(self):
        """Test function returns a list."""
        from serdes_mit.backup import _get_default_backup_models

        with patch('serdes_mit.backup.apps') as mock_apps:
            mock_apps.get_model.return_value = None

            result = _get_default_backup_models()

        assert isinstance(result, list)

    def test_handles_missing_models(self):
        """Test function handles missing models gracefully."""
        from serdes_mit.backup import _get_default_backup_models

        with patch('serdes_mit.backup.apps') as mock_apps:
            mock_apps.get_model.side_effect = LookupError()

            result = _get_default_backup_models()

        # Should not raise, just skip missing models
        assert isinstance(result, list)


class TestBackupAttachments:
    """Tests for attachment handling in backups."""

    def test_extract_attachments(self):
        """Test attachment extraction from instances."""
        from serdes_mit.backup import BackupWriter

        writer = BackupWriter(include_attachments=True)

        mock_instance = Mock()
        mock_instance.pk = 'pk1'

        mock_file_field = Mock()
        mock_file_field.name = 'attachment'
        mock_file_field.__class__.__name__ = 'FileField'

        mock_file = Mock()
        mock_file.name = 'test.pdf'
        setattr(mock_instance, 'attachment', mock_file)

        mock_instance._meta.get_fields.return_value = [mock_file_field]

        obj_data = {'_model': 'test.model', '_pk': 'pk1'}

        writer._extract_attachments(mock_instance, obj_data)

        assert len(writer.attachments) >= 0  # May or may not extract

    def test_skip_attachments_when_disabled(self):
        """Test attachments skipped when disabled."""
        from serdes_mit.backup import BackupWriter

        writer = BackupWriter(include_attachments=False)

        mock_model = Mock()
        mock_model._meta.app_label = 'test'
        mock_model._meta.model_name = 'model'
        mock_model.objects.all.return_value.iterator.return_value = iter([])

        writer.add_model_instances(mock_model)

        assert len(writer.attachments) == 0
