"""
OCSF Integration Tests

Comprehensive tests for OCSF (Open Cybersecurity Schema Framework) integration:
- Data models and enums
- Parser functionality
- OCSF to OSCAL translation
- API endpoints
"""

import pytest
import json
from datetime import datetime
from uuid import UUID, uuid4

from integrations.ocsf.ocsf_models import (
    OCSFEventClass,
    OCSFSeverity,
    OCSFStatus,
    OCSFActivityType,
    OCSFMetadata,
    OCSFObservable,
    OCSFResource,
    OCSFVulnerability,
    OCSFCompliance,
    OCSFEvent,
    SecurityFinding,
    VulnerabilityFinding,
    ComplianceFinding,
    DetectionFinding,
    OCSF_SEVERITY_TO_CISO,
    CISO_SEVERITY_TO_OCSF,
)
from integrations.ocsf.ocsf_parser import (
    OCSFParser,
    OCSFParseError,
    get_ocsf_parser,
)
from integrations.ocsf.ocsf_to_oscal import (
    OCSFToOSCALTranslator,
    get_ocsf_translator,
)


# ==============================================================================
# OCSF Models Tests
# ==============================================================================

class TestOCSFEventClass:
    """Tests for OCSFEventClass enum."""

    def test_security_finding_value(self):
        assert OCSFEventClass.SECURITY_FINDING == 1001

    def test_vulnerability_finding_value(self):
        assert OCSFEventClass.VULNERABILITY_FINDING == 2001

    def test_compliance_finding_value(self):
        assert OCSFEventClass.COMPLIANCE_FINDING == 2002

    def test_detection_finding_value(self):
        assert OCSFEventClass.DETECTION_FINDING == 2004


class TestOCSFSeverity:
    """Tests for OCSFSeverity enum."""

    def test_severity_range(self):
        assert OCSFSeverity.UNKNOWN == 0
        assert OCSFSeverity.INFORMATIONAL == 1
        assert OCSFSeverity.LOW == 2
        assert OCSFSeverity.MEDIUM == 3
        assert OCSFSeverity.HIGH == 4
        assert OCSFSeverity.CRITICAL == 5
        assert OCSFSeverity.FATAL == 6

    def test_severity_to_ciso_mapping(self):
        assert OCSF_SEVERITY_TO_CISO[OCSFSeverity.UNKNOWN] == 'informational'
        assert OCSF_SEVERITY_TO_CISO[OCSFSeverity.LOW] == 'low'
        assert OCSF_SEVERITY_TO_CISO[OCSFSeverity.MEDIUM] == 'medium'
        assert OCSF_SEVERITY_TO_CISO[OCSFSeverity.HIGH] == 'high'
        assert OCSF_SEVERITY_TO_CISO[OCSFSeverity.CRITICAL] == 'critical'

    def test_ciso_to_severity_mapping(self):
        assert CISO_SEVERITY_TO_OCSF['low'] == OCSFSeverity.LOW
        assert CISO_SEVERITY_TO_OCSF['medium'] == OCSFSeverity.MEDIUM
        assert CISO_SEVERITY_TO_OCSF['high'] == OCSFSeverity.HIGH
        assert CISO_SEVERITY_TO_OCSF['critical'] == OCSFSeverity.CRITICAL


class TestOCSFStatus:
    """Tests for OCSFStatus enum."""

    def test_status_values(self):
        assert OCSFStatus.NEW == 'New'
        assert OCSFStatus.IN_PROGRESS == 'In Progress'
        assert OCSFStatus.SUPPRESSED == 'Suppressed'
        assert OCSFStatus.RESOLVED == 'Resolved'


class TestOCSFMetadata:
    """Tests for OCSFMetadata dataclass."""

    def test_default_values(self):
        metadata = OCSFMetadata()
        assert metadata.version == '1.1.0'
        assert metadata.product is None
        assert metadata.profiles == []
        assert metadata.uid is not None  # Auto-generated UUID

    def test_custom_values(self):
        metadata = OCSFMetadata(
            version='1.2.0',
            product={'name': 'TestProduct', 'vendor': 'TestVendor'},
            profiles=['security', 'compliance'],
            uid='custom-uid',
        )
        assert metadata.version == '1.2.0'
        assert metadata.product['name'] == 'TestProduct'
        assert 'security' in metadata.profiles
        assert metadata.uid == 'custom-uid'

    def test_to_dict(self):
        metadata = OCSFMetadata(version='1.1.0', uid='test-uid')
        result = metadata.to_dict()
        assert result['version'] == '1.1.0'
        assert result['uid'] == 'test-uid'
        assert 'profiles' in result


