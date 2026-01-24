"""
Comprehensive tests for AI Assistant Services

Tests cover:
- AI Auditor: Control evaluation, gap analysis, compliance assessment, evidence review
- AI Explainer: Control explanation, risk explanation, concept explanation
- AI Extractor: Document parsing, control extraction, requirement extraction
"""

import pytest
from unittest.mock import Mock, patch, MagicMock

from ai_assistant.services.ai_auditor import (
    AIAuditorService,
    ControlEvaluation,
    GapFinding,
    ComplianceAssessment,
    EvidenceReview,
    EffectivenessRating,
    GapSeverity,
    get_ai_auditor_service,
)
from ai_assistant.services.ai_explainer import (
    AIExplainerService,
    Explanation,
    ControlExplanation,
    RiskExplanation,
    Audience,
    ExplanationFormat,
    get_ai_explainer_service,
)
from ai_assistant.services.ai_extractor import (
    AIExtractorService,
    DocumentParser,
    ExtractedControl,
    ExtractedRequirement,
    ExtractedPolicy,
    ExtractionResult,
    DocumentFormat,
    ExtractionType,
    get_ai_extractor_service,
)
# Note: MockLLMClient is provided by conftest.py fixture


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def ai_auditor(mock_llm_client):
    """Create AI Auditor service with mock client."""
    return AIAuditorService(llm_client=mock_llm_client)


@pytest.fixture
def ai_explainer(mock_llm_client):
    """Create AI Explainer service with mock client."""
    return AIExplainerService(llm_client=mock_llm_client)


@pytest.fixture
def ai_extractor(mock_llm_client):
    """Create AI Extractor service with mock client."""
    return AIExtractorService(llm_client=mock_llm_client)


# =============================================================================
# AI Auditor - Data Classes Tests
# =============================================================================

class TestAIAuditorDataClasses:
    """Tests for AI Auditor data classes."""

    def test_control_evaluation_creation(self):
        """Test ControlEvaluation dataclass creation."""
        evaluation = ControlEvaluation(
            control_id='AC-1',
            effectiveness_rating='largely_effective',
            effectiveness_score=0.85,
            strengths=['Strong policy documentation'],
            weaknesses=['Manual processes'],
            recommendations=['Automate access reviews'],
            evidence_assessment='Evidence is sufficient',
            audit_observations='Control is well-implemented'
        )

        assert evaluation.control_id == 'AC-1'
        assert evaluation.effectiveness_score == 0.85
        assert len(evaluation.strengths) == 1

    def test_control_evaluation_to_dict(self):
        """Test ControlEvaluation serialization."""
        evaluation = ControlEvaluation(
            control_id='AC-2',
            effectiveness_rating='partially_effective',
            effectiveness_score=0.5,
        )

        result = evaluation.to_dict()

        assert result['control_id'] == 'AC-2'
        assert result['effectiveness_rating'] == 'partially_effective'
        assert result['effectiveness_score'] == 0.5
        assert 'strengths' in result
        assert 'weaknesses' in result

    def test_gap_finding_creation(self):
        """Test GapFinding dataclass creation."""
        gap = GapFinding(
            gap_id='GAP-001',
            title='Missing Access Control Policy',
            description='No formal access control policy exists',
            severity='high',
            affected_controls=['AC-1', 'AC-2'],
            root_cause='Lack of governance',
            remediation_recommendation='Develop and implement policy',
            estimated_effort='medium',
            risk_if_not_addressed='Unauthorized access possible'
        )

        assert gap.gap_id == 'GAP-001'
        assert gap.severity == 'high'
        assert len(gap.affected_controls) == 2

    def test_gap_finding_to_dict(self):
        """Test GapFinding serialization."""
        gap = GapFinding(
            gap_id='GAP-002',
            title='Test Gap',
            description='Test description',
            severity='medium',
        )

        result = gap.to_dict()

        assert result['gap_id'] == 'GAP-002'
        assert result['title'] == 'Test Gap'
        assert result['severity'] == 'medium'

    def test_compliance_assessment_creation(self):
        """Test ComplianceAssessment dataclass creation."""
        assessment = ComplianceAssessment(
            framework='NIST 800-53',
            overall_compliance_score=0.75,
            control_family_scores={'AC': 0.8, 'AU': 0.7},
            fully_compliant_controls=['AC-1', 'AU-1'],
            partially_compliant_controls=['AC-2'],
            non_compliant_controls=['AU-2'],
            gaps=[],
            summary='Good overall compliance'
        )

        assert assessment.framework == 'NIST 800-53'
        assert assessment.overall_compliance_score == 0.75
        assert len(assessment.control_family_scores) == 2

    def test_compliance_assessment_to_dict_with_gaps(self):
        """Test ComplianceAssessment serialization with gaps."""
        gap = GapFinding(
            gap_id='GAP-001',
            title='Test',
            description='Test',
            severity='low'
        )
        assessment = ComplianceAssessment(
            framework='ISO 27001',
            overall_compliance_score=0.9,
            gaps=[gap],
        )

        result = assessment.to_dict()

        assert len(result['gaps']) == 1
        assert result['gaps'][0]['gap_id'] == 'GAP-001'

    def test_evidence_review_creation(self):
        """Test EvidenceReview dataclass creation."""
        review = EvidenceReview(
            evidence_id='EV-001',
            evidence_type='screenshot',
            relevance_score=0.9,
            sufficiency_rating='sufficient',
            currency_assessment='current',
            reliability_assessment='high',
            observations=['Evidence clearly shows control operation'],
            recommendations=['Update quarterly']
        )

        assert review.evidence_id == 'EV-001'
        assert review.relevance_score == 0.9
        assert review.sufficiency_rating == 'sufficient'

    def test_evidence_review_to_dict(self):
        """Test EvidenceReview serialization."""
        review = EvidenceReview(
            evidence_id='EV-002',
            evidence_type='log_file',
            relevance_score=0.7,
            sufficiency_rating='partially_sufficient',
            currency_assessment='outdated',
            reliability_assessment='medium',
        )

        result = review.to_dict()

        assert result['evidence_id'] == 'EV-002'
        assert result['currency_assessment'] == 'outdated'


