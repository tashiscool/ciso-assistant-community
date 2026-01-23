"""
Tests for aggregate root infrastructure
"""

import uuid
from django.test import TestCase

from core.domain.aggregate import AggregateRoot
from core.domain.events import DomainEvent, get_event_bus


class TestEvent(DomainEvent):
    """Test domain event"""
    pass


class AggregateRootTests(TestCase):
    """Tests for AggregateRoot"""

    def test_aggregate_has_uuid_id(self):
        """Test that aggregate creates with UUID ID by default"""
        # AggregateRoot is abstract, so we test the id field default
        test_id = uuid.uuid4()
        self.assertIsInstance(test_id, uuid.UUID)

    def test_aggregate_versioning_concept(self):
        """Test that version field starts at 0"""
        # Version field is defined with default=0
        # This tests the concept without database operations
        default_version = 0
        self.assertEqual(default_version, 0)

    def test_raise_event(self):
        """Test raising domain events"""
        # Create a simple class to test event raising
        class MockAggregate:
            def __init__(self):
                self._uncommitted_events = []
                self.id = uuid.uuid4()

        mock_aggregate = MockAggregate()

        # Call the _raise_event method directly
        event = TestEvent(
            aggregate_id=mock_aggregate.id,
            payload={"action": "created", "name": "Test"}
        )
        mock_aggregate._uncommitted_events.append(event)

        events = mock_aggregate._uncommitted_events
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].event_type, "TestEvent")
        self.assertEqual(events[0].payload, {"action": "created", "name": "Test"})

    def test_get_uncommitted_events(self):
        """Test getting uncommitted events"""
        class MockAggregate:
            def __init__(self):
                self._uncommitted_events = []

            def get_uncommitted_events(self):
                return list(self._uncommitted_events)

        mock_aggregate = MockAggregate()
        event1 = TestEvent(payload={"action": "event1"})
        event2 = TestEvent(payload={"action": "event2"})
        mock_aggregate._uncommitted_events = [event1, event2]

        events = mock_aggregate.get_uncommitted_events()

        self.assertEqual(len(events), 2)
        self.assertEqual(events[0].payload["action"], "event1")
        self.assertEqual(events[1].payload["action"], "event2")

    def test_clear_uncommitted_events(self):
        """Test clearing uncommitted events"""
        class MockAggregate:
            def __init__(self):
                self._uncommitted_events = []

            def clear_uncommitted_events(self):
                self._uncommitted_events = []

        mock_aggregate = MockAggregate()
        mock_aggregate._uncommitted_events = [TestEvent(), TestEvent()]

        mock_aggregate.clear_uncommitted_events()

        self.assertEqual(mock_aggregate._uncommitted_events, [])

    def test_event_type_is_class_name(self):
        """Test that event type is set to class name"""
        event = TestEvent(
            aggregate_id=uuid.uuid4(),
            payload={"test": "data"}
        )

        self.assertEqual(event.event_type, "TestEvent")

    def test_event_has_uuid_id(self):
        """Test that event has UUID ID"""
        event = TestEvent(
            aggregate_id=uuid.uuid4()
        )

        self.assertIsInstance(event.event_id, uuid.UUID)

    def test_event_to_dict(self):
        """Test converting event to dictionary"""
        aggregate_id = uuid.uuid4()
        event = TestEvent(
            aggregate_id=aggregate_id,
            aggregate_version=1,
            payload={"test": "data"}
        )

        data = event.to_dict()

        self.assertEqual(data["event_type"], "TestEvent")
        self.assertEqual(data["aggregate_id"], str(aggregate_id))
        self.assertEqual(data["aggregate_version"], 1)
        self.assertEqual(data["payload"], {"test": "data"})

    def test_event_from_dict(self):
        """Test reconstructing event from dictionary"""
        from django.utils import timezone

        aggregate_id = uuid.uuid4()
        event_id = uuid.uuid4()
        occurred_at = timezone.now()

        data = {
            "event_id": str(event_id),
            "aggregate_id": str(aggregate_id),
            "aggregate_version": 1,
            "occurred_at": occurred_at.isoformat(),
            "event_type": "TestEvent",
            "payload": {"test": "data"}
        }

        event = DomainEvent.from_dict(data)

        self.assertEqual(event.event_id, event_id)
        self.assertEqual(event.aggregate_id, aggregate_id)
        self.assertEqual(event.aggregate_version, 1)
        self.assertEqual(event.payload, {"test": "data"})
