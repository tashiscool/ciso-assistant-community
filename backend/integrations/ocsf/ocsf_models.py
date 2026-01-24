"""
OCSF Data Models

Implements data models for OCSF (Open Cybersecurity Schema Framework) events.
Based on OCSF v1.1.0 specification.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum, IntEnum
from datetime import datetime
from uuid import UUID, uuid4


class OCSFEventClass(IntEnum):
    """OCSF Event Class IDs."""
    # Findings
    SECURITY_FINDING = 1001
    VULNERABILITY_FINDING = 2001
    COMPLIANCE_FINDING = 2002
    DETECTION_FINDING = 2004

    # System Activity
    FILE_ACTIVITY = 1001
    PROCESS_ACTIVITY = 1007
    NETWORK_ACTIVITY = 4001

    # Authentication
    AUTHENTICATION = 3002
    AUTHORIZATION = 3003


class OCSFSeverity(IntEnum):
    """OCSF Severity levels (0-6)."""
    UNKNOWN = 0
    INFORMATIONAL = 1
    LOW = 2
    MEDIUM = 3
    HIGH = 4
    CRITICAL = 5
    FATAL = 6


class OCSFStatus(str, Enum):
    """OCSF Finding Status."""
    NEW = 'New'
    IN_PROGRESS = 'In Progress'
    SUPPRESSED = 'Suppressed'
    RESOLVED = 'Resolved'


class OCSFActivityType(IntEnum):
    """OCSF Activity Type for Findings."""
    UNKNOWN = 0
    CREATE = 1
    UPDATE = 2
    CLOSE = 3
    OTHER = 99


@dataclass
class OCSFMetadata:
    """OCSF Event Metadata."""
    version: str = '1.1.0'
    product: Optional[Dict[str, Any]] = None
    profiles: List[str] = field(default_factory=list)
    uid: str = field(default_factory=lambda: str(uuid4()))
    correlation_uid: Optional[str] = None
    tenant_uid: Optional[str] = None
    original_time: Optional[datetime] = None
    logged_time: Optional[datetime] = None
    processed_time: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'version': self.version,
            'product': self.product,
            'profiles': self.profiles,
            'uid': self.uid,
            'correlation_uid': self.correlation_uid,
            'tenant_uid': self.tenant_uid,
            'original_time': self.original_time.isoformat() if self.original_time else None,
            'logged_time': self.logged_time.isoformat() if self.logged_time else None,
            'processed_time': self.processed_time.isoformat() if self.processed_time else None,
        }


@dataclass
class OCSFObservable:
    """OCSF Observable object."""
    name: str
    type: str
    type_id: int
    value: str
    reputation: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'type': self.type,
            'type_id': self.type_id,
            'value': self.value,
            'reputation': self.reputation,
        }


@dataclass
class OCSFResource:
    """OCSF Resource object."""
    uid: str
    name: str
    type: str
    cloud: Optional[Dict[str, Any]] = None
    labels: List[str] = field(default_factory=list)
    owner: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'uid': self.uid,
            'name': self.name,
            'type': self.type,
            'cloud': self.cloud,
            'labels': self.labels,
            'owner': self.owner,
            'data': self.data,
        }


@dataclass
class OCSFVulnerability:
    """OCSF Vulnerability object."""
    uid: str
    title: str
    desc: Optional[str] = None
    cve: Optional[Dict[str, Any]] = None
    cvss: Optional[List[Dict[str, Any]]] = None
    cwe: Optional[Dict[str, Any]] = None
    references: List[str] = field(default_factory=list)
    severity: Optional[str] = None
    vendor_name: Optional[str] = None
    kb_articles: List[str] = field(default_factory=list)
    packages: List[Dict[str, Any]] = field(default_factory=list)
    affected_code: List[Dict[str, Any]] = field(default_factory=list)
    is_exploit_available: bool = False
    first_seen_time: Optional[datetime] = None
    last_seen_time: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'uid': self.uid,
            'title': self.title,
            'desc': self.desc,
            'cve': self.cve,
            'cvss': self.cvss,
            'cwe': self.cwe,
            'references': self.references,
            'severity': self.severity,
            'vendor_name': self.vendor_name,
            'kb_articles': self.kb_articles,
            'packages': self.packages,
            'affected_code': self.affected_code,
            'is_exploit_available': self.is_exploit_available,
            'first_seen_time': self.first_seen_time.isoformat() if self.first_seen_time else None,
            'last_seen_time': self.last_seen_time.isoformat() if self.last_seen_time else None,
        }


@dataclass
class OCSFCompliance:
    """OCSF Compliance object."""
    requirements: List[str] = field(default_factory=list)
    status: Optional[str] = None
    status_detail: Optional[str] = None
    control: Optional[str] = None
    standards: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'requirements': self.requirements,
            'status': self.status,
            'status_detail': self.status_detail,
            'control': self.control,
            'standards': self.standards,
        }


@dataclass
class OCSFEvent:
    """Base OCSF Event."""
    class_uid: int
    class_name: str
    time: datetime
    activity_id: int = 0
    activity_name: str = 'Unknown'
    type_uid: int = 0
    type_name: str = 'Unknown'
    severity_id: int = OCSFSeverity.UNKNOWN
    severity: str = 'Unknown'
    status_id: int = 0
    status: str = 'Unknown'
    message: Optional[str] = None
    metadata: OCSFMetadata = field(default_factory=OCSFMetadata)
    observables: List[OCSFObservable] = field(default_factory=list)
    resources: List[OCSFResource] = field(default_factory=list)
    raw_data: Optional[str] = None
    unmapped: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'class_uid': self.class_uid,
            'class_name': self.class_name,
            'time': self.time.isoformat() if self.time else None,
            'activity_id': self.activity_id,
            'activity_name': self.activity_name,
            'type_uid': self.type_uid,
            'type_name': self.type_name,
            'severity_id': self.severity_id,
            'severity': self.severity,
            'status_id': self.status_id,
            'status': self.status,
            'message': self.message,
            'metadata': self.metadata.to_dict(),
            'observables': [o.to_dict() for o in self.observables],
            'resources': [r.to_dict() for r in self.resources],
            'raw_data': self.raw_data,
            'unmapped': self.unmapped,
        }


@dataclass
class SecurityFinding(OCSFEvent):
    """
    OCSF Security Finding (class_uid: 1001).

    Represents a security-relevant observation or detection.
    """
    finding_uid: str = ''
    finding_title: str = ''
    finding_type: str = ''
    confidence_score: Optional[float] = None
    confidence: Optional[str] = None
    impact: Optional[str] = None
    impact_score: Optional[float] = None
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    attacks: List[Dict[str, Any]] = field(default_factory=list)
    remediation: Optional[Dict[str, Any]] = None
    evidence: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        self.class_uid = OCSFEventClass.SECURITY_FINDING
        self.class_name = 'Security Finding'

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            'finding_uid': self.finding_uid,
            'finding_title': self.finding_title,
            'finding_type': self.finding_type,
            'confidence_score': self.confidence_score,
            'confidence': self.confidence,
            'impact': self.impact,
            'impact_score': self.impact_score,
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'attacks': self.attacks,
            'remediation': self.remediation,
            'evidence': self.evidence,
        })
        return base


@dataclass
class VulnerabilityFinding(OCSFEvent):
    """
    OCSF Vulnerability Finding (class_uid: 2001).

    Represents a discovered vulnerability.
    """
    finding_uid: str = ''
    finding_title: str = ''
    vulnerabilities: List[OCSFVulnerability] = field(default_factory=list)
    affected_resources: List[OCSFResource] = field(default_factory=list)
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    remediation: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        self.class_uid = OCSFEventClass.VULNERABILITY_FINDING
        self.class_name = 'Vulnerability Finding'

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            'finding_uid': self.finding_uid,
            'finding_title': self.finding_title,
            'vulnerabilities': [v.to_dict() for v in self.vulnerabilities],
            'affected_resources': [r.to_dict() for r in self.affected_resources],
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'remediation': self.remediation,
        })
        return base


@dataclass
class ComplianceFinding(OCSFEvent):
    """
    OCSF Compliance Finding (class_uid: 2002).

    Represents a compliance check result.
    """
    finding_uid: str = ''
    finding_title: str = ''
    compliance: OCSFCompliance = field(default_factory=OCSFCompliance)
    affected_resources: List[OCSFResource] = field(default_factory=list)
    remediation: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        self.class_uid = OCSFEventClass.COMPLIANCE_FINDING
        self.class_name = 'Compliance Finding'

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            'finding_uid': self.finding_uid,
            'finding_title': self.finding_title,
            'compliance': self.compliance.to_dict(),
            'affected_resources': [r.to_dict() for r in self.affected_resources],
            'remediation': self.remediation,
        })
        return base


@dataclass
class DetectionFinding(OCSFEvent):
    """
    OCSF Detection Finding (class_uid: 2004).

    Represents a threat detection.
    """
    finding_uid: str = ''
    finding_title: str = ''
    analytic: Optional[Dict[str, Any]] = None
    attacks: List[Dict[str, Any]] = field(default_factory=list)
    malware: List[Dict[str, Any]] = field(default_factory=list)
    confidence_score: Optional[float] = None
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    affected_resources: List[OCSFResource] = field(default_factory=list)
    remediation: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        self.class_uid = OCSFEventClass.DETECTION_FINDING
        self.class_name = 'Detection Finding'

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            'finding_uid': self.finding_uid,
            'finding_title': self.finding_title,
            'analytic': self.analytic,
            'attacks': self.attacks,
            'malware': self.malware,
            'confidence_score': self.confidence_score,
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'affected_resources': [r.to_dict() for r in self.affected_resources],
            'remediation': self.remediation,
        })
        return base


# OCSF Severity mapping to CISO Assistant
OCSF_SEVERITY_TO_CISO = {
    OCSFSeverity.UNKNOWN: 'informational',
    OCSFSeverity.INFORMATIONAL: 'informational',
    OCSFSeverity.LOW: 'low',
    OCSFSeverity.MEDIUM: 'medium',
    OCSFSeverity.HIGH: 'high',
    OCSFSeverity.CRITICAL: 'critical',
    OCSFSeverity.FATAL: 'critical',
}

# CISO Assistant severity to OCSF
CISO_SEVERITY_TO_OCSF = {
    'informational': OCSFSeverity.INFORMATIONAL,
    'low': OCSFSeverity.LOW,
    'medium': OCSFSeverity.MEDIUM,
    'high': OCSFSeverity.HIGH,
    'critical': OCSFSeverity.CRITICAL,
}
