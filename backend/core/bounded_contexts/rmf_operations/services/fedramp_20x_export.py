"""
FedRAMP 20x Machine-Readable Export Service

Generates machine-readable authorization packages in JSON format
per FedRAMP 20x requirements (RFC-0024).

Supports:
- KSI compliance export
- OAR (Ongoing Authorization Report) export
- System Security Plan extract
- Persistent validation results
"""

import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from decimal import Decimal
import uuid
from uuid import UUID

from django.utils import timezone

logger = logging.getLogger(__name__)


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal and UUID types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


@dataclass
class KSIExportEntry:
    """Single KSI entry for export"""
    ksi_ref_id: str
    ksi_name: str
    category: str
    implementation_status: str
    compliance_status: str
    validation_type: str
    automation_percentage: float
    last_validation_date: Optional[str] = None
    last_validation_result: Optional[bool] = None
    nist_control_mappings: List[str] = field(default_factory=list)
    evidence_count: int = 0
    poam_id: Optional[str] = None


@dataclass
class VulnerabilitySummary:
    """Vulnerability summary for export"""
    total_open: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    overdue: int = 0
    remediation_rate: float = 0.0
    avg_remediation_days: float = 0.0


@dataclass
class POAMSummary:
    """POA&M summary for export"""
    total: int = 0
    open: int = 0
    in_progress: int = 0
    completed: int = 0
    overdue: int = 0


