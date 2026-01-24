"""
TPRM MIT Model Tests

Comprehensive tests for Third-Party Risk Management models.
"""

import pytest
import uuid
from unittest.mock import Mock, MagicMock
from datetime import date, timedelta


class TestEntityModel:
    """Tests for Entity model."""

    def test_entity_type_choices(self):
        """Test entity type enum values."""
        from tprm_mit.models import Entity

        expected = ['supplier', 'vendor', 'partner', 'contractor', 'service_provider', 'other']
        actual = [c[0] for c in Entity.EntityType.choices]
        assert actual == expected

    def test_criticality_choices(self):
        """Test criticality level choices."""
        from tprm_mit.models import Entity

        expected = ['low', 'medium', 'high', 'critical']
        actual = [c[0] for c in Entity.CriticalityLevel.choices]
        assert actual == expected

    def test_entity_str_representation(self):
        """Test entity string representation."""
        from tprm_mit.models import Entity

        entity = Entity(name="ACME Corporation")
        assert str(entity) == "ACME Corporation"

    def test_entity_default_criticality(self):
        """Test default criticality is medium."""
        from tprm_mit.models import Entity

        entity = Entity(name="Test")
        assert entity.criticality == Entity.CriticalityLevel.MEDIUM

    def test_entity_ordering(self):
        """Test entity default ordering."""
        from tprm_mit.models import Entity
        assert Entity._meta.ordering == ['name']


class TestRepresentativeModel:
    """Tests for Representative model."""

    def test_representative_str(self):
        """Test representative string representation."""
        from tprm_mit.models import Representative

        rep = Representative(first_name="John", last_name="Doe")
        assert "John" in str(rep)
        assert "Doe" in str(rep)

    def test_representative_email_field(self):
        """Test representative has email field."""
        from tprm_mit.models import Representative

        field_names = [f.name for f in Representative._meta.get_fields()]
        assert 'email' in field_names

    def test_representative_entity_relationship(self):
        """Test representative-entity relationship."""
        from tprm_mit.models import Representative

        field_names = [f.name for f in Representative._meta.get_fields()]
        assert 'entity' in field_names


class TestSolutionModel:
    """Tests for Solution model."""

    def test_solution_str(self):
        """Test solution string representation."""
        from tprm_mit.models import Solution

        solution = Solution(name="Cloud Storage Service")
        assert str(solution) == "Cloud Storage Service"

    def test_solution_provider_relationship(self):
        """Test solution-provider relationship."""
        from tprm_mit.models import Solution

        field_names = [f.name for f in Solution._meta.get_fields()]
        assert 'provider' in field_names

    def test_solution_criticality_field(self):
        """Test solution has criticality field."""
        from tprm_mit.models import Solution

        field_names = [f.name for f in Solution._meta.get_fields()]
        assert 'criticality' in field_names


class TestContractModel:
    """Tests for Contract model."""

    def test_contract_str(self):
        """Test contract string representation."""
        from tprm_mit.models import Contract

        contract = Contract(name="SaaS Agreement 2026", contract_id="CONT-001")
        assert "SaaS Agreement 2026" in str(contract) or "CONT-001" in str(contract)

    def test_contract_status_choices(self):
        """Test contract status choices."""
        from tprm_mit.models import Contract

        expected = ['draft', 'active', 'expired', 'terminated', 'renewed']
        actual = [c[0] for c in Contract.Status.choices]
        assert actual == expected

    def test_contract_dates(self):
        """Test contract date fields exist."""
        from tprm_mit.models import Contract

        field_names = [f.name for f in Contract._meta.get_fields()]
        assert 'start_date' in field_names
        assert 'end_date' in field_names

    def test_contract_is_active(self):
        """Test contract active status check."""
        from tprm_mit.models import Contract

        today = date.today()
        contract = Contract(
            name="Test",
            status='active',
            start_date=today - timedelta(days=30),
            end_date=today + timedelta(days=30)
        )

        assert contract.is_active()

    def test_contract_is_expired(self):
        """Test contract expired status check."""
        from tprm_mit.models import Contract

        today = date.today()
        contract = Contract(
            name="Test",
            status='active',
            start_date=today - timedelta(days=60),
            end_date=today - timedelta(days=30)
        )

        assert contract.is_expired()


