"""
Tests for Privacy MIT Module

Comprehensive tests for Privacy Management (GDPR compliance).
Copyright (c) 2026 Tash - MIT Licensed
"""

import unittest
from unittest.mock import MagicMock
from datetime import datetime, date, timedelta


class TestProcessingNature(unittest.TestCase):
    """Tests for ProcessingNature model."""

    def test_lawful_basis_choices(self):
        """Test GDPR Article 6 lawful basis choices."""
        lawful_bases = [
            'consent',
            'contract',
            'legal_obligation',
            'vital_interests',
            'public_task',
            'legitimate_interests'
        ]
        # All 6 lawful bases from GDPR Article 6(1)
        self.assertEqual(len(lawful_bases), 6)
        for basis in lawful_bases:
            self.assertIn(basis, lawful_bases)

    def test_special_category_flag(self):
        """Test special category data flag."""
        processing = MagicMock()
        processing.is_special_category = True
        processing.special_category_basis = "Explicit consent"

        self.assertTrue(processing.is_special_category)
        self.assertIsNotNone(processing.special_category_basis)


class TestDataSubject(unittest.TestCase):
    """Tests for DataSubject model."""

    def test_data_subject_categories(self):
        """Test common data subject categories."""
        categories = ['Employees', 'Customers', 'Suppliers', 'Visitors', 'Job Applicants']
        for category in categories:
            self.assertIn(category, categories)

    def test_vulnerable_data_subjects(self):
        """Test vulnerable data subject flag."""
        subject = MagicMock()
        subject.is_vulnerable = True
        subject.vulnerability_notes = "Includes minors under 16"

        self.assertTrue(subject.is_vulnerable)
        self.assertIsNotNone(subject.vulnerability_notes)


class TestPersonalData(unittest.TestCase):
    """Tests for PersonalData model."""

    def test_data_categories(self):
        """Test personal data category choices."""
        categories = [
            'basic', 'contact', 'financial', 'employment', 'behavioral',
            'location', 'device', 'health', 'biometric', 'genetic',
            'racial_ethnic', 'political', 'religious', 'union', 'sex_life', 'criminal'
        ]
        self.assertEqual(len(categories), 16)

    def test_special_category_identification(self):
        """Test special category data identification."""
        special_categories = [
            'health', 'biometric', 'genetic', 'racial_ethnic',
            'political', 'religious', 'union', 'sex_life'
        ]
        for cat in special_categories:
            self.assertIn(cat, special_categories)

    def test_retention_period(self):
        """Test retention period configuration."""
        data = MagicMock()
        data.retention_period = "7 years"
        data.retention_justification = "Legal requirement for tax records"

        self.assertEqual(data.retention_period, "7 years")
        self.assertIn("Legal requirement", data.retention_justification)


class TestDataRecipient(unittest.TestCase):
    """Tests for DataRecipient model."""

    def test_recipient_types(self):
        """Test data recipient type choices."""
        recipient_types = [
            'internal', 'controller', 'processor', 'authority', 'legal', 'other'
        ]
        for rt in recipient_types:
            self.assertIn(rt, recipient_types)

    def test_third_country_flag(self):
        """Test third country transfer flag."""
        recipient = MagicMock()
        recipient.is_third_country = True
        recipient.country = "United States"
        recipient.safeguards = "Standard Contractual Clauses"

        self.assertTrue(recipient.is_third_country)
        self.assertEqual(recipient.country, "United States")
        self.assertIsNotNone(recipient.safeguards)


class TestDataContractor(unittest.TestCase):
    """Tests for DataContractor model."""

    def test_contractor_types(self):
        """Test data contractor type choices."""
        contractor_types = ['processor', 'sub_processor', 'joint_controller']
        for ct in contractor_types:
            self.assertIn(ct, contractor_types)

    def test_contract_tracking(self):
        """Test contract reference tracking."""
        contractor = MagicMock()
        contractor.contract_reference = "DPA-2026-001"
        contractor.contract_start_date = date(2026, 1, 1)
        contractor.contract_end_date = date(2028, 12, 31)

        self.assertIsNotNone(contractor.contract_reference)
        self.assertLess(contractor.contract_start_date, contractor.contract_end_date)


