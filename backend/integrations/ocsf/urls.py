"""
OCSF Integration URL Configuration
"""

from django.urls import path
from .views import (
    OCSFParseView,
    OCSFImportView,
    OCSFToOSCALView,
    OCSFSchemaView,
    OCSFUploadView,
)

urlpatterns = [
    path('parse/', OCSFParseView.as_view(), name='ocsf-parse'),
    path('import/', OCSFImportView.as_view(), name='ocsf-import'),
    path('to-oscal/', OCSFToOSCALView.as_view(), name='ocsf-to-oscal'),
    path('schema/', OCSFSchemaView.as_view(), name='ocsf-schema'),
    path('upload/', OCSFUploadView.as_view(), name='ocsf-upload'),
]
