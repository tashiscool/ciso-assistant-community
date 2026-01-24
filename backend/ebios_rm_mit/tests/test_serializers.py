"""
EBIOS RM MIT Serializer Tests

Tests for EBIOS RM serializers.
"""

import pytest
import uuid
from unittest.mock import Mock, MagicMock


class TestEbiosRMStudySerializer:
    """Tests for EbiosRMStudy serializers."""

    def test_study_serializer_fields(self):
        """Test serializer includes all required fields."""
        from ebios_rm_mit.serializers import EbiosRMStudySerializer

        serializer = EbiosRMStudySerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'description', 'status', 'version']
        for field in required:
            assert field in field_names

    def test_study_list_serializer_is_minimal(self):
        """Test list serializer has fewer fields than full serializer."""
        from ebios_rm_mit.serializers import EbiosRMStudySerializer, EbiosRMStudyListSerializer

        full = EbiosRMStudySerializer()
        list_ser = EbiosRMStudyListSerializer()

        assert len(list_ser.fields) <= len(full.fields)

    def test_study_serializer_read_only_fields(self):
        """Test read-only fields are properly set."""
        from ebios_rm_mit.serializers import EbiosRMStudySerializer

        serializer = EbiosRMStudySerializer()
        read_only = [name for name, field in serializer.fields.items() if field.read_only]

        assert 'id' in read_only
        assert 'created_at' in read_only


class TestFearedEventSerializer:
    """Tests for FearedEvent serializers."""

    def test_feared_event_serializer_fields(self):
        """Test feared event serializer fields."""
        from ebios_rm_mit.serializers import FearedEventSerializer

        serializer = FearedEventSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'ref_id', 'gravity', 'ebios_rm_study']
        for field in required:
            assert field in field_names

    def test_feared_event_list_serializer(self):
        """Test list serializer is lightweight."""
        from ebios_rm_mit.serializers import FearedEventListSerializer

        serializer = FearedEventListSerializer()
        # List serializer should exist and be functional
        assert serializer is not None


class TestRiskOriginSerializer:
    """Tests for RiskOrigin serializers."""

    def test_risk_origin_fields(self):
        """Test risk origin serializer fields."""
        from ebios_rm_mit.serializers import RiskOriginSerializer

        serializer = RiskOriginSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'motivation', 'resources']
        for field in required:
            assert field in field_names


class TestRoToSerializer:
    """Tests for RoTo serializers."""

    def test_roto_serializer_includes_pertinence(self):
        """Test RoTo serializer includes pertinence field."""
        from ebios_rm_mit.serializers import RoToSerializer

        serializer = RoToSerializer()
        field_names = list(serializer.fields.keys())

        assert 'pertinence' in field_names
        assert 'activity' in field_names

    def test_roto_nested_serializers(self):
        """Test RoTo serializer has nested serializers."""
        from ebios_rm_mit.serializers import RoToSerializer

        serializer = RoToSerializer()

        # Should have foreign key fields
        assert 'risk_origin' in serializer.fields
        assert 'target_objective' in serializer.fields


class TestStakeholderSerializer:
    """Tests for Stakeholder serializers."""

    def test_stakeholder_serializer_fields(self):
        """Test stakeholder serializer fields."""
        from ebios_rm_mit.serializers import StakeholderSerializer

        serializer = StakeholderSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'category', 'criticality', 'exposure', 'reliability']
        for field in required:
            assert field in field_names


class TestStrategicScenarioSerializer:
    """Tests for StrategicScenario serializers."""

    def test_strategic_scenario_fields(self):
        """Test strategic scenario serializer fields."""
        from ebios_rm_mit.serializers import StrategicScenarioSerializer

        serializer = StrategicScenarioSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'ref_id', 'gravity', 'likelihood']
        for field in required:
            assert field in field_names


class TestOperationalScenarioSerializer:
    """Tests for OperationalScenario serializers."""

    def test_operational_scenario_fields(self):
        """Test operational scenario serializer fields."""
        from ebios_rm_mit.serializers import OperationalScenarioSerializer

        serializer = OperationalScenarioSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'treatment', 'likelihood', 'gravity']
        for field in required:
            assert field in field_names

    def test_operational_scenario_residual_fields(self):
        """Test residual risk fields are included."""
        from ebios_rm_mit.serializers import OperationalScenarioSerializer

        serializer = OperationalScenarioSerializer()
        field_names = list(serializer.fields.keys())

        assert 'residual_likelihood' in field_names
        assert 'residual_gravity' in field_names


class TestAttackPathSerializer:
    """Tests for AttackPath serializers."""

    def test_attack_path_fields(self):
        """Test attack path serializer fields."""
        from ebios_rm_mit.serializers import AttackPathSerializer

        serializer = AttackPathSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'order', 'strategic_scenario']
        for field in required:
            assert field in field_names


class TestElementaryActionSerializer:
    """Tests for ElementaryAction serializers."""

    def test_elementary_action_fields(self):
        """Test elementary action serializer fields."""
        from ebios_rm_mit.serializers import ElementaryActionSerializer

        serializer = ElementaryActionSerializer()
        field_names = list(serializer.fields.keys())

        required = ['id', 'name', 'ref_id', 'action_type']
        for field in required:
            assert field in field_names
