"""Assessment Artifacts URLs — Main URL configuration."""

from django.urls import path, include

urlpatterns = [
    path("", include("assessment_artifacts.api.urls")),
]
