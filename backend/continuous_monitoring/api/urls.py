"""
ConMon API URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from continuous_monitoring.api.views import (
    ConMonProfileViewSet,
    ConMonActivityConfigViewSet,
    ConMonExecutionViewSet,
    ConMonMetricViewSet,
    ConMonDashboardView,
)

router = DefaultRouter()
router.register(r'profiles', ConMonProfileViewSet, basename='conmon-profile')
router.register(r'activities', ConMonActivityConfigViewSet, basename='conmon-activity')
router.register(r'executions', ConMonExecutionViewSet, basename='conmon-execution')
router.register(r'metrics', ConMonMetricViewSet, basename='conmon-metric')
router.register(r'dashboard', ConMonDashboardView, basename='conmon-dashboard')

urlpatterns = [
    path('', include(router.urls)),
]