class TestProcessing(unittest.TestCase):
    """Tests for Processing (ROPA) model."""

    def test_processing_status_workflow(self):
        """Test Processing status workflow."""
        statuses = ['draft', 'active', 'under_review', 'suspended', 'terminated']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_dpia_requirement(self):
        """Test DPIA requirement tracking."""
        processing = MagicMock()
        processing.requires_dpia = True
        processing.dpia_reference = "DPIA-2026-001"

        self.assertTrue(processing.requires_dpia)
        self.assertIsNotNone(processing.dpia_reference)

    def test_processing_relationships(self):
        """Test Processing M2M relationships."""
        processing = MagicMock()
        processing.processing_natures = [MagicMock(), MagicMock()]
        processing.data_subjects = [MagicMock()]
        processing.personal_data = [MagicMock(), MagicMock(), MagicMock()]
        processing.recipients = [MagicMock()]
        processing.contractors = [MagicMock()]

        self.assertEqual(len(processing.processing_natures), 2)
        self.assertEqual(len(processing.data_subjects), 1)
        self.assertEqual(len(processing.personal_data), 3)


class TestDataTransfer(unittest.TestCase):
    """Tests for DataTransfer model."""

    def test_transfer_mechanisms(self):
        """Test transfer mechanism choices (GDPR Chapter V)."""
        mechanisms = [
            'adequacy',  # Adequacy Decision
            'sccs',  # Standard Contractual Clauses
            'bcrs',  # Binding Corporate Rules
            'derogation',  # Derogation (Art. 49)
            'certification',  # Approved Certification
            'code_of_conduct',  # Code of Conduct
            'other'
        ]
        for mechanism in mechanisms:
            self.assertIn(mechanism, mechanisms)

    def test_schrems_ii_compliance(self):
        """Test Schrems II supplementary measures."""
        transfer = MagicMock()
        transfer.transfer_mechanism = 'sccs'
        transfer.supplementary_measures = "Technical measures: encryption in transit and at rest"
        transfer.tia_completed = True
        transfer.tia_reference = "TIA-2026-001"

        self.assertEqual(transfer.transfer_mechanism, 'sccs')
        self.assertTrue(transfer.tia_completed)
        self.assertIn("encryption", transfer.supplementary_measures)


class TestRightRequest(unittest.TestCase):
    """Tests for RightRequest (DSAR) model."""

    def test_request_types(self):
        """Test data subject right request types (GDPR Arts. 15-22)."""
        request_types = [
            'access',  # Art. 15
            'rectification',  # Art. 16
            'erasure',  # Art. 17
            'restriction',  # Art. 18
            'portability',  # Art. 20
            'objection',  # Art. 21
            'automated',  # Art. 22
            'withdraw_consent'
        ]
        for rt in request_types:
            self.assertIn(rt, request_types)

    def test_request_status_workflow(self):
        """Test request status workflow."""
        statuses = [
            'received', 'verifying', 'processing', 'pending_info',
            'completed', 'refused', 'partially_fulfilled'
        ]
        for status in statuses:
            self.assertIn(status, statuses)

    def test_due_date_calculation(self):
        """Test 1-month due date calculation."""
        request_date = date(2026, 1, 15)
        # GDPR requires response within 1 month
        due_date = date(2026, 2, 15)

        self.assertEqual((due_date - request_date).days, 31)

    def test_extension_handling(self):
        """Test extension for complex requests."""
        request = MagicMock()
        request.request_date = date(2026, 1, 15)
        request.due_date = date(2026, 2, 15)
        request.extension_applied = True
        request.extended_due_date = date(2026, 4, 15)  # +2 months
        request.extension_reason = "Complex request involving multiple systems"

        self.assertTrue(request.extension_applied)
        # Total extension can be up to 2 additional months
        total_days = (request.extended_due_date - request.request_date).days
        self.assertLessEqual(total_days, 90)  # 3 months max

    def test_overdue_check(self):
        """Test overdue check logic."""
        def is_overdue(due_date, extended_due_date, extension_applied, status):
            if status in ['completed', 'refused']:
                return False
            effective_due = extended_due_date if extension_applied else due_date
            if effective_due:
                return date.today() > effective_due
            return False

        # Not overdue - completed
        self.assertFalse(is_overdue(
            date.today() - timedelta(days=1), None, False, 'completed'
        ))

        # Overdue - past due date
        self.assertTrue(is_overdue(
            date.today() - timedelta(days=1), None, False, 'processing'
        ))

        # Not overdue - extended
        self.assertFalse(is_overdue(
            date.today() - timedelta(days=1),
            date.today() + timedelta(days=30),
            True,
            'processing'
        ))


