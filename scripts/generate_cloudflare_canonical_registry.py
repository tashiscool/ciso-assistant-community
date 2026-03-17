#!/usr/bin/env python3
"""Generate source-derived Cloudflare canonical registries.

Outputs:
- docs/cloudflare-canonical-registry.json
- cloudflare/migrations/0008_canonical_registry_seed.sql
"""

from __future__ import annotations

import ast
import inspect
import json
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
DOCS_PATH = REPO_ROOT / "docs" / "cloudflare-canonical-registry.json"
SQL_PATH = REPO_ROOT / "cloudflare" / "migrations" / "0008_canonical_registry_seed.sql"


@dataclass(frozen=True)
class RouteEntry:
    route_path: str
    route_kind: str
    source_module: str
    target_name: str


class UrlModuleParser(ast.NodeVisitor):
    def __init__(self) -> None:
        self.routers: set[str] = set()
        self.router_resources: dict[str, list[tuple[str, str | None]]] = {}
        self.paths: list[dict[str, str | None]] = []
        self.urlpatterns_router: set[str] = set()

    def visit_Assign(self, node: ast.Assign) -> Any:
        if isinstance(node.value, ast.Call):
            func = node.value.func
            func_name = func.id if isinstance(func, ast.Name) else func.attr if isinstance(func, ast.Attribute) else None
            if func_name and "Router" in func_name:
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        self.routers.add(target.id)
                        self.router_resources.setdefault(target.id, [])

        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == "urlpatterns":
                value = node.value
                if isinstance(value, ast.Attribute) and isinstance(value.value, ast.Name) and value.attr == "urls":
                    if value.value.id in self.routers:
                        self.urlpatterns_router.add(value.value.id)

        self.generic_visit(node)

    def visit_Expr(self, node: ast.Expr) -> Any:
        call = node.value
        if isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute):
            if isinstance(call.func.value, ast.Name) and call.func.value.id in self.routers and call.func.attr == "register":
                prefix = "<dynamic>"
                if call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str):
                    prefix = call.args[0].value
                basename = None
                for kw in call.keywords:
                    if kw.arg == "basename" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
                        basename = kw.value.value
                self.router_resources.setdefault(call.func.value.id, []).append((prefix, basename))
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> Any:
        func_name = node.func.id if isinstance(node.func, ast.Name) else node.func.attr if isinstance(node.func, ast.Attribute) else None
        if func_name not in ("path", "re_path"):
            self.generic_visit(node)
            return

        raw = None
        if node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
            raw = node.args[0].value
        elif node.args and isinstance(node.args[0], ast.JoinedStr):
            raw = "<fstring>"

        if raw is None:
            self.generic_visit(node)
            return

        kind = "view"
        target_name = None
        if len(node.args) > 1:
            arg = node.args[1]
            if isinstance(arg, ast.Call):
                func = arg.func
                if isinstance(func, ast.Name) and func.id == "include":
                    kind = "include"
                    if arg.args:
                        first = arg.args[0]
                        if isinstance(first, ast.Constant) and isinstance(first.value, str):
                            target_name = first.value
                        elif isinstance(first, ast.Attribute) and isinstance(first.value, ast.Name):
                            target_name = f"{first.value.id}.{first.attr}"
                        elif isinstance(first, ast.Tuple) and first.elts:
                            candidate = first.elts[0]
                            if isinstance(candidate, ast.Attribute) and isinstance(candidate.value, ast.Name):
                                target_name = f"{candidate.value.id}.{candidate.attr}"
                            elif isinstance(candidate, ast.Constant) and isinstance(candidate.value, str):
                                target_name = candidate.value
                elif isinstance(func, ast.Attribute) and func.attr == "as_view":
                    target_name = func.value.id if isinstance(func.value, ast.Name) else "<class-based-view>"
                else:
                    kind = "call"
            elif isinstance(arg, ast.Attribute) and isinstance(arg.value, ast.Name):
                target_name = f"{arg.value.id}.{arg.attr}"
            elif isinstance(arg, ast.Name):
                target_name = arg.id

        self.paths.append({"kind": kind, "raw": raw, "target": target_name, "func": func_name})
        self.generic_visit(node)


def join_path(prefix: str, suffix: str) -> str:
    left = prefix or "/"
    if not left.startswith("/"):
        left = "/" + left
    if not left.endswith("/"):
        left += "/"
    right = suffix[1:] if suffix.startswith("/") else suffix
    out = (left + right).replace("//", "/")
    return out if out.startswith("/") else "/" + out


