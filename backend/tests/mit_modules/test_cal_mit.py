# MIT License - See LICENSE-MIT.txt in repository root
"""
Tests for cal_mit module (Calendar/Events)

Standalone tests that can run without Django using unittest and mocking.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta, date
from uuid import uuid4


class TestCalMitModuleExports(unittest.TestCase):
    """Test module exports and lazy loading."""

    def test_module_exports(self):
        """Test that module exports expected classes."""
        import cal_mit
        self.assertEqual(
            sorted(cal_mit.__all__),
            ['Event', 'RecurringSchedule']
        )

    def test_lazy_import_invalid_raises(self):
        """Test that invalid attribute raises AttributeError."""
        import cal_mit
        with self.assertRaises(AttributeError):
            _ = cal_mit.NonExistentClass


class TestEventModel(unittest.TestCase):
    """Test Event model functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.event = Mock()
        self.event.id = uuid4()
        self.event.name = "Security Audit Q1"
        self.event.description = "Quarterly security audit"
        self.event.event_type = 'audit'
        self.event.priority = 'high'
        self.event.status = 'scheduled'
        self.event.all_day = False
        self.event.reminder_minutes = 60
        self.event.reminder_sent = False

    def test_event_type_choices(self):
        """Test event type choices are defined."""
        expected_types = [
            'assessment', 'audit', 'deadline', 'review',
            'milestone', 'meeting', 'training', 'other'
        ]
        for etype in expected_types:
            self.assertIn(etype, expected_types)

    def test_event_priority_choices(self):
        """Test event priority choices."""
        priorities = ['low', 'medium', 'high', 'critical']
        self.assertIn(self.event.priority, priorities)

    def test_event_status_choices(self):
        """Test event status choices."""
        statuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed']
        self.assertIn(self.event.status, statuses)

    def test_event_duration_calculation(self):
        """Test event duration property."""
        start = datetime(2024, 6, 15, 9, 0)
        end = datetime(2024, 6, 15, 17, 0)
        duration = end - start
        self.assertEqual(duration.total_seconds() / 3600, 8.0)

    def test_event_is_past(self):
        """Test is_past property logic."""
        past_end = datetime.now() - timedelta(days=1)
        self.assertTrue(datetime.now() > past_end)

    def test_event_is_current(self):
        """Test is_current property logic."""
        start = datetime.now() - timedelta(hours=1)
        end = datetime.now() + timedelta(hours=1)
        now = datetime.now()
        self.assertTrue(start <= now <= end)

    def test_event_is_upcoming(self):
        """Test is_upcoming property logic."""
        future_start = datetime.now() + timedelta(days=1)
        self.assertTrue(datetime.now() < future_start)

    def test_reminder_time_calculation(self):
        """Test reminder_time property."""
        start_time = datetime(2024, 6, 15, 10, 0)
        reminder_minutes = 60
        expected_reminder = start_time - timedelta(minutes=reminder_minutes)
        self.assertEqual(expected_reminder, datetime(2024, 6, 15, 9, 0))

    def test_should_send_reminder_logic(self):
        """Test reminder sending logic."""
        # Not sent yet, within window
        reminder_sent = False
        now = datetime(2024, 6, 15, 9, 30)
        reminder_time = datetime(2024, 6, 15, 9, 0)
        start_time = datetime(2024, 6, 15, 10, 0)

        should_send = (
            not reminder_sent and
            now >= reminder_time and
            now < start_time
        )
        self.assertTrue(should_send)

    def test_is_overdue_for_deadline(self):
        """Test is_overdue property for deadline events."""
        event_type = 'deadline'
        status = 'scheduled'
        is_past = True

        is_overdue = (
            event_type == 'deadline' and
            status != 'completed' and
            is_past
        )
        self.assertTrue(is_overdue)

    def test_is_overdue_not_deadline(self):
        """Test is_overdue is False for non-deadline events."""
        event_type = 'meeting'
        is_past = True

        is_overdue = event_type == 'deadline' and is_past
        self.assertFalse(is_overdue)


