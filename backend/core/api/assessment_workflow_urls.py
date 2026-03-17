"""Assessment Workflow & Control Origination API URLs."""

from rest_framework.routers import DefaultRouter
from .control_origination_views import (
    ControlOriginationViewSet,
    SharedResponsibilityMatrixViewSet,
    ResponsibilityAssignmentViewSet,
)
from .assessment_workflow_views import (
    AssessmentPlanViewSet,
    AttestationViewSet,
    AuthorizationTimelineViewSet,
)

app_name = "assessment_workflow"

router = DefaultRouter()
router.register(r"control-originations", ControlOriginationViewSet, basename="control-origination")
router.register(r"responsibility-matrices", SharedResponsibilityMatrixViewSet, basename="responsibility-matrix")
router.register(r"responsibility-assignments", ResponsibilityAssignmentViewSet, basename="responsibility-assignment")
router.register(r"assessment-plans", AssessmentPlanViewSet, basename="assessment-plan")
router.register(r"attestations", AttestationViewSet, basename="attestation")
router.register(r"authorization-timelines", AuthorizationTimelineViewSet, basename="authorization-timeline")

urlpatterns = router.urls
