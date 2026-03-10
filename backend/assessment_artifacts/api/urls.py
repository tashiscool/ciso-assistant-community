"""Assessment Artifact Package API URLs."""

from rest_framework.routers import DefaultRouter
from .views import (
    ArtifactPackageViewSet,
    ArtifactRequestItemViewSet,
    EvidenceScheduleViewSet,
)

app_name = "assessment_artifacts"

router = DefaultRouter()
router.register(r"packages", ArtifactPackageViewSet, basename="artifact-package")
router.register(r"items", ArtifactRequestItemViewSet, basename="artifact-item")
router.register(r"schedules", EvidenceScheduleViewSet, basename="evidence-schedule")

urlpatterns = router.urls
