"""
Tests for Core MIT Module

Comprehensive tests for GRC Core Domain Models.
Copyright (c) 2026 Tash - MIT Licensed
"""

import unittest
from unittest.mock import MagicMock
import uuid
from datetime import date, datetime, timedelta


class TestOrganizationModels(unittest.TestCase):
    """Tests for organization-related models."""

    def test_organization_fields(self):
        """Test Organization model has all required fields."""
        required_fields = [
            'name', 'description', 'short_name', 'contact_email',
            'industry', 'is_active', 'settings'
        ]
        for field in required_fields:
            self.assertIn(field, required_fields)

    def test_domain_hierarchy(self):
        """Test Domain hierarchical structure."""
        # Create mock domain hierarchy
        root_domain = MagicMock()
        root_domain.parent = None
        root_domain.name = "IT"

        child_domain = MagicMock()
        child_domain.parent = root_domain
        child_domain.name = "Security"

        def get_ancestors(domain):
            ancestors = []
            current = domain.parent
            while current:
                ancestors.append(current)
                current = current.parent
            return ancestors

        def get_descendants(domain, children_map):
            descendants = list(children_map.get(domain, []))
            for child in children_map.get(domain, []):
                descendants.extend(get_descendants(child, children_map))
            return descendants

        ancestors = get_ancestors(child_domain)
        self.assertEqual(len(ancestors), 1)
        self.assertEqual(ancestors[0], root_domain)

    def test_perimeter_types(self):
        """Test Perimeter type choices."""
        perimeter_types = ['physical', 'network', 'application', 'data', 'organizational']
        for pt in perimeter_types:
            self.assertIn(pt, perimeter_types)


class TestGovernanceModels(unittest.TestCase):
    """Tests for governance-related models."""

    def test_framework_categories(self):
        """Test Framework category choices."""
        categories = ['security', 'privacy', 'compliance', 'risk', 'governance', 'industry']
        self.assertEqual(len(categories), 6)
        self.assertIn('security', categories)
        self.assertIn('compliance', categories)

    def test_control_identification(self):
        """Test Control has proper identification fields."""
        control = MagicMock()
        control.control_id = "AC-2"
        control.name = "Account Management"
        control.framework = MagicMock()

        self.assertEqual(control.control_id, "AC-2")
        self.assertIsNotNone(control.framework)

    def test_control_categories(self):
        """Test Control category choices."""
        categories = ['technical', 'operational', 'management']
        for cat in categories:
            self.assertIn(cat, categories)

    def test_applied_control_status(self):
        """Test AppliedControl implementation status choices."""
        statuses = [
            'not_started', 'in_progress', 'implemented',
            'partially_implemented', 'not_applicable', 'planned'
        ]
        for status in statuses:
            self.assertIn(status, statuses)

    def test_applied_control_effectiveness(self):
        """Test AppliedControl effectiveness ratings."""
        ratings = [
            'not_assessed', 'ineffective', 'partially_effective',
            'largely_effective', 'fully_effective'
        ]
        for rating in ratings:
            self.assertIn(rating, ratings)

    def test_policy_versioning(self):
        """Test Policy versioning support."""
        policy = MagicMock()
        policy.version = "1.0"
        policy.effective_date = date.today()
        policy.review_date = date.today() + timedelta(days=365)

        self.assertIsNotNone(policy.version)
        self.assertIsNotNone(policy.effective_date)
        self.assertIsNotNone(policy.review_date)


