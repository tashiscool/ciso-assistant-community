# MIT License - See LICENSE-MIT.txt in repository root
"""
Tests for core/helpers_mit.py (Core helpers)

Standalone tests that can run without Django using unittest.
"""

import unittest


class TestStatusMappings(unittest.TestCase):
    """Test status color and CSS mappings."""

    def test_status_color_map(self):
        """Test STATUS_COLOR_MAP contains expected statuses."""
        from core.helpers_mit import STATUS_COLOR_MAP
        self.assertIn("to_do", STATUS_COLOR_MAP)
        self.assertIn("done", STATUS_COLOR_MAP)
        self.assertIn("in_progress", STATUS_COLOR_MAP)
        self.assertEqual(STATUS_COLOR_MAP["done"], "#46D39A")

    def test_status_css_classes(self):
        """Test STATUS_CSS_CLASSES contains expected statuses."""
        from core.helpers_mit import STATUS_CSS_CLASSES
        self.assertIn("compliant", STATUS_CSS_CLASSES)
        self.assertIn("non_compliant", STATUS_CSS_CLASSES)
        self.assertEqual(STATUS_CSS_CLASSES["compliant"], "green-500")

    def test_get_status_color(self):
        """Test get_status_color function."""
        from core.helpers_mit import get_status_color
        self.assertEqual(get_status_color("done"), "#46D39A")
        self.assertEqual(get_status_color("unknown"), "#CCC")

    def test_get_status_css_class(self):
        """Test get_status_css_class function."""
        from core.helpers_mit import get_status_css_class
        self.assertEqual(get_status_css_class("compliant"), "green-500")
        self.assertEqual(get_status_css_class("unknown"), "gray-300")


class TestPriorityCalculations(unittest.TestCase):
    """Test priority calculation functions."""

    def test_calculate_priority_quadrant_1st(self):
        """Test 1st quadrant (low effort, high impact)."""
        from core.helpers_mit import calculate_priority_quadrant
        self.assertEqual(calculate_priority_quadrant("S", "high"), "1st")
        self.assertEqual(calculate_priority_quadrant("XS", "critical"), "1st")

    def test_calculate_priority_quadrant_2nd(self):
        """Test 2nd quadrant (high effort, high impact)."""
        from core.helpers_mit import calculate_priority_quadrant
        self.assertEqual(calculate_priority_quadrant("L", "high"), "2nd")
        self.assertEqual(calculate_priority_quadrant("XL", "critical"), "2nd")

    def test_calculate_priority_quadrant_3rd(self):
        """Test 3rd quadrant (low effort, low impact)."""
        from core.helpers_mit import calculate_priority_quadrant
        self.assertEqual(calculate_priority_quadrant("S", "low"), "3rd")
        self.assertEqual(calculate_priority_quadrant("XS", "medium"), "3rd")

    def test_calculate_priority_quadrant_4th(self):
        """Test 4th quadrant (high effort, low impact)."""
        from core.helpers_mit import calculate_priority_quadrant
        self.assertEqual(calculate_priority_quadrant("L", "low"), "4th")
        self.assertEqual(calculate_priority_quadrant("XL", "medium"), "4th")


class TestRiskCalculations(unittest.TestCase):
    """Test risk calculation functions."""

    def test_calculate_risk_level(self):
        """Test basic risk level calculation."""
        from core.helpers_mit import calculate_risk_level
        # Low prob, low impact
        self.assertEqual(calculate_risk_level(0, 0, 5), 0)
        # High prob, high impact
        self.assertEqual(calculate_risk_level(4, 4, 5), 24)

    def test_calculate_risk_level_invalid(self):
        """Test risk level with invalid inputs."""
        from core.helpers_mit import calculate_risk_level
        self.assertEqual(calculate_risk_level(-1, 0, 5), -1)
        self.assertEqual(calculate_risk_level(0, -1, 5), -1)

    def test_get_risk_level_from_matrix(self):
        """Test getting risk level from matrix."""
        from core.helpers_mit import get_risk_level_from_matrix
        matrix = [
            [0, 1, 2],
            [1, 2, 3],
            [2, 3, 4],
        ]
        self.assertEqual(get_risk_level_from_matrix(0, 0, matrix), 0)
        self.assertEqual(get_risk_level_from_matrix(2, 2, matrix), 4)
        self.assertEqual(get_risk_level_from_matrix(5, 0, matrix), -1)


