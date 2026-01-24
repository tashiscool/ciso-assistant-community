# MIT License - See LICENSE-MIT.txt in repository root
"""
Global Settings Module (MIT Licensed)

Clean-room implementation of application-wide configuration management.

Models:
    - GlobalSettings: Application-wide configuration store
    - FeatureFlag: Feature toggle management
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import GlobalSettings, FeatureFlag

__all__ = [
    "GlobalSettings",
    "FeatureFlag",
]


def __getattr__(name: str):
    """Lazy import to allow testing without Django."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
