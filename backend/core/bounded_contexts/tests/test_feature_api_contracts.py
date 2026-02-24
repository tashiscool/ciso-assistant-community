"""
Route-level API contracts for critical replacement features.

These tests are intentionally DB-free so they can run even when optional
bounded-context tables are not migrated yet, while still enforcing endpoint
catalog and wiring coverage.
"""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest

from core.bounded_contexts.security_graph.api.graph_views import (
    AttackPathsView,
    BlastRadiusView,
    CriticalNodesView,
    CriticalPathsView,
    GraphStatisticsView,
    ImpactSummaryView,
    SecurityGraphFromFolderView,
    _get_accessible_domain_folder_ids,
    _user_can_access_domain_folder,
)

CRITICAL_API_ENDPOINTS = [
    "/api/connectors/instances/",
    "/api/connectors/registry/",
    "/api/assessments/lightning/",
    "/api/version-history/",
    "/api/version-history/snapshots/",
    "/api/version-history/diff/",
    "/api/version-history/audit/",
    "/api/security-graph/",
    "/api/security-graph/attack-paths/",
    "/api/evidence-automation/sources/",
    "/api/evidence-automation/source-types/",
    "/api/workflows/",
    "/api/oscal/import/validate/",
    "/api/oscal/export/",
]


# feature:connectors
# feature:assessments_lightning
# feature:version_history
# feature:security_graph
# feature:evidence_automation
# feature:workflows
# feature:oscal
@pytest.mark.parametrize(
    ("feature_id", "signature"),
    [
        ("connectors", 'path("connectors/", include("connectors.urls"))'),
        ("connectors", 'path("registry/", ConnectorRegistryView.as_view()'),
        ("assessments_lightning", 'path("assessments/", include("core.bounded_contexts.assessment_engine.urls"))'),
        ("version_history", 'path("version-history/", include("core.bounded_contexts.version_history.urls"))'),
        ("version_history", 'router.register("snapshots", VersionSnapshotViewSet'),
        ("version_history", 'router.register("diff", VersionDiffViewSet'),
        ("version_history", 'router.register("audit", AuditViewSet'),
        ("security_graph", "path('attack-paths/', AttackPathsView.as_view()"),
        ("evidence_automation", 'path("evidence-automation/", include("evidence_automation.urls"))'),
        ("evidence_automation", "router.register(r'sources', EvidenceSourceViewSet"),
        ("workflows", 'path("workflows/", include("core.bounded_contexts.workflow_engine.urls"))'),
        ("oscal", 'path("oscal/", include("oscal_integration.api.urls"))'),
        ("oscal", "router.register(r'import', OSCALImportViewSet"),
        ("oscal", "router.register(r'export', OSCALExportViewSet"),
    ],
)
def test_critical_feature_route_signatures_are_declared(feature_id, signature):
    repo_root = Path(__file__).resolve().parents[3]
    candidate_files = [
        repo_root / "core" / "urls.py",
        repo_root / "connectors" / "urls.py",
        repo_root / "core" / "bounded_contexts" / "assessment_engine" / "urls.py",
        repo_root / "core" / "bounded_contexts" / "version_history" / "urls.py",
        repo_root / "core" / "bounded_contexts" / "security_graph" / "urls.py",
        repo_root / "evidence_automation" / "urls.py",
        repo_root / "evidence_automation" / "api" / "urls.py",
        repo_root / "core" / "bounded_contexts" / "workflow_engine" / "urls.py",
        repo_root / "oscal_integration" / "api" / "urls.py",
    ]
    corpus = "\n".join(path.read_text(encoding="utf-8") for path in candidate_files)
    assert (
        signature in corpus
    ), f"[{feature_id}] missing route signature in URL declarations: {signature}"


def test_critical_endpoint_catalog_is_stable():
    assert all(endpoint.startswith("/api/") for endpoint in CRITICAL_API_ENDPOINTS)
    assert len(CRITICAL_API_ENDPOINTS) == len(set(CRITICAL_API_ENDPOINTS))


