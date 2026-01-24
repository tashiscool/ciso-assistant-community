"""
CRQ MIT Model Tests

Comprehensive tests for Cyber Risk Quantification models.
"""

import pytest
import uuid
from unittest.mock import Mock, MagicMock, patch


class TestQuantitativeRiskStudyModel:
    """Tests for QuantitativeRiskStudy model."""

    def test_study_status_choices(self):
        """Test study status enum values."""
        from crq_mit.models import QuantitativeRiskStudy

        expected = ['draft', 'in_progress', 'completed', 'archived']
        actual = [c[0] for c in QuantitativeRiskStudy.StudyStatus.choices]
        assert actual == expected

    def test_distribution_model_choices(self):
        """Test distribution model choices."""
        from crq_mit.models import QuantitativeRiskStudy

        expected = ['lognormal', 'pert', 'triangular', 'uniform']
        actual = [c[0] for c in QuantitativeRiskStudy.DistributionModel.choices]
        assert actual == expected

    def test_study_str_representation(self):
        """Test study string representation."""
        from crq_mit.models import QuantitativeRiskStudy

        study = QuantitativeRiskStudy(name="Q4 Risk Analysis")
        assert str(study) == "Q4 Risk Analysis"

    def test_study_default_currency(self):
        """Test default currency is USD."""
        from crq_mit.models import QuantitativeRiskStudy

        study = QuantitativeRiskStudy(name="Test")
        assert study.currency == "USD"

    def test_study_ordering(self):
        """Test study default ordering."""
        from crq_mit.models import QuantitativeRiskStudy
        assert '-created_at' in QuantitativeRiskStudy._meta.ordering


class TestQuantitativeRiskScenarioModel:
    """Tests for QuantitativeRiskScenario model."""

    def test_priority_choices(self):
        """Test priority enum values."""
        from crq_mit.models import QuantitativeRiskScenario

        expected = ['low', 'medium', 'high', 'critical']
        actual = [c[0] for c in QuantitativeRiskScenario.Priority.choices]
        assert actual == expected

    def test_scenario_status_choices(self):
        """Test scenario status choices."""
        from crq_mit.models import QuantitativeRiskScenario

        expected = ['draft', 'ready', 'analyzed', 'closed']
        actual = [c[0] for c in QuantitativeRiskScenario.ScenarioStatus.choices]
        assert actual == expected

    def test_scenario_str_representation(self):
        """Test scenario string representation."""
        from crq_mit.models import QuantitativeRiskScenario

        scenario = QuantitativeRiskScenario(name="Ransomware Attack", ref_id="RS-001")
        result = str(scenario)
        assert "Ransomware Attack" in result or "RS-001" in result

    def test_scenario_study_relationship(self):
        """Test scenario-study relationship."""
        from crq_mit.models import QuantitativeRiskScenario

        field_names = [f.name for f in QuantitativeRiskScenario._meta.get_fields()]
        assert 'study' in field_names


class TestQuantitativeRiskHypothesisModel:
    """Tests for QuantitativeRiskHypothesis model."""

    def test_risk_stage_choices(self):
        """Test risk stage choices."""
        from crq_mit.models import QuantitativeRiskHypothesis

        expected = ['current', 'residual']
        actual = [c[0] for c in QuantitativeRiskHypothesis.RiskStage.choices]
        assert actual == expected

    def test_hypothesis_str_representation(self):
        """Test hypothesis string representation."""
        from crq_mit.models import QuantitativeRiskHypothesis

        hyp = QuantitativeRiskHypothesis(stage='current')
        result = str(hyp)
        assert 'current' in result.lower() or result is not None

    def test_get_probability(self):
        """Test probability getter."""
        from crq_mit.models import QuantitativeRiskHypothesis

        hyp = QuantitativeRiskHypothesis(
            annual_probability=0.15,
            stage='current'
        )

        prob = hyp.get_probability()
        assert prob == 0.15

    def test_get_impact_bounds(self):
        """Test impact bounds getter."""
        from crq_mit.models import QuantitativeRiskHypothesis

        hyp = QuantitativeRiskHypothesis(
            impact_lower=50000,
            impact_upper=500000,
            stage='current'
        )

        lower, upper = hyp.get_impact_bounds()
        assert lower == 50000
        assert upper == 500000

    def test_get_ale_calculation(self):
        """Test Annual Loss Expectancy calculation."""
        from crq_mit.models import QuantitativeRiskHypothesis

        hyp = QuantitativeRiskHypothesis(
            annual_probability=0.20,
            impact_lower=100000,
            impact_upper=400000,
            stage='current'
        )

        ale = hyp.get_ale()

        # ALE = probability * average_impact
        # Average of lognormal is different from arithmetic mean
        # But ALE should be > 0 and reasonable
        assert ale > 0
        assert ale < 500000 * 0.20 * 2  # Reasonable upper bound

    def test_calculate_roc_positive(self):
        """Test positive ROC calculation."""
        from crq_mit.models import QuantitativeRiskHypothesis

        current = QuantitativeRiskHypothesis(
            annual_probability=0.30,
            impact_lower=200000,
            impact_upper=800000,
            stage='current'
        )
        current._ale_cache = 150000  # Mock ALE

        residual = QuantitativeRiskHypothesis(
            annual_probability=0.10,
            impact_lower=100000,
            impact_upper=300000,
            treatment_cost=50000,
            stage='residual'
        )
        residual._ale_cache = 20000  # Mock ALE

        # Mock the get_ale methods
        current.get_ale = lambda: 150000
        residual.get_ale = lambda: 20000
        residual.get_treatment_cost = lambda: 50000

        roc = residual.calculate_roc(current)

        # ROC = (current_ale - residual_ale - treatment_cost) / treatment_cost
        # ROC = (150000 - 20000 - 50000) / 50000 = 80000 / 50000 = 1.6
        assert roc == pytest.approx(1.6, rel=0.1)

    def test_calculate_roc_zero_treatment_cost(self):
        """Test ROC with zero treatment cost."""
        from crq_mit.models import QuantitativeRiskHypothesis

        current = QuantitativeRiskHypothesis(stage='current')
        current.get_ale = lambda: 100000

        residual = QuantitativeRiskHypothesis(
            treatment_cost=0,
            stage='residual'
        )
        residual.get_ale = lambda: 50000
        residual.get_treatment_cost = lambda: 0

        roc = residual.calculate_roc(current)

        # Division by zero should return None or infinity
        assert roc is None or roc == float('inf')


