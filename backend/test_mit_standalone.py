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


# ============================================================================
# CRQ Utils Implementation (copied to avoid Django imports)
# ============================================================================

def mu_sigma_from_lognormal_90pct(lower_bound: float, upper_bound: float) -> Tuple[float, float]:
    """Calculate lognormal μ and σ from 90% confidence interval bounds."""
    if lower_bound <= 0 or upper_bound <= 0:
        raise ValueError("Bounds must be positive")
    if lower_bound > upper_bound:
        # Handle equal bounds
        if lower_bound == upper_bound:
            return math.log(lower_bound), 0.001
        raise ValueError("Lower bound must be less than upper bound")

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


# ============================================================================
# EBIOS RM Helpers
# ============================================================================

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
    colors = {
        'client': '#4CAF50',
        'supplier': '#2196F3',
        'partner': '#FF9800',
        'internal': '#9C27B0',
        'other': '#607D8B',
    }
    return colors.get(category, '#607D8B')


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

    # Test statistics
    print("\nStatistical Calculations:")
    test_losses = [0, 0, 0, 0, 0, 10000, 20000, 30000, 40000, 50000]
    var_95 = calculate_var(test_losses, 0.95)
    runner.test("var_95", var_95 >= 40000, f"VaR={var_95}")

    mal = calculate_mean_annual_loss(test_losses)
    runner.test("mean_annual_loss", mal == 15000, f"MAL={mal}")

    median_odd = calculate_median([1, 2, 3, 4, 5])
    runner.test("median_odd", median_odd == 3)

    median_even = calculate_median([1, 2, 3, 4, 5, 6])
    runner.test("median_even", median_even == 3.5)

    std = calculate_std([2, 4, 4, 4, 5, 5, 7, 9])
    runner.test("std_deviation", abs(std - 2.0) < 0.1, f"std={std}")

    # Test currency formatting
    print("\nCurrency Formatting:")
    runner.test("currency_usd", '$' in format_currency(1234567.89, 'USD'))
    runner.test("currency_eur", '€' in format_currency(1000000, 'EUR'))
    runner.test("currency_negative", '-' in format_currency(-50000, 'USD'))
    runner.test("currency_zero", '$0' in format_currency(0, 'USD'))

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

    print("\n" + "="*60)
    print("DORA EXPORT UTILITIES TESTS")
    print("="*60)

    # Test date formatting
    print("\nDate Formatting:")
    runner.test("date_format", format_date_for_csv(date(2024, 6, 15)) == "2024-06-15")
    runner.test("date_none", format_date_for_csv(None) == "")

    # Test boolean formatting
    print("\nBoolean Formatting:")
    runner.test("bool_true", format_bool_for_csv(True) == "Y")
    runner.test("bool_false", format_bool_for_csv(False) == "N")
    runner.test("bool_none", format_bool_for_csv(None) == "")

    # Test LEI validation
    print("\nLEI Validation:")
    runner.test("lei_valid", validate_lei("529900T8BM49AURSDO55"))
    runner.test("lei_invalid_short", not validate_lei("INVALID"))
    runner.test("lei_empty", not validate_lei(""))

    # Test country code validation
    print("\nCountry Code Validation:")
    runner.test("country_de", validate_country_code("DE"))
    runner.test("country_us", validate_country_code("US"))
    runner.test("country_invalid", not validate_country_code("XX"))
    runner.test("country_empty", not validate_country_code(""))

    print("\n" + "="*60)
    print("EBIOS RM HELPERS TESTS")
    print("="*60)

    # Test risk colors
    print("\nRisk Colors:")
    runner.test("risk_low", get_risk_color(1) == 'green')
    runner.test("risk_medium", get_risk_color(4) == 'yellow')
    runner.test("risk_high", get_risk_color(9) == 'orange')
    runner.test("risk_critical", get_risk_color(16) == 'red')

    # Test category colors
    print("\nCategory Colors:")
    runner.test("category_client", get_category_color('client') == '#4CAF50')
    runner.test("category_supplier", get_category_color('supplier') == '#2196F3')
    runner.test("category_unknown", get_category_color('unknown') == '#607D8B')

    return runner.report()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
