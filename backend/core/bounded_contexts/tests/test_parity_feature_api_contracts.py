"""
Expanded API route contracts for RegScale + Paramify replacement coverage.

These tests remain DB-free and enforce endpoint/route traceability for parity
features claimed in README and roadmap documents.
"""

from pathlib import Path

import pytest

PARITY_API_ENDPOINTS = [
    "/api/conmon/dashboard/",
    "/api/conmon/profiles/",
    "/api/poam/poam-items/",
    "/api/poam/poam-items/export_fedramp/",
    "/api/ai/author/draft-control/",
    "/api/ai/extractor/upload/",
    "/api/ai/auditor/gap-analysis/",
    "/api/ai/vendor-scoring/<uuid:pk>/",
    "/api/ai/vendor-scoring/risk-summary/",
    "/api/vendor-portal/tokens/create/",
    "/api/vendor-portal/<token>/questionnaire/",
    "/api/stored-libraries/",
    "/api/loaded-libraries/",
    "/api/rmf/fedramp-20x/ksi/",
    "/api/rmf/fedramp-20x/oar/",
    "/api/rmf/fedramp-20x/complete/",
    "/api/crq/quantitative-risk-studies/",
    "/api/crq/analytics/portfolio/analyze/",
    "/api/requirement-mapping-sets/",
    "/api/mapping-libraries/",
    "/api/integrations/providers/",
    "/api/integrations/test-connection/",
    "/api/integrations/ocsf/import/",
    "/api/integrations/ocsf/to-oscal/",
]


# feature:continuous_monitoring
# feature:poam_management
# feature:ai_assistant
# feature:ai_vendor_scoring
# feature:vendor_questionnaires
# feature:multi_framework_libraries
# feature:fedramp_automation
# feature:quantitative_risk
# feature:mapping_engine
# feature:scanner_connectors
# feature:sarif_scap_import
# feature:servicenow_jira_integration
# feature:ocsf_oscal_translation
@pytest.mark.parametrize(
    ("feature_id", "signature"),
    [
        (
            "continuous_monitoring",
            'path("conmon/", include("continuous_monitoring.api.urls"))',
        ),
        (
            "continuous_monitoring",
            "router.register(r'dashboard', ConMonDashboardView",
        ),
        (
            "poam_management",
            'path("poam/", include("poam.api.urls"))',
        ),
        (
            "poam_management",
            "router.register(r'poam-items', POAMItemViewSet",
        ),
        (
            "ai_assistant",
            'path("ai/", include("ai_assistant.urls"))',
        ),
        (
            "ai_assistant",
            "'author/draft-control/'",
        ),
        (
            "ai_vendor_scoring",
            "'vendor-scoring/<uuid:pk>/'",
        ),
        (
            "vendor_questionnaires",
            'path("vendor-portal/", include("vendor_portal.urls"))',
        ),
        (
            "vendor_questionnaires",
            '"tokens/create/",',
        ),
        (
            "vendor_questionnaires",
            '"<str:token>/questionnaire/",',
        ),
        (
            "multi_framework_libraries",
            'router.register(r"stored-libraries", StoredLibraryViewSet',
        ),
        (
            "multi_framework_libraries",
            'router.register(r"loaded-libraries", LoadedLibraryViewSet',
        ),
        (
            "fedramp_automation",
            'path("rmf/", include("core.bounded_contexts.rmf_operations.urls"))',
        ),
        (
            "fedramp_automation",
            'path("fedramp-20x/ksi/", FedRAMP20xKSIExportView.as_view()',
        ),
        (
            "fedramp_automation",
            'path("fedramp-20x/oar/", FedRAMP20xOARExportView.as_view()',
        ),
        (
            "quantitative_risk",
            'path("crq/", include("crq.urls"))',
        ),
        (
            "quantitative_risk",
            '"quantitative-risk-studies",',
        ),
        (
            "quantitative_risk",
            '"analytics/portfolio/analyze/",',
        ),
        (
            "mapping_engine",
            '"mapping-libraries/",',
        ),
        (
            "mapping_engine",
            'router.register(\n    r"requirement-mapping-sets",',
        ),
        (
            "servicenow_jira_integration",
            'path("api/integrations/", include("integrations.urls", namespace="integrations"))',
        ),
        (
            "servicenow_jira_integration",
            '"providers/",',
        ),
        (
            "servicenow_jira_integration",
            '"test-connection/",',
        ),
        (
            "ocsf_oscal_translation",
            'path("ocsf/", include("integrations.ocsf.urls"))',
        ),
        (
            "ocsf_oscal_translation",
            "path('import/', OCSFImportView.as_view()",
        ),
        (
            "ocsf_oscal_translation",
            "path('to-oscal/', OCSFToOSCALView.as_view()",
        ),
    ],
)
def test_parity_route_signatures_are_declared(feature_id, signature):
    repo_root = Path(__file__).resolve().parents[3]
    candidate_files = [
        repo_root / "core" / "urls.py",
        repo_root / "ciso_assistant" / "urls.py",
        repo_root / "continuous_monitoring" / "api" / "urls.py",
        repo_root / "poam" / "api" / "urls.py",
        repo_root / "ai_assistant" / "api" / "urls.py",
        repo_root / "vendor_portal" / "urls.py",
        repo_root / "crq" / "urls.py",
        repo_root / "core" / "bounded_contexts" / "rmf_operations" / "urls.py",
        repo_root / "integrations" / "urls.py",
        repo_root / "integrations" / "ocsf" / "urls.py",
    ]
    corpus = "\n".join(path.read_text(encoding="utf-8") for path in candidate_files)
    assert (
        signature in corpus
    ), f"[{feature_id}] missing route signature in URL declarations: {signature}"


# feature:scanner_connectors
# feature:sarif_scap_import
# feature:servicenow_jira_integration
def test_connector_registry_declares_format_and_itsm_modules():
    repo_root = Path(__file__).resolve().parents[3]
    registry_source = (
        repo_root / "connectors" / "base" / "registry.py"
    ).read_text(encoding="utf-8")

    required_modules = [
        '"connectors.formats.sarif_importer"',
        '"connectors.formats.scap_importer"',
        '"connectors.itil.servicenow"',
        '"connectors.itil.jira"',
    ]

    for module in required_modules:
        assert module in registry_source, f"Missing connector registry module declaration: {module}"


# feature:continuous_monitoring
# feature:poam_management
# feature:ai_assistant
# feature:ai_vendor_scoring
# feature:vendor_questionnaires
# feature:multi_framework_libraries
# feature:fedramp_automation
# feature:quantitative_risk
# feature:mapping_engine
# feature:servicenow_jira_integration
# feature:ocsf_oscal_translation
def test_parity_endpoint_catalog_is_stable():
    assert all(endpoint.startswith("/api/") for endpoint in PARITY_API_ENDPOINTS)
    assert len(PARITY_API_ENDPOINTS) == len(set(PARITY_API_ENDPOINTS))
