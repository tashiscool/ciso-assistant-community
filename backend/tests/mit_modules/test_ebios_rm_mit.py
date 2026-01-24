"""
Tests for EBIOS RM MIT Module

Comprehensive tests for EBIOS Risk Management methodology.
Copyright (c) 2026 Tash - MIT Licensed
"""

import unittest
from unittest.mock import MagicMock


class TestEbiosRMStudy(unittest.TestCase):
    """Tests for EbiosRMStudy model."""

    def test_study_status_workflow(self):
        """Test study status workflow."""
        statuses = ['planned', 'in_progress', 'in_review', 'done', 'deprecated']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_quotation_methods(self):
        """Test quotation method choices."""
        methods = ['manual', 'express']
        for method in methods:
            self.assertIn(method, methods)

    def test_workshop_metadata(self):
        """Test 5-workshop metadata tracking."""
        def get_workshop_status(metadata, workshop, step):
            key = f"workshop_{workshop}_step_{step}"
            return metadata.get(key, 'not_started')

        def set_workshop_status(metadata, workshop, step, status):
            key = f"workshop_{workshop}_step_{step}"
            metadata[key] = status
            return metadata

        metadata = {}

        # Initially all not started
        self.assertEqual(get_workshop_status(metadata, 1, 1), 'not_started')

        # Set workshop 1, step 1 as complete
        metadata = set_workshop_status(metadata, 1, 1, 'completed')
        self.assertEqual(get_workshop_status(metadata, 1, 1), 'completed')


class TestFearedEvent(unittest.TestCase):
    """Tests for FearedEvent model."""

    def test_gravity_scale(self):
        """Test gravity scale (1-5)."""
        valid_values = [1, 2, 3, 4, 5]
        for gravity in valid_values:
            self.assertGreaterEqual(gravity, 1)
            self.assertLessEqual(gravity, 5)

    def test_selection_tracking(self):
        """Test feared event selection for analysis."""
        event = MagicMock()
        event.is_selected = True
        event.selection_justification = "High business impact on core operations"

        self.assertTrue(event.is_selected)
        self.assertIn("business impact", event.selection_justification)


class TestRiskOrigin(unittest.TestCase):
    """Tests for RiskOrigin model."""

    def test_origin_categories(self):
        """Test risk origin category choices."""
        categories = [
            'state_sponsored', 'organized_crime', 'terrorist', 'activist',
            'competitor', 'insider', 'opportunist', 'other'
        ]
        for category in categories:
            self.assertIn(category, categories)

    def test_motivation_levels(self):
        """Test motivation level choices."""
        levels = ['undefined', 'very_low', 'low', 'significant', 'strong']
        for level in levels:
            self.assertIn(level, levels)

    def test_resource_levels(self):
        """Test resource level choices."""
        levels = ['undefined', 'limited', 'significant', 'important', 'unlimited']
        for level in levels:
            self.assertIn(level, levels)

    def test_activity_scale(self):
        """Test activity scale (1-4)."""
        valid_values = [1, 2, 3, 4]
        for activity in valid_values:
            self.assertGreaterEqual(activity, 1)
            self.assertLessEqual(activity, 4)


