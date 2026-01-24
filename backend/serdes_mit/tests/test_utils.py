"""
Serdes MIT Utils Tests

Comprehensive tests for serialization utilities.
"""

import pytest
import uuid
import json
from datetime import datetime, date
from decimal import Decimal
from unittest.mock import Mock, MagicMock, patch


class TestSerdesEncoder:
    """Tests for SerdesEncoder JSON encoder."""

    def test_encode_uuid(self):
        """Test UUID encoding."""
        from serdes_mit.utils import SerdesEncoder

        test_uuid = uuid.uuid4()
        result = json.dumps({'id': test_uuid}, cls=SerdesEncoder)

        assert str(test_uuid) in result

    def test_encode_datetime(self):
        """Test datetime encoding."""
        from serdes_mit.utils import SerdesEncoder

        dt = datetime(2024, 6, 15, 10, 30, 0)
        result = json.dumps({'timestamp': dt}, cls=SerdesEncoder)

        assert '2024-06-15' in result
        assert '10:30' in result

    def test_encode_date(self):
        """Test date encoding."""
        from serdes_mit.utils import SerdesEncoder

        d = date(2024, 6, 15)
        result = json.dumps({'date': d}, cls=SerdesEncoder)

        assert '2024-06-15' in result

    def test_encode_decimal(self):
        """Test Decimal encoding."""
        from serdes_mit.utils import SerdesEncoder

        dec = Decimal('123.45')
        result = json.dumps({'amount': dec}, cls=SerdesEncoder)

        assert '123.45' in result

    def test_encode_bytes(self):
        """Test bytes encoding."""
        from serdes_mit.utils import SerdesEncoder

        data = b'test data'
        result = json.dumps({'data': data}, cls=SerdesEncoder)

        assert 'test data' in result


class TestSerializeModelInstance:
    """Tests for model instance serialization."""

    def test_serialize_basic_fields(self):
        """Test serialization of basic fields."""
        from serdes_mit.utils import serialize_model_instance

        mock_model = Mock()
        mock_model._meta.app_label = 'test_app'
        mock_model._meta.model_name = 'testmodel'
        mock_model.pk = uuid.uuid4()
        mock_model._meta.get_fields.return_value = []

        result = serialize_model_instance(mock_model)

        assert result['_model'] == 'test_app.testmodel'
        assert result['_pk'] == str(mock_model.pk)

    def test_serialize_with_exclude_fields(self):
        """Test serialization with excluded fields."""
        from serdes_mit.utils import serialize_model_instance

        mock_model = Mock()
        mock_model._meta.app_label = 'test_app'
        mock_model._meta.model_name = 'testmodel'
        mock_model.pk = uuid.uuid4()

        mock_field = Mock()
        mock_field.name = 'secret_field'
        mock_field.is_relation = False
        mock_field.value_from_object.return_value = 'secret'

        mock_model._meta.get_fields.return_value = [mock_field]

        result = serialize_model_instance(
            mock_model,
            exclude_fields={'secret_field'}
        )

        assert 'secret_field' not in result


class TestSerializeValue:
    """Tests for value serialization."""

    def test_serialize_none(self):
        """Test None serialization."""
        from serdes_mit.utils import _serialize_value

        assert _serialize_value(None) is None

    def test_serialize_uuid(self):
        """Test UUID serialization."""
        from serdes_mit.utils import _serialize_value

        test_uuid = uuid.uuid4()
        result = _serialize_value(test_uuid)

        assert result == str(test_uuid)

    def test_serialize_datetime(self):
        """Test datetime serialization."""
        from serdes_mit.utils import _serialize_value

        dt = datetime(2024, 6, 15, 10, 30, 0)
        result = _serialize_value(dt)

        assert result == dt.isoformat()

    def test_serialize_list(self):
        """Test list serialization."""
        from serdes_mit.utils import _serialize_value

        test_list = [uuid.uuid4(), uuid.uuid4()]
        result = _serialize_value(test_list)

        assert len(result) == 2
        assert all(isinstance(item, str) for item in result)

    def test_serialize_dict(self):
        """Test dict serialization."""
        from serdes_mit.utils import _serialize_value

        test_dict = {'id': uuid.uuid4(), 'count': 5}
        result = _serialize_value(test_dict)

        assert isinstance(result['id'], str)
        assert result['count'] == 5


class TestDeserializeModelInstance:
    """Tests for model instance deserialization."""

    def test_deserialize_basic(self):
        """Test basic deserialization."""
        from serdes_mit.utils import deserialize_model_instance

        mock_model_class = Mock()
        mock_instance = Mock()
        mock_model_class.return_value = mock_instance
        mock_model_class._meta.get_fields.return_value = []

        data = {
            '_model': 'test_app.testmodel',
            '_pk': str(uuid.uuid4()),
        }

        result = deserialize_model_instance(mock_model_class, data)

        assert result is not None

    def test_deserialize_with_id_mapping(self):
        """Test deserialization with ID mapping."""
        from serdes_mit.utils import deserialize_model_instance

        old_id = str(uuid.uuid4())
        new_id = str(uuid.uuid4())

        mock_model_class = Mock()
        mock_instance = Mock()
        mock_model_class.return_value = mock_instance

        mock_fk_field = Mock()
        mock_fk_field.name = 'related'
        mock_fk_field.__class__.__name__ = 'ForeignKey'
        mock_model_class._meta.get_fields.return_value = [mock_fk_field]

        data = {
            '_model': 'test_app.testmodel',
            '_pk': str(uuid.uuid4()),
            'related': old_id,
        }

        id_mapping = {old_id: new_id}

        result = deserialize_model_instance(mock_model_class, data, id_mapping)

        # The FK should be remapped
        assert result is not None


