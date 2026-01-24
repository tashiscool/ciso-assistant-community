"""
EBIOS RM MIT Helper Tests

Tests for chart generation and visual analysis helpers.
"""

import pytest
import math


class TestRadarChartGeneration:
    """Tests for radar chart data generation."""

    def test_generate_radar_data_empty(self):
        """Test radar generation with empty data."""
        from ebios_rm_mit.helpers import generate_radar_chart_data

        result = generate_radar_chart_data([])
        assert result['labels'] == []
        assert result['datasets'] == []

    def test_generate_radar_data_basic(self):
        """Test radar generation with basic data."""
        from ebios_rm_mit.helpers import generate_radar_chart_data

        stakeholders = [
            {'name': 'Supplier A', 'exposure': 3, 'reliability': 4, 'criticality': 2},
            {'name': 'Partner B', 'exposure': 2, 'reliability': 5, 'criticality': 3},
        ]

        result = generate_radar_chart_data(stakeholders)

        assert 'labels' in result
        assert 'datasets' in result
        assert len(result['datasets']) == 2

    def test_generate_radar_labels(self):
        """Test radar chart labels are correct."""
        from ebios_rm_mit.helpers import generate_radar_chart_data

        stakeholders = [{'name': 'Test', 'exposure': 1, 'reliability': 1, 'criticality': 1}]
        result = generate_radar_chart_data(stakeholders)

        expected_labels = ['Exposure', 'Reliability', 'Criticality']
        assert result['labels'] == expected_labels


class TestCircularChartGeneration:
    """Tests for circular ecosystem chart generation."""

    def test_circular_chart_empty(self):
        """Test circular chart with no data."""
        from ebios_rm_mit.helpers import generate_circular_chart_data

        result = generate_circular_chart_data([])
        assert result['nodes'] == []
        assert result['links'] == []

    def test_circular_chart_single_node(self):
        """Test circular chart with single node."""
        from ebios_rm_mit.helpers import generate_circular_chart_data

        stakeholders = [
            {'id': 'S1', 'name': 'Supplier', 'category': 'supplier', 'criticality': 3}
        ]

        result = generate_circular_chart_data(stakeholders)
        assert len(result['nodes']) == 1
        assert result['nodes'][0]['id'] == 'S1'

    def test_circular_chart_with_links(self):
        """Test circular chart with stakeholder relationships."""
        from ebios_rm_mit.helpers import generate_circular_chart_data

        stakeholders = [
            {'id': 'S1', 'name': 'Supplier', 'category': 'supplier', 'criticality': 3, 'depends_on': ['S2']},
            {'id': 'S2', 'name': 'Partner', 'category': 'partner', 'criticality': 2, 'depends_on': []},
        ]

        result = generate_circular_chart_data(stakeholders)
        assert len(result['nodes']) == 2
        assert len(result['links']) == 1
        assert result['links'][0]['source'] == 'S1'
        assert result['links'][0]['target'] == 'S2'

    def test_circular_chart_node_positions(self):
        """Test that node positions are calculated correctly."""
        from ebios_rm_mit.helpers import generate_circular_chart_data

        stakeholders = [
            {'id': 'S1', 'name': 'A', 'category': 'supplier', 'criticality': 1},
            {'id': 'S2', 'name': 'B', 'category': 'partner', 'criticality': 1},
            {'id': 'S3', 'name': 'C', 'category': 'client', 'criticality': 1},
        ]

        result = generate_circular_chart_data(stakeholders)

        # All nodes should have x and y coordinates
        for node in result['nodes']:
            assert 'x' in node
            assert 'y' in node
            # Check coordinates are within expected range
            assert -1.5 <= node['x'] <= 1.5
            assert -1.5 <= node['y'] <= 1.5