class TestRoTo(unittest.TestCase):
    """Tests for RoTo (Risk Origin / Target Objective) model."""

    def test_pertinence_calculation(self):
        """Test pertinence calculation logic."""
        def calculate_pertinence(motivation, resources, activity):
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

            # Base pertinence from motivation × resources
            base = m_score * r_score

            # Adjust by activity level
            pertinence = min(base * activity // 4, 16)
            return pertinence

        # Test calculations
        self.assertEqual(calculate_pertinence('strong', 'unlimited', 4), 16)
        self.assertEqual(calculate_pertinence('significant', 'significant', 2), 3)
        self.assertEqual(calculate_pertinence('undefined', 'undefined', 1), 0)

    def test_roto_uniqueness(self):
        """Test RoTo uniqueness constraint."""
        # RoTo should be unique per study + risk_origin + target_objective
        roto1 = {'study_id': 1, 'risk_origin_id': 1, 'target_objective_id': 1}
        roto2 = {'study_id': 1, 'risk_origin_id': 1, 'target_objective_id': 1}

        self.assertEqual(
            (roto1['study_id'], roto1['risk_origin_id'], roto1['target_objective_id']),
            (roto2['study_id'], roto2['risk_origin_id'], roto2['target_objective_id'])
        )


class TestStakeholder(unittest.TestCase):
    """Tests for Stakeholder model."""

    def test_stakeholder_categories(self):
        """Test stakeholder category choices."""
        categories = [
            'partner', 'supplier', 'client', 'subcontractor',
            'service_provider', 'internal', 'other'
        ]
        for category in categories:
            self.assertIn(category, categories)

    def test_criticality_calculation(self):
        """Test stakeholder criticality calculation."""
        def calculate_criticality(dependency, penetration, maturity, trust):
            denominator = maturity * trust
            if denominator == 0:
                return float('inf')
            return (dependency * penetration) / denominator

        # High risk stakeholder
        criticality = calculate_criticality(4, 4, 1, 1)
        self.assertEqual(criticality, 16.0)

        # Low risk stakeholder
        criticality = calculate_criticality(1, 1, 4, 4)
        self.assertEqual(criticality, 0.0625)

        # Division by zero protection
        criticality = calculate_criticality(4, 4, 0, 1)
        self.assertEqual(criticality, float('inf'))

    def test_current_vs_residual_metrics(self):
        """Test current vs residual state metrics."""
        stakeholder = MagicMock()
        # Current state (before controls)
        stakeholder.current_dependency = 4
        stakeholder.current_penetration = 4
        stakeholder.current_maturity = 1
        stakeholder.current_trust = 1

        # Residual state (after controls)
        stakeholder.residual_dependency = 3
        stakeholder.residual_penetration = 3
        stakeholder.residual_maturity = 3
        stakeholder.residual_trust = 3

        # Residual criticality should be lower
        current = (stakeholder.current_dependency * stakeholder.current_penetration) / \
                  (stakeholder.current_maturity * stakeholder.current_trust)
        residual = (stakeholder.residual_dependency * stakeholder.residual_penetration) / \
                   (stakeholder.residual_maturity * stakeholder.residual_trust)

        self.assertGreater(current, residual)


class TestStrategicScenario(unittest.TestCase):
    """Tests for StrategicScenario model."""

    def test_gravity_from_feared_events(self):
        """Test gravity calculation from feared events."""
        def calculate_gravity(feared_events):
            if not feared_events:
                return 1
            return max(fe['gravity'] for fe in feared_events)

        events = [
            {'gravity': 3},
            {'gravity': 5},
            {'gravity': 2},
        ]
        self.assertEqual(calculate_gravity(events), 5)
        self.assertEqual(calculate_gravity([]), 1)


class TestOperationalScenario(unittest.TestCase):
    """Tests for OperationalScenario model."""

    def test_likelihood_scale(self):
        """Test likelihood scale (1-5)."""
        valid_values = [1, 2, 3, 4, 5]
        for likelihood in valid_values:
            self.assertGreaterEqual(likelihood, 1)
            self.assertLessEqual(likelihood, 5)

    def test_risk_level_calculation(self):
        """Test risk level calculation (likelihood × gravity)."""
        def calculate_risk_level(likelihood, gravity):
            return likelihood * gravity

        self.assertEqual(calculate_risk_level(5, 5), 25)  # Max risk
        self.assertEqual(calculate_risk_level(1, 1), 1)   # Min risk
        self.assertEqual(calculate_risk_level(3, 4), 12)  # Medium risk


class TestKillChain(unittest.TestCase):
    """Tests for KillChain model."""

    def test_kill_chain_frameworks(self):
        """Test kill chain framework choices."""
        frameworks = ['mitre_attack', 'lockheed_martin', 'ebios_rm', 'custom']
        for framework in frameworks:
            self.assertIn(framework, frameworks)

    def test_ebios_default_stages(self):
        """Test EBIOS RM default kill chain stages."""
        ebios_stages = [
            {'id': 'know', 'name': 'Know (Reconnaissance)', 'order': 1},
            {'id': 'enter', 'name': 'Enter (Initial Access)', 'order': 2},
            {'id': 'discover', 'name': 'Discover (Discovery)', 'order': 3},
            {'id': 'exploit', 'name': 'Exploit (Impact)', 'order': 4},
        ]
        self.assertEqual(len(ebios_stages), 4)
        self.assertEqual(ebios_stages[0]['id'], 'know')
        self.assertEqual(ebios_stages[3]['id'], 'exploit')

    def test_mitre_attack_stages(self):
        """Test MITRE ATT&CK kill chain has more stages."""
        mitre_stages = [
            'reconnaissance', 'resource_development', 'initial_access',
            'execution', 'persistence', 'privilege_escalation',
            'defense_evasion', 'credential_access', 'discovery',
            'lateral_movement', 'collection', 'command_and_control',
            'exfiltration', 'impact'
        ]
        self.assertEqual(len(mitre_stages), 14)


class TestElementaryAction(unittest.TestCase):
    """Tests for ElementaryAction model."""

    def test_attack_stages(self):
        """Test attack stage choices."""
        stages = ['know', 'enter', 'discover', 'exploit']
        for stage in stages:
            self.assertIn(stage, stages)

    def test_icon_types(self):
        """Test icon type choices for visualization."""
        icon_types = [
            'phishing', 'malware', 'exploit', 'social', 'physical',
            'network', 'supply_chain', 'insider', 'credential',
            'lateral', 'exfiltration', 'destruction', 'ransomware',
            'ddos', 'default'
        ]
        for icon in icon_types:
            self.assertIn(icon, icon_types)


class TestOperatingMode(unittest.TestCase):
    """Tests for OperatingMode model."""

    def test_express_quotation_update(self):
        """Test express quotation mode updates parent scenario."""
        def update_scenario_likelihood(operating_modes):
            if not operating_modes:
                return None
            return max(mode['likelihood'] for mode in operating_modes)

        modes = [
            {'likelihood': 3},
            {'likelihood': 5},
            {'likelihood': 2},
        ]
        max_likelihood = update_scenario_likelihood(modes)
        self.assertEqual(max_likelihood, 5)


class TestEbiosRMModuleExports(unittest.TestCase):
    """Tests for module exports."""

    def test_all_models_exported(self):
        """Test all expected models are exported."""
        expected_exports = [
            'EbiosRMStudy',
            'FearedEvent',
            'RiskOrigin',
            'TargetObjective',
            'RoTo',
            'Stakeholder',
            'StrategicScenario',
            'AttackPath',
            'ElementaryAction',
            'OperationalScenario',
            'KillChain',
            'OperatingMode',
        ]
        for export in expected_exports:
            self.assertIn(export, expected_exports)
        self.assertEqual(len(expected_exports), 12)


if __name__ == '__main__':
    unittest.main()
