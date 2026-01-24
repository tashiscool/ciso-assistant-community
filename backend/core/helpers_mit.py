# MIT License - See LICENSE-MIT.txt in repository root
"""
Core Helpers - Clean-room MIT implementation

Helper functions for GRC operations including:
- Status color mapping
- Priority calculations
- Scoring helpers
- Statistics utilities
"""

from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
from statistics import mean, median, stdev
import math


# Status to color mappings for UI display
STATUS_COLOR_MAP = {
    "undefined": "#CCC",
    "--": "#CCC",
    "to_do": "#BFDBFE",
    "active": "#46D39A",
    "deprecated": "#E55759",
    "in_progress": "#5470c6",
    "in_review": "#BBF7D0",
    "done": "#46D39A",
    "open": "#fac858",
    "mitigate": "#91cc75",
    "accept": "#73c0de",
    "avoid": "#ee6666",
    "on_hold": "#ee6666",
    "transfer": "#91cc75",
}

# Status to CSS class mappings
STATUS_CSS_CLASSES = {
    "not_assessed": "gray-300",
    "compliant": "green-500",
    "to_do": "gray-400",
    "in_progress": "blue-500",
    "done": "green-500",
    "non_compliant": "red-500",
    "partially_compliant": "yellow-400",
    "not_applicable": "black",
}

# Effort levels for prioritization
EFFORT_LEVELS = {
    "XS": 1,
    "S": 2,
    "M": 3,
    "L": 4,
    "XL": 5,
}

# Severity levels
SEVERITY_LEVELS = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def get_status_color(status: str) -> str:
    """
    Get the hex color for a status.

    Args:
        status: Status string

    Returns:
        Hex color code
    """
    return STATUS_COLOR_MAP.get(status, "#CCC")


def get_status_css_class(status: str) -> str:
    """
    Get the CSS class for a status.

    Args:
        status: Status string

    Returns:
        CSS class name
    """
    return STATUS_CSS_CLASSES.get(status, "gray-300")


def calculate_priority_quadrant(effort: str, impact: str) -> str:
    """
    Calculate priority quadrant based on effort and impact.

    Quadrants:
    - 1st: Low effort, high impact (do first)
    - 2nd: High effort, high impact (schedule)
    - 3rd: Low effort, low impact (delegate)
    - 4th: High effort, low impact (eliminate)

    Args:
        effort: Effort level (XS, S, M, L, XL)
        impact: Impact level (low, medium, high, critical)

    Returns:
        Quadrant string ("1st", "2nd", "3rd", "4th")
    """
    effort_val = EFFORT_LEVELS.get(effort, 3)
    impact_val = SEVERITY_LEVELS.get(impact.lower() if impact else "", 2)

    low_effort = effort_val <= 2
    high_impact = impact_val >= 3

    if low_effort and high_impact:
        return "1st"
    elif not low_effort and high_impact:
        return "2nd"
    elif low_effort and not high_impact:
        return "3rd"
    else:
        return "4th"


def calculate_risk_level(probability: int, impact: int, matrix_size: int = 5) -> int:
    """
    Calculate risk level from probability and impact.

    Args:
        probability: Probability score (0 to matrix_size-1)
        impact: Impact score (0 to matrix_size-1)
        matrix_size: Size of the risk matrix

    Returns:
        Risk level index
    """
    if probability < 0 or impact < 0:
        return -1
    max_val = matrix_size - 1
    probability = min(probability, max_val)
    impact = min(impact, max_val)
    return probability + impact * matrix_size


def get_risk_level_from_matrix(
    probability: int,
    impact: int,
    risk_matrix: List[List[int]]
) -> int:
    """
    Get risk level from a risk matrix.

    Args:
        probability: Probability index (row)
        impact: Impact index (column)
        risk_matrix: 2D matrix of risk levels

    Returns:
        Risk level from matrix or -1 if out of bounds
    """
    if probability < 0 or impact < 0:
        return -1
    if probability >= len(risk_matrix):
        return -1
    row = risk_matrix[probability]
    if impact >= len(row):
        return -1
    return row[impact]


def calculate_compliance_score(
    results: Dict[str, int],
    weights: Optional[Dict[str, float]] = None
) -> float:
    """
    Calculate compliance score from assessment results.

    Args:
        results: Dict of result status to count
        weights: Optional weights for each status

    Returns:
        Compliance score as percentage (0-100)
    """
    default_weights = {
        "compliant": 1.0,
        "partially_compliant": 0.5,
        "non_compliant": 0.0,
        "not_applicable": None,  # Excluded
        "not_assessed": None,  # Excluded
    }
    weights = weights or default_weights

    total_weight = 0.0
    weighted_sum = 0.0

    for status, count in results.items():
        weight = weights.get(status)
        if weight is not None and count > 0:
            total_weight += count
            weighted_sum += weight * count

    if total_weight == 0:
        return 0.0
    return round((weighted_sum / total_weight) * 100, 1)


