"""
CRQ Utilities - MIT Licensed

Monte Carlo simulation and risk calculation utilities.
Copyright (c) 2026 Tash
"""

import math
from typing import List, Dict, Any, Tuple
import random


def mu_sigma_from_lognormal_90pct(lower_bound: float, upper_bound: float) -> Tuple[float, float]:
    """
    Calculate lognormal μ and σ from 90% confidence interval bounds.

    For a 90% CI, the bounds represent the 5th and 95th percentiles.
    """
    if lower_bound <= 0 or upper_bound <= 0:
        raise ValueError("Bounds must be positive")
    if lower_bound >= upper_bound:
        raise ValueError("Lower bound must be less than upper bound")

    # For 90% CI, z-score at 5th percentile is -1.645
    z = 1.645

    # log(upper) = μ + z*σ
    # log(lower) = μ - z*σ
    # Solving:
    ln_upper = math.log(upper_bound)
    ln_lower = math.log(lower_bound)

    sigma = (ln_upper - ln_lower) / (2 * z)
    mu = (ln_upper + ln_lower) / 2

    return mu, sigma


def sample_lognormal(mu: float, sigma: float) -> float:
    """Sample from a lognormal distribution."""
    # Use Box-Muller transform for normal, then exp for lognormal
    u1 = random.random()
    u2 = random.random()
    z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
    return math.exp(mu + sigma * z)


def simulate_scenario_annual_loss(
    probability: float,
    lower_bound: float,
    upper_bound: float,
    num_iterations: int = 50000
) -> List[float]:
    """
    Run Monte Carlo simulation for a single scenario.

    Stage 1: Bernoulli trial for event occurrence
    Stage 2: Lognormal sampling for loss severity

    Returns list of annual losses for each iteration.
    """
    if probability <= 0:
        return [0.0] * num_iterations
    if lower_bound <= 0 or upper_bound <= 0:
        return [0.0] * num_iterations

    mu, sigma = mu_sigma_from_lognormal_90pct(lower_bound, upper_bound)
    losses = []

    for _ in range(num_iterations):
        # Stage 1: Does the event occur this year?
        if random.random() < probability:
            # Stage 2: Sample the loss severity
            loss = sample_lognormal(mu, sigma)
            losses.append(loss)
        else:
            losses.append(0.0)

    return losses


def create_loss_exceedance_curve(
    losses: List[float],
    max_points: int = 1000
) -> List[Dict[str, float]]:
    """
    Generate Loss Exceedance Curve (LEC) from simulation results.

    The LEC shows the probability of exceeding various loss levels.
    Returns list of {loss, exceedance_probability} points.
    """
    if not losses:
        return []

    # Sort losses descending for exceedance calculation
    sorted_losses = sorted(losses, reverse=True)
    n = len(sorted_losses)

    # Downsample if too many points
    if n > max_points:
        step = n // max_points
        indices = range(0, n, step)
    else:
        indices = range(n)

    curve = []
    for i in indices:
        loss = sorted_losses[i]
        exceedance_prob = (i + 1) / n
        curve.append({
            'loss': round(loss, 2),
            'exceedance_probability': round(exceedance_prob, 6)
        })

    return curve


def calculate_risk_metrics(
    losses: List[float],
    threshold: float = 0
) -> Dict[str, Any]:
    """
    Calculate comprehensive risk metrics from simulation results.

    Returns:
    - Mean Annual Loss (MAL)
    - Standard Deviation
    - Value-at-Risk (VaR) at 95%, 99%, 99.9%
    - Expected Shortfall (ES) at 99%
    - Maximum Credible Loss
    - Various probability metrics
    """
    if not losses:
        return {}

    n = len(losses)
    sorted_losses = sorted(losses)

    # Non-zero losses for event-conditional metrics
    non_zero = [l for l in losses if l > 0]

    # Basic statistics
    mean_loss = sum(losses) / n
    variance = sum((l - mean_loss) ** 2 for l in losses) / n
    std_dev = math.sqrt(variance)

    # Percentile function
    def percentile(data: List[float], p: float) -> float:
        if not data:
            return 0
        k = (len(data) - 1) * p / 100
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return data[int(k)]
        return data[int(f)] * (c - k) + data[int(c)] * (k - f)

    # Value-at-Risk at different confidence levels
    var_95 = percentile(sorted_losses, 95)
    var_99 = percentile(sorted_losses, 99)
    var_999 = percentile(sorted_losses, 99.9)

    # Expected Shortfall (Conditional VaR) at 99%
    cutoff_idx = int(n * 0.99)
    tail_losses = sorted_losses[cutoff_idx:]
    es_99 = sum(tail_losses) / len(tail_losses) if tail_losses else 0

    # Maximum credible loss (99.9th percentile of non-zero)
    max_credible = percentile(sorted(non_zero), 99.9) if non_zero else 0

    # Probability metrics
    prob_zero = sum(1 for l in losses if l == 0) / n
    prob_gt_10k = sum(1 for l in losses if l > 10000) / n
    prob_gt_100k = sum(1 for l in losses if l > 100000) / n
    prob_gt_1m = sum(1 for l in losses if l > 1000000) / n

    # Probability above threshold
    prob_above_threshold = sum(1 for l in losses if l > threshold) / n if threshold > 0 else 0

    # Loss at various probability levels
    def loss_at_probability(p: float) -> float:
        """Loss value at given exceedance probability."""
        idx = int(n * (1 - p))
        return sorted_losses[min(idx, n - 1)]

    metrics = {
        'mean_annual_loss': round(mean_loss, 2),
        'standard_deviation': round(std_dev, 2),
        'var_95': round(var_95, 2),
        'var_99': round(var_99, 2),
        'var_999': round(var_999, 2),
        'expected_shortfall_99': round(es_99, 2),
        'max_credible_loss': round(max_credible, 2),
        'probability_zero_loss': round(prob_zero, 4),
        'probability_gt_10k': round(prob_gt_10k, 4),
        'probability_gt_100k': round(prob_gt_100k, 4),
        'probability_gt_1m': round(prob_gt_1m, 4),
        'probability_above_threshold': round(prob_above_threshold, 4),
        'loss_at_p_50': round(loss_at_probability(0.5), 2),
        'loss_at_p_25': round(loss_at_probability(0.25), 2),
        'loss_at_p_10': round(loss_at_probability(0.1), 2),
        'loss_at_p_5': round(loss_at_probability(0.05), 2),
        'loss_at_p_1': round(loss_at_probability(0.01), 2),
        'event_count': len(non_zero),
        'total_iterations': n,
    }

    return metrics


