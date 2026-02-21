from rest_framework.routers import DefaultRouter
from .api import (
    VersionHistoryViewSet,
    VersionSnapshotViewSet,
    VersionDiffViewSet,
    AuditViewSet,
)

router = DefaultRouter()
# Register specific prefixes BEFORE the empty-prefix history viewset.
# An empty-prefix router creates a catch-all detail route (?P<pk>[^/.]+)/
# that would otherwise match "snapshots/", "diff/", "audit/" first.
router.register("snapshots", VersionSnapshotViewSet, basename="version-snapshot")
router.register("diff", VersionDiffViewSet, basename="version-diff")
router.register("audit", AuditViewSet, basename="version-audit")
router.register("", VersionHistoryViewSet, basename="version-history")

urlpatterns = router.urls
