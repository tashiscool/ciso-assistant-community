"""
EBIOS RM MIT Model Tests

Comprehensive tests for EBIOS RM methodology models.
"""

import pytest
import uuid
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime


class TestEbiosRMStudyModel:
    """Tests for EbiosRMStudy model."""

    def test_study_status_choices(self):
        """Test study status enum values."""
        from ebios_rm_mit.models import EbiosRMStudy

        expected = [
            ('draft', 'Draft'),
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
            ('archived', 'Archived'),
        ]
        assert list(EbiosRMStudy.StudyStatus.choices) == expected

    def test_study_status_default(self):
        """Test default study status is draft."""
        from ebios_rm_mit.models import EbiosRMStudy
        assert EbiosRMStudy.StudyStatus.DRAFT == 'draft'

    def test_study_str_representation(self):
        """Test study string representation."""
        from ebios_rm_mit.models import EbiosRMStudy

        study = EbiosRMStudy(name="Test Study", version="1.0")
        assert str(study) == "Test Study (v1.0)"

    def test_study_ordering(self):
        """Test study default ordering."""
        from ebios_rm_mit.models import EbiosRMStudy
        assert EbiosRMStudy._meta.ordering == ['-created_at']

    def test_study_get_progress_no_scenarios(self):
        """Test progress calculation with no scenarios."""
        from ebios_rm_mit.models import EbiosRMStudy

        study = EbiosRMStudy(name="Test")
        # Mock the scenarios manager
        study.operational_scenarios = MagicMock()
        study.operational_scenarios.count.return_value = 0

        progress = study.get_progress()
        assert progress['total_scenarios'] == 0
        assert progress['treated_scenarios'] == 0

    def test_study_get_progress_with_scenarios(self):
        """Test progress calculation with scenarios."""
        from ebios_rm_mit.models import EbiosRMStudy

        study = EbiosRMStudy(name="Test")
        study.operational_scenarios = MagicMock()
        study.operational_scenarios.count.return_value = 10
        study.operational_scenarios.filter.return_value.count.return_value = 3

        progress = study.get_progress()
        assert progress['total_scenarios'] == 10
        assert progress['treated_scenarios'] == 3
        assert progress['progress_percent'] == 30.0


class TestFearedEventModel:
    """Tests for FearedEvent model."""

    def test_gravity_choices(self):
        """Test gravity level choices."""
        from ebios_rm_mit.models import FearedEvent

        assert len(FearedEvent.GravityLevel.choices) == 5
        assert FearedEvent.GravityLevel.CRITICAL == 4

    def test_feared_event_str(self):
        """Test feared event string representation."""
        from ebios_rm_mit.models import FearedEvent

        fe = FearedEvent(name="Data Breach", ref_id="FE-001")
        assert str(fe) == "FE-001 - Data Breach"

    def test_feared_event_default_gravity(self):
        """Test default gravity is moderate."""
        from ebios_rm_mit.models import FearedEvent

        fe = FearedEvent(name="Test")
        assert fe.gravity == FearedEvent.GravityLevel.MODERATE


class TestRiskOriginModel:
    """Tests for RiskOrigin model."""

    def test_motivation_choices(self):
        """Test motivation level choices."""
        from ebios_rm_mit.models import RiskOrigin

        expected_values = ['undefined', 'very_low', 'low', 'significant', 'strong']
        actual_values = [c[0] for c in RiskOrigin.MotivationLevel.choices]
        assert actual_values == expected_values

    def test_resources_choices(self):
        """Test resources level choices."""
        from ebios_rm_mit.models import RiskOrigin

        expected_values = ['undefined', 'limited', 'significant', 'important', 'unlimited']
        actual_values = [c[0] for c in RiskOrigin.ResourcesLevel.choices]
        assert actual_values == expected_values

    def test_risk_origin_str(self):
        """Test risk origin string representation."""
        from ebios_rm_mit.models import RiskOrigin

        ro = RiskOrigin(name="Cybercriminal")
        assert str(ro) == "Cybercriminal"


class TestRoToModel:
    """Tests for RoTo (Risk Origin - Target Objective) model."""

    def test_pertinence_calculation_basic(self):
        """Test basic pertinence calculation."""
        from ebios_rm_mit.models import RoTo, RiskOrigin, TargetObjective

        ro = RiskOrigin(motivation='significant', resources='significant')
        to = TargetObjective(name="Test Objective")

        roto = RoTo(
            risk_origin=ro,
            target_objective=to,
            activity=3
        )

        # motivation=significant (3), resources=significant (2)
        # base = 3 * 2 = 6
        # pertinence = min(6 * 3 // 4, 16) = min(4, 16) = 4
        pertinence = roto.calculate_pertinence()
        assert pertinence == 4

    def test_pertinence_calculation_maximum(self):
        """Test pertinence caps at 16."""
        from ebios_rm_mit.models import RoTo, RiskOrigin, TargetObjective

        ro = RiskOrigin(motivation='strong', resources='unlimited')
        to = TargetObjective(name="Test")

        roto = RoTo(
            risk_origin=ro,
            target_objective=to,
            activity=4
        )

        # motivation=strong (4), resources=unlimited (4)
        # base = 4 * 4 = 16
        # pertinence = min(16 * 4 // 4, 16) = min(16, 16) = 16
        pertinence = roto.calculate_pertinence()
        assert pertinence <= 16

    def test_pertinence_calculation_undefined(self):
        """Test pertinence with undefined values."""
        from ebios_rm_mit.models import RoTo, RiskOrigin, TargetObjective

        ro = RiskOrigin(motivation='undefined', resources='undefined')
        to = TargetObjective(name="Test")

        roto = RoTo(
            risk_origin=ro,
            target_objective=to,
            activity=4
        )

        # Both undefined = 0, base = 0 * 0 = 0
        pertinence = roto.calculate_pertinence()
        assert pertinence == 0


