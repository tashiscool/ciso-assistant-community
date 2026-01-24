"""
Comprehensive tests for Compliance Assessment Service

Tests cover:
- Assessment creation and management
- Evidence collection workflows
- Requirement evaluation
- Finding and exception handling
- Report generation
- Data validation
"""

import pytest
import uuid
import sys
from unittest.mock import Mock, patch, MagicMock
from datetime import date, timedelta

# Mock missing repositories before importing the service
sys.modules['compliance.repositories'] = MagicMock()
sys.modules['compliance.repositories.compliance_assessment_repository'] = MagicMock()
sys.modules['compliance.repositories.requirement_assessment_repository'] = MagicMock()
sys.modules['compliance.repositories.compliance_finding_repository'] = MagicMock()
sys.modules['compliance.repositories.compliance_exception_repository'] = MagicMock()

from django.utils import timezone

from compliance.services.compliance_assessment_service import ComplianceAssessmentService


# =============================================================================
# ComplianceAssessmentService Tests
# =============================================================================

class TestComplianceAssessmentService:
    """Tests for ComplianceAssessmentService."""

    @pytest.fixture
    def service(self):
        """Create compliance assessment service."""
        return ComplianceAssessmentService()

    @pytest.fixture
    def sample_assessment_data(self):
        """Sample assessment data for testing."""
        return {
            'name': 'FedRAMP Moderate Assessment',
            'target_type': 'system',
            'target_id': str(uuid.uuid4()),
            'target_name': 'Cloud Platform',
            'primary_framework': 'NIST SP 800-53',
            'scope': 'System',
            'planned_start_date': date.today(),
            'planned_completion_date': date.today() + timedelta(days=90),
            'description': 'Annual compliance assessment',
            'tags': ['annual', 'fedramp', 'moderate'],
            'additional_frameworks': ['ISO 27001'],
            'assessment_type': 'full',
            'priority': 'high'
        }

    @pytest.fixture
    def sample_requirements_data(self):
        """Sample requirements data for testing."""
        return [
            {
                'requirement_id': 'AC-2',
                'title': 'Account Management',
                'description': 'The organization manages system accounts',
                'framework': 'NIST SP 800-53',
                'framework_section': 'Access Control',
                'required_evidence_types': ['policy', 'screenshot'],
                'tags': ['critical']
            },
            {
                'requirement_id': 'AU-2',
                'title': 'Audit Events',
                'description': 'The organization determines auditable events',
                'framework': 'NIST SP 800-53',
                'framework_section': 'Audit and Accountability',
                'required_evidence_types': ['config', 'log'],
                'tags': []
            }
        ]

    @pytest.fixture
    def mock_assessment(self):
        """Create mock assessment."""
        assessment = MagicMock()
        assessment.id = uuid.uuid4()
        assessment.assessment_id = 'CMP-2024-ABC123'
        assessment.name = 'Test Assessment'
        assessment.status = 'planned'
        assessment.primary_framework = 'NIST SP 800-53'
        assessment.requirement_assessment_ids = ['req1', 'req2']
        assessment.compliance_finding_ids = []
        assessment.compliance_exception_ids = []
        assessment.total_requirements = 2
        assessment.assessed_requirements = 0
        assessment.compliant_requirements = 0
        assessment.non_compliant_requirements = 0
        assessment.not_applicable_requirements = 0
        assessment.overall_compliance_score = 0
        assessment.compliance_level = 'none'
        assessment.progress_percentage = 0
        assessment.compensating_controls_count = 0
        assessment.actual_completion_date = None
        return assessment

    @pytest.fixture
    def mock_requirement(self):
        """Create mock requirement assessment."""
        requirement = MagicMock()
        requirement.id = uuid.uuid4()
        requirement.requirement_id = 'AC-2'
        requirement.requirement_title = 'Account Management'
        requirement.assessment_result = 'not_assessed'
        requirement.compliance_score = 0
        requirement.evidence_sufficiency = 'insufficient'
        requirement.control_effectiveness = 'unknown'
        requirement.assessment_notes = ''
        requirement.framework = 'NIST SP 800-53'
        return requirement

    # -------------------------------------------------------------------------
    # Create Comprehensive Assessment Tests
    # -------------------------------------------------------------------------

    def test_create_comprehensive_assessment_success(self, service, sample_assessment_data, sample_requirements_data):
        """Test successful comprehensive assessment creation."""
        with patch('compliance.services.compliance_assessment_service.ComplianceAssessment') as MockAssessment, \
             patch('compliance.services.compliance_assessment_service.RequirementAssessment') as MockRequirement:

            mock_assessment = MagicMock()
            mock_assessment.id = uuid.uuid4()
            mock_assessment.requirement_assessment_ids = []
            MockAssessment.return_value = mock_assessment

            mock_requirement = MagicMock()
            mock_requirement.id = uuid.uuid4()
            MockRequirement.return_value = mock_requirement

            assessment, requirements = service.create_comprehensive_assessment(
                assessment_data=sample_assessment_data,
                requirements_data=sample_requirements_data,
                assessor_user_id=uuid.uuid4(),
                assessor_username='test_assessor'
            )

            assert assessment == mock_assessment
            assert len(requirements) == 2
            mock_assessment.create_assessment.assert_called_once()
            mock_assessment.save.assert_called()

    def test_create_comprehensive_assessment_generates_id(self, service, sample_assessment_data, sample_requirements_data):
        """Test that assessment creation generates unique ID."""
        with patch('compliance.services.compliance_assessment_service.ComplianceAssessment') as MockAssessment, \
             patch('compliance.services.compliance_assessment_service.RequirementAssessment') as MockRequirement:

            mock_assessment = MagicMock()
            mock_assessment.id = uuid.uuid4()
            mock_assessment.requirement_assessment_ids = []
            MockAssessment.return_value = mock_assessment
            MockRequirement.return_value = MagicMock(id=uuid.uuid4())

            service.create_comprehensive_assessment(
                assessment_data=sample_assessment_data,
                requirements_data=sample_requirements_data,
                assessor_user_id=uuid.uuid4(),
                assessor_username='test_assessor'
            )

            call_kwargs = mock_assessment.create_assessment.call_args.kwargs
            assert call_kwargs['assessment_id'].startswith('CMP-')

    def test_create_comprehensive_assessment_with_additional_frameworks(self, service, sample_assessment_data, sample_requirements_data):
        """Test assessment creation with additional frameworks."""
        with patch('compliance.services.compliance_assessment_service.ComplianceAssessment') as MockAssessment, \
             patch('compliance.services.compliance_assessment_service.RequirementAssessment') as MockRequirement:

            mock_assessment = MagicMock()
            mock_assessment.id = uuid.uuid4()
            mock_assessment.requirement_assessment_ids = []
            MockAssessment.return_value = mock_assessment
            MockRequirement.return_value = MagicMock(id=uuid.uuid4())

            service.create_comprehensive_assessment(
                assessment_data=sample_assessment_data,
                requirements_data=sample_requirements_data,
                assessor_user_id=uuid.uuid4(),
                assessor_username='test_assessor'
            )

            assert mock_assessment.additional_frameworks == ['ISO 27001']

    # -------------------------------------------------------------------------
    # Evidence Collection Tests
    # -------------------------------------------------------------------------

    def test_conduct_evidence_collection_success(self, service, mock_assessment, mock_requirement):
        """Test successful evidence collection."""
        mock_assessment.status = 'planned'

        evidence_data = {
            'requirement_req1': {
                'evidence_id': 'EVD-001',
                'evidence_type': 'document'
            }
        }

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', return_value=mock_requirement):

            mock_requirement.evidence_sufficiency = 'adequate'

            result = service.conduct_evidence_collection(
                assessment_id='CMP-001',
                evidence_data=evidence_data,
                collector_user_id=uuid.uuid4(),
                collector_username='test_collector'
            )

            assert result['total_requirements'] == 2
            mock_assessment.start_assessment.assert_called_once()
            assert mock_assessment.status == 'evidence_collection'

    def test_conduct_evidence_collection_not_found(self, service):
        """Test evidence collection with non-existent assessment."""
        with patch.object(service.assessment_repo, 'get', return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.conduct_evidence_collection(
                    assessment_id='NONEXISTENT',
                    evidence_data={},
                    collector_user_id=uuid.uuid4(),
                    collector_username='test_collector'
                )

    def test_conduct_evidence_collection_updates_progress(self, service, mock_assessment, mock_requirement):
        """Test evidence collection updates assessment progress."""
        mock_assessment.status = 'evidence_collection'

        evidence_data = {
            'requirement_req1': {'evidence_id': 'EVD-001', 'evidence_type': 'document'},
            'requirement_req2': {'evidence_id': 'EVD-002', 'evidence_type': 'config'}
        }

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', return_value=mock_requirement):

            mock_requirement.evidence_sufficiency = 'comprehensive'

            result = service.conduct_evidence_collection(
                assessment_id='CMP-001',
                evidence_data=evidence_data,
                collector_user_id=uuid.uuid4(),
                collector_username='test_collector'
            )

            mock_assessment.update_progress.assert_called()

    # -------------------------------------------------------------------------
    # Requirement Evaluation Tests
    # -------------------------------------------------------------------------

    def test_perform_requirement_evaluation_success(self, service, mock_assessment, mock_requirement):
        """Test successful requirement evaluation."""
        evaluations_data = {
            'requirement_req1': {
                'assessment_result': 'compliant',
                'compliance_score': 100.0,
                'assessment_notes': 'Fully implemented',
                'assessment_methodology': 'Interview and documentation review'
            },
            'requirement_req2': {
                'assessment_result': 'non_compliant',
                'compliance_score': 30.0,
                'assessment_notes': 'Missing controls',
                'assessment_methodology': 'Technical testing'
            }
        }

        mock_requirement_compliant = MagicMock()
        mock_requirement_compliant.requirement_id = 'AC-2'
        mock_requirement_compliant.requirement_title = 'Account Management'
        mock_requirement_compliant.assessment_notes = ''
        mock_requirement_compliant.id = uuid.uuid4()

        mock_requirement_non_compliant = MagicMock()
        mock_requirement_non_compliant.requirement_id = 'AU-2'
        mock_requirement_non_compliant.requirement_title = 'Audit Events'
        mock_requirement_non_compliant.assessment_notes = 'Missing controls'
        mock_requirement_non_compliant.id = uuid.uuid4()

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', side_effect=[mock_requirement_compliant, mock_requirement_non_compliant]), \
             patch.object(service, '_create_finding_from_requirement') as mock_create_finding, \
             patch.object(service, '_calculate_overall_compliance_score', return_value=65.0):

            mock_finding = MagicMock()
            mock_finding.id = uuid.uuid4()
            mock_finding.finding_id = 'FIND-001'
            mock_finding.severity = 'high'
            mock_create_finding.return_value = mock_finding

            result = service.perform_requirement_evaluation(
                assessment_id='CMP-001',
                evaluations_data=evaluations_data,
                evaluator_user_id=uuid.uuid4(),
                evaluator_username='test_evaluator'
            )

            assert result['evaluated_requirements'] == 2
            assert result['compliant_requirements'] == 1
            assert result['non_compliant_requirements'] == 1
            assert result['findings_created'] == 1

    def test_perform_requirement_evaluation_not_found(self, service):
        """Test requirement evaluation with non-existent assessment."""
        with patch.object(service.assessment_repo, 'get', return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.perform_requirement_evaluation(
                    assessment_id='NONEXISTENT',
                    evaluations_data={},
                    evaluator_user_id=uuid.uuid4(),
                    evaluator_username='test_evaluator'
                )

    def test_perform_requirement_evaluation_with_compensating_controls(self, service, mock_assessment, mock_requirement):
        """Test evaluation with compensating controls."""
        evaluations_data = {
            'requirement_req1': {
                'assessment_result': 'compliant',
                'compliance_score': 80.0,
                'compensating_controls': [
                    {'control_id': 'CC-001', 'justification': 'Alternative control implemented'}
                ]
            }
        }

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', return_value=mock_requirement), \
             patch.object(service, '_calculate_overall_compliance_score', return_value=80.0):

            result = service.perform_requirement_evaluation(
                assessment_id='CMP-001',
                evaluations_data=evaluations_data,
                evaluator_user_id=uuid.uuid4(),
                evaluator_username='test_evaluator'
            )

            assert result['compensating_controls'] == 1

    def test_perform_requirement_evaluation_not_applicable(self, service, mock_assessment, mock_requirement):
        """Test evaluation with not applicable requirements."""
        evaluations_data = {
            'requirement_req1': {
                'assessment_result': 'not_applicable',
                'compliance_score': 0.0,
                'assessment_notes': 'Control not applicable to this system'
            }
        }

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', return_value=mock_requirement), \
             patch.object(service, '_calculate_overall_compliance_score', return_value=0.0):

            result = service.perform_requirement_evaluation(
                assessment_id='CMP-001',
                evaluations_data=evaluations_data,
                evaluator_user_id=uuid.uuid4(),
                evaluator_username='test_evaluator'
            )

            assert result['not_applicable_requirements'] == 1

    # -------------------------------------------------------------------------
    # Finding Creation Tests
    # -------------------------------------------------------------------------

    def test_create_finding_from_requirement(self, service, mock_assessment, mock_requirement):
        """Test finding creation from non-compliant requirement."""
        with patch('compliance.services.compliance_assessment_service.ComplianceFinding') as MockFinding:
            mock_finding = MagicMock()
            MockFinding.return_value = mock_finding

            result = service._create_finding_from_requirement(
                requirement=mock_requirement,
                assessment=mock_assessment,
                creator_user_id=uuid.uuid4(),
                creator_username='test_user'
            )

            mock_finding.create_finding.assert_called_once()
            mock_finding.save.assert_called_once()
            assert result == mock_finding

    def test_determine_finding_severity_critical(self, service):
        """Test finding severity determination - critical."""
        mock_requirement = MagicMock()
        mock_requirement.requirement_title = 'Critical Access Control'

        severity = service._determine_finding_severity(mock_requirement)

        assert severity == 'critical'

    def test_determine_finding_severity_high_keyword(self, service):
        """Test finding severity determination - high from keyword."""
        mock_requirement = MagicMock()
        mock_requirement.requirement_title = 'High Priority Authentication'

        severity = service._determine_finding_severity(mock_requirement)

        assert severity == 'high'

    def test_determine_finding_severity_confidentiality(self, service):
        """Test finding severity determination - high from confidentiality."""
        mock_requirement = MagicMock()
        mock_requirement.requirement_title = 'Data Confidentiality Protection'

        severity = service._determine_finding_severity(mock_requirement)

        assert severity == 'high'

    def test_determine_finding_severity_default(self, service):
        """Test finding severity determination - default medium."""
        mock_requirement = MagicMock()
        mock_requirement.requirement_title = 'General Security Control'

        severity = service._determine_finding_severity(mock_requirement)

        assert severity == 'medium'

    # -------------------------------------------------------------------------
    # Compliance Score Calculation Tests
    # -------------------------------------------------------------------------

    def test_calculate_overall_compliance_score(self, service, mock_assessment):
        """Test overall compliance score calculation."""
        mock_assessment.assessed_requirements = 10
        mock_assessment.compliant_requirements = 7
        mock_assessment.non_compliant_requirements = 2
        mock_assessment.not_applicable_requirements = 1

        score = service._calculate_overall_compliance_score(mock_assessment)

        # Expected: (7 * 1.0 + 2 * 0.0 + 1 * 0.5) / 10 * 100 = 75%
        assert score == 75.0

    def test_calculate_overall_compliance_score_zero_assessed(self, service, mock_assessment):
        """Test compliance score with zero assessed requirements."""
        mock_assessment.assessed_requirements = 0

        score = service._calculate_overall_compliance_score(mock_assessment)

        assert score == 0.0

    def test_calculate_overall_compliance_score_all_compliant(self, service, mock_assessment):
        """Test compliance score with all compliant."""
        mock_assessment.assessed_requirements = 10
        mock_assessment.compliant_requirements = 10
        mock_assessment.non_compliant_requirements = 0
        mock_assessment.not_applicable_requirements = 0

        score = service._calculate_overall_compliance_score(mock_assessment)

        assert score == 100.0

    # -------------------------------------------------------------------------
    # Report Generation Tests
    # -------------------------------------------------------------------------

    def test_generate_assessment_report_comprehensive(self, service, mock_assessment):
        """Test comprehensive assessment report generation."""
        mock_requirement = MagicMock()
        mock_requirement.requirement_id = 'AC-2'
        mock_requirement.requirement_title = 'Account Management'
        mock_requirement.assessment_result = 'compliant'
        mock_requirement.compliance_score = 100
        mock_requirement.evidence_sufficiency = 'adequate'
        mock_requirement.control_effectiveness = 'fully_implemented'

        mock_finding = MagicMock()
        mock_finding.finding_id = 'FIND-001'
        mock_finding.finding_title = 'Missing Control'
        mock_finding.finding_type = 'non_conformity'
        mock_finding.severity = 'high'
        mock_finding.status = 'open'
        mock_finding.remediation_status = 'pending'

        mock_exception = MagicMock()
        mock_exception.exception_id = 'EXC-001'
        mock_exception.exception_title = 'Legacy System Exception'
        mock_exception.exception_type = 'risk_acceptance'
        mock_exception.status = 'approved'

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', return_value=mock_requirement), \
             patch.object(service.finding_repo, 'get', return_value=mock_finding), \
             patch.object(service.exception_repo, 'get', return_value=mock_exception), \
             patch.object(service, '_generate_assessment_recommendations', return_value=[]):

            result = service.generate_assessment_report(
                assessment_id='CMP-001',
                report_type='comprehensive'
            )

            assert 'assessment' in result
            assert 'summary' in result
            assert 'requirements' in result
            assert 'findings' in result
            assert 'exceptions' in result
            assert 'recommendations' in result

    def test_generate_assessment_report_executive(self, service, mock_assessment):
        """Test executive assessment report generation."""
        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', return_value=None), \
             patch.object(service.finding_repo, 'get', return_value=None), \
             patch.object(service.exception_repo, 'get', return_value=None):

            result = service.generate_assessment_report(
                assessment_id='CMP-001',
                report_type='executive'
            )

            assert 'assessment' in result
            assert 'summary' in result
            assert 'requirements' not in result

    def test_generate_assessment_report_technical(self, service, mock_assessment):
        """Test technical assessment report generation."""
        mock_requirement = MagicMock()
        mock_requirement.requirement_id = 'AC-2'
        mock_requirement.requirement_title = 'Account Management'
        mock_requirement.assessment_result = 'compliant'
        mock_requirement.compliance_score = 100
        mock_requirement.evidence_sufficiency = 'adequate'
        mock_requirement.control_effectiveness = 'fully_implemented'

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', return_value=mock_requirement), \
             patch.object(service.finding_repo, 'get', return_value=None), \
             patch.object(service.exception_repo, 'get', return_value=None):

            result = service.generate_assessment_report(
                assessment_id='CMP-001',
                report_type='technical'
            )

            assert 'requirements' in result
            assert 'findings' in result
            assert 'exceptions' not in result

    def test_generate_assessment_report_not_found(self, service):
        """Test report generation for non-existent assessment."""
        with patch.object(service.assessment_repo, 'get', return_value=None):
            with pytest.raises(ValueError, match="not found"):
                service.generate_assessment_report(assessment_id='NONEXISTENT')

    # -------------------------------------------------------------------------
    # Recommendations Generation Tests
    # -------------------------------------------------------------------------

    def test_generate_assessment_recommendations_low_compliance(self, service, mock_assessment):
        """Test recommendations for low compliance score."""
        mock_assessment.overall_compliance_score = 50

        recommendations = service._generate_assessment_recommendations(
            mock_assessment, [], []
        )

        assert len(recommendations) > 0
        assert any(r['priority'] == 'critical' for r in recommendations)

    def test_generate_assessment_recommendations_critical_findings(self, service, mock_assessment):
        """Test recommendations for critical findings."""
        mock_assessment.overall_compliance_score = 80

        mock_finding = MagicMock()
        mock_finding.severity = 'critical'
        mock_finding.status = 'open'
        mock_finding.finding_id = 'FIND-001'

        recommendations = service._generate_assessment_recommendations(
            mock_assessment, [mock_finding], []
        )

        assert any(r['category'] == 'findings' for r in recommendations)

    def test_generate_assessment_recommendations_expired_exceptions(self, service, mock_assessment):
        """Test recommendations for expired exceptions."""
        mock_assessment.overall_compliance_score = 90

        mock_exception = MagicMock()
        mock_exception.status = 'expired'

        recommendations = service._generate_assessment_recommendations(
            mock_assessment, [], [mock_exception]
        )

        assert any(r['category'] == 'exceptions' for r in recommendations)

    # -------------------------------------------------------------------------
    # Validation Tests
    # -------------------------------------------------------------------------

    def test_validate_assessment_data_valid(self, service, sample_assessment_data):
        """Test validation of valid assessment data."""
        errors = service.validate_assessment_data(sample_assessment_data)

        assert errors == []

    def test_validate_assessment_data_missing_required(self, service):
        """Test validation with missing required fields."""
        data = {'description': 'Test assessment'}

        errors = service.validate_assessment_data(data)

        assert len(errors) == 5
        assert any('name' in e for e in errors)
        assert any('target_type' in e for e in errors)
        assert any('primary_framework' in e for e in errors)

    def test_validate_assessment_data_invalid_dates(self, service):
        """Test validation with invalid date order."""
        data = {
            'name': 'Test Assessment',
            'target_type': 'system',
            'target_id': 'SYS-001',
            'target_name': 'Test System',
            'primary_framework': 'NIST SP 800-53',
            'planned_start_date': date.today() + timedelta(days=30),
            'planned_completion_date': date.today()  # Before start date
        }

        errors = service.validate_assessment_data(data)

        assert any('date' in e.lower() for e in errors)

    def test_validate_assessment_data_invalid_framework(self, service):
        """Test validation with unsupported framework."""
        data = {
            'name': 'Test Assessment',
            'target_type': 'system',
            'target_id': 'SYS-001',
            'target_name': 'Test System',
            'primary_framework': 'UNSUPPORTED_FRAMEWORK'
        }

        errors = service.validate_assessment_data(data)

        assert any('framework' in e.lower() for e in errors)

    def test_validate_assessment_data_invalid_priority(self, service):
        """Test validation with invalid priority."""
        data = {
            'name': 'Test Assessment',
            'target_type': 'system',
            'target_id': 'SYS-001',
            'target_name': 'Test System',
            'primary_framework': 'NIST SP 800-53',
            'priority': 'urgent'  # Invalid
        }

        errors = service.validate_assessment_data(data)

        assert any('priority' in e.lower() for e in errors)


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestComplianceServiceEdgeCases:
    """Edge case tests for compliance service."""

    @pytest.fixture
    def service(self):
        return ComplianceAssessmentService()

    def test_empty_requirements_list(self, service):
        """Test assessment creation with empty requirements."""
        assessment_data = {
            'name': 'Test Assessment',
            'target_type': 'system',
            'target_id': str(uuid.uuid4()),
            'target_name': 'Test System',
            'primary_framework': 'NIST SP 800-53'
        }

        with patch('compliance.services.compliance_assessment_service.ComplianceAssessment') as MockAssessment:
            mock_assessment = MagicMock()
            mock_assessment.id = uuid.uuid4()
            mock_assessment.requirement_assessment_ids = []
            MockAssessment.return_value = mock_assessment

            assessment, requirements = service.create_comprehensive_assessment(
                assessment_data=assessment_data,
                requirements_data=[],
                assessor_user_id=uuid.uuid4(),
                assessor_username='test_user'
            )

            assert len(requirements) == 0

    def test_evidence_collection_no_matching_requirements(self, service):
        """Test evidence collection when no requirements match."""
        mock_assessment = MagicMock()
        mock_assessment.status = 'evidence_collection'
        mock_assessment.requirement_assessment_ids = ['req1']

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service.requirement_repo, 'get', return_value=None):

            result = service.conduct_evidence_collection(
                assessment_id='CMP-001',
                evidence_data={'requirement_req1': {'evidence_id': 'EVD-001'}},
                collector_user_id=uuid.uuid4(),
                collector_username='test_collector'
            )

            assert result['evidence_collected'] == 0

    def test_evaluation_with_empty_data(self, service):
        """Test requirement evaluation with empty data."""
        mock_assessment = MagicMock()
        mock_assessment.requirement_assessment_ids = []

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service, '_calculate_overall_compliance_score', return_value=0.0):

            result = service.perform_requirement_evaluation(
                assessment_id='CMP-001',
                evaluations_data={},
                evaluator_user_id=uuid.uuid4(),
                evaluator_username='test_evaluator'
            )

            assert result['evaluated_requirements'] == 0

    def test_report_with_no_related_entities(self, service):
        """Test report generation with no findings or exceptions."""
        mock_assessment = MagicMock()
        mock_assessment.assessment_id = 'CMP-001'
        mock_assessment.name = 'Test Assessment'
        mock_assessment.primary_framework = 'NIST SP 800-53'
        mock_assessment.status = 'completed'
        mock_assessment.overall_compliance_score = 100
        mock_assessment.compliance_level = 'compliant'
        mock_assessment.progress_percentage = 100
        mock_assessment.actual_completion_date = date.today()
        mock_assessment.total_requirements = 10
        mock_assessment.assessed_requirements = 10
        mock_assessment.compliant_requirements = 10
        mock_assessment.non_compliant_requirements = 0
        mock_assessment.not_applicable_requirements = 0
        mock_assessment.compensating_controls_count = 0
        mock_assessment.requirement_assessment_ids = []
        mock_assessment.compliance_finding_ids = []
        mock_assessment.compliance_exception_ids = []

        with patch.object(service.assessment_repo, 'get', return_value=mock_assessment), \
             patch.object(service, '_generate_assessment_recommendations', return_value=[]):

            result = service.generate_assessment_report(
                assessment_id='CMP-001',
                report_type='comprehensive'
            )

            assert result['summary']['total_findings'] == 0
            assert result['summary']['total_exceptions'] == 0