@dataclass
class FedRAMP20xPackage:
    """Complete FedRAMP 20x machine-readable package"""
    # Metadata
    package_id: str
    package_version: str = "1.0"
    generation_timestamp: str = field(default_factory=lambda: timezone.now().isoformat())
    schema_version: str = "fedramp-20x-v1"

    # CSO Information
    cso_name: str = ""
    cso_id: str = ""
    impact_level: str = ""
    authorization_status: str = ""
    authorization_date: Optional[str] = None
    fedramp_package_id: Optional[str] = None

    # KSI Summary
    ksi_total: int = 0
    ksi_compliant: int = 0
    ksi_non_compliant: int = 0
    ksi_compliance_percentage: float = 0.0
    persistent_validation_coverage: float = 0.0

    # Detailed KSI data
    ksi_entries: List[Dict[str, Any]] = field(default_factory=list)
    ksi_by_category: Dict[str, Dict[str, int]] = field(default_factory=dict)

    # Vulnerability Summary
    vulnerability_summary: Dict[str, Any] = field(default_factory=dict)

    # POA&M Summary
    poam_summary: Dict[str, Any] = field(default_factory=dict)

    # Validation Summary
    validation_summary: Dict[str, Any] = field(default_factory=dict)

    def to_json(self, pretty: bool = True) -> str:
        """Convert to JSON string"""
        return json.dumps(asdict(self), cls=DecimalEncoder, indent=2 if pretty else None)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)

    def to_oscal(self) -> Dict[str, Any]:
        """
        Convert FedRAMP 20x KSI package to OSCAL Assessment Results format.

        Returns:
            OSCAL Assessment Results structure as dict
        """
        # Generate UUIDs for OSCAL elements
        results_uuid = str(uuid.uuid4())
        result_uuid = str(uuid.uuid4())

        # Build observations from KSI entries
        observations = []
        findings = []

        for entry in self.ksi_entries:
            obs_uuid = str(uuid.uuid4())

            # Create observation
            observation = {
                'uuid': obs_uuid,
                'title': f"KSI Assessment: {entry.get('ksi_ref_id', 'Unknown')}",
                'description': entry.get('ksi_name', ''),
                'methods': ['EXAMINE', 'TEST'] if entry.get('automation_percentage', 0) > 0 else ['EXAMINE'],
                'collected': entry.get('last_validation_date') or self.generation_timestamp,
                'props': [
                    {'name': 'ksi-ref-id', 'value': entry.get('ksi_ref_id', '')},
                    {'name': 'ksi-category', 'value': entry.get('category', '')},
                    {'name': 'implementation-status', 'value': entry.get('implementation_status', '')},
                    {'name': 'compliance-status', 'value': entry.get('compliance_status', '')},
                    {'name': 'automation-percentage', 'value': str(entry.get('automation_percentage', 0))},
                    {'name': 'evidence-count', 'value': str(entry.get('evidence_count', 0))},
                ],
            }

            # Add NIST control mappings as relevant evidence
            nist_mappings = entry.get('nist_control_mappings', [])
            if nist_mappings:
                observation['relevant-evidence'] = [
                    {
                        'description': f"NIST SP 800-53 control mapping: {ctrl}",
                        'props': [{'name': 'control-id', 'value': ctrl}]
                    }
                    for ctrl in nist_mappings
                ]

            observations.append(observation)

            # Create finding for each KSI
            finding_uuid = str(uuid.uuid4())
            compliance_status = entry.get('compliance_status', 'unknown')

            # Map compliance status to OSCAL state
            state_map = {
                'compliant': 'satisfied',
                'non_compliant': 'not-satisfied',
                'partially_compliant': 'partially-satisfied',
                'not_assessed': 'not-satisfied',
            }
            oscal_state = state_map.get(compliance_status, 'not-satisfied')

            finding = {
                'uuid': finding_uuid,
                'title': f"KSI Finding: {entry.get('ksi_ref_id', 'Unknown')}",
                'description': entry.get('ksi_name', ''),
                'target': {
                    'type': 'objective-id',
                    'target-id': entry.get('ksi_ref_id', ''),
                    'status': {'state': oscal_state},
                },
                'related-observations': [{'observation-uuid': obs_uuid}],
                'props': [
                    {'name': 'validation-result', 'value': str(entry.get('last_validation_result', 'unknown'))},
                ],
            }

            # Add POA&M reference if exists
            if entry.get('poam_id'):
                finding['props'].append({
                    'name': 'poam-item-uuid',
                    'value': entry.get('poam_id'),
                })

            findings.append(finding)

        # Build OSCAL Assessment Results structure
        oscal_ar = {
            'assessment-results': {
                'uuid': results_uuid,
                'metadata': {
                    'title': f"FedRAMP 20x KSI Compliance Assessment - {self.cso_name or 'Unknown CSO'}",
                    'last-modified': self.generation_timestamp,
                    'version': self.package_version,
                    'oscal-version': '1.1.2',
                    'props': [
                        {'name': 'fedramp-package-id', 'value': self.fedramp_package_id or ''},
                        {'name': 'impact-level', 'value': self.impact_level or ''},
                        {'name': 'authorization-status', 'value': self.authorization_status or ''},
                    ],
                },
                'import-ap': {
                    'href': f'#assessment-plan-{self.cso_id or "default"}',
                },
                'results': [
                    {
                        'uuid': result_uuid,
                        'title': 'KSI Compliance Results',
                        'description': f"FedRAMP 20x Key Security Indicator compliance assessment for {self.cso_name}",
                        'start': self.generation_timestamp,
                        'reviewed-controls': {
                            'control-selections': [
                                {
                                    'description': 'FedRAMP 20x Key Security Indicators',
                                    'include-all': {},
                                }
                            ],
                        },
                        'attestations': [
                            {
                                'responsible-parties': [],
                                'parts': [
                                    {
                                        'name': 'compliance-summary',
                                        'prose': f"KSI Compliance: {self.ksi_compliance_percentage:.1f}% ({self.ksi_compliant}/{self.ksi_total} compliant). "
                                                f"Persistent validation coverage: {self.persistent_validation_coverage:.1f}%.",
                                    }
                                ],
                            }
                        ],
                        'observations': observations,
                        'findings': findings,
                        'props': [
                            {'name': 'ksi-total', 'value': str(self.ksi_total)},
                            {'name': 'ksi-compliant', 'value': str(self.ksi_compliant)},
                            {'name': 'ksi-non-compliant', 'value': str(self.ksi_non_compliant)},
                            {'name': 'ksi-compliance-percentage', 'value': f"{self.ksi_compliance_percentage:.2f}"},
                            {'name': 'persistent-validation-coverage', 'value': f"{self.persistent_validation_coverage:.2f}"},
                        ],
                    }
                ],
            }
        }

        # Add vulnerability summary if available
        if self.vulnerability_summary:
            vuln_props = [
                {'name': f'vulnerability-{k}', 'value': str(v)}
                for k, v in self.vulnerability_summary.items()
            ]
            oscal_ar['assessment-results']['results'][0]['props'].extend(vuln_props)

        # Add POA&M summary if available
        if self.poam_summary:
            poam_props = [
                {'name': f'poam-{k}', 'value': str(v)}
                for k, v in self.poam_summary.items()
            ]
            oscal_ar['assessment-results']['results'][0]['props'].extend(poam_props)

        return oscal_ar


