"""
GRC Governance Models — Control Origination, Assessment Workflow.

These models extend the core GRC platform with FedRAMP control origination
tracking, shared responsibility matrices, assessment plans, attestations,
and authorization timeline management.
"""

from .control_origination import (
    ControlOrigination,
    SharedResponsibilityMatrix,
    ResponsibilityAssignment,
)

from .assessment_workflow import (
    AssessmentPlan,
    Attestation,
    AuthorizationTimeline,
)

__all__ = [
    "ControlOrigination",
    "SharedResponsibilityMatrix",
    "ResponsibilityAssignment",
    "AssessmentPlan",
    "Attestation",
    "AuthorizationTimeline",
]
