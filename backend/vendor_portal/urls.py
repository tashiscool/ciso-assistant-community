"""
URL Configuration for the Vendor Portal.

Public vendor-facing endpoints use token-based authentication.
Internal token management endpoints use standard CISO Assistant authentication.
"""

from django.urls import path

from .views import (
    VendorQuestionnaireView,
    VendorEvidenceUploadView,
    VendorPortalStatusView,
    VendorTokenCreateView,
    VendorTokenRevokeView,
)

app_name = "vendor_portal"

urlpatterns = [
    # ---------------------------------------------------------------
    # Public vendor-facing endpoints (token-authenticated)
    # ---------------------------------------------------------------
    path(
        "<str:token>/questionnaire/",
        VendorQuestionnaireView.as_view(),
        name="vendor-questionnaire",
    ),
    path(
        "<str:token>/evidence/",
        VendorEvidenceUploadView.as_view(),
        name="vendor-evidence-upload",
    ),
    path(
        "<str:token>/status/",
        VendorPortalStatusView.as_view(),
        name="vendor-status",
    ),

    # ---------------------------------------------------------------
    # Internal token management endpoints (standard auth)
    # ---------------------------------------------------------------
    path(
        "tokens/create/",
        VendorTokenCreateView.as_view(),
        name="vendor-token-create",
    ),
    path(
        "tokens/<str:token>/revoke/",
        VendorTokenRevokeView.as_view(),
        name="vendor-token-revoke",
    ),
]
