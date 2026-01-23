"""
Evidence Automation URLs - Main URL configuration
"""

from django.urls import path, include

urlpatterns = [
    path('', include('evidence_automation.api.urls')),
]
