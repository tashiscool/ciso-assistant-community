# MIT License - See LICENSE-MIT.txt in repository root
"""
Calendar Models - Clean-room MIT implementation

Provides calendar event management for GRC workflows including:
- Assessment scheduling
- Compliance deadlines
- Audit timelines
- Task milestones
"""

import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class Event(models.Model):
    """
    Calendar event for tracking GRC-related dates and milestones.

    Supports various event types including assessments, audits,
    compliance deadlines, and general milestones.
    """

    class EventType(models.TextChoices):
        """Types of calendar events."""
        ASSESSMENT = 'assessment', _('Assessment')
        AUDIT = 'audit', _('Audit')
        DEADLINE = 'deadline', _('Compliance Deadline')
        REVIEW = 'review', _('Review')
        MILESTONE = 'milestone', _('Milestone')
        MEETING = 'meeting', _('Meeting')
        TRAINING = 'training', _('Training')
        OTHER = 'other', _('Other')

    class EventPriority(models.TextChoices):
        """Priority levels for events."""
        LOW = 'low', _('Low')
        MEDIUM = 'medium', _('Medium')
        HIGH = 'high', _('High')
        CRITICAL = 'critical', _('Critical')

    class EventStatus(models.TextChoices):
        """Status of the event."""
        SCHEDULED = 'scheduled', _('Scheduled')
        IN_PROGRESS = 'in_progress', _('In Progress')
        COMPLETED = 'completed', _('Completed')
        CANCELLED = 'cancelled', _('Cancelled')
        POSTPONED = 'postponed', _('Postponed')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Basic information
    name = models.CharField(
        max_length=200,
        verbose_name=_('Event Name'),
        help_text=_('Name or title of the event')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description'),
        help_text=_('Detailed description of the event')
    )

    # Event classification
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        default=EventType.OTHER,
        verbose_name=_('Event Type')
    )
    priority = models.CharField(
        max_length=20,
        choices=EventPriority.choices,
        default=EventPriority.MEDIUM,
        verbose_name=_('Priority')
    )
    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        default=EventStatus.SCHEDULED,
        verbose_name=_('Status')
    )

    # Timing
    start_time = models.DateTimeField(
        verbose_name=_('Start Time'),
        help_text=_('When the event starts')
    )
    end_time = models.DateTimeField(
        verbose_name=_('End Time'),
        help_text=_('When the event ends')
    )
    all_day = models.BooleanField(
        default=False,
        verbose_name=_('All Day Event'),
        help_text=_('Whether this is an all-day event')
    )

    # Timezone handling
    timezone = models.CharField(
        max_length=50,
        default='UTC',
        verbose_name=_('Timezone')
    )

    # Location
    location = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_('Location'),
        help_text=_('Physical location or video conference link')
    )

    # Reminders
    reminder_minutes = models.PositiveIntegerField(
        default=60,
        verbose_name=_('Reminder (minutes)'),
        help_text=_('Minutes before event to send reminder')
    )
    reminder_sent = models.BooleanField(
        default=False,
        verbose_name=_('Reminder Sent')
    )

    # Recurring event link
    recurring_schedule = models.ForeignKey(
        'RecurringSchedule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='events',
        verbose_name=_('Recurring Schedule')
    )

    # Generic relation to GRC objects
    related_object_type = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('Related Object Type'),
        help_text=_('Type of related GRC object (e.g., ComplianceAssessment)')
    )
    related_object_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Related Object ID')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping (reference to folder ID)
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder'),
        help_text=_('Folder this event belongs to')
    )

    class Meta:
        ordering = ['start_time']
        verbose_name = _('Event')
        verbose_name_plural = _('Events')
        indexes = [
            models.Index(fields=['start_time', 'end_time']),
            models.Index(fields=['event_type', 'status']),
            models.Index(fields=['folder_id']),
        ]

    def __str__(self):
        return f"{self.name} ({self.start_time.strftime('%Y-%m-%d')})"

    @property
    def duration(self) -> timedelta:
        """Return the duration of the event."""
        return self.end_time - self.start_time

    @property
    def duration_hours(self) -> float:
        """Return duration in hours."""
        return self.duration.total_seconds() / 3600

    @property
    def is_past(self) -> bool:
        """Check if the event has already ended."""
        return timezone.now() > self.end_time

    @property
    def is_current(self) -> bool:
        """Check if the event is currently happening."""
        now = timezone.now()
        return self.start_time <= now <= self.end_time

    @property
    def is_upcoming(self) -> bool:
        """Check if the event is in the future."""
        return timezone.now() < self.start_time

    @property
    def reminder_time(self):
        """Calculate when the reminder should be sent."""
        return self.start_time - timedelta(minutes=self.reminder_minutes)

    @property
    def should_send_reminder(self) -> bool:
        """Check if reminder should be sent now."""
        if self.reminder_sent:
            return False
        now = timezone.now()
        return now >= self.reminder_time and now < self.start_time

    @property
    def is_overdue(self) -> bool:
        """Check if a deadline event is overdue."""
        if self.event_type != self.EventType.DEADLINE:
            return False
        if self.status == self.EventStatus.COMPLETED:
            return False
        return self.is_past

    def mark_completed(self):
        """Mark the event as completed."""
        self.status = self.EventStatus.COMPLETED
        self.save(update_fields=['status', 'updated_at'])

    def postpone(self, new_start: 'timezone.datetime', new_end: 'timezone.datetime' = None):
        """Postpone the event to a new time."""
        duration = self.duration
        self.start_time = new_start
        self.end_time = new_end or (new_start + duration)
        self.status = self.EventStatus.POSTPONED
        self.reminder_sent = False
        self.save(update_fields=['start_time', 'end_time', 'status', 'reminder_sent', 'updated_at'])


