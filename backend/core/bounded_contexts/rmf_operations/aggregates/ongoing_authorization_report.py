"""
Ongoing Authorization Report (OAR) Aggregate

Tracks quarterly OAR submissions for FedRAMP 20x continuous authorization.
OARs are required quarterly and document the security posture of the CSO.
"""

import uuid
from typing import Optional, List, Dict, Any
from django.db import models
from django.utils import timezone
from datetime import date

from core.domain.aggregate import AggregateRoot


class OngoingAuthorizationReport(AggregateRoot):
    """
    Ongoing Authorization Report aggregate.

    Represents a quarterly OAR submission for FedRAMP 20x continuous authorization.
    Tracks KSI status snapshots, vulnerability summary, and POA&M updates.
    """

    class ReportStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_PROGRESS = "in_progress", "In Progress"
        REVIEW = "review", "Under Review"
        SUBMITTED = "submitted", "Submitted"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        REVISION_REQUIRED = "revision", "Revision Required"

    class Quarter(models.TextChoices):
        Q1 = "Q1", "Q1 (Jan-Mar)"
        Q2 = "Q2", "Q2 (Apr-Jun)"
        Q3 = "Q3", "Q3 (Jul-Sep)"
        Q4 = "Q4", "Q4 (Oct-Dec)"

    # Foreign key
    cloud_service_offering_id = models.UUIDField(
        db_index=True,
        help_text="Cloud Service Offering this OAR belongs to"
    )

    # Report identification
    report_title = models.CharField(
        max_length=255,
        help_text="Report title"
    )
    reporting_period_quarter = models.CharField(
        max_length=2,
        choices=Quarter.choices,
        help_text="Reporting quarter"
    )
    reporting_period_year = models.IntegerField(
        help_text="Reporting year"
    )
    reporting_period_start = models.DateField(
        help_text="Start of reporting period"
    )
    reporting_period_end = models.DateField(
        help_text="End of reporting period"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=ReportStatus.choices,
        default=ReportStatus.DRAFT,
        db_index=True,
        help_text="Current report status"
    )
    submission_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date report was submitted"
    )
    acceptance_date = models.DateTimeField(
        null=True, blank=True,
        help_text="Date report was accepted"
    )
    due_date = models.DateField(
        null=True, blank=True,
        help_text="Report due date"
    )

    # KSI Summary (snapshot at report time)
    ksi_summary = models.JSONField(
        default=dict, blank=True,
        help_text="KSI compliance summary at time of report"
    )
    total_ksi_count = models.IntegerField(default=0)
    compliant_ksi_count = models.IntegerField(default=0)
    non_compliant_ksi_count = models.IntegerField(default=0)
    ksi_compliance_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0
    )

    # Persistent Validation Summary
    validation_summary = models.JSONField(
        default=dict, blank=True,
        help_text="Persistent validation coverage summary"
    )
    persistent_validation_coverage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Percentage of KSIs with automated validation"
    )
    validation_pass_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Pass rate of automated validations"
    )

    # Vulnerability Summary
    vulnerability_summary = models.JSONField(
        default=dict, blank=True,
        help_text="Vulnerability summary at time of report"
    )
    total_open_vulnerabilities = models.IntegerField(default=0)
    critical_vulnerabilities = models.IntegerField(default=0)
    high_vulnerabilities = models.IntegerField(default=0)
    overdue_vulnerabilities = models.IntegerField(default=0)

    # POA&M Summary
    poam_summary = models.JSONField(
        default=dict, blank=True,
        help_text="POA&M status summary"
    )
    total_poam_items = models.IntegerField(default=0)
    open_poam_items = models.IntegerField(default=0)
    closed_poam_items_this_period = models.IntegerField(default=0)
    overdue_poam_items = models.IntegerField(default=0)

    # Incident Summary
    incident_summary = models.JSONField(
        default=dict, blank=True,
        help_text="Security incident summary"
    )
    total_incidents = models.IntegerField(default=0)
    security_incidents_reported = models.IntegerField(default=0)

    # Significant Changes
    significant_changes = models.JSONField(
        default=list, blank=True,
        help_text="List of significant changes during the period"
    )
    has_significant_changes = models.BooleanField(
        default=False,
        help_text="Whether there were significant changes"
    )

    # Executive Summary
    executive_summary = models.TextField(
        blank=True, null=True,
        help_text="Executive summary narrative"
    )
    risk_posture_assessment = models.TextField(
        blank=True, null=True,
        help_text="Overall risk posture assessment"
    )
    remediation_activities = models.TextField(
        blank=True, null=True,
        help_text="Summary of remediation activities"
    )

    # Attestations
    cso_attestation = models.BooleanField(
        default=False,
        help_text="CSO representative attestation"
    )
    cso_attestation_date = models.DateTimeField(
        null=True, blank=True
    )
    cso_attestation_name = models.CharField(
        max_length=255, blank=True, null=True
    )
    cso_attestation_title = models.CharField(
        max_length=255, blank=True, null=True
    )

    # Review information
    reviewer_notes = models.TextField(
        blank=True, null=True,
        help_text="Notes from FedRAMP/agency reviewer"
    )
    revision_comments = models.TextField(
        blank=True, null=True,
        help_text="Comments if revision required"
    )

    # Machine-readable export
    oscal_export_id = models.UUIDField(
        null=True, blank=True,
        help_text="ID of OSCAL export if generated"
    )
    json_export_path = models.CharField(
        max_length=500, blank=True, null=True,
        help_text="Path to JSON export file"
    )

    # Metadata
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fedramp_ongoing_authorization_reports'
        verbose_name = 'Ongoing Authorization Report'
        verbose_name_plural = 'Ongoing Authorization Reports'
        ordering = ['-reporting_period_year', '-reporting_period_quarter']
        unique_together = [
            ['cloud_service_offering_id', 'reporting_period_year', 'reporting_period_quarter']
        ]
        indexes = [
            models.Index(fields=['cloud_service_offering_id', 'status']),
            models.Index(fields=['status', 'due_date']),
            models.Index(fields=['submission_date']),
        ]

    def __str__(self):
        return f"OAR({self.reporting_period_quarter} {self.reporting_period_year}): {self.status}"

    # Factory method
    @classmethod
    def create(cls, cso_id: uuid.UUID, year: int, quarter: str,
               created_by: uuid.UUID = None) -> 'OngoingAuthorizationReport':
        """Create a new Ongoing Authorization Report"""
        oar = cls()
        oar.cloud_service_offering_id = cso_id
        oar.reporting_period_year = year
        oar.reporting_period_quarter = quarter
        oar.created_by = created_by

        # Set title
        oar.report_title = f"OAR {quarter} {year}"

        # Calculate reporting period dates
        quarter_months = {'Q1': (1, 3), 'Q2': (4, 6), 'Q3': (7, 9), 'Q4': (10, 12)}
        start_month, end_month = quarter_months[quarter]

        oar.reporting_period_start = date(year, start_month, 1)

        # Last day of end month
        if end_month == 12:
            oar.reporting_period_end = date(year, 12, 31)
        else:
            oar.reporting_period_end = date(year, end_month + 1, 1) - timezone.timedelta(days=1)

        # Due date is typically 30 days after quarter end
        oar.due_date = oar.reporting_period_end + timezone.timedelta(days=30)

        from ..domain_events import OARCreated
        oar._raise_event(OARCreated(
            aggregate_id=oar.id,
            cso_id=str(cso_id),
            quarter=quarter,
            year=year
        ))

        return oar

    # Business methods
    def capture_ksi_snapshot(self, ksi_data: List[Dict[str, Any]]) -> None:
        """Capture KSI compliance snapshot"""
        compliant = sum(1 for k in ksi_data if k.get('compliance_status') == 'compliant')
        non_compliant = sum(1 for k in ksi_data if k.get('compliance_status') == 'non_compliant')
        total = len(ksi_data)

        self.ksi_summary = {
            'by_category': self._summarize_by_category(ksi_data),
            'by_status': self._summarize_by_status(ksi_data),
            'timestamp': timezone.now().isoformat()
        }
        self.total_ksi_count = total
        self.compliant_ksi_count = compliant
        self.non_compliant_ksi_count = non_compliant
        self.ksi_compliance_percentage = (compliant / max(total, 1)) * 100

        # Calculate validation coverage
        automated = sum(1 for k in ksi_data if k.get('has_persistent_validation'))
        self.persistent_validation_coverage = (automated / max(total, 1)) * 100

    def _summarize_by_category(self, ksi_data: List[Dict]) -> Dict:
        """Summarize KSI data by category"""
        summary = {}
        for ksi in ksi_data:
            cat = ksi.get('category', 'Unknown')
            if cat not in summary:
                summary[cat] = {'total': 0, 'compliant': 0, 'non_compliant': 0}
            summary[cat]['total'] += 1
            if ksi.get('compliance_status') == 'compliant':
                summary[cat]['compliant'] += 1
            elif ksi.get('compliance_status') == 'non_compliant':
                summary[cat]['non_compliant'] += 1
        return summary

    def _summarize_by_status(self, ksi_data: List[Dict]) -> Dict:
        """Summarize KSI data by status"""
        summary = {'compliant': 0, 'non_compliant': 0, 'pending': 0, 'not_applicable': 0}
        for ksi in ksi_data:
            status = ksi.get('compliance_status', 'unknown')
            if status in summary:
                summary[status] += 1
        return summary

    def capture_vulnerability_snapshot(self, vuln_data: Dict[str, Any]) -> None:
        """Capture vulnerability summary snapshot"""
        self.vulnerability_summary = {
            **vuln_data,
            'timestamp': timezone.now().isoformat()
        }
        self.total_open_vulnerabilities = vuln_data.get('total_open', 0)
        self.critical_vulnerabilities = vuln_data.get('critical', 0)
        self.high_vulnerabilities = vuln_data.get('high', 0)
        self.overdue_vulnerabilities = vuln_data.get('overdue', 0)

    def capture_poam_snapshot(self, poam_data: Dict[str, Any]) -> None:
        """Capture POA&M summary snapshot"""
        self.poam_summary = {
            **poam_data,
            'timestamp': timezone.now().isoformat()
        }
        self.total_poam_items = poam_data.get('total', 0)
        self.open_poam_items = poam_data.get('open', 0)
        self.closed_poam_items_this_period = poam_data.get('closed_this_period', 0)
        self.overdue_poam_items = poam_data.get('overdue', 0)

    def add_significant_change(self, change_type: str, description: str,
                              date: str = None, impact: str = None) -> None:
        """Record a significant change (manual entry)"""
        self.significant_changes.append({
            'type': change_type,
            'description': description,
            'date': date or timezone.now().date().isoformat(),
            'impact': impact
        })
        self.has_significant_changes = True

    def capture_change_requests_snapshot(self, change_requests: list) -> None:
        """
        Capture snapshot of significant change requests for the reporting period.

        Args:
            change_requests: List of SignificantChangeRequest objects or dicts
                            from the reporting period
        """
        changes_data = []
        for change in change_requests:
            if hasattr(change, 'to_oar_format'):
                changes_data.append(change.to_oar_format())
            elif isinstance(change, dict):
                changes_data.append(change)

        # Merge with any manually added changes
        existing_manual = [c for c in self.significant_changes if c.get('source') == 'manual']
        self.significant_changes = existing_manual + [
            {**c, 'source': 'change_request'} for c in changes_data
        ]
        self.has_significant_changes = len(self.significant_changes) > 0

    def capture_incidents_snapshot(self, incidents: list) -> None:
        """
        Capture snapshot of security incidents for the reporting period.

        Args:
            incidents: List of SecurityIncident objects or dicts
                      from the reporting period
        """
        incidents_data = []
        for incident in incidents:
            if hasattr(incident, 'to_oar_format'):
                incidents_data.append(incident.to_oar_format())
            elif isinstance(incident, dict):
                incidents_data.append(incident)

        # Calculate summary statistics
        total = len(incidents_data)
        uscert_reported = sum(1 for i in incidents_data if i.get('uscert_reported', False))

        # Categorize by severity
        by_severity = {}
        for incident in incidents_data:
            sev = incident.get('severity', 'unknown')
            by_severity[sev] = by_severity.get(sev, 0) + 1

        # Categorize by category
        by_category = {}
        for incident in incidents_data:
            cat = incident.get('category', 'unknown')
            by_category[cat] = by_category.get(cat, 0) + 1

        # Calculate average response times
        contain_times = [i.get('time_to_contain_hours') for i in incidents_data
                        if i.get('time_to_contain_hours') is not None]
        resolve_times = [i.get('time_to_resolve_hours') for i in incidents_data
                        if i.get('time_to_resolve_hours') is not None]

        avg_contain = sum(contain_times) / len(contain_times) if contain_times else None
        avg_resolve = sum(resolve_times) / len(resolve_times) if resolve_times else None

        # Count data breaches and exfiltration
        data_exfiltration_count = sum(1 for i in incidents_data if i.get('data_exfiltrated', False))
        service_disruption_count = sum(1 for i in incidents_data if i.get('service_disruption', False))

        self.incident_summary = {
            'incidents': incidents_data,
            'by_severity': by_severity,
            'by_category': by_category,
            'avg_time_to_contain_hours': avg_contain,
            'avg_time_to_resolve_hours': avg_resolve,
            'data_exfiltration_incidents': data_exfiltration_count,
            'service_disruption_incidents': service_disruption_count,
            'timestamp': timezone.now().isoformat()
        }
        self.total_incidents = total
        self.security_incidents_reported = uscert_reported

    def update_executive_summary(self, summary: str, risk_posture: str = None,
                                remediation: str = None) -> None:
        """Update executive summary narratives"""
        self.executive_summary = summary
        if risk_posture:
            self.risk_posture_assessment = risk_posture
        if remediation:
            self.remediation_activities = remediation

    def attest(self, name: str, title: str) -> None:
        """CSO attestation"""
        self.cso_attestation = True
        self.cso_attestation_date = timezone.now()
        self.cso_attestation_name = name
        self.cso_attestation_title = title

    def submit(self) -> None:
        """Submit the OAR"""
        if not self.cso_attestation:
            raise ValueError("CSO attestation required before submission")
        if self.status not in [self.ReportStatus.DRAFT, self.ReportStatus.REVISION_REQUIRED]:
            raise ValueError("Report must be in DRAFT or REVISION_REQUIRED status to submit")

        self.status = self.ReportStatus.SUBMITTED
        self.submission_date = timezone.now()

        from ..domain_events import OARSubmitted
        self._raise_event(OARSubmitted(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id),
            quarter=self.reporting_period_quarter,
            year=self.reporting_period_year
        ))

    def accept(self, notes: str = None) -> None:
        """Accept the OAR"""
        if self.status != self.ReportStatus.SUBMITTED:
            raise ValueError("Report must be SUBMITTED to accept")

        self.status = self.ReportStatus.ACCEPTED
        self.acceptance_date = timezone.now()
        if notes:
            self.reviewer_notes = notes

        from ..domain_events import OARAccepted
        self._raise_event(OARAccepted(
            aggregate_id=self.id,
            cso_id=str(self.cloud_service_offering_id)
        ))

    def request_revision(self, comments: str) -> None:
        """Request revision to the OAR"""
        if self.status != self.ReportStatus.SUBMITTED:
            raise ValueError("Report must be SUBMITTED to request revision")

        self.status = self.ReportStatus.REVISION_REQUIRED
        self.revision_comments = comments

    def reject(self, reason: str) -> None:
        """Reject the OAR"""
        self.status = self.ReportStatus.REJECTED
        self.reviewer_notes = reason

    # Query methods
    def is_submitted(self) -> bool:
        """Check if OAR has been submitted"""
        return self.status in [
            self.ReportStatus.SUBMITTED,
            self.ReportStatus.ACCEPTED,
            self.ReportStatus.REJECTED
        ]

    def is_overdue(self) -> bool:
        """Check if OAR is overdue"""
        if self.status in [self.ReportStatus.SUBMITTED, self.ReportStatus.ACCEPTED]:
            return False
        return self.due_date and timezone.now().date() > self.due_date

    def get_compliance_summary(self) -> Dict[str, Any]:
        """Get compliance summary for the report"""
        return {
            'ksi_compliance': {
                'total': self.total_ksi_count,
                'compliant': self.compliant_ksi_count,
                'non_compliant': self.non_compliant_ksi_count,
                'percentage': float(self.ksi_compliance_percentage)
            },
            'validation_coverage': float(self.persistent_validation_coverage),
            'vulnerabilities': {
                'total_open': self.total_open_vulnerabilities,
                'critical': self.critical_vulnerabilities,
                'high': self.high_vulnerabilities,
                'overdue': self.overdue_vulnerabilities
            },
            'poam': {
                'total': self.total_poam_items,
                'open': self.open_poam_items,
                'overdue': self.overdue_poam_items
            },
            'incidents': {
                'total': self.total_incidents,
                'reported_to_uscert': self.security_incidents_reported,
                'by_severity': self.incident_summary.get('by_severity', {}),
                'avg_contain_hours': self.incident_summary.get('avg_time_to_contain_hours'),
                'avg_resolve_hours': self.incident_summary.get('avg_time_to_resolve_hours'),
            },
            'significant_changes': {
                'count': len(self.significant_changes),
                'has_changes': self.has_significant_changes,
                'scn_submitted': sum(1 for c in self.significant_changes
                                    if c.get('scn_required', False))
            }
        }

    def populate_from_aggregates(self, cso_id: 'uuid.UUID') -> None:
        """
        Populate OAR data from related aggregates.

        This method queries KSI implementations, security incidents,
        and significant change requests to auto-populate the OAR.

        Args:
            cso_id: The Cloud Service Offering ID
        """
        from .ksi_implementation import KSIImplementation
        from .security_incident import SecurityIncident
        from .significant_change_request import SignificantChangeRequest

        # Get KSI data
        ksi_impls = KSIImplementation.objects.filter(
            cloud_service_offering_id=cso_id
        )
        ksi_data = []
        for ksi in ksi_impls:
            ksi_data.append({
                'ksi_ref_id': ksi.ksi_ref_id,
                'category': ksi.ksi_category,
                'compliance_status': ksi.compliance_status,
                'has_persistent_validation': ksi.has_persistent_validation,
                'implementation_status': ksi.implementation_status,
            })
        self.capture_ksi_snapshot(ksi_data)

        # Get incidents from reporting period
        incidents = SecurityIncident.objects.filter(
            cloud_service_offering_id=cso_id,
            detected_at__gte=self.reporting_period_start,
            detected_at__lte=self.reporting_period_end
        )
        self.capture_incidents_snapshot(list(incidents))

        # Get significant changes from reporting period
        changes = SignificantChangeRequest.objects.filter(
            cloud_service_offering_id=cso_id,
            created_at__gte=self.reporting_period_start,
            created_at__lte=self.reporting_period_end
        ).exclude(status=SignificantChangeRequest.ChangeStatus.DRAFT)
        self.capture_change_requests_snapshot(list(changes))
