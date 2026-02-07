"""
Control Validation Service

Auto-validates control implementation status when evidence arrives,
findings are created or remediated, or scanner results are ingested.

This service bridges the gap between evidence/finding lifecycle and
control compliance status, enabling real-time continuous monitoring.
"""

import logging
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from django.utils import timezone

logger = logging.getLogger(__name__)

# Evidence freshness threshold in days
EVIDENCE_FRESHNESS_DAYS = 90


@dataclass
class ValidationResult:
    """Result of validating a single control's implementation status."""

    control_id: str
    previous_status: str
    new_status: str
    validation_method: str  # automatic, manual, scanner
    evidence_ids: List[str] = field(default_factory=list)
    findings: List[str] = field(default_factory=list)
    validated_at: datetime = field(default_factory=timezone.now)
    details: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        result = asdict(self)
        result["validated_at"] = self.validated_at.isoformat()
        return result


class ControlValidatorService:
    """
    Validates control implementation status based on evidence and findings.

    Validation logic:
    - No evidence at all -> not_assessed
    - Has evidence but all stale (> 90 days) -> partially_compliant (stale)
    - Has fresh evidence, no open findings -> compliant
    - Has fresh evidence, open findings exist -> non_compliant (at risk)
    - All findings remediated + fresh evidence -> compliant
    - Has evidence but incomplete coverage -> partially_compliant
    """

    def validate_control(self, applied_control_id: str) -> ValidationResult:
        """
        Validate a single control based on linked evidence and findings.

        Queries the AppliedControl model, checks linked evidences and any
        related compliance findings, then determines the new status.
        """
        try:
            from core.models import AppliedControl, Evidence
        except ImportError:
            logger.warning("AppliedControl or Evidence model not available")
            return ValidationResult(
                control_id=applied_control_id,
                previous_status="unknown",
                new_status="unknown",
                validation_method="automatic",
                details={"error": "Models not available"},
            )

        try:
            control = AppliedControl.objects.get(id=applied_control_id)
        except AppliedControl.DoesNotExist:
            logger.warning(f"AppliedControl {applied_control_id} not found")
            return ValidationResult(
                control_id=applied_control_id,
                previous_status="unknown",
                new_status="unknown",
                validation_method="automatic",
                details={"error": "Control not found"},
            )

        previous_status = control.status or "--"
        evidence_list = control.evidences.all()
        evidence_ids = [str(e.id) for e in evidence_list]

        # Gather findings linked to this control via requirement assessments
        open_findings = self._get_open_findings_for_control(control)
        finding_ids = [str(f.get("id", "")) for f in open_findings]

        # Determine new status
        new_status, details = self._determine_status(
            evidence_list, open_findings, control
        )

        result = ValidationResult(
            control_id=applied_control_id,
            previous_status=previous_status,
            new_status=new_status,
            validation_method="automatic",
            evidence_ids=evidence_ids,
            findings=finding_ids,
            details=details,
        )

        # Update the control status if it has changed
        if new_status != previous_status and new_status != "--":
            self._update_control_status(control, new_status)
            logger.info(
                f"Control {applied_control_id} status updated: "
                f"{previous_status} -> {new_status}"
            )

        return result

    def validate_assessment_controls(
        self, assessment_id: str
    ) -> List[ValidationResult]:
        """
        Validate all controls linked to a compliance assessment.

        Iterates through all RequirementAssessments in the assessment,
        collects their applied controls, and validates each one.
        """
        results = []

        try:
            from core.models import ComplianceAssessment, RequirementAssessment
        except ImportError:
            logger.warning("ComplianceAssessment model not available")
            return results

        try:
            assessment = ComplianceAssessment.objects.get(id=assessment_id)
        except ComplianceAssessment.DoesNotExist:
            logger.warning(f"ComplianceAssessment {assessment_id} not found")
            return results

        # Collect all unique applied controls from requirement assessments
        req_assessments = RequirementAssessment.objects.filter(
            compliance_assessment=assessment
        ).prefetch_related("applied_controls")

        validated_control_ids = set()
        for ra in req_assessments:
            for control in ra.applied_controls.all():
                if str(control.id) not in validated_control_ids:
                    validated_control_ids.add(str(control.id))
                    result = self.validate_control(str(control.id))
                    results.append(result)

        logger.info(
            f"Validated {len(results)} controls for assessment {assessment_id}"
        )
        return results

    def on_evidence_uploaded(self, evidence_id: str):
        """
        Trigger re-validation when new evidence is uploaded.

        Finds all applied controls linked to this evidence and
        re-validates each of them.
        """
        try:
            from core.models import Evidence
        except ImportError:
            logger.warning("Evidence model not available for validation trigger")
            return

        try:
            evidence = Evidence.objects.get(id=evidence_id)
        except Evidence.DoesNotExist:
            logger.warning(f"Evidence {evidence_id} not found for validation")
            return

        # Evidence is linked to controls via the applied_controls reverse relation
        linked_controls = evidence.applied_controls.all()
        validated_count = 0

        for control in linked_controls:
            try:
                result = self.validate_control(str(control.id))
                validated_count += 1
                logger.debug(
                    f"Re-validated control {control.id} after evidence upload: "
                    f"{result.previous_status} -> {result.new_status}"
                )
            except Exception as exc:
                logger.error(
                    f"Failed to validate control {control.id} "
                    f"after evidence {evidence_id} upload: {exc}"
                )

        # Also check requirement assessments linked to this evidence
        req_assessments = evidence.requirement_assessments.all()
        for ra in req_assessments:
            for control in ra.applied_controls.all():
                if str(control.id) not in {
                    str(c.id) for c in linked_controls
                }:
                    try:
                        self.validate_control(str(control.id))
                        validated_count += 1
                    except Exception as exc:
                        logger.error(
                            f"Failed to validate control {control.id} "
                            f"via requirement assessment: {exc}"
                        )

        logger.info(
            f"Evidence {evidence_id} upload triggered validation of "
            f"{validated_count} controls"
        )

    def on_finding_created(self, finding_id: str):
        """
        Trigger re-validation when a new finding is created.

        Attempts to find controls affected by this finding and flags
        them as potentially at-risk.
        """
        affected_controls = self._get_controls_for_finding(finding_id)

        for control_id in affected_controls:
            try:
                result = self.validate_control(control_id)
                logger.debug(
                    f"Re-validated control {control_id} after finding created: "
                    f"{result.previous_status} -> {result.new_status}"
                )
            except Exception as exc:
                logger.error(
                    f"Failed to validate control {control_id} "
                    f"after finding {finding_id} creation: {exc}"
                )

        logger.info(
            f"Finding {finding_id} creation triggered validation of "
            f"{len(affected_controls)} controls"
        )

    def on_finding_remediated(self, finding_id: str):
        """
        Trigger re-validation when a finding is remediated.

        Similar to on_finding_created, but the expectation is that
        controls should improve their status.
        """
        affected_controls = self._get_controls_for_finding(finding_id)

        for control_id in affected_controls:
            try:
                result = self.validate_control(control_id)
                logger.debug(
                    f"Re-validated control {control_id} after finding remediated: "
                    f"{result.previous_status} -> {result.new_status}"
                )
            except Exception as exc:
                logger.error(
                    f"Failed to validate control {control_id} "
                    f"after finding {finding_id} remediation: {exc}"
                )

        logger.info(
            f"Finding {finding_id} remediation triggered validation of "
            f"{len(affected_controls)} controls"
        )

    def get_validation_history(self, control_id: str) -> List[Dict]:
        """
        Get validation history for a control.

        Queries the event store for past validation events related
        to the given control.
        """
        history = []

        try:
            from core.domain.events import get_event_bus

            event_bus = get_event_bus()
            if hasattr(event_bus, "get_events_for_aggregate"):
                events = event_bus.get_events_for_aggregate(control_id)
                for event in events:
                    if hasattr(event, "payload") and event.payload:
                        payload = event.payload
                        if payload.get("validation_method"):
                            history.append(
                                {
                                    "control_id": control_id,
                                    "previous_status": payload.get(
                                        "previous_status", ""
                                    ),
                                    "new_status": payload.get("new_status", ""),
                                    "validation_method": payload.get(
                                        "validation_method", ""
                                    ),
                                    "validated_at": (
                                        event.timestamp.isoformat()
                                        if hasattr(event, "timestamp")
                                        else ""
                                    ),
                                    "evidence_ids": payload.get(
                                        "evidence_ids", []
                                    ),
                                    "findings": payload.get("findings", []),
                                }
                            )
        except Exception as exc:
            logger.debug(
                f"Could not retrieve validation history from event bus: {exc}"
            )

        # Fallback: check if there's an audit log for the control
        try:
            from auditlog.models import LogEntry
            from django.contrib.contenttypes.models import ContentType
            from core.models import AppliedControl

            ct = ContentType.objects.get_for_model(AppliedControl)
            entries = LogEntry.objects.filter(
                content_type=ct,
                object_pk=control_id,
            ).order_by("-timestamp")[:50]

            for entry in entries:
                changes = entry.changes_dict if hasattr(entry, "changes_dict") else {}
                if "status" in changes:
                    history.append(
                        {
                            "control_id": control_id,
                            "previous_status": changes["status"][0]
                            if isinstance(changes["status"], (list, tuple))
                            else "",
                            "new_status": changes["status"][1]
                            if isinstance(changes["status"], (list, tuple))
                            else changes["status"],
                            "validation_method": "audit_log",
                            "validated_at": entry.timestamp.isoformat()
                            if entry.timestamp
                            else "",
                            "evidence_ids": [],
                            "findings": [],
                        }
                    )
        except Exception as exc:
            logger.debug(f"Could not retrieve audit log history: {exc}")

        # Sort by validated_at descending
        history.sort(key=lambda h: h.get("validated_at", ""), reverse=True)
        return history

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    def _determine_status(self, evidence_list, open_findings, control) -> tuple:
        """
        Determine the new control status based on evidence and findings.

        Returns (new_status, details_dict).
        """
        now = timezone.now()
        freshness_cutoff = now - timedelta(days=EVIDENCE_FRESHNESS_DAYS)

        total_evidence = evidence_list.count()
        fresh_evidence = 0
        stale_evidence = 0
        approved_evidence = 0

        for ev in evidence_list:
            # Check if evidence has a recent revision
            last_rev = getattr(ev, "last_revision", None)
            if last_rev and hasattr(last_rev, "created_at"):
                if last_rev.created_at >= freshness_cutoff:
                    fresh_evidence += 1
                else:
                    stale_evidence += 1
            elif hasattr(ev, "updated_at") and ev.updated_at:
                if ev.updated_at >= freshness_cutoff:
                    fresh_evidence += 1
                else:
                    stale_evidence += 1
            else:
                stale_evidence += 1

            # Check approval status
            if hasattr(ev, "status") and ev.status == "approved":
                approved_evidence += 1

        num_open_findings = len(open_findings)

        details = {
            "total_evidence": total_evidence,
            "fresh_evidence": fresh_evidence,
            "stale_evidence": stale_evidence,
            "approved_evidence": approved_evidence,
            "open_findings": num_open_findings,
            "freshness_threshold_days": EVIDENCE_FRESHNESS_DAYS,
        }

        # Decision tree
        if total_evidence == 0:
            return "--", details  # Undefined / not assessed

        if num_open_findings > 0:
            # Open findings override evidence freshness
            if fresh_evidence > 0:
                return "in_progress", details  # Has evidence but findings exist
            else:
                return "to_do", details  # Stale evidence and findings

        if fresh_evidence > 0 and stale_evidence == 0:
            # All evidence is fresh, no findings
            if approved_evidence == total_evidence:
                return "active", details  # Fully validated
            else:
                return "in_progress", details  # Fresh but not all approved

        if fresh_evidence > 0 and stale_evidence > 0:
            # Mixed freshness
            return "in_progress", details

        if fresh_evidence == 0 and stale_evidence > 0:
            # All evidence is stale
            return "on_hold", details

        return "--", details

    def _get_open_findings_for_control(self, control) -> List[Dict]:
        """
        Get open findings related to a control.

        Checks both the legacy core Finding model and the bounded context
        ComplianceFinding model.
        """
        findings = []

        # Check ComplianceFinding (bounded context model)
        try:
            from core.bounded_contexts.compliance.associations.compliance_finding import (
                ComplianceFinding,
            )

            # Find findings linked to control implementations
            # that reference this applied control
            open_states = ["open", "triaged", "remediating"]
            compliance_findings = ComplianceFinding.objects.filter(
                lifecycle_state__in=open_states
            )

            for cf in compliance_findings:
                # Check if any control implementation IDs match
                control_impl_ids = cf.controlImplementationIds or []
                if str(control.id) in [str(cid) for cid in control_impl_ids]:
                    findings.append(
                        {
                            "id": str(cf.id),
                            "title": cf.title,
                            "severity": cf.severity,
                            "state": cf.lifecycle_state,
                            "source": "compliance_finding",
                        }
                    )
        except Exception as exc:
            logger.debug(f"Could not query ComplianceFinding: {exc}")

        # Check VulnerabilityFinding (RMF operations)
        try:
            from core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding import (
                VulnerabilityFinding,
            )

            open_statuses = ["open", "not_reviewed"]
            vuln_findings = VulnerabilityFinding.objects.filter(
                status__in=open_statuses
            )

            # Match by control ID reference
            control_ref_id = getattr(control, "ref_id", None)
            if control_ref_id:
                for vf in vuln_findings:
                    vuln_control = getattr(vf, "cciRef", None)
                    if vuln_control and control_ref_id in str(vuln_control):
                        findings.append(
                            {
                                "id": str(vf.id),
                                "title": getattr(vf, "title", str(vf.vulnId)),
                                "severity": getattr(vf, "severity", "medium"),
                                "state": getattr(vf, "status", "open"),
                                "source": "vulnerability_finding",
                            }
                        )
        except Exception as exc:
            logger.debug(f"Could not query VulnerabilityFinding: {exc}")

        return findings

    def _get_controls_for_finding(self, finding_id: str) -> List[str]:
        """
        Get all control IDs affected by a finding.

        Looks up the finding and traces back to applied controls via
        control implementation references or requirement assessments.
        """
        control_ids = set()

        # Check ComplianceFinding
        try:
            from core.bounded_contexts.compliance.associations.compliance_finding import (
                ComplianceFinding,
            )

            finding = ComplianceFinding.objects.get(id=finding_id)
            impl_ids = finding.controlImplementationIds or []
            for impl_id in impl_ids:
                control_ids.add(str(impl_id))
        except Exception:
            pass

        # Check via RequirementAssessment link
        try:
            from core.models import RequirementAssessment

            # If the finding is linked to requirement assessments,
            # get their applied controls
            req_assessments = RequirementAssessment.objects.filter(
                id__in=list(control_ids) if control_ids else []
            ).prefetch_related("applied_controls")

            for ra in req_assessments:
                for ctrl in ra.applied_controls.all():
                    control_ids.add(str(ctrl.id))
        except Exception:
            pass

        return list(control_ids)

    def _update_control_status(self, control, new_status: str):
        """
        Update the applied control's status.

        Uses a direct save to trigger any model-level hooks.
        """
        try:
            control.status = new_status
            control.save()
        except Exception as exc:
            logger.error(
                f"Failed to update control {control.id} status to {new_status}: {exc}"
            )


def get_control_validator_service() -> ControlValidatorService:
    """Factory function to create a ControlValidatorService instance."""
    return ControlValidatorService()