class TestVisualAnalysisGeneration:
    """Tests for visual analysis data generation."""

    def test_visual_analysis_empty(self):
        """Test visual analysis with no scenarios."""
        from ebios_rm_mit.helpers import generate_visual_analysis_data

        result = generate_visual_analysis_data([], [])
        assert 'risk_matrix' in result
        assert 'treatment_stats' in result

    def test_visual_analysis_with_scenarios(self):
        """Test visual analysis with operational scenarios."""
        from ebios_rm_mit.helpers import generate_visual_analysis_data

        scenarios = [
            {'likelihood': 3, 'gravity': 4, 'treatment': 'untreated'},
            {'likelihood': 2, 'gravity': 2, 'treatment': 'accepted'},
            {'likelihood': 4, 'gravity': 3, 'treatment': 'reduced'},
        ]

        result = generate_visual_analysis_data(scenarios, [])

        assert result['treatment_stats']['total'] == 3
        assert result['treatment_stats']['untreated'] == 1
        assert result['treatment_stats']['accepted'] == 1
        assert result['treatment_stats']['reduced'] == 1

    def test_visual_analysis_risk_matrix(self):
        """Test risk matrix generation."""
        from ebios_rm_mit.helpers import generate_visual_analysis_data

        scenarios = [
            {'likelihood': 3, 'gravity': 4, 'treatment': 'untreated'},
        ]

        result = generate_visual_analysis_data(scenarios, [])

        # Check matrix structure
        assert 'cells' in result['risk_matrix']
        # Find the cell with our scenario
        found = False
        for cell in result['risk_matrix']['cells']:
            if cell['likelihood'] == 3 and cell['gravity'] == 4:
                assert cell['count'] >= 1
                found = True
        assert found

    def test_visual_analysis_feared_events(self):
        """Test feared events summary."""
        from ebios_rm_mit.helpers import generate_visual_analysis_data

        feared_events = [
            {'name': 'Data Breach', 'gravity': 4},
            {'name': 'Service Outage', 'gravity': 3},
        ]

        result = generate_visual_analysis_data([], feared_events)

        assert 'feared_events_summary' in result
        assert len(result['feared_events_summary']) == 2


class TestReportDataGeneration:
    """Tests for EBIOS RM report data generation."""

    def test_generate_report_structure(self):
        """Test report data structure."""
        from ebios_rm_mit.helpers import generate_report_data

        study_data = {
            'name': 'Test Study',
            'version': '1.0',
            'status': 'completed',
            'description': 'Test description',
        }

        result = generate_report_data(study_data, [], [], [], [])

        assert 'study' in result
        assert 'workshops' in result
        assert result['study']['name'] == 'Test Study'

    def test_generate_report_workshops(self):
        """Test workshop sections in report."""
        from ebios_rm_mit.helpers import generate_report_data

        study_data = {'name': 'Test', 'status': 'completed'}
        feared_events = [{'name': 'FE1', 'gravity': 3}]
        risk_origins = [{'name': 'RO1', 'motivation': 'significant'}]

        result = generate_report_data(study_data, feared_events, risk_origins, [], [])

        assert 'workshop1' in result['workshops']
        assert 'workshop2' in result['workshops']
        assert len(result['workshops']['workshop1']['feared_events']) == 1
        assert len(result['workshops']['workshop2']['risk_origins']) == 1

    def test_generate_report_statistics(self):
        """Test statistics section in report."""
        from ebios_rm_mit.helpers import generate_report_data

        scenarios = [
            {'likelihood': 3, 'gravity': 4, 'treatment': 'untreated'},
            {'likelihood': 2, 'gravity': 2, 'treatment': 'reduced'},
        ]

        result = generate_report_data({'name': 'Test'}, [], [], [], scenarios)

        assert 'statistics' in result
        assert result['statistics']['total_scenarios'] == 2


class TestHelperUtilities:
    """Tests for helper utility functions."""

    def test_calculate_risk_color(self):
        """Test risk color calculation."""
        from ebios_rm_mit.helpers import get_risk_color

        assert get_risk_color(1) == 'green'
        assert get_risk_color(4) == 'yellow'
        assert get_risk_color(9) == 'orange'
        assert get_risk_color(16) == 'red'

    def test_get_category_color(self):
        """Test category color mapping."""
        from ebios_rm_mit.helpers import get_category_color

        assert get_category_color('client') == '#4CAF50'
        assert get_category_color('supplier') == '#2196F3'
        assert get_category_color('partner') == '#FF9800'
        assert get_category_color('internal') == '#9C27B0'
        assert get_category_color('unknown') == '#607D8B'

    def test_format_stakeholder_for_chart(self):
        """Test stakeholder formatting for charts."""
        from ebios_rm_mit.helpers import format_stakeholder_for_chart

        stakeholder = {
            'id': 'uuid-123',
            'name': 'ACME Corp',
            'category': 'supplier',
            'criticality': 3,
            'exposure': 4,
            'reliability': 2,
        }

        result = format_stakeholder_for_chart(stakeholder)

        assert result['id'] == 'uuid-123'
        assert result['label'] == 'ACME Corp'
        assert result['size'] == 3  # Based on criticality
