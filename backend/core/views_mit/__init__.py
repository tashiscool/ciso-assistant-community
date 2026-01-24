"""
GRC Views - MIT Licensed

Clean-room implementation of GRC API views.
Copyright (c) 2026 Tash
"""

from .organization import (
    OrganizationViewSet,
    DomainViewSet,
    PerimeterViewSet,
    OrganizationalUnitViewSet,
)

from .governance import (
    FrameworkViewSet,
    ControlFamilyViewSet,
    ControlViewSet,
    PolicyViewSet,
    ProcedureViewSet,
    AppliedControlViewSet,
)

from .risk import (
    RiskMatrixViewSet,
    ThreatViewSet,
    VulnerabilityViewSet,
    RiskScenarioViewSet,
    RiskAssessmentViewSet,
    RiskTreatmentViewSet,
)

from .compliance import (
    ComplianceRequirementViewSet,
    RequirementAssessmentViewSet,
    AuditViewSet,
    FindingViewSet,
    EvidenceViewSet,
    ComplianceExceptionViewSet,
)

from .assets import (
    AssetCategoryViewSet,
    AssetClassificationViewSet,
    AssetViewSet,
    AssetRelationshipViewSet,
)

__all__ = [
    # Organization
    'OrganizationViewSet',
    'DomainViewSet',
    'PerimeterViewSet',
    'OrganizationalUnitViewSet',
    # Governance
    'FrameworkViewSet',
    'ControlFamilyViewSet',
    'ControlViewSet',
    'PolicyViewSet',
    'ProcedureViewSet',
    'AppliedControlViewSet',
    # Risk
    'RiskMatrixViewSet',
    'ThreatViewSet',
    'VulnerabilityViewSet',
    'RiskScenarioViewSet',
    'RiskAssessmentViewSet',
    'RiskTreatmentViewSet',
    # Compliance
    'ComplianceRequirementViewSet',
    'RequirementAssessmentViewSet',
    'AuditViewSet',
    'FindingViewSet',
    'EvidenceViewSet',
    'ComplianceExceptionViewSet',
    # Assets
    'AssetCategoryViewSet',
    'AssetClassificationViewSet',
    'AssetViewSet',
    'AssetRelationshipViewSet',
]