# feature:security_graph
def test_accessible_domain_folder_helper_enforces_limit_and_scoped_lookup():
    fake_folder_ids = ["f1", "f2", "f3", "f4"]
    fake_user = object()

    with (
        patch("iam.models.Folder.get_root_folder", return_value=object()),
        patch(
            "iam.models.RoleAssignment.get_accessible_folder_ids",
            return_value=fake_folder_ids,
        ) as scoped_lookup,
    ):
        result = _get_accessible_domain_folder_ids(fake_user, limit=2)

    scoped_lookup.assert_called_once()
    assert result == ["f1", "f2"]


# feature:security_graph
def test_user_can_access_domain_folder_checks_full_scope():
    user = object()
    folder_id = uuid4()
    with patch(
        "core.bounded_contexts.security_graph.api.graph_views._get_accessible_domain_folder_ids",
        return_value=[folder_id],
    ) as scoped_lookup:
        assert _user_can_access_domain_folder(user, folder_id) is True

    scoped_lookup.assert_called_once_with(user, limit=None)


# feature:security_graph
def test_attack_paths_rejects_explicit_folder_outside_user_scope():
    request = SimpleNamespace(
        data={
            "entry_point_id": str(uuid4()),
            "target_id": str(uuid4()),
            "folder_id": str(uuid4()),
        },
        user=SimpleNamespace(is_authenticated=True),
    )

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._user_can_access_domain_folder",
            return_value=False,
        ),
        patch("core.bounded_contexts.security_graph.api.graph_views.get_graph_builder") as builder,
    ):
        response = AttackPathsView().post(request)

    assert response.status_code == 403
    assert response.data["error"] == "Access denied for requested folder"
    builder.assert_not_called()


# feature:security_graph
def test_attack_paths_rejects_invalid_folder_id():
    request = SimpleNamespace(
        data={
            "entry_point_id": str(uuid4()),
            "target_id": str(uuid4()),
            "folder_id": "not-a-uuid",
        },
        user=SimpleNamespace(is_authenticated=True),
    )

    response = AttackPathsView().post(request)

    assert response.status_code == 400
    assert response.data["error"] == "Invalid folder_id"


# feature:security_graph
def test_attack_paths_without_folder_id_uses_full_iam_scope():
    request = SimpleNamespace(
        data={
            "entry_point_id": str(uuid4()),
            "target_id": str(uuid4()),
        },
        user=SimpleNamespace(is_authenticated=True),
    )

    class FakeCombinedGraph:
        def __init__(self):
            self.nodes = []
            self.edges = []

        def add_node(self, node):
            self.nodes.append(node)

        def add_edge(self, edge):
            self.edges.append(edge)

    folder_graph = SimpleNamespace(
        nodes={"n1": object()},
        edges={"e1": object()},
    )
    builder = SimpleNamespace(build_from_folder=lambda _fid: folder_graph)
    analyzer = SimpleNamespace(find_attack_paths=lambda *_args, **_kwargs: [])

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._get_accessible_domain_folder_ids",
            return_value=[uuid4(), uuid4()],
        ) as scoped_ids,
        patch(
            "core.bounded_contexts.security_graph.api.graph_views.SecurityGraph",
            FakeCombinedGraph,
        ),
        patch(
            "core.bounded_contexts.security_graph.api.graph_views.get_graph_builder",
            return_value=builder,
        ) as get_builder,
        patch(
            "core.bounded_contexts.security_graph.api.graph_views.get_blast_radius_analyzer",
            return_value=analyzer,
        ),
    ):
        response = AttackPathsView().post(request)

    assert response.status_code == 200
    assert response.data["paths"] == []
    assert response.data["total_paths"] == 0
    scoped_ids.assert_called_once_with(request.user, limit=None)
    get_builder.assert_called_once()


# feature:security_graph
def test_attack_paths_without_folder_id_rejects_when_user_scope_is_empty():
    request = SimpleNamespace(
        data={
            "entry_point_id": str(uuid4()),
            "target_id": str(uuid4()),
        },
        user=SimpleNamespace(is_authenticated=True),
    )

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._get_accessible_domain_folder_ids",
            return_value=[],
        ) as scoped_ids,
        patch("core.bounded_contexts.security_graph.api.graph_views.get_graph_builder") as builder,
    ):
        response = AttackPathsView().post(request)

    assert response.status_code == 403
    assert response.data["error"] == "No accessible domain folders found"
    scoped_ids.assert_called_once_with(request.user, limit=None)
    builder.assert_not_called()


