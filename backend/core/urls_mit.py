"""
GRC URL Configuration - MIT Licensed

Clean-room implementation of GRC URL routing.
Copyright (c) 2026 Tash
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_mit import (
    # Organization
    OrganizationViewSet,
    DomainViewSet,
    PerimeterViewSet,
    OrganizationalUnitViewSet,
    # Governance
    FrameworkViewSet,
    ControlFamilyViewSet,
    ControlViewSet,
    PolicyViewSet,
    ProcedureViewSet,
    AppliedControlViewSet,
    # Risk
    RiskMatrixViewSet,
    ThreatViewSet,
    VulnerabilityViewSet,
    RiskScenarioViewSet,
    RiskAssessmentViewSet,
    RiskTreatmentViewSet,
    # Compliance
    ComplianceRequirementViewSet,
    RequirementAssessmentViewSet,
    AuditViewSet,
    FindingViewSet,
    EvidenceViewSet,
    ComplianceExceptionViewSet,
    # Assets
    AssetCategoryViewSet,
    AssetClassificationViewSet,
    AssetViewSet,
    AssetRelationshipViewSet,
)

app_name = 'core_mit'

router = DefaultRouter()

# Organization endpoints
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'domains', DomainViewSet, basename='domain')
router.register(r'perimeters', PerimeterViewSet, basename='perimeter')
router.register(r'organizational-units', OrganizationalUnitViewSet, basename='organizational-unit')

# Governance endpoints
router.register(r'frameworks', FrameworkViewSet, basename='framework')
router.register(r'control-families', ControlFamilyViewSet, basename='control-family')
router.register(r'controls', ControlViewSet, basename='control')
router.register(r'policies', PolicyViewSet, basename='policy')
router.register(r'procedures', ProcedureViewSet, basename='procedure')
router.register(r'applied-controls', AppliedControlViewSet, basename='applied-control')

# Risk endpoints
router.register(r'risk-matrices', RiskMatrixViewSet, basename='risk-matrix')
router.register(r'threats', ThreatViewSet, basename='threat')
router.register(r'vulnerabilities', VulnerabilityViewSet, basename='vulnerability')
router.register(r'risk-scenarios', RiskScenarioViewSet, basename='risk-scenario')
router.register(r'risk-assessments', RiskAssessmentViewSet, basename='risk-assessment')
router.register(r'risk-treatments', RiskTreatmentViewSet, basename='risk-treatment')

# Compliance endpoints
router.register(r'compliance-requirements', ComplianceRequirementViewSet, basename='compliance-requirement')
router.register(r'requirement-assessments', RequirementAssessmentViewSet, basename='requirement-assessment')
router.register(r'audits', AuditViewSet, basename='audit')
router.register(r'findings', FindingViewSet, basename='finding')
router.register(r'evidence', EvidenceViewSet, basename='evidence')
router.register(r'compliance-exceptions', ComplianceExceptionViewSet, basename='compliance-exception')

# Asset endpoints
router.register(r'asset-categories', AssetCategoryViewSet, basename='asset-category')
router.register(r'asset-classifications', AssetClassificationViewSet, basename='asset-classification')
router.register(r'assets', AssetViewSet, basename='asset')
router.register(r'asset-relationships', AssetRelationshipViewSet, basename='asset-relationship')

urlpatterns = [
    path('', include(router.urls)),
]