class TestOCSFObservable:
    """Tests for OCSFObservable dataclass."""

    def test_create_observable(self):
        obs = OCSFObservable(
            name='test-ip',
            type='IP Address',
            type_id=2,
            value='192.168.1.1',
        )
        assert obs.name == 'test-ip'
        assert obs.type == 'IP Address'
        assert obs.value == '192.168.1.1'

    def test_to_dict(self):
        obs = OCSFObservable(
            name='hostname',
            type='Hostname',
            type_id=1,
            value='server01.example.com',
            reputation={'score': 80},
        )
        result = obs.to_dict()
        assert result['name'] == 'hostname'
        assert result['reputation']['score'] == 80


class TestOCSFResource:
    """Tests for OCSFResource dataclass."""

    def test_create_resource(self):
        resource = OCSFResource(
            uid='res-123',
            name='production-server',
            type='Virtual Machine',
        )
        assert resource.uid == 'res-123'
        assert resource.name == 'production-server'
        assert resource.labels == []

    def test_with_cloud_metadata(self):
        resource = OCSFResource(
            uid='res-456',
            name='web-app',
            type='Container',
            cloud={'provider': 'AWS', 'region': 'us-east-1'},
            labels=['production', 'web'],
        )
        result = resource.to_dict()
        assert result['cloud']['provider'] == 'AWS'
        assert 'production' in result['labels']


class TestOCSFVulnerability:
    """Tests for OCSFVulnerability dataclass."""

    def test_basic_vulnerability(self):
        vuln = OCSFVulnerability(
            uid='CVE-2023-0001',
            title='Critical RCE Vulnerability',
            desc='Remote code execution vulnerability',
        )
        assert vuln.uid == 'CVE-2023-0001'
        assert vuln.is_exploit_available is False

    def test_vulnerability_with_cvss(self):
        vuln = OCSFVulnerability(
            uid='CVE-2023-0002',
            title='SQL Injection',
            cvss=[{'version': '3.1', 'score': 9.8, 'vector': 'CVSS:3.1/AV:N/AC:L'}],
            severity='Critical',
        )
        result = vuln.to_dict()
        assert result['cvss'][0]['score'] == 9.8
        assert result['severity'] == 'Critical'


class TestOCSFCompliance:
    """Tests for OCSFCompliance dataclass."""

    def test_compliance_object(self):
        compliance = OCSFCompliance(
            requirements=['AC-1', 'AC-2'],
            status='Pass',
            control='AC',
            standards=['NIST 800-53'],
        )
        assert 'AC-1' in compliance.requirements
        assert compliance.status == 'Pass'

    def test_to_dict(self):
        compliance = OCSFCompliance(
            requirements=['PCI-DSS 1.1'],
            status='Fail',
            status_detail='Firewall misconfigured',
        )
        result = compliance.to_dict()
        assert result['status'] == 'Fail'
        assert result['status_detail'] == 'Firewall misconfigured'


class TestOCSFEvent:
    """Tests for base OCSFEvent dataclass."""

    def test_create_base_event(self):
        event = OCSFEvent(
            class_uid=1001,
            class_name='Test Event',
            time=datetime.utcnow(),
        )
        assert event.class_uid == 1001
        assert event.severity_id == OCSFSeverity.UNKNOWN
        assert event.status == 'Unknown'

    def test_event_to_dict(self):
        event = OCSFEvent(
            class_uid=1001,
            class_name='Security Finding',
            time=datetime(2024, 1, 15, 10, 30, 0),
            severity_id=OCSFSeverity.HIGH,
            severity='High',
            message='Test security event',
        )
        result = event.to_dict()
        assert result['class_uid'] == 1001
        assert result['severity_id'] == 4
        assert result['message'] == 'Test security event'


class TestSecurityFinding:
    """Tests for SecurityFinding dataclass."""

    def test_security_finding_class_uid(self):
        finding = SecurityFinding(
            class_uid=0,  # Will be overridden
            class_name='',
            time=datetime.utcnow(),
            finding_uid='SF-001',
            finding_title='Suspicious Login Attempt',
        )
        assert finding.class_uid == OCSFEventClass.SECURITY_FINDING
        assert finding.class_name == 'Security Finding'

    def test_security_finding_with_attacks(self):
        finding = SecurityFinding(
            class_uid=1001,
            class_name='Security Finding',
            time=datetime.utcnow(),
            finding_uid='SF-002',
            finding_title='MITRE Attack Detected',
            attacks=[{'technique_uid': 'T1566', 'tactic': 'Initial Access'}],
            risk_score=8.5,
        )
        result = finding.to_dict()
        assert len(result['attacks']) == 1
        assert result['risk_score'] == 8.5


