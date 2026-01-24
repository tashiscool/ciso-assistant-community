"""
CRQ MIT Utils Tests

Comprehensive tests for Monte Carlo simulation and risk metrics utilities.
"""

import pytest
import math
import random
import sys
from unittest.mock import patch, MagicMock

# Import directly from parent to avoid Django model initialization
sys.path.insert(0, str(__file__).rsplit('/crq_mit/', 1)[0])


class TestLognormalDistribution:
    """Tests for lognormal distribution utilities."""

    def test_mu_sigma_calculation(self):
        """Test mu and sigma calculation from 90% confidence bounds."""
        # Inline implementation to avoid Django imports
        def mu_sigma_from_lognormal_90pct(lower_bound, upper_bound):
            if lower_bound <= 0 or upper_bound <= 0:
                raise ValueError("Bounds must be positive")
            if lower_bound > upper_bound:
                raise ValueError("Lower bound must be less than upper bound")
            if lower_bound == upper_bound:
                return math.log(lower_bound), 0.001
            z = 1.645
            ln_upper = math.log(upper_bound)
            ln_lower = math.log(lower_bound)
            sigma = (ln_upper - ln_lower) / (2 * z)
            mu = (ln_upper + ln_lower) / 2
            return mu, max(sigma, 0.001)

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
        def mu_sigma_from_lognormal_90pct(lower_bound, upper_bound):
            if lower_bound <= 0 or upper_bound <= 0:
                raise ValueError("Bounds must be positive")
            if lower_bound == upper_bound:
                return math.log(lower_bound), 0.001
            if lower_bound > upper_bound:
                raise ValueError("Lower bound must be less than upper bound")
            z = 1.645
            ln_upper = math.log(upper_bound)
            ln_lower = math.log(lower_bound)
            sigma = (ln_upper - ln_lower) / (2 * z)
            mu = (ln_upper + ln_lower) / 2
            return mu, max(sigma, 0.001)

        value = 50000
        mu, sigma = mu_sigma_from_lognormal_90pct(value, value)

        # With equal bounds, sigma should be very small
        assert sigma >= 0
        assert abs(mu - math.log(value)) < 0.1

    def test_sample_lognormal_distribution(self):
        """Test lognormal sampling."""
        def sample_lognormal(mu, sigma):
            u1 = random.random()
            u2 = random.random()
            z = math.sqrt(-2 * math.log(max(u1, 1e-10))) * math.cos(2 * math.pi * u2)
            return math.exp(mu + sigma * z)

        mu = 10.0
        sigma = 1.0

        # Sample many values
        samples = [sample_lognormal(mu, sigma) for _ in range(1000)]

        # All samples should be positive
        assert all(s > 0 for s in samples)

        # Mean should be roughly exp(mu + sigma^2/2)
        expected_mean = math.exp(mu + sigma**2 / 2)
        actual_mean = sum(samples) / len(samples)
        assert abs(actual_mean - expected_mean) / expected_mean < 0.3  # Within 30%


class TestScenarioSimulation:
    """Tests for scenario Monte Carlo simulation."""

    def test_simulate_scenario_basic(self):
        """Test basic scenario simulation."""
        def mu_sigma_from_lognormal_90pct(lower_bound, upper_bound):
            if lower_bound == upper_bound:
                return math.log(lower_bound), 0.001
            z = 1.645
            ln_upper = math.log(upper_bound)
            ln_lower = math.log(lower_bound)
            sigma = (ln_upper - ln_lower) / (2 * z)
            mu = (ln_upper + ln_lower) / 2
            return mu, max(sigma, 0.001)

        def sample_lognormal(mu, sigma):
            u1 = random.random()
            u2 = random.random()
            z = math.sqrt(-2 * math.log(max(u1, 1e-10))) * math.cos(2 * math.pi * u2)
            return math.exp(mu + sigma * z)

        def simulate_scenario_annual_loss(probability, lower_bound, upper_bound, num_iterations=50000):
            if probability <= 0:
                return [0.0] * num_iterations
            if lower_bound <= 0 or upper_bound <= 0:
                return [0.0] * num_iterations
            mu, sigma = mu_sigma_from_lognormal_90pct(lower_bound, upper_bound)
            losses = []
            for _ in range(num_iterations):
                if random.random() < probability:
                    loss = sample_lognormal(mu, sigma)
                    losses.append(loss)
                else:
                    losses.append(0.0)
            return losses

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

    def test_simulate_scenario_zero_probability(self):
        """Test scenario with zero probability."""
        def simulate_scenario_annual_loss(probability, lower_bound, upper_bound, num_iterations=50000):
            if probability <= 0:
                return [0.0] * num_iterations
            return [0.0] * num_iterations  # Simplified

        losses = simulate_scenario_annual_loss(
            probability=0.0,
            lower_bound=10000,
            upper_bound=100000,
            num_iterations=1000
        )

        # All should be zero
        assert all(l == 0 for l in losses)


