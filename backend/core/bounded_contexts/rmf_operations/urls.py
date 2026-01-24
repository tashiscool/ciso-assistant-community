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
    # KSI Import views
    KSIImportPreviewView,
    KSIImportExecuteView,
    KSICategoriesView,
    KSILibraryMetadataView,
    # Validation Template views
    ValidationTemplateListView,
    ValidationTemplateDetailView,
    ValidationTemplateInstantiateView,
    ValidationTemplateCategoriesView,
    ValidationTemplateBulkInstantiateView,
    # OAR Generation views
    OARGenerateView,
    OARExportPackageView,
    OARDownloadView,
)
from .api.trust_center_views import (
    TrustCenterSummaryView,
    TrustCenterCSOListView,
    TrustCenterCSODetailView,
    TrustCenterKSIComplianceView,
    TrustCenterOARHistoryView,
    TrustCenterOSCALExcerptView,
    TrustCenterPublishView,
    TrustCenterConfigView,
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
    # KSI Import endpoints
    path("ksi/import/preview/", KSIImportPreviewView.as_view(), name="ksi-import-preview"),
    path("ksi/import/<uuid:cso_id>/", KSIImportExecuteView.as_view(), name="ksi-import-execute"),
    path("ksi/categories/", KSICategoriesView.as_view(), name="ksi-categories"),
    path("ksi/library/", KSILibraryMetadataView.as_view(), name="ksi-library"),
    # Validation Rule Template endpoints
    path("validation-templates/", ValidationTemplateListView.as_view(), name="validation-template-list"),
    path("validation-templates/categories/", ValidationTemplateCategoriesView.as_view(), name="validation-template-categories"),
    path("validation-templates/bulk-instantiate/", ValidationTemplateBulkInstantiateView.as_view(), name="validation-template-bulk-instantiate"),
    path("validation-templates/<str:template_id>/", ValidationTemplateDetailView.as_view(), name="validation-template-detail"),
    path("validation-templates/<str:template_id>/instantiate/", ValidationTemplateInstantiateView.as_view(), name="validation-template-instantiate"),
    # OAR Generation endpoints
    path("oar/generate/", OARGenerateView.as_view(), name="oar-generate"),
    path("oar/export/", OARExportPackageView.as_view(), name="oar-export"),
    path("oar/download/", OARDownloadView.as_view(), name="oar-download"),
    # Trust Center endpoints (public)
    path("trust-center/", TrustCenterSummaryView.as_view(), name="trust-center-summary"),
    path("trust-center/csos/", TrustCenterCSOListView.as_view(), name="trust-center-cso-list"),
    path("trust-center/csos/<uuid:cso_id>/", TrustCenterCSODetailView.as_view(), name="trust-center-cso-detail"),
    path("trust-center/csos/<uuid:cso_id>/compliance/", TrustCenterKSIComplianceView.as_view(), name="trust-center-compliance"),
    path("trust-center/csos/<uuid:cso_id>/oar-history/", TrustCenterOARHistoryView.as_view(), name="trust-center-oar-history"),
    path("trust-center/csos/<uuid:cso_id>/oscal/", TrustCenterOSCALExcerptView.as_view(), name="trust-center-oscal"),
    # Trust Center endpoints (authenticated)
    path("trust-center/csos/<uuid:cso_id>/publish/", TrustCenterPublishView.as_view(), name="trust-center-publish"),
    path("trust-center/csos/<uuid:cso_id>/config/", TrustCenterConfigView.as_view(), name="trust-center-config"),
]