class FedRAMP20xExportService:
    """
    Service for generating FedRAMP 20x machine-readable packages.

    Implements RFC-0024 requirements for machine-readable authorization
    packages including KSI compliance, validation results, and OAR data.
    """

    def __init__(self, cso_id: UUID = None):
        """
        Initialize the export service.

        Args:
            cso_id: Optional Cloud Service Offering ID to scope exports
        """
        self.cso_id = cso_id

    def generate_ksi_package(self) -> FedRAMP20xPackage:
        """
        Generate a complete KSI compliance package.

        Returns:
            FedRAMP20xPackage with KSI compliance data
        """
        from ..aggregates import CloudServiceOffering, KSIImplementation

        package = FedRAMP20xPackage(
            package_id=f"fedramp-ksi-{timezone.now().strftime('%Y%m%d%H%M%S')}"
        )

        # Get CSO data
        if self.cso_id:
            try:
                cso = CloudServiceOffering.objects.get(id=self.cso_id)
                package.cso_name = cso.name
                package.cso_id = str(cso.id)
                package.impact_level = cso.impact_level
                package.authorization_status = cso.authorization_status
                if cso.authorization_date:
                    package.authorization_date = cso.authorization_date.isoformat()
                package.fedramp_package_id = cso.fedramp_package_id

                # Get KSI implementations
                ksi_impls = KSIImplementation.objects.filter(
                    cloud_service_offering_id=self.cso_id
                )

                package.ksi_total = ksi_impls.count()
                package.ksi_compliant = ksi_impls.filter(
                    compliance_status='compliant'
                ).count()
                package.ksi_non_compliant = ksi_impls.filter(
                    compliance_status='non_compliant'
                ).count()

                if package.ksi_total > 0:
                    package.ksi_compliance_percentage = (
                        package.ksi_compliant / package.ksi_total
                    ) * 100

                # Calculate persistent validation coverage
                automated_count = ksi_impls.filter(
                    has_persistent_validation=True
                ).count()
                if package.ksi_total > 0:
                    package.persistent_validation_coverage = (
                        automated_count / package.ksi_total
                    ) * 100

                # Export individual KSI entries
                for ksi in ksi_impls:
                    entry = KSIExportEntry(
                        ksi_ref_id=ksi.ksi_ref_id,
                        ksi_name=ksi.ksi_name,
                        category=ksi.ksi_category,
                        implementation_status=ksi.implementation_status,
                        compliance_status=ksi.compliance_status,
                        validation_type=ksi.validation_status,
                        automation_percentage=float(ksi.validation_automation_percentage),
                        last_validation_date=ksi.last_validation_date.isoformat() if ksi.last_validation_date else None,
                        last_validation_result=ksi.last_validation_result,
                        nist_control_mappings=ksi.nist_controls or [],
                        evidence_count=len(ksi.evidence_ids or []),
                        poam_id=str(ksi.poam_id) if ksi.poam_id else None
                    )
                    package.ksi_entries.append(asdict(entry))

                # Summarize by category
                package.ksi_by_category = self._summarize_by_category(ksi_impls)

            except CloudServiceOffering.DoesNotExist:
                logger.warning(f"CSO {self.cso_id} not found")

        return package

    def _summarize_by_category(self, ksi_impls) -> Dict[str, Dict[str, int]]:
        """Summarize KSIs by category"""
        summary = {}
        for ksi in ksi_impls:
            cat = ksi.ksi_category
            if cat not in summary:
                summary[cat] = {
                    'total': 0,
                    'compliant': 0,
                    'non_compliant': 0,
                    'automated': 0
                }
            summary[cat]['total'] += 1
            if ksi.compliance_status == 'compliant':
                summary[cat]['compliant'] += 1
            elif ksi.compliance_status == 'non_compliant':
                summary[cat]['non_compliant'] += 1
            if ksi.has_persistent_validation:
                summary[cat]['automated'] += 1
        return summary

    def generate_oar_package(self, oar_id: UUID = None,
                            year: int = None, quarter: str = None) -> Dict[str, Any]:
        """
        Generate an OAR (Ongoing Authorization Report) package.

        Args:
            oar_id: Specific OAR ID to export
            year: Report year (if oar_id not provided)
            quarter: Report quarter (if oar_id not provided)

        Returns:
            Dictionary with OAR data in machine-readable format
        """
        from ..aggregates import OngoingAuthorizationReport

        oar = None
        if oar_id:
            try:
                oar = OngoingAuthorizationReport.objects.get(id=oar_id)
            except OngoingAuthorizationReport.DoesNotExist:
                pass
        elif year and quarter and self.cso_id:
            try:
                oar = OngoingAuthorizationReport.objects.get(
                    cloud_service_offering_id=self.cso_id,
                    reporting_period_year=year,
                    reporting_period_quarter=quarter
                )
            except OngoingAuthorizationReport.DoesNotExist:
                pass

        if not oar:
            return {'error': 'OAR not found'}

        return {
            'package_type': 'ongoing_authorization_report',
            'package_version': '1.0',
            'schema_version': 'fedramp-20x-oar-v1',
            'generation_timestamp': timezone.now().isoformat(),

            'report_info': {
                'id': str(oar.id),
                'title': oar.report_title,
                'quarter': oar.reporting_period_quarter,
                'year': oar.reporting_period_year,
                'period_start': oar.reporting_period_start.isoformat(),
                'period_end': oar.reporting_period_end.isoformat(),
                'status': oar.status,
                'submission_date': oar.submission_date.isoformat() if oar.submission_date else None,
            },

            'cso_info': {
                'id': str(oar.cloud_service_offering_id),
            },

            'ksi_compliance': {
                'total': oar.total_ksi_count,
                'compliant': oar.compliant_ksi_count,
                'non_compliant': oar.non_compliant_ksi_count,
                'compliance_percentage': float(oar.ksi_compliance_percentage),
                'validation_coverage': float(oar.persistent_validation_coverage),
                'summary': oar.ksi_summary,
            },

            'vulnerability_summary': {
                'total_open': oar.total_open_vulnerabilities,
                'critical': oar.critical_vulnerabilities,
                'high': oar.high_vulnerabilities,
                'overdue': oar.overdue_vulnerabilities,
                'details': oar.vulnerability_summary,
            },

            'poam_summary': {
                'total': oar.total_poam_items,
                'open': oar.open_poam_items,
                'closed_this_period': oar.closed_poam_items_this_period,
                'overdue': oar.overdue_poam_items,
                'details': oar.poam_summary,
            },

            'incident_summary': oar.incident_summary,

            'significant_changes': {
                'has_changes': oar.has_significant_changes,
                'changes': oar.significant_changes,
            },

            'attestation': {
                'attested': oar.cso_attestation,
                'attestation_date': oar.cso_attestation_date.isoformat() if oar.cso_attestation_date else None,
                'attestor_name': oar.cso_attestation_name,
                'attestor_title': oar.cso_attestation_title,
            },

            'executive_summary': oar.executive_summary,
            'risk_posture': oar.risk_posture_assessment,
        }

    def generate_validation_report(self) -> Dict[str, Any]:
        """
        Generate a persistent validation results report.

        Returns:
            Dictionary with validation rule results
        """
        from ..aggregates import PersistentValidationRule, ValidationExecution

        rules = PersistentValidationRule.objects.all()
        if self.cso_id:
            rules = rules.filter(cloud_service_offering_id=self.cso_id)

        rule_data = []
        total_rules = 0
        active_rules = 0
        passing_rules = 0

        for rule in rules:
            total_rules += 1
            if rule.is_active():
                active_rules += 1
                if rule.last_result:
                    passing_rules += 1

            # Get recent executions
            recent_executions = ValidationExecution.objects.filter(
                validation_rule_id=rule.id
            ).order_by('-execution_timestamp')[:10]

            rule_data.append({
                'id': str(rule.id),
                'name': rule.name,
                'rule_type': rule.rule_type,
                'status': rule.status,
                'frequency': rule.frequency,
                'ksi_refs': rule.ksi_ref_ids,
                'last_execution': rule.last_execution.isoformat() if rule.last_execution else None,
                'last_result': rule.last_result,
                'pass_rate': rule.get_pass_rate(),
                'consecutive_failures': rule.consecutive_failures,
                'total_executions': rule.total_executions,
                'recent_executions': [
                    {
                        'timestamp': ex.execution_timestamp.isoformat(),
                        'passed': ex.passed,
                        'duration_ms': ex.duration_ms,
                        'findings_count': len(ex.findings or [])
                    }
                    for ex in recent_executions
                ]
            })

        return {
            'package_type': 'validation_report',
            'package_version': '1.0',
            'schema_version': 'fedramp-20x-validation-v1',
            'generation_timestamp': timezone.now().isoformat(),
            'cso_id': str(self.cso_id) if self.cso_id else None,

            'summary': {
                'total_rules': total_rules,
                'active_rules': active_rules,
                'passing_rules': passing_rules,
                'pass_rate': (passing_rules / max(active_rules, 1)) * 100,
            },

            'rules': rule_data,
        }

    def generate_complete_package(self) -> Dict[str, Any]:
        """
        Generate a complete FedRAMP 20x authorization package.

        Combines KSI, OAR, and validation data into a single package.

        Returns:
            Complete package dictionary
        """
        ksi_package = self.generate_ksi_package()
        validation_report = self.generate_validation_report()

        return {
            'package_type': 'fedramp_20x_complete',
            'package_version': '1.0',
            'schema_version': 'fedramp-20x-complete-v1',
            'generation_timestamp': timezone.now().isoformat(),

            'cso_info': {
                'name': ksi_package.cso_name,
                'id': ksi_package.cso_id,
                'impact_level': ksi_package.impact_level,
                'authorization_status': ksi_package.authorization_status,
                'authorization_date': ksi_package.authorization_date,
                'fedramp_package_id': ksi_package.fedramp_package_id,
            },

            'ksi_compliance': {
                'total': ksi_package.ksi_total,
                'compliant': ksi_package.ksi_compliant,
                'non_compliant': ksi_package.ksi_non_compliant,
                'compliance_percentage': ksi_package.ksi_compliance_percentage,
                'validation_coverage': ksi_package.persistent_validation_coverage,
                'by_category': ksi_package.ksi_by_category,
                'entries': ksi_package.ksi_entries,
            },

            'persistent_validation': validation_report,

            'vulnerability_summary': ksi_package.vulnerability_summary,
            'poam_summary': ksi_package.poam_summary,
        }


