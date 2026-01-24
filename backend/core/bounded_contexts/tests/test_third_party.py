"""
Comprehensive tests for Third Party Management bounded context

Tests cover:
- ThirdParty model including entity_type field
- ThirdParty serializer including computed fields
"""

import pytest
import uuid
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import status

from core.bounded_contexts.third_party_management.aggregates.third_party import ThirdParty
from core.bounded_contexts.third_party_management.serializers import ThirdPartySerializer


# =============================================================================
# ThirdParty Model Tests
# =============================================================================

@pytest.mark.django_db
class TestThirdPartyModel:
    """Tests for ThirdParty aggregate model"""

    def test_create_third_party(self):
        """Test creating a new third party"""
        tp = ThirdParty()
        tp.create(
            name='Cloud Provider Inc',
            description='Primary cloud infrastructure',
            criticality='high'
        )
        tp.save()

        assert tp.id is not None
        assert tp.name == 'Cloud Provider Inc'
        assert tp.lifecycle_state == 'prospect'
        assert tp.criticality == 'high'

    def test_entity_type_field_default(self):
        """Test entity_type field defaults to vendor"""
        tp = ThirdParty.objects.create(name='Test Vendor')

        assert tp.entity_type == 'vendor'

    def test_entity_type_field_choices(self):
        """Test entity_type field accepts all valid choices"""
        choices = ['vendor', 'partner', 'supplier', 'contractor', 'service_provider', 'consultant']

        for choice in choices:
            tp = ThirdParty.objects.create(
                name=f'Test {choice}',
                entity_type=choice
            )
            assert tp.entity_type == choice

    def test_activate_third_party(self):
        """Test activating a third party"""
        tp = ThirdParty.objects.create(
            name='Test Vendor',
            lifecycle_state='prospect'
        )
        tp.activate()
        tp.save()

        assert tp.lifecycle_state == 'active'

    def test_start_offboarding(self):
        """Test starting offboarding"""
        tp = ThirdParty.objects.create(
            name='Test Vendor',
            lifecycle_state='active'
        )
        tp.start_offboarding()
        tp.save()

        assert tp.lifecycle_state == 'offboarding'

    def test_archive_third_party(self):
        """Test archiving a third party"""
        tp = ThirdParty.objects.create(
            name='Test Vendor',
            lifecycle_state='offboarding'
        )
        tp.archive()
        tp.save()

        assert tp.lifecycle_state == 'archived'

    def test_add_service(self):
        """Test adding a service"""
        tp = ThirdParty.objects.create(name='Test Vendor')
        service_id = uuid.uuid4()
        tp.add_service(service_id)
        tp.save()

        assert service_id in tp.serviceIds

    def test_add_contract(self):
        """Test adding a contract"""
        tp = ThirdParty.objects.create(name='Test Vendor')
        contract_id = uuid.uuid4()
        tp.add_contract(contract_id)
        tp.save()

        assert contract_id in tp.contractIds

    def test_add_assessment_run(self):
        """Test adding an assessment run"""
        tp = ThirdParty.objects.create(name='Test Vendor')
        assessment_id = uuid.uuid4()
        tp.add_assessment_run(assessment_id)
        tp.save()

        assert assessment_id in tp.assessmentRunIds

    def test_add_risk(self):
        """Test adding a risk"""
        tp = ThirdParty.objects.create(name='Test Vendor')
        risk_id = uuid.uuid4()
        tp.add_risk(risk_id)
        tp.save()

        assert risk_id in tp.riskIds

    def test_add_control_implementation(self):
        """Test adding a control implementation"""
        tp = ThirdParty.objects.create(name='Test Vendor')
        implementation_id = uuid.uuid4()
        tp.add_control_implementation(implementation_id)
        tp.save()

        assert implementation_id in tp.controlImplementationIds


# =============================================================================
# ThirdParty Serializer Tests
# =============================================================================