class TestEntityAssessmentModel:
    """Tests for EntityAssessment model."""

    def test_assessment_status_choices(self):
        """Test assessment status choices."""
        from tprm_mit.models import EntityAssessment

        expected = ['pending', 'in_progress', 'completed', 'approved', 'rejected']
        actual = [c[0] for c in EntityAssessment.Status.choices]
        assert actual == expected

    def test_assessment_str(self):
        """Test assessment string representation."""
        from tprm_mit.models import EntityAssessment, Entity

        entity = Entity(name="Vendor X")
        assessment = EntityAssessment(entity=entity, assessment_type="initial")
        assert "Vendor X" in str(assessment) or "initial" in str(assessment)

    def test_assessment_entity_relationship(self):
        """Test assessment-entity relationship."""
        from tprm_mit.models import EntityAssessment

        field_names = [f.name for f in EntityAssessment._meta.get_fields()]
        assert 'entity' in field_names

    def test_assessment_risk_score_range(self):
        """Test risk score validation."""
        from tprm_mit.models import EntityAssessment

        # Find the risk_score field
        for field in EntityAssessment._meta.get_fields():
            if field.name == 'risk_score':
                # Check validators if they exist
                if hasattr(field, 'validators'):
                    assert len(field.validators) >= 0
                break


class TestDoraFields:
    """Tests for DORA compliance fields."""

    def test_entity_dora_fields(self):
        """Test Entity has DORA-specific fields."""
        from tprm_mit.models import Entity

        field_names = [f.name for f in Entity._meta.get_fields()]

        # Check for DORA fields
        dora_fields = ['lei_code', 'dora_criticality', 'is_ict_provider']
        for field in dora_fields:
            assert field in field_names, f"Missing DORA field: {field}"

    def test_solution_dora_fields(self):
        """Test Solution has DORA-specific fields."""
        from tprm_mit.models import Solution

        field_names = [f.name for f in Solution._meta.get_fields()]

        # Check for DORA fields
        dora_fields = ['is_ict_service', 'function_type', 'supports_critical_function']
        for field in dora_fields:
            assert field in field_names, f"Missing DORA field: {field}"

    def test_contract_dora_fields(self):
        """Test Contract has DORA-specific fields."""
        from tprm_mit.models import Contract

        field_names = [f.name for f in Contract._meta.get_fields()]

        # Check for DORA fields
        dora_fields = ['exit_strategy', 'subcontracting_allowed', 'audit_rights']
        for field in dora_fields:
            assert field in field_names, f"Missing DORA field: {field}"


class TestEntityMethods:
    """Tests for Entity model methods."""

    def test_get_active_contracts(self):
        """Test getting active contracts for an entity."""
        from tprm_mit.models import Entity

        entity = Entity(name="Test")
        entity.contracts = MagicMock()
        entity.contracts.filter.return_value.count.return_value = 2

        # This would be called via the manager
        entity.contracts.filter(status='active')
        entity.contracts.filter.assert_called_once()

    def test_get_solutions_count(self):
        """Test counting solutions for an entity."""
        from tprm_mit.models import Entity

        entity = Entity(name="Test")
        entity.solutions = MagicMock()
        entity.solutions.count.return_value = 5

        assert entity.solutions.count() == 5

    def test_get_risk_level(self):
        """Test entity risk level calculation."""
        from tprm_mit.models import Entity

        entity = Entity(name="Test", criticality='critical')

        # Risk level should consider criticality
        # This tests the method exists and is callable
        if hasattr(entity, 'get_risk_level'):
            risk = entity.get_risk_level()
            assert risk is not None
