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
- Incidents: Incident management and response
- Campaigns: Assessment campaigns
- Metadata: Labels and terminology
- Library: Reference controls and requirement nodes
- Assessments: Compliance, findings, risk acceptance
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
    EvidenceRevision,
    ComplianceException,
)

from .assets import (
    Asset,
    AssetCategory,
    AssetClassification,
    AssetRelationship,
)

from .incident import (
    Incident,
    TimelineEntry,
)

from .campaign import (
    Campaign,
)

from .metadata import (
    FilteringLabel,
    Terminology,
)

from .library import (
    ReferenceControl,
    RequirementNode,
    RequirementMappingSet,
    RequirementMapping,
)

from .assessments import (
    ComplianceAssessment,
    FindingsAssessment,
    RiskAcceptance,
    OrganisationIssue,
    OrganisationObjective,
    Team,
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
    'EvidenceRevision',
    'ComplianceException',
    # Assets
    'Asset',
    'AssetCategory',
    'AssetClassification',
    'AssetRelationship',
    # Incidents
    'Incident',
    'TimelineEntry',
    # Campaigns
    'Campaign',
    # Metadata
    'FilteringLabel',
    'Terminology',
    # Library
    'ReferenceControl',
    'RequirementNode',
    'RequirementMappingSet',
    'RequirementMapping',
    # Assessments
    'ComplianceAssessment',
    'FindingsAssessment',
    'RiskAcceptance',
    'OrganisationIssue',
    'OrganisationObjective',
    'Team',
]