@pytest.mark.django_db
class TestThirdPartySerializer:
    """Tests for ThirdParty serializer including computed fields"""

    def test_serializer_output_fields(self):
        """Test that serializer outputs all expected fields"""
        tp = ThirdParty.objects.create(
            name='Test Vendor',
            description='Test description',
            entity_type='vendor',
            criticality='high',
            lifecycle_state='active'
        )
        serializer = ThirdPartySerializer(tp)
        data = serializer.data

        # Core fields
        assert 'id' in data
        assert 'name' in data
        assert 'description' in data
        assert 'entity_type' in data
        assert 'criticality' in data
        assert 'lifecycle_state' in data

        # Frontend alias fields
        assert 'status' in data
        assert 'entity_name' in data
        assert 'risk_level' in data
        assert 'compliance_status' in data
        assert 'contract_status' in data

    def test_entity_type_from_model(self):
        """Test entity_type comes from model field"""
        tp = ThirdParty.objects.create(
            name='Test Partner',
            entity_type='partner'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['entity_type'] == 'partner'

    def test_status_alias_field(self):
        """Test that status maps to lifecycle_state"""
        tp = ThirdParty.objects.create(
            name='Test Vendor',
            lifecycle_state='active'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['status'] == 'active'

    def test_entity_name_alias_field(self):
        """Test that entity_name maps to name"""
        tp = ThirdParty.objects.create(name='Cloud Provider Inc')
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['entity_name'] == 'Cloud Provider Inc'

    def test_risk_level_mapping_critical(self):
        """Test risk_level maps criticality to critical"""
        tp = ThirdParty.objects.create(
            name='Test',
            criticality='critical'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['risk_level'] == 'critical'

    def test_risk_level_mapping_high(self):
        """Test risk_level maps criticality to high"""
        tp = ThirdParty.objects.create(
            name='Test',
            criticality='high'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['risk_level'] == 'high'

    def test_risk_level_mapping_medium(self):
        """Test risk_level maps criticality to medium"""
        tp = ThirdParty.objects.create(
            name='Test',
            criticality='medium'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['risk_level'] == 'medium'

    def test_risk_level_mapping_low(self):
        """Test risk_level maps criticality to low"""
        tp = ThirdParty.objects.create(
            name='Test',
            criticality='low'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['risk_level'] == 'low'

    def test_compliance_status_compliant(self):
        """Test compliance_status is compliant for active with assessments"""
        tp = ThirdParty.objects.create(
            name='Test',
            lifecycle_state='active',
            assessmentRunIds=[uuid.uuid4()]
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['compliance_status'] == 'compliant'

    def test_compliance_status_under_review(self):
        """Test compliance_status is under_review for active without assessments"""
        tp = ThirdParty.objects.create(
            name='Test',
            lifecycle_state='active',
            assessmentRunIds=[]
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['compliance_status'] == 'under_review'

    def test_compliance_status_non_compliant(self):
        """Test compliance_status is non_compliant for non-active"""
        tp = ThirdParty.objects.create(
            name='Test',
            lifecycle_state='prospect'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['compliance_status'] == 'non_compliant'

    def test_contract_status_active(self):
        """Test contract_status is active for active lifecycle"""
        tp = ThirdParty.objects.create(
            name='Test',
            lifecycle_state='active'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['contract_status'] == 'active'

    def test_contract_status_expiring_soon(self):
        """Test contract_status is expiring_soon for offboarding"""
        tp = ThirdParty.objects.create(
            name='Test',
            lifecycle_state='offboarding'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['contract_status'] == 'expiring_soon'

    def test_contract_status_expired(self):
        """Test contract_status is expired for archived"""
        tp = ThirdParty.objects.create(
            name='Test',
            lifecycle_state='archived'
        )
        serializer = ThirdPartySerializer(tp)

        assert serializer.data['contract_status'] == 'expired'


# =============================================================================
# Third Party API Tests
# =============================================================================

@pytest.mark.django_db
class TestThirdPartyAPI:
    """API tests for Third Party Management bounded context"""

    def test_create_third_party_partner_type(self):
        """Test creating a third party with partner entity type"""
        tp = ThirdParty.objects.create(
            name='Strategic Partner',
            entity_type='partner',
            criticality='high'
        )

        assert tp.entity_type == 'partner'