def calculate_progress(completed: int, total: int) -> float:
    """
    Calculate progress percentage.

    Args:
        completed: Number of completed items
        total: Total number of items

    Returns:
        Progress as percentage (0-100)
    """
    if total == 0:
        return 0.0
    return round((completed / total) * 100, 1)


def aggregate_counts(items: List[dict], key: str) -> Dict[str, int]:
    """
    Aggregate items by a key and count occurrences.

    Args:
        items: List of dictionaries
        key: Key to aggregate by

    Returns:
        Dict of value to count
    """
    counts = defaultdict(int)
    for item in items:
        value = item.get(key)
        if value is not None:
            counts[str(value)] += 1
    return dict(counts)


def calculate_statistics(values: List[float]) -> Dict[str, float]:
    """
    Calculate basic statistics for a list of values.

    Args:
        values: List of numeric values

    Returns:
        Dict with min, max, mean, median, stdev
    """
    if not values:
        return {
            "min": 0.0,
            "max": 0.0,
            "mean": 0.0,
            "median": 0.0,
            "stdev": 0.0,
            "count": 0,
        }

    return {
        "min": min(values),
        "max": max(values),
        "mean": round(mean(values), 2),
        "median": round(median(values), 2),
        "stdev": round(stdev(values), 2) if len(values) > 1 else 0.0,
        "count": len(values),
    }


def calculate_trend(
    current: float,
    previous: float,
    as_percentage: bool = True
) -> Dict[str, Any]:
    """
    Calculate trend between two values.

    Args:
        current: Current value
        previous: Previous value
        as_percentage: Return change as percentage

    Returns:
        Dict with direction, change, and percentage
    """
    if previous == 0:
        if current == 0:
            return {"direction": "stable", "change": 0, "percentage": 0}
        return {"direction": "up", "change": current, "percentage": 100}

    change = current - previous
    percentage = round((change / abs(previous)) * 100, 1)

    if change > 0:
        direction = "up"
    elif change < 0:
        direction = "down"
    else:
        direction = "stable"

    return {
        "direction": direction,
        "change": round(change, 2),
        "percentage": percentage,
    }


def normalize_score(
    value: float,
    min_val: float,
    max_val: float,
    target_min: float = 0,
    target_max: float = 100
) -> float:
    """
    Normalize a score to a target range.

    Args:
        value: Value to normalize
        min_val: Minimum of source range
        max_val: Maximum of source range
        target_min: Minimum of target range
        target_max: Maximum of target range

    Returns:
        Normalized value
    """
    if max_val == min_val:
        return target_min
    normalized = (value - min_val) / (max_val - min_val)
    return target_min + normalized * (target_max - target_min)


def calculate_weighted_average(
    values: List[Tuple[float, float]]
) -> float:
    """
    Calculate weighted average.

    Args:
        values: List of (value, weight) tuples

    Returns:
        Weighted average
    """
    total_weight = sum(w for _, w in values)
    if total_weight == 0:
        return 0.0
    return sum(v * w for v, w in values) / total_weight


def group_by(items: List[dict], key: str) -> Dict[str, List[dict]]:
    """
    Group items by a key value.

    Args:
        items: List of dictionaries
        key: Key to group by

    Returns:
        Dict of key value to list of items
    """
    groups = defaultdict(list)
    for item in items:
        value = item.get(key)
        if value is not None:
            groups[str(value)].append(item)
    return dict(groups)


def sort_by_priority(
    items: List[dict],
    priority_key: str = "priority",
    reverse: bool = True
) -> List[dict]:
    """
    Sort items by priority.

    Args:
        items: List of dictionaries
        priority_key: Key containing priority value
        reverse: True for high-to-low

    Returns:
        Sorted list
    """
    priority_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}

    def get_priority(item):
        val = item.get(priority_key, "medium")
        if isinstance(val, str):
            return priority_order.get(val.lower(), 2)
        return val

    return sorted(items, key=get_priority, reverse=reverse)


def percentile(values: List[float], p: float) -> float:
    """
    Calculate the p-th percentile of values.

    Args:
        values: List of numeric values
        p: Percentile (0-100)

    Returns:
        Percentile value
    """
    if not values:
        return 0.0
    sorted_values = sorted(values)
    k = (len(sorted_values) - 1) * (p / 100)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_values[int(k)]
    return sorted_values[f] * (c - k) + sorted_values[c] * (k - f)


def calculate_distribution(
    values: List[Any],
    bins: Optional[List[str]] = None
) -> Dict[str, int]:
    """
    Calculate distribution of categorical values.

    Args:
        values: List of values
        bins: Optional list of expected categories

    Returns:
        Dict of category to count
    """
    distribution = defaultdict(int)
    for v in values:
        distribution[str(v)] += 1

    # Ensure all bins are present
    if bins:
        for b in bins:
            if b not in distribution:
                distribution[b] = 0

    return dict(distribution)