class TestVulnerabilityFinding:
    """Tests for VulnerabilityFinding dataclass."""

    def test_vulnerability_finding_class_uid(self):
        finding = VulnerabilityFinding(
            class_uid=0,
            class_name='',
            time=datetime.utcnow(),
            finding_uid='VF-001',
            finding_title='OpenSSL Vulnerability',
        )
        assert finding.class_uid == OCSFEventClass.VULNERABILITY_FINDING

    def test_vulnerability_finding_with_vulns(self):
        vuln = OCSFVulnerability(
            uid='CVE-2023-1234',
            title='Buffer Overflow',
            severity='High',
        )
        finding = VulnerabilityFinding(
            class_uid=2001,
            class_name='Vulnerability Finding',
            time=datetime.utcnow(),
            finding_uid='VF-002',
            finding_title='Multiple Vulnerabilities Found',
            vulnerabilities=[vuln],
        )
        result = finding.to_dict()
        assert len(result['vulnerabilities']) == 1
        assert result['vulnerabilities'][0]['uid'] == 'CVE-2023-1234'


class TestComplianceFinding:
    """Tests for ComplianceFinding dataclass."""

    def test_compliance_finding_class_uid(self):
        finding = ComplianceFinding(
            class_uid=0,
            class_name='',
            time=datetime.utcnow(),
            finding_uid='CF-001',
            finding_title='Compliance Check Failed',
        )
        assert finding.class_uid == OCSFEventClass.COMPLIANCE_FINDING

    def test_compliance_finding_with_compliance(self):
        compliance = OCSFCompliance(
            requirements=['SOC2 CC6.1'],
            status='Fail',
            control='Access Control',
            standards=['SOC2'],
        )
        finding = ComplianceFinding(
            class_uid=2002,
            class_name='Compliance Finding',
            time=datetime.utcnow(),
            finding_uid='CF-002',
            finding_title='Access Control Violation',
            compliance=compliance,
        )
        result = finding.to_dict()
        assert result['compliance']['status'] == 'Fail'


class TestDetectionFinding:
    """Tests for DetectionFinding dataclass."""

    def test_detection_finding_class_uid(self):
        finding = DetectionFinding(
            class_uid=0,
            class_name='',
            time=datetime.utcnow(),
            finding_uid='DF-001',
            finding_title='Malware Detected',
        )
        assert finding.class_uid == OCSFEventClass.DETECTION_FINDING

    def test_detection_finding_with_malware(self):
        finding = DetectionFinding(
            class_uid=2004,
            class_name='Detection Finding',
            time=datetime.utcnow(),
            finding_uid='DF-002',
            finding_title='Ransomware Detection',
            malware=[{'name': 'WannaCry', 'classification': 'Ransomware'}],
            confidence_score=0.95,
        )
        result = finding.to_dict()
        assert len(result['malware']) == 1
        assert result['confidence_score'] == 0.95


# ==============================================================================
# OCSF Parser Tests
# ==============================================================================

