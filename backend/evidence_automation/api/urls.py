"""
Evidence Automation API URLs
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EvidenceSourceViewSet,
    EvidenceCollectionRuleViewSet,
    EvidenceCollectionRunViewSet,
    TestConnectionView,
    SourceTypesView,
    CollectionTypesView,
)

app_name = 'evidence_automation'

router = DefaultRouter()
router.register(r'sources', EvidenceSourceViewSet, basename='evidence-sources')
router.register(r'rules', EvidenceCollectionRuleViewSet, basename='evidence-rules')
router.register(r'runs', EvidenceCollectionRunViewSet, basename='evidence-runs')

urlpatterns = [
    path('', include(router.urls)),
    path('test-connection/', TestConnectionView.as_view(), name='test-connection'),
    path('source-types/', SourceTypesView.as_view(), name='source-types'),
    path('collection-types/', CollectionTypesView.as_view(), name='collection-types'),
]
