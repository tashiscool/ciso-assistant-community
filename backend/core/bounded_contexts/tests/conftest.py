"""
Pytest configuration for DDD bounded context tests
"""

import pytest
import uuid
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.domain.events import EventBus, get_event_bus


User = get_user_model()


@pytest.fixture
def event_bus():
    """Provide a clean event bus for each test"""
    bus = EventBus()
    bus._store_events = False
    return bus


@pytest.fixture(autouse=True)
def reset_event_bus():
    """Reset event bus handlers before each test"""
    bus = get_event_bus()
    bus._handlers.clear()
    yield
    bus._handlers.clear()


@pytest.fixture
def api_client():
    """Provide an API client"""
    return APIClient()


@pytest.fixture
def authenticated_client(db):
    """Provide an authenticated API client"""
    user = User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def test_user(db):
    """Create a test user"""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )


# Privacy fixtures
@pytest.fixture
def data_asset_data():
    """Sample data asset data"""
    return {
        'name': 'Customer Database',
        'description': 'Primary customer data store',
        'data_categories': ['personal', 'contact', 'financial'],
        'contains_personal_data': True,
        'retention_policy': '7 years after account closure',
        'lifecycle_state': 'draft',
    }


@pytest.fixture
def consent_record_data():
    """Sample consent record data"""
    return {
        'data_subject_email': 'customer@example.com',
        'data_subject_type': 'customer',
        'consent_method': 'web_form',
        'consent_date': timezone.now().isoformat(),
        'valid_until': (timezone.now() + timedelta(days=365)).isoformat(),
        'consent_text': 'I agree to the processing of my personal data...',
        'consent_version': 'v1.2',
    }


@pytest.fixture
def data_subject_right_data():
    """Sample data subject right request data"""
    return {
        'data_subject_email': 'customer@example.com',
        'data_subject_name': 'John Doe',
        'right_type': 'access',
        'description': 'Request for copy of all personal data',
        'priority': 'medium',
        'received_date': timezone.now().isoformat(),
        'due_date': (timezone.now() + timedelta(days=30)).isoformat(),
    }


# Business Continuity fixtures
@pytest.fixture
def bcp_data():
    """Sample BCP data"""
    return {
        'name': 'IT Disaster Recovery Plan',
        'description': 'Plan for recovering IT systems after a disaster',
        'lifecycle_state': 'draft',
    }


@pytest.fixture
def bcp_audit_data():
    """Sample BCP audit data"""
    return {
        'name': 'Annual BCP Test 2024',
        'description': 'Annual test of the IT DR plan',
        'lifecycle_state': 'planned',
        'performed_at': timezone.now().isoformat(),
        'outcome': 'pass',
    }


# Third Party fixtures
@pytest.fixture
def third_party_data():
    """Sample third party data"""
    return {
        'name': 'Cloud Provider Inc',
        'description': 'Primary cloud infrastructure provider',
        'entity_type': 'vendor',
        'criticality': 'high',
        'lifecycle_state': 'prospect',
    }


# RMF Operations fixtures
@pytest.fixture
def stig_template_data():
    """Sample STIG template data"""
    return {
        'name': 'Windows Server 2022 STIG',
        'description': 'DISA STIG for Windows Server 2022',
        'stig_type': 'Windows Server 2022',
        'stig_release': 'R1',
        'stig_version': 'V1',
        'template_type': 'official',
        'is_active': True,
        'is_official': True,
        'usage_count': 10,
    }


@pytest.fixture
def nessus_scan_data():
    """Sample Nessus scan data"""
    return {
        'filename': 'scan_2024_01_15.nessus',
        'scan_date': timezone.now().isoformat(),
        'scanner_version': '10.6.0',
        'policy_name': 'Advanced Scan',
        'total_hosts': 50,
        'total_vulnerabilities': 150,
        'critical_count': 5,
        'high_count': 20,
        'medium_count': 50,
        'low_count': 75,
        'processing_status': 'completed',
    }


# Workflow fixtures
@pytest.fixture
def workflow_data():
    """Sample workflow data"""
    return {
        'name': 'Vulnerability Remediation Workflow',
        'description': 'Automated workflow for vulnerability remediation',
        'trigger': {'type': 'manual', 'config': {}},
        'tags': ['security', 'remediation'],
        'category': 'security',
    }
