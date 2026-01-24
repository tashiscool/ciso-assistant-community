"""
Third-Party Risk Management Module - MIT Licensed

Clean-room implementation of TPRM with DORA compliance.
Copyright (c) 2026 Tash

This module provides:
- Entity management for third-party vendors/partners
- Entity assessments with criticality scoring
- Solution/service tracking
- Contract management
- DORA (Digital Operational Resilience Act) compliance reporting
"""

# Lazy imports to allow testing without Django
__all__ = [
    'Entity',
    'EntityAssessment',
    'Representative',
    'Solution',
    'Contract',
]


def __getattr__(name):
    """Lazy import to avoid Django dependency at import time."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
