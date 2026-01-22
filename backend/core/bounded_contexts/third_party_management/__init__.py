"""
ThirdPartyManagement Bounded Context

Manages third parties (suppliers, vendors, partners) and their lifecycle.

Note: Import aggregates directly from their modules to avoid Django app registry issues.
"""

__all__ = [
    "ThirdParty",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "ThirdParty":
        from .aggregates.third_party import ThirdParty
        return ThirdParty
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

