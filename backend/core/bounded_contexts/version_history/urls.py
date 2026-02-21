from rest_framework.routers import DefaultRouter
from .api import VersionHistoryViewSet

router = DefaultRouter()
router.register("", VersionHistoryViewSet, basename="version-history")

urlpatterns = router.urls
