from rest_framework.routers import DefaultRouter
from .api import (
    AssessmentTemplateViewSet,
    LightningAssessmentViewSet,
    MasterAssessmentViewSet,
    TestResultViewSet,
    AssessmentRunViewSet,
)

router = DefaultRouter()
router.register("templates", AssessmentTemplateViewSet, basename="assessment-template")
router.register("lightning", LightningAssessmentViewSet, basename="lightning-assessment")
router.register("master", MasterAssessmentViewSet, basename="master-assessment")
router.register("test-results", TestResultViewSet, basename="test-result")
router.register("runs", AssessmentRunViewSet, basename="assessment-run")

urlpatterns = router.urls