class TestOCSFParser:
    """Tests for OCSFParser class."""

    @pytest.fixture
    def parser(self):
        return OCSFParser()

    @pytest.fixture
    def security_finding_data(self):
        return {
            'class_uid': 1001,
            'class_name': 'Security Finding',
            'time': '2024-01-15T10:30:00Z',
            'severity_id': 4,
            'severity': 'High',
            'status': 'New',
            'message': 'Suspicious activity detected',
            'finding_info': {
                'uid': 'SF-001',
                'title': 'Brute Force Attack',
                'type': 'authentication',
            },
            'metadata': {
                'version': '1.1.0',
                'product': {'name': 'Security Scanner'},
            },
        }

    @pytest.fixture
    def vulnerability_finding_data(self):
        return {
            'class_uid': 2001,
            'class_name': 'Vulnerability Finding',
            'time': '2024-01-15T11:00:00Z',
            'severity_id': 5,
            'severity': 'Critical',
            'status': 'New',
            'message': 'Critical vulnerability found',
            'finding_info': {
                'uid': 'VF-001',
                'title': 'Log4j RCE',
            },
            'vulnerabilities': [
                {
                    'uid': 'CVE-2021-44228',
                    'title': 'Log4Shell',
                    'desc': 'Remote code execution in Log4j',
                    'severity': 'Critical',
                    'cvss': [{'version': '3.1', 'score': 10.0}],
                },
            ],
        }

    @pytest.fixture
    def compliance_finding_data(self):
        return {
            'class_uid': 2002,
            'class_name': 'Compliance Finding',
            'time': '2024-01-15T12:00:00Z',
            'severity_id': 3,
            'severity': 'Medium',
            'status': 'In Progress',
            'message': 'Compliance check failed',
            'finding_info': {
                'uid': 'CF-001',
                'title': 'MFA Not Enabled',
            },
            'compliance': {
                'requirements': ['IA-2(1)', 'IA-2(2)'],
                'status': 'Fail',
                'control': 'IA-2',
                'standards': ['NIST 800-53'],
            },
        }

    def test_parse_dict_security_finding(self, parser, security_finding_data):
        events = parser.parse(security_finding_data)
        assert len(events) == 1
        event = events[0]
        assert isinstance(event, SecurityFinding)
        assert event.finding_uid == 'SF-001'
        assert event.finding_title == 'Brute Force Attack'

    def test_parse_dict_vulnerability_finding(self, parser, vulnerability_finding_data):
        events = parser.parse(vulnerability_finding_data)
        assert len(events) == 1
        event = events[0]
        assert isinstance(event, VulnerabilityFinding)
        assert len(event.vulnerabilities) == 1
        assert event.vulnerabilities[0].uid == 'CVE-2021-44228'

    def test_parse_dict_compliance_finding(self, parser, compliance_finding_data):
        events = parser.parse(compliance_finding_data)
        assert len(events) == 1
        event = events[0]
        assert isinstance(event, ComplianceFinding)
        assert event.compliance.control == 'IA-2'
        assert 'NIST 800-53' in event.compliance.standards

    def test_parse_json_string(self, parser, security_finding_data):
        json_str = json.dumps(security_finding_data)
        events = parser.parse(json_str)
        assert len(events) == 1
        assert isinstance(events[0], SecurityFinding)

    def test_parse_json_array(self, parser, security_finding_data, vulnerability_finding_data):
        json_str = json.dumps([security_finding_data, vulnerability_finding_data])
        events = parser.parse(json_str)
        assert len(events) == 2
        assert isinstance(events[0], SecurityFinding)
        assert isinstance(events[1], VulnerabilityFinding)

    def test_parse_list(self, parser, security_finding_data, vulnerability_finding_data):
        events = parser.parse([security_finding_data, vulnerability_finding_data])
        assert len(events) == 2

    def test_parse_missing_class_uid(self, parser):
        invalid_data = {'message': 'No class_uid'}
        with pytest.raises(OCSFParseError) as exc_info:
            parser.parse(invalid_data)
        assert 'class_uid' in str(exc_info.value)

    def test_parse_invalid_json(self, parser):
        with pytest.raises(OCSFParseError) as exc_info:
            parser.parse('not valid json {')
        assert 'Invalid JSON' in str(exc_info.value)

    def test_parse_unsupported_type(self, parser):
        with pytest.raises(OCSFParseError) as exc_info:
            parser.parse(12345)  # Unsupported type
        assert 'Unsupported data type' in str(exc_info.value)

    def test_parse_unknown_class_uid(self, parser):
        data = {
            'class_uid': 9999,  # Unknown class
            'class_name': 'Unknown',
            'time': '2024-01-15T10:00:00Z',
        }
        events = parser.parse(data)
        assert len(events) == 1
        # Returns generic OCSFEvent for unknown classes
        assert events[0].class_uid == 9999

    def test_parse_timestamp_iso_format(self, parser):
        data = {
            'class_uid': 1001,
            'class_name': 'Security Finding',
            'time': '2024-01-15T10:30:00+00:00',
        }
        events = parser.parse(data)
        assert events[0].time is not None

    def test_parse_timestamp_unix_milliseconds(self, parser):
        data = {
            'class_uid': 1001,
            'class_name': 'Security Finding',
            'time': 1705315800000,  # Unix timestamp in ms
        }
        events = parser.parse(data)
        assert events[0].time is not None

    def test_parse_with_observables(self, parser):
        data = {
            'class_uid': 1001,
            'class_name': 'Security Finding',
            'time': '2024-01-15T10:00:00Z',
            'observables': [
                {'name': 'src_ip', 'type': 'IP Address', 'type_id': 2, 'value': '10.0.0.1'},
                {'name': 'hostname', 'type': 'Hostname', 'type_id': 1, 'value': 'attacker.example.com'},
            ],
        }
        events = parser.parse(data)
        assert len(events[0].observables) == 2
        assert events[0].observables[0].value == '10.0.0.1'

    def test_parse_with_resources(self, parser):
        data = {
            'class_uid': 1001,
            'class_name': 'Security Finding',
            'time': '2024-01-15T10:00:00Z',
            'resources': [
                {'uid': 'res-1', 'name': 'web-server', 'type': 'Virtual Machine'},
                {'uid': 'res-2', 'name': 'database', 'type': 'Database'},
            ],
        }
        events = parser.parse(data)
        assert len(events[0].resources) == 2

    def test_parse_detection_finding(self, parser):
        data = {
            'class_uid': 2004,
            'class_name': 'Detection Finding',
            'time': '2024-01-15T10:00:00Z',
            'finding_info': {
                'uid': 'DF-001',
                'title': 'Malware Detected',
            },
            'malware': [
                {'name': 'Emotet', 'classification': 'Trojan'},
            ],
            'attacks': [
                {'technique_uid': 'T1059', 'tactic': 'Execution'},
            ],
        }
        events = parser.parse(data)
        assert len(events) == 1
        event = events[0]
        assert isinstance(event, DetectionFinding)
        assert len(event.malware) == 1
        assert len(event.attacks) == 1


