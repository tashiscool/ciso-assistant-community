"""
URL routing for OSCAL Integration API
"""

from django.urls import path, include
from rest_framework import routers

from .views import (
    OSCALImportViewSet, OSCALExportViewSet,
    FedRAMPValidationViewSet, SSPGenerationViewSet
)

# Create routers
import_router = routers.SimpleRouter()
import_router.register(r'import', OSCALImportViewSet, basename='oscal-import')

export_router = routers.SimpleRouter()
export_router.register(r'export', OSCALExportViewSet, basename='oscal-export')

fedramp_router = routers.SimpleRouter()
fedramp_router.register(r'validate', FedRAMPValidationViewSet, basename='fedramp-validation')

ssp_router = routers.SimpleRouter()
ssp_router.register(r'generate-ssp', SSPGenerationViewSet, basename='ssp-generation')

urlpatterns = [
    # OSCAL Import endpoints (at /api/oscal/import/...)
    path('', include(import_router.urls)),

    # OSCAL Export endpoints (at /api/oscal/export/...)
    path('', include(export_router.urls)),

    # FedRAMP Validation endpoints (at /api/oscal/fedramp/validate/...)
    path('fedramp/', include(fedramp_router.urls)),

    # SSP Generation endpoints (at /api/oscal/fedramp/generate-ssp/...)
    path('fedramp/', include(ssp_router.urls)),
]
