from rest_framework.routers import DefaultRouter
from .api import LightningAssessmentViewSet

router = DefaultRouter()
router.register("lightning", LightningAssessmentViewSet, basename="lightning-assessment")

urlpatterns = router.urls
