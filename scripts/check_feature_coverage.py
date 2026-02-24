#!/usr/bin/env python3
"""
Validate critical feature coverage manifest integrity and traceability.

Checks performed:
1) Each frontend route in the manifest resolves to a real internal route file.
2) Each feature has explicit frontend/backend coverage tags in tests.
3) Each listed frontend route is referenced by frontend tests.
4) Each listed backend endpoint is referenced by backend tests.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = REPO_ROOT / "qa" / "feature_coverage_manifest.json"


def _collect_text(paths: list[Path]) -> str:
    chunks: list[str] = []
    for path in paths:
        try:
            chunks.append(path.read_text(encoding="utf-8"))
        except UnicodeDecodeError:
            continue
    return "\n".join(chunks)


def _frontend_route_exists(route: str) -> bool:
    cleaned = route.strip("/")
    route_dir = (
        REPO_ROOT
        / "frontend"
        / "src"
        / "routes"
        / "(app)"
        / "(internal)"
        / cleaned
    )
    if not route_dir.exists():
        return False

    candidate_files = [
        route_dir / "+page.svelte",
        route_dir / "+page.ts",
        route_dir / "+page.js",
        route_dir / "+page.server.ts",
        route_dir / "+page.server.js",
    ]
    return any(path.exists() for path in candidate_files)


def main() -> int:
    if not MANIFEST_PATH.exists():
        print(f"ERROR: missing manifest: {MANIFEST_PATH}")
        return 1

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    features = manifest.get("features", [])
    if not features:
        print("ERROR: manifest has no features")
        return 1

    frontend_tests = list((REPO_ROOT / "frontend" / "tests").rglob("*.test.ts"))
    frontend_tests += list((REPO_ROOT / "frontend" / "tests").rglob("*.spec.ts"))
    backend_tests = list((REPO_ROOT / "backend").rglob("test_*.py"))
    backend_tests += [p for p in (REPO_ROOT / "backend").rglob("*_test.py")]

    frontend_text = _collect_text(frontend_tests)
    backend_text = _collect_text(backend_tests)

    failures: list[str] = []
    seen_ids: set[str] = set()

    for feature in features:
        feature_id = feature.get("id")
        if not feature_id:
            failures.append("Feature entry is missing id")
            continue

        if feature_id in seen_ids:
            failures.append(f"Duplicate feature id: {feature_id}")
            continue
        seen_ids.add(feature_id)

        frontend_tag = feature.get("required_frontend_tag", "")
        backend_tag = feature.get("required_backend_tag", "")
        frontend_routes = feature.get("frontend_routes", [])
        backend_endpoints = feature.get("backend_endpoints", [])

        if not frontend_tag or frontend_tag not in frontend_text:
            failures.append(f"[{feature_id}] Missing frontend tag in tests: {frontend_tag}")
        if not backend_tag or backend_tag not in backend_text:
            failures.append(f"[{feature_id}] Missing backend tag in tests: {backend_tag}")

        for route in frontend_routes:
            if not _frontend_route_exists(route):
                failures.append(f"[{feature_id}] Frontend route not found in app routes: {route}")
            if route not in frontend_text:
                failures.append(
                    f"[{feature_id}] Frontend route not referenced by frontend tests: {route}"
                )

        for endpoint in backend_endpoints:
            if endpoint not in backend_text:
                failures.append(
                    f"[{feature_id}] Backend endpoint not referenced by backend tests: {endpoint}"
                )

    if failures:
        print("Feature coverage validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print(f"Feature coverage validation passed for {len(features)} features.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
