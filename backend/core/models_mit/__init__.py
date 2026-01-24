"""
GRC Domain Models - MIT Licensed

Clean-room implementation of Governance, Risk, and Compliance models.
Copyright (c) 2026 Tash

This module provides the core domain models for a GRC platform:
- Organization: Multi-tenant organizational structure
- Governance: Frameworks, controls, policies
- Risk: Risk scenarios, assessments, treatments
- Compliance: Requirements, audits, evidence
- Assets: Asset inventory and classification
"""

from .organization import (
    Organization,
    Domain,
    Perimeter,
    OrganizationalUnit,
)

from .governance import (
    Framework,
    Control,
    ControlFamily,
    Policy,
    Procedure,
    AppliedControl,
)

from .risk import (
    RiskMatrix,
    RiskScenario,
    RiskAssessment,
    Threat,
    Vulnerability,
    RiskTreatment,
)

from .compliance import (
    ComplianceRequirement,
    RequirementAssessment,
    Audit,
    Finding,
    Evidence,
    ComplianceException,
)

from .assets import (
    Asset,
    AssetCategory,
    AssetClassification,
    AssetRelationship,
)

__all__ = [
    # Organization
    'Organization',
    'Domain',
    'Perimeter',
    'OrganizationalUnit',
    # Governance
    'Framework',
    'Control',
    'ControlFamily',
    'Policy',
    'Procedure',
    'AppliedControl',
    # Risk
    'RiskMatrix',
    'RiskScenario',
    'RiskAssessment',
    'Threat',
    'Vulnerability',
    'RiskTreatment',
    # Compliance
    'ComplianceRequirement',
    'RequirementAssessment',
    'Audit',
    'Finding',
    'Evidence',
    'ComplianceException',
    # Assets
    'Asset',
    'AssetCategory',
    'AssetClassification',
    'AssetRelationship',
]
