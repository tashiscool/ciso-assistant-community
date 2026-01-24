#!/usr/bin/env python3
"""
Standalone tests for MIT-licensed modules.

Tests pure Python utilities without Django dependencies.
Run with: python test_mit_standalone.py
"""

import sys
import math
import random
import json
import io
import zipfile
import hashlib
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Any, Tuple
from collections import defaultdict


# ============================================================================
# CRQ Utils Implementation (copied to avoid Django imports)
# ============================================================================

def mu_sigma_from_lognormal_90pct(lower_bound: float, upper_bound: float) -> Tuple[float, float]:
    """Calculate lognormal μ and σ from 90% confidence interval bounds."""
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


def sample_lognormal(mu: float, sigma: float) -> float:
    """Sample from a lognormal distribution."""
    u1 = random.random()
    u2 = random.random()
    z = math.sqrt(-2 * math.log(max(u1, 1e-10))) * math.cos(2 * math.pi * u2)
    return math.exp(mu + sigma * z)


def simulate_scenario_annual_loss(probability: float, lower_bound: float,
                                   upper_bound: float, num_iterations: int = 50000) -> List[float]:
    """Run Monte Carlo simulation for a single scenario."""
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


def calculate_loss_exceedance_curve(losses: List[float]) -> List[Tuple[float, float]]:
    """Calculate Loss Exceedance Curve."""
    if not losses:
        return []
    sorted_losses = sorted(losses)
    n = len(sorted_losses)
    curve = []
    for i, loss in enumerate(sorted_losses):
        exceedance_prob = 1 - (i / n)
        curve.append((loss, exceedance_prob))
    return curve


def format_currency(amount: float, currency: str = "USD") -> str:
    """Format a number as currency."""
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


def simulate_portfolio(scenarios: List[Dict[str, Any]], num_iterations: int = 50000) -> Dict[str, Any]:
    """Run portfolio simulation combining multiple scenarios."""
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

        for i in range(num_iterations):
            portfolio_losses[i] += scenario_losses[i]

    lec = calculate_loss_exceedance_curve(portfolio_losses)
    mal = calculate_mean_annual_loss(portfolio_losses)
    var95 = calculate_var(portfolio_losses, 0.95)

    return {
        'total_losses': portfolio_losses,
        'mean_annual_loss': mal,
        'var_95': var95,
        'loss_exceedance_curve': lec,
    }


def calculate_combined_simulation(
    current_scenarios: List[Dict[str, Any]],
    residual_scenarios: List[Dict[str, Any]],
    num_iterations: int = 50000
) -> Dict[str, Any]:
    """Run combined simulation for current and residual states."""
    current_result = simulate_portfolio(current_scenarios, num_iterations)
    residual_result = simulate_portfolio(residual_scenarios, num_iterations)

    current_mal = current_result.get('mean_annual_loss', 0)
    residual_mal = residual_result.get('mean_annual_loss', 0)

    risk_reduction = current_mal - residual_mal

    return {
        'current': current_result,
        'residual': residual_result,
        'risk_reduction': risk_reduction,
    }


# ============================================================================
# Library Utils Implementation
# ============================================================================

