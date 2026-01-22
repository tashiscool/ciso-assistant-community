"""
Domain-Driven Design (DDD) Infrastructure

This module provides the foundation for DDD patterns including:
- Domain events
- Aggregate roots
- Value objects
- Bounded contexts
- Read models

Note: Imports are deferred to avoid Django app registry issues.
Use get_event_bus() from events module instead of direct imports.
"""


def __getattr__(name):
    """Lazy loading of module attributes to avoid early Django model imports"""
    if name in ("DomainEvent", "EventBus", "EventHandler", "get_event_bus"):
        from .events import DomainEvent, EventBus, EventHandler, get_event_bus
        return {"DomainEvent": DomainEvent, "EventBus": EventBus,
                "EventHandler": EventHandler, "get_event_bus": get_event_bus}[name]
    elif name in ("AggregateRoot", "Entity"):
        from .aggregate import AggregateRoot, Entity
        return {"AggregateRoot": AggregateRoot, "Entity": Entity}[name]
    elif name == "ValueObject":
        from .value_object import ValueObject
        return ValueObject
    elif name == "Repository":
        from .repository import Repository
        return Repository
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "DomainEvent",
    "EventBus",
    "EventHandler",
    "get_event_bus",
    "AggregateRoot",
    "Entity",
    "ValueObject",
    "Repository",
]

