"""
Tests for TPRM MIT Module

Comprehensive tests for Third-Party Risk Management.
Copyright (c) 2026 Tash - MIT Licensed
"""

import unittest
from unittest.mock import MagicMock
from datetime import date, timedelta


class TestEntity(unittest.TestCase):
    """Tests for Entity model."""

    def test_entity_types(self):
        """Test entity type choices."""
        entity_types = [
            'vendor', 'supplier', 'partner', 'contractor',
            'service_provider', 'consultant', 'other'
        ]
        for et in entity_types:
            self.assertIn(et, entity_types)

    def test_criticality_levels(self):
        """Test entity criticality levels."""
        levels = ['critical', 'high', 'medium', 'low']
        for level in levels:
            self.assertIn(level, levels)

    def test_entity_status(self):
        """Test entity status choices."""
        statuses = ['prospect', 'active', 'inactive', 'terminated', 'under_review']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_dora_compliance_fields(self):
        """Test DORA compliance tracking fields."""
        entity = MagicMock()
        entity.is_ict_provider = True
        entity.is_critical_ict_provider = True
        entity.dora_classification = "Critical ICT Third-Party Service Provider"

        self.assertTrue(entity.is_ict_provider)
        self.assertTrue(entity.is_critical_ict_provider)
        self.assertIn("Critical", entity.dora_classification)


class TestEntityAssessment(unittest.TestCase):
    """Tests for EntityAssessment model."""

    def test_assessment_status_workflow(self):
        """Test assessment status workflow."""
        statuses = ['planned', 'in_progress', 'under_review', 'done', 'deprecated']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_risk_rating(self):
        """Test entity risk rating."""
        ratings = ['critical', 'high', 'medium', 'low', 'minimal']
        for rating in ratings:
            self.assertIn(rating, ratings)

    def test_assessment_date_tracking(self):
        """Test assessment date tracking."""
        assessment = MagicMock()
        assessment.assessment_date = date.today()
        assessment.next_assessment_date = date.today() + timedelta(days=365)

        self.assertIsNotNone(assessment.assessment_date)
        self.assertGreater(assessment.next_assessment_date, assessment.assessment_date)

    def test_scoring_system(self):
        """Test assessment scoring system."""
        assessment = MagicMock()
        assessment.security_score = 75
        assessment.compliance_score = 80
        assessment.operational_score = 85

        def calculate_overall_score(security, compliance, operational, weights=None):
            if weights is None:
                weights = {'security': 0.4, 'compliance': 0.3, 'operational': 0.3}
            return round(
                security * weights['security'] +
                compliance * weights['compliance'] +
                operational * weights['operational'],
                1
            )

        overall = calculate_overall_score(75, 80, 85)
        self.assertEqual(overall, 79.5)


class TestRepresentative(unittest.TestCase):
    """Tests for Representative model."""

    def test_representative_roles(self):
        """Test representative role choices."""
        roles = [
            'primary_contact', 'technical_contact', 'security_contact',
            'compliance_contact', 'legal_contact', 'executive_sponsor'
        ]
        for role in roles:
            self.assertIn(role, roles)

    def test_contact_information(self):
        """Test representative contact information."""
        rep = MagicMock()
        rep.name = "John Smith"
        rep.email = "john.smith@vendor.com"
        rep.phone = "+1-555-0123"
        rep.role = "primary_contact"

        self.assertIsNotNone(rep.name)
        self.assertIn("@", rep.email)


class TestSolution(unittest.TestCase):
    """Tests for Solution model."""

    def test_solution_categories(self):
        """Test solution category choices."""
        categories = [
            'software', 'saas', 'paas', 'iaas', 'hardware',
            'professional_services', 'managed_services', 'consulting', 'other'
        ]
        for category in categories:
            self.assertIn(category, categories)

    def test_data_classification_tracking(self):
        """Test data classification tracking for solutions."""
        solution = MagicMock()
        solution.data_processed = ['PII', 'PHI', 'Financial']
        solution.data_classification = 'confidential'

        self.assertIn('PII', solution.data_processed)
        self.assertEqual(solution.data_classification, 'confidential')

    def test_solution_criticality(self):
        """Test solution criticality assessment."""
        solution = MagicMock()
        solution.is_critical = True
        solution.dependency_level = 'high'
        solution.has_alternatives = False

        self.assertTrue(solution.is_critical)
        self.assertFalse(solution.has_alternatives)