def get_export_service(cso_id: UUID = None) -> FedRAMP20xExportService:
    """Factory function to get an export service instance"""
    return FedRAMP20xExportService(cso_id=cso_id)


# =============================================================================
# Incident and Change Control Export Extensions
# =============================================================================

@dataclass
class IncidentExportEntry:
    """Security incident entry for export"""
    incident_number: str
    title: str
    category: str
    severity: str
    status: str
    detected_at: str
    contained_at: Optional[str] = None
    closed_at: Optional[str] = None
    time_to_contain_hours: Optional[float] = None
    time_to_resolve_hours: Optional[float] = None
    uscert_reported: bool = False
    uscert_case_number: Optional[str] = None
    affected_users: int = 0
    affected_records: int = 0
    data_exfiltrated: bool = False
    service_disruption: bool = False
    root_cause: Optional[str] = None
    has_poam: bool = False


@dataclass
class ChangeRequestExportEntry:
    """Significant change request entry for export"""
    change_number: str
    title: str
    change_type: str
    status: str
    impact_level: str
    scn_required: bool
    scn_category: Optional[str] = None
    scn_reference: Optional[str] = None
    planned_date: Optional[str] = None
    implementation_date: Optional[str] = None
    affected_ksi_count: int = 0
    affected_control_count: int = 0
    risk_delta: str = "unknown"
    verified: bool = False


