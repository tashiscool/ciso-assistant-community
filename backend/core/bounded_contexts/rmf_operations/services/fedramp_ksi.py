"""
FedRAMP Key Security Indicators (KSI) Service

Provides metrics and analysis for FedRAMP continuous monitoring
and Key Security Indicators dashboard.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q, Avg, Sum
from collections import defaultdict
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class KSIMetric:
    """Represents a Key Security Indicator metric."""
    name: str
    value: float
    target: float
    unit: str
    status: str  # 'good', 'warning', 'critical'
    trend: str  # 'up', 'down', 'stable'
    trend_value: float = 0.0
    description: str = ''
    category: str = ''

    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'value': self.value,
            'target': self.target,
            'unit': self.unit,
            'status': self.status,
            'trend': self.trend,
            'trend_value': self.trend_value,
            'description': self.description,
            'category': self.category,
        }


@dataclass
class FedRAMPDashboardData:
    """Complete FedRAMP KSI Dashboard data."""
    authorization_status: Dict[str, Any] = field(default_factory=dict)
    ksi_metrics: List[KSIMetric] = field(default_factory=list)
    control_compliance: Dict[str, Any] = field(default_factory=dict)
    vulnerability_summary: Dict[str, Any] = field(default_factory=dict)
    poam_status: Dict[str, Any] = field(default_factory=dict)
    continuous_monitoring: Dict[str, Any] = field(default_factory=dict)
    scan_compliance: Dict[str, Any] = field(default_factory=dict)
    incident_metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'authorization_status': self.authorization_status,
            'ksi_metrics': [m.to_dict() for m in self.ksi_metrics],
            'control_compliance': self.control_compliance,
            'vulnerability_summary': self.vulnerability_summary,
            'poam_status': self.poam_status,
            'continuous_monitoring': self.continuous_monitoring,
            'scan_compliance': self.scan_compliance,
            'incident_metrics': self.incident_metrics,
        }


class FedRAMPKSIService:
    """
    Service for FedRAMP Key Security Indicators.

    Calculates and provides KSI metrics for FedRAMP continuous monitoring:
    - Vulnerability Management metrics
    - Control Assessment metrics
    - Incident Response metrics
    - POA&M tracking
    - Scan compliance
    """

    # FedRAMP KSI thresholds
    THRESHOLDS = {
        'critical_vuln_remediation_days': 30,  # Days to remediate critical vulns
        'high_vuln_remediation_days': 90,  # Days to remediate high vulns
        'moderate_vuln_remediation_days': 180,  # Days to remediate moderate vulns
        'low_vuln_remediation_days': 365,  # Days to remediate low vulns
        'scan_frequency_days': 30,  # Required vulnerability scan frequency
        'poam_milestone_compliance': 0.95,  # 95% milestone completion rate
        'control_assessment_coverage': 1.0,  # 100% control coverage
        'incident_response_hours': 1,  # Hour to report incidents
    }

    def __init__(self, system_group_id: Optional[str] = None, compliance_assessment_id: Optional[str] = None):
        """
        Initialize the KSI service.

        Args:
            system_group_id: Optional system group to scope metrics
            compliance_assessment_id: Optional compliance assessment to scope metrics
        """
        self.system_group_id = system_group_id
        self.compliance_assessment_id = compliance_assessment_id

    def get_dashboard_data(self) -> FedRAMPDashboardData:
        """Get complete dashboard data."""
        data = FedRAMPDashboardData()

        data.authorization_status = self._get_authorization_status()
        data.ksi_metrics = self._calculate_ksi_metrics()
        data.control_compliance = self._get_control_compliance()
        data.vulnerability_summary = self._get_vulnerability_summary()
        data.poam_status = self._get_poam_status()
        data.continuous_monitoring = self._get_continuous_monitoring_status()
        data.scan_compliance = self._get_scan_compliance()
        data.incident_metrics = self._get_incident_metrics()

        return data

    def _get_authorization_status(self) -> Dict[str, Any]:
        """Get FedRAMP authorization status."""
        return {
            'status': 'Authorized',  # 'In Process', 'Authorized', 'Ready'
            'impact_level': 'Moderate',  # 'Low', 'Moderate', 'High'
            'authorization_date': (timezone.now() - timedelta(days=180)).isoformat(),
            'last_assessment_date': (timezone.now() - timedelta(days=30)).isoformat(),
            'next_assessment_date': (timezone.now() + timedelta(days=335)).isoformat(),
            'authorization_boundary': {
                'cloud_provider': 'AWS',
                'services_count': 12,
                'data_centers': ['us-east-1', 'us-west-2'],
            },
            'agency_sponsors': ['Agency A', 'Agency B'],
        }

    def _calculate_ksi_metrics(self) -> List[KSIMetric]:
        """Calculate all Key Security Indicators."""
        metrics = []

        # Vulnerability Management KSIs
        metrics.append(self._calculate_vuln_remediation_metric('critical', 30))
        metrics.append(self._calculate_vuln_remediation_metric('high', 90))
        metrics.append(self._calculate_scan_frequency_metric())
        metrics.append(self._calculate_vuln_aging_metric())

        # Control Assessment KSIs
        metrics.append(self._calculate_control_coverage_metric())
        metrics.append(self._calculate_control_effectiveness_metric())

        # POA&M KSIs
        metrics.append(self._calculate_poam_milestone_metric())
        metrics.append(self._calculate_poam_aging_metric())

        # Incident Response KSIs
        metrics.append(self._calculate_incident_response_metric())

        # Configuration Management KSIs
        metrics.append(self._calculate_config_compliance_metric())

        return metrics

    def _calculate_vuln_remediation_metric(self, severity: str, target_days: int) -> KSIMetric:
        """Calculate vulnerability remediation time metric."""
        # In production, this would query actual vulnerability data
        avg_remediation = self._get_avg_remediation_time(severity)

        status = 'good'
        if avg_remediation > target_days * 1.5:
            status = 'critical'
        elif avg_remediation > target_days:
            status = 'warning'

        return KSIMetric(
            name=f'{severity.title()} Vulnerability Remediation Time',
            value=avg_remediation,
            target=target_days,
            unit='days',
            status=status,
            trend='down' if avg_remediation < target_days else 'up',
            trend_value=-5.2,
            description=f'Average time to remediate {severity} vulnerabilities',
            category='vulnerability_management',
        )

    def _calculate_scan_frequency_metric(self) -> KSIMetric:
        """Calculate vulnerability scan frequency compliance."""
        # Get scan data
        last_scan = timezone.now() - timedelta(days=3)
        days_since_scan = (timezone.now() - last_scan).days

        compliant = days_since_scan <= self.THRESHOLDS['scan_frequency_days']
        compliance_rate = min(100, (self.THRESHOLDS['scan_frequency_days'] - days_since_scan) / self.THRESHOLDS['scan_frequency_days'] * 100 + 100)

        return KSIMetric(
            name='Vulnerability Scan Compliance',
            value=compliance_rate,
            target=100,
            unit='%',
            status='good' if compliant else 'critical',
            trend='stable',
            trend_value=0,
            description='Compliance with 30-day vulnerability scan requirement',
            category='vulnerability_management',
        )

    def _calculate_vuln_aging_metric(self) -> KSIMetric:
        """Calculate vulnerability aging metric."""
        # Mock data - in production would query actual vulns
        overdue_count = 5
        total_open = 42

        overdue_pct = (overdue_count / max(total_open, 1)) * 100

        status = 'good'
        if overdue_pct > 20:
            status = 'critical'
        elif overdue_pct > 10:
            status = 'warning'

        return KSIMetric(
            name='Overdue Vulnerabilities',
            value=overdue_pct,
            target=0,
            unit='%',
            status=status,
            trend='down',
            trend_value=-2.3,
            description='Percentage of vulnerabilities past remediation deadline',
            category='vulnerability_management',
        )

    def _calculate_control_coverage_metric(self) -> KSIMetric:
        """Calculate control assessment coverage."""
        # Mock data - in production would query actual assessments
        total_controls = 325  # FedRAMP Moderate baseline
        assessed_controls = 310

        coverage = (assessed_controls / total_controls) * 100

        return KSIMetric(
            name='Control Assessment Coverage',
            value=coverage,
            target=100,
            unit='%',
            status='good' if coverage >= 95 else 'warning' if coverage >= 80 else 'critical',
            trend='up',
            trend_value=2.1,
            description='Percentage of controls with completed assessments',
            category='control_assessment',
        )

    def _calculate_control_effectiveness_metric(self) -> KSIMetric:
        """Calculate control effectiveness rate."""
        # Mock data
        effective_controls = 295
        total_assessed = 310

        effectiveness = (effective_controls / max(total_assessed, 1)) * 100

        return KSIMetric(
            name='Control Effectiveness Rate',
            value=effectiveness,
            target=100,
            unit='%',
            status='good' if effectiveness >= 90 else 'warning' if effectiveness >= 75 else 'critical',
            trend='up',
            trend_value=1.5,
            description='Percentage of controls rated as effective',
            category='control_assessment',
        )

    def _calculate_poam_milestone_metric(self) -> KSIMetric:
        """Calculate POA&M milestone completion rate."""
        # Mock data
        completed_milestones = 45
        total_milestones = 52

        completion_rate = (completed_milestones / max(total_milestones, 1)) * 100

        return KSIMetric(
            name='POA&M Milestone Completion',
            value=completion_rate,
            target=95,
            unit='%',
            status='good' if completion_rate >= 95 else 'warning' if completion_rate >= 80 else 'critical',
            trend='up',
            trend_value=3.2,
            description='Percentage of POA&M milestones completed on time',
            category='poam',
        )

    def _calculate_poam_aging_metric(self) -> KSIMetric:
        """Calculate POA&M aging metric."""
        # Mock data
        overdue_poams = 3
        total_poams = 28

        overdue_pct = (overdue_poams / max(total_poams, 1)) * 100

        return KSIMetric(
            name='Overdue POA&M Items',
            value=overdue_pct,
            target=0,
            unit='%',
            status='good' if overdue_pct <= 5 else 'warning' if overdue_pct <= 15 else 'critical',
            trend='down',
            trend_value=-1.8,
            description='Percentage of POA&M items past scheduled completion',
            category='poam',
        )

    def _calculate_incident_response_metric(self) -> KSIMetric:
        """Calculate incident response time metric."""
        # Mock data
        avg_response_minutes = 45

        status = 'good'
        if avg_response_minutes > 120:
            status = 'critical'
        elif avg_response_minutes > 60:
            status = 'warning'

        return KSIMetric(
            name='Average Incident Response Time',
            value=avg_response_minutes,
            target=60,
            unit='minutes',
            status=status,
            trend='down',
            trend_value=-8.5,
            description='Average time to initial incident response',
            category='incident_response',
        )

    def _calculate_config_compliance_metric(self) -> KSIMetric:
        """Calculate configuration compliance rate."""
        # Mock data
        compliant_systems = 187
        total_systems = 195

        compliance_rate = (compliant_systems / max(total_systems, 1)) * 100

        return KSIMetric(
            name='Configuration Compliance Rate',
            value=compliance_rate,
            target=100,
            unit='%',
            status='good' if compliance_rate >= 95 else 'warning' if compliance_rate >= 85 else 'critical',
            trend='up',
            trend_value=1.2,
            description='Percentage of systems compliant with security baseline',
            category='configuration_management',
        )

    def _get_control_compliance(self) -> Dict[str, Any]:
        """Get control compliance by family."""
        # FedRAMP control families with mock compliance data
        families = {
            'AC': {'name': 'Access Control', 'total': 25, 'compliant': 23, 'partial': 2, 'non_compliant': 0},
            'AU': {'name': 'Audit and Accountability', 'total': 16, 'compliant': 14, 'partial': 1, 'non_compliant': 1},
            'AT': {'name': 'Awareness and Training', 'total': 5, 'compliant': 5, 'partial': 0, 'non_compliant': 0},
            'CM': {'name': 'Configuration Management', 'total': 11, 'compliant': 9, 'partial': 2, 'non_compliant': 0},
            'CP': {'name': 'Contingency Planning', 'total': 13, 'compliant': 12, 'partial': 1, 'non_compliant': 0},
            'IA': {'name': 'Identification and Authentication', 'total': 11, 'compliant': 10, 'partial': 1, 'non_compliant': 0},
            'IR': {'name': 'Incident Response', 'total': 10, 'compliant': 9, 'partial': 1, 'non_compliant': 0},
            'MA': {'name': 'Maintenance', 'total': 6, 'compliant': 6, 'partial': 0, 'non_compliant': 0},
            'MP': {'name': 'Media Protection', 'total': 8, 'compliant': 7, 'partial': 1, 'non_compliant': 0},
            'PE': {'name': 'Physical and Environmental Protection', 'total': 20, 'compliant': 20, 'partial': 0, 'non_compliant': 0},
            'PL': {'name': 'Planning', 'total': 4, 'compliant': 4, 'partial': 0, 'non_compliant': 0},
            'PS': {'name': 'Personnel Security', 'total': 8, 'compliant': 8, 'partial': 0, 'non_compliant': 0},
            'RA': {'name': 'Risk Assessment', 'total': 6, 'compliant': 5, 'partial': 1, 'non_compliant': 0},
            'CA': {'name': 'Security Assessment and Authorization', 'total': 9, 'compliant': 8, 'partial': 1, 'non_compliant': 0},
            'SC': {'name': 'System and Communications Protection', 'total': 44, 'compliant': 40, 'partial': 3, 'non_compliant': 1},
            'SI': {'name': 'System and Information Integrity', 'total': 16, 'compliant': 14, 'partial': 2, 'non_compliant': 0},
            'SA': {'name': 'System and Services Acquisition', 'total': 22, 'compliant': 20, 'partial': 2, 'non_compliant': 0},
        }

        total_controls = sum(f['total'] for f in families.values())
        total_compliant = sum(f['compliant'] for f in families.values())
        total_partial = sum(f['partial'] for f in families.values())
        total_non_compliant = sum(f['non_compliant'] for f in families.values())

        return {
            'families': families,
            'summary': {
                'total_controls': total_controls,
                'compliant': total_compliant,
                'partial': total_partial,
                'non_compliant': total_non_compliant,
                'compliance_rate': round((total_compliant / total_controls) * 100, 1) if total_controls > 0 else 0,
            }
        }

    def _get_vulnerability_summary(self) -> Dict[str, Any]:
        """Get vulnerability summary data."""
        return {
            'by_severity': {
                'critical': {'open': 2, 'remediated': 15, 'overdue': 0},
                'high': {'open': 8, 'remediated': 45, 'overdue': 1},
                'medium': {'open': 22, 'remediated': 89, 'overdue': 3},
                'low': {'open': 10, 'remediated': 124, 'overdue': 1},
            },
            'total_open': 42,
            'total_remediated_30d': 67,
            'remediation_rate': 85.3,
            'avg_age_days': 18,
            'by_category': {
                'OS Patches': 15,
                'Software Updates': 12,
                'Configuration': 8,
                'Network': 4,
                'Application': 3,
            },
            'trend': {
                'direction': 'down',
                'change': -12,
                'period': '30 days',
            }
        }

    def _get_poam_status(self) -> Dict[str, Any]:
        """Get POA&M status data."""
        return {
            'total_items': 28,
            'by_status': {
                'open': 18,
                'in_progress': 7,
                'completed': 85,
                'overdue': 3,
            },
            'by_risk': {
                'high': 5,
                'moderate': 12,
                'low': 11,
            },
            'milestones': {
                'total': 52,
                'completed': 45,
                'on_track': 5,
                'at_risk': 2,
            },
            'avg_age_days': 45,
            'trend': {
                'new_30d': 8,
                'closed_30d': 12,
            }
        }

    def _get_continuous_monitoring_status(self) -> Dict[str, Any]:
        """Get continuous monitoring status."""
        return {
            'status': 'Active',
            'last_monthly_report': (timezone.now() - timedelta(days=15)).isoformat(),
            'next_annual_assessment': (timezone.now() + timedelta(days=180)).isoformat(),
            'scan_status': {
                'vulnerability_scan': {
                    'last_run': (timezone.now() - timedelta(days=3)).isoformat(),
                    'frequency': 'Monthly',
                    'compliant': True,
                },
                'configuration_scan': {
                    'last_run': (timezone.now() - timedelta(days=7)).isoformat(),
                    'frequency': 'Monthly',
                    'compliant': True,
                },
                'penetration_test': {
                    'last_run': (timezone.now() - timedelta(days=90)).isoformat(),
                    'frequency': 'Annual',
                    'compliant': True,
                },
            },
            'deliverables': {
                'monthly_conmon_report': {'status': 'Submitted', 'date': (timezone.now() - timedelta(days=15)).isoformat()},
                'significant_change_request': {'status': 'None Pending', 'date': None},
                'annual_assessment': {'status': 'Scheduled', 'date': (timezone.now() + timedelta(days=180)).isoformat()},
            }
        }

    def _get_scan_compliance(self) -> Dict[str, Any]:
        """Get scan compliance data."""
        return {
            'vulnerability_scans': {
                'required_frequency': 'Monthly',
                'last_scan': (timezone.now() - timedelta(days=3)).isoformat(),
                'next_due': (timezone.now() + timedelta(days=27)).isoformat(),
                'compliant': True,
                'coverage': 98.5,
            },
            'configuration_scans': {
                'required_frequency': 'Monthly',
                'last_scan': (timezone.now() - timedelta(days=7)).isoformat(),
                'next_due': (timezone.now() + timedelta(days=23)).isoformat(),
                'compliant': True,
                'coverage': 100,
            },
            'penetration_tests': {
                'required_frequency': 'Annual',
                'last_test': (timezone.now() - timedelta(days=90)).isoformat(),
                'next_due': (timezone.now() + timedelta(days=275)).isoformat(),
                'compliant': True,
            },
            'web_application_scans': {
                'required_frequency': 'Monthly',
                'last_scan': (timezone.now() - timedelta(days=5)).isoformat(),
                'next_due': (timezone.now() + timedelta(days=25)).isoformat(),
                'compliant': True,
                'coverage': 100,
            },
        }

    def _get_incident_metrics(self) -> Dict[str, Any]:
        """Get incident metrics data."""
        return {
            'total_incidents_ytd': 12,
            'by_severity': {
                'critical': 0,
                'high': 2,
                'medium': 5,
                'low': 5,
            },
            'by_status': {
                'open': 1,
                'investigating': 1,
                'contained': 0,
                'resolved': 10,
            },
            'avg_response_time_minutes': 45,
            'avg_resolution_time_hours': 18,
            'us_cert_reported': 2,
            'lessons_learned_completed': 10,
        }

    def _get_avg_remediation_time(self, severity: str) -> float:
        """Get average remediation time for a severity level."""
        # Mock data - in production would query actual vulnerability data
        times = {
            'critical': 18,
            'high': 62,
            'moderate': 95,
            'low': 180,
        }
        return times.get(severity, 90)


# Singleton service factory
def get_ksi_service(
    system_group_id: Optional[str] = None,
    compliance_assessment_id: Optional[str] = None
) -> FedRAMPKSIService:
    """Get a KSI service instance."""
    return FedRAMPKSIService(
        system_group_id=system_group_id,
        compliance_assessment_id=compliance_assessment_id
    )