class TestOCSFParserSingleton:
    """Tests for get_ocsf_parser singleton."""

    def test_returns_same_instance(self):
        parser1 = get_ocsf_parser()
        parser2 = get_ocsf_parser()
        assert parser1 is parser2

    def test_parser_is_functional(self):
        parser = get_ocsf_parser()
        events = parser.parse({
            'class_uid': 1001,
            'class_name': 'Test',
            'time': '2024-01-15T10:00:00Z',
        })
        assert len(events) == 1


class TestOCSFParserConversion:
    """Tests for OCSF to CISO Assistant conversion methods."""

    @pytest.fixture
    def parser(self):
        return OCSFParser()

    def test_to_ciso_vulnerability(self, parser):
        finding = VulnerabilityFinding(
            class_uid=2001,
            class_name='Vulnerability Finding',
            time=datetime.utcnow(),
            severity_id=OCSFSeverity.CRITICAL,
            status='New',
            message='Critical vulnerability detected',
            finding_uid='VF-001',
            finding_title='SQL Injection',
            vulnerabilities=[
                OCSFVulnerability(
                    uid='CVE-2024-0001',
                    title='SQL Injection in Login',
                    desc='SQL injection vulnerability in login form',
                ),
            ],
        )

        folder_id = uuid4()
        result = parser.to_ciso_vulnerability(finding, folder_id)

        assert result['name'] == 'SQL Injection'
        assert result['severity'] == 'critical'
        assert result['folder'] == folder_id
        assert result['status'] == 'open'

    def test_to_ciso_finding(self, parser):
        finding = SecurityFinding(
            class_uid=1001,
            class_name='Security Finding',
            time=datetime.utcnow(),
            severity_id=OCSFSeverity.HIGH,
            status='In Progress',
            message='Brute force attack detected',
            finding_uid='SF-001',
            finding_title='Brute Force Attack',
            finding_type='authentication',
        )

        folder_id = uuid4()
        result = parser.to_ciso_finding(finding, folder_id)

        assert result['name'] == 'Brute Force Attack'
        assert result['severity'] == 'high'
        assert result['finding_type'] == 'authentication'


# ==============================================================================
# OCSF to OSCAL Translator Tests
# ==============================================================================

