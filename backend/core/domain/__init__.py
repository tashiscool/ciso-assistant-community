"""
Domain-Driven Design (DDD) Infrastructure

This module provides the foundation for DDD patterns including:
- Domain events
- Aggregate roots
- Value objects
- Bounded contexts
- Read models

Note: Imports are done lazily to avoid circular import issues during
Django app loading. Use explicit imports from submodules:
    from core.domain.events import DomainEvent, EventBus, EventHandler
    from core.domain.aggregate import AggregateRoot, Entity
    from core.domain.value_object import ValueObject
    from core.domain.repository import Repository
"""


def __getattr__(name):
    """Lazy import for backwards compatibility"""
    if name in ("DomainEvent", "EventBus", "EventHandler", "get_event_bus"):
        from . import events
        return getattr(events, name)
    elif name in ("AggregateRoot", "Entity"):
        from . import aggregate
        return getattr(aggregate, name)
    elif name == "ValueObject":
        from . import value_object
        return getattr(value_object, name)
    elif name == "Repository":
        from . import repository
        return getattr(repository, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "DomainEvent",
    "EventBus",
    "EventHandler",
    "AggregateRoot",
    "Entity",
    "ValueObject",
    "Repository",
]
