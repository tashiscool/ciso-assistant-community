"""
Privacy Bounded Context

Manages data assets and data flows for privacy compliance (GDPR, etc.).

Note: Import aggregates directly from their modules to avoid Django app registry issues.
"""

__all__ = [
    "DataAsset",
    "DataFlow",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "DataAsset":
        from .aggregates.data_asset import DataAsset
        return DataAsset
    elif name == "DataFlow":
        from .aggregates.data_flow import DataFlow
        return DataFlow
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

