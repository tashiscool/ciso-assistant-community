"""
ConMon Operational Rollup Service

Builds practical operational views for a ConMon profile:
- Cadence buckets (weekly/monthly/quarterly/yearly/event-driven)
- Thematic buckets (alerts triage, change governance, vuln mgmt, etc.)
- Ready views requested by auditors/operators (weekly reports, monthly reports,
  quarterly reviews, yearly reviews, alerts triaged, changes processed/audited/approved)
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
import re
from typing import Any

from django.utils import timezone

from continuous_monitoring.models import (
    ConMonProfile,
    ConMonActivityConfig,
    ConMonExecution,
)
from continuous_monitoring.services.conmon_service import ConMonService


class ConMonOperationalRollupService:
    """Generate cadence/theme rollups for a ConMon profile."""

    CONTROL_ID_RE = re.compile(r"\b([A-Z]{2}-\d+(?:\s*\(\d+\))?)\b")

    CADENCE_ORDER = [
        "continuous",
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "semi_annual",
        "annual",
        "biennial",
        "triennial",
        "event_driven",
        "unknown",
    ]

    THEME_DEFINITIONS = {
        "reporting": {
            "label": "Reporting and Status",
            "keywords": ["report", "status", "dashboard", "poa&m", "conmon"],
        },
        "alerts_triage": {
            "label": "Alerts and Triage",
            "keywords": ["alert", "triage", "monitor", "siem", "detection", "cloudwatch"],
        },
        "change_governance": {
            "label": "Changes Audited and Approved",
            "keywords": ["change", "ccb", "approval", "release", "deployment", "maintenance"],
        },
        "vulnerability_management": {
            "label": "Vulnerability Management",
            "keywords": ["vulnerab", "scan", "nessus", "patch", "remediation"],
        },
        "access_governance": {
            "label": "Access and Account Governance",
            "keywords": ["access", "account", "iam", "privilege", "role", "auth"],
        },
        "backup_recovery": {
            "label": "Backup and Recovery",
            "keywords": ["backup", "restore", "recovery", "contingency", "dr"],
        },
        "incident_response": {
            "label": "Incident Response",
            "keywords": ["incident", "ir", "spillage", "us-cert", "response"],
        },
        "configuration_compliance": {
            "label": "Configuration and Hardening",
            "keywords": ["config", "baseline", "hardening", "stig", "cis", "benchmark"],
        },
        "audit_logging": {
            "label": "Audit Logging and Review",
            "keywords": ["audit", "log", "rsyslog", "splunk", "trail", "forensic"],
        },
    }

    def __init__(self, profile_id: str):
        self.profile = ConMonProfile.objects.get(id=profile_id)
        self._service = ConMonService(profile_id=profile_id)

    def build(self, include_disabled: bool = False) -> dict[str, Any]:
        """Build operational rollup payload for a profile."""
        activities_qs = ConMonActivityConfig.objects.filter(
            profile=self.profile
        ).select_related("task_template")
        if not include_disabled:
            activities_qs = activities_qs.filter(enabled=True)

        cadence_groups: dict[str, list[dict[str, Any]]] = {
            cadence: [] for cadence in self.CADENCE_ORDER
        }
        theme_groups: dict[str, dict[str, Any]] = {
            key: {"label": value["label"], "activities": []}
            for key, value in self.THEME_DEFINITIONS.items()
        }

        all_activities: list[dict[str, Any]] = []

        for activity in activities_qs:
            frequency = self._resolve_frequency(activity)
            activity_payload = self._serialize_activity(activity, frequency)
            all_activities.append(activity_payload)

            if frequency not in cadence_groups:
                cadence_groups[frequency] = []
            cadence_groups[frequency].append(activity_payload)

            for theme_key in self._classify_themes(activity):
                theme_groups[theme_key]["activities"].append(activity_payload)

        for cadence, payloads in cadence_groups.items():
            cadence_groups[cadence] = self._sort_activities(payloads)

        for theme_key in theme_groups:
            theme_groups[theme_key]["activities"] = self._sort_activities(
                theme_groups[theme_key]["activities"]
            )
            theme_groups[theme_key]["count"] = len(theme_groups[theme_key]["activities"])

        metrics = self._build_metrics(include_disabled=include_disabled)

        return {
            "profile": {
                "id": str(self.profile.id),
                "name": self.profile.name,
                "profile_type": self.profile.profile_type,
                "status": self.profile.status,
            },
            "generated_at": timezone.now().isoformat(),
            "cadence_summary": {
                cadence: {
                    "count": len(activities),
                    "activities": activities,
                }
                for cadence, activities in cadence_groups.items()
                if activities
            },
            "theme_summary": {
                key: {
                    "label": payload["label"],
                    "count": payload["count"],
                    "activities": payload["activities"],
                }
                for key, payload in theme_groups.items()
                if payload["activities"]
            },
            "operational_views": {
                "weekly_reports": self._select_cadence_activities(
                    cadence_groups,
                    cadences={"weekly", "biweekly"},
                    keywords=("report", "status", "review", "audit", "scan"),
                ),
                "monthly_reports": self._select_cadence_activities(
                    cadence_groups,
                    cadences={"monthly"},
                    keywords=("report", "status", "poa&m", "scan", "inventory"),
                ),
                "quarterly_reviews": self._select_cadence_activities(
                    cadence_groups,
                    cadences={"quarterly", "semi_annual"},
                    keywords=("review", "recert", "assessment", "test"),
                ),
                "yearly_reviews": self._select_cadence_activities(
                    cadence_groups,
                    cadences={"annual", "biennial", "triennial"},
                    keywords=("annual", "assessment", "review", "test", "plan"),
                ),
                "alerts_triaged": theme_groups["alerts_triage"]["activities"],
                "changes_processed_audited_approved": theme_groups["change_governance"]["activities"],
            },
            "audit_traceability": self._build_audit_traceability(all_activities),
            "metrics": metrics,
        }

    def _build_metrics(self, include_disabled: bool = False) -> dict[str, Any]:
        """Build quick metrics aligned with operational rollup semantics."""
        today = timezone.localdate()
        lookback = today - timedelta(days=30)

        exec_qs = ConMonExecution.objects.filter(activity_config__profile=self.profile)
        if not include_disabled:
            exec_qs = exec_qs.filter(activity_config__enabled=True)

        overdue = exec_qs.filter(
            status__in=["pending", "in_progress"],
            due_date__lt=today,
        ).count()
        due_soon = exec_qs.filter(
            status="pending",
            due_date__gte=today,
            due_date__lte=today + timedelta(days=7),
        ).count()
        completed_30d = exec_qs.filter(
            status__in=["completed", "completed_late"],
            completed_date__gte=lookback,
        ).count()

        enabled_activity_count = ConMonActivityConfig.objects.filter(
            profile=self.profile,
            enabled=True,
        ).count()

        return {
            "enabled_activity_count": enabled_activity_count,
            "execution_overdue_count": overdue,
            "execution_due_soon_count": due_soon,
            "executions_completed_last_30d": completed_30d,
            "health": self._service._calculate_overall_health(self.profile),
        }

    def _resolve_frequency(self, activity: ConMonActivityConfig) -> str:
        """Resolve frequency using override first, then inferred ref pattern."""
        if activity.frequency_override and activity.frequency_override != "inherit":
            return activity.frequency_override

        inferred = self._service._infer_frequency_from_ref(activity.ref_id)
        return inferred if inferred else "unknown"

    def _classify_themes(self, activity: ConMonActivityConfig) -> list[str]:
        """Classify an activity into one or more operational themes."""
        text = " ".join(
            [
                activity.ref_id or "",
                activity.name or "",
                activity.requirement_urn or "",
                activity.notes or "",
            ]
        ).lower()

        matched: list[str] = []
        for key, config in self.THEME_DEFINITIONS.items():
            if any(keyword in text for keyword in config["keywords"]):
                matched.append(key)

        return matched

    def _serialize_activity(
        self,
        activity: ConMonActivityConfig,
        frequency: str,
    ) -> dict[str, Any]:
        """Serialize activity for rollup payload."""
        last_completed = self._service._get_last_completed(activity)
        next_due = self._service._get_next_due(activity)
        traceability = self._build_activity_traceability(activity)

        return {
            "id": str(activity.id),
            "ref_id": activity.ref_id,
            "name": activity.name,
            "frequency": frequency,
            "enabled": activity.enabled,
            "status": self._service._get_activity_status(activity),
            "completion_rate": self._service._calculate_activity_completion_rate(activity),
            "last_completed": last_completed.isoformat() if last_completed else None,
            "next_due": next_due.isoformat() if next_due else None,
            "mapped_controls": traceability["mapped_controls"],
            "control_families": traceability["control_families"],
            "control_enhancements": traceability["control_enhancements"],
            "audit_traceability": traceability,
        }

    def _sort_activities(self, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(items, key=lambda x: ((x.get("ref_id") or ""), (x.get("name") or "")))

    def _select_cadence_activities(
        self,
        cadence_groups: dict[str, list[dict[str, Any]]],
        cadences: set[str],
        keywords: tuple[str, ...],
    ) -> list[dict[str, Any]]:
        selected: list[dict[str, Any]] = []
        for cadence in cadences:
            selected.extend(cadence_groups.get(cadence, []))

        if not selected:
            return []

        filtered = []
        for activity in selected:
            text = f"{activity.get('ref_id', '')} {activity.get('name', '')}".lower()
            if any(keyword in text for keyword in keywords):
                filtered.append(activity)

        return filtered if filtered else selected

    def _build_activity_traceability(self, activity: ConMonActivityConfig) -> dict[str, Any]:
        """
        Build traceability chain for a single activity:
        requirement -> controls -> executions -> task nodes -> evidences.
        """
        from core.models import RequirementNode

        requirement = (
            RequirementNode.objects.filter(urn=activity.requirement_urn)
            .select_related("framework")
            .prefetch_related("reference_controls")
            .first()
        )

        controls: set[str] = set()
        if requirement:
            controls.update(
                self._extract_control_ids(
                    requirement.ref_id,
                    requirement.name,
                    requirement.description,
                    requirement.annotation,
                    requirement.typical_evidence,
                )
            )
            controls.update(
                self._normalize_control_id(rc.ref_id)
                for rc in requirement.reference_controls.all()
                if rc.ref_id
            )

        controls.update(
            self._extract_control_ids(
                activity.ref_id,
                activity.name,
                activity.notes,
            )
        )
        controls = {c for c in controls if c}

        control_families = sorted({control.split("-")[0] for control in controls})
        control_enhancements = sorted(control for control in controls if "(" in control)

        exec_qs = (
            ConMonExecution.objects.filter(activity_config=activity)
            .select_related("task_node")
            .prefetch_related("evidences")
            .order_by("-due_date")
        )

        execution_summaries: list[dict[str, Any]] = []
        evidence_map: dict[str, dict[str, Any]] = {}
        task_node_map: dict[str, dict[str, Any]] = {}
        recent_executions = list(exec_qs[:20])
        total_executions = exec_qs.count()

        for execution in recent_executions:
            evidence_ids: list[str] = []
            for evidence in execution.evidences.all():
                evidence_id = str(evidence.id)
                evidence_ids.append(evidence_id)
                evidence_map[evidence_id] = {
                    "id": evidence_id,
                    "name": evidence.name,
                    "status": evidence.status,
                    "expiry_date": evidence.expiry_date.isoformat()
                    if evidence.expiry_date
                    else None,
                }

            task_node_id = None
            if execution.task_node_id:
                task_node_id = str(execution.task_node_id)
                task_node_map[task_node_id] = {
                    "id": task_node_id,
                    "due_date": execution.task_node.due_date.isoformat()
                    if execution.task_node.due_date
                    else None,
                    "status": execution.task_node.status,
                }

            execution_summaries.append(
                {
                    "id": str(execution.id),
                    "status": execution.status,
                    "result": execution.result,
                    "due_date": execution.due_date.isoformat(),
                    "completed_date": execution.completed_date.isoformat()
                    if execution.completed_date
                    else None,
                    "task_node_id": task_node_id,
                    "evidence_ids": sorted(evidence_ids),
                }
            )

        overdue_count = exec_qs.filter(
            status__in=["pending", "in_progress"],
            due_date__lt=timezone.localdate(),
        ).count()
        completed_count = exec_qs.filter(
            status__in=["completed", "completed_late"]
        ).count()

        framework_payload = None
        requirement_payload = None
        if requirement:
            requirement_payload = {
                "urn": requirement.urn,
                "ref_id": requirement.ref_id,
                "name": requirement.name,
            }
            if requirement.framework:
                framework_payload = {
                    "urn": requirement.framework.urn,
                    "ref_id": requirement.framework.ref_id,
                    "name": requirement.framework.name,
                }

        return {
            "requirement": requirement_payload,
            "framework": framework_payload,
            "mapped_controls": sorted(controls),
            "control_families": control_families,
            "control_enhancements": control_enhancements,
            "execution_summary": {
                "total_executions": total_executions,
                "completed_count": completed_count,
                "overdue_count": overdue_count,
                "recent_executions": execution_summaries,
            },
            "task_nodes": sorted(
                task_node_map.values(), key=lambda x: ((x.get("due_date") or ""), x["id"])
            ),
            "evidences": sorted(
                evidence_map.values(), key=lambda x: ((x.get("name") or ""), x["id"])
            ),
        }

    def _build_audit_traceability(self, activities: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Build assessor-oriented indexes by control family and enhancement.
        """
        control_index: dict[str, list[dict[str, str]]] = defaultdict(list)
        family_index: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"controls": set(), "activities": []}
        )
        enhancement_index: dict[str, list[dict[str, str]]] = defaultdict(list)

        for activity in activities:
            activity_ref = {
                "activity_id": activity["id"],
                "ref_id": activity.get("ref_id") or "",
                "name": activity.get("name") or "",
            }
            controls = activity.get("mapped_controls") or []
            families = activity.get("control_families") or []
            enhancements = activity.get("control_enhancements") or []

            for control in controls:
                control_index[control].append(activity_ref)

            for family in families:
                family_index[family]["activities"].append(activity_ref)
                family_controls = [control for control in controls if control.startswith(f"{family}-")]
                family_index[family]["controls"].update(family_controls)

            for enhancement in enhancements:
                enhancement_index[enhancement].append(activity_ref)

        def _dedupe_activity_refs(refs: list[dict[str, str]]) -> list[dict[str, str]]:
            deduped: dict[str, dict[str, str]] = {}
            for ref in refs:
                deduped[ref["activity_id"]] = ref
            return sorted(
                deduped.values(),
                key=lambda x: ((x.get("ref_id") or ""), (x.get("name") or ""), x["activity_id"]),
            )

        return {
            "control_index": {
                control: {
                    "activity_count": len(_dedupe_activity_refs(refs)),
                    "activities": _dedupe_activity_refs(refs),
                }
                for control, refs in sorted(control_index.items())
            },
            "control_family_index": {
                family: {
                    "activity_count": len(_dedupe_activity_refs(payload["activities"])),
                    "controls": sorted(payload["controls"]),
                    "activities": _dedupe_activity_refs(payload["activities"]),
                }
                for family, payload in sorted(family_index.items())
            },
            "control_enhancement_index": {
                control: {
                    "activity_count": len(_dedupe_activity_refs(refs)),
                    "activities": _dedupe_activity_refs(refs),
                }
                for control, refs in sorted(enhancement_index.items())
            },
        }

    def _extract_control_ids(self, *texts: str | None) -> list[str]:
        controls: set[str] = set()
        for text in texts:
            if not text:
                continue
            normalized = str(text).upper().replace(" (", "(").replace(") ", ")")
            for match in self.CONTROL_ID_RE.findall(normalized):
                controls.add(self._normalize_control_id(match))
        return sorted(control for control in controls if control)

    @staticmethod
    def _normalize_control_id(control_id: str | None) -> str | None:
        if not control_id:
            return None
        normalized = str(control_id).strip().upper()
        normalized = re.sub(r"\s+", "", normalized)
        if not normalized:
            return None
        return normalized
