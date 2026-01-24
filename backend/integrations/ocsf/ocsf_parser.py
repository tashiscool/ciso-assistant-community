"""
OCSF Parser

Parses OCSF (Open Cybersecurity Schema Framework) events from various formats
and converts them to CISO Assistant entities.
"""

from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from uuid import UUID, uuid4
import json
import logging

from .ocsf_models import (
    OCSFEvent,
    OCSFEventClass,
    OCSFSeverity,
    OCSFMetadata,
    OCSFObservable,
    OCSFResource,
    OCSFVulnerability,
    OCSFCompliance,
    SecurityFinding,
    VulnerabilityFinding,
    ComplianceFinding,
    DetectionFinding,
    OCSF_SEVERITY_TO_CISO,
)

logger = logging.getLogger(__name__)


class OCSFParseError(Exception):
    """Error parsing OCSF event."""
    pass


class OCSFParser:
    """
    Parses OCSF events from various input formats.

    Supports:
    - JSON strings
    - Dict objects
    - NDJSON (newline-delimited JSON) files
    - Lists of events
    """

    def __init__(self):
        """Initialize the parser."""
        self._event_parsers = {
            OCSFEventClass.SECURITY_FINDING: self._parse_security_finding,
            OCSFEventClass.VULNERABILITY_FINDING: self._parse_vulnerability_finding,
            OCSFEventClass.COMPLIANCE_FINDING: self._parse_compliance_finding,
            OCSFEventClass.DETECTION_FINDING: self._parse_detection_finding,
        }

    def parse(self, data: Union[str, Dict, List]) -> List[OCSFEvent]:
        """
        Parse OCSF event data.

        Args:
            data: JSON string, dict, or list of events

        Returns:
            List of parsed OCSF events
        """
        if isinstance(data, str):
            return self._parse_string(data)
        elif isinstance(data, dict):
            return [self._parse_event(data)]
        elif isinstance(data, list):
            return [self._parse_event(item) for item in data]
        else:
            raise OCSFParseError(f"Unsupported data type: {type(data)}")

    def parse_file(self, file_path: str) -> List[OCSFEvent]:
        """
        Parse OCSF events from a file.

        Args:
            file_path: Path to JSON or NDJSON file

        Returns:
            List of parsed OCSF events
        """
        events = []
        with open(file_path, 'r') as f:
            content = f.read().strip()

            # Try to parse as JSON array first
            try:
                data = json.loads(content)
                if isinstance(data, list):
                    events = self.parse(data)
                else:
                    events = [self._parse_event(data)]
            except json.JSONDecodeError:
                # Try NDJSON format
                for line in content.split('\n'):
                    if line.strip():
                        try:
                            event_data = json.loads(line)
                            events.append(self._parse_event(event_data))
                        except json.JSONDecodeError as e:
                            logger.warning(f"Failed to parse NDJSON line: {e}")

        return events

    def _parse_string(self, data: str) -> List[OCSFEvent]:
        """Parse a JSON string."""
        try:
            parsed = json.loads(data)
            if isinstance(parsed, list):
                return [self._parse_event(item) for item in parsed]
            return [self._parse_event(parsed)]
        except json.JSONDecodeError as e:
            raise OCSFParseError(f"Invalid JSON: {e}")

    def _parse_event(self, data: Dict[str, Any]) -> OCSFEvent:
        """
        Parse a single OCSF event.

        Routes to specific parser based on class_uid.
        """
        class_uid = data.get('class_uid')
        if not class_uid:
            raise OCSFParseError("Missing class_uid in OCSF event")

        parser = self._event_parsers.get(class_uid)
        if parser:
            return parser(data)

        # Return generic event for unsupported classes
        return self._parse_base_event(data)

    def _parse_base_event(self, data: Dict[str, Any]) -> OCSFEvent:
        """Parse base OCSF event fields."""
        return OCSFEvent(
            class_uid=data.get('class_uid', 0),
            class_name=data.get('class_name', 'Unknown'),
            time=self._parse_timestamp(data.get('time')),
            activity_id=data.get('activity_id', 0),
            activity_name=data.get('activity_name', 'Unknown'),
            type_uid=data.get('type_uid', 0),
            type_name=data.get('type_name', 'Unknown'),
            severity_id=data.get('severity_id', 0),
            severity=data.get('severity', 'Unknown'),
            status_id=data.get('status_id', 0),
            status=data.get('status', 'Unknown'),
            message=data.get('message'),
            metadata=self._parse_metadata(data.get('metadata', {})),
            observables=self._parse_observables(data.get('observables', [])),
            resources=self._parse_resources(data.get('resources', [])),
            raw_data=data.get('raw_data'),
            unmapped=data.get('unmapped', {}),
        )

    def _parse_security_finding(self, data: Dict[str, Any]) -> SecurityFinding:
        """Parse Security Finding event."""
        base = self._parse_base_event(data)
        return SecurityFinding(
            class_uid=base.class_uid,
            class_name=base.class_name,
            time=base.time,
            activity_id=base.activity_id,
            activity_name=base.activity_name,
            type_uid=base.type_uid,
            type_name=base.type_name,
            severity_id=base.severity_id,
            severity=base.severity,
            status_id=base.status_id,
            status=base.status,
            message=base.message,
            metadata=base.metadata,
            observables=base.observables,
            resources=base.resources,
            raw_data=base.raw_data,
            unmapped=base.unmapped,
            finding_uid=data.get('finding_info', {}).get('uid', str(uuid4())),
            finding_title=data.get('finding_info', {}).get('title', ''),
            finding_type=data.get('finding_info', {}).get('type', ''),
            confidence_score=data.get('confidence_score'),
            confidence=data.get('confidence'),
            impact=data.get('impact'),
            impact_score=data.get('impact_score'),
            risk_level=data.get('risk_level'),
            risk_score=data.get('risk_score'),
            attacks=data.get('attacks', []),
            remediation=data.get('remediation'),
            evidence=data.get('evidence'),
        )

    def _parse_vulnerability_finding(self, data: Dict[str, Any]) -> VulnerabilityFinding:
        """Parse Vulnerability Finding event."""
        base = self._parse_base_event(data)
        return VulnerabilityFinding(
            class_uid=base.class_uid,
            class_name=base.class_name,
            time=base.time,
            activity_id=base.activity_id,
            activity_name=base.activity_name,
            type_uid=base.type_uid,
            type_name=base.type_name,
            severity_id=base.severity_id,
            severity=base.severity,
            status_id=base.status_id,
            status=base.status,
            message=base.message,
            metadata=base.metadata,
            observables=base.observables,
            resources=base.resources,
            raw_data=base.raw_data,
            unmapped=base.unmapped,
            finding_uid=data.get('finding_info', {}).get('uid', str(uuid4())),
            finding_title=data.get('finding_info', {}).get('title', ''),
            vulnerabilities=self._parse_vulnerabilities(data.get('vulnerabilities', [])),
            affected_resources=self._parse_resources(data.get('affected_resources', [])),
            risk_level=data.get('risk_level'),
            risk_score=data.get('risk_score'),
            remediation=data.get('remediation'),
        )

    def _parse_compliance_finding(self, data: Dict[str, Any]) -> ComplianceFinding:
        """Parse Compliance Finding event."""
        base = self._parse_base_event(data)
        compliance_data = data.get('compliance', {})
        return ComplianceFinding(
            class_uid=base.class_uid,
            class_name=base.class_name,
            time=base.time,
            activity_id=base.activity_id,
            activity_name=base.activity_name,
            type_uid=base.type_uid,
            type_name=base.type_name,
            severity_id=base.severity_id,
            severity=base.severity,
            status_id=base.status_id,
            status=base.status,
            message=base.message,
            metadata=base.metadata,
            observables=base.observables,
            resources=base.resources,
            raw_data=base.raw_data,
            unmapped=base.unmapped,
            finding_uid=data.get('finding_info', {}).get('uid', str(uuid4())),
            finding_title=data.get('finding_info', {}).get('title', ''),
            compliance=OCSFCompliance(
                requirements=compliance_data.get('requirements', []),
                status=compliance_data.get('status'),
                status_detail=compliance_data.get('status_detail'),
                control=compliance_data.get('control'),
                standards=compliance_data.get('standards', []),
            ),
            affected_resources=self._parse_resources(data.get('affected_resources', [])),
            remediation=data.get('remediation'),
        )

    def _parse_detection_finding(self, data: Dict[str, Any]) -> DetectionFinding:
        """Parse Detection Finding event."""
        base = self._parse_base_event(data)
        return DetectionFinding(
            class_uid=base.class_uid,
            class_name=base.class_name,
            time=base.time,
            activity_id=base.activity_id,
            activity_name=base.activity_name,
            type_uid=base.type_uid,
            type_name=base.type_name,
            severity_id=base.severity_id,
            severity=base.severity,
            status_id=base.status_id,
            status=base.status,
            message=base.message,
            metadata=base.metadata,
            observables=base.observables,
            resources=base.resources,
            raw_data=base.raw_data,
            unmapped=base.unmapped,
            finding_uid=data.get('finding_info', {}).get('uid', str(uuid4())),
            finding_title=data.get('finding_info', {}).get('title', ''),
            analytic=data.get('analytic'),
            attacks=data.get('attacks', []),
            malware=data.get('malware', []),
            confidence_score=data.get('confidence_score'),
            risk_level=data.get('risk_level'),
            risk_score=data.get('risk_score'),
            affected_resources=self._parse_resources(data.get('affected_resources', [])),
            remediation=data.get('remediation'),
        )

    def _parse_timestamp(self, value: Any) -> datetime:
        """Parse timestamp from various formats."""
        if value is None:
            return datetime.utcnow()
        if isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            # Unix timestamp (milliseconds)
            return datetime.fromtimestamp(value / 1000)
        if isinstance(value, str):
            # ISO format
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except ValueError:
                pass
            # RFC 3339
            try:
                return datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%fZ')
            except ValueError:
                pass
        return datetime.utcnow()

    def _parse_metadata(self, data: Dict[str, Any]) -> OCSFMetadata:
        """Parse OCSF metadata."""
        return OCSFMetadata(
            version=data.get('version', '1.1.0'),
            product=data.get('product'),
            profiles=data.get('profiles', []),
            uid=data.get('uid', str(uuid4())),
            correlation_uid=data.get('correlation_uid'),
            tenant_uid=data.get('tenant_uid'),
            original_time=self._parse_timestamp(data.get('original_time')) if data.get('original_time') else None,
            logged_time=self._parse_timestamp(data.get('logged_time')) if data.get('logged_time') else None,
            processed_time=self._parse_timestamp(data.get('processed_time')) if data.get('processed_time') else None,
        )

    def _parse_observables(self, data: List[Dict[str, Any]]) -> List[OCSFObservable]:
        """Parse list of observables."""
        observables = []
        for item in data:
            observables.append(OCSFObservable(
                name=item.get('name', ''),
                type=item.get('type', ''),
                type_id=item.get('type_id', 0),
                value=item.get('value', ''),
                reputation=item.get('reputation'),
            ))
        return observables

    def _parse_resources(self, data: List[Dict[str, Any]]) -> List[OCSFResource]:
        """Parse list of resources."""
        resources = []
        for item in data:
            resources.append(OCSFResource(
                uid=item.get('uid', str(uuid4())),
                name=item.get('name', ''),
                type=item.get('type', ''),
                cloud=item.get('cloud'),
                labels=item.get('labels', []),
                owner=item.get('owner'),
                data=item.get('data'),
            ))
        return resources

    def _parse_vulnerabilities(self, data: List[Dict[str, Any]]) -> List[OCSFVulnerability]:
        """Parse list of vulnerabilities."""
        vulnerabilities = []
        for item in data:
            vulnerabilities.append(OCSFVulnerability(
                uid=item.get('uid', str(uuid4())),
                title=item.get('title', ''),
                desc=item.get('desc'),
                cve=item.get('cve'),
                cvss=item.get('cvss'),
                cwe=item.get('cwe'),
                references=item.get('references', []),
                severity=item.get('severity'),
                vendor_name=item.get('vendor_name'),
                kb_articles=item.get('kb_articles', []),
                packages=item.get('packages', []),
                affected_code=item.get('affected_code', []),
                is_exploit_available=item.get('is_exploit_available', False),
                first_seen_time=self._parse_timestamp(item.get('first_seen_time')) if item.get('first_seen_time') else None,
                last_seen_time=self._parse_timestamp(item.get('last_seen_time')) if item.get('last_seen_time') else None,
            ))
        return vulnerabilities

    def to_ciso_vulnerability(self, finding: VulnerabilityFinding, folder_id: UUID) -> Dict[str, Any]:
        """
        Convert OCSF Vulnerability Finding to CISO Assistant Vulnerability format.

        Args:
            finding: Parsed OCSF vulnerability finding
            folder_id: Target folder UUID

        Returns:
            Dict compatible with CISO Assistant Vulnerability model
        """
        from core.models import Vulnerability

        vuln_data = finding.vulnerabilities[0] if finding.vulnerabilities else None

        return {
            'name': finding.finding_title or (vuln_data.title if vuln_data else 'Unknown Vulnerability'),
            'description': finding.message or (vuln_data.desc if vuln_data else ''),
            'folder': folder_id,
            'severity': OCSF_SEVERITY_TO_CISO.get(finding.severity_id, 'medium'),
            'ref_id': vuln_data.uid if vuln_data else finding.finding_uid,
            'status': 'open' if finding.status in ['New', 'In Progress'] else 'closed',
            'source_data': finding.to_dict(),
        }

    def to_ciso_finding(self, finding: SecurityFinding, folder_id: UUID) -> Dict[str, Any]:
        """
        Convert OCSF Security Finding to CISO Assistant Finding format.

        Args:
            finding: Parsed OCSF security finding
            folder_id: Target folder UUID

        Returns:
            Dict compatible with CISO Assistant Finding model
        """
        return {
            'name': finding.finding_title or 'Security Finding',
            'description': finding.message or '',
            'folder': folder_id,
            'severity': OCSF_SEVERITY_TO_CISO.get(finding.severity_id, 'medium'),
            'ref_id': finding.finding_uid,
            'status': 'open' if finding.status in ['New', 'In Progress'] else 'closed',
            'finding_type': finding.finding_type or 'security',
            'source_data': finding.to_dict(),
        }


# Singleton instance
_ocsf_parser: Optional[OCSFParser] = None


def get_ocsf_parser() -> OCSFParser:
    """Get or create the OCSF parser instance."""
    global _ocsf_parser
    if _ocsf_parser is None:
        _ocsf_parser = OCSFParser()
    return _ocsf_parser