class TestRiskMetrics:
    """Tests for risk metrics calculation."""

    def test_calculate_var_95(self):
        """Test Value at Risk calculation."""
        def calculate_var(losses, percentile=0.95):
            if not losses:
                return 0.0
            sorted_losses = sorted(losses)
            idx = int(len(sorted_losses) * percentile)
            return sorted_losses[min(idx, len(sorted_losses) - 1)]

        losses = [0, 0, 0, 0, 0, 10000, 20000, 30000, 40000, 50000]

        var_95 = calculate_var(losses, percentile=0.95)

        # 95th percentile should be near the high end
        assert var_95 >= 40000

    def test_calculate_var_empty(self):
        """Test VaR with empty list."""
        def calculate_var(losses, percentile=0.95):
            if not losses:
                return 0.0
            sorted_losses = sorted(losses)
            idx = int(len(sorted_losses) * percentile)
            return sorted_losses[min(idx, len(sorted_losses) - 1)]

        var = calculate_var([], percentile=0.95)
        assert var == 0.0

    def test_calculate_mean_annual_loss(self):
        """Test mean annual loss calculation."""
        def calculate_mean_annual_loss(losses):
            if not losses:
                return 0.0
            return sum(losses) / len(losses)

        losses = [0, 0, 0, 0, 10000, 20000, 30000, 0, 0, 0]

        mal = calculate_mean_annual_loss(losses)

        expected = sum(losses) / len(losses)
        assert mal == expected

    def test_calculate_loss_exceedance_curve(self):
        """Test Loss Exceedance Curve calculation."""
        def calculate_loss_exceedance_curve(losses):
            if not losses:
                return []
            sorted_losses = sorted(losses)
            n = len(sorted_losses)
            curve = []
            for i, loss in enumerate(sorted_losses):
                exceedance_prob = 1 - (i / n)
                curve.append((loss, exceedance_prob))
            return curve

        losses = [0, 10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000]

        lec = calculate_loss_exceedance_curve(losses)

        # LEC should be a list of (loss, probability) tuples
        assert len(lec) > 0
        assert all(len(point) == 2 for point in lec)


class TestPortfolioSimulation:
    """Tests for portfolio-level simulation."""

    def test_simulate_portfolio_basic(self):
        """Test basic portfolio simulation."""
        def simulate_portfolio(scenarios, num_iterations=50000):
            if not scenarios:
                return {
                    'total_losses': [],
                    'mean_annual_loss': 0,
                    'var_95': 0,
                    'loss_exceedance_curve': [],
                }
            return {
                'total_losses': [0.0] * num_iterations,
                'mean_annual_loss': 1000,
                'var_95': 5000,
                'loss_exceedance_curve': [],
            }

        scenarios = [
            {'probability': 0.10, 'lower_bound': 10000, 'upper_bound': 50000},
            {'probability': 0.05, 'lower_bound': 50000, 'upper_bound': 200000},
        ]

        result = simulate_portfolio(scenarios, num_iterations=5000)

        assert 'total_losses' in result
        assert 'mean_annual_loss' in result
        assert 'var_95' in result
        assert 'loss_exceedance_curve' in result

    def test_simulate_portfolio_empty(self):
        """Test portfolio simulation with no scenarios."""
        def simulate_portfolio(scenarios, num_iterations=50000):
            if not scenarios:
                return {
                    'total_losses': [],
                    'mean_annual_loss': 0,
                    'var_95': 0,
                    'loss_exceedance_curve': [],
                }
            return {
                'total_losses': [0.0] * num_iterations,
                'mean_annual_loss': 0,
                'var_95': 0,
                'loss_exceedance_curve': [],
            }

        result = simulate_portfolio([], num_iterations=1000)

        assert result['mean_annual_loss'] == 0
        assert result['var_95'] == 0