class RecurringSchedule(models.Model):
    """
    Defines recurring patterns for calendar events.

    Supports common recurrence patterns like daily, weekly, monthly,
    and yearly with various customization options.
    """

    class Frequency(models.TextChoices):
        """Recurrence frequency options."""
        DAILY = 'daily', _('Daily')
        WEEKLY = 'weekly', _('Weekly')
        BIWEEKLY = 'biweekly', _('Bi-weekly')
        MONTHLY = 'monthly', _('Monthly')
        QUARTERLY = 'quarterly', _('Quarterly')
        YEARLY = 'yearly', _('Yearly')

    class DayOfWeek(models.IntegerChoices):
        """Days of the week (0=Monday, 6=Sunday)."""
        MONDAY = 0, _('Monday')
        TUESDAY = 1, _('Tuesday')
        WEDNESDAY = 2, _('Wednesday')
        THURSDAY = 3, _('Thursday')
        FRIDAY = 4, _('Friday')
        SATURDAY = 5, _('Saturday')
        SUNDAY = 6, _('Sunday')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Schedule name
    name = models.CharField(
        max_length=200,
        verbose_name=_('Schedule Name')
    )

    # Recurrence pattern
    frequency = models.CharField(
        max_length=20,
        choices=Frequency.choices,
        verbose_name=_('Frequency')
    )
    interval = models.PositiveIntegerField(
        default=1,
        verbose_name=_('Interval'),
        help_text=_('Number of frequency units between occurrences')
    )

    # Weekly specifics (comma-separated day numbers)
    days_of_week = models.CharField(
        max_length=20,
        blank=True,
        verbose_name=_('Days of Week'),
        help_text=_('Comma-separated day numbers (0=Mon, 6=Sun)')
    )

    # Monthly specifics
    day_of_month = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name=_('Day of Month'),
        help_text=_('Day of the month (1-31)')
    )

    # Schedule boundaries
    start_date = models.DateField(
        verbose_name=_('Start Date'),
        help_text=_('When the recurring schedule begins')
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_('End Date'),
        help_text=_('When the recurring schedule ends (optional)')
    )
    max_occurrences = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name=_('Max Occurrences'),
        help_text=_('Maximum number of event occurrences')
    )

    # Event template
    event_duration_minutes = models.PositiveIntegerField(
        default=60,
        verbose_name=_('Event Duration (minutes)')
    )
    event_type = models.CharField(
        max_length=20,
        choices=Event.EventType.choices,
        default=Event.EventType.OTHER,
        verbose_name=_('Event Type')
    )
    event_priority = models.CharField(
        max_length=20,
        choices=Event.EventPriority.choices,
        default=Event.EventPriority.MEDIUM,
        verbose_name=_('Event Priority')
    )

    # Active status
    is_active = models.BooleanField(
        default=True,
        verbose_name=_('Active'),
        help_text=_('Whether to continue generating events')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder')
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Recurring Schedule')
        verbose_name_plural = _('Recurring Schedules')

    def __str__(self):
        return f"{self.name} ({self.get_frequency_display()})"

    @property
    def days_of_week_list(self) -> list:
        """Return days of week as list of integers."""
        if not self.days_of_week:
            return []
        return [int(d.strip()) for d in self.days_of_week.split(',') if d.strip()]

    @days_of_week_list.setter
    def days_of_week_list(self, value: list):
        """Set days of week from list of integers."""
        self.days_of_week = ','.join(str(d) for d in sorted(value))

    @property
    def event_count(self) -> int:
        """Return number of events generated from this schedule."""
        return self.events.count()

    @property
    def next_occurrence(self):
        """
        Calculate the next occurrence date.
        Returns None if schedule has ended.
        """
        from datetime import date
        today = date.today()

        if not self.is_active:
            return None
        if self.end_date and today > self.end_date:
            return None
        if self.max_occurrences and self.event_count >= self.max_occurrences:
            return None

        # Find next date based on frequency
        base_date = max(today, self.start_date)

        if self.frequency == self.Frequency.DAILY:
            return base_date

        elif self.frequency == self.Frequency.WEEKLY:
            if self.days_of_week_list:
                # Find next matching day
                for i in range(7):
                    check_date = base_date + timedelta(days=i)
                    if check_date.weekday() in self.days_of_week_list:
                        return check_date
            return base_date

        elif self.frequency == self.Frequency.MONTHLY:
            if self.day_of_month:
                # Next occurrence of the specified day
                if base_date.day <= self.day_of_month:
                    return base_date.replace(day=min(self.day_of_month, 28))
                # Next month
                if base_date.month == 12:
                    return date(base_date.year + 1, 1, min(self.day_of_month, 28))
                return date(base_date.year, base_date.month + 1, min(self.day_of_month, 28))
            return base_date

        return base_date

    def deactivate(self):
        """Deactivate this recurring schedule."""
        self.is_active = False
        self.save(update_fields=['is_active', 'updated_at'])
