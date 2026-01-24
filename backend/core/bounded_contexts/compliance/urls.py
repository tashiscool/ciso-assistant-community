"""
URL configuration for Compliance bounded context API
"""

from django.urls import path, include
from rest_framework import routers
from .views import (
    ComplianceFrameworkViewSet,
    RequirementViewSet,
    OnlineAssessmentViewSet,
    AssessmentRunViewSet,
    ComplianceAuditViewSet,
    ComplianceFindingViewSet,
    ComplianceExceptionViewSet,
)

router = routers.DefaultRouter()
router.register(r'frameworks', ComplianceFrameworkViewSet, basename='compliance-frameworks')
router.register(r'requirements', RequirementViewSet, basename='compliance-requirements')
router.register(r'online-assessments', OnlineAssessmentViewSet, basename='compliance-online-assessments')
router.register(r'assessment-runs', AssessmentRunViewSet, basename='compliance-assessment-runs')
router.register(r'compliance-audits', ComplianceAuditViewSet, basename='compliance-audits')
router.register(r'compliance-findings', ComplianceFindingViewSet, basename='compliance-findings')
router.register(r'compliance-exceptions', ComplianceExceptionViewSet, basename='compliance-exceptions')

urlpatterns = [
    path('', include(router.urls)),
]