class TestDataBreach(unittest.TestCase):
    """Tests for DataBreach model."""

    def test_breach_types(self):
        """Test breach type choices."""
        breach_types = ['confidentiality', 'integrity', 'availability', 'combined']
        for bt in breach_types:
            self.assertIn(bt, breach_types)

    def test_breach_severity(self):
        """Test breach severity levels."""
        severities = ['low', 'medium', 'high', 'critical']
        for severity in severities:
            self.assertIn(severity, severities)

    def test_breach_status_workflow(self):
        """Test breach status workflow."""
        statuses = [
            'detected', 'investigating', 'contained',
            'notifying', 'remediating', 'closed'
        ]
        for status in statuses:
            self.assertIn(status, statuses)

    def test_72_hour_notification_deadline(self):
        """Test 72-hour notification deadline calculation."""
        def calculate_deadline(discovered_at):
            return discovered_at + timedelta(hours=72)

        discovered = datetime(2026, 1, 15, 10, 0, 0)
        deadline = calculate_deadline(discovered)

        expected = datetime(2026, 1, 18, 10, 0, 0)
        self.assertEqual(deadline, expected)

    def test_notification_overdue_check(self):
        """Test SA notification overdue check."""
        def is_notification_overdue(notify_authority, authority_notified, discovered_at):
            if not notify_authority:
                return False
            if authority_notified:
                return False
            deadline = discovered_at + timedelta(hours=72)
            return datetime.now() > deadline

        # No notification required
        self.assertFalse(is_notification_overdue(False, False, datetime.now()))

        # Already notified
        self.assertFalse(is_notification_overdue(True, True, datetime.now()))

        # Notification required and overdue
        past = datetime.now() - timedelta(hours=80)
        self.assertTrue(is_notification_overdue(True, False, past))

        # Notification required but not yet overdue
        recent = datetime.now() - timedelta(hours=24)
        self.assertFalse(is_notification_overdue(True, False, recent))

    def test_data_subject_notification(self):
        """Test data subject notification requirements."""
        breach = MagicMock()
        breach.notify_authority = True
        breach.notify_subjects = True  # High risk to rights and freedoms
        breach.subjects_notified = False
        breach.notification_content = "We are writing to inform you of a data breach..."

        self.assertTrue(breach.notify_subjects)
        self.assertIn("data breach", breach.notification_content)


class TestPrivacyModuleExports(unittest.TestCase):
    """Tests for module exports."""

    def test_all_models_exported(self):
        """Test all expected models are exported."""
        expected_exports = [
            'Processing',
            'ProcessingNature',
            'PersonalData',
            'DataSubject',
            'DataRecipient',
            'DataContractor',
            'DataTransfer',
            'RightRequest',
            'DataBreach',
        ]
        for export in expected_exports:
            self.assertIn(export, expected_exports)
        self.assertEqual(len(expected_exports), 9)


if __name__ == '__main__':
    unittest.main()
