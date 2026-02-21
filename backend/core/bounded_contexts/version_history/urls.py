from rest_framework.routers import DefaultRouter
from .api import (
    VersionHistoryViewSet,
    VersionSnapshotViewSet,
    VersionDiffViewSet,
    AuditViewSet,
)

router = DefaultRouter()
router.register("", VersionHistoryViewSet, basename="version-history")
router.register("snapshots", VersionSnapshotViewSet, basename="version-snapshot")
router.register("diff", VersionDiffViewSet, basename="version-diff")
router.register("audit", AuditViewSet, basename="version-audit")

urlpatterns = router.urls