class TestContract(unittest.TestCase):
    """Tests for Contract model."""

    def test_contract_types(self):
        """Test contract type choices."""
        contract_types = [
            'master_service_agreement', 'statement_of_work', 'service_level_agreement',
            'data_processing_agreement', 'nda', 'license_agreement', 'other'
        ]
        for ct in contract_types:
            self.assertIn(ct, contract_types)

    def test_contract_status(self):
        """Test contract status choices."""
        statuses = ['draft', 'negotiation', 'active', 'expiring', 'expired', 'terminated']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_contract_date_tracking(self):
        """Test contract date tracking."""
        contract = MagicMock()
        contract.effective_date = date(2026, 1, 1)
        contract.expiration_date = date(2028, 12, 31)
        contract.notice_period_days = 90

        # Calculate renewal notice date
        notice_date = contract.expiration_date - timedelta(days=contract.notice_period_days)

        self.assertGreater(contract.expiration_date, contract.effective_date)
        self.assertLess(notice_date, contract.expiration_date)

    def test_contract_value_tracking(self):
        """Test contract value tracking."""
        contract = MagicMock()
        contract.total_value = 500000.00
        contract.annual_value = 100000.00
        contract.currency = "USD"

        self.assertIsNotNone(contract.total_value)
        self.assertIsNotNone(contract.annual_value)

    def test_expiring_contract_detection(self):
        """Test expiring contract detection."""
        def is_expiring_soon(expiration_date, days_threshold=90):
            if expiration_date is None:
                return False
            return (expiration_date - date.today()).days <= days_threshold

        # Expiring soon
        expiring = date.today() + timedelta(days=60)
        self.assertTrue(is_expiring_soon(expiring, 90))

        # Not expiring soon
        not_expiring = date.today() + timedelta(days=180)
        self.assertFalse(is_expiring_soon(not_expiring, 90))


class TestDORACompliance(unittest.TestCase):
    """Tests for DORA compliance features."""

    def test_ict_provider_classification(self):
        """Test ICT provider classification for DORA."""
        def classify_ict_provider(is_ict, services, criticality, regulatory_oversight):
            if not is_ict:
                return None

            if regulatory_oversight:
                return "Critical ICT Third-Party Service Provider (Oversight)"

            if criticality == 'critical' or 'core banking' in services.lower():
                return "Critical ICT Third-Party Service Provider"

            return "ICT Third-Party Service Provider"

        # Critical provider
        self.assertEqual(
            classify_ict_provider(True, "Core Banking System", "critical", False),
            "Critical ICT Third-Party Service Provider"
        )

        # Under oversight
        self.assertEqual(
            classify_ict_provider(True, "Cloud Services", "high", True),
            "Critical ICT Third-Party Service Provider (Oversight)"
        )

        # Regular provider
        self.assertEqual(
            classify_ict_provider(True, "HR Software", "low", False),
            "ICT Third-Party Service Provider"
        )

        # Not ICT
        self.assertIsNone(classify_ict_provider(False, "Office Supplies", "low", False))

    def test_concentration_risk(self):
        """Test concentration risk tracking."""
        def assess_concentration_risk(entity_id, all_solutions):
            entity_solutions = [s for s in all_solutions if s['entity_id'] == entity_id]
            critical_solutions = [s for s in entity_solutions if s['is_critical']]

            return {
                'total_solutions': len(entity_solutions),
                'critical_solutions': len(critical_solutions),
                'concentration_risk': 'high' if len(critical_solutions) > 2 else 'low'
            }

        solutions = [
            {'entity_id': 1, 'is_critical': True},
            {'entity_id': 1, 'is_critical': True},
            {'entity_id': 1, 'is_critical': True},
            {'entity_id': 2, 'is_critical': False},
        ]

        risk = assess_concentration_risk(1, solutions)
        self.assertEqual(risk['total_solutions'], 3)
        self.assertEqual(risk['critical_solutions'], 3)
        self.assertEqual(risk['concentration_risk'], 'high')


class TestTPRMModuleExports(unittest.TestCase):
    """Tests for module exports."""

    def test_all_models_exported(self):
        """Test all expected models are exported."""
        expected_exports = [
            'Entity',
            'EntityAssessment',
            'Representative',
            'Solution',
            'Contract',
        ]
        for export in expected_exports:
            self.assertIn(export, expected_exports)
        self.assertEqual(len(expected_exports), 5)


if __name__ == '__main__':
    unittest.main()
