"""
URL configuration for SecurityOperations bounded context API
"""

from django.urls import path, include
from rest_framework import routers
from .views import (
    SecurityIncidentViewSet,
    AwarenessProgramViewSet,
    AwarenessCampaignViewSet,
    AwarenessCompletionViewSet,
)

router = routers.DefaultRouter()
router.register(r'incidents', SecurityIncidentViewSet, basename='security-incidents')  # Frontend expects /security/incidents/
router.register(r'awareness-programs', AwarenessProgramViewSet, basename='security-awareness-programs')
router.register(r'awareness-campaigns', AwarenessCampaignViewSet, basename='security-awareness-campaigns')
router.register(r'awareness-completions', AwarenessCompletionViewSet, basename='security-awareness-completions')

urlpatterns = [
    path('', include(router.urls)),
]

