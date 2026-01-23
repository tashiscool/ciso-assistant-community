"""
URL routing for Connectors module
"""

from django.urls import path, include
from rest_framework import routers

from .api import (
    ConnectorRegistryView,
    ConnectorConfigViewSet,
    ConnectorSyncHistoryViewSet,
)

router = routers.DefaultRouter()
router.register(r'configs', ConnectorConfigViewSet, basename='connector-configs')
router.register(r'sync-history', ConnectorSyncHistoryViewSet, basename='connector-sync-history')

urlpatterns = [
    path('', include(router.urls)),
    path('registry/', ConnectorRegistryView.as_view(), name='connector-registry'),
]
