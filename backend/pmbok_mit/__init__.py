# MIT License - See LICENSE-MIT.txt in repository root
"""
Portfolio Management Module (MIT Licensed)

Clean-room implementation of portfolio/project management functionality
for GRC workflows.

Models:
    - GenericCollection: Groups related GRC objects together
    - Accreditation: System accreditation tracking
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import GenericCollection, Accreditation

__all__ = [
    "GenericCollection",
    "Accreditation",
]


def __getattr__(name: str):
    """Lazy import to allow testing without Django."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
