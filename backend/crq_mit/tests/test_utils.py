"""
CRQ MIT Utils Tests

Comprehensive tests for Monte Carlo simulation and risk metrics utilities.
"""

import pytest
import math
import random
from unittest.mock import patch


class TestLognormalDistribution:
    """Tests for lognormal distribution utilities."""

    def test_mu_sigma_calculation(self):
        """Test mu and sigma calculation from 90% confidence bounds."""
        from crq_mit.utils import mu_sigma_from_lognormal_90pct

        lower = 10000
        upper = 100000

        mu, sigma = mu_sigma_from_lognormal_90pct(lower, upper)

        # Mu should be roughly log of geometric mean
        geo_mean = math.sqrt(lower * upper)
        assert abs(mu - math.log(geo_mean)) < 1.0

        # Sigma should be positive
        assert sigma > 0

    def test_mu_sigma_with_equal_bounds(self):
        """Test calculation with equal bounds (degenerate case)."""
        from crq_mit.utils import mu_sigma_from_lognormal_90pct

        value = 50000
        mu, sigma = mu_sigma_from_lognormal_90pct(value, value)

        # With equal bounds, sigma should be very small or zero
        assert sigma >= 0
        assert abs(mu - math.log(value)) < 0.1

    def test_sample_lognormal_distribution(self):
        """Test lognormal sampling."""
        from crq_mit.utils import sample_lognormal

        mu = 10.0
        sigma = 1.0

        # Sample many values
        samples = [sample_lognormal(mu, sigma) for _ in range(1000)]

        # All samples should be positive
        assert all(s > 0 for s in samples)

        # Mean should be roughly exp(mu + sigma^2/2)
        expected_mean = math.exp(mu + sigma**2 / 2)
        actual_mean = sum(samples) / len(samples)
        assert abs(actual_mean - expected_mean) / expected_mean < 0.2  # Within 20%


class TestScenarioSimulation:
    """Tests for scenario Monte Carlo simulation."""

    def test_simulate_scenario_basic(self):
        """Test basic scenario simulation."""
        from crq_mit.utils import simulate_scenario_annual_loss

        random.seed(42)  # For reproducibility

        losses = simulate_scenario_annual_loss(
            probability=0.10,
            lower_bound=10000,
            upper_bound=100000,
            num_iterations=10000
        )

        assert len(losses) == 10000

        # Most should be zero (90% probability of no loss)
        zero_count = sum(1 for l in losses if l == 0)
        assert zero_count > 8000  # Roughly 90%

    def test_simulate_scenario_high_probability(self):
        """Test scenario with high probability."""
        from crq_mit.utils import simulate_scenario_annual_loss

        random.seed(42)

        losses = simulate_scenario_annual_loss(
            probability=0.90,
            lower_bound=10000,
            upper_bound=100000,
            num_iterations=10000
        )

        # Most should have losses
        non_zero_count = sum(1 for l in losses if l > 0)
        assert non_zero_count > 8000  # Roughly 90%

    def test_simulate_scenario_zero_probability(self):
        """Test scenario with zero probability."""
        from crq_mit.utils import simulate_scenario_annual_loss

        losses = simulate_scenario_annual_loss(
            probability=0.0,
            lower_bound=10000,
            upper_bound=100000,
            num_iterations=1000
        )

        # All should be zero
        assert all(l == 0 for l in losses)

    def test_simulate_scenario_certainty(self):
        """Test scenario with 100% probability."""
        from crq_mit.utils import simulate_scenario_annual_loss

        random.seed(42)

        losses = simulate_scenario_annual_loss(
            probability=1.0,
            lower_bound=10000,
            upper_bound=100000,
            num_iterations=1000
        )

        # All should have losses
        assert all(l > 0 for l in losses)


class TestRiskMetrics:
    """Tests for risk metrics calculation."""

    def test_calculate_var_95(self):
        """Test Value at Risk calculation."""
        from crq_mit.utils import calculate_var

        losses = [0, 0, 0, 0, 0, 10000, 20000, 30000, 40000, 50000]

        var_95 = calculate_var(losses, percentile=0.95)

        # 95th percentile should be near the high end
        assert var_95 >= 40000

    def test_calculate_var_empty(self):
        """Test VaR with empty list."""
        from crq_mit.utils import calculate_var

        var = calculate_var([], percentile=0.95)
        assert var == 0 or var is None

    def test_calculate_mean_annual_loss(self):
        """Test mean annual loss calculation."""
        from crq_mit.utils import calculate_mean_annual_loss

        losses = [0, 0, 0, 0, 10000, 20000, 30000, 0, 0, 0]

        mal = calculate_mean_annual_loss(losses)

        expected = sum(losses) / len(losses)
        assert mal == expected

    def test_calculate_loss_exceedance_curve(self):
        """Test Loss Exceedance Curve calculation."""
        from crq_mit.utils import calculate_loss_exceedance_curve

        losses = [0, 10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000]

        lec = calculate_loss_exceedance_curve(losses)

        # LEC should be a list of (loss, probability) tuples
        assert len(lec) > 0
        assert all(len(point) == 2 for point in lec)

        # Probabilities should decrease as loss increases
        for i in range(1, len(lec)):
            assert lec[i][1] <= lec[i-1][1]


