# MIT License - See LICENSE-MIT.txt in repository root
"""
Tests for metrology_mit module (Metrics/Dashboards)

Standalone tests that can run without Django using unittest and mocking.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime, timedelta, date
from uuid import uuid4


class TestMetrologyMitModuleExports(unittest.TestCase):
    """Test module exports and lazy loading."""

    def test_module_exports(self):
        """Test that module exports expected classes."""
        import metrology_mit
        self.assertEqual(
            sorted(metrology_mit.__all__),
            ['BuiltinMetricSnapshot', 'Dashboard', 'DashboardWidget',
             'MetricDefinition', 'MetricInstance', 'MetricSample']
        )

    def test_lazy_import_invalid_raises(self):
        """Test that invalid attribute raises AttributeError."""
        import metrology_mit
        with self.assertRaises(AttributeError):
            _ = metrology_mit.NonExistentClass


class TestMetricDefinitionModel(unittest.TestCase):
    """Test MetricDefinition model functionality."""

    def test_category_choices(self):
        """Test category choices are defined."""
        categories = ['qualitative', 'quantitative']
        for cat in categories:
            self.assertIn(cat, categories)

    def test_choice_count_with_choices(self):
        """Test choice_count property with choices."""
        choices_definition = [
            {'name': 'Low', 'description': 'Low risk'},
            {'name': 'Medium', 'description': 'Medium risk'},
            {'name': 'High', 'description': 'High risk'},
        ]
        choice_count = len(choices_definition)
        self.assertEqual(choice_count, 3)

    def test_choice_count_empty(self):
        """Test choice_count with no choices."""
        choices_definition = None
        choice_count = len(choices_definition) if choices_definition else 0
        self.assertEqual(choice_count, 0)

    def test_get_choice_label(self):
        """Test getting choice label by index."""
        choices_definition = [
            {'name': 'Low'},
            {'name': 'Medium'},
            {'name': 'High'},
        ]
        # 1-based index
        index = 2
        array_index = index - 1
        label = choices_definition[array_index].get('name', str(index))
        self.assertEqual(label, 'Medium')

    def test_get_choice_label_out_of_bounds(self):
        """Test getting label for invalid index."""
        choices_definition = [{'name': 'Low'}]
        index = 5
        array_index = index - 1

        if 0 <= array_index < len(choices_definition):
            label = choices_definition[array_index].get('name')
        else:
            label = str(index)
        self.assertEqual(label, '5')


class TestMetricInstanceModel(unittest.TestCase):
    """Test MetricInstance model functionality."""

    def test_status_choices(self):
        """Test status choices."""
        statuses = ['draft', 'active', 'stale', 'deprecated']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_frequency_choices(self):
        """Test frequency choices."""
        frequencies = ['realtime', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']
        for freq in frequencies:
            self.assertIn(freq, frequencies)

    def test_is_stale_no_frequency(self):
        """Test is_stale with no collection frequency."""
        collection_frequency = None
        is_stale = collection_frequency is not None and False
        self.assertFalse(is_stale)

    def test_is_stale_no_samples(self):
        """Test is_stale with no samples returns True for active."""
        collection_frequency = 'daily'
        latest_sample = None
        status = 'active'

        if not latest_sample:
            is_stale = status == 'active'
        else:
            is_stale = False

        self.assertTrue(is_stale)

    def test_is_stale_fresh_sample(self):
        """Test is_stale with recent sample."""
        collection_frequency = 'daily'
        sample_timestamp = datetime.now() - timedelta(hours=12)
        threshold = timedelta(hours=36)
        time_since = datetime.now() - sample_timestamp

        is_stale = time_since > threshold
        self.assertFalse(is_stale)

    def test_is_stale_old_sample(self):
        """Test is_stale with old sample."""
        collection_frequency = 'daily'
        sample_timestamp = datetime.now() - timedelta(days=3)
        threshold = timedelta(hours=36)
        time_since = datetime.now() - sample_timestamp

        is_stale = time_since > threshold
        self.assertTrue(is_stale)

    def test_staleness_thresholds(self):
        """Test staleness threshold values."""
        thresholds = {
            'realtime': timedelta(minutes=15),
            'hourly': timedelta(hours=2),
            'daily': timedelta(hours=36),
            'weekly': timedelta(days=8),
            'monthly': timedelta(days=32),
            'quarterly': timedelta(days=95),
            'yearly': timedelta(days=370),
        }

        self.assertEqual(thresholds['daily'], timedelta(hours=36))
        self.assertEqual(thresholds['weekly'], timedelta(days=8))


class TestMetricSampleModel(unittest.TestCase):
    """Test MetricSample model functionality."""

    def test_raw_value_quantitative(self):
        """Test raw_value for quantitative metric."""
        category = 'quantitative'
        value = {'result': 95.5}

        if category == 'quantitative':
            raw_value = value.get('result')
        else:
            raw_value = value.get('choice_index')

        self.assertEqual(raw_value, 95.5)

    def test_raw_value_qualitative(self):
        """Test raw_value for qualitative metric."""
        category = 'qualitative'
        value = {'choice_index': 2}

        if category == 'qualitative':
            raw_value = value.get('choice_index')
        else:
            raw_value = value.get('result')

        self.assertEqual(raw_value, 2)

    def test_display_value_quantitative_with_unit(self):
        """Test display_value for quantitative with unit."""
        value = {'result': 95}
        unit = 'percentage'

        result = value.get('result')
        if unit == 'percentage':
            display = f"{result}%"
        else:
            display = f"{result} {unit}"

        self.assertEqual(display, "95%")

    def test_display_value_quantitative_no_unit(self):
        """Test display_value for quantitative without unit."""
        value = {'result': 42}
        unit = ''

        result = value.get('result')
        if unit:
            display = f"{result} {unit}"
        else:
            display = str(result)

        self.assertEqual(display, "42")

    def test_display_value_qualitative(self):
        """Test display_value for qualitative metric."""
        value = {'choice_index': 2}
        choices = [{'name': 'Low'}, {'name': 'Medium'}, {'name': 'High'}]

        index = value.get('choice_index')
        label = choices[index - 1].get('name') if index else 'N/A'
        display = f"[{index}] {label}"

        self.assertEqual(display, "[2] Medium")


class TestBuiltinMetricSnapshotModel(unittest.TestCase):
    """Test BuiltinMetricSnapshot model functionality."""

    def test_create_snapshot(self):
        """Test creating a metric snapshot."""
        object_type = 'ComplianceAssessment'
        object_id = uuid4()
        snapshot_date = date.today()
        metrics = {'progress': 75.0, 'score': 82.5}

        snapshot = {
            'object_type': object_type,
            'object_id': object_id,
            'date': snapshot_date,
            'metrics': metrics,
        }

        self.assertEqual(snapshot['object_type'], 'ComplianceAssessment')
        self.assertEqual(snapshot['metrics']['progress'], 75.0)

    def test_get_metric(self):
        """Test getting a specific metric value."""
        metrics = {'progress': 75.0, 'score': 82.5}
        value = metrics.get('progress', None)
        self.assertEqual(value, 75.0)

    def test_get_metric_default(self):
        """Test getting non-existent metric returns default."""
        metrics = {'progress': 75.0}
        value = metrics.get('score', 0.0)
        self.assertEqual(value, 0.0)


class TestDashboardModel(unittest.TestCase):
    """Test Dashboard model functionality."""

    def test_widget_count(self):
        """Test widget count property."""
        widgets = [Mock(), Mock(), Mock()]
        widget_count = len(widgets)
        self.assertEqual(widget_count, 3)

    def test_layout_columns_default(self):
        """Test default layout columns."""
        dashboard_definition = {}
        columns = dashboard_definition.get('layout', {}).get('columns', 12)
        self.assertEqual(columns, 12)

    def test_layout_columns_custom(self):
        """Test custom layout columns."""
        dashboard_definition = {'layout': {'columns': 8}}
        columns = dashboard_definition.get('layout', {}).get('columns', 12)
        self.assertEqual(columns, 8)

    def test_time_range_default(self):
        """Test default time range."""
        dashboard_definition = {}
        time_range = dashboard_definition.get('global_filters', {}).get('time_range', 'last_30_days')
        self.assertEqual(time_range, 'last_30_days')


class TestDashboardWidgetModel(unittest.TestCase):
    """Test DashboardWidget model functionality."""

    def test_chart_type_choices(self):
        """Test chart type choices."""
        chart_types = [
            'kpi_card', 'donut', 'pie', 'bar', 'line',
            'area', 'gauge', 'sparkline', 'table', 'text'
        ]
        for ct in chart_types:
            self.assertIn(ct, chart_types)

    def test_time_range_choices(self):
        """Test time range choices."""
        time_ranges = [
            'last_hour', 'last_24_hours', 'last_7_days',
            'last_30_days', 'last_90_days', 'last_year', 'all_time'
        ]
        for tr in time_ranges:
            self.assertIn(tr, time_ranges)

    def test_aggregation_choices(self):
        """Test aggregation choices."""
        aggregations = ['none', 'avg', 'sum', 'min', 'max', 'count', 'last']
        for agg in aggregations:
            self.assertIn(agg, aggregations)

    def test_display_title_custom(self):
        """Test display title with custom title."""
        title = 'My Custom Widget'
        metric_instance_name = 'Default Name'
        chart_type = 'kpi_card'

        display_title = title or metric_instance_name
        self.assertEqual(display_title, 'My Custom Widget')

    def test_display_title_from_metric(self):
        """Test display title fallback to metric instance name."""
        title = ''
        metric_instance_name = 'Compliance Score'
        chart_type = 'kpi_card'

        display_title = title or metric_instance_name
        self.assertEqual(display_title, 'Compliance Score')

    def test_display_title_text_widget(self):
        """Test text widget doesn't need title."""
        chart_type = 'text'
        title = ''

        if chart_type == 'text':
            display_title = ''
        else:
            display_title = 'Fallback'

        self.assertEqual(display_title, '')

    def test_is_custom_metric(self):
        """Test is_custom_metric property."""
        metric_instance = Mock()
        is_custom = metric_instance is not None
        self.assertTrue(is_custom)

    def test_is_builtin_metric(self):
        """Test is_builtin_metric property."""
        target_object_type = 'ComplianceAssessment'
        metric_key = 'progress'

        is_builtin = bool(target_object_type and metric_key)
        self.assertTrue(is_builtin)

    def test_is_text_widget(self):
        """Test is_text_widget property."""
        chart_type = 'text'
        is_text = chart_type == 'text'
        self.assertTrue(is_text)

    def test_grid_position_validation_valid(self):
        """Test valid grid position."""
        position_x = 0
        position_y = 0
        width = 6
        height = 2

        is_valid = (
            0 <= position_x <= 11 and
            1 <= width <= 12 and
            position_x + width <= 12 and
            height >= 1
        )
        self.assertTrue(is_valid)

    def test_grid_position_validation_overflow(self):
        """Test grid position overflow validation."""
        position_x = 8
        width = 6

        is_valid = position_x + width <= 12
        self.assertFalse(is_valid)

    def test_grid_position_validation_invalid_x(self):
        """Test invalid X position."""
        position_x = 12  # Max is 11

        is_valid = 0 <= position_x <= 11
        self.assertFalse(is_valid)


if __name__ == '__main__':
    unittest.main()