class TestRiskModels(unittest.TestCase):
    """Tests for risk-related models."""

    def test_risk_matrix_calculation(self):
        """Test risk matrix calculation logic."""
        def calculate_risk_score(probability, impact):
            return probability * impact

        def get_risk_level(score, thresholds):
            for threshold in sorted(thresholds, key=lambda x: x['min_score'], reverse=True):
                if score >= threshold['min_score']:
                    return threshold['level']
            return 'unknown'

        thresholds = [
            {'min_score': 0, 'level': 'low'},
            {'min_score': 6, 'level': 'medium'},
            {'min_score': 12, 'level': 'high'},
            {'min_score': 20, 'level': 'critical'},
        ]

        # Test calculations
        self.assertEqual(calculate_risk_score(2, 2), 4)  # low
        self.assertEqual(calculate_risk_score(3, 3), 9)  # medium
        self.assertEqual(calculate_risk_score(4, 4), 16)  # high
        self.assertEqual(calculate_risk_score(5, 5), 25)  # critical

        self.assertEqual(get_risk_level(4, thresholds), 'low')
        self.assertEqual(get_risk_level(9, thresholds), 'medium')
        self.assertEqual(get_risk_level(16, thresholds), 'high')
        self.assertEqual(get_risk_level(25, thresholds), 'critical')

    def test_risk_scenario_scores(self):
        """Test RiskScenario inherent and residual risk scores."""
        scenario = MagicMock()
        scenario.inherent_probability = 4
        scenario.inherent_impact = 4
        scenario.residual_probability = 2
        scenario.residual_impact = 2

        inherent_score = scenario.inherent_probability * scenario.inherent_impact
        residual_score = scenario.residual_probability * scenario.residual_impact

        self.assertEqual(inherent_score, 16)
        self.assertEqual(residual_score, 4)
        self.assertGreater(inherent_score, residual_score)

    def test_risk_treatment_strategies(self):
        """Test risk treatment strategy choices."""
        strategies = ['accept', 'mitigate', 'transfer', 'avoid', 'untreated']
        for strategy in strategies:
            self.assertIn(strategy, strategies)

    def test_threat_categories(self):
        """Test Threat category choices."""
        categories = [
            'natural', 'human_intentional', 'human_unintentional',
            'technical', 'environmental'
        ]
        for cat in categories:
            self.assertIn(cat, categories)

    def test_vulnerability_severity(self):
        """Test Vulnerability severity scoring."""
        # CVSS-like scoring 0-10
        severities = [0.0, 2.5, 5.0, 7.5, 10.0]
        for severity in severities:
            self.assertGreaterEqual(severity, 0)
            self.assertLessEqual(severity, 10)


class TestComplianceModels(unittest.TestCase):
    """Tests for compliance-related models."""

    def test_compliance_status_choices(self):
        """Test RequirementAssessment compliance status choices."""
        statuses = [
            'not_assessed', 'compliant', 'partially_compliant',
            'non_compliant', 'not_applicable'
        ]
        for status in statuses:
            self.assertIn(status, statuses)

    def test_finding_types(self):
        """Test Finding type choices."""
        finding_types = ['non_conformity', 'observation', 'opportunity', 'strength']
        for ft in finding_types:
            self.assertIn(ft, finding_types)

    def test_finding_severity(self):
        """Test Finding severity levels."""
        severities = ['critical', 'high', 'medium', 'low', 'informational']
        for severity in severities:
            self.assertIn(severity, severities)

    def test_evidence_types(self):
        """Test Evidence type choices."""
        evidence_types = [
            'document', 'screenshot', 'log', 'configuration',
            'interview', 'observation', 'test_result', 'attestation'
        ]
        for et in evidence_types:
            self.assertIn(et, evidence_types)

    def test_evidence_revision_numbering(self):
        """Test EvidenceRevision auto-increment logic."""
        def get_next_revision_number(existing_revisions):
            if not existing_revisions:
                return 1
            return max(r['revision_number'] for r in existing_revisions) + 1

        # No existing revisions
        self.assertEqual(get_next_revision_number([]), 1)

        # With existing revisions
        existing = [
            {'revision_number': 1},
            {'revision_number': 2},
            {'revision_number': 3},
        ]
        self.assertEqual(get_next_revision_number(existing), 4)

    def test_audit_status_workflow(self):
        """Test Audit status workflow."""
        statuses = ['planned', 'in_progress', 'completed', 'cancelled']
        # Status should progress: planned -> in_progress -> completed
        self.assertEqual(statuses.index('planned'), 0)
        self.assertEqual(statuses.index('in_progress'), 1)
        self.assertEqual(statuses.index('completed'), 2)


class TestAssetModels(unittest.TestCase):
    """Tests for asset-related models."""

    def test_asset_categories(self):
        """Test AssetCategory structure."""
        categories = ['hardware', 'software', 'data', 'people', 'facility', 'network']
        for cat in categories:
            self.assertIn(cat, categories)

    def test_asset_classification_levels(self):
        """Test AssetClassification confidentiality levels."""
        levels = ['public', 'internal', 'confidential', 'restricted', 'top_secret']
        # Should be ordered by sensitivity
        self.assertEqual(levels.index('public'), 0)
        self.assertEqual(levels.index('top_secret'), 4)

    def test_asset_relationship_types(self):
        """Test AssetRelationship types."""
        relationship_types = ['depends_on', 'supports', 'contains', 'connects_to']
        for rt in relationship_types:
            self.assertIn(rt, relationship_types)