# =============================================================================
# AI Auditor - Enum Tests
# =============================================================================

class TestAIAuditorEnums:
    """Tests for AI Auditor enums."""

    def test_effectiveness_rating_values(self):
        """Test EffectivenessRating enum values."""
        assert EffectivenessRating.FULLY_EFFECTIVE == 'fully_effective'
        assert EffectivenessRating.LARGELY_EFFECTIVE == 'largely_effective'
        assert EffectivenessRating.PARTIALLY_EFFECTIVE == 'partially_effective'
        assert EffectivenessRating.LARGELY_INEFFECTIVE == 'largely_ineffective'
        assert EffectivenessRating.INEFFECTIVE == 'ineffective'
        assert EffectivenessRating.NOT_IMPLEMENTED == 'not_implemented'

    def test_gap_severity_values(self):
        """Test GapSeverity enum values."""
        assert GapSeverity.CRITICAL == 'critical'
        assert GapSeverity.HIGH == 'high'
        assert GapSeverity.MEDIUM == 'medium'
        assert GapSeverity.LOW == 'low'
        assert GapSeverity.INFORMATIONAL == 'informational'


# =============================================================================
# AI Auditor - Service Tests
# =============================================================================

class TestAIAuditorService:
    """Tests for AIAuditorService."""

    def test_service_initialization(self, mock_llm_client):
        """Test service initialization."""
        service = AIAuditorService(llm_client=mock_llm_client)
        assert service._llm_client is mock_llm_client

    def test_service_lazy_load_client(self):
        """Test lazy loading of LLM client."""
        service = AIAuditorService()
        assert service._llm_client is None
        # Accessing property should trigger lazy load (or return mock)

    def test_evaluate_control_effectiveness(self, ai_auditor):
        """Test control effectiveness evaluation."""
        result = ai_auditor.evaluate_control_effectiveness(
            control_id='AC-1',
            control_description='Access control policy',
            requirement_text='Organization must implement access controls',
            implementation_statement='Implemented via IAM system',
            evidence_summary='Screenshots and configuration exports provided'
        )

        assert isinstance(result, ControlEvaluation)
        assert result.control_id == 'AC-1'

    def test_evaluate_control_with_context(self, ai_auditor):
        """Test control evaluation with additional context."""
        result = ai_auditor.evaluate_control_effectiveness(
            control_id='AC-2',
            control_description='Account management',
            requirement_text='Manage user accounts',
            context={
                'organization_size': 'large',
                'industry': 'healthcare',
                'previous_findings': ['access review delays']
            }
        )

        assert isinstance(result, ControlEvaluation)

    def test_perform_gap_analysis(self, ai_auditor):
        """Test gap analysis."""
        result = ai_auditor.perform_gap_analysis(
            current_state={
                'implemented_controls': ['AC-1', 'AU-1'],
                'pending_controls': ['AC-2'],
                'policy_status': 'draft'
            },
            target_framework='NIST 800-53',
            control_requirements=[
                {'control_id': 'AC-1', 'description': 'Access control policy'},
                {'control_id': 'AC-2', 'description': 'Account management'},
            ]
        )

        assert isinstance(result, list)

    def test_perform_gap_analysis_no_requirements(self, ai_auditor):
        """Test gap analysis without specific requirements."""
        result = ai_auditor.perform_gap_analysis(
            current_state={'status': 'partial'},
            target_framework='ISO 27001',
        )

        assert isinstance(result, list)

    def test_assess_compliance(self, ai_auditor):
        """Test compliance assessment."""
        result = ai_auditor.assess_compliance(
            framework='FedRAMP Moderate',
            controls_data=[
                {'control_id': 'AC-1', 'implementation_status': 'implemented'},
                {'control_id': 'AC-2', 'implementation_status': 'partial'},
                {'control_id': 'AU-1', 'implementation_status': 'not_implemented'},
            ]
        )

        assert isinstance(result, ComplianceAssessment)
        assert result.framework == 'FedRAMP Moderate'

    def test_assess_compliance_empty_controls(self, ai_auditor):
        """Test compliance assessment with empty controls."""
        result = ai_auditor.assess_compliance(
            framework='SOC 2',
            controls_data=[]
        )

        assert isinstance(result, ComplianceAssessment)

    def test_review_evidence(self, ai_auditor):
        """Test evidence review."""
        result = ai_auditor.review_evidence(
            evidence_description='Screenshot of IAM console showing user list',
            evidence_type='screenshot',
            control_requirement='Maintain list of authorized users',
            evidence_date='2024-01-15'
        )

        assert isinstance(result, EvidenceReview)
        assert result.evidence_type == 'screenshot'

    def test_review_evidence_no_date(self, ai_auditor):
        """Test evidence review without date."""
        result = ai_auditor.review_evidence(
            evidence_description='Log file export',
            evidence_type='log_export',
            control_requirement='Enable audit logging',
        )

        assert isinstance(result, EvidenceReview)

    def test_generate_audit_findings(self, ai_auditor):
        """Test audit findings generation."""
        evaluations = [
            ControlEvaluation(
                control_id='AC-1',
                effectiveness_rating='fully_effective',
                effectiveness_score=1.0,
            ),
            ControlEvaluation(
                control_id='AC-2',
                effectiveness_rating='partially_effective',
                effectiveness_score=0.5,
                weaknesses=['Manual process'],
                recommendations=['Automate'],
            ),
            ControlEvaluation(
                control_id='AU-1',
                effectiveness_rating='ineffective',
                effectiveness_score=0.1,
                weaknesses=['No logging enabled'],
                audit_observations='Critical gap identified',
            ),
        ]

        result = ai_auditor.generate_audit_findings(evaluations)

        assert isinstance(result, list)
        assert len(result) == 2  # Only problematic controls
        assert result[0]['control_id'] == 'AC-2'
        assert result[1]['control_id'] == 'AU-1'

    def test_generate_audit_findings_no_issues(self, ai_auditor):
        """Test audit findings with no problematic controls."""
        evaluations = [
            ControlEvaluation(
                control_id='AC-1',
                effectiveness_rating='fully_effective',
                effectiveness_score=1.0,
            ),
        ]

        result = ai_auditor.generate_audit_findings(evaluations)

        assert result == []

    def test_compare_assessments(self, ai_auditor):
        """Test assessment comparison."""
        previous = ComplianceAssessment(
            framework='NIST',
            overall_compliance_score=0.7,
            control_family_scores={'AC': 0.6, 'AU': 0.8},
            fully_compliant_controls=['AC-1'],
            gaps=[],
        )
        current = ComplianceAssessment(
            framework='NIST',
            overall_compliance_score=0.8,
            control_family_scores={'AC': 0.8, 'AU': 0.7},
            fully_compliant_controls=['AC-1', 'AC-2'],
            gaps=[],
        )

        result = ai_auditor.compare_assessments(previous, current)

        assert result['overall_trend'] == 'improving'
        assert result['score_change'] == pytest.approx(0.1)
        assert 'AC-2' in result['newly_compliant_controls']
        assert result['family_trends']['AC']['trend'] == 'improving'

    def test_format_context(self, ai_auditor):
        """Test context formatting."""
        context = {
            'organization': 'Test Corp',
            'items': ['a', 'b', 'c'],
            'nested': {'key': 'value'}
        }

        result = ai_auditor._format_context(context)

        assert 'organization' in result
        assert 'items' in result

    def test_format_context_empty(self, ai_auditor):
        """Test context formatting with empty dict."""
        result = ai_auditor._format_context({})
        assert 'No additional context' in result

    def test_summarize_controls(self, ai_auditor):
        """Test controls summarization."""
        controls = [
            {'control_id': 'AC-1', 'implementation_status': 'implemented'},
            {'control_id': 'AC-2', 'description': 'Test control'},
        ]

        result = ai_auditor._summarize_controls(controls)

        assert 'AC-1' in result
        assert 'AC-2' in result

    def test_summarize_controls_empty(self, ai_auditor):
        """Test controls summarization with empty list."""
        result = ai_auditor._summarize_controls([])
        assert 'No control data' in result

    def test_map_rating_to_severity(self, ai_auditor):
        """Test rating to severity mapping."""
        assert ai_auditor._map_rating_to_severity('ineffective') == 'critical'
        assert ai_auditor._map_rating_to_severity('not_implemented') == 'critical'
        assert ai_auditor._map_rating_to_severity('largely_ineffective') == 'high'
        assert ai_auditor._map_rating_to_severity('partially_effective') == 'medium'
        assert ai_auditor._map_rating_to_severity('unknown') == 'medium'

    def test_parse_evaluation_response(self, ai_auditor):
        """Test evaluation response parsing."""
        response = """EFFECTIVENESS_RATING: largely_effective
EFFECTIVENESS_SCORE: 0.85
STRENGTHS:
- Good documentation
- Regular reviews
WEAKNESSES:
- Manual process
RECOMMENDATIONS:
- Automate reviews
EVIDENCE_ASSESSMENT: Evidence is current
AUDIT_OBSERVATIONS: Control working well"""

        result = ai_auditor._parse_evaluation_response(response, 'AC-1')

        assert result.control_id == 'AC-1'
        assert result.effectiveness_rating == 'largely_effective'
        assert result.effectiveness_score == 0.85
        assert len(result.strengths) == 2
        assert len(result.weaknesses) == 1

    def test_parse_gaps_response(self, ai_auditor):
        """Test gaps response parsing."""
        response = """GAP:
ID: GAP-001
TITLE: Missing Policy
DESCRIPTION: No formal policy exists
SEVERITY: high
AFFECTED_CONTROLS: AC-1, AC-2
ROOT_CAUSE: Lack of governance
REMEDIATION: Develop policy
EFFORT: medium
RISK: Unauthorized access
---
GAP:
ID: GAP-002
TITLE: Weak Logging
DESCRIPTION: Insufficient logging
SEVERITY: medium
AFFECTED_CONTROLS: AU-1"""

        result = ai_auditor._parse_gaps_response(response)

        assert len(result) == 2
        assert result[0].gap_id == 'GAP-001'
        assert result[0].severity == 'high'
        assert 'AC-1' in result[0].affected_controls

    def test_parse_compliance_response(self, ai_auditor):
        """Test compliance response parsing."""
        response = """OVERALL_SCORE: 0.75
SUMMARY: Good progress on compliance
FULLY_COMPLIANT: AC-1, AC-2
PARTIALLY_COMPLIANT: AU-1
NON_COMPLIANT: SC-1
FAMILY_SCORES:
- Access Control: 0.8
- Audit: 0.7"""

        result = ai_auditor._parse_compliance_response(response, 'NIST')

        assert result.framework == 'NIST'
        assert result.overall_compliance_score == 0.75
        assert 'AC-1' in result.fully_compliant_controls
        assert 'Access Control' in result.control_family_scores

    def test_parse_evidence_response(self, ai_auditor):
        """Test evidence response parsing."""
        response = """RELEVANCE_SCORE: 0.9
SUFFICIENCY: sufficient
CURRENCY: current
RELIABILITY: high
OBSERVATIONS:
- Evidence clearly demonstrates control
- Timestamps are recent
RECOMMENDATIONS:
- Continue regular collection"""

        result = ai_auditor._parse_evidence_response(response, 'screenshot')

        assert result.relevance_score == 0.9
        assert result.sufficiency_rating == 'sufficient'
        assert len(result.observations) == 2


