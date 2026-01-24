# MIT License - See LICENSE-MIT.txt in repository root
"""
Integrations Module (MIT Licensed)

Clean-room implementation of external tool integration functionality.

Models:
    - IntegrationProvider: Registry of available integration types
    - IntegrationConfiguration: Instance configuration for a provider
    - SyncMapping: Maps local objects to remote objects
    - SyncEvent: Audit trail of sync operations
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import IntegrationProvider, IntegrationConfiguration, SyncMapping, SyncEvent

__all__ = [
    "IntegrationProvider",
    "IntegrationConfiguration",
    "SyncMapping",
    "SyncEvent",
]


def __getattr__(name: str):
    """Lazy import to allow testing without Django."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
