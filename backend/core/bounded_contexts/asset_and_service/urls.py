"""
URL configuration for Asset and Service bounded context API
"""

from django.urls import path, include
from rest_framework import routers
from .views import (
    AssetViewSet,
    ServiceViewSet,
    ProcessViewSet,
    ServiceContractViewSet,
)

router = routers.DefaultRouter()
router.register(r'assets', AssetViewSet, basename='asset-service-assets')
router.register(r'services', ServiceViewSet, basename='asset-service-services')
router.register(r'processes', ProcessViewSet, basename='asset-service-processes')
router.register(r'service-contracts', ServiceContractViewSet, basename='asset-service-service-contracts')

urlpatterns = [
    path('', include(router.urls)),
]