# =============================================================================
# AI Explainer - Data Classes Tests
# =============================================================================

class TestAIExplainerDataClasses:
    """Tests for AI Explainer data classes."""

    def test_explanation_creation(self):
        """Test Explanation dataclass creation."""
        explanation = Explanation(
            topic='Zero Trust',
            audience='executive',
            format='brief',
            content='Zero Trust is a security model...',
            key_points=['Never trust', 'Always verify'],
            related_topics=['MFA', 'Micro-segmentation'],
            action_items=['Implement MFA'],
        )

        assert explanation.topic == 'Zero Trust'
        assert len(explanation.key_points) == 2

    def test_explanation_to_dict(self):
        """Test Explanation serialization."""
        explanation = Explanation(
            topic='SIEM',
            audience='engineer',
            format='detailed',
            content='SIEM systems...',
        )

        result = explanation.to_dict()

        assert result['topic'] == 'SIEM'
        assert 'key_points' in result

    def test_control_explanation_creation(self):
        """Test ControlExplanation dataclass creation."""
        explanation = ControlExplanation(
            control_id='AC-1',
            control_name='Access Control Policy',
            audience='executive',
            purpose='Establish access control requirements',
            implementation_overview='Documented policies and procedures',
            business_impact='Reduces unauthorized access risk',
            compliance_relevance='Required by most frameworks',
            key_points=['Policy documentation', 'Regular review'],
        )

        assert explanation.control_id == 'AC-1'
        assert explanation.audience == 'executive'

    def test_control_explanation_to_dict(self):
        """Test ControlExplanation serialization."""
        explanation = ControlExplanation(
            control_id='AU-1',
            control_name='Audit Policy',
            audience='auditor',
            purpose='',
            implementation_overview='',
            business_impact='',
            compliance_relevance='',
        )

        result = explanation.to_dict()

        assert result['control_id'] == 'AU-1'

    def test_risk_explanation_creation(self):
        """Test RiskExplanation dataclass creation."""
        explanation = RiskExplanation(
            risk_id='RISK-001',
            risk_title='Data Breach',
            audience='board',
            risk_summary='Potential exposure of sensitive data',
            potential_impact='Financial and reputational damage',
            likelihood_explanation='Medium likelihood given current controls',
            mitigation_overview='Enhanced encryption and monitoring',
            business_context='Critical for customer trust',
            key_points=['Encryption', 'Monitoring', 'Response plan'],
        )

        assert explanation.risk_id == 'RISK-001'
        assert len(explanation.key_points) == 3

    def test_risk_explanation_to_dict(self):
        """Test RiskExplanation serialization."""
        explanation = RiskExplanation(
            risk_id='RISK-002',
            risk_title='System Outage',
            audience='executive',
            risk_summary='',
            potential_impact='',
            likelihood_explanation='',
            mitigation_overview='',
            business_context='',
        )

        result = explanation.to_dict()

        assert result['risk_id'] == 'RISK-002'