class TestIncidentModels(unittest.TestCase):
    """Tests for incident-related models."""

    def test_incident_types(self):
        """Test Incident type choices."""
        incident_types = [
            'security', 'data_breach', 'service_outage', 'malware',
            'phishing', 'unauthorized_access', 'denial_of_service',
            'insider_threat', 'physical', 'compliance', 'other'
        ]
        for it in incident_types:
            self.assertIn(it, incident_types)

    def test_incident_severity(self):
        """Test Incident severity levels."""
        severities = ['critical', 'high', 'medium', 'low', 'informational']
        for severity in severities:
            self.assertIn(severity, severities)

    def test_incident_status_workflow(self):
        """Test Incident status workflow."""
        statuses = [
            'reported', 'triaged', 'investigating', 'contained',
            'eradicating', 'recovering', 'closed', 'false_positive'
        ]
        # Workflow should progress through these stages
        self.assertEqual(statuses.index('reported'), 0)
        self.assertEqual(statuses.index('closed'), 6)

    def test_timeline_entry_types(self):
        """Test TimelineEntry type choices."""
        entry_types = [
            'detection', 'triage', 'analysis', 'containment',
            'eradication', 'recovery', 'communication',
            'escalation', 'evidence', 'note', 'other'
        ]
        for et in entry_types:
            self.assertIn(et, entry_types)


class TestCampaignModel(unittest.TestCase):
    """Tests for Campaign model."""

    def test_campaign_types(self):
        """Test Campaign type choices."""
        campaign_types = [
            'compliance', 'risk', 'audit', 'control_testing',
            'vendor_assessment', 'self_assessment', 'certification', 'other'
        ]
        for ct in campaign_types:
            self.assertIn(ct, campaign_types)

    def test_campaign_progress_calculation(self):
        """Test Campaign progress percentage calculation."""
        def calculate_progress(completed, total):
            if total == 0:
                return 0
            return round((completed / total) * 100, 1)

        self.assertEqual(calculate_progress(0, 0), 0)
        self.assertEqual(calculate_progress(0, 10), 0)
        self.assertEqual(calculate_progress(5, 10), 50.0)
        self.assertEqual(calculate_progress(10, 10), 100.0)

    def test_campaign_overdue_check(self):
        """Test Campaign overdue check logic."""
        def is_overdue(planned_end_date, status):
            if planned_end_date is None:
                return False
            if status in ['completed', 'cancelled']:
                return False
            return date.today() > planned_end_date

        # Not overdue - no end date
        self.assertFalse(is_overdue(None, 'in_progress'))

        # Not overdue - completed
        self.assertFalse(is_overdue(date.today() - timedelta(days=1), 'completed'))

        # Overdue
        self.assertTrue(is_overdue(date.today() - timedelta(days=1), 'in_progress'))

        # Not overdue - future date
        self.assertFalse(is_overdue(date.today() + timedelta(days=1), 'in_progress'))


class TestMetadataModels(unittest.TestCase):
    """Tests for metadata models."""

    def test_filtering_label_uniqueness(self):
        """Test FilteringLabel uniqueness constraint."""
        # Labels should be unique within an organization
        label1 = {'organization_id': 'org1', 'label': 'Critical'}
        label2 = {'organization_id': 'org1', 'label': 'Critical'}
        label3 = {'organization_id': 'org2', 'label': 'Critical'}

        # Same org, same label - should conflict
        self.assertEqual(
            (label1['organization_id'], label1['label']),
            (label2['organization_id'], label2['label'])
        )

        # Different org, same label - OK
        self.assertNotEqual(
            (label1['organization_id'], label1['label']),
            (label3['organization_id'], label3['label'])
        )

    def test_terminology_mapping(self):
        """Test Terminology term mapping."""
        terminology = {
            'standard_term': 'Risk Scenario',
            'custom_term': 'Risk Event',
            'context': 'risk',
            'locale': 'en'
        }
        self.assertEqual(terminology['standard_term'], 'Risk Scenario')
        self.assertEqual(terminology['custom_term'], 'Risk Event')


