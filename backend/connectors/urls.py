"""URL routing for connector management API."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ConnectorInstanceViewSet, SyncExecutionViewSet
from .api import ConnectorRegistryView

router = DefaultRouter()
router.register(r"instances", ConnectorInstanceViewSet, basename="connector-instance")
router.register(r"sync-history", SyncExecutionViewSet, basename="sync-execution")

urlpatterns = [
    path("", include(router.urls)),
    path("registry/", ConnectorRegistryView.as_view(), name="connector-registry"),
]