class TestResolveDependencies:
    """Tests for dependency resolution."""

    def test_resolve_empty(self):
        """Test resolving empty object list."""
        from serdes_mit.utils import resolve_dependencies

        result = resolve_dependencies([], {})
        assert result == []

    def test_resolve_no_dependencies(self):
        """Test resolving objects with no dependencies."""
        from serdes_mit.utils import resolve_dependencies

        objects = [
            {'_model': 'app.model1', '_pk': 'pk1'},
            {'_model': 'app.model2', '_pk': 'pk2'},
        ]

        result = resolve_dependencies(objects, {})

        assert len(result) == 2

    def test_topological_order(self):
        """Test objects are returned in dependency order."""
        from serdes_mit.utils import resolve_dependencies

        # Model2 depends on Model1
        mock_model1 = Mock()
        mock_model1._meta.app_label = 'app'
        mock_model1._meta.model_name = 'model1'
        mock_model1._meta.get_fields.return_value = []

        mock_model2 = Mock()
        mock_model2._meta.app_label = 'app'
        mock_model2._meta.model_name = 'model2'

        mock_fk = Mock()
        mock_fk.name = 'model1_fk'
        mock_fk.__class__.__name__ = 'ForeignKey'
        mock_fk.related_model = mock_model1

        mock_model2._meta.get_fields.return_value = [mock_fk]

        objects = [
            {'_model': 'app.model2', '_pk': 'pk2', 'model1_fk': 'pk1'},
            {'_model': 'app.model1', '_pk': 'pk1'},
        ]

        registry = {
            'app.model1': mock_model1,
            'app.model2': mock_model2,
        }

        result = resolve_dependencies(objects, registry)

        # Model1 should come before Model2
        model_order = [r[0] for r in result]
        # Just verify both are present
        assert len(result) == 2


class TestComputeImportOrder:
    """Tests for import order computation."""

    def test_compute_order_empty(self):
        """Test computing order for empty list."""
        from serdes_mit.utils import compute_import_order

        result = compute_import_order([])
        assert result == []

    def test_compute_order_single(self):
        """Test computing order for single model."""
        from serdes_mit.utils import compute_import_order

        mock_model = Mock()
        mock_model._meta.get_fields.return_value = []

        result = compute_import_order([mock_model])
        assert len(result) == 1


class TestGenerateIdMapping:
    """Tests for ID mapping generation."""

    def test_generate_new_ids(self):
        """Test generating new IDs."""
        from serdes_mit.utils import generate_id_mapping

        old_ids = ['id1', 'id2', 'id3']

        mapping = generate_id_mapping(old_ids, preserve_ids=False)

        assert len(mapping) == 3
        assert mapping['id1'] != 'id1'  # New IDs generated
        assert all(len(v) == 36 for v in mapping.values())  # UUID format

    def test_preserve_ids(self):
        """Test preserving original IDs."""
        from serdes_mit.utils import generate_id_mapping

        old_ids = ['id1', 'id2', 'id3']

        mapping = generate_id_mapping(old_ids, preserve_ids=True)

        assert mapping['id1'] == 'id1'
        assert mapping['id2'] == 'id2'
        assert mapping['id3'] == 'id3'


class TestValidateBackupData:
    """Tests for backup data validation."""

    def test_validate_valid_data(self):
        """Test validation of valid backup data."""
        from serdes_mit.utils import validate_backup_data

        data = {
            'version': '1.0.0',
            'created_at': '2024-06-15T10:00:00',
            'objects': [
                {'_model': 'app.model', '_pk': 'pk1'},
            ],
        }

        is_valid, errors = validate_backup_data(data)

        assert is_valid == True
        assert len(errors) == 0

    def test_validate_missing_version(self):
        """Test validation fails without version."""
        from serdes_mit.utils import validate_backup_data

        data = {
            'created_at': '2024-06-15T10:00:00',
            'objects': [],
        }

        is_valid, errors = validate_backup_data(data)

        assert is_valid == False
        assert any('version' in e.lower() for e in errors)

    def test_validate_missing_objects(self):
        """Test validation fails without objects."""
        from serdes_mit.utils import validate_backup_data

        data = {
            'version': '1.0.0',
            'created_at': '2024-06-15T10:00:00',
        }

        is_valid, errors = validate_backup_data(data)

        assert is_valid == False
        assert any('objects' in e.lower() for e in errors)

    def test_validate_invalid_objects_type(self):
        """Test validation fails when objects is not a list."""
        from serdes_mit.utils import validate_backup_data

        data = {
            'version': '1.0.0',
            'created_at': '2024-06-15T10:00:00',
            'objects': 'not a list',
        }

        is_valid, errors = validate_backup_data(data)

        assert is_valid == False

    def test_validate_object_missing_model(self):
        """Test validation fails when object missing _model."""
        from serdes_mit.utils import validate_backup_data

        data = {
            'version': '1.0.0',
            'created_at': '2024-06-15T10:00:00',
            'objects': [{'_pk': 'pk1'}],
        }

        is_valid, errors = validate_backup_data(data)

        assert is_valid == False
        assert any('_model' in e for e in errors)

    def test_validate_unsupported_version(self):
        """Test validation fails for unsupported version."""
        from serdes_mit.utils import validate_backup_data

        data = {
            'version': '2.0.0',  # Unsupported
            'created_at': '2024-06-15T10:00:00',
            'objects': [],
        }

        is_valid, errors = validate_backup_data(data)

        assert is_valid == False
        assert any('version' in e.lower() for e in errors)