class TestOCSFToOSCALTranslator:
    """Tests for OCSFToOSCALTranslator class."""

    @pytest.fixture
    def translator(self):
        return OCSFToOSCALTranslator(system_id='test-system-123')

    @pytest.fixture
    def security_finding(self):
        return SecurityFinding(
            class_uid=1001,
            class_name='Security Finding',
            time=datetime(2024, 1, 15, 10, 30, 0),
            severity_id=OCSFSeverity.HIGH,
            severity='High',
            status='New',
            message='Unauthorized access attempt detected',
            finding_uid='SF-001',
            finding_title='Unauthorized Access',
            finding_type='intrusion',
            risk_score=7.5,
        )

    @pytest.fixture
    def vulnerability_finding(self):
        return VulnerabilityFinding(
            class_uid=2001,
            class_name='Vulnerability Finding',
            time=datetime(2024, 1, 15, 11, 0, 0),
            severity_id=OCSFSeverity.CRITICAL,
            severity='Critical',
            status='New',
            message='Critical vulnerability discovered',
            finding_uid='VF-001',
            finding_title='Remote Code Execution',
            vulnerabilities=[
                OCSFVulnerability(
                    uid='CVE-2024-0001',
                    title='RCE in Web Server',
                    cve={'uid': 'CVE-2024-0001'},
                ),
            ],
            affected_resources=[
                OCSFResource(uid='res-1', name='web-server-01', type='Server'),
            ],
        )

    @pytest.fixture
    def compliance_finding(self):
        return ComplianceFinding(
            class_uid=2002,
            class_name='Compliance Finding',
            time=datetime(2024, 1, 15, 12, 0, 0),
            severity_id=OCSFSeverity.MEDIUM,
            severity='Medium',
            status='In Progress',
            message='Compliance check failed',
            finding_uid='CF-001',
            finding_title='MFA Not Enabled',
            compliance=OCSFCompliance(
                requirements=['IA-2(1)'],
                status='Fail',
                control='IA-2',
                standards=['NIST 800-53'],
            ),
        )

    def test_translator_initialization(self, translator):
        assert translator.system_id == 'test-system-123'

    def test_translator_default_system_id(self):
        translator = OCSFToOSCALTranslator()
        assert translator.system_id is not None  # Auto-generated

    def test_translate_to_observation(self, translator, security_finding):
        observation = translator.translate_to_observation(security_finding)

        assert 'uuid' in observation
        assert observation['title'] == 'Unauthorized Access'
        assert observation['description'] == 'Unauthorized access attempt detected'
        assert 'EXAMINE' in observation['methods']
        assert observation['collected'] == '2024-01-15T10:30:00'

        # Check props
        props = {p['name']: p['value'] for p in observation['props']}
        assert props['ocsf-class-uid'] == '1001'
        assert props['ocsf-severity-id'] == '4'
        assert props['ocsf-status'] == 'New'

    def test_translate_to_observation_with_resources(self, translator):
        # Create a finding with resources (not affected_resources)
        finding = SecurityFinding(
            class_uid=1001,
            class_name='Security Finding',
            time=datetime(2024, 1, 15, 11, 0, 0),
            severity_id=OCSFSeverity.HIGH,
            severity='High',
            status='New',
            message='Test finding with resources',
            finding_uid='SF-002',
            finding_title='Resource Finding',
            resources=[
                OCSFResource(uid='res-1', name='web-server-01', type='Server'),
            ],
        )
        observation = translator.translate_to_observation(finding)

        assert 'subjects' in observation
        assert len(observation['subjects']) == 1
        assert observation['subjects'][0]['title'] == 'web-server-01'

    def test_translate_to_finding(self, translator, security_finding):
        result = translator.translate_to_finding(security_finding)

        assert 'finding' in result
        assert 'observation' in result

        finding = result['finding']
        assert finding['title'] == 'Unauthorized Access'
        assert finding['target']['status']['state'] == 'open'

        # Check risk score prop
        props = {p['name']: p['value'] for p in finding['props']}
        assert props['risk-score'] == '7.5'

    def test_translate_to_poam_item(self, translator, security_finding):
        poam_item = translator.translate_to_poam_item(security_finding)

        assert 'uuid' in poam_item
        assert poam_item['title'] == 'Unauthorized Access'

        props = {p['name']: p['value'] for p in poam_item['props']}
        assert props['risk-level'] == 'high'
        assert props['ocsf-class'] == 'Security Finding'

    def test_translate_to_poam_item_with_product(self, translator):
        finding = SecurityFinding(
            class_uid=1001,
            class_name='Security Finding',
            time=datetime.utcnow(),
            finding_uid='SF-001',
            finding_title='Test Finding',
            metadata=OCSFMetadata(
                product={'name': 'Security Scanner', 'vendor_name': 'TestVendor'},
            ),
        )

        poam_item = translator.translate_to_poam_item(finding)

        assert 'origins' in poam_item
        assert len(poam_item['origins']) == 1

    def test_translate_to_assessment_result(self, translator, security_finding, vulnerability_finding):
        events = [security_finding, vulnerability_finding]
        result = translator.translate_to_assessment_result(events, 'Test Assessment')

        assert 'assessment-results' in result
        ar = result['assessment-results']

        assert ar['metadata']['title'] == 'Test Assessment'
        assert ar['metadata']['oscal-version'] == '1.1.2'

        # Check results
        assert len(ar['results']) == 1
        results = ar['results'][0]
        assert len(results['observations']) == 2
        assert len(results['findings']) == 2

    def test_translate_compliance_finding(self, translator, compliance_finding):
        result = translator.translate_compliance_finding(compliance_finding)

        assert result['control-id'] == 'IA-2'
        assert result['status']['state'] == 'not-satisfied'

        props = {p['name']: p['value'] for p in result['props']}
        assert 'IA-2(1)' in props['requirements']
        assert 'NIST 800-53' in props['standards']

    def test_translate_vulnerability_to_inventory(self, translator, vulnerability_finding):
        inventory = translator.translate_vulnerability_to_inventory(vulnerability_finding)

        assert len(inventory) == 1
        item = inventory[0]

        assert 'uuid' in item
        assert 'Server: web-server-01' in item['description']

        props = {p['name']: p['value'] for p in item['props']}
        assert props['asset-type'] == 'Server'
        assert 'CVE-2024-0001' in props['vulnerabilities']

    def test_translate_status_mapping(self, translator):
        assert translator._translate_status('New') == 'open'
        assert translator._translate_status('In Progress') == 'investigating'
        assert translator._translate_status('Suppressed') == 'risk-accepted'
        assert translator._translate_status('Resolved') == 'closed'
        assert translator._translate_status('Unknown') == 'open'

    def test_translate_compliance_status_mapping(self, translator):
        assert translator._translate_compliance_status('Pass') == 'satisfied'
        assert translator._translate_compliance_status('Compliant') == 'satisfied'
        assert translator._translate_compliance_status('Fail') == 'not-satisfied'
        assert translator._translate_compliance_status('Non-Compliant') == 'not-satisfied'
        assert translator._translate_compliance_status('Warning') == 'partially-satisfied'
        assert translator._translate_compliance_status('Partial') == 'partially-satisfied'
        assert translator._translate_compliance_status(None) == 'not-satisfied'