def format_currency(amount: float, currency: str = "USD") -> str:
    """Format a number as currency."""
    symbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
    }
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


# Additional utility functions for tests

def calculate_var(losses: List[float], percentile: float = 0.95) -> float:
    """Calculate Value at Risk at given percentile."""
    if not losses:
        return 0.0
    sorted_losses = sorted(losses)
    idx = int(len(sorted_losses) * percentile)
    return sorted_losses[min(idx, len(sorted_losses) - 1)]


def calculate_mean_annual_loss(losses: List[float]) -> float:
    """Calculate mean annual loss."""
    if not losses:
        return 0.0
    return sum(losses) / len(losses)


def calculate_loss_exceedance_curve(losses: List[float]) -> List[Tuple[float, float]]:
    """
    Calculate Loss Exceedance Curve as list of (loss, probability) tuples.

    Returns list sorted by loss ascending, probability descending.
    """
    if not losses:
        return []

    sorted_losses = sorted(losses)
    n = len(sorted_losses)

    # Create curve points
    curve = []
    for i, loss in enumerate(sorted_losses):
        exceedance_prob = 1 - (i / n)
        curve.append((loss, exceedance_prob))

    return curve


def calculate_percentile(data: List[float], percentile: float) -> float:
    """Calculate percentile of data (percentile as 0-1 value)."""
    if not data:
        return 0.0

    sorted_data = sorted(data)
    n = len(sorted_data)
    idx = percentile * (n - 1)
    lower = int(idx)
    upper = min(lower + 1, n - 1)
    weight = idx - lower

    return sorted_data[lower] * (1 - weight) + sorted_data[upper] * weight


def calculate_median(data: List[float]) -> float:
    """Calculate median of data."""
    if not data:
        return 0.0

    sorted_data = sorted(data)
    n = len(sorted_data)

    if n % 2 == 0:
        return (sorted_data[n // 2 - 1] + sorted_data[n // 2]) / 2
    else:
        return sorted_data[n // 2]


def calculate_std(data: List[float]) -> float:
    """Calculate standard deviation of data."""
    if not data or len(data) < 2:
        return 0.0

    mean = sum(data) / len(data)
    variance = sum((x - mean) ** 2 for x in data) / len(data)
    return math.sqrt(variance)


def simulate_portfolio(
    scenarios: List[Dict[str, Any]],
    num_iterations: int = 50000
) -> Dict[str, Any]:
    """
    Run portfolio simulation combining multiple scenarios.

    Each scenario should have:
    - probability: Annual probability
    - lower_bound: Lower impact bound
    - upper_bound: Upper impact bound

    Returns aggregated portfolio metrics.
    """
    if not scenarios:
        return {
            'total_losses': [],
            'mean_annual_loss': 0,
            'var_95': 0,
            'loss_exceedance_curve': [],
        }

    portfolio_losses = [0.0] * num_iterations

    for scenario in scenarios:
        prob = scenario.get('probability', 0)
        lb = scenario.get('lower_bound', 0)
        ub = scenario.get('upper_bound', 0)

        if prob <= 0 or lb <= 0 or ub <= 0:
            continue

        scenario_losses = simulate_scenario_annual_loss(
            probability=prob,
            lower_bound=lb,
            upper_bound=ub,
            num_iterations=num_iterations
        )

        # Add to portfolio (assuming independence)
        for i in range(num_iterations):
            portfolio_losses[i] += scenario_losses[i]

    lec = create_loss_exceedance_curve(portfolio_losses)
    metrics = calculate_risk_metrics(portfolio_losses)

    return {
        'total_losses': portfolio_losses,
        'mean_annual_loss': metrics.get('mean_annual_loss', 0),
        'var_95': metrics.get('var_95', 0),
        'loss_exceedance_curve': lec,
        'metrics': metrics,
        'scenario_count': len(scenarios),
    }


def calculate_combined_simulation(
    current_scenarios: List[Dict[str, Any]],
    residual_scenarios: List[Dict[str, Any]],
    num_iterations: int = 50000
) -> Dict[str, Any]:
    """
    Run combined simulation for current and residual states.

    Returns metrics for both states and the delta.
    """
    current_result = simulate_portfolio(current_scenarios, num_iterations)
    residual_result = simulate_portfolio(residual_scenarios, num_iterations)

    current_mal = current_result.get('mean_annual_loss', 0)
    residual_mal = residual_result.get('mean_annual_loss', 0)

    risk_reduction = current_mal - residual_mal

    return {
        'current': current_result,
        'residual': residual_result,
        'risk_reduction': risk_reduction,
        'delta': {
            'mean_annual_loss': round(current_mal - residual_mal, 2),
            'reduction_percent': round(
                (current_mal - residual_mal) / current_mal * 100, 2
            ) if current_mal > 0 else 0,
        }
    }
