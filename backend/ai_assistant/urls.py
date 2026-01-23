"""
AI Assistant URLs - Main URL configuration
"""

from django.urls import path, include

urlpatterns = [
    path('', include('ai_assistant.api.urls')),
]
