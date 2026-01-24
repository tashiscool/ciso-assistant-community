"""
URL configuration for Privacy bounded context API
"""

from django.urls import path, include
from rest_framework import routers
from .views import (
    DataAssetViewSet,
    DataFlowViewSet,
    ConsentRecordViewSet,
    DataSubjectRightViewSet,
)

router = routers.DefaultRouter()
router.register(r'data-assets', DataAssetViewSet, basename='data-assets')
router.register(r'data-flows', DataFlowViewSet, basename='data-flows')
router.register(r'consent-records', ConsentRecordViewSet, basename='consent-records')
router.register(r'data-subject-rights', DataSubjectRightViewSet, basename='data-subject-rights')

urlpatterns = [
    path('', include(router.urls)),
]

