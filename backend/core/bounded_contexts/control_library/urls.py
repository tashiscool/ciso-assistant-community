"""
URL configuration for Control Library bounded context API
"""

from django.urls import path, include
from rest_framework import routers
from .views import (
    ControlViewSet,
    PolicyViewSet,
    EvidenceItemViewSet,
    ControlImplementationViewSet,
    PolicyAcknowledgementViewSet,
)

router = routers.DefaultRouter()
router.register(r'controls', ControlViewSet, basename='control-library-controls')
router.register(r'policies', PolicyViewSet, basename='control-library-policies')
router.register(r'evidence-items', EvidenceItemViewSet, basename='control-library-evidence-items')
router.register(r'control-implementations', ControlImplementationViewSet, basename='control-library-control-implementations')
router.register(r'policy-acknowledgements', PolicyAcknowledgementViewSet, basename='control-library-policy-acknowledgements')

urlpatterns = [
    path('', include(router.urls)),
]

