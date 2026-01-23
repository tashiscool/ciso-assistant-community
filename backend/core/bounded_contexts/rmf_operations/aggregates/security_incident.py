"""
Security Incident Aggregate

Represents a security incident affecting a Cloud Service Offering.
Implements the incident response lifecycle with US-CERT/CISA reporting requirements.

Per FedRAMP requirements and NIST SP 800-61 Incident Handling Guide.
"""

import uuid
from typing import Optional, List, Dict, Any
from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta

from core.domain.aggregate import AggregateRoot


class SecurityIncident(AggregateRoot):
    """
    Security Incident aggregate.

    Tracks security incidents from detection through closure, including
    mandatory US-CERT/CISA reporting and remediation tracking.
    """

    class IncidentStatus(models.TextChoices):
        DETECTED = "detected", "Detected"
        REPORTED = "reported", "Reported Internally"
        ANALYZING = "analyzing", "Analysis In Progress"
        CONTAINED = "contained", "Contained"
        ERADICATING = "eradicating", "Eradication In Progress"
        ERADICATED = "eradicated", "Eradicated"
        RECOVERING = "recovering", "Recovery In Progress"
        RECOVERED = "recovered", "Recovered"
        LESSONS_LEARNED = "lessons_learned", "Lessons Learned Review"
        CLOSED = "closed", "Closed"

    class IncidentSeverity(models.TextChoices):
        """
        Severity levels with associated US-CERT reporting deadlines.
        Based on CISA Federal Incident Notification Guidelines.
        """
        CRITICAL = "critical", "Critical (Report within 1 hour)"
        HIGH = "high", "High (Report within 24 hours)"
        MODERATE = "moderate", "Moderate (Report within 72 hours)"
        LOW = "low", "Low (Report within 7 days)"
        INFORMATIONAL = "informational", "Informational (No mandatory reporting)"

    class IncidentCategory(models.TextChoices):
        """
        NIST/US-CERT incident categories
        """
        UNAUTHORIZED_ACCESS = "unauthorized_access", "Unauthorized Access"
        DENIAL_OF_SERVICE = "denial_of_service", "Denial of Service"
        MALICIOUS_CODE = "malicious_code", "Malicious Code/Malware"
        IMPROPER_USAGE = "improper_usage", "Improper Usage"
        SCANS_PROBES = "scans_probes", "Scans/Probes/Attempted Access"
        DATA_BREACH = "data_breach", "Data Breach/Exfiltration"
        DATA_LOSS = "data_loss", "Data Loss"
        PHISHING = "phishing", "Phishing/Social Engineering"
        RANSOMWARE = "ransomware", "Ransomware"
        SUPPLY_CHAIN = "supply_chain", "Supply Chain Compromise"
        INSIDER_THREAT = "insider_threat", "Insider Threat"
        CONFIGURATION_ERROR = "configuration_error", "Configuration/Implementation Error"
        PHYSICAL = "physical", "Physical Security Incident"
        OTHER = "other", "Other"

    class DataClassification(models.TextChoices):
        """Classification of data potentially affected"""
        UNCLASSIFIED = "unclassified", "Unclassified"
        CUI = "cui", "Controlled Unclassified Information"
        PII = "pii", "Personally Identifiable Information"
        PHI = "phi", "Protected Health Information"
        FTI = "fti", "Federal Tax Information"
        CLASSIFIED = "classified", "Classified"
        UNKNOWN = "unknown", "Unknown/Under Investigation"

    class ReportingStatus(models.TextChoices):
        """US-CERT/CISA reporting status"""
        NOT_REQUIRED = "not_required", "Reporting Not Required"
        PENDING = "pending", "Report Pending"
        SUBMITTED = "submitted", "Initial Report Submitted"
        UPDATE_REQUIRED = "update_required", "Update Required"
        UPDATE_SUBMITTED = "update_submitted", "Update Submitted"
        FINAL_SUBMITTED = "final_submitted", "Final Report Submitted"
        CLOSED = "closed", "Reporting Complete"

    # Foreign key
    cloud_service_offering_id = models.UUIDField(
        db_index=True,
        help_text="Cloud Service Offering affected by this incident"
    )

    # Incident identification
    incident_number = models.CharField(
        max_length=50, unique=True,
        help_text="Unique incident identifier (e.g., INC-2026-001)"
    )
    title = models.CharField(
        max_length=255,
        help_text="Brief title describing the incident"
    )
    description = models.TextField(
        help_text="Detailed description of the incident"
    )

    # Classification
    category = models.CharField(
        max_length=30,
        choices=IncidentCategory.choices,
        default=IncidentCategory.OTHER,
        db_index=True,
        help_text="Incident category"
    )
    subcategory = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="More specific subcategory"
    )
    severity = models.CharField(
        max_length=20,
        choices=IncidentSeverity.choices,
        default=IncidentSeverity.MODERATE,
        db_index=True,
        help_text="Incident severity level"
    )
    data_classification = models.CharField(
        max_length=20,
        choices=DataClassification.choices,
        default=DataClassification.UNKNOWN,
        help_text="Classification of data potentially affected"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=IncidentStatus.choices,
        default=IncidentStatus.DETECTED,
        db_index=True,
        help_text="Current incident status"
    )

    # Timeline - Detection
    detected_at = models.DateTimeField(
        help_text="When the incident was first detected"
    )
    detection_method = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="How the incident was detected (e.g., SIEM alert, user report)"
    )
    detected_by = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Who/what detected the incident"
    )

    # Timeline - Response milestones
    reported_internally_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When incident was reported to internal security team"
    )
    analysis_started_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When incident analysis began"
    )
    contained_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When incident was contained"
    )
    eradicated_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When threat was eradicated"
    )
    recovery_started_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When recovery operations began"
    )
    recovered_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When systems were fully recovered"
    )
    closed_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When incident was officially closed"
    )

    # Impact assessment
    impact_description = models.TextField(
        blank=True, null=True,
        help_text="Description of incident impact"
    )
    affected_systems = models.JSONField(
        default=list, blank=True,
        help_text="List of affected systems/components"
    )
    affected_users_count = models.IntegerField(
        default=0,
        help_text="Number of users affected"
    )
    affected_records_count = models.IntegerField(
        default=0,
        help_text="Number of records potentially affected"
    )
    data_exfiltrated = models.BooleanField(
        default=False,
        help_text="Whether data was confirmed exfiltrated"
    )
    service_disruption = models.BooleanField(
        default=False,
        help_text="Whether there was service disruption"
    )
    service_disruption_duration_hours = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Duration of service disruption in hours"
    )
    financial_impact = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True,
        help_text="Estimated financial impact"
    )

    # Attack details
    attack_vector = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Initial attack vector"
    )
    threat_actor = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Identified or suspected threat actor"
    )
    indicators_of_compromise = models.JSONField(
        default=list, blank=True,
        help_text="List of IOCs (IPs, hashes, domains, etc.)"
    )
    mitre_attack_techniques = models.JSONField(
        default=list, blank=True,
        help_text="MITRE ATT&CK techniques identified"
    )
    malware_identified = models.JSONField(
        default=list, blank=True,
        help_text="Malware samples/families identified"
    )

    # US-CERT/CISA Reporting
    uscert_reporting_status = models.CharField(
        max_length=20,
        choices=ReportingStatus.choices,
        default=ReportingStatus.NOT_REQUIRED,
        help_text="US-CERT reporting status"
    )
    uscert_reporting_deadline = models.DateTimeField(
        null=True, blank=True,
        help_text="Deadline for US-CERT initial report"
    )
    uscert_case_number = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="US-CERT/CISA case number"
    )
    uscert_initial_report_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date initial report was submitted"
    )
    uscert_updates = models.JSONField(
        default=list, blank=True,
        help_text="List of update submissions"
    )
    uscert_final_report_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date final report was submitted"
    )

    # FedRAMP/Agency notification
    fedramp_notified = models.BooleanField(
        default=False,
        help_text="Whether FedRAMP PMO was notified"
    )
    fedramp_notification_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date FedRAMP was notified"
    )
    agencies_notified = models.JSONField(
        default=list, blank=True,
        help_text="List of agencies notified"
    )

    # Response team
    incident_commander = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Incident commander/lead"
    )
    response_team = models.JSONField(
        default=list, blank=True,
        help_text="List of response team members"
    )

    # Containment
    containment_actions = models.JSONField(
        default=list, blank=True,
        help_text="Containment actions taken"
    )
    containment_effectiveness = models.CharField(
        max_length=20,
        choices=[
            ("effective", "Effective"),
            ("partial", "Partially Effective"),
            ("ineffective", "Ineffective"),
            ("unknown", "Unknown"),
        ],
        default="unknown",
        help_text="Effectiveness of containment"
    )

    # Eradication
    eradication_actions = models.JSONField(
        default=list, blank=True,
        help_text="Eradication actions taken"
    )
    root_cause = models.TextField(
        blank=True, null=True,
        help_text="Root cause analysis"
    )

    # Recovery
    recovery_actions = models.JSONField(
        default=list, blank=True,
        help_text="Recovery actions taken"
    )
    recovery_verification = models.TextField(
        blank=True, null=True,
        help_text="How recovery was verified"
    )

    # Lessons learned
    lessons_learned = models.TextField(
        blank=True, null=True,
        help_text="Lessons learned from the incident"
    )
    recommendations = models.JSONField(
        default=list, blank=True,
        help_text="Recommendations for improvement"
    )
    lessons_learned_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date of lessons learned review"
    )

    # Remediation
    requires_remediation = models.BooleanField(
        default=False,
        help_text="Whether remediation is required"
    )
    remediation_plan = models.TextField(
        blank=True, null=True,
        help_text="Remediation plan"
    )
    poam_id = models.UUIDField(
        null=True, blank=True,
        help_text="ID of POA&M item if created"
    )

    # Related records
    related_change_request_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs of related change requests"
    )
    related_incident_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs of related incidents"
    )
    affected_ksi_ids = models.JSONField(
        default=list, blank=True,
        help_text="KSIs affected by this incident"
    )

    # Evidence
    evidence_ids = models.JSONField(
        default=list, blank=True,
        help_text="IDs of collected evidence"
    )
    evidence_preservation_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes on evidence preservation"
    )

    # OAR reporting
    reported_in_oar_id = models.UUIDField(
        null=True, blank=True,
        help_text="OAR where this incident was reported"
    )

    # Audit trail
    timeline = models.JSONField(
        default=list, blank=True,
        help_text="Detailed timeline of incident events"
    )

    # Metadata
    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fedramp_security_incidents'
        verbose_name = 'Security Incident'
        verbose_name_plural = 'Security Incidents'
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['cloud_service_offering_id', 'status']),
            models.Index(fields=['severity', 'status']),
            models.Index(fields=['category', 'status']),
            models.Index(fields=['uscert_reporting_status']),
            models.Index(fields=['detected_at']),
            models.Index(fields=['uscert_reporting_deadline']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"INC({self.incident_number}): {self.title} [{self.status}]"

    # Factory method
    @classmethod
    def create(
        cls,
        cso_id: uuid.UUID,
        title: str,
        description: str,
        category: str,
        severity: str,
        detected_at: datetime = None,
        detection_method: str = None,
        detected_by: str = None,
        created_by: uuid.UUID = None
    ) -> 'SecurityIncident':
        """Create a new Security Incident"""
        incident = cls()
        incident.cloud_service_offering_id = cso_id
        incident.title = title
        incident.description = description
        incident.category = category
        incident.severity = severity
        incident.detected_at = detected_at or timezone.now()
        incident.detection_method = detection_method
        incident.detected_by = detected_by
        incident.created_by = created_by
        incident.status = cls.IncidentStatus.DETECTED

        # Generate incident number
        year = timezone.now().year
        incident.incident_number = f"INC-{year}-{str(incident.id)[:8].upper()}"

        # Calculate US-CERT reporting deadline based on severity
        incident._calculate_reporting_deadline()

        incident._add_timeline_entry(
            "detected",
            "Incident detected",
            {"method": detection_method, "by": detected_by}
        )

        from ..domain_events import SecurityIncidentCreated
        incident._raise_event(SecurityIncidentCreated(
            aggregate_id=incident.id,
            cso_id=str(cso_id),
            title=title,
            category=category,
            severity=severity
        ))

        return incident

    def _calculate_reporting_deadline(self) -> None:
        """Calculate US-CERT reporting deadline based on severity"""
        if self.severity == self.IncidentSeverity.INFORMATIONAL:
            self.uscert_reporting_status = self.ReportingStatus.NOT_REQUIRED
            self.uscert_reporting_deadline = None
        else:
            self.uscert_reporting_status = self.ReportingStatus.PENDING

            # Reporting windows per CISA guidance
            deadline_hours = {
                self.IncidentSeverity.CRITICAL: 1,
                self.IncidentSeverity.HIGH: 24,
                self.IncidentSeverity.MODERATE: 72,
                self.IncidentSeverity.LOW: 168,  # 7 days
            }

            hours = deadline_hours.get(self.severity, 72)
            self.uscert_reporting_deadline = self.detected_at + timedelta(hours=hours)

    # Business methods - Status transitions
    def report_internally(self, reported_by: str = None) -> None:
        """Mark incident as reported internally"""
        if self.status != self.IncidentStatus.DETECTED:
            raise ValueError("Can only report from DETECTED status")

        self.status = self.IncidentStatus.REPORTED
        self.reported_internally_at = timezone.now()
        self._add_timeline_entry("reported_internally", f"Reported internally by {reported_by}")

    def begin_analysis(self, commander: str = None, team: List[str] = None) -> None:
        """Begin incident analysis"""
        if self.status not in [self.IncidentStatus.DETECTED, self.IncidentStatus.REPORTED]:
            raise ValueError("Cannot begin analysis from current status")

        self.status = self.IncidentStatus.ANALYZING
        self.analysis_started_at = timezone.now()
        self.incident_commander = commander
        if team:
            self.response_team = team
        self._add_timeline_entry(
            "analysis_started",
            "Incident analysis begun",
            {"commander": commander, "team": team}
        )

        from ..domain_events import SecurityIncidentAnalysisStarted
        self._raise_event(SecurityIncidentAnalysisStarted(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            commander=commander
        ))

    def update_severity(self, new_severity: str, reason: str = None) -> None:
        """Update incident severity (may affect reporting deadline)"""
        old_severity = self.severity
        self.severity = new_severity

        # Recalculate deadline if severity increased and not yet reported
        if self.uscert_reporting_status == self.ReportingStatus.PENDING:
            self._calculate_reporting_deadline()

        self._add_timeline_entry(
            "severity_updated",
            f"Severity changed from {old_severity} to {new_severity}",
            {"reason": reason}
        )

        from ..domain_events import SecurityIncidentSeverityChanged
        self._raise_event(SecurityIncidentSeverityChanged(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            old_severity=old_severity,
            new_severity=new_severity
        ))

    def record_containment(
        self,
        actions: List[str],
        effectiveness: str = "unknown",
        contained_by: str = None
    ) -> None:
        """Record containment of the incident"""
        if self.status not in [self.IncidentStatus.ANALYZING, self.IncidentStatus.DETECTED, self.IncidentStatus.REPORTED]:
            raise ValueError("Cannot contain from current status")

        self.status = self.IncidentStatus.CONTAINED
        self.contained_at = timezone.now()
        self.containment_actions = actions
        self.containment_effectiveness = effectiveness
        self._add_timeline_entry(
            "contained",
            "Incident contained",
            {"actions": actions, "effectiveness": effectiveness, "by": contained_by}
        )

        from ..domain_events import SecurityIncidentContained
        self._raise_event(SecurityIncidentContained(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            containment_time_hours=self._hours_since_detection()
        ))

    def begin_eradication(self) -> None:
        """Begin eradication phase"""
        if self.status != self.IncidentStatus.CONTAINED:
            raise ValueError("Must be contained before eradication")

        self.status = self.IncidentStatus.ERADICATING
        self._add_timeline_entry("eradication_started", "Eradication phase begun")

    def record_eradication(
        self,
        actions: List[str],
        root_cause: str = None,
        eradicated_by: str = None
    ) -> None:
        """Record eradication of the threat"""
        if self.status not in [self.IncidentStatus.CONTAINED, self.IncidentStatus.ERADICATING]:
            raise ValueError("Cannot eradicate from current status")

        self.status = self.IncidentStatus.ERADICATED
        self.eradicated_at = timezone.now()
        self.eradication_actions = actions
        self.root_cause = root_cause
        self._add_timeline_entry(
            "eradicated",
            "Threat eradicated",
            {"actions": actions, "root_cause": root_cause, "by": eradicated_by}
        )

        from ..domain_events import SecurityIncidentEradicated
        self._raise_event(SecurityIncidentEradicated(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            root_cause=root_cause
        ))

    def begin_recovery(self) -> None:
        """Begin recovery phase"""
        if self.status != self.IncidentStatus.ERADICATED:
            raise ValueError("Must be eradicated before recovery")

        self.status = self.IncidentStatus.RECOVERING
        self.recovery_started_at = timezone.now()
        self._add_timeline_entry("recovery_started", "Recovery phase begun")

    def record_recovery(
        self,
        actions: List[str],
        verification: str = None,
        recovered_by: str = None
    ) -> None:
        """Record system recovery"""
        if self.status not in [self.IncidentStatus.ERADICATED, self.IncidentStatus.RECOVERING]:
            raise ValueError("Cannot recover from current status")

        self.status = self.IncidentStatus.RECOVERED
        self.recovered_at = timezone.now()
        self.recovery_actions = actions
        self.recovery_verification = verification
        self._add_timeline_entry(
            "recovered",
            "Systems recovered",
            {"actions": actions, "verification": verification, "by": recovered_by}
        )

        from ..domain_events import SecurityIncidentRecovered
        self._raise_event(SecurityIncidentRecovered(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            total_duration_hours=self._hours_since_detection()
        ))

    def conduct_lessons_learned(
        self,
        lessons: str,
        recommendations: List[Dict[str, str]] = None,
        conducted_by: str = None
    ) -> None:
        """Conduct lessons learned review"""
        if self.status != self.IncidentStatus.RECOVERED:
            raise ValueError("Must be recovered before lessons learned")

        self.status = self.IncidentStatus.LESSONS_LEARNED
        self.lessons_learned = lessons
        self.recommendations = recommendations or []
        self.lessons_learned_date = timezone.now()
        self._add_timeline_entry(
            "lessons_learned",
            "Lessons learned review conducted",
            {"by": conducted_by}
        )

    def close(self, closed_by: str = None, notes: str = None) -> None:
        """Close the incident"""
        if self.status not in [self.IncidentStatus.LESSONS_LEARNED, self.IncidentStatus.RECOVERED]:
            raise ValueError("Cannot close from current status")

        # Verify US-CERT reporting is complete if required
        if self.uscert_reporting_status not in [
            self.ReportingStatus.NOT_REQUIRED,
            self.ReportingStatus.FINAL_SUBMITTED,
            self.ReportingStatus.CLOSED
        ]:
            raise ValueError("US-CERT reporting must be complete before closing")

        self.status = self.IncidentStatus.CLOSED
        self.closed_at = timezone.now()
        self._add_timeline_entry(
            "closed",
            "Incident closed",
            {"by": closed_by, "notes": notes}
        )

        from ..domain_events import SecurityIncidentClosed
        self._raise_event(SecurityIncidentClosed(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            total_duration_hours=self._hours_since_detection()
        ))

    # US-CERT Reporting methods
    def submit_uscert_initial_report(self, case_number: str = None) -> None:
        """Submit initial report to US-CERT/CISA"""
        if self.uscert_reporting_status == self.ReportingStatus.NOT_REQUIRED:
            raise ValueError("Reporting not required for this incident")

        self.uscert_reporting_status = self.ReportingStatus.SUBMITTED
        self.uscert_initial_report_date = timezone.now()
        self.uscert_case_number = case_number
        self._add_timeline_entry(
            "uscert_initial_report",
            f"Initial US-CERT report submitted. Case: {case_number}",
            {"case_number": case_number}
        )

        from ..domain_events import SecurityIncidentUSCERTReported
        self._raise_event(SecurityIncidentUSCERTReported(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            case_number=case_number,
            report_type="initial"
        ))

    def submit_uscert_update(self, update_summary: str) -> None:
        """Submit update report to US-CERT/CISA"""
        if self.uscert_reporting_status not in [
            self.ReportingStatus.SUBMITTED,
            self.ReportingStatus.UPDATE_REQUIRED,
            self.ReportingStatus.UPDATE_SUBMITTED
        ]:
            raise ValueError("Initial report must be submitted before updates")

        self.uscert_reporting_status = self.ReportingStatus.UPDATE_SUBMITTED
        self.uscert_updates.append({
            'date': timezone.now().isoformat(),
            'summary': update_summary
        })
        self._add_timeline_entry(
            "uscert_update",
            f"US-CERT update submitted: {update_summary[:100]}..."
        )

    def submit_uscert_final_report(self, summary: str = None) -> None:
        """Submit final report to US-CERT/CISA"""
        if self.uscert_reporting_status == self.ReportingStatus.NOT_REQUIRED:
            raise ValueError("Reporting not required for this incident")

        self.uscert_reporting_status = self.ReportingStatus.FINAL_SUBMITTED
        self.uscert_final_report_date = timezone.now()
        self._add_timeline_entry(
            "uscert_final_report",
            "Final US-CERT report submitted",
            {"summary": summary}
        )

    def close_uscert_reporting(self) -> None:
        """Mark US-CERT reporting as complete"""
        if self.uscert_reporting_status != self.ReportingStatus.FINAL_SUBMITTED:
            raise ValueError("Final report must be submitted first")

        self.uscert_reporting_status = self.ReportingStatus.CLOSED
        self._add_timeline_entry("uscert_closed", "US-CERT reporting closed")

    # FedRAMP notification
    def notify_fedramp(self, notification_details: str = None) -> None:
        """Record FedRAMP PMO notification"""
        self.fedramp_notified = True
        self.fedramp_notification_date = timezone.now()
        self._add_timeline_entry(
            "fedramp_notified",
            "FedRAMP PMO notified",
            {"details": notification_details}
        )

    def notify_agency(self, agency_name: str, contact: str = None) -> None:
        """Record agency notification"""
        self.agencies_notified.append({
            'agency': agency_name,
            'contact': contact,
            'notified_at': timezone.now().isoformat()
        })
        self._add_timeline_entry(
            "agency_notified",
            f"Agency notified: {agency_name}",
            {"contact": contact}
        )

    # Impact recording
    def record_impact(
        self,
        description: str,
        affected_systems: List[str] = None,
        affected_users: int = 0,
        affected_records: int = 0,
        data_exfiltrated: bool = False,
        service_disruption: bool = False,
        disruption_hours: float = 0,
        financial_impact: float = None
    ) -> None:
        """Record incident impact assessment"""
        self.impact_description = description
        self.affected_systems = affected_systems or []
        self.affected_users_count = affected_users
        self.affected_records_count = affected_records
        self.data_exfiltrated = data_exfiltrated
        self.service_disruption = service_disruption
        self.service_disruption_duration_hours = disruption_hours
        self.financial_impact = financial_impact
        self._add_timeline_entry(
            "impact_assessed",
            "Impact assessment recorded",
            {
                "users_affected": affected_users,
                "records_affected": affected_records,
                "data_exfiltrated": data_exfiltrated
            }
        )

    # Attack details
    def record_attack_details(
        self,
        attack_vector: str = None,
        threat_actor: str = None,
        iocs: List[Dict[str, str]] = None,
        mitre_techniques: List[str] = None,
        malware: List[str] = None
    ) -> None:
        """Record attack technical details"""
        if attack_vector:
            self.attack_vector = attack_vector
        if threat_actor:
            self.threat_actor = threat_actor
        if iocs:
            self.indicators_of_compromise.extend(iocs)
        if mitre_techniques:
            self.mitre_attack_techniques.extend(mitre_techniques)
        if malware:
            self.malware_identified.extend(malware)
        self._add_timeline_entry(
            "attack_details_recorded",
            "Attack details updated",
            {"vector": attack_vector, "actor": threat_actor}
        )

    def add_ioc(self, ioc_type: str, value: str, description: str = None) -> None:
        """Add indicator of compromise"""
        self.indicators_of_compromise.append({
            'type': ioc_type,
            'value': value,
            'description': description,
            'added_at': timezone.now().isoformat()
        })

    # Remediation
    def create_remediation_plan(self, plan: str) -> None:
        """Create remediation plan"""
        self.requires_remediation = True
        self.remediation_plan = plan
        self._add_timeline_entry("remediation_planned", "Remediation plan created")

    def link_poam(self, poam_id: uuid.UUID) -> None:
        """Link to a POA&M item"""
        self.poam_id = poam_id
        self._add_timeline_entry(
            "poam_linked",
            f"Linked to POA&M: {poam_id}"
        )

    def link_change_request(self, change_id: uuid.UUID) -> None:
        """Link to a change request"""
        change_str = str(change_id)
        if change_str not in self.related_change_request_ids:
            self.related_change_request_ids.append(change_str)

    # Helper methods
    def _add_timeline_entry(
        self,
        event_type: str,
        description: str,
        details: Dict[str, Any] = None
    ) -> None:
        """Add an entry to the incident timeline"""
        self.timeline.append({
            'event': event_type,
            'description': description,
            'details': details or {},
            'timestamp': timezone.now().isoformat(),
            'status': self.status
        })

    def _hours_since_detection(self) -> float:
        """Calculate hours since incident detection"""
        if not self.detected_at:
            return 0
        delta = timezone.now() - self.detected_at
        return delta.total_seconds() / 3600

    # Query methods
    def is_open(self) -> bool:
        """Check if incident is still open"""
        return self.status != self.IncidentStatus.CLOSED

    def is_reporting_overdue(self) -> bool:
        """Check if US-CERT reporting is overdue"""
        if self.uscert_reporting_status != self.ReportingStatus.PENDING:
            return False
        if not self.uscert_reporting_deadline:
            return False
        return timezone.now() > self.uscert_reporting_deadline

    def time_to_contain(self) -> Optional[float]:
        """Get time to containment in hours"""
        if not self.contained_at or not self.detected_at:
            return None
        delta = self.contained_at - self.detected_at
        return delta.total_seconds() / 3600

    def time_to_resolve(self) -> Optional[float]:
        """Get time to resolution in hours"""
        if not self.closed_at or not self.detected_at:
            return None
        delta = self.closed_at - self.detected_at
        return delta.total_seconds() / 3600

    def get_reporting_deadline_display(self) -> str:
        """Get human-readable reporting deadline"""
        if self.uscert_reporting_status == self.ReportingStatus.NOT_REQUIRED:
            return "Not Required"
        if not self.uscert_reporting_deadline:
            return "Unknown"
        if self.uscert_reporting_status in [
            self.ReportingStatus.SUBMITTED,
            self.ReportingStatus.FINAL_SUBMITTED,
            self.ReportingStatus.CLOSED
        ]:
            return "Reported"
        return self.uscert_reporting_deadline.strftime("%Y-%m-%d %H:%M UTC")

    def get_status_summary(self) -> Dict[str, Any]:
        """Get summary of incident status"""
        return {
            'incident_number': self.incident_number,
            'title': self.title,
            'status': self.status,
            'severity': self.severity,
            'category': self.category,
            'detected_at': self.detected_at.isoformat() if self.detected_at else None,
            'time_open_hours': self._hours_since_detection() if self.is_open() else self.time_to_resolve(),
            'time_to_contain_hours': self.time_to_contain(),
            'uscert_status': self.uscert_reporting_status,
            'uscert_case_number': self.uscert_case_number,
            'reporting_overdue': self.is_reporting_overdue(),
            'affected_users': self.affected_users_count,
            'affected_records': self.affected_records_count,
            'data_exfiltrated': self.data_exfiltrated,
            'has_poam': self.poam_id is not None
        }

    def to_oar_format(self) -> Dict[str, Any]:
        """Format incident for OAR reporting"""
        return {
            'incident_number': self.incident_number,
            'title': self.title,
            'category': self.category,
            'severity': self.severity,
            'status': self.status,
            'detected_at': self.detected_at.isoformat() if self.detected_at else None,
            'contained_at': self.contained_at.isoformat() if self.contained_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'time_to_contain_hours': self.time_to_contain(),
            'time_to_resolve_hours': self.time_to_resolve(),
            'uscert_reported': self.uscert_reporting_status not in [
                self.ReportingStatus.NOT_REQUIRED,
                self.ReportingStatus.PENDING
            ],
            'uscert_case_number': self.uscert_case_number,
            'affected_users': self.affected_users_count,
            'affected_records': self.affected_records_count,
            'data_exfiltrated': self.data_exfiltrated,
            'service_disruption': self.service_disruption,
            'root_cause': self.root_cause,
            'lessons_learned': bool(self.lessons_learned)
        }
