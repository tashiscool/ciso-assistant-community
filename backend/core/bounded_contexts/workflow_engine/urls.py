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
    WorkflowTemplateViewSet,
    MasterAssessmentViewSet,
    AssessmentTaskViewSet,
    # Analytics views
    WorkflowAnalyticsView,
    WorkflowMetricsView,
    WorkflowStepPerformanceView,
    WorkflowTrendsView,
    WorkflowOptimizationsView,
)

router = routers.DefaultRouter()
router.register(r'', WorkflowViewSet, basename='workflows')
router.register(r'executions', WorkflowExecutionViewSet, basename='workflow-executions')
router.register(r'schedules', WorkflowScheduleViewSet, basename='workflow-schedules')
router.register(r'webhooks', WorkflowWebhookViewSet, basename='workflow-webhooks')
router.register(r'templates', WorkflowTemplateViewSet, basename='workflow-templates')
router.register(r'assessments', MasterAssessmentViewSet, basename='assessments')
router.register(r'assessment-tasks', AssessmentTaskViewSet, basename='assessment-tasks')

urlpatterns = [
    path('', include(router.urls)),
    # Analytics endpoints
    path('analytics/', WorkflowAnalyticsView.as_view(), name='workflow-analytics'),
    path('analytics/metrics/', WorkflowMetricsView.as_view(), name='workflow-metrics'),
    path('analytics/metrics/<uuid:workflow_id>/', WorkflowMetricsView.as_view(), name='workflow-metrics-detail'),
    path('analytics/trends/', WorkflowTrendsView.as_view(), name='workflow-trends'),
    path('analytics/trends/<uuid:workflow_id>/', WorkflowTrendsView.as_view(), name='workflow-trends-detail'),
    path('analytics/optimizations/', WorkflowOptimizationsView.as_view(), name='workflow-optimizations'),
    path('analytics/optimizations/<uuid:workflow_id>/', WorkflowOptimizationsView.as_view(), name='workflow-optimizations-detail'),
    path('analytics/step-performance/<uuid:workflow_id>/', WorkflowStepPerformanceView.as_view(), name='workflow-step-performance'),
]
