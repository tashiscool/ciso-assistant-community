"""
Package Builder Service

Wraps the standalone build_assessment_artifact_package.py script logic to work
with Django models.  Accepts either a TSV file upload or direct JSON items and
produces an ArtifactPackage + ArtifactRequestItem records with computed stats,
indexes, playbooks, and quality reports.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from ..models import ArtifactPackage, ArtifactRequestItem

logger = logging.getLogger(__name__)

# ── Canonical patterns (mirrored from scripts/build_assessment_artifact_package.py)

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
    "AWS": ["aws", "guardduty", "cloudwatch", "vpc", "rds", "s3", "ebs", "ec2",
            "elasticsearch", "elasticache", "availability zones", "auto scaling", "kms"],
    "RHEL7": ["rhel 7", "rhel-7", "red hat enterprise linux 7"],
    "LINUX": ["linux", "uname -a", "yum ", "rpm ", "/etc/", "/proc/sys/"],
    "ORACLE_DB": ["oracle", "opatch", "listener.ora", "sqlnet.ora", "dba_", "v$parameter"],
    "POSTGRES_DB": ["postgres", "postgresql"],
    "WEB_APP": ["web application", "waf", "modsecurity", "rest api"],
    "NETWORK_BOUNDARY": ["openvpn", "ssh", "load balancer", "haproxy", "route-tables",
                         "flow logs", "acl", "firewall"],
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
    "aws ", "uname ", "yum ", "rpm ", "cat ", "dmesg ", "ntpstat",
    "opatch.pl", "openssl ", "describe-elasticsearch-domain",
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
        _normalize_spaces(t) for t in raw_drivers.replace(";", ",").split(",")
        if _normalize_spaces(t)
    ]
    workstreams, controls, supplemental_refs = [], [], []
    malformed_controls, unknown_tokens = [], []
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
    found = []
    for needle, at in ARTIFACT_TYPE_PATTERNS:
        if needle in lowered and at not in found:
            found.append(at)
    if not found:
        return ["generic_evidence"]
    ordered = [p for p in ARTIFACT_TYPE_PREFERENCE if p in found]
    for at in found:
        if at not in ordered:
            ordered.append(at)
    return ordered


def _detect_platform_tags(text: str) -> list[str]:
    lowered = text.lower()
    return sorted(
        tag for tag, needles in PLATFORM_TAG_PATTERNS.items()
        if any(n in lowered for n in needles)
    )


def _detect_time_scopes(text: str) -> list[str]:
    lowered = text.lower()
    return sorted(
        scope for scope, needles in TIME_SCOPE_PATTERNS.items()
        if any(n in lowered for n in needles)
    )


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

    if (
        "scan_evidence" in artifact_type_set
        or {"RA-5", "SI-2", "SI-3"} & control_bases
    ):
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
        if any(n in lowered for n in needles):
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
    commands, config_paths = [], []
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
    return {
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
    }.get(primary_artifact_type, "manual_collection")


def _suggest_extension(primary_artifact_type: str) -> str:
    return {
        "system_generated_output": "txt", "configuration_snapshot": "txt",
        "command_output": "txt", "scan_evidence": "csv", "report": "pdf",
        "policy_document": "pdf", "procedure_document": "pdf",
        "plan_document": "pdf", "records": "xlsx", "meeting_evidence": "pdf",
        "communication_evidence": "eml", "screenshot": "png",
        "inventory_listing": "csv",
    }.get(primary_artifact_type, "txt")


class PackageBuilderService:
    """
    Builds an ArtifactPackage from a TSV file upload or JSON rows.
    """

    def build_from_tsv(
        self,
        tsv_content: str,
        package: ArtifactPackage,
        *,
        source_name: str = "",
    ) -> tuple[ArtifactPackage, list[dict[str, Any]]]:
        """Parse TSV content and populate the package with request items."""
        rows = self._read_tsv(tsv_content)
        return self._build(rows, package, source_name=source_name)

    def build_from_template(
        self,
        template_key: str,
        package: ArtifactPackage,
    ) -> tuple[ArtifactPackage, list[dict[str, Any]]]:
        """Build from a built-in template (no file upload required)."""
        from .templates import get_template

        template = get_template(template_key)
        if not template:
            raise ValueError(f"Unknown template: {template_key}")

        items_data: list[dict[str, Any]] = []
        quality_issues: list[dict[str, Any]] = []

        for idx, tpl_item in enumerate(template["items"], start=1):
            controls = tpl_item["controls"]
            control_families = sorted({c.split("-")[0] for c in controls})
            control_domains = sorted({
                CONTROL_FAMILY_DOMAINS[f] for f in control_families if f in CONTROL_FAMILY_DOMAINS
            })
            request_id = f"REQ-{idx:04d}"
            primary_artifact_type = tpl_item.get("primary_artifact_type", "generic_evidence")
            slug = _slugify(tpl_item["artifact_request"][:120])
            extension = _suggest_extension(primary_artifact_type)

            item_data = {
                "request_id": request_id,
                "source_line": idx,
                "request_date": None,
                "category": tpl_item.get("category", "Unspecified"),
                "workstreams": [],
                "controls": controls,
                "control_families": control_families,
                "control_domains": control_domains,
                "supplemental_references": [],
                "artifact_request": tpl_item["artifact_request"],
                "artifact_types": [primary_artifact_type],
                "primary_artifact_type": primary_artifact_type,
                "collection_channel": tpl_item.get("collection_channel", "manual_collection"),
                "platform_tags": tpl_item.get("platform_tags", []),
                "time_scopes": [],
                "periodicity": tpl_item.get("periodicity", "on_demand"),
                "commands": tpl_item.get("commands", []),
                "config_paths": tpl_item.get("config_paths", []),
                "bundle_hint": {
                    "relative_path": f"artifacts/{request_id}-{slug}.{extension}",
                    "suggested_extension": extension,
                },
            }
            items_data.append(item_data)

        # Create ArtifactRequestItem records
        request_items = []
        for item_data in items_data:
            request_items.append(ArtifactRequestItem(
                package=package,
                folder=package.folder,
                request_id=item_data["request_id"],
                source_line=item_data["source_line"],
                category=item_data["category"],
                artifact_request=item_data["artifact_request"],
                request_date=item_data["request_date"],
                controls=item_data["controls"],
                control_families=item_data["control_families"],
                control_domains=item_data["control_domains"],
                workstreams=item_data["workstreams"],
                supplemental_references=item_data["supplemental_references"],
                primary_artifact_type=item_data["primary_artifact_type"],
                artifact_types=item_data["artifact_types"],
                collection_channel=item_data["collection_channel"],
                platform_tags=item_data["platform_tags"],
                time_scopes=item_data["time_scopes"],
                periodicity=item_data["periodicity"],
                commands=item_data["commands"],
                config_paths=item_data["config_paths"],
                bundle_hint=item_data["bundle_hint"],
            ))
        ArtifactRequestItem.objects.bulk_create(request_items)

        # Compute package-level aggregates
        package.stats = self._build_stats(items_data, quality_issues)
        package.indexes = self._build_indexes(items_data)
        package.collection_playbooks = self._build_playbooks(items_data)
        package.quality_report = {"issues": [], "quality_gate": "pass"}
        package.platform_tags = sorted({
            tag for item in items_data for tag in item.get("platform_tags", [])
        })
        package.source_file = f"template:{template_key}"
        package.save()

        return package, quality_issues

    def build_from_items(
        self,
        items_json: list[dict[str, Any]],
        package: ArtifactPackage,
    ) -> tuple[ArtifactPackage, list[dict[str, Any]]]:
        """Build from pre-parsed JSON items (API direct-create)."""
        rows = []
        for idx, item in enumerate(items_json, start=1):
            rows.append({
                "line_number": str(idx),
                "drivers": ",".join(item.get("controls", [])),
                "category": item.get("category", ""),
                "artifact": item.get("artifact_request", ""),
                "date": item.get("request_date", ""),
            })
        return self._build(rows, package, source_name="api")

    def _read_tsv(self, content: str) -> list[dict[str, str]]:
        rows = []
        reader = csv.reader(io.StringIO(content), delimiter="\t")
        for line_number, row in enumerate(reader, start=1):
            if not row or not any(cell.strip() for cell in row):
                continue
            if len(row) >= 4:
                drivers, category = row[0], row[1]
                artifact = "\t".join(row[2:-1]) if len(row) > 4 else row[2]
                date = row[-1]
            elif len(row) == 3:
                drivers, category, artifact = row
                date = ""
            elif len(row) == 2:
                drivers, artifact = row
                category, date = "", ""
            else:
                drivers, category, artifact, date = row[0], "", "", ""
            rows.append({
                "line_number": str(line_number),
                "drivers": drivers.strip(),
                "category": category.strip(),
                "artifact": artifact.strip(),
                "date": date.strip(),
            })
        return rows

    def _build(
        self,
        rows: list[dict[str, str]],
        package: ArtifactPackage,
        source_name: str = "",
    ) -> tuple[ArtifactPackage, list[dict[str, Any]]]:
        quality_issues: list[dict[str, Any]] = []
        items_data: list[dict[str, Any]] = []

        for idx, raw_row in enumerate(rows, start=1):
            item_data, issues = self._build_item(raw_row, idx)
            items_data.append(item_data)
            for issue in issues:
                quality_issues.append({
                    "request_id": item_data["request_id"],
                    "source_line": item_data["source_line"],
                    "issue": issue,
                })

        # Create ArtifactRequestItem records
        request_items = []
        for item_data in items_data:
            request_items.append(ArtifactRequestItem(
                package=package,
                folder=package.folder,
                request_id=item_data["request_id"],
                source_line=item_data["source_line"],
                category=item_data["category"],
                artifact_request=item_data["artifact_request"],
                request_date=item_data["request_date"],
                controls=item_data["controls"],
                control_families=item_data["control_families"],
                control_domains=item_data["control_domains"],
                workstreams=item_data["workstreams"],
                supplemental_references=item_data["supplemental_references"],
                primary_artifact_type=item_data["primary_artifact_type"],
                artifact_types=item_data["artifact_types"],
                collection_channel=item_data["collection_channel"],
                platform_tags=item_data["platform_tags"],
                time_scopes=item_data["time_scopes"],
                periodicity=item_data["periodicity"],
                commands=item_data["commands"],
                config_paths=item_data["config_paths"],
                bundle_hint=item_data["bundle_hint"],
            ))
        ArtifactRequestItem.objects.bulk_create(request_items)

        # Compute package-level aggregates
        package.stats = self._build_stats(items_data, quality_issues)
        package.indexes = self._build_indexes(items_data)
        package.collection_playbooks = self._build_playbooks(items_data)
        package.quality_report = {
            "issues": quality_issues,
            "quality_gate": "pass" if not quality_issues else "needs_review",
        }
        package.platform_tags = sorted({
            tag for item in items_data for tag in item.get("platform_tags", [])
        })
        package.source_file = source_name
        package.save()

        return package, quality_issues

    def _build_item(self, raw_row: dict[str, str], index: int) -> tuple[dict[str, Any], list[str]]:
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
            issues.append("Malformed controls: " + ", ".join(parsed_drivers.malformed_controls))
        if parsed_drivers.unknown_tokens:
            issues.append("Unknown driver tokens: " + ", ".join(parsed_drivers.unknown_tokens))
        if not parsed_drivers.controls and not parsed_drivers.workstreams:
            issues.append("No controls or workstreams parsed")
        if "placeholder" in artifact_text.lower():
            issues.append("Placeholder content detected")

        artifact_types = _detect_artifact_types(artifact_text)
        primary_artifact_type = artifact_types[0]
        combined_text = " ".join([raw_row["drivers"], artifact_text])
        platform_tags = _detect_platform_tags(combined_text)
        time_scopes = _detect_time_scopes(artifact_text)
        periodicity = _detect_periodicity(
            artifact_text,
            time_scopes,
            parsed_drivers.controls,
            artifact_types,
        )
        commands, config_paths = _extract_commands(artifact_text)

        control_families = sorted({c.split("-")[0] for c in parsed_drivers.controls})
        control_domains = sorted({
            CONTROL_FAMILY_DOMAINS[f] for f in control_families if f in CONTROL_FAMILY_DOMAINS
        })

        request_id = f"REQ-{index:04d}"
        slug = _slugify(artifact_text[:120])
        extension = _suggest_extension(primary_artifact_type)

        return {
            "request_id": request_id,
            "source_line": int(raw_row["line_number"]),
            "request_date": parsed_date,
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
        }, issues

    def _build_stats(
        self, items: list[dict[str, Any]], quality_issues: list[dict[str, Any]]
    ) -> dict[str, Any]:
        ctrl = Counter()
        ws = Counter()
        at = Counter()
        pt = Counter()
        pd = Counter()
        for item in items:
            ctrl.update(item["controls"])
            ws.update(item["workstreams"])
            at.update(item["artifact_types"])
            pt.update(item["platform_tags"])
            pd[item["periodicity"]] += 1
        return {
            "total_requests": len(items),
            "requests_with_quality_issues": len({i["request_id"] for i in quality_issues}),
            "unique_controls": len(ctrl),
            "unique_workstreams": len(ws),
            "unique_artifact_types": len(at),
            "unique_platform_tags": len(pt),
            "top_controls": ctrl.most_common(25),
            "top_workstreams": ws.most_common(10),
            "top_artifact_types": at.most_common(15),
            "top_platform_tags": pt.most_common(15),
            "periodicity_breakdown": dict(pd),
        }

    def _build_indexes(self, items: list[dict[str, Any]]) -> dict[str, dict[str, list[str]]]:
        by_control: dict[str, list[str]] = defaultdict(list)
        by_workstream: dict[str, list[str]] = defaultdict(list)
        by_artifact_type: dict[str, list[str]] = defaultdict(list)
        by_platform: dict[str, list[str]] = defaultdict(list)
        by_periodicity: dict[str, list[str]] = defaultdict(list)
        for item in items:
            rid = item["request_id"]
            for c in item["controls"]:
                by_control[c].append(rid)
            for w in item["workstreams"]:
                by_workstream[w].append(rid)
            for a in item["artifact_types"]:
                by_artifact_type[a].append(rid)
            for p in item["platform_tags"]:
                by_platform[p].append(rid)
            by_periodicity[item["periodicity"]].append(rid)

        def _sorted(idx):
            return {k: sorted(v) for k, v in sorted(idx.items())}

        return {
            "by_control": _sorted(by_control),
            "by_workstream": _sorted(by_workstream),
            "by_artifact_type": _sorted(by_artifact_type),
            "by_platform_tag": _sorted(by_platform),
            "by_periodicity": _sorted(by_periodicity),
        }

    def _build_playbooks(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        aws_cmds, linux_cmds, db_cmds = [], [], []
        for item in items:
            for cmd in item.get("commands", []):
                lo = cmd.lower()
                if "aws " in lo and cmd not in aws_cmds:
                    aws_cmds.append(cmd)
                if any(lo.startswith(p) for p in ("uname", "yum", "rpm", "cat", "dmesg", "ntpstat")) and cmd not in linux_cmds:
                    linux_cmds.append(cmd)
                if any(k in lo for k in ("opatch", "dba_", "v$", "postgres", "oracle")) and cmd not in db_cmds:
                    db_cmds.append(cmd)
        return [
            {
                "playbook_id": "AWS-COLLECT-01",
                "name": "AWS control-plane exports",
                "applies_to_platform_tags": ["AWS"],
                "required_channels": ["tool_export", "cli_capture"],
                "example_commands": aws_cmds[:30],
            },
            {
                "playbook_id": "RHEL7-COLLECT-01",
                "name": "RHEL/Linux host baseline evidence",
                "applies_to_platform_tags": ["RHEL7", "LINUX"],
                "required_channels": ["cli_capture", "tool_export"],
                "example_commands": linux_cmds[:30],
            },
            {
                "playbook_id": "DB-COLLECT-01",
                "name": "Database security evidence",
                "applies_to_platform_tags": ["ORACLE_DB", "POSTGRES_DB"],
                "required_channels": ["tool_export", "cli_capture"],
                "example_commands": db_cmds[:30],
            },
        ]