class TestComplianceScoring(unittest.TestCase):
    """Test compliance scoring functions."""

    def test_calculate_compliance_score(self):
        """Test compliance score calculation."""
        from core.helpers_mit import calculate_compliance_score
        results = {
            "compliant": 8,
            "partially_compliant": 4,
            "non_compliant": 8,
        }
        # (8*1 + 4*0.5 + 8*0) / 20 = 10/20 = 50%
        score = calculate_compliance_score(results)
        self.assertEqual(score, 50.0)

    def test_calculate_compliance_score_all_compliant(self):
        """Test compliance score with all compliant."""
        from core.helpers_mit import calculate_compliance_score
        results = {"compliant": 10}
        self.assertEqual(calculate_compliance_score(results), 100.0)

    def test_calculate_compliance_score_empty(self):
        """Test compliance score with empty results."""
        from core.helpers_mit import calculate_compliance_score
        self.assertEqual(calculate_compliance_score({}), 0.0)


class TestProgressCalculation(unittest.TestCase):
    """Test progress calculation functions."""

    def test_calculate_progress(self):
        """Test progress calculation."""
        from core.helpers_mit import calculate_progress
        self.assertEqual(calculate_progress(5, 10), 50.0)
        self.assertEqual(calculate_progress(10, 10), 100.0)
        self.assertEqual(calculate_progress(0, 10), 0.0)

    def test_calculate_progress_zero_total(self):
        """Test progress with zero total."""
        from core.helpers_mit import calculate_progress
        self.assertEqual(calculate_progress(5, 0), 0.0)


class TestStatistics(unittest.TestCase):
    """Test statistics functions."""

    def test_calculate_statistics(self):
        """Test basic statistics calculation."""
        from core.helpers_mit import calculate_statistics
        values = [1, 2, 3, 4, 5]
        stats = calculate_statistics(values)
        self.assertEqual(stats["min"], 1)
        self.assertEqual(stats["max"], 5)
        self.assertEqual(stats["mean"], 3.0)
        self.assertEqual(stats["median"], 3.0)
        self.assertEqual(stats["count"], 5)

    def test_calculate_statistics_empty(self):
        """Test statistics with empty list."""
        from core.helpers_mit import calculate_statistics
        stats = calculate_statistics([])
        self.assertEqual(stats["count"], 0)
        self.assertEqual(stats["mean"], 0.0)


class TestTrendCalculation(unittest.TestCase):
    """Test trend calculation functions."""

    def test_calculate_trend_up(self):
        """Test upward trend."""
        from core.helpers_mit import calculate_trend
        trend = calculate_trend(120, 100)
        self.assertEqual(trend["direction"], "up")
        self.assertEqual(trend["change"], 20)
        self.assertEqual(trend["percentage"], 20.0)

    def test_calculate_trend_down(self):
        """Test downward trend."""
        from core.helpers_mit import calculate_trend
        trend = calculate_trend(80, 100)
        self.assertEqual(trend["direction"], "down")
        self.assertEqual(trend["change"], -20)
        self.assertEqual(trend["percentage"], -20.0)

    def test_calculate_trend_stable(self):
        """Test stable trend."""
        from core.helpers_mit import calculate_trend
        trend = calculate_trend(100, 100)
        self.assertEqual(trend["direction"], "stable")
        self.assertEqual(trend["change"], 0)