class IncidentChangeExportService:
    """
    Service for exporting incident and change control data.

    Provides FedRAMP 20x compliant exports and OSCAL-compatible formats
    for security incidents and significant change requests.
    """

    def __init__(self, cso_id: UUID = None):
        """Initialize export service"""
        self.cso_id = cso_id

    def generate_incident_report(
        self,
        start_date: datetime = None,
        end_date: datetime = None,
        include_closed: bool = True
    ) -> Dict[str, Any]:
        """
        Generate security incident report.

        Args:
            start_date: Filter incidents from this date
            end_date: Filter incidents until this date
            include_closed: Include closed incidents

        Returns:
            Dictionary with incident report data
        """
        from ..aggregates import SecurityIncident

        incidents = SecurityIncident.objects.all()
        if self.cso_id:
            incidents = incidents.filter(cloud_service_offering_id=self.cso_id)
        if start_date:
            incidents = incidents.filter(detected_at__gte=start_date)
        if end_date:
            incidents = incidents.filter(detected_at__lte=end_date)
        if not include_closed:
            incidents = incidents.exclude(status='closed')

        # Calculate metrics
        total_incidents = incidents.count()
        critical_count = incidents.filter(severity='critical').count()
        high_count = incidents.filter(severity='high').count()
        moderate_count = incidents.filter(severity='moderate').count()
        low_count = incidents.filter(severity='low').count()

        open_incidents = incidents.exclude(status='closed').count()
        closed_incidents = incidents.filter(status='closed').count()

        # Calculate average resolution time
        closed_with_times = incidents.filter(
            status='closed',
            closed_at__isnull=False,
            detected_at__isnull=False
        )
        if closed_with_times.exists():
            total_hours = sum([
                (i.closed_at - i.detected_at).total_seconds() / 3600
                for i in closed_with_times
            ])
            avg_resolution_hours = total_hours / closed_with_times.count()
        else:
            avg_resolution_hours = 0

        # Calculate average containment time
        contained_incidents = incidents.filter(
            contained_at__isnull=False,
            detected_at__isnull=False
        )
        if contained_incidents.exists():
            total_contain_hours = sum([
                (i.contained_at - i.detected_at).total_seconds() / 3600
                for i in contained_incidents
            ])
            avg_containment_hours = total_contain_hours / contained_incidents.count()
        else:
            avg_containment_hours = 0

        # US-CERT reporting metrics
        uscert_required = incidents.exclude(uscert_reporting_status='not_required').count()
        uscert_submitted = incidents.filter(
            uscert_reporting_status__in=['submitted', 'final_submitted', 'closed']
        ).count()

        # Build incident entries
        incident_entries = []
        for incident in incidents.order_by('-detected_at')[:100]:  # Limit to 100 most recent
            entry = IncidentExportEntry(
                incident_number=incident.incident_number,
                title=incident.title,
                category=incident.category,
                severity=incident.severity,
                status=incident.status,
                detected_at=incident.detected_at.isoformat() if incident.detected_at else None,
                contained_at=incident.contained_at.isoformat() if incident.contained_at else None,
                closed_at=incident.closed_at.isoformat() if incident.closed_at else None,
                time_to_contain_hours=incident.time_to_contain(),
                time_to_resolve_hours=incident.time_to_resolve(),
                uscert_reported=incident.uscert_reporting_status not in ['not_required', 'pending'],
                uscert_case_number=incident.uscert_case_number,
                affected_users=incident.affected_users_count,
                affected_records=incident.affected_records_count,
                data_exfiltrated=incident.data_exfiltrated,
                service_disruption=incident.service_disruption,
                root_cause=incident.root_cause,
                has_poam=incident.poam_id is not None
            )
            incident_entries.append(asdict(entry))

        # Group by category
        by_category = {}
        for cat in SecurityIncident.IncidentCategory.values:
            cat_incidents = incidents.filter(category=cat)
            if cat_incidents.exists():
                by_category[cat] = {
                    'total': cat_incidents.count(),
                    'open': cat_incidents.exclude(status='closed').count(),
                    'critical': cat_incidents.filter(severity='critical').count(),
                    'high': cat_incidents.filter(severity='high').count(),
                }

        return {
            'package_type': 'incident_report',
            'package_version': '1.0',
            'schema_version': 'fedramp-20x-incident-v1',
            'generation_timestamp': timezone.now().isoformat(),
            'cso_id': str(self.cso_id) if self.cso_id else None,

            'report_period': {
                'start_date': start_date.isoformat() if start_date else None,
                'end_date': end_date.isoformat() if end_date else None,
            },

            'summary': {
                'total_incidents': total_incidents,
                'open_incidents': open_incidents,
                'closed_incidents': closed_incidents,
                'by_severity': {
                    'critical': critical_count,
                    'high': high_count,
                    'moderate': moderate_count,
                    'low': low_count,
                },
                'avg_containment_hours': round(avg_containment_hours, 2),
                'avg_resolution_hours': round(avg_resolution_hours, 2),
            },

            'uscert_reporting': {
                'reporting_required': uscert_required,
                'reports_submitted': uscert_submitted,
                'compliance_rate': (uscert_submitted / max(uscert_required, 1)) * 100,
            },

            'by_category': by_category,

            'incidents': incident_entries,
        }

    def generate_change_control_report(
        self,
        start_date: datetime = None,
        end_date: datetime = None,
        include_completed: bool = True
    ) -> Dict[str, Any]:
        """
        Generate change control report.

        Args:
            start_date: Filter changes from this date
            end_date: Filter changes until this date
            include_completed: Include completed/implemented changes

        Returns:
            Dictionary with change control report data
        """
        from ..aggregates import SignificantChangeRequest

        changes = SignificantChangeRequest.objects.all()
        if self.cso_id:
            changes = changes.filter(cloud_service_offering_id=self.cso_id)
        if start_date:
            changes = changes.filter(created_at__gte=start_date)
        if end_date:
            changes = changes.filter(created_at__lte=end_date)
        if not include_completed:
            changes = changes.exclude(status__in=['implemented', 'rejected', 'withdrawn'])

        # Calculate metrics
        total_changes = changes.count()
        scn_required_count = changes.filter(scn_required=True).count()
        scn_submitted_count = changes.filter(
            status__in=['scn_submitted', 'scn_acknowledged', 'approved', 'implemented']
        ).count()

        # Status breakdown
        status_counts = {}
        for status in SignificantChangeRequest.ChangeStatus.values:
            status_counts[status] = changes.filter(status=status).count()

        # Impact breakdown
        impact_counts = {}
        for impact in SignificantChangeRequest.ImpactLevel.values:
            impact_counts[impact] = changes.filter(impact_level=impact).count()

        # Build change entries
        change_entries = []
        for change in changes.order_by('-created_at')[:100]:  # Limit to 100 most recent
            entry = ChangeRequestExportEntry(
                change_number=change.change_number,
                title=change.title,
                change_type=change.change_type,
                status=change.status,
                impact_level=change.impact_level,
                scn_required=change.scn_required,
                scn_category=change.scn_category if change.scn_required else None,
                scn_reference=change.scn_reference_number,
                planned_date=str(change.planned_implementation_date) if change.planned_implementation_date else None,
                implementation_date=str(change.actual_implementation_date) if change.actual_implementation_date else None,
                affected_ksi_count=len(change.affected_ksi_ids or []),
                affected_control_count=len(change.affected_control_ids or []),
                risk_delta=change.risk_delta,
                verified=change.verification_completed
            )
            change_entries.append(asdict(entry))

        # Group by type
        by_type = {}
        for change_type in SignificantChangeRequest.ChangeType.values:
            type_changes = changes.filter(change_type=change_type)
            if type_changes.exists():
                by_type[change_type] = {
                    'total': type_changes.count(),
                    'scn_required': type_changes.filter(scn_required=True).count(),
                    'implemented': type_changes.filter(status='implemented').count(),
                }

        # SCN categories breakdown
        scn_categories = {}
        for cat in SignificantChangeRequest.SCNCategory.values:
            if cat != 'not_applicable':
                cat_count = changes.filter(scn_category=cat).count()
                if cat_count > 0:
                    scn_categories[cat] = cat_count

        return {
            'package_type': 'change_control_report',
            'package_version': '1.0',
            'schema_version': 'fedramp-20x-change-v1',
            'generation_timestamp': timezone.now().isoformat(),
            'cso_id': str(self.cso_id) if self.cso_id else None,

            'report_period': {
                'start_date': start_date.isoformat() if start_date else None,
                'end_date': end_date.isoformat() if end_date else None,
            },

            'summary': {
                'total_changes': total_changes,
                'scn_required': scn_required_count,
                'scn_submitted': scn_submitted_count,
                'scn_compliance_rate': (scn_submitted_count / max(scn_required_count, 1)) * 100,
            },

            'by_status': status_counts,
            'by_impact': impact_counts,
            'by_type': by_type,
            'scn_categories': scn_categories,

            'changes': change_entries,
        }

    def generate_oscal_incident_observations(self) -> Dict[str, Any]:
        """
        Export incidents as OSCAL-compatible observations.

        Maps security incidents to OSCAL Assessment Results observations format.

        Returns:
            OSCAL-compatible observations structure
        """
        from ..aggregates import SecurityIncident

        incidents = SecurityIncident.objects.all()
        if self.cso_id:
            incidents = incidents.filter(cloud_service_offering_id=self.cso_id)

        observations = []
        for incident in incidents:
            obs = {
                "uuid": str(incident.id),
                "title": f"Security Incident: {incident.incident_number}",
                "description": incident.description,
                "methods": ["EXAMINE", "INTERVIEW"],
                "types": ["finding"],
                "origins": [
                    {
                        "actors": [
                            {
                                "type": "tool",
                                "actor-uuid": str(uuid.uuid4()),
                                "props": [
                                    {
                                        "name": "detection-method",
                                        "value": incident.detection_method or "unknown"
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "collected": incident.detected_at.isoformat() if incident.detected_at else timezone.now().isoformat(),
                "props": [
                    {"name": "incident-number", "value": incident.incident_number},
                    {"name": "category", "value": incident.category},
                    {"name": "severity", "value": incident.severity},
                    {"name": "status", "value": incident.status},
                    {"name": "uscert-reported", "value": str(incident.uscert_reporting_status != 'not_required')},
                ],
                "remarks": f"Incident detected: {incident.detected_at}. Status: {incident.status}"
            }

            # Add US-CERT case number if reported
            if incident.uscert_case_number:
                obs["props"].append({
                    "name": "uscert-case-number",
                    "value": incident.uscert_case_number
                })

            observations.append(obs)

        return {
            "oscal-version": "1.1.2",
            "assessment-results": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Security Incident Observations",
                    "last-modified": timezone.now().isoformat(),
                    "version": "1.0",
                    "oscal-version": "1.1.2"
                },
                "results": [
                    {
                        "uuid": str(uuid.uuid4()),
                        "title": "Security Incident Findings",
                        "description": "Observations from security incidents",
                        "start": timezone.now().isoformat(),
                        "observations": observations
                    }
                ]
            }
        }

    def generate_oscal_change_poam(self) -> Dict[str, Any]:
        """
        Export change control items as OSCAL POA&M format.

        Maps significant changes to OSCAL POA&M items for tracking.

        Returns:
            OSCAL-compatible POA&M structure
        """
        from ..aggregates import SignificantChangeRequest

        changes = SignificantChangeRequest.objects.filter(
            status__in=['draft', 'submitted', 'impact_analysis', 'impact_assessed',
                       'scn_required', 'scn_submitted', 'scn_acknowledged', 'approved']
        )
        if self.cso_id:
            changes = changes.filter(cloud_service_offering_id=self.cso_id)

        poam_items = []
        for change in changes:
            item = {
                "uuid": str(change.id),
                "title": f"Change Control: {change.change_number}",
                "description": change.description,
                "props": [
                    {"name": "change-number", "value": change.change_number},
                    {"name": "change-type", "value": change.change_type},
                    {"name": "status", "value": change.status},
                    {"name": "impact-level", "value": change.impact_level},
                    {"name": "scn-required", "value": str(change.scn_required)},
                ],
                "origins": [
                    {
                        "actors": [
                            {
                                "type": "party",
                                "actor-uuid": str(uuid.uuid4()),
                                "props": [
                                    {"name": "requestor", "value": change.requestor_name}
                                ]
                            }
                        ]
                    }
                ]
            }

            # Add timing info if available
            if change.planned_implementation_date:
                item["props"].append({
                    "name": "planned-completion-date",
                    "value": str(change.planned_implementation_date)
                })

            # Add SCN reference if available
            if change.scn_reference_number:
                item["props"].append({
                    "name": "scn-reference",
                    "value": change.scn_reference_number
                })

            poam_items.append(item)

        return {
            "oscal-version": "1.1.2",
            "plan-of-action-and-milestones": {
                "uuid": str(uuid.uuid4()),
                "metadata": {
                    "title": "Change Control Tracking",
                    "last-modified": timezone.now().isoformat(),
                    "version": "1.0",
                    "oscal-version": "1.1.2"
                },
                "poam-items": poam_items
            }
        }

    def generate_complete_operations_package(self) -> Dict[str, Any]:
        """
        Generate complete operations package including incidents and changes.

        Returns:
            Combined operations package
        """
        incident_report = self.generate_incident_report()
        change_report = self.generate_change_control_report()

        return {
            'package_type': 'operations_complete',
            'package_version': '1.0',
            'schema_version': 'fedramp-20x-operations-v1',
            'generation_timestamp': timezone.now().isoformat(),
            'cso_id': str(self.cso_id) if self.cso_id else None,

            'incident_response': incident_report,
            'change_control': change_report,

            'oscal_exports': {
                'incident_observations': self.generate_oscal_incident_observations(),
                'change_poam': self.generate_oscal_change_poam(),
            }
        }


def get_incident_change_export_service(cso_id: UUID = None) -> IncidentChangeExportService:
    """Factory function for incident/change export service"""
    return IncidentChangeExportService(cso_id=cso_id)
