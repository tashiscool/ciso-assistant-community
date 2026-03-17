#!/usr/bin/env python3
"""
Generate a route-by-route Cloudflare parity matrix.

Sources:
- qa/feature_coverage_manifest.json
- frontend/src and frontend/tests literal /api/* references
- backend/core/urls.py and backend/ciso_assistant/urls.py route families
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "docs" / "cloudflare-route-parity-matrix.md"
FEATURE_MANIFEST_PATH = REPO_ROOT / "qa" / "feature_coverage_manifest.json"

ROUTE_LITERAL_RE = re.compile(r"(/api(?:/[^\"'`\s)]+)?)")
TEMPLATE_PLACEHOLDER_RE = re.compile(r"\$\{[^}]+\}")
DJANGO_PARAM_RE = re.compile(r"<[^>]+>")
PATH_CALL_RE = re.compile(r'path\(\s*"([^"]+)"')

SYNTHETIC_ROUTES = {
    "/api/csrf/",
    "/api/iam/current-user/",
    "/api/iam/session-token/",
    "/api/settings/general/object/",
    "/api/settings/feature-flags/",
    "/api/settings/sso/info/",
}

DEDICATED_PREFIX_MAP: list[tuple[str, str]] = [
    (
        "/api/ai/vendor-scoring/",
        "/api/v2/commands/ai.vendor-scoring.requested + /api/v2/read/vendor-scoring-summary",
    ),
    ("/api/connectors/", "/api/v2/commands/connectors.sync.requested + /api/v2/read/connector-health"),
    (
        "/api/assessments/lightning/",
        "/api/v2/commands/lightning-assessment.upsert + /api/v2/read/lightning-assessment-summary",
    ),
    (
        "/api/version-history/",
        "/api/v2/commands/version-history.snapshot.requested + /api/v2/read/version-history-latest",
    ),
    (
        "/api/security-graph/",
        "/api/v2/commands/security-graph.ingest.requested + /api/v2/read/security-graph-nodes|security-graph-edges",
    ),
    (
        "/api/evidence-automation/",
        "/api/v2/commands/evidence.collection.requested + /api/v2/read/evidence-automation-status",
    ),
    (
        "/api/workflows/",
        "/api/v2/commands/workflow.execution.requested + /api/v2/read/workflow-execution-status",
    ),
    (
        "/api/oscal/",
        "/api/v2/commands/oscal.import.requested|oscal.export.requested + /api/v2/read/oscal-job-status",
    ),
    (
        "/api/conmon/",
        "/api/v2/commands/conmon.profile.refresh.requested + /api/v2/read/conmon-dashboard",
    ),
    ("/api/poam/", "/api/v2/commands/poam.item.upsert + /api/v2/read/poam-status"),
    ("/api/ai/", "/api/v2/commands/ai.assistant.run.requested + /api/v2/read/ai-assistant-status"),
    (
        "/api/vendor-portal/",
        "/api/v2/commands/vendor.questionnaire.upsert + /api/v2/read/vendor-questionnaire-status",
    ),
    (
        "/api/stored-libraries/",
        "/api/v2/commands/library.index.refresh.requested + /api/v2/read/framework-library-index",
    ),
    (
        "/api/loaded-libraries/",
        "/api/v2/commands/library.index.refresh.requested + /api/v2/read/framework-library-index",
    ),
    (
        "/api/rmf/fedramp-20x/",
        "/api/v2/commands/fedramp.automation.run.requested + /api/v2/read/fedramp-automation-status",
    ),
    ("/api/crq/", "/api/v2/commands/crq.compute.requested + /api/v2/read/crq-summary"),
    (
        "/api/requirement-mapping-sets/",
        "/api/v2/commands/mapping.compute.requested + /api/v2/read/mapping-summary",
    ),
    (
        "/api/mapping-libraries/",
        "/api/v2/commands/mapping.compute.requested + /api/v2/read/mapping-summary",
    ),
    (
        "/api/integrations/",
        "/api/v2/commands/servicenow.sync.requested|jira.sync.requested|ocsf.oscal.translate.requested + /api/v2/read/integration-sync-status|translation-status",
    ),
]

ACTION_SEGMENTS = {
    "activate",
    "archive",
    "build-table",
    "cascade-info",
    "complete",
    "deactivate",
    "delete_attachment",
    "download",
    "execute",
    "export",
    "global_score",
    "import",
    "object",
    "overdue",
    "preview_content",
    "risk-summary",
    "status",
    "test-connection",
    "to-oscal",
    "upload",
    "validate",
    "validate_for_generation",
}


@dataclass(frozen=True)
class RouteEntry:
    route: str
    source: str


def normalize_route(route: str) -> str:
    value = route.strip()
    if not value.startswith("/api"):
        return ""
    if any(token in value for token in ("${", "(", ")", "[", "]")):
        return ""
    value = value.split("?")[0]
    value = TEMPLATE_PLACEHOLDER_RE.sub("{param}", value)
    value = DJANGO_PARAM_RE.sub("{param}", value)
    if value.startswith("/api/v2"):
        return ""
    value = value.replace("//", "/")
    if value == "/api":
        value = "/api/"
    if value == "/api/":
        return ""
    if value.endswith("*"):
        return value
    if not value.endswith("/"):
        value = f"{value}/"
    return value


def is_placeholder(segment: str) -> bool:
    if segment == "{param}":
        return True
    lowered = segment.lower()
    if lowered in {"pk", "id", "uuid", "token", "slug"}:
        return True
    if lowered.startswith("{") and lowered.endswith("}"):
        return True
    if re.fullmatch(r"[0-9a-f-]{8,}", lowered):
        return True
    return False


def sanitize_namespace_segment(segment: str) -> str:
    return re.sub(r"[^a-z0-9_-]", "-", segment.lower())


def derive_bridge_equivalent(route: str) -> str:
    raw_segments = [segment for segment in route[len("/api/") :].split("/") if segment]
    non_placeholder_segments = [segment for segment in raw_segments if not is_placeholder(segment)]

    if not non_placeholder_segments:
        return (
            "GET /api/v2/legacy/state?tenant_id=<tenant>&domain=core | "
            "POST /api/v2/commands/core.upsert"
        )

    domain_segments = list(non_placeholder_segments)
    action = None
    if len(domain_segments) > 1 and domain_segments[-1] in ACTION_SEGMENTS:
        action = domain_segments.pop()

    namespace = ".".join(sanitize_namespace_segment(segment) for segment in domain_segments if segment) or "core"
    domain = "/".join(sanitize_namespace_segment(segment) for segment in domain_segments if segment) or "core"

    if action:
        command = f"POST /api/v2/commands/{namespace}.{sanitize_namespace_segment(action)}.requested"
    else:
        command = f"POST /api/v2/commands/{namespace}.upsert"

    read = f"GET /api/v2/legacy/state?tenant_id=<tenant>&domain={domain}"
    return f"{read} | {command}"


def classify_route(route: str) -> tuple[str, str]:
    if route in SYNTHETIC_ROUTES:
        return "Synthetic", "Frontend compat handler returns in-worker synthetic response."

    for prefix, equivalent in DEDICATED_PREFIX_MAP:
        if route.startswith(prefix):
            return "Dedicated", equivalent

    return "Bridge", derive_bridge_equivalent(route)


def collect_manifest_routes() -> list[RouteEntry]:
    payload = json.loads(FEATURE_MANIFEST_PATH.read_text(encoding="utf-8"))
    entries: list[RouteEntry] = []
    for feature in payload.get("features", []):
        feature_id = feature.get("id", "unknown")
        for endpoint in feature.get("backend_endpoints", []):
            normalized = normalize_route(str(endpoint))
            if normalized:
                entries.append(RouteEntry(normalized, f"qa/feature_coverage_manifest.json:{feature_id}"))
    return entries


def collect_frontend_literal_routes() -> list[RouteEntry]:
    entries: list[RouteEntry] = []
    roots = [REPO_ROOT / "frontend" / "src", REPO_ROOT / "frontend" / "tests"]
    for root in roots:
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".ts", ".js", ".svelte"}:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for match in ROUTE_LITERAL_RE.findall(text):
                normalized = normalize_route(match)
                if normalized and not normalized.startswith("/api/v2/"):
                    source = str(path.relative_to(REPO_ROOT))
                    entries.append(RouteEntry(normalized, source))
    return entries


def collect_backend_family_routes() -> list[RouteEntry]:
    entries: list[RouteEntry] = []
    for rel_path in ("backend/core/urls.py", "backend/ciso_assistant/urls.py"):
        path = REPO_ROOT / rel_path
        text = path.read_text(encoding="utf-8", errors="ignore")
        for raw in PATH_CALL_RE.findall(text):
            cleaned = raw.strip()
            if not cleaned:
                continue
            if cleaned.startswith("api/"):
                if cleaned == "api/":
                    continue
                normalized = normalize_route(f"/{cleaned}*")
                if normalized:
                    entries.append(RouteEntry(normalized, rel_path))
    return entries


def dedupe(entries: Iterable[RouteEntry]) -> dict[str, set[str]]:
    output: dict[str, set[str]] = {}
    for entry in entries:
        output.setdefault(entry.route, set()).add(entry.source)
    return output


def render_markdown(entries: dict[str, set[str]]) -> str:
    routes = sorted(entries.keys())
    by_status = {"Dedicated": 0, "Bridge": 0, "Synthetic": 0}
    rows: list[str] = []

    for route in routes:
        status, equivalent = classify_route(route)
        by_status[status] += 1
        sorted_sources = sorted(entries[route])
        if len(sorted_sources) > 3:
            source = ", ".join(sorted_sources[:3]) + f", +{len(sorted_sources) - 3} more"
        else:
            source = ", ".join(sorted_sources)
        rows.append(f"| `{route}` | `{equivalent}` | {status} | `{source}` |")

    lines = [
        "# Cloudflare Route Parity Matrix",
        "",
        "Generated by `scripts/generate_route_parity_matrix.py` on 2026-03-05.",
        "",
        "## Summary",
        "",
        f"- Total legacy routes inventoried: **{len(routes)}**",
        f"- Dedicated: **{by_status['Dedicated']}**",
        f"- Bridge: **{by_status['Bridge']}**",
        f"- Synthetic: **{by_status['Synthetic']}**",
        "",
        "## Matrix",
        "",
        "| Legacy route | /api/v2 equivalent | Status | Source |",
        "|---|---|---|---|",
    ]
    lines.extend(rows)
    lines.extend(
        [
            "",
            "## Status Definitions",
            "",
            "- `Dedicated`: explicit Cloudflare command/read model exists for this route family.",
            "- `Bridge`: routed through frontend `/api/[...segments]` compatibility into `/api/v2/commands/*` + `/api/v2/legacy/state`.",
            "- `Synthetic`: handled directly in the frontend compatibility layer without legacy backend calls.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> None:
    all_entries: list[RouteEntry] = []
    all_entries.extend(collect_manifest_routes())
    all_entries.extend(collect_frontend_literal_routes())
    all_entries.extend(collect_backend_family_routes())
    all_entries.extend(
        RouteEntry(route, "frontend/src/routes/api/[...segments]/+server.ts (synthetic)")
        for route in sorted(SYNTHETIC_ROUTES)
    )
    deduped = dedupe(all_entries)
    content = render_markdown(deduped)
    OUTPUT_PATH.write_text(content, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {len(deduped)} unique routes")


if __name__ == "__main__":
    main()
