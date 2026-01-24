"""
URL configuration for BusinessContinuity bounded context API
"""

from django.urls import path, include
from rest_framework import routers
from .views import (
    BusinessContinuityPlanViewSet,
    BcpTaskViewSet,
    BcpAuditViewSet,
)

router = routers.DefaultRouter()
router.register(r'bcp-plans', BusinessContinuityPlanViewSet, basename='bcp-plans')  # Frontend expects /business-continuity/bcp-plans/
router.register(r'bcp-tasks', BcpTaskViewSet, basename='bcp-tasks')
router.register(r'bcp-audits', BcpAuditViewSet, basename='bcp-audits')

urlpatterns = [
    path('', include(router.urls)),
]

