"""
TPRM MIT Serializer Tests

Tests for TPRM serializers.
"""

import pytest
from unittest.mock import Mock


class TestEntitySerializer:
    """Tests for Entity serializers."""

    def test_entity_serializer_fields(self):
        """Test entity serializer includes required fields."""
        from tprm_mit.serializers import EntitySerializer

        serializer = EntitySerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'entity_type', 'criticality', 'description']
        for field in required:
            assert field in field_names

    def test_entity_serializer_dora_fields(self):
        """Test entity serializer includes DORA fields."""
        from tprm_mit.serializers import EntitySerializer

        serializer = EntitySerializer()
        field_names = list(serializer.fields.keys())

        dora_fields = ['lei_code', 'dora_criticality', 'is_ict_provider']
        for field in dora_fields:
            assert field in field_names

    def test_entity_list_serializer_minimal(self):
        """Test list serializer is lightweight."""
        from tprm_mit.serializers import EntitySerializer, EntityListSerializer

        full = EntitySerializer()
        list_ser = EntityListSerializer()

        assert len(list_ser.fields) <= len(full.fields)


class TestRepresentativeSerializer:
    """Tests for Representative serializers."""

    def test_representative_serializer_fields(self):
        """Test representative serializer fields."""
        from tprm_mit.serializers import RepresentativeSerializer

        serializer = RepresentativeSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'first_name', 'last_name', 'email', 'entity']
        for field in required:
            assert field in field_names


class TestSolutionSerializer:
    """Tests for Solution serializers."""

    def test_solution_serializer_fields(self):
        """Test solution serializer fields."""
        from tprm_mit.serializers import SolutionSerializer

        serializer = SolutionSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'provider', 'criticality']
        for field in required:
            assert field in field_names

    def test_solution_dora_fields(self):
        """Test solution serializer has DORA fields."""
        from tprm_mit.serializers import SolutionSerializer

        serializer = SolutionSerializer()
        field_names = list(serializer.fields.keys())

        assert 'is_ict_service' in field_names
        assert 'supports_critical_function' in field_names


class TestContractSerializer:
    """Tests for Contract serializers."""

    def test_contract_serializer_fields(self):
        """Test contract serializer fields."""
        from tprm_mit.serializers import ContractSerializer

        serializer = ContractSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'contract_id', 'status', 'start_date', 'end_date']
        for field in required:
            assert field in field_names

    def test_contract_dora_fields(self):
        """Test contract serializer has DORA fields."""
        from tprm_mit.serializers import ContractSerializer

        serializer = ContractSerializer()
        field_names = list(serializer.fields.keys())

        assert 'exit_strategy' in field_names
        assert 'audit_rights' in field_names


class TestEntityAssessmentSerializer:
    """Tests for EntityAssessment serializers."""

    def test_assessment_serializer_fields(self):
        """Test assessment serializer fields."""
        from tprm_mit.serializers import EntityAssessmentSerializer

        serializer = EntityAssessmentSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'entity', 'status', 'assessment_type', 'risk_score']
        for field in required:
            assert field in field_names

    def test_assessment_read_only_fields(self):
        """Test assessment read-only fields."""
        from tprm_mit.serializers import EntityAssessmentSerializer

        serializer = EntityAssessmentSerializer()
        read_only = [name for name, field in serializer.fields.items() if field.read_only]

        assert 'id' in read_only
        assert 'created_at' in read_only