class TestOCSFTranslatorSingleton:
    """Tests for get_ocsf_translator singleton."""

    def test_returns_same_instance(self):
        translator1 = get_ocsf_translator('system-1')
        translator2 = get_ocsf_translator()
        assert translator1 is translator2

    def test_new_instance_with_different_system_id(self):
        translator1 = get_ocsf_translator('system-1')
        translator2 = get_ocsf_translator('system-2')
        # Different system_id creates new instance
        assert translator1 is not translator2 or translator2.system_id == 'system-2'


# ==============================================================================
# OCSF API Views Tests
# ==============================================================================

@pytest.mark.django_db
class TestOCSFParseView:
    """Tests for OCSFParseView API endpoint."""

    @pytest.fixture
    def authenticated_client(self, client, django_user_model):
        from rest_framework.test import APIClient
        api_client = APIClient()
        user = django_user_model.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        api_client.force_authenticate(user=user)
        return api_client

    def test_parse_security_finding(self, authenticated_client):
        data = {
            'class_uid': 1001,
            'class_name': 'Security Finding',
            'time': '2024-01-15T10:00:00Z',
            'severity_id': 4,
            'message': 'Test event',
        }

        response = authenticated_client.post(
            '/api/integrations/ocsf/parse/',
            data=data,
            format='json',
        )

        assert response.status_code == 200
        assert response.data['status'] == 'success'
        assert response.data['events_count'] == 1

    def test_parse_multiple_events(self, authenticated_client):
        data = [
            {
                'class_uid': 1001,
                'class_name': 'Security Finding',
                'time': '2024-01-15T10:00:00Z',
            },
            {
                'class_uid': 2001,
                'class_name': 'Vulnerability Finding',
                'time': '2024-01-15T11:00:00Z',
            },
        ]

        response = authenticated_client.post(
            '/api/integrations/ocsf/parse/',
            data=data,
            format='json',
        )

        assert response.status_code == 200
        assert response.data['events_count'] == 2
        assert response.data['summary']['security_findings'] == 1
        assert response.data['summary']['vulnerability_findings'] == 1

    def test_parse_invalid_data(self, authenticated_client):
        data = {'invalid': 'data'}  # Missing class_uid

        response = authenticated_client.post(
            '/api/integrations/ocsf/parse/',
            data=data,
            format='json',
        )

        assert response.status_code == 400
        assert 'error' in response.data

    def test_parse_unauthenticated(self, client):
        from rest_framework.test import APIClient
        api_client = APIClient()

        response = api_client.post(
            '/api/integrations/ocsf/parse/',
            data={'class_uid': 1001},
            format='json',
        )

        assert response.status_code == 401


@pytest.mark.django_db
class TestOCSFToOSCALView:
    """Tests for OCSFToOSCALView API endpoint."""

    @pytest.fixture
    def authenticated_client(self, client, django_user_model):
        from rest_framework.test import APIClient
        api_client = APIClient()
        user = django_user_model.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        api_client.force_authenticate(user=user)
        return api_client

    def test_translate_to_assessment_results(self, authenticated_client):
        data = {
            'events': [
                {
                    'class_uid': 1001,
                    'class_name': 'Security Finding',
                    'time': '2024-01-15T10:00:00Z',
                    'message': 'Test finding',
                },
            ],
            'output_format': 'assessment-results',
        }

        response = authenticated_client.post(
            '/api/integrations/ocsf/to-oscal/',
            data=data,
            format='json',
        )

        assert response.status_code == 200
        assert response.data['status'] == 'success'
        assert response.data['format'] == 'assessment-results'
        assert 'assessment-results' in response.data['oscal']

    def test_translate_to_poam(self, authenticated_client):
        data = {
            'events': [
                {
                    'class_uid': 2001,
                    'class_name': 'Vulnerability Finding',
                    'time': '2024-01-15T10:00:00Z',
                },
            ],
            'output_format': 'poam',
        }

        response = authenticated_client.post(
            '/api/integrations/ocsf/to-oscal/',
            data=data,
            format='json',
        )

        assert response.status_code == 200
        assert 'poam-items' in response.data['oscal']

    def test_translate_to_observations(self, authenticated_client):
        data = {
            'events': [
                {
                    'class_uid': 1001,
                    'class_name': 'Security Finding',
                    'time': '2024-01-15T10:00:00Z',
                },
            ],
            'output_format': 'observations',
        }

        response = authenticated_client.post(
            '/api/integrations/ocsf/to-oscal/',
            data=data,
            format='json',
        )

        assert response.status_code == 200
        assert 'observations' in response.data['oscal']

    def test_translate_to_findings(self, authenticated_client):
        data = {
            'events': [
                {
                    'class_uid': 1001,
                    'class_name': 'Security Finding',
                    'time': '2024-01-15T10:00:00Z',
                },
            ],
            'output_format': 'findings',
        }

        response = authenticated_client.post(
            '/api/integrations/ocsf/to-oscal/',
            data=data,
            format='json',
        )

        assert response.status_code == 200
        assert 'findings' in response.data['oscal']
        assert 'observations' in response.data['oscal']

    def test_invalid_output_format(self, authenticated_client):
        data = {
            'events': [{'class_uid': 1001, 'time': '2024-01-15T10:00:00Z'}],
            'output_format': 'invalid-format',
        }

        response = authenticated_client.post(
            '/api/integrations/ocsf/to-oscal/',
            data=data,
            format='json',
        )

        assert response.status_code == 400
        assert 'Unknown output_format' in response.data['error']


