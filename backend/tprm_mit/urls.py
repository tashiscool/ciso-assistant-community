"""
TPRM URL Configuration - MIT Licensed

Clean-room implementation of TPRM URL routing.
Copyright (c) 2026 Tash
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EntityViewSet,
    RepresentativeViewSet,
    SolutionViewSet,
    ContractViewSet,
    EntityAssessmentViewSet,
)

app_name = 'tprm_mit'

router = DefaultRouter()
router.register(r'entities', EntityViewSet, basename='entity')
router.register(r'representatives', RepresentativeViewSet, basename='representative')
router.register(r'solutions', SolutionViewSet, basename='solution')
router.register(r'contracts', ContractViewSet, basename='contract')
router.register(r'assessments', EntityAssessmentViewSet, basename='assessment')

urlpatterns = [
    path('', include(router.urls)),
]
