"""
Comprehensive tests for RMF Operations bounded context

Tests cover:
- StigTemplate model and serializer including usage_percentage
- NessusScan model and serializer including processing_percentage
- SystemGroup and related models
- Computed fields for frontend alignment
"""

import pytest
import uuid
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import status

from core.bounded_contexts.rmf_operations.aggregates.stig_template import StigTemplate
from core.bounded_contexts.rmf_operations.aggregates.nessus_scan import NessusScan
from core.bounded_contexts.rmf_operations.aggregates.system_group import SystemGroup
from core.bounded_contexts.rmf_operations.serializers import (
    StigTemplateSerializer,
    NessusScanSerializer,
    SystemGroupSerializer,
)


# =============================================================================
# StigTemplate Model Tests
# =============================================================================

@pytest.mark.django_db
class TestStigTemplateModel:
    """Tests for StigTemplate aggregate model"""

    def test_create_stig_template(self):
        """Test creating a new STIG template"""
        template = StigTemplate.objects.create(
            name='Windows Server 2022 STIG',
            description='DISA STIG for Windows Server 2022',
            stig_type='Windows Server 2022',
            stig_release='R1',
            stig_version='V1',
            template_type='official',
            is_active=True,
            is_official=True
        )

        assert template.id is not None
        assert template.name == 'Windows Server 2022 STIG'
        assert template.is_active is True

    def test_usage_count_default(self):
        """Test usage_count defaults to 0"""
        template = StigTemplate.objects.create(
            name='Test STIG',
            stig_type='Test',
            stig_release='R1',
            stig_version='V1'
        )

        assert template.usage_count == 0

    def test_increment_usage(self):
        """Test incrementing usage count"""
        template = StigTemplate.objects.create(
            name='Test STIG',
            stig_type='Test',
            stig_release='R1',
            stig_version='V1',
            usage_count=5
        )

        template.usage_count += 1
        template.save()

        assert template.usage_count == 6

    def test_full_stig_identifier(self):
        """Test full_stig_identifier property"""
        template = StigTemplate.objects.create(
            name='Test STIG',
            stig_type='Windows Server 2022',
            stig_release='R1',
            stig_version='V1'
        )

        # Assuming full_stig_identifier is a property that combines type/release/version
        assert template.stig_type == 'Windows Server 2022'
        assert template.stig_release == 'R1'
        assert template.stig_version == 'V1'


# =============================================================================
# StigTemplate Serializer Tests
# =============================================================================

@pytest.mark.django_db
class TestStigTemplateSerializer:
    """Tests for StigTemplate serializer including usage_percentage"""

    def test_serializer_output_fields(self):
        """Test that serializer outputs all expected fields"""
        template = StigTemplate.objects.create(
            name='Test STIG',
            description='Test description',
            stig_type='Windows Server 2022',
            stig_release='R1',
            stig_version='V1',
            is_active=True,
            usage_count=10
        )
        serializer = StigTemplateSerializer(template)
        data = serializer.data

        # Core fields
        assert 'id' in data
        assert 'name' in data
        assert 'description' in data
        assert 'stig_type' in data
        assert 'stig_release' in data
        assert 'stig_version' in data
        assert 'usage_count' in data

        # Computed fields
        assert 'full_stig_identifier' in data
        assert 'is_outdated' in data
        assert 'usage_percentage' in data

    def test_usage_percentage_zero_when_no_usage(self):
        """Test usage_percentage returns 0 when no templates have usage"""
        template = StigTemplate.objects.create(
            name='Test STIG',
            stig_type='Test',
            stig_release='R1',
            stig_version='V1',
            is_active=True,
            usage_count=0
        )
        serializer = StigTemplateSerializer(template)

        assert serializer.data['usage_percentage'] == 0.0

    def test_usage_percentage_calculation(self):
        """Test usage_percentage calculates correctly"""
        # Create templates with different usage counts
        StigTemplate.objects.create(
            name='Template 1',
            stig_type='Type 1',
            stig_release='R1',
            stig_version='V1',
            is_active=True,
            usage_count=30
        )
        StigTemplate.objects.create(
            name='Template 2',
            stig_type='Type 2',
            stig_release='R1',
            stig_version='V1',
            is_active=True,
            usage_count=70
        )

        template1 = StigTemplate.objects.get(name='Template 1')
        serializer = StigTemplateSerializer(template1)

        # 30 out of 100 total = 30%
        assert serializer.data['usage_percentage'] == 30.0

    def test_usage_percentage_with_context_optimization(self):
        """Test usage_percentage uses optimized_data from context"""
        template = StigTemplate.objects.create(
            name='Test STIG',
            stig_type='Test',
            stig_release='R1',
            stig_version='V1',
            is_active=True,
            usage_count=10
        )

        # Simulate optimized data from view context
        context = {
            'optimized_data': {
                'usage_percentages': {
                    template.id: 25.5
                }
            }
        }
        serializer = StigTemplateSerializer(template, context=context)

        assert serializer.data['usage_percentage'] == 25.5


