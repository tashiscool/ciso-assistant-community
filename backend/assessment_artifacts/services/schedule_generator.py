"""
Schedule Generator Service

Analyzes ArtifactRequestItems in a package and generates EvidenceSchedule records
that group items by periodicity and collection type. Produces schedules like:

  - "Weekly Audit Log Reviews" (AU-6, AU-6(1), SI-4)
  - "Monthly Vulnerability Scans" (RA-5, SI-2, CM-6)
  - "Quarterly Account Recertifications" (AC-2, IA-4, PS-4)
  - "Annual Security Training" (AT-2, AT-3, AT-4)
  - "Annual Baseline Reviews" (CM-2, CM-6, CM-8, SA-10)
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

from ..models import ArtifactPackage, ArtifactRequestItem, EvidenceSchedule

logger = logging.getLogger(__name__)

# Cron expressions for standard frequencies
FREQUENCY_CRONS = {
    "weekly": "0 9 * * 1",       # Monday 9 AM
    "monthly": "0 9 1 * *",      # 1st of month 9 AM
    "quarterly": "0 9 1 */3 *",  # 1st of Jan/Apr/Jul/Oct
    "semi_annual": "0 9 1 */6 *",
    "annual": "0 9 1 1 *",       # January 1st
}

# Descriptive schedule name templates per frequency × activity grouping
SCHEDULE_NAME_TEMPLATES = {
    "weekly": {
        "audit_log_reviews": "Weekly Audit Log Reviews",
        "alert_triage": "Weekly Alert Triage",
        "configuration_checks": "Weekly Configuration Checks",
        "change_control_audit": "Weekly Change Audit Review",
        "default": "Weekly Evidence Collection",
    },
    "monthly": {
        "vulnerability_scanning": "Monthly Vulnerability Scans",
        "poam_updates": "Monthly POA&M Updates",
        "security_reports": "Monthly Security Reports",
        "configuration_checks": "Monthly Configuration Baselines",
        "default": "Monthly Evidence Collection",
    },
    "quarterly": {
        "account_recertification": "Quarterly Account Recertifications",
        "baseline_validation": "Quarterly Baseline Validation",
        "penetration_testing": "Quarterly Penetration Testing",
        "default": "Quarterly Evidence Collection",
    },
    "semi_annual": {
        "default": "Semi-Annual Security Review",
    },
    "annual": {
        "security_training": "Annual Security Training",
        "policy_review": "Annual Policy Reviews",
        "risk_assessment": "Annual Risk Assessments",
        "baseline_validation": "Annual Baseline Reviews",
        "default": "Annual Evidence Collection",
    },
}

ACTIVITY_DEFAULT_FREQUENCY = {
    "audit_log_reviews": "weekly",
    "alert_triage": "weekly",
    "change_control_audit": "weekly",
    "configuration_checks": "monthly",
    "vulnerability_scanning": "monthly",
    "poam_updates": "monthly",
    "security_reports": "monthly",
    "account_recertification": "quarterly",
    "baseline_validation": "quarterly",
    "penetration_testing": "quarterly",
    "security_training": "annual",
    "policy_review": "annual",
    "risk_assessment": "annual",
    "default": "monthly",
}

ACTIVITY_LABELS = {
    "audit_log_reviews": "audit log reviews",
    "alert_triage": "alert triage and monitoring",
    "change_control_audit": "change control and maintenance audit",
    "configuration_checks": "configuration and hardening checks",
    "vulnerability_scanning": "vulnerability scanning and remediation tracking",
    "poam_updates": "POA&M updates and exception tracking",
    "security_reports": "security reporting",
    "account_recertification": "account recertification and privileged access review",
    "baseline_validation": "baseline and architecture validation",
    "penetration_testing": "penetration testing and adversary simulation",
    "security_training": "security awareness and role-based training",
    "policy_review": "policy and procedure review",
    "risk_assessment": "risk assessment activities",
    "default": "evidence collection",
}


class ScheduleGeneratorService:
    """
    Generates EvidenceSchedule records by grouping a package's request items
    by their detected periodicity and primary artifact type.
    """

    def generate_schedules(self, package: ArtifactPackage) -> list[EvidenceSchedule]:
        """
        Analyze all request items in *package* and create EvidenceSchedule
        records grouped by (periodicity, primary_artifact_type).

        Returns the list of created schedules.
        """
        # Remove existing schedules for re-generation
        package.evidence_schedules.all().delete()

        items = list(package.request_items.all())
        if not items:
            return []

        # Group items by effective operational cadence and activity type.
        groups: dict[tuple[str, str], list[ArtifactRequestItem]] = defaultdict(list)
        for item in items:
            activity_key = self._activity_key(item)
            frequency = self._effective_frequency(item, activity_key)
            if not frequency:
                continue
            groups[(frequency, activity_key)].append(item)

        created: list[EvidenceSchedule] = []
        for (frequency, activity_key), group_items in sorted(groups.items()):
            schedule = self._create_schedule(package, frequency, activity_key, group_items)
            schedule.save()
            schedule.request_items.set(group_items)
            created.append(schedule)

        return created

    def _create_schedule(
        self,
        package: ArtifactPackage,
        frequency: str,
        activity_key: str,
        items: list[ArtifactRequestItem],
    ) -> EvidenceSchedule:
        all_controls = sorted({c for item in items for c in item.controls})
        all_families = sorted({f for item in items for f in item.control_families})
        all_platforms = sorted({p for item in items for p in item.platform_tags})
        all_evidence_types = sorted({item.primary_artifact_type for item in items})
        all_commands = []
        for item in items:
            for cmd in item.commands:
                if cmd not in all_commands:
                    all_commands.append(cmd)

        name = self._schedule_name(frequency, activity_key)
        description = self._schedule_description(
            frequency, activity_key, all_families, items
        )

        collection_actions = self._build_collection_actions(items, all_commands[:20])

        return EvidenceSchedule(
            package=package,
            folder=package.folder,
            name=name,
            description=description,
            frequency=frequency if frequency in dict(EvidenceSchedule.Frequency.choices) else "monthly",
            cron_expression=FREQUENCY_CRONS.get(frequency, "0 9 1 * *"),
            control_families=all_families,
            controls=all_controls,
            evidence_types=all_evidence_types,
            platform_tags=all_platforms,
            collection_actions=collection_actions,
            items_count=len(items),
        )

    def _schedule_name(self, frequency: str, activity_key: str) -> str:
        freq_templates = SCHEDULE_NAME_TEMPLATES.get(frequency, {})
        frequency_title = frequency.replace("_", " ").title()
        if activity_key in freq_templates:
            return freq_templates[activity_key]
        if activity_key != "default":
            activity_title = activity_key.replace("_", " ").title()
            return f"{frequency_title} {activity_title}"
        return freq_templates.get("default", f"{frequency_title} Evidence Collection")

    def _schedule_description(
        self,
        frequency: str,
        activity_key: str,
        families: list[str],
        items: list[ArtifactRequestItem],
    ) -> str:
        family_list = ", ".join(families[:8])
        activity_label = ACTIVITY_LABELS.get(activity_key, ACTIVITY_LABELS["default"])
        return (
            f"Covers {len(items)} evidence requests across control families "
            f"{family_list}. Focuses on {activity_label} "
            f"on a {frequency} cadence."
        )

    def _activity_key(self, item: ArtifactRequestItem) -> str:
        text = item.artifact_request.lower()
        controls = {control.split("(")[0] for control in item.controls}
        workstreams = set(item.workstreams or [])

        if "PEN_TEST" in workstreams or "penetration test" in text or "pen test" in text:
            return "penetration_testing"
        if "poa&m" in text or "poam" in text or "CA-5" in controls:
            return "poam_updates"
        if "AU-6" in controls or ("audit log" in text and "review" in text):
            return "audit_log_reviews"
        if (
            {"SI-4", "IR-4", "IR-6", "AU-5"} & controls
            or "alert" in text
            or "triage" in text
            or "incident" in text
        ):
            return "alert_triage"
        if (
            {"RA-5", "SI-2", "SI-3"} & controls
            or item.primary_artifact_type == "scan_evidence"
            or "vulnerability scan" in text
        ):
            return "vulnerability_scanning"
        if (
            {"AC-2", "IA-4"} & controls
            and any(token in text for token in ("recert", "account", "privilege", "review"))
        ):
            return "account_recertification"
        if (
            {"CM-2", "CM-6", "PL-8"} & controls
            and any(token in text for token in ("baseline", "configuration", "architecture"))
        ):
            return "baseline_validation"
        if {"CM-3", "MA-2", "MA-4"} & controls or "change" in text:
            return "change_control_audit"
        if (
            {"AT-2", "AT-3", "CP-3", "IR-2"} & controls
            or item.primary_artifact_type == "training_artifact"
        ):
            return "security_training"
        if (
            item.primary_artifact_type in {"policy_document", "procedure_document", "plan_document"}
            or "PL-1" in controls
            or "policy" in text
        ):
            return "policy_review"
        if "RA-2" in controls or "risk assessment" in text:
            return "risk_assessment"
        if item.primary_artifact_type == "report":
            return "security_reports"
        if item.primary_artifact_type == "configuration_snapshot":
            return "configuration_checks"
        return "default"

    def _effective_frequency(
        self,
        item: ArtifactRequestItem,
        activity_key: str,
    ) -> str | None:
        if item.periodicity in FREQUENCY_CRONS:
            return item.periodicity
        if item.periodicity == "continuous":
            return "weekly"
        if item.periodicity == "event_driven":
            if activity_key in {"alert_triage", "audit_log_reviews", "change_control_audit"}:
                return "weekly"
            return ACTIVITY_DEFAULT_FREQUENCY.get(activity_key, ACTIVITY_DEFAULT_FREQUENCY["default"])
        if item.periodicity == "on_demand":
            return ACTIVITY_DEFAULT_FREQUENCY.get(activity_key)
        return None

    def _build_collection_actions(
        self,
        items: list[ArtifactRequestItem],
        commands: list[str],
    ) -> list[dict[str, Any]]:
        actions = []

        # Group by collection channel
        by_channel: dict[str, list[str]] = defaultdict(list)
        for item in items:
            by_channel[item.collection_channel].append(item.request_id)

        for channel, request_ids in sorted(by_channel.items()):
            action = {
                "channel": channel,
                "request_count": len(request_ids),
                "request_ids": request_ids[:10],
            }
            actions.append(action)

        if commands:
            actions.append({
                "channel": "cli_commands",
                "commands": commands,
                "note": "Execute these commands to gather evidence",
            })

        return actions

    def get_schedule_summary(self, package: ArtifactPackage) -> dict[str, Any]:
        """Return a dashboard-friendly summary of all schedules for a package."""
        schedules = list(package.evidence_schedules.all())
        by_frequency: dict[str, list[dict]] = defaultdict(list)

        for sched in schedules:
            by_frequency[sched.frequency].append({
                "id": str(sched.id),
                "name": sched.name,
                "items_count": sched.items_count,
                "controls_count": len(sched.controls),
                "control_families": sched.control_families,
                "cron": sched.cron_expression,
                "status": sched.status,
            })

        total_scheduled = sum(s.items_count for s in schedules)
        total_items = package.request_items.count()

        return {
            "total_items": total_items,
            "scheduled_items": total_scheduled,
            "unscheduled_items": total_items - total_scheduled,
            "schedule_count": len(schedules),
            "by_frequency": dict(by_frequency),
        }