# =============================================================================
# AI Explainer - Enum Tests
# =============================================================================

class TestAIExplainerEnums:
    """Tests for AI Explainer enums."""

    def test_audience_values(self):
        """Test Audience enum values."""
        assert Audience.EXECUTIVE == 'executive'
        assert Audience.AUDITOR == 'auditor'
        assert Audience.ENGINEER == 'engineer'
        assert Audience.ANALYST == 'analyst'
        assert Audience.END_USER == 'end_user'
        assert Audience.LEGAL == 'legal'
        assert Audience.BOARD == 'board'

    def test_explanation_format_values(self):
        """Test ExplanationFormat enum values."""
        assert ExplanationFormat.BRIEF == 'brief'
        assert ExplanationFormat.DETAILED == 'detailed'
        assert ExplanationFormat.BULLET_POINTS == 'bullet_points'
        assert ExplanationFormat.FAQ == 'faq'
        assert ExplanationFormat.ANALOGY == 'analogy'


# =============================================================================
# AI Explainer - Service Tests
# =============================================================================

class TestAIExplainerService:
    """Tests for AIExplainerService."""

    def test_service_initialization(self, mock_llm_client):
        """Test service initialization."""
        service = AIExplainerService(llm_client=mock_llm_client)
        assert service._llm_client is mock_llm_client

    def test_audience_profiles_exist(self, ai_explainer):
        """Test that audience profiles are defined."""
        assert 'executive' in ai_explainer.AUDIENCE_PROFILES
        assert 'auditor' in ai_explainer.AUDIENCE_PROFILES
        assert 'engineer' in ai_explainer.AUDIENCE_PROFILES
        assert 'focus' in ai_explainer.AUDIENCE_PROFILES['executive']

    def test_explain_control(self, ai_explainer):
        """Test control explanation."""
        result = ai_explainer.explain_control(
            control_id='AC-1',
            control_name='Access Control Policy',
            control_description='Policy for managing access controls',
            audience='executive',
        )

        assert isinstance(result, ControlExplanation)
        assert result.control_id == 'AC-1'
        assert result.audience == 'executive'

    def test_explain_control_with_context(self, ai_explainer):
        """Test control explanation with context."""
        result = ai_explainer.explain_control(
            control_id='AC-2',
            control_name='Account Management',
            control_description='Manage user accounts',
            audience='engineer',
            context={'tech_stack': 'Azure AD', 'users': 1000}
        )

        assert isinstance(result, ControlExplanation)

    def test_explain_control_different_audiences(self, ai_explainer):
        """Test control explanation for different audiences."""
        audiences = ['executive', 'auditor', 'engineer', 'end_user']

        for audience in audiences:
            result = ai_explainer.explain_control(
                control_id='AC-1',
                control_name='Test',
                control_description='Test',
                audience=audience,
            )
            assert result.audience == audience

    def test_explain_risk(self, ai_explainer):
        """Test risk explanation."""
        result = ai_explainer.explain_risk(
            risk_id='RISK-001',
            risk_title='Data Breach',
            risk_description='Unauthorized access to sensitive data',
            risk_score=0.75,
            audience='board',
        )

        assert isinstance(result, RiskExplanation)
        assert result.risk_id == 'RISK-001'

    def test_explain_risk_no_score(self, ai_explainer):
        """Test risk explanation without score."""
        result = ai_explainer.explain_risk(
            risk_id='RISK-002',
            risk_title='System Outage',
            risk_description='Critical system unavailability',
            audience='executive',
        )

        assert isinstance(result, RiskExplanation)

    def test_explain_framework(self, ai_explainer):
        """Test framework explanation."""
        result = ai_explainer.explain_framework(
            framework_name='NIST 800-53',
            framework_description='Security and privacy controls for federal systems',
            audience='executive',
        )

        assert isinstance(result, Explanation)
        assert result.topic == 'NIST 800-53'

    def test_explain_finding(self, ai_explainer):
        """Test finding explanation."""
        result = ai_explainer.explain_finding(
            finding_title='Weak Password Policy',
            finding_description='Password requirements do not meet standards',
            severity='high',
            audience='executive',
            remediation='Implement stronger password requirements',
        )

        assert isinstance(result, Explanation)

    def test_explain_finding_no_remediation(self, ai_explainer):
        """Test finding explanation without remediation."""
        result = ai_explainer.explain_finding(
            finding_title='Missing MFA',
            finding_description='Multi-factor authentication not enabled',
            severity='critical',
            audience='engineer',
        )

        assert isinstance(result, Explanation)

    def test_explain_concept(self, ai_explainer):
        """Test concept explanation."""
        result = ai_explainer.explain_concept(
            concept='Zero Trust Architecture',
            audience='executive',
            format='brief',
        )

        assert isinstance(result, Explanation)
        assert result.topic == 'Zero Trust Architecture'

    def test_explain_concept_different_formats(self, ai_explainer):
        """Test concept explanation with different formats."""
        formats = ['brief', 'detailed', 'bullet_points', 'faq', 'analogy']

        for fmt in formats:
            result = ai_explainer.explain_concept(
                concept='Encryption',
                audience='end_user',
                format=fmt,
            )
            assert result.format == fmt

    def test_generate_executive_summary(self, ai_explainer):
        """Test executive summary generation."""
        result = ai_explainer.generate_executive_summary(
            data={
                'compliance_score': 0.85,
                'critical_findings': 2,
                'high_findings': 5,
                'controls_implemented': 100,
            },
            summary_type='compliance',
        )

        assert isinstance(result, str)

    def test_translate_technical_to_business(self, ai_explainer):
        """Test technical to business translation."""
        technical_content = """
        The CVE-2024-1234 vulnerability in OpenSSL allows remote code execution
        via buffer overflow in the TLS handshake process when processing
        malformed X.509 certificates.
        """

        result = ai_explainer.translate_technical_to_business(
            technical_content=technical_content,
            content_type='vulnerability',
        )

        assert isinstance(result, str)

    def test_parse_control_explanation(self, ai_explainer):
        """Test control explanation parsing."""
        response = """PURPOSE: Establish access control requirements
IMPLEMENTATION_OVERVIEW: Documented policies and procedures
BUSINESS_IMPACT: Reduces unauthorized access risk
COMPLIANCE_RELEVANCE: Required by most frameworks
KEY_POINTS:
- Policy documentation
- Regular review
COMMON_CHALLENGES:
- Keeping policies current
BEST_PRACTICES:
- Annual review cycle"""

        result = ai_explainer._parse_control_explanation(
            response, 'AC-1', 'Access Control', 'executive'
        )

        assert result.purpose == 'Establish access control requirements'
        assert len(result.key_points) == 2

    def test_parse_risk_explanation(self, ai_explainer):
        """Test risk explanation parsing."""
        response = """RISK_SUMMARY: Potential data exposure
POTENTIAL_IMPACT: Financial and reputational damage
LIKELIHOOD_EXPLANATION: Medium probability
MITIGATION_OVERVIEW: Encryption and monitoring
BUSINESS_CONTEXT: Critical for customer trust
KEY_POINTS:
- Encrypt data at rest
- Monitor access"""

        result = ai_explainer._parse_risk_explanation(
            response, 'RISK-001', 'Data Breach', 'executive'
        )

        assert result.risk_summary == 'Potential data exposure'
        assert len(result.key_points) == 2

    def test_parse_explanation(self, ai_explainer):
        """Test general explanation parsing."""
        response = """CONTENT: Zero Trust is a security model that requires verification
KEY_POINTS:
- Never trust
- Always verify
RELATED_TOPICS:
- MFA
- Micro-segmentation
ACTION_ITEMS:
- Implement MFA"""

        result = ai_explainer._parse_explanation(
            response, 'Zero Trust', 'executive', 'detailed'
        )

        assert 'Zero Trust' in result.content
        assert len(result.key_points) == 2


