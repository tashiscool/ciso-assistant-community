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
from .api.fedramp_20x_views import (
    FedRAMP20xKSIExportView,
    FedRAMP20xOARExportView,
    FedRAMP20xValidationReportView,
    FedRAMP20xCompletePackageView,
    FedRAMP20xDownloadView,
    IncidentExportView,
    ChangeControlExportView,
    OperationsExportView,
    OperationsDownloadView,
)
from .api.change_control_views import (
    SignificantChangeRequestViewSet,
    SecurityIncidentViewSet,
    IncidentDashboardView,
    ChangeControlDashboardView,
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
router.register(r'change-requests', SignificantChangeRequestViewSet, basename='change-requests')
router.register(r'incidents', SecurityIncidentViewSet, basename='incidents')

urlpatterns = [
    path("", include(router.urls)),
    # FedRAMP KSI Dashboard endpoints
    path("fedramp/dashboard/", FedRAMPDashboardView.as_view(), name="fedramp-dashboard"),
    path("fedramp/ksi-metrics/", FedRAMPKSIMetricsView.as_view(), name="fedramp-ksi-metrics"),
    path("fedramp/control-compliance/", FedRAMPControlComplianceView.as_view(), name="fedramp-control-compliance"),
    path("fedramp/vulnerability-summary/", FedRAMPVulnerabilitySummaryView.as_view(), name="fedramp-vulnerability-summary"),
    path("fedramp/poam-status/", FedRAMPPOAMStatusView.as_view(), name="fedramp-poam-status"),
    path("fedramp/continuous-monitoring/", FedRAMPContinuousMonitoringView.as_view(), name="fedramp-continuous-monitoring"),
    # FedRAMP 20x Machine-Readable Export endpoints
    path("fedramp-20x/ksi/", FedRAMP20xKSIExportView.as_view(), name="fedramp-20x-ksi"),
    path("fedramp-20x/oar/", FedRAMP20xOARExportView.as_view(), name="fedramp-20x-oar"),
    path("fedramp-20x/validation/", FedRAMP20xValidationReportView.as_view(), name="fedramp-20x-validation"),
    path("fedramp-20x/complete/", FedRAMP20xCompletePackageView.as_view(), name="fedramp-20x-complete"),
    path("fedramp-20x/download/", FedRAMP20xDownloadView.as_view(), name="fedramp-20x-download"),
    # Change Control and Incident Response dashboards
    path("change-control/dashboard/", ChangeControlDashboardView.as_view(), name="change-control-dashboard"),
    path("incident-response/dashboard/", IncidentDashboardView.as_view(), name="incident-response-dashboard"),
    # Incident and Change Export endpoints
    path("export/incidents/", IncidentExportView.as_view(), name="export-incidents"),
    path("export/changes/", ChangeControlExportView.as_view(), name="export-changes"),
    path("export/operations/", OperationsExportView.as_view(), name="export-operations"),
    path("export/download/", OperationsDownloadView.as_view(), name="export-download"),
]