def validate_library(content: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate library content structure."""
    errors = []
    required = ['name', 'ref_id', 'version']
    for field in required:
        if field not in content:
            errors.append(f"Missing required field: {field}")

    ref_id = content.get('ref_id', '')
    if ref_id and not ref_id.replace('-', '').replace('_', '').isalnum():
        errors.append("ref_id must be alphanumeric with hyphens/underscores only")

    version = content.get('version', '')
    if version:
        parts = version.split('.')
        if not all(p.isdigit() for p in parts if p):
            errors.append("version must be in semver format (e.g., 1.0.0)")

    object_keys = ['frameworks', 'controls', 'threats', 'risk_matrices', 'reference_controls']
    for key in object_keys:
        if key in content:
            if not isinstance(content[key], list):
                errors.append(f"{key} must be an array")
            else:
                for i, item in enumerate(content[key]):
                    if not isinstance(item, dict):
                        errors.append(f"{key}[{i}] must be an object")
                    elif 'ref_id' not in item:
                        errors.append(f"{key}[{i}] missing ref_id")

    return len(errors) == 0, errors


def compute_content_hash(content: Dict[str, Any]) -> str:
    """Compute SHA-256 hash of library content."""
    content_str = json.dumps(content, sort_keys=True)
    return hashlib.sha256(content_str.encode()).hexdigest()


def validate_file_extension(filename: str) -> bool:
    """Validate library file extension."""
    valid_extensions = ['.json', '.yaml', '.yml']
    return any(filename.lower().endswith(ext) for ext in valid_extensions)


def detect_library_object_types(content: Dict[str, Any]) -> List[str]:
    """Detect what types of objects are in the library."""
    detected = []
    type_keys = {
        'frameworks': 'Framework',
        'controls': 'Control',
        'threats': 'Threat',
        'risk_matrices': 'RiskMatrix',
        'reference_controls': 'ReferenceControl',
        'requirements': 'Requirement',
    }
    for key, obj_type in type_keys.items():
        if key in content and isinstance(content[key], list) and len(content[key]) > 0:
            detected.append(obj_type)
    return detected


# ============================================================================
# DORA Export Utils
# ============================================================================

def format_date_for_csv(date_obj) -> str:
    """Format a date for CSV output (YYYY-MM-DD)."""
    if date_obj is None:
        return ""
    if hasattr(date_obj, 'strftime'):
        return date_obj.strftime('%Y-%m-%d')
    return str(date_obj)


def format_bool_for_csv(value) -> str:
    """Format a boolean for CSV output (Y/N)."""
    if value is None:
        return ""
    return "Y" if value else "N"


def escape_csv_value(value: str) -> str:
    """Escape special characters in CSV values."""
    if value is None:
        return ""
    if ',' in value or '"' in value or '\n' in value:
        return '"' + value.replace('"', '""') + '"'
    return value


def validate_lei(lei: str) -> bool:
    """Validate LEI (Legal Entity Identifier) format."""
    if not lei:
        return False
    if len(lei) != 20:
        return False
    return lei.isalnum()


VALID_COUNTRY_CODES = {
    'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
    'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
    'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'GB', 'US', 'CH',
    'NO', 'IS', 'LI',
}


def validate_country_code(code: str) -> bool:
    """Validate ISO 3166-1 alpha-2 country code."""
    if not code:
        return False
    return code.upper() in VALID_COUNTRY_CODES


def validate_currency_code(code: str) -> bool:
    """Validate ISO 4217 currency code."""
    valid_currencies = {'EUR', 'USD', 'GBP', 'CHF', 'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'ISK'}
    if not code:
        return False
    return code.upper() in valid_currencies


# ============================================================================
# EBIOS RM Helpers
# ============================================================================

CATEGORY_COLORS = {
    'client': '#4CAF50',
    'supplier': '#2196F3',
    'partner': '#FF9800',
    'internal': '#9C27B0',
    'other': '#607D8B',
}


def get_risk_color(risk_level: int) -> str:
    """Get color for a risk level (1-16 scale)."""
    if risk_level <= 3:
        return 'green'
    elif risk_level <= 6:
        return 'yellow'
    elif risk_level <= 12:
        return 'orange'
    else:
        return 'red'


def get_category_color(category: str) -> str:
    """Get color for a stakeholder category."""
    return CATEGORY_COLORS.get(category, '#607D8B')


def format_stakeholder_for_chart(stakeholder: Dict[str, Any]) -> Dict[str, Any]:
    """Format a stakeholder dict for chart display."""
    return {
        'id': stakeholder.get('id'),
        'label': stakeholder.get('name'),
        'size': stakeholder.get('criticality', 1),
        'color': get_category_color(stakeholder.get('category', 'other')),
    }


def generate_radar_chart_data(stakeholders: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate radar chart data from stakeholder list."""
    if not stakeholders:
        return {'labels': [], 'datasets': []}

    labels = ['Exposure', 'Reliability', 'Criticality']
    datasets = []

    for stakeholder in stakeholders:
        datasets.append({
            'label': stakeholder.get('name', 'Unknown'),
            'data': [
                stakeholder.get('exposure', 0),
                stakeholder.get('reliability', 0),
                stakeholder.get('criticality', 0),
            ],
            'backgroundColor': f"rgba(59, 130, 246, 0.3)",
            'borderColor': 'rgba(59, 130, 246, 1)',
        })

    return {'labels': labels, 'datasets': datasets}


def generate_circular_chart_data(stakeholders: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate circular ecosystem chart data."""
    if not stakeholders:
        return {'nodes': [], 'links': []}

    nodes = []
    links = []

    n = len(stakeholders)
    for i, s in enumerate(stakeholders):
        angle = (2 * math.pi * i) / n
        x = math.cos(angle)
        y = math.sin(angle)

        nodes.append({
            'id': s.get('id'),
            'name': s.get('name'),
            'category': s.get('category'),
            'criticality': s.get('criticality', 1),
            'x': x,
            'y': y,
        })

        depends_on = s.get('depends_on', [])
        for dep_id in depends_on:
            links.append({
                'source': s.get('id'),
                'target': dep_id,
            })

    return {'nodes': nodes, 'links': links}


def generate_visual_analysis_data(
    scenarios: List[Dict[str, Any]],
    feared_events: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generate visual analysis data for scenarios and feared events."""
    risk_matrix_cells = defaultdict(int)
    treatment_counts = defaultdict(int)

    for scenario in scenarios:
        likelihood = scenario.get('likelihood', 0)
        gravity = scenario.get('gravity', 0)
        treatment = scenario.get('treatment', 'untreated')

        risk_matrix_cells[(likelihood, gravity)] += 1
        treatment_counts[treatment] += 1

    cells = [
        {'likelihood': k[0], 'gravity': k[1], 'count': v}
        for k, v in risk_matrix_cells.items()
    ]

    fe_summary = [
        {'name': fe.get('name'), 'gravity': fe.get('gravity', 0)}
        for fe in feared_events
    ]

    return {
        'risk_matrix': {'cells': cells},
        'treatment_stats': {
            'total': len(scenarios),
            **treatment_counts,
        },
        'feared_events_summary': fe_summary,
    }


def calculate_roto_pertinence(motivation: str, resources: str, activity: int) -> int:
    """Calculate RoTo pertinence score."""
    motivation_scores = {
        'undefined': 0, 'very_low': 1, 'low': 2,
        'significant': 3, 'strong': 4
    }
    resource_scores = {
        'undefined': 0, 'limited': 1, 'significant': 2,
        'important': 3, 'unlimited': 4
    }

    m_score = motivation_scores.get(motivation, 0)
    r_score = resource_scores.get(resources, 0)
    base = m_score * r_score
    return min(base * activity // 4, 16)


def calculate_stakeholder_criticality(dependency: int, penetration: int, maturity: int, trust: int) -> float:
    """Calculate stakeholder criticality."""
    denominator = maturity * trust
    if denominator == 0:
        return float('inf')
    return (dependency * penetration) / denominator


# ============================================================================
# Kill Chain Helpers
# ============================================================================

def get_ebios_kill_chain() -> Dict[str, Any]:
    """Get the default EBIOS RM kill chain."""
    return {
        'name': 'EBIOS RM Kill Chain',
        'framework': 'ebios_rm',
        'stages': [
            {'id': 'know', 'name': 'Know (Reconnaissance)', 'order': 1},
            {'id': 'enter', 'name': 'Enter (Initial Access)', 'order': 2},
            {'id': 'discover', 'name': 'Discover (Discovery)', 'order': 3},
            {'id': 'exploit', 'name': 'Exploit (Impact)', 'order': 4},
        ]
    }


def get_mitre_attack_kill_chain() -> Dict[str, Any]:
    """Get the default MITRE ATT&CK kill chain."""
    return {
        'name': 'MITRE ATT&CK',
        'framework': 'mitre_attack',
        'stages': [
            {'id': 'reconnaissance', 'name': 'Reconnaissance', 'order': 1},
            {'id': 'resource_development', 'name': 'Resource Development', 'order': 2},
            {'id': 'initial_access', 'name': 'Initial Access', 'order': 3},
            {'id': 'execution', 'name': 'Execution', 'order': 4},
            {'id': 'persistence', 'name': 'Persistence', 'order': 5},
            {'id': 'privilege_escalation', 'name': 'Privilege Escalation', 'order': 6},
            {'id': 'defense_evasion', 'name': 'Defense Evasion', 'order': 7},
            {'id': 'credential_access', 'name': 'Credential Access', 'order': 8},
            {'id': 'discovery', 'name': 'Discovery', 'order': 9},
            {'id': 'lateral_movement', 'name': 'Lateral Movement', 'order': 10},
            {'id': 'collection', 'name': 'Collection', 'order': 11},
            {'id': 'command_and_control', 'name': 'Command and Control', 'order': 12},
            {'id': 'exfiltration', 'name': 'Exfiltration', 'order': 13},
            {'id': 'impact', 'name': 'Impact', 'order': 14},
        ]
    }


# ============================================================================
# Serdes Utils
# ============================================================================

def topological_sort(dependencies: Dict[str, List[str]]) -> List[str]:
    """Topological sort for dependency resolution."""
    in_degree = defaultdict(int)
    graph = defaultdict(list)
    all_nodes = set(dependencies.keys())

    for node, deps in dependencies.items():
        for dep in deps:
            graph[dep].append(node)
            in_degree[node] += 1
            all_nodes.add(dep)

    queue = [node for node in all_nodes if in_degree[node] == 0]
    result = []

    while queue:
        node = queue.pop(0)
        result.append(node)
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(all_nodes):
        raise ValueError("Circular dependency detected")

    return result


def validate_backup_manifest(manifest: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate a backup manifest."""
    errors = []
    required_fields = ['version', 'created_at', 'objects']

    for field in required_fields:
        if field not in manifest:
            errors.append(f"Missing required field: {field}")

    if 'objects' in manifest and not isinstance(manifest['objects'], dict):
        errors.append("'objects' must be a dictionary")

    return len(errors) == 0, errors


def generate_id_mapping(old_ids: List[str]) -> Dict[str, str]:
    """Generate new UUIDs for old IDs."""
    import uuid
    return {old_id: str(uuid.uuid4()) for old_id in old_ids}


# ============================================================================
# Test Runner
# ============================================================================

class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def test(self, name: str, condition: bool, message: str = ""):
        if condition:
            self.passed += 1
            print(f"  ✓ {name}")
        else:
            self.failed += 1
            self.errors.append(f"{name}: {message}")
            print(f"  ✗ {name}: {message}")

    def report(self):
        print(f"\n{'='*60}")
        print(f"Results: {self.passed} passed, {self.failed} failed")
        if self.errors:
            print("\nFailures:")
            for e in self.errors:
                print(f"  - {e}")
        return self.failed == 0


def run_tests():
    runner = TestRunner()
    random.seed(42)  # For reproducibility

    print("\n" + "="*60)
    print("CRQ UTILITIES TESTS")
    print("="*60)

    # Test mu_sigma calculation
    print("\nLognormal Distribution:")
    mu, sigma = mu_sigma_from_lognormal_90pct(10000, 100000)
    runner.test("mu_sigma_basic", mu > 0 and sigma > 0, f"mu={mu}, sigma={sigma}")

    mu, sigma = mu_sigma_from_lognormal_90pct(50000, 50000)
    runner.test("mu_sigma_equal_bounds", sigma >= 0, f"sigma={sigma}")

    try:
        mu_sigma_from_lognormal_90pct(-100, 100)
        runner.test("mu_sigma_negative_bounds", False, "Should raise ValueError")
    except ValueError:
        runner.test("mu_sigma_negative_bounds", True)

    try:
        mu_sigma_from_lognormal_90pct(100, 50)
        runner.test("mu_sigma_inverted_bounds", False, "Should raise ValueError")
    except ValueError:
        runner.test("mu_sigma_inverted_bounds", True)

    # Test sampling
    samples = [sample_lognormal(10, 1) for _ in range(100)]
    runner.test("sample_all_positive", all(s > 0 for s in samples))

    # Test simulation
    print("\nMonte Carlo Simulation:")
    losses = simulate_scenario_annual_loss(0.10, 10000, 100000, num_iterations=1000)
    runner.test("simulation_length", len(losses) == 1000)
    zero_count = sum(1 for l in losses if l == 0)
    runner.test("simulation_probability", 800 < zero_count < 950, f"zeros={zero_count}")

    losses_zero_prob = simulate_scenario_annual_loss(0.0, 10000, 100000, num_iterations=100)
    runner.test("simulation_zero_probability", all(l == 0 for l in losses_zero_prob))

    losses_certain = simulate_scenario_annual_loss(1.0, 10000, 100000, num_iterations=100)
    runner.test("simulation_certainty", all(l > 0 for l in losses_certain))

    losses_invalid = simulate_scenario_annual_loss(0.5, -100, 100, num_iterations=100)
    runner.test("simulation_invalid_bounds", all(l == 0 for l in losses_invalid))

    # Test statistics
    print("\nStatistical Calculations:")
    test_losses = [0, 0, 0, 0, 0, 10000, 20000, 30000, 40000, 50000]
    var_95 = calculate_var(test_losses, 0.95)
    runner.test("var_95", var_95 >= 40000, f"VaR={var_95}")

    var_empty = calculate_var([])
    runner.test("var_empty", var_empty == 0.0)

    mal = calculate_mean_annual_loss(test_losses)
    runner.test("mean_annual_loss", mal == 15000, f"MAL={mal}")

    mal_empty = calculate_mean_annual_loss([])
    runner.test("mal_empty", mal_empty == 0.0)

    median_odd = calculate_median([1, 2, 3, 4, 5])
    runner.test("median_odd", median_odd == 3)

    median_even = calculate_median([1, 2, 3, 4, 5, 6])
    runner.test("median_even", median_even == 3.5)

    median_empty = calculate_median([])
    runner.test("median_empty", median_empty == 0.0)

    std = calculate_std([2, 4, 4, 4, 5, 5, 7, 9])
    runner.test("std_deviation", abs(std - 2.0) < 0.1, f"std={std}")

    std_empty = calculate_std([])
    runner.test("std_empty", std_empty == 0.0)

    p50 = calculate_percentile(list(range(101)), 0.50)
    runner.test("percentile_50", abs(p50 - 50) < 1, f"p50={p50}")

    p95 = calculate_percentile(list(range(101)), 0.95)
    runner.test("percentile_95", abs(p95 - 95) < 1, f"p95={p95}")

    # Test Loss Exceedance Curve
    print("\nLoss Exceedance Curve:")
    lec = calculate_loss_exceedance_curve([0, 10000, 20000, 30000])
    runner.test("lec_length", len(lec) == 4)
    runner.test("lec_structure", all(len(p) == 2 for p in lec))

    lec_empty = calculate_loss_exceedance_curve([])
    runner.test("lec_empty", lec_empty == [])

    # Test currency formatting
    print("\nCurrency Formatting:")
    runner.test("currency_usd", '$' in format_currency(1234567.89, 'USD'))
    runner.test("currency_eur", '€' in format_currency(1000000, 'EUR'))
    runner.test("currency_gbp", '£' in format_currency(500, 'GBP'))
    runner.test("currency_jpy", '¥' in format_currency(100000, 'JPY'))
    runner.test("currency_negative", '-' in format_currency(-50000, 'USD'))
    runner.test("currency_zero", '$0' in format_currency(0, 'USD'))
    runner.test("currency_billion", 'B' in format_currency(5_000_000_000, 'USD'))
    runner.test("currency_million", 'M' in format_currency(5_000_000, 'USD'))
    runner.test("currency_thousand", 'K' in format_currency(5_000, 'USD'))

    # Test portfolio simulation
    print("\nPortfolio Simulation:")
    scenarios = [
        {'probability': 0.10, 'lower_bound': 10000, 'upper_bound': 50000},
        {'probability': 0.05, 'lower_bound': 50000, 'upper_bound': 200000},
    ]
    portfolio = simulate_portfolio(scenarios, num_iterations=1000)
    runner.test("portfolio_has_losses", 'total_losses' in portfolio)
    runner.test("portfolio_has_mal", 'mean_annual_loss' in portfolio)
    runner.test("portfolio_has_var", 'var_95' in portfolio)

    empty_portfolio = simulate_portfolio([], num_iterations=100)
    runner.test("empty_portfolio_mal", empty_portfolio['mean_annual_loss'] == 0)

    # Test combined simulation
    print("\nCombined Simulation:")
    current = [{'probability': 0.20, 'lower_bound': 50000, 'upper_bound': 200000}]
    residual = [{'probability': 0.05, 'lower_bound': 20000, 'upper_bound': 80000}]
    combined = calculate_combined_simulation(current, residual, num_iterations=1000)
    runner.test("combined_has_current", 'current' in combined)
    runner.test("combined_has_residual", 'residual' in combined)
    runner.test("combined_has_reduction", 'risk_reduction' in combined)

    print("\n" + "="*60)
    print("LIBRARY UTILITIES TESTS")
    print("="*60)

    # Test library validation
    print("\nLibrary Validation:")
    valid_lib = {'name': 'Test', 'ref_id': 'test-lib', 'version': '1.0.0'}
    is_valid, errors = validate_library(valid_lib)
    runner.test("validate_valid_library", is_valid and len(errors) == 0)

    missing_name = {'ref_id': 'test', 'version': '1.0'}
    is_valid, errors = validate_library(missing_name)
    runner.test("validate_missing_name", not is_valid)

    invalid_ref_id = {'name': 'Test', 'ref_id': 'test lib!', 'version': '1.0'}
    is_valid, errors = validate_library(invalid_ref_id)
    runner.test("validate_invalid_ref_id", not is_valid)

    lib_with_objects = {
        'name': 'Test', 'ref_id': 'test', 'version': '1.0',
        'frameworks': [{'ref_id': 'fw-1', 'name': 'Framework 1'}]
    }
    is_valid, errors = validate_library(lib_with_objects)
    runner.test("validate_with_objects", is_valid)

    lib_invalid_objects = {
        'name': 'Test', 'ref_id': 'test', 'version': '1.0',
        'frameworks': [{'name': 'No ref_id'}]
    }
    is_valid, errors = validate_library(lib_invalid_objects)
    runner.test("validate_invalid_objects", not is_valid)

    # Test content hash
    print("\nContent Hash:")
    hash1 = compute_content_hash({'name': 'Test'})
    hash2 = compute_content_hash({'name': 'Test'})
    hash3 = compute_content_hash({'name': 'Different'})
    runner.test("hash_deterministic", hash1 == hash2)
    runner.test("hash_different", hash1 != hash3)
    runner.test("hash_length", len(hash1) == 64)

    # Test file extension
    print("\nFile Extension Validation:")
    runner.test("extension_json", validate_file_extension('lib.json'))
    runner.test("extension_yaml", validate_file_extension('lib.yaml'))
    runner.test("extension_yml", validate_file_extension('lib.yml'))
    runner.test("extension_invalid", not validate_file_extension('lib.txt'))
    runner.test("extension_case", validate_file_extension('lib.JSON'))

    # Test object type detection
    print("\nObject Type Detection:")
    lib_frameworks = {'frameworks': [{'ref_id': 'test'}]}
    types = detect_library_object_types(lib_frameworks)
    runner.test("detect_framework", 'Framework' in types)

    lib_controls = {'controls': [{'ref_id': 'test'}]}
    types = detect_library_object_types(lib_controls)
    runner.test("detect_control", 'Control' in types)

    lib_empty = {}
    types = detect_library_object_types(lib_empty)
    runner.test("detect_empty", len(types) == 0)

    print("\n" + "="*60)
    print("DORA EXPORT UTILITIES TESTS")
    print("="*60)

    # Test date formatting
    print("\nDate Formatting:")
    runner.test("date_format", format_date_for_csv(date(2024, 6, 15)) == "2024-06-15")
    runner.test("date_none", format_date_for_csv(None) == "")
    runner.test("datetime_format", format_date_for_csv(datetime(2024, 6, 15, 12, 30)) == "2024-06-15")

    # Test boolean formatting
    print("\nBoolean Formatting:")
    runner.test("bool_true", format_bool_for_csv(True) == "Y")
    runner.test("bool_false", format_bool_for_csv(False) == "N")
    runner.test("bool_none", format_bool_for_csv(None) == "")

    # Test CSV escaping
    print("\nCSV Escaping:")
    runner.test("csv_escape_comma", '"' in escape_csv_value("Hello, World"))
    runner.test("csv_escape_quote", '""' in escape_csv_value('Say "Hi"'))
    runner.test("csv_escape_newline", '"' in escape_csv_value("Line1\nLine2"))
    runner.test("csv_escape_plain", escape_csv_value("Hello") == "Hello")
    runner.test("csv_escape_none", escape_csv_value(None) == "")

    # Test LEI validation
    print("\nLEI Validation:")
    runner.test("lei_valid", validate_lei("529900T8BM49AURSDO55"))
    runner.test("lei_invalid_short", not validate_lei("INVALID"))
    runner.test("lei_empty", not validate_lei(""))
    runner.test("lei_too_long", not validate_lei("529900T8BM49AURSDO55X"))

    # Test country code validation
    print("\nCountry Code Validation:")
    runner.test("country_de", validate_country_code("DE"))
    runner.test("country_us", validate_country_code("US"))
    runner.test("country_fr", validate_country_code("FR"))
    runner.test("country_lowercase", validate_country_code("de"))
    runner.test("country_invalid", not validate_country_code("XX"))
    runner.test("country_empty", not validate_country_code(""))

    # Test currency code validation
    print("\nCurrency Code Validation:")
    runner.test("currency_eur", validate_currency_code("EUR"))
    runner.test("currency_usd", validate_currency_code("USD"))
    runner.test("currency_invalid", not validate_currency_code("XXX"))
    runner.test("currency_empty", not validate_currency_code(""))

    print("\n" + "="*60)
    print("EBIOS RM HELPERS TESTS")
    print("="*60)

    # Test risk colors
    print("\nRisk Colors:")
    runner.test("risk_low", get_risk_color(1) == 'green')
    runner.test("risk_low_boundary", get_risk_color(3) == 'green')
    runner.test("risk_medium", get_risk_color(4) == 'yellow')
    runner.test("risk_medium_boundary", get_risk_color(6) == 'yellow')
    runner.test("risk_high", get_risk_color(9) == 'orange')
    runner.test("risk_high_boundary", get_risk_color(12) == 'orange')
    runner.test("risk_critical", get_risk_color(16) == 'red')

    # Test category colors
    print("\nCategory Colors:")
    runner.test("category_client", get_category_color('client') == '#4CAF50')
    runner.test("category_supplier", get_category_color('supplier') == '#2196F3')
    runner.test("category_partner", get_category_color('partner') == '#FF9800')
    runner.test("category_internal", get_category_color('internal') == '#9C27B0')
    runner.test("category_unknown", get_category_color('unknown') == '#607D8B')

    # Test stakeholder formatting
    print("\nStakeholder Formatting:")
    stakeholder = {'id': '1', 'name': 'Test', 'criticality': 3, 'category': 'supplier'}
    formatted = format_stakeholder_for_chart(stakeholder)
    runner.test("stakeholder_label", formatted['label'] == 'Test')
    runner.test("stakeholder_size", formatted['size'] == 3)
    runner.test("stakeholder_color", formatted['color'] == '#2196F3')

    # Test radar chart
    print("\nRadar Chart Data:")
    stakeholders = [
        {'name': 'S1', 'exposure': 3, 'reliability': 2, 'criticality': 4},
        {'name': 'S2', 'exposure': 2, 'reliability': 3, 'criticality': 2},
    ]
    radar = generate_radar_chart_data(stakeholders)
    runner.test("radar_labels", len(radar['labels']) == 3)
    runner.test("radar_datasets", len(radar['datasets']) == 2)

    radar_empty = generate_radar_chart_data([])
    runner.test("radar_empty", len(radar_empty['datasets']) == 0)

    # Test circular chart
    print("\nCircular Chart Data:")
    stakeholders = [
        {'id': '1', 'name': 'S1', 'category': 'client', 'criticality': 2, 'depends_on': ['2']},
        {'id': '2', 'name': 'S2', 'category': 'supplier', 'criticality': 3, 'depends_on': []},
    ]
    circular = generate_circular_chart_data(stakeholders)
    runner.test("circular_nodes", len(circular['nodes']) == 2)
    runner.test("circular_links", len(circular['links']) == 1)

    circular_empty = generate_circular_chart_data([])
    runner.test("circular_empty", len(circular_empty['nodes']) == 0)

    # Test visual analysis
    print("\nVisual Analysis Data:")
    scenarios = [
        {'likelihood': 2, 'gravity': 3, 'treatment': 'mitigate'},
        {'likelihood': 3, 'gravity': 4, 'treatment': 'accept'},
    ]
    feared_events = [
        {'name': 'FE1', 'gravity': 3},
        {'name': 'FE2', 'gravity': 4},
    ]
    analysis = generate_visual_analysis_data(scenarios, feared_events)
    runner.test("analysis_risk_matrix", 'risk_matrix' in analysis)
    runner.test("analysis_treatment", 'treatment_stats' in analysis)
    runner.test("analysis_feared_events", len(analysis['feared_events_summary']) == 2)

    # Test RoTo pertinence
    print("\nRoTo Pertinence:")
    pertinence = calculate_roto_pertinence('strong', 'unlimited', 4)
    runner.test("pertinence_max", pertinence == 16)

    pertinence = calculate_roto_pertinence('undefined', 'undefined', 1)
    runner.test("pertinence_min", pertinence == 0)

    pertinence = calculate_roto_pertinence('significant', 'significant', 2)
    runner.test("pertinence_mid", 0 < pertinence < 16)

    # Test stakeholder criticality
    print("\nStakeholder Criticality:")
    criticality = calculate_stakeholder_criticality(4, 4, 2, 2)
    runner.test("criticality_high", criticality == 4.0)

    criticality = calculate_stakeholder_criticality(1, 1, 4, 4)
    runner.test("criticality_low", criticality == 0.0625)

    criticality = calculate_stakeholder_criticality(4, 4, 0, 0)
    runner.test("criticality_infinite", math.isinf(criticality))

    print("\n" + "="*60)
    print("KILL CHAIN TESTS")
    print("="*60)

    # Test EBIOS kill chain
    print("\nKill Chains:")
    ebios = get_ebios_kill_chain()
    runner.test("ebios_name", ebios['name'] == 'EBIOS RM Kill Chain')
    runner.test("ebios_stages", len(ebios['stages']) == 4)
    runner.test("ebios_first_stage", ebios['stages'][0]['id'] == 'know')

    mitre = get_mitre_attack_kill_chain()
    runner.test("mitre_name", mitre['name'] == 'MITRE ATT&CK')
    runner.test("mitre_stages", len(mitre['stages']) == 14)
    runner.test("mitre_first_stage", mitre['stages'][0]['id'] == 'reconnaissance')

    print("\n" + "="*60)
    print("SERDES UTILITIES TESTS")
    print("="*60)

    # Test topological sort
    print("\nTopological Sort:")
    deps = {'c': ['a', 'b'], 'b': ['a'], 'a': []}
    sorted_nodes = topological_sort(deps)
    runner.test("topo_order", sorted_nodes.index('a') < sorted_nodes.index('b') < sorted_nodes.index('c'))

    deps_empty = {}
    sorted_empty = topological_sort(deps_empty)
    runner.test("topo_empty", len(sorted_empty) == 0)

    try:
        deps_circular = {'a': ['b'], 'b': ['a']}
        topological_sort(deps_circular)
        runner.test("topo_circular", False, "Should raise ValueError")
    except ValueError:
        runner.test("topo_circular", True)

    # Test backup manifest validation
    print("\nBackup Manifest Validation:")
    valid_manifest = {
        'version': '1.0',
        'created_at': '2024-01-01T00:00:00Z',
        'objects': {'Asset': []}
    }
    is_valid, errors = validate_backup_manifest(valid_manifest)
    runner.test("manifest_valid", is_valid)

    invalid_manifest = {'version': '1.0'}
    is_valid, errors = validate_backup_manifest(invalid_manifest)
    runner.test("manifest_invalid", not is_valid)

    # Test ID mapping
    print("\nID Mapping:")
    old_ids = ['id1', 'id2', 'id3']
    mapping = generate_id_mapping(old_ids)
    runner.test("mapping_length", len(mapping) == 3)
    runner.test("mapping_unique", len(set(mapping.values())) == 3)
    runner.test("mapping_old_keys", all(old_id in mapping for old_id in old_ids))

    return runner.report()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
