"""
TPRM Services

Provides business logic services for Third-Party Risk Management:
- RequirementsFlowdownService: Map organizational compliance requirements
  to vendor-specific requirements and track compliance gaps.
"""


def __getattr__(name):
    """Lazy imports to avoid circular dependencies."""
    if name == "RequirementsFlowdownService":
        from .requirements_flowdown import RequirementsFlowdownService
        return RequirementsFlowdownService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "RequirementsFlowdownService",
]
