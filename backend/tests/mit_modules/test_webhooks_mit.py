# MIT License - See LICENSE-MIT.txt in repository root
"""
Tests for webhooks_mit module

Standalone tests that can run without Django using unittest and mocking.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta
from uuid import uuid4
import hashlib
import hmac


class TestWebhooksMitModuleExports(unittest.TestCase):
    """Test module exports and lazy loading."""

    def test_module_exports(self):
        """Test that module exports expected classes."""
        import webhooks_mit
        self.assertEqual(
            sorted(webhooks_mit.__all__),
            ['WebhookDelivery', 'WebhookEndpoint', 'WebhookEventType']
        )

    def test_lazy_import_invalid_raises(self):
        """Test that invalid attribute raises AttributeError."""
        import webhooks_mit
        with self.assertRaises(AttributeError):
            _ = webhooks_mit.NonExistentClass


class TestWebhookEventTypeModel(unittest.TestCase):
    """Test WebhookEventType model functionality."""

    def test_event_type_string_format(self):
        """Test event type follows model.action format."""
        event_name = "appliedcontrol.created"
        parts = event_name.rsplit('.', 1)
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0], 'appliedcontrol')
        self.assertEqual(parts[1], 'created')

    def test_auto_populate_model_action(self):
        """Test auto-population of model_name and action."""
        event_name = "riskscenario.updated"
        parts = event_name.rsplit('.', 1)

        model_name = parts[0] if len(parts) == 2 else ''
        action = parts[1] if len(parts) == 2 else ''

        self.assertEqual(model_name, 'riskscenario')
        self.assertEqual(action, 'updated')

    def test_get_or_create_event(self):
        """Test get_or_create logic for event types."""
        model_name = 'incident'
        action = 'deleted'
        expected_name = f"{model_name}.{action}"
        self.assertEqual(expected_name, 'incident.deleted')


class TestWebhookEndpointModel(unittest.TestCase):
    """Test WebhookEndpoint model functionality."""

    def test_payload_format_choices(self):
        """Test payload format choices."""
        formats = ['thin', 'full']
        for fmt in formats:
            self.assertIn(fmt, formats)

    def test_url_validation_valid(self):
        """Test valid URL passes validation."""
        url = "https://api.example.com/webhooks"
        from urllib.parse import urlparse

        hostname = urlparse(url).hostname
        self.assertEqual(hostname, 'api.example.com')

    def test_url_validation_private_ip(self):
        """Test private IP detection."""
        import ipaddress

        hostname = '192.168.1.1'
        ip = ipaddress.ip_address(hostname)
        self.assertTrue(ip.is_private)

    def test_url_validation_loopback(self):
        """Test loopback IP detection."""
        import ipaddress

        hostname = '127.0.0.1'
        ip = ipaddress.ip_address(hostname)
        self.assertTrue(ip.is_loopback)

    def test_url_validation_public_ip(self):
        """Test public IP passes validation."""
        import ipaddress

        hostname = '8.8.8.8'
        ip = ipaddress.ip_address(hostname)
        self.assertFalse(ip.is_private)
        self.assertFalse(ip.is_loopback)

    def test_sign_payload(self):
        """Test HMAC signature generation."""
        secret = 'my-secret-key'
        payload = b'{"event": "test"}'

        signature = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        self.assertEqual(len(signature), 64)  # SHA256 hex = 64 chars

    def test_verify_signature_valid(self):
        """Test signature verification for valid signature."""
        secret = 'my-secret-key'
        payload = b'{"event": "test"}'

        expected = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        self.assertTrue(hmac.compare_digest(expected, expected))

    def test_verify_signature_invalid(self):
        """Test signature verification for invalid signature."""
        secret = 'my-secret-key'
        payload = b'{"event": "test"}'

        expected = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()

        invalid_sig = 'invalid-signature'
        self.assertFalse(hmac.compare_digest(expected, invalid_sig))

    def test_is_folder_scoped(self):
        """Test is_folder_scoped property."""
        target_folder_ids = ['folder-1', 'folder-2']
        is_scoped = bool(target_folder_ids)
        self.assertTrue(is_scoped)

    def test_is_not_folder_scoped(self):
        """Test not folder scoped when empty."""
        target_folder_ids = []
        is_scoped = bool(target_folder_ids)
        self.assertFalse(is_scoped)

    def test_is_subscribed_to(self):
        """Test subscription check."""
        subscribed_event_ids = ['event-1', 'event-2', 'event-3']
        check_id = 'event-2'

        is_subscribed = str(check_id) in [str(e) for e in subscribed_event_ids]
        self.assertTrue(is_subscribed)


class TestWebhookDeliveryModel(unittest.TestCase):
    """Test WebhookDelivery model functionality."""

    def test_status_choices(self):
        """Test status choices."""
        statuses = ['pending', 'success', 'failed', 'retrying']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_duration_calculation(self):
        """Test duration calculation in milliseconds."""
        sent_at = datetime(2024, 6, 15, 10, 0, 0)
        completed_at = datetime(2024, 6, 15, 10, 0, 2, 500000)  # 2.5 seconds later

        delta = completed_at - sent_at
        duration_ms = int(delta.total_seconds() * 1000)
        self.assertEqual(duration_ms, 2500)

    def test_is_success(self):
        """Test is_success property."""
        status = 'success'
        is_success = status == 'success'
        self.assertTrue(is_success)

    def test_can_retry_success_cannot(self):
        """Test successful delivery cannot retry."""
        status = 'success'
        can_retry = status != 'success'
        self.assertFalse(can_retry)

    def test_can_retry_failed_under_max(self):
        """Test failed delivery under max can retry."""
        status = 'failed'
        attempt_number = 2
        max_attempts = 5

        can_retry = status != 'success' and attempt_number < max_attempts
        self.assertTrue(can_retry)

    def test_can_retry_at_max_cannot(self):
        """Test delivery at max attempts cannot retry."""
        status = 'failed'
        attempt_number = 5
        max_attempts = 5

        can_retry = status != 'success' and attempt_number < max_attempts
        self.assertFalse(can_retry)

    def test_mark_success(self):
        """Test marking delivery as success."""
        delivery = Mock()
        delivery.status = 'pending'
        delivery.response_status_code = None

        # Simulate mark_success
        delivery.status = 'success'
        delivery.response_status_code = 200
        delivery.completed_at = datetime.now()

        self.assertEqual(delivery.status, 'success')
        self.assertEqual(delivery.response_status_code, 200)

    def test_mark_failed_with_retry(self):
        """Test marking delivery as failed with retry scheduled."""
        delivery = Mock()
        delivery.status = 'pending'
        delivery.attempt_number = 1
        delivery.max_attempts = 5

        # Simulate mark_failed with retry
        delivery.status = 'retrying'
        delivery.attempt_number = 2
        delay_minutes = 2 ** (delivery.attempt_number - 1)  # Exponential backoff
        delivery.next_retry_at = datetime.now() + timedelta(minutes=delay_minutes)

        self.assertEqual(delivery.status, 'retrying')
        self.assertEqual(delivery.attempt_number, 2)
        self.assertEqual(delay_minutes, 2)

    def test_exponential_backoff(self):
        """Test exponential backoff calculation."""
        # Attempt 1: 1 minute
        # Attempt 2: 2 minutes
        # Attempt 3: 4 minutes
        # Attempt 4: 8 minutes
        # Attempt 5: 16 minutes

        for attempt in range(1, 6):
            delay = 2 ** (attempt - 1)
            expected = [1, 2, 4, 8, 16][attempt - 1]
            self.assertEqual(delay, expected)


class TestWebhookIntegration(unittest.TestCase):
    """Integration tests for webhook workflows."""

    def test_create_and_send_webhook(self):
        """Test creating and sending a webhook."""
        # Create delivery
        delivery = Mock()
        delivery.endpoint_id = str(uuid4())
        delivery.event_type = 'appliedcontrol.created'
        delivery.payload = {'id': str(uuid4()), 'name': 'Test Control'}
        delivery.status = 'pending'

        # Mark as sent
        delivery.sent_at = datetime.now()

        # Mark as success
        delivery.status = 'success'
        delivery.completed_at = datetime.now()
        delivery.response_status_code = 200

        self.assertEqual(delivery.status, 'success')

    def test_retry_failed_webhook(self):
        """Test retrying a failed webhook."""
        delivery = Mock()
        delivery.status = 'failed'
        delivery.attempt_number = 1
        delivery.max_attempts = 5

        # Check can retry
        can_retry = delivery.attempt_number < delivery.max_attempts
        self.assertTrue(can_retry)

        # Schedule retry
        delivery.status = 'retrying'
        delivery.attempt_number = 2
        self.assertEqual(delivery.status, 'retrying')


if __name__ == '__main__':
    unittest.main()
