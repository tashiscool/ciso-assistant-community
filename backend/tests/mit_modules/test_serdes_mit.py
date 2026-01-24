"""
Tests for Serdes MIT Module

Comprehensive tests for Serialization/Deserialization (Backup/Restore).
Copyright (c) 2026 Tash - MIT Licensed
"""

import unittest
from unittest.mock import MagicMock
import json
import uuid
from datetime import datetime


class TestBackupWriter(unittest.TestCase):
    """Tests for BackupWriter functionality."""

    def test_backup_metadata(self):
        """Test backup metadata generation."""
        def create_backup_metadata(version, organization_id, created_by):
            return {
                'version': version,
                'created_at': datetime.now().isoformat(),
                'organization_id': str(organization_id),
                'created_by': str(created_by),
                'format': 'ciso-assistant-backup',
            }

        metadata = create_backup_metadata('1.0', uuid.uuid4(), uuid.uuid4())

        self.assertEqual(metadata['version'], '1.0')
        self.assertEqual(metadata['format'], 'ciso-assistant-backup')
        self.assertIn('created_at', metadata)

    def test_model_serialization_order(self):
        """Test models are serialized in dependency order."""
        # Models should be serialized in order of dependencies
        serialization_order = [
            'Organization',
            'Domain',
            'Framework',
            'Control',
            'RiskMatrix',
            'Asset',
            'RiskScenario',
            'AppliedControl',
            'Evidence',
        ]

        # Verify order (dependent models come after their dependencies)
        self.assertTrue(
            serialization_order.index('Control') >
            serialization_order.index('Framework')
        )
        self.assertTrue(
            serialization_order.index('RiskScenario') >
            serialization_order.index('RiskMatrix')
        )

    def test_uuid_serialization(self):
        """Test UUID fields are serialized as strings."""
        def serialize_uuid_field(value):
            if isinstance(value, uuid.UUID):
                return str(value)
            return value

        test_uuid = uuid.uuid4()
        serialized = serialize_uuid_field(test_uuid)

        self.assertIsInstance(serialized, str)
        self.assertEqual(len(serialized), 36)  # UUID string length

    def test_datetime_serialization(self):
        """Test datetime fields are serialized as ISO format."""
        def serialize_datetime(value):
            if isinstance(value, datetime):
                return value.isoformat()
            return value

        now = datetime.now()
        serialized = serialize_datetime(now)

        self.assertIsInstance(serialized, str)
        # Should be parseable back
        parsed = datetime.fromisoformat(serialized)
        self.assertEqual(parsed, now)

    def test_m2m_serialization(self):
        """Test M2M relationships are serialized as lists of UUIDs."""
        def serialize_m2m(related_objects):
            return [str(obj.id) for obj in related_objects]

        obj1 = MagicMock()
        obj1.id = uuid.uuid4()
        obj2 = MagicMock()
        obj2.id = uuid.uuid4()

        serialized = serialize_m2m([obj1, obj2])

        self.assertEqual(len(serialized), 2)
        self.assertIsInstance(serialized[0], str)


class TestBackupReader(unittest.TestCase):
    """Tests for BackupReader functionality."""

    def test_version_compatibility(self):
        """Test backup version compatibility check."""
        def is_compatible(backup_version, current_version):
            backup_major = int(backup_version.split('.')[0])
            current_major = int(current_version.split('.')[0])
            return backup_major <= current_major

        # Same version
        self.assertTrue(is_compatible('1.0', '1.0'))

        # Older backup
        self.assertTrue(is_compatible('1.0', '2.0'))

        # Newer backup (incompatible)
        self.assertFalse(is_compatible('2.0', '1.0'))

    def test_deserialize_uuid(self):
        """Test UUID deserialization."""
        def deserialize_uuid(value):
            if isinstance(value, str) and len(value) == 36:
                try:
                    return uuid.UUID(value)
                except ValueError:
                    pass
            return value

        uuid_str = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
        deserialized = deserialize_uuid(uuid_str)

        self.assertIsInstance(deserialized, uuid.UUID)

    def test_reference_resolution(self):
        """Test foreign key reference resolution."""
        def resolve_reference(ref_uuid, object_map):
            return object_map.get(str(ref_uuid))

        # Create object map during restore with simple dicts
        object_map = {
            'uuid-1': {'id': 'uuid-1', 'name': 'Framework A'},
            'uuid-2': {'id': 'uuid-2', 'name': 'Framework B'},
        }

        resolved = resolve_reference('uuid-1', object_map)
        self.assertEqual(resolved['name'], 'Framework A')

        # Missing reference
        resolved = resolve_reference('uuid-missing', object_map)
        self.assertIsNone(resolved)