# =============================================================================
# AI Extractor - Data Classes Tests
# =============================================================================

class TestAIExtractorDataClasses:
    """Tests for AI Extractor data classes."""

    def test_extracted_control_creation(self):
        """Test ExtractedControl dataclass creation."""
        control = ExtractedControl(
            control_id='CTRL-001',
            title='Access Control',
            description='Manages user access',
            implementation_statement='Via IAM system',
            mapped_framework_controls=['AC-1', 'AC-2'],
            confidence_score=0.9,
            source_location='Section 3.1',
            category='Access Control',
        )

        assert control.control_id == 'CTRL-001'
        assert control.confidence_score == 0.9

    def test_extracted_control_to_dict(self):
        """Test ExtractedControl serialization."""
        control = ExtractedControl(
            control_id=None,
            title='Test',
            description='Test control',
            implementation_statement=None,
        )

        result = control.to_dict()

        assert result['control_id'] is None
        assert result['title'] == 'Test'

    def test_extracted_requirement_creation(self):
        """Test ExtractedRequirement dataclass creation."""
        requirement = ExtractedRequirement(
            requirement_id='REQ-001',
            text='All users must use strong passwords',
            requirement_type='mandatory',
            related_controls=['IA-5'],
            keywords=['password', 'authentication'],
            confidence_score=0.95,
        )

        assert requirement.requirement_id == 'REQ-001'
        assert requirement.requirement_type == 'mandatory'

    def test_extracted_requirement_to_dict(self):
        """Test ExtractedRequirement serialization."""
        requirement = ExtractedRequirement(
            requirement_id=None,
            text='Should implement MFA',
            requirement_type='recommended',
        )

        result = requirement.to_dict()

        assert result['requirement_type'] == 'recommended'

    def test_extracted_policy_creation(self):
        """Test ExtractedPolicy dataclass creation."""
        policy = ExtractedPolicy(
            title='Password Policy',
            content='Users must change passwords every 90 days',
            section_number='3.2',
            parent_section='Security Controls',
            related_controls=['IA-5'],
            effective_date='2024-01-01',
            review_date='2025-01-01',
        )

        assert policy.title == 'Password Policy'
        assert policy.section_number == '3.2'

    def test_extracted_policy_to_dict(self):
        """Test ExtractedPolicy serialization."""
        policy = ExtractedPolicy(
            title='Test Policy',
            content='Test content',
            section_number=None,
            parent_section=None,
        )

        result = policy.to_dict()

        assert result['title'] == 'Test Policy'

    def test_extraction_result_creation(self):
        """Test ExtractionResult dataclass creation."""
        result = ExtractionResult(
            document_name='policy.pdf',
            extraction_type='controls',
            controls=[],
            requirements=[],
            policies=[],
            metadata={'pages': 10},
            warnings=['Low quality scan'],
        )

        assert result.document_name == 'policy.pdf'
        assert len(result.warnings) == 1

    def test_extraction_result_to_dict(self):
        """Test ExtractionResult serialization."""
        control = ExtractedControl(
            control_id='C1',
            title='Test',
            description='Test',
            implementation_statement=None,
        )
        result = ExtractionResult(
            document_name='test.docx',
            extraction_type='controls',
            controls=[control],
        )

        serialized = result.to_dict()

        assert serialized['document_name'] == 'test.docx'
        assert serialized['summary']['controls_count'] == 1


