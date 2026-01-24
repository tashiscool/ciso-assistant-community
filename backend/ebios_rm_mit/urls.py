"""
EBIOS RM URL Configuration - MIT Licensed

Clean-room implementation of EBIOS RM URL routing.
Copyright (c) 2026 Tash
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EbiosRMStudyViewSet,
    FearedEventViewSet,
    RiskOriginViewSet,
    TargetObjectiveViewSet,
    RoToViewSet,
    StakeholderViewSet,
    StrategicScenarioViewSet,
    AttackPathViewSet,
    OperationalScenarioViewSet,
    ElementaryActionViewSet,
    OperatingModeViewSet,
)

app_name = 'ebios_rm_mit'

router = DefaultRouter()
router.register(r'studies', EbiosRMStudyViewSet, basename='study')
router.register(r'feared-events', FearedEventViewSet, basename='feared-event')
router.register(r'risk-origins', RiskOriginViewSet, basename='risk-origin')
router.register(r'target-objectives', TargetObjectiveViewSet, basename='target-objective')
router.register(r'rotos', RoToViewSet, basename='roto')
router.register(r'stakeholders', StakeholderViewSet, basename='stakeholder')
router.register(r'strategic-scenarios', StrategicScenarioViewSet, basename='strategic-scenario')
router.register(r'attack-paths', AttackPathViewSet, basename='attack-path')
router.register(r'operational-scenarios', OperationalScenarioViewSet, basename='operational-scenario')
router.register(r'elementary-actions', ElementaryActionViewSet, basename='elementary-action')
router.register(r'operating-modes', OperatingModeViewSet, basename='operating-mode')

urlpatterns = [
    path('', include(router.urls)),
]