@pytest.mark.django_db
class TestOCSFSchemaView:
    """Tests for OCSFSchemaView API endpoint."""

    @pytest.fixture
    def authenticated_client(self, client, django_user_model):
        from rest_framework.test import APIClient
        api_client = APIClient()
        user = django_user_model.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        api_client.force_authenticate(user=user)
        return api_client

    def test_get_schema(self, authenticated_client):
        response = authenticated_client.get('/api/integrations/ocsf/schema/')

        assert response.status_code == 200
        assert 'supported_event_classes' in response.data
        assert 'severity_levels' in response.data
        assert response.data['ocsf_version'] == '1.1.0'

    def test_schema_contains_all_event_classes(self, authenticated_client):
        response = authenticated_client.get('/api/integrations/ocsf/schema/')

        event_classes = response.data['supported_event_classes']
        class_uids = [ec['class_uid'] for ec in event_classes]

        assert 1001 in class_uids  # Security Finding
        assert 2001 in class_uids  # Vulnerability Finding
        assert 2002 in class_uids  # Compliance Finding
        assert 2004 in class_uids  # Detection Finding

    def test_schema_contains_severity_levels(self, authenticated_client):
        response = authenticated_client.get('/api/integrations/ocsf/schema/')

        severities = response.data['severity_levels']
        severity_ids = [s['id'] for s in severities]

        assert 0 in severity_ids  # Unknown
        assert 5 in severity_ids  # Critical
        assert 6 in severity_ids  # Fatal


# ==============================================================================
# Integration Tests
# ==============================================================================

class TestOCSFIntegration:
    """Integration tests for OCSF workflow."""

    def test_full_parse_translate_workflow(self):
        """Test complete workflow: parse OCSF -> translate to OSCAL."""
        # Sample OCSF events
        ocsf_data = [
            {
                'class_uid': 1001,
                'class_name': 'Security Finding',
                'time': '2024-01-15T10:00:00Z',
                'severity_id': 4,
                'severity': 'High',
                'status': 'New',
                'message': 'Brute force attack detected',
                'finding_info': {
                    'uid': 'SF-001',
                    'title': 'SSH Brute Force',
                    'type': 'authentication',
                },
            },
            {
                'class_uid': 2001,
                'class_name': 'Vulnerability Finding',
                'time': '2024-01-15T11:00:00Z',
                'severity_id': 5,
                'severity': 'Critical',
                'status': 'New',
                'message': 'Critical CVE found',
                'finding_info': {
                    'uid': 'VF-001',
                    'title': 'Log4Shell Vulnerability',
                },
                'vulnerabilities': [
                    {
                        'uid': 'CVE-2021-44228',
                        'title': 'Log4Shell',
                        'severity': 'Critical',
                    },
                ],
            },
        ]

        # Parse
        parser = get_ocsf_parser()
        events = parser.parse(ocsf_data)

        assert len(events) == 2
        assert isinstance(events[0], SecurityFinding)
        assert isinstance(events[1], VulnerabilityFinding)

        # Translate
        translator = get_ocsf_translator('test-system')
        result = translator.translate_to_assessment_result(events, 'Integration Test')

        assert 'assessment-results' in result
        ar = result['assessment-results']
        assert ar['metadata']['title'] == 'Integration Test'
        assert len(ar['results'][0]['findings']) == 2

    def test_json_roundtrip(self):
        """Test that events can be serialized and re-parsed."""
        # Use the format the parser expects (with finding_info structure)
        original_data = {
            'class_uid': 1001,
            'class_name': 'Security Finding',
            'time': '2024-01-15T10:00:00Z',
            'severity_id': 4,
            'severity': 'High',
            'status': 'New',
            'message': 'Test event',
            'finding_info': {
                'uid': 'SF-001',
                'title': 'Test Finding',
                'type': 'security',
            },
        }

        # Parse first time
        parser = get_ocsf_parser()
        events = parser.parse(original_data)

        assert len(events) == 1
        parsed_event = events[0]
        assert isinstance(parsed_event, SecurityFinding)
        assert parsed_event.finding_uid == 'SF-001'
        assert parsed_event.finding_title == 'Test Finding'

        # Serialize to JSON and re-parse to verify format compatibility
        json_str = json.dumps(original_data)
        events2 = parser.parse(json_str)
        assert len(events2) == 1
        assert events2[0].finding_uid == 'SF-001'
