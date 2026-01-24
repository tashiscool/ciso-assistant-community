# MIT License - See LICENSE-MIT.txt in repository root
"""
Calendar Module (MIT Licensed)

Clean-room implementation of calendar/event functionality for GRC workflows.

Models:
    - Event: Calendar events for tracking milestones, deadlines, assessments
    - RecurringSchedule: Recurring event patterns
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import Event, RecurringSchedule

__all__ = [
    "Event",
    "RecurringSchedule",
]


def __getattr__(name: str):
    """Lazy import to allow testing without Django."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
