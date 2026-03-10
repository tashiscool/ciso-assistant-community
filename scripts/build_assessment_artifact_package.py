#!/usr/bin/env python3
"""
Build a normalized assessment artifact package from a tab-delimited request list.

Expected input columns per row:
1) control/workstream tokens (comma-separated)
2) category/classification (optional)
3) artifact request text
4) date (MM/DD/YY, MM/DD/YYYY, or YYYY-MM-DD)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_PATH = REPO_ROOT / "qa" / "assessment_artifact_package.json"

CONTROL_CANONICAL_RE = re.compile(r"^[A-Z]{2}-\d+(?:\(\d+\))?$")
CONTROL_PARSE_RE = re.compile(r"^([A-Za-z]{2})-(\d+)(?:\s*\(?\s*(\d+)\s*\)?)?$")
FAMILY_ONLY_RE = re.compile(r"^[A-Za-z]{2}-$")

WORKSTREAM_ALIASES = {
    "SAP": "SAP",
    "SECURITY ASSESSMENT PLAN": "SAP",
    "PEN TEST": "PEN_TEST",
    "PENTEST": "PEN_TEST",
    "PENETRATION TEST": "PEN_TEST",
    "CORE CONTROL": "CORE_CONTROL",
    "ALL -1 CONTROLS": "POLICY_BASE_CONTROLS",
    "-1'S": "POLICY_BASE_CONTROLS",
    "-1S": "POLICY_BASE_CONTROLS",
    "CASEY COMMANDS": "SPECIAL_INSTRUCTION",
}

CONTROL_FAMILY_DOMAINS = {
    "AC": "Access Control and Authorization",
    "AT": "Awareness and Training",
    "AU": "Audit and Accountability",
    "CA": "Assessment and Authorization",
    "CM": "Configuration and Change Management",
    "CP": "Contingency Planning and Backup",
    "IA": "Identification and Authentication",
    "IR": "Incident Response",
    "MA": "Maintenance",
    "MP": "Media Protection",
    "PE": "Physical and Environmental Security",
    "PL": "Security Planning",
    "PS": "Personnel Security",
    "RA": "Risk and Vulnerability Management",
    "SA": "System and Service Acquisition",
    "SC": "System and Communications Protection",
    "SI": "System and Information Integrity",
}

ARTIFACT_TYPE_PATTERNS: list[tuple[str, str]] = [
    ("system-generated", "system_generated_output"),
    ("configuration", "configuration_snapshot"),
    ("screenshot", "screenshot"),
    ("policy", "policy_document"),
    ("procedure", "procedure_document"),
    ("plan", "plan_document"),
    ("matrix", "matrix_or_mapping"),
    ("listing", "inventory_listing"),
    ("roster", "records"),
    ("report", "report"),
    ("records", "records"),
    ("training", "training_artifact"),
    ("meeting", "meeting_evidence"),
    ("minutes", "meeting_evidence"),
    ("ticket", "ticketing_evidence"),
    ("email", "communication_evidence"),
    ("alert", "alert_evidence"),
    ("scan", "scan_evidence"),
    ("dump", "command_output"),
]

ARTIFACT_TYPE_PREFERENCE = [
    "system_generated_output",
    "configuration_snapshot",
    "command_output",
    "scan_evidence",
    "report",
    "policy_document",
    "procedure_document",
    "plan_document",
    "records",
    "meeting_evidence",
    "communication_evidence",
    "screenshot",
    "inventory_listing",
    "training_artifact",
    "matrix_or_mapping",
]

PLATFORM_TAG_PATTERNS: dict[str, list[str]] = {
    "AWS": [
        "aws",
        "guardduty",
        "cloudwatch",
        "vpc",
        "rds",
        "s3",
        "ebs",
        "ec2",
        "elasticsearch",
        "elasticache",
        "availability zones",
        "auto scaling",
        "kms",
    ],
    "RHEL7": ["rhel 7", "rhel-7", "red hat enterprise linux 7"],
    "LINUX": ["linux", "uname -a", "yum ", "rpm ", "/etc/", "/proc/sys/"],
    "ORACLE_DB": [
        "oracle",
        "opatch",
        "listener.ora",
        "sqlnet.ora",
        "dba_",
        "v$parameter",
    ],
    "POSTGRES_DB": ["postgres", "postgresql"],
    "WEB_APP": ["web application", "waf", "modsecurity", "rest api"],
    "NETWORK_BOUNDARY": [
        "openvpn",
        "ssh",
        "load balancer",
        "haproxy",
        "route-tables",
        "flow logs",
        "acl",
        "firewall",
    ],
    "SPLUNK": ["splunk", "inputs.conf", "outputs.conf", "indexes.conf"],
    "NESSUS": ["nessus"],
    "TREND_MICRO": ["trendmicro", "deep security"],
    "JENKINS": ["jenkins"],
    "TWILIO": ["twilio"],
    "USAJOBS": ["usajobs"],
    "DNS_EMAIL_AUTH": ["spf", "dkim", "dmarc", "dnssec"],
}

TIME_SCOPE_PATTERNS: dict[str, list[str]] = {
    "rolling_365_days": ["past 365 days"],
    "since_last_assessment": ["since the last assessment"],
    "sample_of_months": ["sample of months"],
    "sample_of_weeks": ["sample of weeks"],
    "sample_of_changes": ["sample of system changes", "sample of vulnerabilities"],
    "current_year": ["current year"],
    "annual_minimum": ["at least annually"],
    "weekly_minimum": ["at least weekly"],
    "monthly_minimum": ["at least monthly", "monthly"],
}

PERIODICITY_PATTERNS: dict[str, list[str]] = {
    "weekly": ["weekly", "at least weekly", "each week"],
    "monthly": ["monthly", "at least monthly", "each month", "every month"],
    "quarterly": ["quarterly", "every 90 days", "every quarter", "every three months"],
    "semi_annual": ["semi-annual", "semi annual", "every six months", "every 6 months"],
    "annual": ["annual", "annually", "at least annually", "yearly", "every year"],
    "continuous": ["continuous", "real-time", "ongoing"],
    "event_driven": [
        "triggered",
        "upon change",
        "upon termination",
        "upon transfer",
        "upon completion",
        "upon detection",
        "upon discovery",
        "upon return",
        "when new vulnerabilities",
        "when critical vulnerabilities",
        "when high vulnerabilities",
    ],
}

COMMAND_STARTERS = (
    "aws ",
    "uname ",
    "yum ",
    "rpm ",
    "cat ",
    "dmesg ",
    "ntpstat",
    "opatch.pl",
    "openssl ",
    "describe-elasticsearch-domain",
)

PATH_ONLY_RE = re.compile(r"^/(?:etc|proc|var|usr|opt)/[^\s]*$")


@dataclass
class ParsedDrivers:
    workstreams: list[str]
    controls: list[str]
    supplemental_references: list[str]
    malformed_controls: list[str]
    unknown_tokens: list[str]


def _normalize_spaces(value: str) -> str:
    return " ".join(value.strip().split())


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return cleaned[:80] if cleaned else "artifact"


def _parse_date(raw_date: str) -> tuple[str | None, str | None]:
    text = raw_date.strip()
    if not text:
        return None, None

    for fmt in ("%m/%d/%y", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date().isoformat(), None
        except ValueError:
            continue

    return None, f"Unrecognized date format: {text}"


def _normalize_control(token: str) -> tuple[str | None, str | None]:
    candidate = _normalize_spaces(token).upper().replace(" - ", "-")
    candidate = candidate.replace(" (", "(").replace(") ", ")")
    candidate = candidate.replace(" ", "")

    if CONTROL_CANONICAL_RE.match(candidate):
        return candidate, None

    match = CONTROL_PARSE_RE.match(candidate)
    if not match:
        return None, f"Malformed control token: {token.strip()}"

    family, number, enhancement = match.groups()
    normalized = f"{family.upper()}-{number}"
    if enhancement is not None:
        normalized += f"({enhancement})"
    return normalized, None


def _parse_drivers(raw_drivers: str) -> ParsedDrivers:
    tokens = [
        _normalize_spaces(token)
        for token in raw_drivers.replace(";", ",").split(",")
        if _normalize_spaces(token)
    ]

    workstreams: list[str] = []
    controls: list[str] = []
    supplemental_refs: list[str] = []
    malformed_controls: list[str] = []
    unknown_tokens: list[str] = []

    for token in tokens:
        upper = token.upper()

        if upper in WORKSTREAM_ALIASES:
            workstreams.append(WORKSTREAM_ALIASES[upper])
            continue

        if FAMILY_ONLY_RE.match(token):
            malformed_controls.append(token)
            continue

        if re.match(r"^\d{3}-\d{2}$", token):
            supplemental_refs.append(token)
            continue

        control, error = _normalize_control(token)
        if control:
            controls.append(control)
        elif error:
            malformed_controls.append(token)
        else:
            unknown_tokens.append(token)

    return ParsedDrivers(
        workstreams=sorted(set(workstreams)),
        controls=sorted(set(controls)),
        supplemental_references=sorted(set(supplemental_refs)),
        malformed_controls=sorted(set(malformed_controls)),
        unknown_tokens=sorted(set(unknown_tokens)),
    )


def _detect_artifact_types(text: str) -> list[str]:
    lowered = text.lower()
    found: list[str] = []
    for needle, artifact_type in ARTIFACT_TYPE_PATTERNS:
        if needle in lowered and artifact_type not in found:
            found.append(artifact_type)

    if not found:
        return ["generic_evidence"]

    ordered: list[str] = []
    for preferred in ARTIFACT_TYPE_PREFERENCE:
        if preferred in found:
            ordered.append(preferred)
    for artifact_type in found:
        if artifact_type not in ordered:
            ordered.append(artifact_type)
    return ordered


def _detect_platform_tags(text: str) -> list[str]:
    lowered = text.lower()
    tags: list[str] = []
    for tag, needles in PLATFORM_TAG_PATTERNS.items():
        if any(needle in lowered for needle in needles):
            tags.append(tag)
    return sorted(tags)


def _detect_time_scopes(text: str) -> list[str]:
    lowered = text.lower()
    scopes: list[str] = []
    for scope, needles in TIME_SCOPE_PATTERNS.items():
        if any(needle in lowered for needle in needles):
            scopes.append(scope)
    return sorted(scopes)


def _control_base(control: str) -> str:
    return control.split("(")[0]


def _infer_periodicity_from_controls(
    controls: list[str],
    artifact_types: list[str],
    text: str,
) -> str | None:
    lowered = text.lower()
    control_bases = {_control_base(control) for control in controls}
    control_families = {base.split("-")[0] for base in control_bases if "-" in base}
    artifact_type_set = set(artifact_types)

    if "AU-6" in control_bases and any(
        token in lowered for token in ("audit log", "log review", "sample of weeks", "reviewed")
    ):
        return "weekly"

    if "scan_evidence" in artifact_type_set or {"RA-5", "SI-2", "SI-3"} & control_bases:
        return "monthly"

    if ({"AC-2", "IA-4"} & control_bases) and any(
        token in lowered
        for token in ("recert", "review", "account", "privilege", "quarterly")
    ):
        return "quarterly"

    if {"IR-4", "IR-6", "SI-4", "AU-5"} & control_bases and any(
        token in lowered for token in ("alert", "incident", "triage", "monitor", "detection")
    ):
        return "weekly"

    if (
        {"AT-2", "AT-3", "CM-2", "CM-6", "PL-2", "RA-2"} & control_bases
        or {"training_artifact", "policy_document", "procedure_document", "plan_document"} & artifact_type_set
    ):
        return "annual"

    if "CM" in control_families and "change" in lowered:
        return "monthly"

    return None


def _detect_periodicity(
    text: str,
    time_scopes: list[str],
    controls: list[str],
    artifact_types: list[str],
) -> str:
    lowered = text.lower()
    for period, needles in PERIODICITY_PATTERNS.items():
        if any(needle in lowered for needle in needles):
            return period

    scope_to_period = {
        "sample_of_weeks": "weekly",
        "weekly_minimum": "weekly",
        "sample_of_months": "monthly",
        "sample_of_changes": "monthly",
        "monthly_minimum": "monthly",
        "annual_minimum": "annual",
        "rolling_365_days": "annual",
        "current_year": "annual",
    }
    for scope in time_scopes:
        if scope in scope_to_period:
            return scope_to_period[scope]

    hinted = _infer_periodicity_from_controls(controls, artifact_types, text)
    if hinted:
        return hinted

    return "on_demand"


def _extract_commands(text: str) -> tuple[list[str], list[str]]:
    commands: list[str] = []
    config_paths: list[str] = []

    for line in text.splitlines():
        cleaned = _normalize_spaces(re.sub(r"^\(?\d+\)?[.)]?\s*", "", line.strip()))
        if not cleaned:
            continue

        lowered = cleaned.lower()
        if lowered.startswith(COMMAND_STARTERS) or " aws " in f" {lowered} ":
            if cleaned not in commands:
                commands.append(cleaned)
            continue

        if PATH_ONLY_RE.match(cleaned):
            if cleaned not in config_paths:
                config_paths.append(cleaned)

    return commands, config_paths


def _collection_channel(primary_artifact_type: str) -> str:
    channel_map = {
        "system_generated_output": "tool_export",
        "configuration_snapshot": "tool_export",
        "command_output": "cli_capture",
        "scan_evidence": "scanner_export",
        "report": "report_export",
        "policy_document": "document_repository",
        "procedure_document": "document_repository",
        "plan_document": "document_repository",
        "records": "system_of_record_export",
        "meeting_evidence": "governance_records",
        "communication_evidence": "mail_ticket_export",
        "screenshot": "screenshot_capture",
    }
    return channel_map.get(primary_artifact_type, "manual_collection")


def _suggest_file_extension(primary_artifact_type: str) -> str:
    extension_map = {
        "system_generated_output": "txt",
        "configuration_snapshot": "txt",
        "command_output": "txt",
        "scan_evidence": "csv",
        "report": "pdf",
        "policy_document": "pdf",
        "procedure_document": "pdf",
        "plan_document": "pdf",
        "records": "xlsx",
        "meeting_evidence": "pdf",
        "communication_evidence": "eml",
        "screenshot": "png",
        "inventory_listing": "csv",
    }
    return extension_map.get(primary_artifact_type, "txt")


def _read_rows(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        for line_number, row in enumerate(reader, start=1):
            if not row or not any(cell.strip() for cell in row):
                continue

            if len(row) >= 4:
                drivers = row[0]
                category = row[1]
                artifact = "\t".join(row[2:-1]) if len(row) > 4 else row[2]
                date = row[-1]
            elif len(row) == 3:
                drivers, category, artifact = row
                date = ""
            elif len(row) == 2:
                drivers, artifact = row
                category = ""
                date = ""
            else:
                drivers = row[0]
                category = ""
                artifact = ""
                date = ""

            rows.append(
                {
                    "line_number": str(line_number),
                    "drivers": drivers.strip(),
                    "category": category.strip(),
                    "artifact": artifact.strip(),
                    "date": date.strip(),
                }
            )

    return rows


def _build_item(raw_row: dict[str, str], index: int) -> tuple[dict[str, Any], list[str]]:
    issues: list[str] = []

    parsed_drivers = _parse_drivers(raw_row["drivers"])
    category = raw_row["category"].strip() or "Unspecified"
    artifact_text = raw_row["artifact"].strip()
    parsed_date, date_error = _parse_date(raw_row["date"])

    if date_error:
        issues.append(date_error)
    if not artifact_text:
        issues.append("Missing artifact request text")

    if parsed_drivers.malformed_controls:
        issues.append(
            "Malformed controls: " + ", ".join(parsed_drivers.malformed_controls)
        )
    if parsed_drivers.unknown_tokens:
        issues.append("Unknown driver tokens: " + ", ".join(parsed_drivers.unknown_tokens))

    if not parsed_drivers.controls and not parsed_drivers.workstreams:
        issues.append("No controls or workstreams parsed")

    if "placeholder" in artifact_text.lower():
        issues.append("Placeholder content detected")

    artifact_types = _detect_artifact_types(artifact_text)
    primary_artifact_type = artifact_types[0]
    platform_tags = _detect_platform_tags(" ".join([raw_row["drivers"], artifact_text]))
    time_scopes = _detect_time_scopes(artifact_text)
    periodicity = _detect_periodicity(
        artifact_text,
        time_scopes,
        parsed_drivers.controls,
        artifact_types,
    )
    commands, config_paths = _extract_commands(artifact_text)

    control_families = sorted({control.split("-")[0] for control in parsed_drivers.controls})
    control_domains = sorted(
        {
            CONTROL_FAMILY_DOMAINS[family]
            for family in control_families
            if family in CONTROL_FAMILY_DOMAINS
        }
    )

    request_id = f"REQ-{index:04d}"
    slug = _slugify(artifact_text[:120])
    extension = _suggest_file_extension(primary_artifact_type)

    item = {
        "request_id": request_id,
        "source_line": int(raw_row["line_number"]),
        "request_date": parsed_date,
        "original_request_date": raw_row["date"],
        "category": category,
        "workstreams": parsed_drivers.workstreams,
        "controls": parsed_drivers.controls,
        "control_families": control_families,
        "control_domains": control_domains,
        "supplemental_references": parsed_drivers.supplemental_references,
        "artifact_request": artifact_text,
        "artifact_types": artifact_types,
        "primary_artifact_type": primary_artifact_type,
        "collection_channel": _collection_channel(primary_artifact_type),
        "platform_tags": platform_tags,
        "time_scopes": time_scopes,
        "periodicity": periodicity,
        "commands": commands,
        "config_paths": config_paths,
        "bundle_hint": {
            "relative_path": f"artifacts/{request_id}-{slug}.{extension}",
            "suggested_extension": extension,
        },
    }

    return item, issues


def _build_indexes(items: list[dict[str, Any]]) -> dict[str, dict[str, list[str]]]:
    by_control: dict[str, list[str]] = defaultdict(list)
    by_workstream: dict[str, list[str]] = defaultdict(list)
    by_artifact_type: dict[str, list[str]] = defaultdict(list)
    by_platform: dict[str, list[str]] = defaultdict(list)
    by_periodicity: dict[str, list[str]] = defaultdict(list)

    for item in items:
        request_id = item["request_id"]
        for control in item["controls"]:
            by_control[control].append(request_id)
        for workstream in item["workstreams"]:
            by_workstream[workstream].append(request_id)
        for artifact_type in item["artifact_types"]:
            by_artifact_type[artifact_type].append(request_id)
        for platform in item["platform_tags"]:
            by_platform[platform].append(request_id)
        by_periodicity[item["periodicity"]].append(request_id)

    def _sorted_index(index: dict[str, list[str]]) -> dict[str, list[str]]:
        return {key: sorted(value) for key, value in sorted(index.items())}

    return {
        "by_control": _sorted_index(by_control),
        "by_workstream": _sorted_index(by_workstream),
        "by_artifact_type": _sorted_index(by_artifact_type),
        "by_platform_tag": _sorted_index(by_platform),
        "by_periodicity": _sorted_index(by_periodicity),
    }


def _build_playbooks(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    aws_commands: list[str] = []
    linux_commands: list[str] = []
    db_commands: list[str] = []

    for item in items:
        for command in item.get("commands", []):
            lowered = command.lower()
            if "aws " in lowered and command not in aws_commands:
                aws_commands.append(command)
            if any(lowered.startswith(prefix) for prefix in ("uname", "yum", "rpm", "cat", "dmesg", "ntpstat")) and command not in linux_commands:
                linux_commands.append(command)
            if any(keyword in lowered for keyword in ("opatch", "dba_", "v$", "postgres", "oracle")) and command not in db_commands:
                db_commands.append(command)

    return [
        {
            "playbook_id": "AWS-COLLECT-01",
            "name": "AWS control-plane exports",
            "applies_to_platform_tags": ["AWS"],
            "required_channels": ["tool_export", "cli_capture"],
            "example_commands": aws_commands[:30],
        },
        {
            "playbook_id": "RHEL7-COLLECT-01",
            "name": "RHEL/Linux host baseline evidence",
            "applies_to_platform_tags": ["RHEL7", "LINUX"],
            "required_channels": ["cli_capture", "tool_export"],
            "example_commands": linux_commands[:30],
        },
        {
            "playbook_id": "DB-COLLECT-01",
            "name": "Database security evidence",
            "applies_to_platform_tags": ["ORACLE_DB", "POSTGRES_DB"],
            "required_channels": ["tool_export", "cli_capture"],
            "example_commands": db_commands[:30],
        },
    ]


def _build_stats(items: list[dict[str, Any]], quality_issues: list[dict[str, Any]]) -> dict[str, Any]:
    control_counter = Counter()
    workstream_counter = Counter()
    artifact_type_counter = Counter()
    platform_counter = Counter()
    periodicity_counter = Counter()

    for item in items:
        control_counter.update(item["controls"])
        workstream_counter.update(item["workstreams"])
        artifact_type_counter.update(item["artifact_types"])
        platform_counter.update(item["platform_tags"])
        periodicity_counter[item["periodicity"]] += 1

    return {
        "total_requests": len(items),
        "requests_with_quality_issues": len({issue["request_id"] for issue in quality_issues}),
        "unique_controls": len(control_counter),
        "unique_workstreams": len(workstream_counter),
        "unique_artifact_types": len(artifact_type_counter),
        "unique_platform_tags": len(platform_counter),
        "top_controls": control_counter.most_common(25),
        "top_workstreams": workstream_counter.most_common(10),
        "top_artifact_types": artifact_type_counter.most_common(15),
        "top_platform_tags": platform_counter.most_common(15),
        "periodicity_breakdown": dict(periodicity_counter),
    }


def _write_normalized_csv(path: Path, items: list[dict[str, Any]]) -> None:
    fieldnames = [
        "request_id",
        "source_line",
        "request_date",
        "category",
        "workstreams",
        "controls",
        "control_families",
        "artifact_request",
        "primary_artifact_type",
        "artifact_types",
        "collection_channel",
        "platform_tags",
        "time_scopes",
        "periodicity",
        "bundle_path",
    ]

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for item in items:
            writer.writerow(
                {
                    "request_id": item["request_id"],
                    "source_line": item["source_line"],
                    "request_date": item["request_date"],
                    "category": item["category"],
                    "workstreams": ",".join(item["workstreams"]),
                    "controls": ",".join(item["controls"]),
                    "control_families": ",".join(item["control_families"]),
                    "artifact_request": item["artifact_request"],
                    "primary_artifact_type": item["primary_artifact_type"],
                    "artifact_types": ",".join(item["artifact_types"]),
                    "collection_channel": item["collection_channel"],
                    "platform_tags": ",".join(item["platform_tags"]),
                    "time_scopes": ",".join(item["time_scopes"]),
                    "periodicity": item["periodicity"],
                    "bundle_path": item["bundle_hint"]["relative_path"],
                }
            )


def build_package(input_path: Path, source_name: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    raw_rows = _read_rows(input_path)

    items: list[dict[str, Any]] = []
    quality_issues: list[dict[str, Any]] = []

    for idx, raw_row in enumerate(raw_rows, start=1):
        item, issues = _build_item(raw_row, idx)
        items.append(item)

        for issue in issues:
            quality_issues.append(
                {
                    "request_id": item["request_id"],
                    "source_line": item["source_line"],
                    "issue": issue,
                }
            )

    package = {
        "metadata": {
            "schema": "assessment-artifact-package/v1",
            "generated_at": datetime.now(UTC).isoformat(),
            "source": source_name,
        },
        "abstractions": {
            "workstream_types": sorted(
                {
                    workstream
                    for item in items
                    for workstream in item.get("workstreams", [])
                }
            ),
            "artifact_type_taxonomy": sorted(
                {
                    artifact_type
                    for item in items
                    for artifact_type in item.get("artifact_types", [])
                }
            ),
            "platform_tag_taxonomy": sorted(
                {platform for item in items for platform in item.get("platform_tags", [])}
            ),
            "periodicity_types": sorted(
                {item["periodicity"] for item in items if item.get("periodicity")}
            ),
            "control_family_domains": CONTROL_FAMILY_DOMAINS,
        },
        "stats": _build_stats(items, quality_issues),
        "items": items,
        "indexes": _build_indexes(items),
        "collection_playbooks": _build_playbooks(items),
        "quality_report": {
            "issues": quality_issues,
            "quality_gate": "pass" if not quality_issues else "needs_review",
        },
    }

    return package, items


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Normalize request-list rows into a ready assessment artifact package.",
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Input tab-delimited request list file path.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT_PATH),
        help=f"Output JSON path (default: {DEFAULT_OUTPUT_PATH}).",
    )
    parser.add_argument(
        "--normalized-csv",
        default="",
        help="Optional output path for a flattened normalized CSV.",
    )

    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    package, items = build_package(input_path, source_name=str(input_path))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(package, indent=2), encoding="utf-8")

    if args.normalized_csv:
        csv_path = Path(args.normalized_csv).resolve()
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        _write_normalized_csv(csv_path, items)

    print(f"Wrote package: {output_path}")
    print(f"Requests: {package['stats']['total_requests']}")
    print(f"Unique controls: {package['stats']['unique_controls']}")
    print(f"Quality issues: {len(package['quality_report']['issues'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
