"""
Library URL Configuration - MIT Licensed

Clean-room implementation of library URL routing.
Copyright (c) 2026 Tash
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StoredLibraryViewSet, LoadedLibraryViewSet

app_name = 'library_mit'

router = DefaultRouter()
router.register(r'stored', StoredLibraryViewSet, basename='stored-library')
router.register(r'loaded', LoadedLibraryViewSet, basename='loaded-library')

urlpatterns = [
    path('', include(router.urls)),
]