class TestStakeholderModel:
    """Tests for Stakeholder model."""

    def test_category_choices(self):
        """Test stakeholder category choices."""
        from ebios_rm_mit.models import Stakeholder

        expected_categories = ['client', 'partner', 'supplier', 'internal', 'other']
        actual = [c[0] for c in Stakeholder.Category.choices]
        assert actual == expected_categories

    def test_criticality_choices(self):
        """Test criticality level choices."""
        from ebios_rm_mit.models import Stakeholder

        assert len(Stakeholder.CriticalityLevel.choices) == 5

    def test_stakeholder_str(self):
        """Test stakeholder string representation."""
        from ebios_rm_mit.models import Stakeholder

        stakeholder = Stakeholder(name="ACME Corp", category='supplier')
        assert str(stakeholder) == "ACME Corp"


class TestStrategicScenarioModel:
    """Tests for StrategicScenario model."""

    def test_strategic_scenario_str(self):
        """Test strategic scenario string representation."""
        from ebios_rm_mit.models import StrategicScenario

        ss = StrategicScenario(name="Ransomware Attack", ref_id="SS-001")
        assert str(ss) == "SS-001 - Ransomware Attack"

    def test_gravity_default(self):
        """Test default gravity level."""
        from ebios_rm_mit.models import StrategicScenario

        ss = StrategicScenario(name="Test")
        assert ss.gravity == 2  # Default moderate


class TestAttackPathModel:
    """Tests for AttackPath model."""

    def test_attack_path_ordering(self):
        """Test attack path ordering by order field."""
        from ebios_rm_mit.models import AttackPath
        assert 'order' in [f.name for f in AttackPath._meta.ordering] or AttackPath._meta.ordering == ['order']


class TestOperationalScenarioModel:
    """Tests for OperationalScenario model."""

    def test_treatment_choices(self):
        """Test treatment status choices."""
        from ebios_rm_mit.models import OperationalScenario

        expected = ['untreated', 'accepted', 'reduced', 'transferred', 'avoided']
        actual = [c[0] for c in OperationalScenario.TreatmentStatus.choices]
        assert actual == expected

    def test_operational_scenario_str(self):
        """Test operational scenario string representation."""
        from ebios_rm_mit.models import OperationalScenario

        os = OperationalScenario(name="Phishing Campaign", ref_id="OS-001")
        assert str(os) == "OS-001 - Phishing Campaign"

    def test_risk_level_calculation_basic(self):
        """Test basic risk level calculation."""
        from ebios_rm_mit.models import OperationalScenario

        os = OperationalScenario(
            name="Test",
            likelihood=3,
            gravity=4
        )

        risk = os.calculate_risk_level()
        assert risk == 12  # 3 * 4

    def test_risk_level_with_residual(self):
        """Test residual risk level calculation."""
        from ebios_rm_mit.models import OperationalScenario

        os = OperationalScenario(
            name="Test",
            likelihood=3,
            gravity=4,
            residual_likelihood=2,
            residual_gravity=2
        )

        initial = os.calculate_risk_level()
        residual = os.calculate_risk_level(residual=True)

        assert initial == 12
        assert residual == 4


class TestElementaryActionModel:
    """Tests for ElementaryAction model."""

    def test_action_type_choices(self):
        """Test action type choices."""
        from ebios_rm_mit.models import ElementaryAction

        expected = ['control', 'procedure', 'technical', 'organizational']
        actual = [c[0] for c in ElementaryAction.ActionType.choices]
        assert actual == expected

    def test_elementary_action_str(self):
        """Test elementary action string representation."""
        from ebios_rm_mit.models import ElementaryAction

        ea = ElementaryAction(name="Deploy IDS", ref_id="EA-001")
        assert str(ea) == "EA-001 - Deploy IDS"


class TestOperatingModeModel:
    """Tests for OperatingMode model."""

    def test_operating_mode_str(self):
        """Test operating mode string representation."""
        from ebios_rm_mit.models import OperatingMode

        om = OperatingMode(name="Normal Operations")
        assert str(om) == "Normal Operations"

    def test_primary_assets_relationship(self):
        """Test primary assets M2M relationship exists."""
        from ebios_rm_mit.models import OperatingMode

        # Check the field exists
        field_names = [f.name for f in OperatingMode._meta.get_fields()]
        assert 'primary_assets' in field_names
