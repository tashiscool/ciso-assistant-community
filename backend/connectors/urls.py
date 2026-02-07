"""URL routing for connector management API."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ConnectorInstanceViewSet, SyncExecutionViewSet

router = DefaultRouter()
router.register(r"instances", ConnectorInstanceViewSet, basename="connector-instance")
router.register(r"sync-history", SyncExecutionViewSet, basename="sync-execution")

urlpatterns = [
    path("", include(router.urls)),
]