class TestPortfolioSimulation:
    """Tests for portfolio-level simulation."""

    def test_simulate_portfolio_basic(self):
        """Test basic portfolio simulation."""
        from crq_mit.utils import simulate_portfolio

        scenarios = [
            {'probability': 0.10, 'lower_bound': 10000, 'upper_bound': 50000},
            {'probability': 0.05, 'lower_bound': 50000, 'upper_bound': 200000},
        ]

        random.seed(42)
        result = simulate_portfolio(scenarios, num_iterations=5000)

        assert 'total_losses' in result
        assert 'mean_annual_loss' in result
        assert 'var_95' in result
        assert 'loss_exceedance_curve' in result

    def test_simulate_portfolio_empty(self):
        """Test portfolio simulation with no scenarios."""
        from crq_mit.utils import simulate_portfolio

        result = simulate_portfolio([], num_iterations=1000)

        assert result['mean_annual_loss'] == 0
        assert result['var_95'] == 0

    def test_simulate_portfolio_aggregation(self):
        """Test that portfolio properly aggregates losses."""
        from crq_mit.utils import simulate_portfolio

        scenarios = [
            {'probability': 1.0, 'lower_bound': 10000, 'upper_bound': 10000},
            {'probability': 1.0, 'lower_bound': 20000, 'upper_bound': 20000},
        ]

        random.seed(42)
        result = simulate_portfolio(scenarios, num_iterations=100)

        # With certainty and fixed bounds, total should be around 30000
        assert result['mean_annual_loss'] > 25000
        assert result['mean_annual_loss'] < 35000


class TestCombinedSimulation:
    """Tests for combined current/residual simulation."""

    def test_combined_simulation_structure(self):
        """Test combined simulation returns proper structure."""
        from crq_mit.utils import calculate_combined_simulation

        current = [
            {'probability': 0.20, 'lower_bound': 50000, 'upper_bound': 200000},
        ]
        residual = [
            {'probability': 0.05, 'lower_bound': 20000, 'upper_bound': 80000},
        ]

        random.seed(42)
        result = calculate_combined_simulation(current, residual)

        assert 'current' in result
        assert 'residual' in result
        assert 'risk_reduction' in result

    def test_combined_simulation_reduction(self):
        """Test risk reduction calculation."""
        from crq_mit.utils import calculate_combined_simulation

        current = [
            {'probability': 0.50, 'lower_bound': 100000, 'upper_bound': 200000},
        ]
        residual = [
            {'probability': 0.10, 'lower_bound': 50000, 'upper_bound': 100000},
        ]

        random.seed(42)
        result = calculate_combined_simulation(current, residual, num_iterations=10000)

        # Residual should have lower losses
        assert result['residual']['metrics']['mean_annual_loss'] < result['current']['metrics']['mean_annual_loss']

        # Risk reduction should be positive
        assert result['risk_reduction'] > 0


class TestCurrencyFormatting:
    """Tests for currency formatting utilities."""

    def test_format_currency_usd(self):
        """Test USD formatting."""
        from crq_mit.utils import format_currency

        result = format_currency(1234567.89, 'USD')
        assert '$' in result
        assert '1,234,567' in result or '1234567' in result

    def test_format_currency_eur(self):
        """Test EUR formatting."""
        from crq_mit.utils import format_currency

        result = format_currency(1000000, 'EUR')
        assert '€' in result or 'EUR' in result

    def test_format_currency_zero(self):
        """Test zero value formatting."""
        from crq_mit.utils import format_currency

        result = format_currency(0, 'USD')
        assert '$0' in result or '0' in result

    def test_format_currency_negative(self):
        """Test negative value formatting."""
        from crq_mit.utils import format_currency

        result = format_currency(-50000, 'USD')
        assert '-' in result or '(' in result


class TestStatisticalHelpers:
    """Tests for statistical helper functions."""

    def test_percentile_calculation(self):
        """Test percentile calculation."""
        from crq_mit.utils import calculate_percentile

        data = list(range(101))  # 0 to 100

        p50 = calculate_percentile(data, 0.50)
        p95 = calculate_percentile(data, 0.95)

        assert abs(p50 - 50) < 2
        assert abs(p95 - 95) < 2

    def test_median_calculation(self):
        """Test median calculation."""
        from crq_mit.utils import calculate_median

        odd_data = [1, 2, 3, 4, 5]
        even_data = [1, 2, 3, 4, 5, 6]

        assert calculate_median(odd_data) == 3
        assert calculate_median(even_data) == 3.5

    def test_standard_deviation(self):
        """Test standard deviation calculation."""
        from crq_mit.utils import calculate_std

        data = [2, 4, 4, 4, 5, 5, 7, 9]

        std = calculate_std(data)

        # Known standard deviation for this data
        assert abs(std - 2.0) < 0.1
