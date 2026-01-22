"""
BusinessContinuity Bounded Context

Manages BCP/DR plans, tests, tasks, and audit trail.

Note: Import aggregates directly from their modules to avoid Django app registry issues.
"""

__all__ = [
    "BusinessContinuityPlan",
    "BcpTask",
    "BcpAudit",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "BusinessContinuityPlan":
        from .aggregates.business_continuity_plan import BusinessContinuityPlan
        return BusinessContinuityPlan
    elif name == "BcpTask":
        from .supporting_entities.bcp_task import BcpTask
        return BcpTask
    elif name == "BcpAudit":
        from .supporting_entities.bcp_audit import BcpAudit
        return BcpAudit
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