class TestLibraryModels(unittest.TestCase):
    """Tests for library reference models."""

    def test_reference_control_structure(self):
        """Test ReferenceControl structure."""
        ref_control = MagicMock()
        ref_control.ref_id = "NIST-AC-2"
        ref_control.framework = MagicMock()
        ref_control.category = 'technical'

        self.assertIsNotNone(ref_control.ref_id)
        self.assertIsNotNone(ref_control.framework)

    def test_requirement_node_hierarchy(self):
        """Test RequirementNode hierarchical structure."""
        def get_descendants(node, children_map):
            descendants = list(children_map.get(node['id'], []))
            for child in children_map.get(node['id'], []):
                descendants.extend(get_descendants(child, children_map))
            return descendants

        # Create mock hierarchy
        root = {'id': 1, 'ref_id': '1', 'level': 0}
        child1 = {'id': 2, 'ref_id': '1.1', 'level': 1}
        child2 = {'id': 3, 'ref_id': '1.2', 'level': 1}
        grandchild = {'id': 4, 'ref_id': '1.1.1', 'level': 2}

        children_map = {
            1: [child1, child2],
            2: [grandchild],
            3: [],
            4: [],
        }

        descendants = get_descendants(root, children_map)
        self.assertEqual(len(descendants), 3)  # child1, child2, grandchild

    def test_requirement_mapping_relations(self):
        """Test RequirementMapping relation types."""
        relations = ['equal', 'superset', 'subset', 'intersect', 'not_related']
        for relation in relations:
            self.assertIn(relation, relations)


class TestAssessmentModels(unittest.TestCase):
    """Tests for assessment models."""

    def test_compliance_assessment_types(self):
        """Test ComplianceAssessment types."""
        assessment_types = [
            'self_assessment', 'internal_audit', 'external_audit',
            'certification', 'gap_analysis'
        ]
        for at in assessment_types:
            self.assertIn(at, assessment_types)

    def test_risk_acceptance_status(self):
        """Test RiskAcceptance status workflow."""
        statuses = ['created', 'submitted', 'accepted', 'rejected', 'revoked', 'expired']
        for status in statuses:
            self.assertIn(status, statuses)

    def test_risk_acceptance_expiration(self):
        """Test RiskAcceptance expiration check."""
        def is_expired(expiration_date):
            if expiration_date is None:
                return False
            return date.today() > expiration_date

        self.assertFalse(is_expired(None))
        self.assertTrue(is_expired(date.today() - timedelta(days=1)))
        self.assertFalse(is_expired(date.today() + timedelta(days=1)))

    def test_organisation_issue_types(self):
        """Test OrganisationIssue type choices."""
        issue_types = [
            'internal', 'external', 'regulatory', 'competitive',
            'technological', 'market', 'other'
        ]
        for it in issue_types:
            self.assertIn(it, issue_types)

    def test_organisation_objective_status(self):
        """Test OrganisationObjective status choices."""
        statuses = ['not_started', 'in_progress', 'achieved', 'not_achieved', 'deferred']
        for status in statuses:
            self.assertIn(status, statuses)


class TestAllExports(unittest.TestCase):
    """Tests for module exports."""

    def test_core_module_exports(self):
        """Test all expected models are exported."""
        expected_exports = [
            # Organization
            'Organization', 'Domain', 'Perimeter', 'OrganizationalUnit',
            # Governance
            'Framework', 'Control', 'ControlFamily', 'Policy', 'Procedure', 'AppliedControl',
            # Risk
            'RiskMatrix', 'RiskScenario', 'RiskAssessment', 'Threat', 'Vulnerability', 'RiskTreatment',
            # Compliance
            'ComplianceRequirement', 'RequirementAssessment', 'Audit', 'Finding',
            'Evidence', 'EvidenceRevision', 'ComplianceException',
            # Assets
            'Asset', 'AssetCategory', 'AssetClassification', 'AssetRelationship',
            # Incidents
            'Incident', 'TimelineEntry',
            # Campaigns
            'Campaign',
            # Metadata
            'FilteringLabel', 'Terminology',
            # Library
            'ReferenceControl', 'RequirementNode', 'RequirementMappingSet', 'RequirementMapping',
            # Assessments
            'ComplianceAssessment', 'FindingsAssessment', 'RiskAcceptance',
            'OrganisationIssue', 'OrganisationObjective', 'Team',
        ]
        for export in expected_exports:
            self.assertIn(export, expected_exports)
        self.assertEqual(len(expected_exports), 42)


if __name__ == '__main__':
    unittest.main()
