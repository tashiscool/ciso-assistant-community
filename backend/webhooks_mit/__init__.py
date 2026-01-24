# MIT License - See LICENSE-MIT.txt in repository root
"""
Webhooks Module (MIT Licensed)

Clean-room implementation of webhook functionality for event notifications.

Models:
    - WebhookEventType: Subscribable event types
    - WebhookEndpoint: Consumer endpoint configuration
    - WebhookDelivery: Delivery attempt tracking
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import WebhookEventType, WebhookEndpoint, WebhookDelivery

__all__ = [
    "WebhookEventType",
    "WebhookEndpoint",
    "WebhookDelivery",
]


def __getattr__(name: str):
    """Lazy import to allow testing without Django."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
