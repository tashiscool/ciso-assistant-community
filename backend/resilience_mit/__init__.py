"""
Resilience Management Module - MIT Licensed

Clean-room implementation of business continuity and resilience management.
Copyright (c) 2026 Tash

This module provides:
- BusinessImpactAnalysis: BIA assessments for business processes
- AssetAssessment: Criticality assessment of assets within BIA
- EscalationThreshold: Escalation triggers for incidents
"""

# Lazy imports to allow testing without Django
__all__ = [
    'BusinessImpactAnalysis',
    'AssetAssessment',
    'EscalationThreshold',
]


def __getattr__(name):
    """Lazy import to avoid Django dependency at import time."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