# feature:security_graph
def test_security_graph_folder_endpoint_rejects_folder_outside_user_scope():
    request = SimpleNamespace(
        query_params={},
        user=SimpleNamespace(is_authenticated=True),
    )

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._user_can_access_domain_folder",
            return_value=False,
        ),
        patch("core.bounded_contexts.security_graph.api.graph_views.get_graph_builder") as builder,
    ):
        response = SecurityGraphFromFolderView().get(request, uuid4())

    assert response.status_code == 403
    assert response.data["error"] == "Access denied for requested folder"
    builder.assert_not_called()


# feature:security_graph
def test_blast_radius_rejects_explicit_folder_outside_user_scope():
    request = SimpleNamespace(
        data={
            "source_node_id": str(uuid4()),
            "folder_id": str(uuid4()),
        },
        user=SimpleNamespace(is_authenticated=True),
    )

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._user_can_access_domain_folder",
            return_value=False,
        ),
        patch("core.bounded_contexts.security_graph.api.graph_views.get_graph_builder") as builder,
    ):
        response = BlastRadiusView().post(request)

    assert response.status_code == 403
    assert response.data["error"] == "Access denied for requested folder"
    builder.assert_not_called()


# feature:security_graph
def test_impact_summary_rejects_folder_outside_user_scope():
    request = SimpleNamespace(
        data={
            "compromised_node_ids": [str(uuid4())],
            "folder_id": str(uuid4()),
        },
        user=SimpleNamespace(is_authenticated=True),
    )

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._user_can_access_domain_folder",
            return_value=False,
        ),
        patch("core.bounded_contexts.security_graph.api.graph_views.get_graph_builder") as builder,
    ):
        response = ImpactSummaryView().post(request)

    assert response.status_code == 403
    assert response.data["error"] == "Access denied for requested folder"
    builder.assert_not_called()


# feature:security_graph
def test_impact_summary_rejects_invalid_folder_id():
    request = SimpleNamespace(
        data={
            "compromised_node_ids": [str(uuid4())],
            "folder_id": "not-a-uuid",
        },
        user=SimpleNamespace(is_authenticated=True),
    )

    response = ImpactSummaryView().post(request)

    assert response.status_code == 400
    assert response.data["error"] == "Invalid folder_id"


# feature:security_graph
def test_critical_paths_rejects_folder_outside_user_scope():
    request = SimpleNamespace(
        query_params={},
        user=SimpleNamespace(is_authenticated=True),
    )

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._user_can_access_domain_folder",
            return_value=False,
        ),
        patch("core.bounded_contexts.security_graph.api.graph_views.get_graph_builder") as builder,
    ):
        response = CriticalPathsView().get(request, uuid4())

    assert response.status_code == 403
    assert response.data["error"] == "Access denied for requested folder"
    builder.assert_not_called()


# feature:security_graph
def test_critical_nodes_rejects_folder_outside_user_scope():
    request = SimpleNamespace(
        query_params={},
        user=SimpleNamespace(is_authenticated=True),
    )

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._user_can_access_domain_folder",
            return_value=False,
        ),
        patch("core.bounded_contexts.security_graph.api.graph_views.get_graph_builder") as builder,
    ):
        response = CriticalNodesView().get(request, uuid4())

    assert response.status_code == 403
    assert response.data["error"] == "Access denied for requested folder"
    builder.assert_not_called()


# feature:security_graph
def test_graph_statistics_rejects_folder_outside_user_scope():
    request = SimpleNamespace(
        query_params={},
        user=SimpleNamespace(is_authenticated=True),
    )

    with (
        patch(
            "core.bounded_contexts.security_graph.api.graph_views._user_can_access_domain_folder",
            return_value=False,
        ),
        patch("core.bounded_contexts.security_graph.api.graph_views.get_graph_builder") as builder,
    ):
        response = GraphStatisticsView().get(request, uuid4())

    assert response.status_code == 403
    assert response.data["error"] == "Access denied for requested folder"
    builder.assert_not_called()
