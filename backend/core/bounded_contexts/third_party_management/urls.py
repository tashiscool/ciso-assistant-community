"""
URL configuration for ThirdPartyManagement bounded context API
"""

from django.urls import path, include
from rest_framework import routers
from .views import ThirdPartyViewSet

router = routers.DefaultRouter()
router.register(r'entities', ThirdPartyViewSet, basename='entities')  # Frontend expects /third-party/entities/

urlpatterns = [
    path('', include(router.urls)),
]

