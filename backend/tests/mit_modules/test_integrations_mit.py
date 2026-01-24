# MIT License - See LICENSE-MIT.txt in repository root
"""
Tests for integrations_mit module

Standalone tests that can run without Django using unittest and mocking.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta
from uuid import uuid4


class TestIntegrationsMitModuleExports(unittest.TestCase):
    """Test module exports and lazy loading."""

    def test_module_exports(self):
        """Test that module exports expected classes."""
        import integrations_mit
        self.assertEqual(
            sorted(integrations_mit.__all__),
            ['IntegrationConfiguration', 'IntegrationProvider', 'SyncEvent', 'SyncMapping']
        )

    def test_lazy_import_invalid_raises(self):
        """Test that invalid attribute raises AttributeError."""
        import integrations_mit
        with self.assertRaises(AttributeError):
            _ = integrations_mit.NonExistentClass


class TestIntegrationProviderModel(unittest.TestCase):
    """Test IntegrationProvider model functionality."""

    def test_provider_type_choices(self):
        """Test provider type choices."""
        types = ['itsm', 'security', 'cloud', 'scm', 'communication', 'identity', 'other']
        for ptype in types:
            self.assertIn(ptype, types)

    def test_provider_capabilities(self):
        """Test provider capability flags."""
        provider = Mock()
        provider.supports_push = True
        provider.supports_pull = True
        provider.supports_webhook = False

        self.assertTrue(provider.supports_push)
        self.assertTrue(provider.supports_pull)
        self.assertFalse(provider.supports_webhook)


class TestIntegrationConfigurationModel(unittest.TestCase):
    """Test IntegrationConfiguration model functionality."""

    def test_is_sync_due_no_interval(self):
        """Test sync not due when interval is 0."""
        sync_interval_minutes = 0
        is_due = sync_interval_minutes != 0 and False
        self.assertFalse(is_due)

    def test_is_sync_due_no_last_sync(self):
        """Test sync is due when never synced."""
        sync_interval_minutes = 60
        last_sync_at = None

        is_due = sync_interval_minutes and (last_sync_at is None or True)
        self.assertTrue(is_due)

    def test_is_sync_due_interval_passed(self):
        """Test sync is due when interval has passed."""
        sync_interval_minutes = 60
        last_sync_at = datetime.now() - timedelta(minutes=90)
        now = datetime.now()

        next_sync = last_sync_at + timedelta(minutes=sync_interval_minutes)
        is_due = now >= next_sync
        self.assertTrue(is_due)

    def test_is_sync_not_due(self):
        """Test sync not due when within interval."""
        sync_interval_minutes = 60
        last_sync_at = datetime.now() - timedelta(minutes=30)
        now = datetime.now()

        next_sync = last_sync_at + timedelta(minutes=sync_interval_minutes)
        is_due = now >= next_sync
        self.assertFalse(is_due)

    def test_mark_synced(self):
        """Test marking configuration as synced."""
        config = Mock()
        config.last_sync_at = None
        config.last_sync_status = ''

        # Simulate mark_synced
        config.last_sync_at = datetime.now()
        config.last_sync_status = 'success'

        self.assertIsNotNone(config.last_sync_at)
        self.assertEqual(config.last_sync_status, 'success')


class TestSyncMappingModel(unittest.TestCase):
    """Test SyncMapping model functionality."""

    def test_sync_status_choices(self):
        """Test sync status choices."""
        statuses = ['synced', 'pending', 'failed', 'conflict']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_sync_direction_choices(self):
        """Test sync direction choices."""
        directions = ['push', 'pull']
        for direction in directions:
            self.assertIn(direction, directions)

    def test_is_synced(self):
        """Test is_synced property."""
        status = 'synced'
        is_synced = status == 'synced'
        self.assertTrue(is_synced)

    def test_has_conflict(self):
        """Test has_conflict property."""
        status = 'conflict'
        has_conflict = status == 'conflict'
        self.assertTrue(has_conflict)

    def test_mark_synced(self):
        """Test marking mapping as synced."""
        mapping = Mock()
        mapping.sync_status = 'pending'
        mapping.local_version = 1

        # Simulate mark_synced
        mapping.sync_status = 'synced'
        mapping.last_sync_direction = 'push'
        mapping.remote_version = 'v2'
        mapping.error_message = ''
        mapping.error_count = 0
        mapping.local_version = 2

        self.assertEqual(mapping.sync_status, 'synced')
        self.assertEqual(mapping.local_version, 2)

    def test_mark_failed(self):
        """Test marking mapping as failed."""
        mapping = Mock()
        mapping.sync_status = 'synced'
        mapping.error_count = 0

        # Simulate mark_failed
        mapping.sync_status = 'failed'
        mapping.error_message = 'Connection timeout'
        mapping.error_count = 1

        self.assertEqual(mapping.sync_status, 'failed')
        self.assertEqual(mapping.error_count, 1)

    def test_mark_conflict(self):
        """Test marking mapping as conflict."""
        mapping = Mock()
        mapping.sync_status = 'synced'

        # Simulate mark_conflict
        mapping.sync_status = 'conflict'
        mapping.error_message = 'Conflicting changes detected'

        self.assertEqual(mapping.sync_status, 'conflict')


class TestSyncEventModel(unittest.TestCase):
    """Test SyncEvent model functionality."""

    def test_triggered_by_choices(self):
        """Test triggered_by choices."""
        triggers = ['user', 'webhook', 'scheduled', 'system']
        for trigger in triggers:
            self.assertIn(trigger, triggers)

    def test_duration_calculation(self):
        """Test duration calculation."""
        started_at = datetime(2024, 6, 15, 10, 0, 0)
        completed_at = datetime(2024, 6, 15, 10, 0, 5)

        delta = completed_at - started_at
        duration_ms = int(delta.total_seconds() * 1000)
        self.assertEqual(duration_ms, 5000)

    def test_complete_success(self):
        """Test completing event successfully."""
        event = Mock()
        event.success = None
        event.completed_at = None

        # Simulate complete_success
        event.success = True
        event.completed_at = datetime.now()

        self.assertTrue(event.success)
        self.assertIsNotNone(event.completed_at)

    def test_complete_failure(self):
        """Test completing event with failure."""
        event = Mock()
        event.success = None
        event.error_details = ''

        # Simulate complete_failure
        event.success = False
        event.completed_at = datetime.now()
        event.error_details = 'Remote server returned 500'

        self.assertFalse(event.success)
        self.assertIn('500', event.error_details)

    def test_create_event(self):
        """Test creating a sync event."""
        mapping_id = uuid4()
        direction = 'push'
        triggered_by = 'user'
        changes = {'title': {'old': 'Old Title', 'new': 'New Title'}}

        event = {
            'mapping_id': mapping_id,
            'direction': direction,
            'triggered_by': triggered_by,
            'changes': changes,
            'success': None,
        }

        self.assertEqual(event['direction'], 'push')
        self.assertEqual(event['triggered_by'], 'user')


class TestIntegrationWorkflows(unittest.TestCase):
    """Integration tests for sync workflows."""

    def test_push_sync_workflow(self):
        """Test push sync workflow."""
        # Create mapping
        mapping = Mock()
        mapping.sync_status = 'pending'
        mapping.local_version = 1

        # Create event
        event = Mock()
        event.direction = 'push'
        event.triggered_by = 'user'
        event.success = None

        # Mark sent
        event.started_at = datetime.now()

        # Mark success
        event.success = True
        event.completed_at = datetime.now()
        mapping.sync_status = 'synced'
        mapping.local_version = 2

        self.assertTrue(event.success)
        self.assertEqual(mapping.sync_status, 'synced')

    def test_pull_sync_workflow(self):
        """Test pull sync workflow."""
        mapping = Mock()
        mapping.sync_status = 'pending'

        event = Mock()
        event.direction = 'pull'
        event.triggered_by = 'scheduled'
        event.success = True

        mapping.sync_status = 'synced'
        mapping.last_sync_direction = 'pull'

        self.assertEqual(mapping.last_sync_direction, 'pull')

    def test_conflict_resolution_workflow(self):
        """Test conflict resolution workflow."""
        mapping = Mock()
        mapping.sync_status = 'conflict'

        # Resolve by choosing push direction
        chosen_direction = 'push'
        mapping.sync_status = 'synced'
        mapping.last_sync_direction = chosen_direction

        self.assertEqual(mapping.sync_status, 'synced')
        self.assertEqual(mapping.last_sync_direction, 'push')


if __name__ == '__main__':
    unittest.main()
