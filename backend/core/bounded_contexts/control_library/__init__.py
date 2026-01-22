"""
Control Library Bounded Context

Manages controls, policies, evidence, and their implementations.

Note: Import aggregates directly from their modules to avoid Django app registry issues.
"""

__all__ = [
    "Control",
    "Policy",
    "EvidenceItem",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "Control":
        from .aggregates.control import Control
        return Control
    elif name == "Policy":
        from .aggregates.policy import Policy
        return Policy
    elif name == "EvidenceItem":
        from .aggregates.evidence_item import EvidenceItem
        return EvidenceItem
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

