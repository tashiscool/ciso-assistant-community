"""
Compliance Bounded Context

Manages compliance frameworks, requirements, assessments, audits, and findings.

Note: Import aggregates directly from their modules to avoid Django app registry issues.
"""

__all__ = [
    "ComplianceFramework",
    "Requirement",
    "OnlineAssessment",
]


def __getattr__(name):
    """Lazy loading to avoid Django app registry issues during startup"""
    if name == "ComplianceFramework":
        from .aggregates.compliance_framework import ComplianceFramework
        return ComplianceFramework
    elif name == "Requirement":
        from .aggregates.requirement import Requirement
        return Requirement
    elif name == "OnlineAssessment":
        from .aggregates.online_assessment import OnlineAssessment
        return OnlineAssessment
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

