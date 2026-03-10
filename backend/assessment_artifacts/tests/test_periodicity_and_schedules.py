"""
Focused tests for periodicity inference and schedule grouping.

Covers:
- _detect_periodicity: text-pattern, time-scope, and control-aware heuristics
- _infer_periodicity_from_controls: the fallback control+artifact-type oracle
- ScheduleGeneratorService._activity_key: semantic activity classification
- ScheduleGeneratorService._effective_frequency: on_demand/event_driven/continuous mapping
- End-to-end template → schedule grouping with realistic FedRAMP/NIST patterns
"""

import pytest
from unittest.mock import MagicMock

from assessment_artifacts.services.package_builder import (
    _detect_artifact_types,
    _detect_periodicity,
    _infer_periodicity_from_controls,
)
from assessment_artifacts.services.schedule_generator import (
    ScheduleGeneratorService,
    FREQUENCY_CRONS,
    ACTIVITY_DEFAULT_FREQUENCY,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _mock_item(
    artifact_request: str = "",
    controls: list[str] | None = None,
    control_families: list[str] | None = None,
    primary_artifact_type: str = "generic_evidence",
    periodicity: str = "on_demand",
    workstreams: list[str] | None = None,
    platform_tags: list[str] | None = None,
    commands: list[str] | None = None,
    collection_channel: str = "manual_collection",
    request_id: str = "REQ-0001",
) -> MagicMock:
    """Build a lightweight mock ArtifactRequestItem for unit testing."""
    item = MagicMock()
    item.artifact_request = artifact_request
    item.controls = controls or []
    item.control_families = control_families or sorted(
        {c.split("-")[0] for c in (controls or [])}
    )
    item.primary_artifact_type = primary_artifact_type
    item.periodicity = periodicity
    item.workstreams = workstreams or []
    item.platform_tags = platform_tags or []
    item.commands = commands or []
    item.collection_channel = collection_channel
    item.request_id = request_id
    return item


# ═══════════════════════════════════════════════════════════════════════════════
# _detect_periodicity — text-pattern matching
# ═══════════════════════════════════════════════════════════════════════════════


class TestArtifactTypeDetection:
    """Artifact type parser should only emit model-supported primary values."""

    def test_roster_maps_to_records(self):
        types = _detect_artifact_types(
            "Employee/contractor roster including role, title, and hire date"
        )
        assert types[0] == "records"


class TestDetectPeriodicityTextPatterns:
    """Direct keyword matches in artifact request text."""

    @pytest.mark.parametrize(
        "text, expected",
        [
            ("Provide weekly audit log review reports", "weekly"),
            ("Submit logs at least weekly", "weekly"),
            ("Logs collected each week", "weekly"),
            ("Monthly vulnerability scan results from Nessus", "monthly"),
            ("Provide reports at least monthly", "monthly"),
            ("Submit results each month for review", "monthly"),
            ("Provide quarterly account recertification", "quarterly"),
            ("Provide evidence every 90 days", "quarterly"),
            ("Submit every quarter for validation", "quarterly"),
            ("Semi-annual security review", "semi_annual"),
            ("Every six months re-validate", "semi_annual"),
            ("Annual risk assessment report", "annual"),
            ("Submit at least annually for review", "annual"),
            ("Provide evidence yearly", "annual"),
            ("Continuous monitoring via GuardDuty", "continuous"),
            ("Real-time alert feed from SIEM", "continuous"),
            ("Upon termination disable account", "event_driven"),
            ("Upon change approval, capture baseline", "event_driven"),
            ("Triggered by configuration change", "event_driven"),
        ],
    )
    def test_text_pattern_detection(self, text, expected):
        result = _detect_periodicity(text, [], [], [])
        assert result == expected, f"Expected {expected} for: {text!r}"


class TestDetectPeriodicityTimeScopes:
    """Fallback to time_scopes when no text keyword matches."""

    @pytest.mark.parametrize(
        "scopes, expected",
        [
            (["sample_of_weeks"], "weekly"),
            (["weekly_minimum"], "weekly"),
            (["sample_of_months"], "monthly"),
            (["sample_of_changes"], "monthly"),
            (["monthly_minimum"], "monthly"),
            (["annual_minimum"], "annual"),
            (["rolling_365_days"], "annual"),
            (["current_year"], "annual"),
        ],
    )
    def test_scope_inference(self, scopes, expected):
        # Text with no keyword match, so scope kicks in
        result = _detect_periodicity("Provide evidence as requested", scopes, [], [])
        assert result == expected


# ═══════════════════════════════════════════════════════════════════════════════
# _infer_periodicity_from_controls — control-aware heuristics
# ═══════════════════════════════════════════════════════════════════════════════


class TestInferPeriodicityFromControls:
    """The fallback oracle when text + scopes don't match."""

    def test_au6_audit_log_review_weekly(self):
        result = _infer_periodicity_from_controls(
            ["AU-6", "AU-6(1)"],
            ["report"],
            "Audit log review samples of access events",
        )
        assert result == "weekly"

    def test_au6_without_log_keyword_not_weekly(self):
        """AU-6 alone isn't enough — needs 'audit log', 'log review', etc."""
        result = _infer_periodicity_from_controls(
            ["AU-6"],
            ["generic_evidence"],
            "Provide the AU-6 policy document",
        )
        assert result is None  # falls through to next heuristic or None

    def test_ra5_vuln_scan_monthly(self):
        result = _infer_periodicity_from_controls(
            ["RA-5"],
            ["scan_evidence"],
            "Nessus vulnerability scan results",
        )
        assert result == "monthly"

    def test_si2_flaw_remediation_monthly(self):
        result = _infer_periodicity_from_controls(
            ["SI-2"],
            ["report"],
            "Flaw remediation tracking for patching",
        )
        assert result == "monthly"

    def test_si3_malware_scan_monthly(self):
        result = _infer_periodicity_from_controls(
            ["SI-3"],
            ["scan_evidence"],
            "Anti-malware scan results",
        )
        assert result == "monthly"

    def test_scan_evidence_artifact_type_monthly(self):
        """scan_evidence artifact type triggers monthly even without RA-5."""
        result = _infer_periodicity_from_controls(
            ["CM-6"],
            ["scan_evidence"],
            "Configuration compliance scan output",
        )
        assert result == "monthly"

    def test_ac2_account_recertification_quarterly(self):
        result = _infer_periodicity_from_controls(
            ["AC-2", "AC-2(4)"],
            ["records"],
            "Account recertification listing of privileged users",
        )
        assert result == "quarterly"

    def test_ia4_identifier_review_quarterly(self):
        result = _infer_periodicity_from_controls(
            ["IA-4"],
            ["records"],
            "Review of user account identifiers for stale access",
        )
        assert result == "quarterly"

    def test_ac2_without_review_keyword_not_quarterly(self):
        """AC-2 alone needs a review/account/privilege keyword."""
        result = _infer_periodicity_from_controls(
            ["AC-2"],
            ["configuration_snapshot"],
            "IAM policy JSON export from AWS",
        )
        # No review-like keyword, so it won't match quarterly rule
        assert result != "quarterly"

    def test_ir4_incident_handling_weekly(self):
        result = _infer_periodicity_from_controls(
            ["IR-4", "IR-6"],
            ["alert_evidence"],
            "Incident handling records and triage summaries",
        )
        assert result == "weekly"

    def test_si4_monitoring_alert_weekly(self):
        result = _infer_periodicity_from_controls(
            ["SI-4"],
            ["alert_evidence"],
            "SIEM alert detection summaries",
        )
        assert result == "weekly"

    def test_at2_training_annual(self):
        result = _infer_periodicity_from_controls(
            ["AT-2", "AT-3"],
            ["training_artifact"],
            "Security awareness training completion records",
        )
        assert result == "annual"

    def test_training_artifact_type_annual(self):
        """training_artifact type alone triggers annual."""
        result = _infer_periodicity_from_controls(
            ["PS-1"],
            ["training_artifact"],
            "New-hire orientation security briefing",
        )
        assert result == "annual"

    def test_policy_document_annual(self):
        result = _infer_periodicity_from_controls(
            ["AC-1"],
            ["policy_document"],
            "Access Control policy document with revision history",
        )
        assert result == "annual"

    def test_cm2_baseline_annual(self):
        result = _infer_periodicity_from_controls(
            ["CM-2"],
            ["configuration_snapshot"],
            "Baseline configuration inventory",
        )
        assert result == "annual"

    def test_cm_family_change_monthly(self):
        result = _infer_periodicity_from_controls(
            ["CM-3"],
            ["records"],
            "Configuration change request tracking",
        )
        assert result == "monthly"

    def test_no_match_returns_none(self):
        result = _infer_periodicity_from_controls(
            ["PE-2"],
            ["generic_evidence"],
            "Physical access authorization records",
        )
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# _detect_periodicity — full pipeline (text → scope → controls → on_demand)
# ═══════════════════════════════════════════════════════════════════════════════


class TestDetectPeriodicityFullPipeline:
    """End-to-end: text patterns > scopes > control heuristics > on_demand."""

    def test_text_takes_priority_over_controls(self):
        """If text says 'quarterly', that wins even if controls suggest monthly."""
        result = _detect_periodicity(
            "Provide quarterly vulnerability scan reports",
            [],
            ["RA-5"],  # would suggest monthly via controls
            ["scan_evidence"],
        )
        assert result == "quarterly"

    def test_scope_takes_priority_over_controls(self):
        result = _detect_periodicity(
            "Provide evidence for baseline configuration review",
            ["sample_of_weeks"],  # weekly scope
            ["CM-2"],  # would suggest annual via controls
            ["configuration_snapshot"],
        )
        assert result == "weekly"

    def test_controls_used_when_text_and_scopes_miss(self):
        result = _detect_periodicity(
            "Nessus scan results for host compliance",
            [],
            ["RA-5", "SI-2"],
            ["scan_evidence"],
        )
        assert result == "monthly"

    def test_falls_to_on_demand(self):
        result = _detect_periodicity(
            "Physical access authorization list",
            [],
            ["PE-2"],
            ["records"],
        )
        assert result == "on_demand"

    def test_fedramp_audit_log_review_sample(self):
        """Realistic FedRAMP: AU-6 + 'audit log review' → weekly."""
        result = _detect_periodicity(
            "Provide sample of audit log reviews performed showing reviewer "
            "sign-off on log analysis (sample of weeks since last assessment)",
            ["sample_of_weeks", "since_last_assessment"],
            ["AU-6", "AU-6(1)"],
            ["report"],
        )
        # Text doesn't say "weekly" explicitly, but "sample of weeks" scope matches
        assert result == "weekly"

    def test_fedramp_poam_update(self):
        """POA&M update with 'monthly' in text → monthly."""
        result = _detect_periodicity(
            "Provide current POA&M with monthly status updates",
            [],
            ["CA-5"],
            ["records"],
        )
        assert result == "monthly"

    def test_fedramp_annual_training(self):
        result = _detect_periodicity(
            "Provide evidence that security training was completed annually",
            [],
            ["AT-2"],
            ["training_artifact"],
        )
        assert result == "annual"


# ═══════════════════════════════════════════════════════════════════════════════
# ScheduleGeneratorService._activity_key
# ═══════════════════════════════════════════════════════════════════════════════


class TestActivityKey:
    """Verify semantic classification of items into activity groups."""

    def setup_method(self):
        self.gen = ScheduleGeneratorService()

    def test_pen_test_workstream(self):
        item = _mock_item(
            artifact_request="Penetration test report",
            controls=["CA-8"],
            workstreams=["PEN_TEST"],
        )
        assert self.gen._activity_key(item) == "penetration_testing"

    def test_pen_test_text(self):
        item = _mock_item(
            artifact_request="Provide results of the penetration test",
            controls=["CA-8"],
        )
        assert self.gen._activity_key(item) == "penetration_testing"

    def test_poam_by_text(self):
        item = _mock_item(
            artifact_request="Current POA&M with status updates",
            controls=["CA-5"],
        )
        assert self.gen._activity_key(item) == "poam_updates"

    def test_poam_by_control(self):
        item = _mock_item(
            artifact_request="Plan of action document",
            controls=["CA-5"],
        )
        assert self.gen._activity_key(item) == "poam_updates"

    def test_audit_log_reviews_by_control(self):
        item = _mock_item(
            artifact_request="Sample of log analysis performed",
            controls=["AU-6", "AU-6(1)"],
        )
        assert self.gen._activity_key(item) == "audit_log_reviews"

    def test_audit_log_reviews_by_text(self):
        item = _mock_item(
            artifact_request="Audit log review summary with sign-off",
            controls=["AU-3"],
        )
        assert self.gen._activity_key(item) == "audit_log_reviews"

    def test_alert_triage_by_controls(self):
        item = _mock_item(
            artifact_request="SIEM correlation rule output",
            controls=["SI-4", "IR-4"],
        )
        assert self.gen._activity_key(item) == "alert_triage"

    def test_alert_triage_by_text(self):
        item = _mock_item(
            artifact_request="Alert notification and triage workflow records",
            controls=["AU-3"],
        )
        assert self.gen._activity_key(item) == "alert_triage"

    def test_alert_triage_incident_text(self):
        item = _mock_item(
            artifact_request="Incident response handling records",
            controls=["IR-5"],
        )
        assert self.gen._activity_key(item) == "alert_triage"

    def test_vulnerability_scanning_by_control(self):
        item = _mock_item(
            artifact_request="Nessus scan results for hosts",
            controls=["RA-5"],
        )
        assert self.gen._activity_key(item) == "vulnerability_scanning"

    def test_vulnerability_scanning_by_artifact_type(self):
        item = _mock_item(
            artifact_request="Compliance scan output from AWS Config",
            controls=["CM-6"],
            primary_artifact_type="scan_evidence",
        )
        assert self.gen._activity_key(item) == "vulnerability_scanning"

    def test_account_recertification(self):
        item = _mock_item(
            artifact_request="Account recertification listing for privileged users",
            controls=["AC-2", "AC-2(4)"],
        )
        assert self.gen._activity_key(item) == "account_recertification"

    def test_ac2_without_review_not_recertification(self):
        """AC-2 without review-like text falls through to something else."""
        item = _mock_item(
            artifact_request="IAM policy configuration export",
            controls=["AC-2"],
            primary_artifact_type="configuration_snapshot",
        )
        # Should NOT be account_recertification (no review keyword)
        assert self.gen._activity_key(item) != "account_recertification"

    def test_baseline_validation(self):
        item = _mock_item(
            artifact_request="Baseline configuration validation report",
            controls=["CM-2", "CM-6"],
        )
        assert self.gen._activity_key(item) == "baseline_validation"

    def test_change_control_audit_by_control(self):
        item = _mock_item(
            artifact_request="Change request records from CM board",
            controls=["CM-3"],
        )
        assert self.gen._activity_key(item) == "change_control_audit"

    def test_change_control_audit_by_text(self):
        item = _mock_item(
            artifact_request="Maintenance change window documentation",
            controls=["MA-5"],
        )
        assert self.gen._activity_key(item) == "change_control_audit"

    def test_security_training_by_control(self):
        item = _mock_item(
            artifact_request="Role-based training completion list",
            controls=["AT-3"],
            primary_artifact_type="training_artifact",
        )
        assert self.gen._activity_key(item) == "security_training"

    def test_security_training_by_artifact_type(self):
        item = _mock_item(
            artifact_request="New-hire security orientation records",
            controls=["PS-1"],
            primary_artifact_type="training_artifact",
        )
        assert self.gen._activity_key(item) == "security_training"

    def test_policy_review_by_artifact_type(self):
        item = _mock_item(
            artifact_request="Access Control Policy v4.2",
            controls=["AC-1"],
            primary_artifact_type="policy_document",
        )
        assert self.gen._activity_key(item) == "policy_review"

    def test_policy_review_by_text(self):
        item = _mock_item(
            artifact_request="Information security policy document with approval",
            controls=["PL-1"],
        )
        assert self.gen._activity_key(item) == "policy_review"

    def test_risk_assessment_by_control(self):
        item = _mock_item(
            artifact_request="Security categorization worksheet",
            controls=["RA-2"],
        )
        assert self.gen._activity_key(item) == "risk_assessment"

    def test_risk_assessment_by_text(self):
        item = _mock_item(
            artifact_request="Annual risk assessment performed by ISSO",
            controls=["RA-3"],
        )
        assert self.gen._activity_key(item) == "risk_assessment"

    def test_security_reports_fallback(self):
        item = _mock_item(
            artifact_request="ConMon monthly status report",
            controls=["CA-7"],
            primary_artifact_type="report",
        )
        assert self.gen._activity_key(item) == "security_reports"

    def test_configuration_checks_fallback(self):
        item = _mock_item(
            artifact_request="AWS Config rule evaluation output",
            controls=["SC-7"],
            primary_artifact_type="configuration_snapshot",
        )
        assert self.gen._activity_key(item) == "configuration_checks"

    def test_default_fallback(self):
        item = _mock_item(
            artifact_request="Physical badge reader access logs",
            controls=["PE-3"],
            primary_artifact_type="records",
        )
        assert self.gen._activity_key(item) == "default"


# ═══════════════════════════════════════════════════════════════════════════════
# ScheduleGeneratorService._effective_frequency
# ═══════════════════════════════════════════════════════════════════════════════


class TestEffectiveFrequency:
    """Verify frequency mapping for non-standard periodicities."""

    def setup_method(self):
        self.gen = ScheduleGeneratorService()

    @pytest.mark.parametrize(
        "periodicity",
        ["weekly", "monthly", "quarterly", "semi_annual", "annual"],
    )
    def test_standard_frequencies_pass_through(self, periodicity):
        item = _mock_item(periodicity=periodicity)
        result = self.gen._effective_frequency(item, "default")
        assert result == periodicity

    def test_continuous_becomes_weekly(self):
        item = _mock_item(periodicity="continuous")
        result = self.gen._effective_frequency(item, "default")
        assert result == "weekly"

    def test_event_driven_alert_triage_weekly(self):
        item = _mock_item(periodicity="event_driven")
        result = self.gen._effective_frequency(item, "alert_triage")
        assert result == "weekly"

    def test_event_driven_audit_log_weekly(self):
        item = _mock_item(periodicity="event_driven")
        result = self.gen._effective_frequency(item, "audit_log_reviews")
        assert result == "weekly"

    def test_event_driven_change_control_weekly(self):
        item = _mock_item(periodicity="event_driven")
        result = self.gen._effective_frequency(item, "change_control_audit")
        assert result == "weekly"

    def test_event_driven_vulnerability_scanning(self):
        item = _mock_item(periodicity="event_driven")
        result = self.gen._effective_frequency(item, "vulnerability_scanning")
        assert result == ACTIVITY_DEFAULT_FREQUENCY["vulnerability_scanning"]
        assert result == "monthly"

    def test_event_driven_security_training(self):
        item = _mock_item(periodicity="event_driven")
        result = self.gen._effective_frequency(item, "security_training")
        assert result == "annual"

    def test_event_driven_default_gets_monthly(self):
        """event_driven + default activity → monthly (from ACTIVITY_DEFAULT_FREQUENCY)."""
        item = _mock_item(periodicity="event_driven")
        result = self.gen._effective_frequency(item, "default")
        assert result == "monthly"

    def test_on_demand_known_activity(self):
        item = _mock_item(periodicity="on_demand")
        result = self.gen._effective_frequency(item, "vulnerability_scanning")
        assert result == "monthly"

    def test_on_demand_default_gets_monthly(self):
        """on_demand + default activity → monthly (from ACTIVITY_DEFAULT_FREQUENCY)."""
        item = _mock_item(periodicity="on_demand")
        result = self.gen._effective_frequency(item, "default")
        assert result == "monthly"

    def test_unknown_periodicity_returns_none(self):
        item = _mock_item(periodicity="biweekly")
        result = self.gen._effective_frequency(item, "audit_log_reviews")
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# Schedule naming
# ═══════════════════════════════════════════════════════════════════════════════


class TestScheduleNaming:
    def setup_method(self):
        self.gen = ScheduleGeneratorService()

    @pytest.mark.parametrize(
        "frequency, activity_key, expected_name",
        [
            ("weekly", "audit_log_reviews", "Weekly Audit Log Reviews"),
            ("weekly", "alert_triage", "Weekly Alert Triage"),
            ("weekly", "change_control_audit", "Weekly Change Audit Review"),
            ("monthly", "vulnerability_scanning", "Monthly Vulnerability Scans"),
            ("monthly", "poam_updates", "Monthly POA&M Updates"),
            ("monthly", "security_reports", "Monthly Security Reports"),
            ("monthly", "configuration_checks", "Monthly Configuration Baselines"),
            ("quarterly", "account_recertification", "Quarterly Account Recertifications"),
            ("quarterly", "baseline_validation", "Quarterly Baseline Validation"),
            ("quarterly", "penetration_testing", "Quarterly Penetration Testing"),
            ("annual", "security_training", "Annual Security Training"),
            ("annual", "policy_review", "Annual Policy Reviews"),
            ("annual", "risk_assessment", "Annual Risk Assessments"),
            ("annual", "baseline_validation", "Annual Baseline Reviews"),
            # Defaults
            ("weekly", "default", "Weekly Evidence Collection"),
            ("monthly", "default", "Monthly Evidence Collection"),
            ("quarterly", "default", "Quarterly Evidence Collection"),
            ("semi_annual", "default", "Semi-Annual Security Review"),
            ("annual", "default", "Annual Evidence Collection"),
        ],
    )
    def test_named_schedules(self, frequency, activity_key, expected_name):
        result = self.gen._schedule_name(frequency, activity_key)
        assert result == expected_name


# ═══════════════════════════════════════════════════════════════════════════════
# Realistic FedRAMP / NIST 800-53 pattern scenarios
# ═══════════════════════════════════════════════════════════════════════════════


class TestFedRAMPPatterns:
    """
    End-to-end classification of realistic FedRAMP evidence requests
    through the full _activity_key + _effective_frequency pipeline.
    """

    def setup_method(self):
        self.gen = ScheduleGeneratorService()

    def _classify(self, item):
        """Return (activity_key, effective_frequency) for an item."""
        ak = self.gen._activity_key(item)
        ef = self.gen._effective_frequency(item, ak)
        return ak, ef

    def test_cloudtrail_audit_log_review(self):
        item = _mock_item(
            artifact_request=(
                "Provide sample of audit log reviews performed on CloudTrail "
                "showing reviewer sign-off (sample of weeks since last assessment)"
            ),
            controls=["AU-6", "AU-6(1)", "SI-4"],
            periodicity="weekly",
        )
        ak, ef = self._classify(item)
        assert ak == "audit_log_reviews"
        assert ef == "weekly"

    def test_guardduty_alert_monitoring(self):
        item = _mock_item(
            artifact_request=(
                "GuardDuty finding summary and alert triage records"
            ),
            controls=["SI-4", "IR-4"],
            periodicity="continuous",
            primary_artifact_type="alert_evidence",
        )
        ak, ef = self._classify(item)
        assert ak == "alert_triage"
        assert ef == "weekly"  # continuous → weekly

    def test_nessus_vulnerability_scan(self):
        item = _mock_item(
            artifact_request=(
                "Nessus vulnerability scan results showing host compliance "
                "for RHEL 7 and AWS resources"
            ),
            controls=["RA-5", "SI-2"],
            periodicity="monthly",
            primary_artifact_type="scan_evidence",
            platform_tags=["NESSUS", "RHEL7", "AWS"],
        )
        ak, ef = self._classify(item)
        assert ak == "vulnerability_scanning"
        assert ef == "monthly"

    def test_poam_monthly_update(self):
        item = _mock_item(
            artifact_request="Current POA&M with monthly status updates and milestones",
            controls=["CA-5"],
            periodicity="monthly",
        )
        ak, ef = self._classify(item)
        assert ak == "poam_updates"
        assert ef == "monthly"

    def test_iam_account_recertification(self):
        item = _mock_item(
            artifact_request=(
                "Quarterly account recertification of IAM users and privileged "
                "access review for admin roles"
            ),
            controls=["AC-2", "AC-2(4)", "IA-4"],
            periodicity="quarterly",
        )
        ak, ef = self._classify(item)
        assert ak == "account_recertification"
        assert ef == "quarterly"

    def test_security_awareness_training(self):
        item = _mock_item(
            artifact_request=(
                "Security awareness and role-based training completion "
                "records for all personnel"
            ),
            controls=["AT-2", "AT-3"],
            periodicity="annual",
            primary_artifact_type="training_artifact",
        )
        ak, ef = self._classify(item)
        assert ak == "security_training"
        assert ef == "annual"

    def test_contingency_plan_policy(self):
        item = _mock_item(
            artifact_request="Contingency Plan (CP) with approval signatures",
            controls=["CP-1", "CP-2"],
            periodicity="annual",
            primary_artifact_type="plan_document",
        )
        ak, ef = self._classify(item)
        assert ak == "policy_review"
        assert ef == "annual"

    def test_baseline_configuration_review(self):
        item = _mock_item(
            artifact_request="Baseline configuration documentation for AWS and RHEL 7",
            controls=["CM-2", "CM-6"],
            periodicity="annual",
        )
        ak, ef = self._classify(item)
        assert ak == "baseline_validation"
        assert ef == "annual"

    def test_change_management_records(self):
        item = _mock_item(
            artifact_request="Configuration change request records from CCB",
            controls=["CM-3", "CM-3(2)"],
            periodicity="event_driven",
        )
        ak, ef = self._classify(item)
        assert ak == "change_control_audit"
        assert ef == "weekly"  # event_driven + change_control → weekly

    def test_penetration_test_quarterly(self):
        item = _mock_item(
            artifact_request="Annual penetration test report with findings",
            controls=["CA-8"],
            workstreams=["PEN_TEST"],
            periodicity="annual",
        )
        ak, ef = self._classify(item)
        assert ak == "penetration_testing"
        assert ef == "annual"

    def test_risk_assessment_annual(self):
        item = _mock_item(
            artifact_request="Annual risk assessment covering all system boundaries",
            controls=["RA-3"],
            periodicity="annual",
        )
        ak, ef = self._classify(item)
        assert ak == "risk_assessment"
        assert ef == "annual"

    def test_on_demand_config_snapshot_scheduled(self):
        """on_demand config item with identifiable activity gets a frequency."""
        item = _mock_item(
            artifact_request="VPC security group configuration export",
            controls=["SC-7"],
            periodicity="on_demand",
            primary_artifact_type="configuration_snapshot",
        )
        ak, ef = self._classify(item)
        assert ak == "configuration_checks"
        assert ef == "monthly"  # on_demand + configuration_checks → monthly

    def test_on_demand_default_gets_monthly(self):
        """on_demand + default activity → monthly (catches unclassified items)."""
        item = _mock_item(
            artifact_request="Physical access badge records",
            controls=["PE-3"],
            periodicity="on_demand",
            primary_artifact_type="records",
        )
        ak, ef = self._classify(item)
        assert ak == "default"
        assert ef == "monthly"

    def test_conmon_report(self):
        item = _mock_item(
            artifact_request="Continuous monitoring status report",
            controls=["CA-7"],
            periodicity="monthly",
            primary_artifact_type="report",
        )
        ak, ef = self._classify(item)
        assert ak == "security_reports"
        assert ef == "monthly"

    def test_incident_response_us_cert(self):
        item = _mock_item(
            artifact_request="US-CERT incident reporting records and handling log",
            controls=["IR-6", "IR-6(1)"],
            periodicity="event_driven",
        )
        ak, ef = self._classify(item)
        assert ak == "alert_triage"
        assert ef == "weekly"  # event_driven + alert_triage → weekly

    def test_maintenance_records(self):
        item = _mock_item(
            artifact_request="System maintenance log with tool authorization",
            controls=["MA-2", "MA-3"],
            periodicity="on_demand",
        )
        ak, ef = self._classify(item)
        assert ak == "change_control_audit"
        assert ef == "weekly"  # on_demand + change_control_audit → weekly


# ═══════════════════════════════════════════════════════════════════════════════
# Integration: generate_schedules with mock package
# ═══════════════════════════════════════════════════════════════════════════════


class TestGenerateSchedulesMocked:
    """
    Verify schedule generation end-to-end using mocked items
    (no DB required).
    """

    def setup_method(self):
        self.gen = ScheduleGeneratorService()

    def test_groups_by_activity_and_frequency(self):
        """Items with same activity+frequency land in the same schedule group."""
        items = [
            _mock_item(
                artifact_request="Audit log review sample 1",
                controls=["AU-6"],
                periodicity="weekly",
                request_id="REQ-0001",
            ),
            _mock_item(
                artifact_request="Audit log review sample 2",
                controls=["AU-6", "AU-6(1)"],
                periodicity="weekly",
                request_id="REQ-0002",
            ),
        ]

        groups = {}
        for item in items:
            ak = self.gen._activity_key(item)
            ef = self.gen._effective_frequency(item, ak)
            key = (ef, ak)
            groups.setdefault(key, []).append(item)

        assert ("weekly", "audit_log_reviews") in groups
        assert len(groups[("weekly", "audit_log_reviews")]) == 2

    def test_mixed_items_produce_multiple_groups(self):
        items = [
            _mock_item(
                artifact_request="Audit log review",
                controls=["AU-6"],
                periodicity="weekly",
                request_id="REQ-0001",
            ),
            _mock_item(
                artifact_request="Nessus vulnerability scan results",
                controls=["RA-5"],
                periodicity="monthly",
                primary_artifact_type="scan_evidence",
                request_id="REQ-0002",
            ),
            _mock_item(
                artifact_request="Account recertification of privileged users",
                controls=["AC-2"],
                periodicity="quarterly",
                request_id="REQ-0003",
            ),
            _mock_item(
                artifact_request="Security training completion records",
                controls=["AT-2"],
                periodicity="annual",
                primary_artifact_type="training_artifact",
                request_id="REQ-0004",
            ),
        ]

        groups = {}
        for item in items:
            ak = self.gen._activity_key(item)
            ef = self.gen._effective_frequency(item, ak)
            if ef:
                groups.setdefault((ef, ak), []).append(item)

        assert ("weekly", "audit_log_reviews") in groups
        assert ("monthly", "vulnerability_scanning") in groups
        assert ("quarterly", "account_recertification") in groups
        assert ("annual", "security_training") in groups

    def test_unknown_periodicity_excluded_from_groups(self):
        """Items with truly unknown periodicity get excluded."""
        items = [
            _mock_item(
                artifact_request="Physical badge records",
                controls=["PE-3"],
                periodicity="biweekly",  # not a recognized periodicity
                primary_artifact_type="records",
                request_id="REQ-0001",
            ),
        ]

        groups = {}
        for item in items:
            ak = self.gen._activity_key(item)
            ef = self.gen._effective_frequency(item, ak)
            if ef:
                groups.setdefault((ef, ak), []).append(item)

        assert len(groups) == 0

    def test_cron_expressions_assigned(self):
        for freq, cron in FREQUENCY_CRONS.items():
            assert cron, f"Missing cron for {freq}"
            parts = cron.split()
            assert len(parts) == 5, f"Invalid cron format for {freq}: {cron}"