class TestAggregation(unittest.TestCase):
    """Test aggregation functions."""

    def test_aggregate_counts(self):
        """Test count aggregation."""
        from core.helpers_mit import aggregate_counts
        items = [
            {"status": "done"},
            {"status": "done"},
            {"status": "pending"},
        ]
        result = aggregate_counts(items, "status")
        self.assertEqual(result["done"], 2)
        self.assertEqual(result["pending"], 1)

    def test_group_by(self):
        """Test grouping by key."""
        from core.helpers_mit import group_by
        items = [
            {"type": "a", "value": 1},
            {"type": "b", "value": 2},
            {"type": "a", "value": 3},
        ]
        groups = group_by(items, "type")
        self.assertEqual(len(groups["a"]), 2)
        self.assertEqual(len(groups["b"]), 1)


class TestSorting(unittest.TestCase):
    """Test sorting functions."""

    def test_sort_by_priority(self):
        """Test sorting by priority."""
        from core.helpers_mit import sort_by_priority
        items = [
            {"name": "a", "priority": "low"},
            {"name": "b", "priority": "critical"},
            {"name": "c", "priority": "medium"},
        ]
        sorted_items = sort_by_priority(items)
        self.assertEqual(sorted_items[0]["name"], "b")  # critical first
        self.assertEqual(sorted_items[2]["name"], "a")  # low last


class TestNormalization(unittest.TestCase):
    """Test normalization functions."""

    def test_normalize_score(self):
        """Test score normalization."""
        from core.helpers_mit import normalize_score
        # Normalize 50 from 0-100 to 0-10
        self.assertEqual(normalize_score(50, 0, 100, 0, 10), 5.0)
        # Normalize 75 from 0-100 to 0-100
        self.assertEqual(normalize_score(75, 0, 100, 0, 100), 75.0)

    def test_normalize_score_same_range(self):
        """Test normalization with same min/max."""
        from core.helpers_mit import normalize_score
        self.assertEqual(normalize_score(50, 50, 50, 0, 100), 0)


class TestWeightedAverage(unittest.TestCase):
    """Test weighted average calculation."""

    def test_calculate_weighted_average(self):
        """Test weighted average."""
        from core.helpers_mit import calculate_weighted_average
        values = [(10, 1), (20, 2), (30, 1)]
        # (10*1 + 20*2 + 30*1) / (1+2+1) = 80/4 = 20
        self.assertEqual(calculate_weighted_average(values), 20.0)

    def test_calculate_weighted_average_empty(self):
        """Test weighted average with empty list."""
        from core.helpers_mit import calculate_weighted_average
        self.assertEqual(calculate_weighted_average([]), 0.0)


class TestPercentile(unittest.TestCase):
    """Test percentile calculation."""

    def test_percentile(self):
        """Test percentile calculation."""
        from core.helpers_mit import percentile
        values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        self.assertEqual(percentile(values, 50), 5.5)
        self.assertEqual(percentile(values, 0), 1)
        self.assertEqual(percentile(values, 100), 10)

    def test_percentile_empty(self):
        """Test percentile with empty list."""
        from core.helpers_mit import percentile
        self.assertEqual(percentile([], 50), 0.0)


class TestDistribution(unittest.TestCase):
    """Test distribution calculation."""

    def test_calculate_distribution(self):
        """Test distribution calculation."""
        from core.helpers_mit import calculate_distribution
        values = ["a", "b", "a", "c", "a"]
        dist = calculate_distribution(values)
        self.assertEqual(dist["a"], 3)
        self.assertEqual(dist["b"], 1)
        self.assertEqual(dist["c"], 1)

    def test_calculate_distribution_with_bins(self):
        """Test distribution with predefined bins."""
        from core.helpers_mit import calculate_distribution
        values = ["a", "a"]
        bins = ["a", "b", "c"]
        dist = calculate_distribution(values, bins)
        self.assertEqual(dist["a"], 2)
        self.assertEqual(dist["b"], 0)
        self.assertEqual(dist["c"], 0)


if __name__ == '__main__':
    unittest.main()