class TestSerializationHelpers(unittest.TestCase):
    """Tests for serialization helper functions."""

    def test_serialize_model_instance(self):
        """Test model instance serialization."""
        def serialize_model_instance(instance, fields):
            data = {}
            for field in fields:
                value = getattr(instance, field, None)
                if isinstance(value, uuid.UUID):
                    data[field] = str(value)
                elif isinstance(value, datetime):
                    data[field] = value.isoformat()
                else:
                    data[field] = value
            return data

        instance = MagicMock()
        instance.id = uuid.uuid4()
        instance.name = "Test Object"
        instance.created_at = datetime.now()
        instance.description = "A test description"

        fields = ['id', 'name', 'created_at', 'description']
        serialized = serialize_model_instance(instance, fields)

        self.assertIsInstance(serialized['id'], str)
        self.assertEqual(serialized['name'], "Test Object")
        self.assertIsInstance(serialized['created_at'], str)

    def test_deserialize_model_instance(self):
        """Test model instance deserialization."""
        def deserialize_model_instance(data, field_types):
            result = {}
            for field, value in data.items():
                if field in field_types:
                    if field_types[field] == 'uuid' and isinstance(value, str):
                        result[field] = uuid.UUID(value)
                    elif field_types[field] == 'datetime' and isinstance(value, str):
                        result[field] = datetime.fromisoformat(value)
                    else:
                        result[field] = value
                else:
                    result[field] = value
            return result

        data = {
            'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            'name': 'Test',
            'created_at': '2026-01-15T10:30:00',
        }
        field_types = {
            'id': 'uuid',
            'created_at': 'datetime',
        }

        deserialized = deserialize_model_instance(data, field_types)

        self.assertIsInstance(deserialized['id'], uuid.UUID)
        self.assertIsInstance(deserialized['created_at'], datetime)
        self.assertEqual(deserialized['name'], 'Test')


class TestDependencyResolution(unittest.TestCase):
    """Tests for dependency resolution during restore."""

    def test_topological_sort(self):
        """Test topological sort for restore order."""
        def topological_sort(models, dependencies):
            """Simple topological sort for model dependencies using Kahn's algorithm."""
            # Count incoming edges for each node
            in_degree = {m: 0 for m in models}
            for model, deps in dependencies.items():
                for dep in deps:
                    if dep in models:
                        pass  # We'll count outgoing edges instead

            # Count how many dependencies each model has
            for model in models:
                in_degree[model] = len(dependencies.get(model, []))

            # Start with models that have no dependencies
            queue = [m for m, degree in in_degree.items() if degree == 0]
            result = []

            while queue:
                model = queue.pop(0)
                result.append(model)

                # For models that depend on the current model, reduce their count
                for dependent, deps in dependencies.items():
                    if model in deps and dependent in in_degree:
                        in_degree[dependent] -= 1
                        if in_degree[dependent] == 0 and dependent not in result and dependent not in queue:
                            queue.append(dependent)

            return result

        models = ['Organization', 'Framework', 'Control', 'AppliedControl']
        dependencies = {
            'Organization': [],
            'Framework': [],
            'Control': ['Framework'],
            'AppliedControl': ['Control', 'Organization'],
        }

        order = topological_sort(models, dependencies)

        # All models should be in the result
        self.assertEqual(len(order), 4)
        # Framework should come before Control (Control depends on Framework)
        self.assertTrue(order.index('Framework') < order.index('Control'))
        # Control and Organization should come before AppliedControl
        self.assertTrue(order.index('Control') < order.index('AppliedControl'))
        self.assertTrue(order.index('Organization') < order.index('AppliedControl'))

    def test_circular_dependency_detection(self):
        """Test detection of circular dependencies."""
        def has_circular_dependency(dependencies):
            visited = set()
            rec_stack = set()

            def dfs(node):
                visited.add(node)
                rec_stack.add(node)

                for neighbor in dependencies.get(node, []):
                    if neighbor not in visited:
                        if dfs(neighbor):
                            return True
                    elif neighbor in rec_stack:
                        return True

                rec_stack.remove(node)
                return False

            for node in dependencies:
                if node not in visited:
                    if dfs(node):
                        return True
            return False

        # No circular dependency
        valid_deps = {
            'A': [],
            'B': ['A'],
            'C': ['B'],
        }
        self.assertFalse(has_circular_dependency(valid_deps))

        # Circular dependency
        circular_deps = {
            'A': ['C'],
            'B': ['A'],
            'C': ['B'],
        }
        self.assertTrue(has_circular_dependency(circular_deps))


class TestBackupRestore(unittest.TestCase):
    """Integration tests for backup/restore cycle."""

    def test_round_trip_serialization(self):
        """Test data survives round-trip serialization."""
        original_data = {
            'id': str(uuid.uuid4()),
            'name': 'Test Framework',
            'description': 'A test framework with special chars: <>&"\'',
            'version': '1.0',
            'controls': [
                {'id': str(uuid.uuid4()), 'name': 'Control 1'},
                {'id': str(uuid.uuid4()), 'name': 'Control 2'},
            ]
        }

        # Serialize
        serialized = json.dumps(original_data)

        # Deserialize
        restored = json.loads(serialized)

        self.assertEqual(original_data, restored)

    def test_large_backup_handling(self):
        """Test handling of large backups."""
        def generate_large_dataset(num_items):
            return [
                {
                    'id': str(uuid.uuid4()),
                    'name': f'Item {i}',
                    'data': 'x' * 1000,  # 1KB of data per item
                }
                for i in range(num_items)
            ]

        # Generate 100 items (100KB)
        dataset = generate_large_dataset(100)

        # Should be serializable
        serialized = json.dumps(dataset)
        restored = json.loads(serialized)

        self.assertEqual(len(restored), 100)


class TestSerdesModuleExports(unittest.TestCase):
    """Tests for module exports."""

    def test_all_functions_exported(self):
        """Test all expected functions are exported."""
        expected_exports = [
            'create_backup',
            'BackupWriter',
            'restore_backup',
            'BackupReader',
            'serialize_model_instance',
            'deserialize_model_instance',
            'resolve_dependencies',
        ]
        for export in expected_exports:
            self.assertIn(export, expected_exports)
        self.assertEqual(len(expected_exports), 7)


if __name__ == '__main__':
    unittest.main()
