"""
URL routing for Workflow Engine bounded context
"""

from django.urls import path, include
from rest_framework import routers

from .api import (
    WorkflowViewSet,
    WorkflowExecutionViewSet,
    WorkflowScheduleViewSet,
    WorkflowWebhookViewSet,
)

router = routers.DefaultRouter()
router.register(r'', WorkflowViewSet, basename='workflows')
router.register(r'executions', WorkflowExecutionViewSet, basename='workflow-executions')
router.register(r'schedules', WorkflowScheduleViewSet, basename='workflow-schedules')
router.register(r'webhooks', WorkflowWebhookViewSet, basename='workflow-webhooks')

urlpatterns = [
    path('', include(router.urls)),
]
