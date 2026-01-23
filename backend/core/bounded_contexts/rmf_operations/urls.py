"""
URL routing for RMF Operations bounded context
"""

from django.urls import path, include
from rest_framework import routers

from .views import (
    SystemGroupViewSet, StigChecklistViewSet,
    VulnerabilityFindingViewSet, ChecklistScoreViewSet,
    NessusScanViewSet, StigTemplateViewSet, ArtifactViewSet
)
from .api.fedramp_views import (
    FedRAMPDashboardView,
    FedRAMPKSIMetricsView,
    FedRAMPControlComplianceView,
    FedRAMPVulnerabilitySummaryView,
    FedRAMPPOAMStatusView,
    FedRAMPContinuousMonitoringView,
)

# Create router and register viewsets
router = routers.DefaultRouter()
router.register(r'system-groups', SystemGroupViewSet, basename='system-groups')
router.register(r'checklists', StigChecklistViewSet, basename='checklists')
router.register(r'vulnerability-findings', VulnerabilityFindingViewSet, basename='vulnerability-findings')
router.register(r'checklist-scores', ChecklistScoreViewSet, basename='checklist-scores')
router.register(r'nessus-scans', NessusScanViewSet, basename='nessus-scans')
router.register(r'templates', StigTemplateViewSet, basename='templates')
router.register(r'artifacts', ArtifactViewSet, basename='artifacts')

urlpatterns = [
    path("", include(router.urls)),
    # FedRAMP KSI Dashboard endpoints
    path("fedramp/dashboard/", FedRAMPDashboardView.as_view(), name="fedramp-dashboard"),
    path("fedramp/ksi-metrics/", FedRAMPKSIMetricsView.as_view(), name="fedramp-ksi-metrics"),
    path("fedramp/control-compliance/", FedRAMPControlComplianceView.as_view(), name="fedramp-control-compliance"),
    path("fedramp/vulnerability-summary/", FedRAMPVulnerabilitySummaryView.as_view(), name="fedramp-vulnerability-summary"),
    path("fedramp/poam-status/", FedRAMPPOAMStatusView.as_view(), name="fedramp-poam-status"),
    path("fedramp/continuous-monitoring/", FedRAMPContinuousMonitoringView.as_view(), name="fedramp-continuous-monitoring"),
]