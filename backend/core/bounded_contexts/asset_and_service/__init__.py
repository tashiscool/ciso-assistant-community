"""
Asset and Service Bounded Context

Manages assets, services, processes, and their relationships.

Note: Import aggregates directly from their modules to avoid Django app registry issues.
"""

__all__ = [
    "Asset",
    "Service",
    "Process",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "Asset":
        from .aggregates.asset import Asset
        return Asset
    elif name == "Service":
        from .aggregates.service import Service
        return Service
    elif name == "Process":
        from .aggregates.process import Process
        return Process
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

