"""
Risk Registers Bounded Context

Manages three risk registers: AssetRisk, ThirdPartyRisk, and BusinessRisk.

Note: Import aggregates directly from their modules to avoid Django app registry issues.
"""

__all__ = [
    "AssetRisk",
    "ThirdPartyRisk",
    "BusinessRisk",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "AssetRisk":
        from .aggregates.asset_risk import AssetRisk
        return AssetRisk
    elif name == "ThirdPartyRisk":
        from .aggregates.third_party_risk import ThirdPartyRisk
        return ThirdPartyRisk
    elif name == "BusinessRisk":
        from .aggregates.business_risk import BusinessRisk
        return BusinessRisk
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