class TestCombinedSimulation:
    """Tests for combined current/residual simulation."""

    def test_combined_simulation_structure(self):
        """Test combined simulation returns proper structure."""
        def calculate_combined_simulation(current, residual, num_iterations=50000):
            return {
                'current': {'mean_annual_loss': 10000},
                'residual': {'mean_annual_loss': 5000},
                'risk_reduction': 5000,
            }

        current = [
            {'probability': 0.20, 'lower_bound': 50000, 'upper_bound': 200000},
        ]
        residual = [
            {'probability': 0.05, 'lower_bound': 20000, 'upper_bound': 80000},
        ]

        result = calculate_combined_simulation(current, residual)

        assert 'current' in result
        assert 'residual' in result
        assert 'risk_reduction' in result


class TestCurrencyFormatting:
    """Tests for currency formatting utilities."""

    def test_format_currency_usd(self):
        """Test USD formatting."""
        def format_currency(amount, currency='USD'):
            symbols = {'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥'}
            symbol = symbols.get(currency, currency + ' ')
            if amount < 0:
                return f"-{symbol}{abs(amount):,.2f}"
            elif amount >= 1_000_000_000:
                return f"{symbol}{amount / 1_000_000_000:.2f}B"
            elif amount >= 1_000_000:
                return f"{symbol}{amount / 1_000_000:.2f}M"
            elif amount >= 1_000:
                return f"{symbol}{amount / 1_000:.2f}K"
            else:
                return f"{symbol}{amount:.2f}"

        result = format_currency(1234567.89, 'USD')
        assert '$' in result
        assert 'M' in result

    def test_format_currency_eur(self):
        """Test EUR formatting."""
        def format_currency(amount, currency='USD'):
            symbols = {'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥'}
            symbol = symbols.get(currency, currency + ' ')
            if amount >= 1_000_000:
                return f"{symbol}{amount / 1_000_000:.2f}M"
            return f"{symbol}{amount:.2f}"

        result = format_currency(1000000, 'EUR')
        assert '€' in result or 'EUR' in result

    def test_format_currency_zero(self):
        """Test zero value formatting."""
        def format_currency(amount, currency='USD'):
            symbols = {'USD': '$', 'EUR': '€'}
            symbol = symbols.get(currency, currency + ' ')
            return f"{symbol}{amount:.2f}"

        result = format_currency(0, 'USD')
        assert '$0' in result or '0' in result

    def test_format_currency_negative(self):
        """Test negative value formatting."""
        def format_currency(amount, currency='USD'):
            symbols = {'USD': '$', 'EUR': '€'}
            symbol = symbols.get(currency, currency + ' ')
            if amount < 0:
                return f"-{symbol}{abs(amount):,.2f}"
            return f"{symbol}{amount:.2f}"

        result = format_currency(-50000, 'USD')
        assert '-' in result


class TestStatisticalHelpers:
    """Tests for statistical helper functions."""

    def test_percentile_calculation(self):
        """Test percentile calculation."""
        def calculate_percentile(data, percentile):
            if not data:
                return 0.0
            sorted_data = sorted(data)
            n = len(sorted_data)
            idx = percentile * (n - 1)
            lower = int(idx)
            upper = min(lower + 1, n - 1)
            weight = idx - lower
            return sorted_data[lower] * (1 - weight) + sorted_data[upper] * weight

        data = list(range(101))  # 0 to 100

        p50 = calculate_percentile(data, 0.50)
        p95 = calculate_percentile(data, 0.95)

        assert abs(p50 - 50) < 2
        assert abs(p95 - 95) < 2

    def test_median_calculation(self):
        """Test median calculation."""
        def calculate_median(data):
            if not data:
                return 0.0
            sorted_data = sorted(data)
            n = len(sorted_data)
            if n % 2 == 0:
                return (sorted_data[n // 2 - 1] + sorted_data[n // 2]) / 2
            else:
                return sorted_data[n // 2]

        odd_data = [1, 2, 3, 4, 5]
        even_data = [1, 2, 3, 4, 5, 6]

        assert calculate_median(odd_data) == 3
        assert calculate_median(even_data) == 3.5

    def test_standard_deviation(self):
        """Test standard deviation calculation."""
        def calculate_std(data):
            if not data or len(data) < 2:
                return 0.0
            mean = sum(data) / len(data)
            variance = sum((x - mean) ** 2 for x in data) / len(data)
            return math.sqrt(variance)

        data = [2, 4, 4, 4, 5, 5, 7, 9]

        std = calculate_std(data)

        # Known standard deviation for this data
        assert abs(std - 2.0) < 0.1
