"""
CRQ URL Configuration - MIT Licensed

Clean-room implementation of CRQ URL routing.
Copyright (c) 2026 Tash
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    QuantitativeRiskStudyViewSet,
    QuantitativeRiskScenarioViewSet,
    QuantitativeRiskHypothesisViewSet,
)

app_name = 'crq_mit'

router = DefaultRouter()
router.register(r'studies', QuantitativeRiskStudyViewSet, basename='study')
router.register(r'scenarios', QuantitativeRiskScenarioViewSet, basename='scenario')
router.register(r'hypotheses', QuantitativeRiskHypothesisViewSet, basename='hypothesis')

urlpatterns = [
    path('', include(router.urls)),
]