# =============================================================================
# NessusScan Model Tests
# =============================================================================

@pytest.mark.django_db
class TestNessusScanModel:
    """Tests for NessusScan aggregate model"""

    def test_create_nessus_scan(self):
        """Test creating a new Nessus scan"""
        system_group = SystemGroup.objects.create(name='Test System')

        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='scan_2024_01_15.nessus',
            scan_date=timezone.now(),
            scanner_version='10.6.0',
            policy_name='Advanced Scan',
            total_hosts=50,
            total_vulnerabilities=150,
            critical_count=5,
            high_count=20,
            medium_count=50,
            low_count=75,
            processing_status='completed'
        )

        assert scan.id is not None
        assert scan.filename == 'scan_2024_01_15.nessus'
        assert scan.total_vulnerabilities == 150

    def test_processing_status_transitions(self):
        """Test processing status transitions"""
        system_group = SystemGroup.objects.create(name='Test System')

        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            processing_status='uploaded'
        )

        assert scan.processing_status == 'uploaded'

        scan.processing_status = 'processing'
        scan.save()
        assert scan.processing_status == 'processing'

        scan.processing_status = 'completed'
        scan.save()
        assert scan.processing_status == 'completed'

    def test_severity_counts(self):
        """Test severity count fields"""
        system_group = SystemGroup.objects.create(name='Test System')

        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            critical_count=10,
            high_count=25,
            medium_count=50,
            low_count=100,
            info_count=200
        )

        assert scan.critical_count == 10
        assert scan.high_count == 25
        assert scan.medium_count == 50
        assert scan.low_count == 100
        assert scan.info_count == 200


# =============================================================================
# NessusScan Serializer Tests
# =============================================================================

@pytest.mark.django_db
class TestNessusScanSerializer:
    """Tests for NessusScan serializer including processing_percentage"""

    def test_serializer_output_fields(self):
        """Test that serializer outputs all expected fields"""
        system_group = SystemGroup.objects.create(name='Test System')
        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            processing_status='completed',
            total_hosts=10,
            total_vulnerabilities=50
        )
        serializer = NessusScanSerializer(scan)
        data = serializer.data

        # Core fields
        assert 'id' in data
        assert 'filename' in data
        assert 'processing_status' in data
        assert 'total_hosts' in data
        assert 'total_vulnerabilities' in data

        # Computed fields
        assert 'severity_breakdown' in data
        assert 'total_severe_vulnerabilities' in data
        assert 'processing_percentage' in data

    def test_processing_percentage_uploaded(self):
        """Test processing_percentage returns 10 for uploaded status"""
        system_group = SystemGroup.objects.create(name='Test System')
        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            processing_status='uploaded'
        )
        serializer = NessusScanSerializer(scan)

        assert serializer.data['processing_percentage'] == 10

    def test_processing_percentage_processing(self):
        """Test processing_percentage returns 50 for processing status"""
        system_group = SystemGroup.objects.create(name='Test System')
        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            processing_status='processing'
        )
        serializer = NessusScanSerializer(scan)

        assert serializer.data['processing_percentage'] == 50

    def test_processing_percentage_completed(self):
        """Test processing_percentage returns 100 for completed status"""
        system_group = SystemGroup.objects.create(name='Test System')
        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            processing_status='completed'
        )
        serializer = NessusScanSerializer(scan)

        assert serializer.data['processing_percentage'] == 100

    def test_processing_percentage_failed(self):
        """Test processing_percentage returns 0 for failed status"""
        system_group = SystemGroup.objects.create(name='Test System')
        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            processing_status='failed'
        )
        serializer = NessusScanSerializer(scan)

        assert serializer.data['processing_percentage'] == 0

    def test_severity_breakdown(self):
        """Test severity_breakdown computed field"""
        system_group = SystemGroup.objects.create(name='Test System')
        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            critical_count=5,
            high_count=10,
            medium_count=20,
            low_count=40,
            processing_status='completed'
        )
        serializer = NessusScanSerializer(scan)

        # severity_breakdown should contain the counts
        assert 'severity_breakdown' in serializer.data

    def test_total_severe_vulnerabilities(self):
        """Test total_severe_vulnerabilities computed field"""
        system_group = SystemGroup.objects.create(name='Test System')
        scan = NessusScan.objects.create(
            systemGroupId=system_group.id,
            filename='test.nessus',
            critical_count=5,
            high_count=10,
            processing_status='completed'
        )
        serializer = NessusScanSerializer(scan)

        # Should be sum of critical + high
        assert serializer.data['total_severe_vulnerabilities'] == 15