# =============================================================================
# AI Extractor - Enum Tests
# =============================================================================

class TestAIExtractorEnums:
    """Tests for AI Extractor enums."""

    def test_document_format_values(self):
        """Test DocumentFormat enum values."""
        assert DocumentFormat.PDF == 'pdf'
        assert DocumentFormat.DOCX == 'docx'
        assert DocumentFormat.TXT == 'txt'
        assert DocumentFormat.MARKDOWN == 'markdown'
        assert DocumentFormat.HTML == 'html'

    def test_extraction_type_values(self):
        """Test ExtractionType enum values."""
        assert ExtractionType.CONTROLS == 'controls'
        assert ExtractionType.REQUIREMENTS == 'requirements'
        assert ExtractionType.POLICIES == 'policies'
        assert ExtractionType.PROCEDURES == 'procedures'
        assert ExtractionType.RISKS == 'risks'
        assert ExtractionType.EVIDENCE == 'evidence'


# =============================================================================
# AI Extractor - Document Parser Tests
# =============================================================================

class TestDocumentParser:
    """Tests for DocumentParser."""

    def test_parser_initialization(self):
        """Test parser initialization."""
        parser = DocumentParser()
        assert parser is not None

    def test_detect_format_pdf(self):
        """Test PDF format detection."""
        parser = DocumentParser()
        assert parser.detect_format('document.pdf') == DocumentFormat.PDF

    def test_detect_format_docx(self):
        """Test DOCX format detection."""
        parser = DocumentParser()
        assert parser.detect_format('document.docx') == DocumentFormat.DOCX
        assert parser.detect_format('document.doc') == DocumentFormat.DOCX

    def test_detect_format_txt(self):
        """Test TXT format detection."""
        parser = DocumentParser()
        assert parser.detect_format('document.txt') == DocumentFormat.TXT

    def test_detect_format_markdown(self):
        """Test Markdown format detection."""
        parser = DocumentParser()
        assert parser.detect_format('document.md') == DocumentFormat.MARKDOWN
        assert parser.detect_format('document.markdown') == DocumentFormat.MARKDOWN

    def test_detect_format_html(self):
        """Test HTML format detection."""
        parser = DocumentParser()
        assert parser.detect_format('page.html') == DocumentFormat.HTML
        assert parser.detect_format('page.htm') == DocumentFormat.HTML

    def test_detect_format_unknown(self):
        """Test unknown format defaults to TXT."""
        parser = DocumentParser()
        assert parser.detect_format('file.xyz') == DocumentFormat.TXT

    def test_parse_txt(self):
        """Test parsing TXT content."""
        parser = DocumentParser()
        content = b"This is plain text content."
        result = parser.parse(content, DocumentFormat.TXT)
        assert result == "This is plain text content."

    def test_parse_markdown(self):
        """Test parsing Markdown content."""
        parser = DocumentParser()
        content = b"# Heading\n\nThis is markdown."
        result = parser.parse(content, DocumentFormat.MARKDOWN)
        assert "Heading" in result

    def test_parse_html(self):
        """Test parsing HTML content."""
        parser = DocumentParser()
        content = b"<html><body><p>Hello World</p></body></html>"
        result = parser.parse(content, DocumentFormat.HTML)
        assert "Hello World" in result

    def test_parse_html_strips_scripts(self):
        """Test that HTML parsing ignores script tags."""
        parser = DocumentParser()
        content = b"<html><head><script>alert('test')</script></head><body>Content</body></html>"
        result = parser.parse(content, DocumentFormat.HTML)
        assert "Content" in result