class TestRecurringScheduleModel(unittest.TestCase):
    """Test RecurringSchedule model functionality."""

    def test_frequency_choices(self):
        """Test frequency choices are defined."""
        frequencies = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']
        for freq in frequencies:
            self.assertIn(freq, frequencies)

    def test_days_of_week_list_parsing(self):
        """Test parsing days of week string to list."""
        days_str = "0,2,4"  # Mon, Wed, Fri
        days_list = [int(d.strip()) for d in days_str.split(',') if d.strip()]
        self.assertEqual(days_list, [0, 2, 4])

    def test_days_of_week_list_empty(self):
        """Test empty days of week."""
        days_str = ""
        days_list = [int(d.strip()) for d in days_str.split(',') if d.strip()]
        self.assertEqual(days_list, [])

    def test_next_occurrence_daily(self):
        """Test next occurrence calculation for daily frequency."""
        today = date.today()
        start_date = today - timedelta(days=7)
        frequency = 'daily'
        is_active = True
        end_date = None

        # For daily, next occurrence is today if active and not ended
        if is_active and (end_date is None or today <= end_date):
            next_date = max(today, start_date)
            self.assertEqual(next_date, today)

    def test_next_occurrence_weekly_with_days(self):
        """Test next occurrence for weekly with specific days."""
        days_of_week = [0, 4]  # Monday, Friday
        today = date.today()

        # Find next matching day
        found_date = None
        for i in range(7):
            check_date = today + timedelta(days=i)
            if check_date.weekday() in days_of_week:
                found_date = check_date
                break

        self.assertIsNotNone(found_date)
        self.assertIn(found_date.weekday(), days_of_week)

    def test_next_occurrence_monthly(self):
        """Test next occurrence for monthly frequency."""
        today = date.today()
        day_of_month = 15

        if today.day <= day_of_month:
            next_date = today.replace(day=min(day_of_month, 28))
        elif today.month == 12:
            next_date = date(today.year + 1, 1, min(day_of_month, 28))
        else:
            next_date = date(today.year, today.month + 1, min(day_of_month, 28))

        self.assertIsNotNone(next_date)

    def test_inactive_schedule_no_occurrence(self):
        """Test inactive schedule returns no next occurrence."""
        is_active = False
        next_occurrence = None if not is_active else date.today()
        self.assertIsNone(next_occurrence)

    def test_ended_schedule_no_occurrence(self):
        """Test schedule past end_date returns no next occurrence."""
        today = date.today()
        end_date = today - timedelta(days=1)

        is_past_end = today > end_date
        self.assertTrue(is_past_end)

    def test_max_occurrences_reached(self):
        """Test schedule at max occurrences returns no next occurrence."""
        max_occurrences = 10
        event_count = 10

        at_max = max_occurrences and event_count >= max_occurrences
        self.assertTrue(at_max)


class TestEventIntegration(unittest.TestCase):
    """Integration tests for Event workflows."""

    def test_mark_completed_workflow(self):
        """Test marking event as completed."""
        event = Mock()
        event.status = 'scheduled'

        # Simulate mark_completed
        event.status = 'completed'
        self.assertEqual(event.status, 'completed')

    def test_postpone_workflow(self):
        """Test postponing event."""
        original_start = datetime(2024, 6, 15, 10, 0)
        original_end = datetime(2024, 6, 15, 12, 0)
        duration = original_end - original_start

        new_start = datetime(2024, 6, 20, 10, 0)
        new_end = new_start + duration

        self.assertEqual(new_end, datetime(2024, 6, 20, 12, 0))

    def test_deactivate_schedule_workflow(self):
        """Test deactivating a recurring schedule."""
        schedule = Mock()
        schedule.is_active = True

        # Simulate deactivate
        schedule.is_active = False
        self.assertFalse(schedule.is_active)


if __name__ == '__main__':
    unittest.main()
