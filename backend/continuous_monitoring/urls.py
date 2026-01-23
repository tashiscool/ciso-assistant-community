"""
ConMon URL Configuration
"""

from django.urls import path, include

urlpatterns = [
    path('api/', include('continuous_monitoring.api.urls')),
]