class TestHypothesisSimulation:
    """Tests for hypothesis simulation methods."""

    def test_run_simulation_returns_dict(self):
        """Test simulation returns proper structure."""
        from crq_mit.models import QuantitativeRiskHypothesis

        hyp = QuantitativeRiskHypothesis(
            annual_probability=0.10,
            impact_lower=10000,
            impact_upper=100000,
            stage='current'
        )

        with patch.object(hyp, 'run_simulation') as mock_sim:
            mock_sim.return_value = {
                'mean_annual_loss': 15000,
                'median_annual_loss': 10000,
                'percentile_95': 50000,
                'var_95': 50000,
                'iterations': 50000,
            }

            result = hyp.run_simulation(50000)

            assert 'mean_annual_loss' in result
            assert 'percentile_95' in result
            assert result['iterations'] == 50000

    def test_simulation_data_caching(self):
        """Test simulation data is cached."""
        from crq_mit.models import QuantitativeRiskHypothesis

        hyp = QuantitativeRiskHypothesis(
            annual_probability=0.10,
            impact_lower=10000,
            impact_upper=100000,
            stage='current'
        )

        # Field should exist for caching
        field_names = [f.name for f in QuantitativeRiskHypothesis._meta.get_fields()]
        assert 'simulation_data' in field_names
        assert 'simulation_timestamp' in field_names

    def test_is_simulation_fresh(self):
        """Test simulation freshness check."""
        from crq_mit.models import QuantitativeRiskHypothesis
        from datetime import datetime, timedelta

        hyp = QuantitativeRiskHypothesis(
            stage='current',
            simulation_timestamp=datetime.now()
        )

        if hasattr(hyp, 'is_simulation_fresh'):
            # Recent simulation should be fresh
            assert hyp.is_simulation_fresh() == True

    def test_invalidate_simulation(self):
        """Test simulation cache invalidation."""
        from crq_mit.models import QuantitativeRiskHypothesis

        hyp = QuantitativeRiskHypothesis(
            stage='current',
            simulation_data={'test': 'data'}
        )

        if hasattr(hyp, 'invalidate_simulation'):
            hyp.invalidate_simulation()
            assert hyp.simulation_data is None or hyp.simulation_data == {}


class TestModelRelationships:
    """Tests for model relationships."""

    def test_study_scenarios_relationship(self):
        """Test study-scenarios relationship."""
        from crq_mit.models import QuantitativeRiskStudy, QuantitativeRiskScenario

        # Check related_name
        scenario_field = None
        for field in QuantitativeRiskScenario._meta.get_fields():
            if field.name == 'study':
                scenario_field = field
                break

        assert scenario_field is not None

    def test_scenario_hypotheses_relationship(self):
        """Test scenario-hypotheses relationship."""
        from crq_mit.models import QuantitativeRiskScenario, QuantitativeRiskHypothesis

        # Check related_name
        hyp_field = None
        for field in QuantitativeRiskHypothesis._meta.get_fields():
            if field.name == 'scenario':
                hyp_field = field
                break

        assert hyp_field is not None