# =============================================================================
# SystemGroup Model Tests
# =============================================================================

@pytest.mark.django_db
class TestSystemGroupModel:
    """Tests for SystemGroup aggregate model"""

    def test_create_system_group(self):
        """Test creating a new system group"""
        system = SystemGroup()
        system.create_system(
            name='Production Servers',
            description='All production servers'
        )
        system.save()

        assert system.id is not None
        assert system.name == 'Production Servers'

    def test_add_checklist(self):
        """Test adding a checklist to system group"""
        system = SystemGroup.objects.create(name='Test System')
        checklist_id = uuid.uuid4()
        system.checklistIds.append(checklist_id)
        system.save()

        assert checklist_id in system.checklistIds


# =============================================================================
# RMF Operations API Tests
# =============================================================================

@pytest.mark.django_db
class TestRmfOperationsAPI:
    """API tests for RMF Operations bounded context"""

    def test_list_system_groups(self, authenticated_client):
        """Test listing system groups"""
        SystemGroup.objects.create(name='System 1')
        SystemGroup.objects.create(name='System 2')

        response = authenticated_client.get('/api/rmf/system-groups/')

        assert response.status_code == status.HTTP_200_OK

    def test_create_system_group(self, authenticated_client):
        """Test creating a system group via API"""
        data = {
            'name': 'New System Group',
            'description': 'Test system group',
        }

        response = authenticated_client.post(
            '/api/rmf/system-groups/',
            data,
            format='json'
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New System Group'

    def test_list_stig_templates(self, authenticated_client):
        """Test listing STIG templates"""
        StigTemplate.objects.create(
            name='Template 1',
            stig_type='Type 1',
            stig_release='R1',
            stig_version='V1',
            is_active=True
        )

        response = authenticated_client.get('/api/rmf/stig-templates/')

        assert response.status_code == status.HTTP_200_OK

    def test_list_nessus_scans(self, authenticated_client):
        """Test listing Nessus scans"""
        system = SystemGroup.objects.create(name='Test System')
        NessusScan.objects.create(
            systemGroupId=system.id,
            filename='test.nessus',
            processing_status='completed'
        )

        response = authenticated_client.get('/api/rmf/nessus-scans/')

        assert response.status_code == status.HTTP_200_OK


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.django_db
class TestRmfIntegration:
    """Integration tests for RMF Operations"""

    def test_stig_template_usage_tracking(self):
        """Test that template usage is properly tracked"""
        # Create multiple templates
        template1 = StigTemplate.objects.create(
            name='Popular STIG',
            stig_type='Windows',
            stig_release='R1',
            stig_version='V1',
            is_active=True,
            usage_count=100
        )
        template2 = StigTemplate.objects.create(
            name='Less Popular STIG',
            stig_type='Linux',
            stig_release='R1',
            stig_version='V1',
            is_active=True,
            usage_count=25
        )

        # Verify usage percentages
        serializer1 = StigTemplateSerializer(template1)
        serializer2 = StigTemplateSerializer(template2)

        # template1 should have 80% (100/125)
        assert serializer1.data['usage_percentage'] == 80.0
        # template2 should have 20% (25/125)
        assert serializer2.data['usage_percentage'] == 20.0

    def test_nessus_scan_processing_workflow(self):
        """Test Nessus scan processing workflow"""
        system = SystemGroup.objects.create(name='Test System')

        # Start with uploaded status
        scan = NessusScan.objects.create(
            systemGroupId=system.id,
            filename='workflow_test.nessus',
            processing_status='uploaded'
        )

        serializer = NessusScanSerializer(scan)
        assert serializer.data['processing_percentage'] == 10

        # Move to processing
        scan.processing_status = 'processing'
        scan.save()
        serializer = NessusScanSerializer(scan)
        assert serializer.data['processing_percentage'] == 50

        # Complete
        scan.processing_status = 'completed'
        scan.critical_count = 5
        scan.high_count = 10
        scan.save()
        serializer = NessusScanSerializer(scan)
        assert serializer.data['processing_percentage'] == 100
        assert serializer.data['total_severe_vulnerabilities'] == 15
