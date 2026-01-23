"""
Tests for custom DDD fields
"""

import uuid
from django.test import TestCase
from django.core.exceptions import ValidationError

from core.domain.fields import EmbeddedIdArrayField


class EmbeddedIdArrayFieldTests(TestCase):
    """Tests for EmbeddedIdArrayField"""

    def test_field_creation(self):
        """Test creating a field"""
        field = EmbeddedIdArrayField()
        self.assertIsNotNone(field)
        self.assertEqual(field.default, list)
        self.assertTrue(field.blank)

    def test_field_with_base_field_param(self):
        """Test creating field with base_field parameter (backward compatibility)"""
        # base_field is accepted but ignored (for backward compatibility with ArrayField signature)
        from django.db import models
        field = EmbeddedIdArrayField(base_field=models.UUIDField())
        self.assertIsNotNone(field)

    def test_validate_uuid_array(self):
        """Test validation of UUID array"""
        field = EmbeddedIdArrayField()
        field.name = "controlIds"

        # Valid UUIDs should pass validation
        valid_uuids = [uuid.uuid4(), uuid.uuid4()]
        field.validate(valid_uuids, None)  # Should not raise

        # Invalid values should raise ValidationError
        invalid_values = ["not-a-uuid"]
        with self.assertRaises(ValidationError):
            field.validate(invalid_values, None)

    def test_validate_empty_array(self):
        """Test validation of empty array"""
        field = EmbeddedIdArrayField()
        field.name = "controlIds"

        # Empty array should be valid
        field.validate([], None)  # Should not raise

    def test_validate_none(self):
        """Test validation of None value"""
        field = EmbeddedIdArrayField()
        field.name = "controlIds"

        # None should pass validation (field allows null)
        field.validate(None, None)  # Should not raise

    def test_validate_string_uuids(self):
        """Test validation of string UUIDs"""
        field = EmbeddedIdArrayField()
        field.name = "controlIds"

        # String UUIDs should be valid
        string_uuids = [str(uuid.uuid4()), str(uuid.uuid4())]
        field.validate(string_uuids, None)  # Should not raise

    def test_get_prep_value_converts_uuids(self):
        """Test that get_prep_value converts UUIDs to strings"""
        field = EmbeddedIdArrayField()
        uuid1 = uuid.uuid4()
        uuid2 = uuid.uuid4()

        result = field.get_prep_value([uuid1, uuid2])

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0], str(uuid1))
        self.assertEqual(result[1], str(uuid2))

    def test_get_prep_value_none(self):
        """Test get_prep_value with None returns empty list"""
        field = EmbeddedIdArrayField()
        result = field.get_prep_value(None)
        self.assertEqual(result, [])

    def test_from_db_value_list(self):
        """Test from_db_value with list"""
        field = EmbeddedIdArrayField()
        result = field.from_db_value([str(uuid.uuid4())], None, None)
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)

    def test_from_db_value_none(self):
        """Test from_db_value with None returns empty list"""
        field = EmbeddedIdArrayField()
        result = field.from_db_value(None, None, None)
        self.assertEqual(result, [])

    def test_from_db_value_json_string(self):
        """Test from_db_value with JSON string"""
        field = EmbeddedIdArrayField()
        uuid1 = str(uuid.uuid4())
        result = field.from_db_value(f'["{uuid1}"]', None, None)
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0], uuid1)

    def test_deconstruct(self):
        """Test field deconstruction for migrations"""
        field = EmbeddedIdArrayField()
        name, path, args, kwargs = field.deconstruct()

        self.assertEqual(path, 'core.domain.fields.EmbeddedIdArrayField')
        # default=list should be removed from kwargs (added back in __init__)
        self.assertNotIn('default', kwargs)