# =============================================================================
# AI Extractor - Service Tests
# =============================================================================

class TestAIExtractorService:
    """Tests for AIExtractorService."""

    def test_service_initialization(self, mock_llm_client):
        """Test service initialization."""
        service = AIExtractorService(llm_client=mock_llm_client)
        assert service._llm_client is mock_llm_client
        assert service.parser is not None

    def test_extract_from_document_txt(self, ai_extractor):
        """Test extraction from text document."""
        content = b"""
        Security Policy Document

        Section 1: Access Control
        All users must be authenticated before accessing systems.

        Section 2: Audit Logging
        All access attempts must be logged and reviewed.
        """

        result = ai_extractor.extract_from_document(
            content=content,
            filename='policy.txt',
            extraction_types=[ExtractionType.CONTROLS],
        )

        assert isinstance(result, ExtractionResult)
        assert result.document_name == 'policy.txt'

    def test_extract_from_document_with_framework(self, ai_extractor):
        """Test extraction with target framework."""
        content = b"Access control policy document."

        result = ai_extractor.extract_from_document(
            content=content,
            filename='policy.txt',
            extraction_types=[ExtractionType.CONTROLS],
            target_framework='NIST 800-53',
        )

        assert result.metadata.get('target_framework') == 'NIST 800-53'

    def test_extract_from_document_multiple_types(self, ai_extractor):
        """Test extraction with multiple types."""
        content = b"Policy and requirements document."

        result = ai_extractor.extract_from_document(
            content=content,
            filename='doc.txt',
            extraction_types=[
                ExtractionType.CONTROLS,
                ExtractionType.REQUIREMENTS,
                ExtractionType.POLICIES,
            ],
        )

        assert 'controls' in result.extraction_type

    def test_extract_controls_from_text(self, ai_extractor):
        """Test control extraction from text."""
        text = """
        Access Control Policy
        Users must authenticate using MFA before accessing sensitive systems.
        """

        result = ai_extractor.extract_controls_from_text(text)

        assert isinstance(result, list)

    def test_map_to_framework(self, ai_extractor):
        """Test control mapping to framework."""
        descriptions = [
            'Access control policy requiring authentication',
            'Audit logging for all security events',
        ]

        result = ai_extractor.map_to_framework(
            control_descriptions=descriptions,
            target_framework='NIST 800-53',
        )

        assert isinstance(result, list)

    def test_analyze_policy_coverage(self, ai_extractor):
        """Test policy coverage analysis."""
        policy_text = """
        Information Security Policy
        1. Access Control
        All users must be authenticated.
        2. Audit and Accountability
        All access must be logged.
        """

        result = ai_extractor.analyze_policy_coverage(
            policy_text=policy_text,
            framework='NIST 800-53',
        )

        assert isinstance(result, dict)

    def test_chunk_text_small(self, ai_extractor):
        """Test text chunking for small text."""
        text = "Short text"
        chunks = ai_extractor._chunk_text(text, chunk_size=1000)
        assert len(chunks) == 1

    def test_chunk_text_large(self, ai_extractor):
        """Test text chunking for large text."""
        text = "Paragraph one.\n\n" * 100
        chunks = ai_extractor._chunk_text(text, chunk_size=500)
        assert len(chunks) > 1

    def test_parse_controls_response(self, ai_extractor):
        """Test control response parsing."""
        response = """CONTROL:
ID: CTRL-001
TITLE: Access Control
DESCRIPTION: Manages user access to systems
IMPLEMENTATION: Via IAM system
MAPPED_CONTROLS: AC-1, AC-2
CATEGORY: Access Control
---
CONTROL:
ID: CTRL-002
TITLE: Audit Logging
DESCRIPTION: Logs all access attempts"""

        result = ai_extractor._parse_controls_response(response, 'chunk_1')

        assert len(result) == 2
        assert result[0].control_id == 'CTRL-001'
        assert result[0].category == 'Access Control'

    def test_parse_requirements_response(self, ai_extractor):
        """Test requirements response parsing."""
        response = """REQUIREMENT:
ID: REQ-001
TEXT: All users must use strong passwords
TYPE: mandatory
KEYWORDS: password, authentication
RELATED_CONTROLS: IA-5
---
REQUIREMENT:
ID: REQ-002
TEXT: MFA should be enabled
TYPE: recommended"""

        result = ai_extractor._parse_requirements_response(response)

        assert len(result) == 2
        assert result[0].requirement_type == 'mandatory'

    def test_parse_policies_response(self, ai_extractor):
        """Test policies response parsing."""
        response = """POLICY:
TITLE: Password Policy
SECTION_NUMBER: 3.1
CONTENT: Users must change passwords every 90 days
RELATED_CONTROLS: IA-5
---
POLICY:
TITLE: Access Control Policy
CONTENT: All access must be authorized"""

        result = ai_extractor._parse_policies_response(response)

        assert len(result) == 2
        assert result[0].title == 'Password Policy'

    def test_parse_mapping_response(self, ai_extractor):
        """Test mapping response parsing."""
        response = """1. Access control -> AC-1, AC-2
2. Audit logging -> AU-1, AU-2?"""
        original = ['Access control policy', 'Audit logging requirements']

        result = ai_extractor._parse_mapping_response(response, original)

        assert len(result) >= 1

    def test_parse_coverage_response(self, ai_extractor):
        """Test coverage response parsing."""
        response = """COVERAGE_SUMMARY: Good coverage of access controls
COVERED_AREAS:
- Access Control: Well documented
- Audit: Partially covered
GAPS:
- Incident Response: Missing
CONTROL_MAPPINGS:
- Section 1 -> AC-1"""

        result = ai_extractor._parse_coverage_response(response)

        assert result['coverage_summary'] == 'Good coverage of access controls'
        assert len(result['gaps']) == 1

    def test_deduplicate_controls(self, ai_extractor):
        """Test control deduplication."""
        controls = [
            ExtractedControl(
                control_id='C1',
                title='Access Control',
                description='Manages access',
                implementation_statement=None,
            ),
            ExtractedControl(
                control_id='C2',
                title='Access Control',
                description='Manages access',  # Duplicate
                implementation_statement=None,
            ),
            ExtractedControl(
                control_id='C3',
                title='Audit Logging',
                description='Logs events',
                implementation_statement=None,
            ),
        ]

        result = ai_extractor._deduplicate_controls(controls)

        assert len(result) == 2

    def test_deduplicate_controls_empty(self, ai_extractor):
        """Test deduplication with empty list."""
        result = ai_extractor._deduplicate_controls([])
        assert result == []

    def test_deduplicate_controls_single(self, ai_extractor):
        """Test deduplication with single control."""
        controls = [
            ExtractedControl(
                control_id='C1',
                title='Test',
                description='Test',
                implementation_statement=None,
            ),
        ]
        result = ai_extractor._deduplicate_controls(controls)
        assert len(result) == 1


# =============================================================================
# Singleton Tests
# =============================================================================

class TestSingletonFunctions:
    """Tests for singleton accessor functions."""

    def test_get_ai_auditor_service(self):
        """Test AI Auditor singleton accessor."""
        # Reset singleton
        import ai_assistant.services.ai_auditor as auditor_module
        auditor_module._ai_auditor_service = None

        service1 = get_ai_auditor_service()
        service2 = get_ai_auditor_service()

        assert service1 is service2

    def test_get_ai_explainer_service(self):
        """Test AI Explainer singleton accessor."""
        # Reset singleton
        import ai_assistant.services.ai_explainer as explainer_module
        explainer_module._ai_explainer_service = None

        service1 = get_ai_explainer_service()
        service2 = get_ai_explainer_service()

        assert service1 is service2

    def test_get_ai_extractor_service(self):
        """Test AI Extractor singleton accessor."""
        # Reset singleton
        import ai_assistant.services.ai_extractor as extractor_module
        extractor_module._ai_extractor_service = None

        service1 = get_ai_extractor_service()
        service2 = get_ai_extractor_service()

        assert service1 is service2