def load_route_entries() -> list[RouteEntry]:
    file_map: dict[str, Path] = {}
    parsed: dict[str, UrlModuleParser] = {}
    for path in sorted(BACKEND_ROOT.rglob("urls.py")):
        module_name = ".".join(path.relative_to(BACKEND_ROOT).with_suffix("").parts)
        file_map[module_name] = path
        parser = UrlModuleParser()
        parser.visit(ast.parse(path.read_text()))
        parsed[module_name] = parser

    route_entries: list[RouteEntry] = []
    seen_modules: set[tuple[str, str]] = set()

    def emit_router(mount_prefix: str, module_name: str, parser: UrlModuleParser, router_name: str) -> None:
        for resource, basename in parser.router_resources.get(router_name, []):
            target = basename or resource
            route_entries.append(RouteEntry(join_path(mount_prefix, resource + "/"), "router-list", module_name, target))
            route_entries.append(RouteEntry(join_path(mount_prefix, resource + "/{id}/"), "router-detail", module_name, target))

    def traverse(module_name: str, prefix: str = "") -> None:
        key = (module_name, prefix)
        if key in seen_modules:
            return
        seen_modules.add(key)
        parser = parsed.get(module_name)
        if not parser:
            return

        for router_name in parser.urlpatterns_router:
            emit_router(prefix, module_name, parser, router_name)

        for path_spec in parser.paths:
            kind = path_spec["kind"]
            raw = path_spec["raw"] or ""
            target = path_spec["target"] or ""
            if kind == "view":
                route_entries.append(RouteEntry(join_path(prefix, raw), "direct", module_name, target or "view"))
                continue
            if kind == "include" and target:
                if target.endswith(".urls"):
                    router_name = target.split(".")[0]
                    if router_name in parser.router_resources:
                        emit_router(join_path(prefix, raw), module_name, parser, router_name)
                    elif target in parsed:
                        traverse(target, join_path(prefix, raw))
                continue
            if kind == "call":
                route_entries.append(RouteEntry(join_path(prefix, raw), "call", module_name, target or "call"))

    traverse("ciso_assistant.urls", "")

    deduped: dict[str, RouteEntry] = {}
    for entry in sorted(route_entries, key=lambda item: (item.route_path, item.route_kind, item.source_module, item.target_name)):
        deduped.setdefault(entry.route_path, entry)
    return list(deduped.values())


def setup_django() -> None:
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ciso_assistant.settings")
    import django

    django.setup()


def load_model_entries() -> list[dict[str, Any]]:
    setup_django()
    from django.apps import apps

    entries: list[dict[str, Any]] = []
    for model in apps.get_models():
        model_key = f"{model.__module__}.{model.__name__}"
        fields: list[str] = []
        relations: list[dict[str, str]] = []

        for field in model._meta.get_fields():
            if field.auto_created and not field.concrete:
                continue
            fields.append(field.name)
            if getattr(field, "is_relation", False):
                target_model = getattr(field.remote_field, "model", None)
                target_key = ""
                if target_model is not None and hasattr(target_model, "__module__") and hasattr(target_model, "__name__"):
                    target_key = f"{target_model.__module__}.{target_model.__name__}"
                relations.append(
                    {
                        "name": field.name,
                        "kind": field.__class__.__name__,
                        "target_model_key": target_key,
                    }
                )

        source_file = inspect.getsourcefile(model) or ""
        entries.append(
            {
                "model_key": model_key,
                "app_label": model._meta.app_label,
                "model_name": model.__name__,
                "db_table": model._meta.db_table,
                "source_module": model.__module__,
                "source_file": source_file,
                "pk_field": model._meta.pk.name,
                "field_names": sorted(set(fields)),
                "relation_fields": sorted(relations, key=lambda item: (item["name"], item["kind"], item["target_model_key"])),
            }
        )

    return sorted(entries, key=lambda item: item["model_key"])


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    text = json.dumps(value, sort_keys=True) if isinstance(value, (dict, list)) else str(value)
    return "'" + text.replace("'", "''") + "'"


def write_outputs(route_entries: list[RouteEntry], model_entries: list[dict[str, Any]]) -> None:
    generated_at = datetime.now(UTC).replace(microsecond=0).isoformat()

    docs_payload = {
        "generated_at": generated_at,
        "model_count": len(model_entries),
        "route_count": len(route_entries),
        "models": model_entries,
        "routes": [entry.__dict__ for entry in route_entries],
    }
    DOCS_PATH.write_text(json.dumps(docs_payload, indent=2) + "\n")

    lines = [
        "PRAGMA foreign_keys = ON;",
        "DELETE FROM canonical_model_registry;",
    ]
    for entry in model_entries:
        lines.append(
            "INSERT INTO canonical_model_registry (model_key, app_label, model_name, db_table, source_module, source_file, pk_field, field_names_json, relation_fields_json, created_at, updated_at) VALUES ("
            + ", ".join(
                [
                    sql_literal(entry["model_key"]),
                    sql_literal(entry["app_label"]),
                    sql_literal(entry["model_name"]),
                    sql_literal(entry["db_table"]),
                    sql_literal(entry["source_module"]),
                    sql_literal(entry["source_file"]),
                    sql_literal(entry["pk_field"]),
                    sql_literal(entry["field_names"]),
                    sql_literal(entry["relation_fields"]),
                    sql_literal(generated_at),
                    sql_literal(generated_at),
                ]
            )
            + ");"
        )

    lines.append("DELETE FROM canonical_route_registry;")
    for entry in route_entries:
        lines.append(
            "INSERT INTO canonical_route_registry (route_path, route_kind, source_module, target_name, created_at, updated_at) VALUES ("
            + ", ".join(
                [
                    sql_literal(entry.route_path),
                    sql_literal(entry.route_kind),
                    sql_literal(entry.source_module),
                    sql_literal(entry.target_name),
                    sql_literal(generated_at),
                    sql_literal(generated_at),
                ]
            )
            + ");"
        )

    SQL_PATH.write_text("\n".join(lines) + "\n")


def main() -> int:
    route_entries = load_route_entries()
    model_entries = load_model_entries()
    write_outputs(route_entries, model_entries)
    print(f"Wrote {DOCS_PATH} with {len(model_entries)} models and {len(route_entries)} mounted routes")
    print(f"Wrote {SQL_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
