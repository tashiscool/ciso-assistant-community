"""
Tests for AI Auditor service.
"""

import pytest
from unittest.mock import patch, MagicMock

from ai_assistant.services.ai_auditor import (
    AIAuditorService,
    EffectivenessRating,
    GapSeverity,
    ControlEvaluation,
    GapFinding,
    ComplianceAssessment,
    EvidenceReview,
    get_ai_auditor_service,
)


class TestEffectivenessRating:
    """Tests for EffectivenessRating enum."""

    def test_rating_values(self):
        assert EffectivenessRating.FULLY_EFFECTIVE.value == 'fully_effective'
        assert EffectivenessRating.LARGELY_EFFECTIVE.value == 'largely_effective'
        assert EffectivenessRating.PARTIALLY_EFFECTIVE.value == 'partially_effective'
        assert EffectivenessRating.LARGELY_INEFFECTIVE.value == 'largely_ineffective'
        assert EffectivenessRating.INEFFECTIVE.value == 'ineffective'
        assert EffectivenessRating.NOT_IMPLEMENTED.value == 'not_implemented'


class TestGapSeverity:
    """Tests for GapSeverity enum."""

    def test_severity_values(self):
        assert GapSeverity.CRITICAL.value == 'critical'
        assert GapSeverity.HIGH.value == 'high'
        assert GapSeverity.MEDIUM.value == 'medium'
        assert GapSeverity.LOW.value == 'low'
        assert GapSeverity.INFORMATIONAL.value == 'informational'


class TestControlEvaluation:
    """Tests for ControlEvaluation dataclass."""

    def test_evaluation_creation(self):
        evaluation = ControlEvaluation(
            control_id="AC-2",
            effectiveness_rating="largely_effective",
            effectiveness_score=0.75,
            strengths=["Good policies", "Regular reviews"],
            weaknesses=["Manual processes"],
            recommendations=["Automate provisioning"],
        )
        assert evaluation.control_id == "AC-2"
        assert evaluation.effectiveness_score == 0.75
        assert len(evaluation.strengths) == 2

    def test_evaluation_to_dict(self):
        evaluation = ControlEvaluation(
            control_id="AC-2",
            effectiveness_rating="largely_effective",
            effectiveness_score=0.75,
        )
        result = evaluation.to_dict()
        assert result['control_id'] == "AC-2"
        assert result['effectiveness_score'] == 0.75
        assert isinstance(result['strengths'], list)


class TestGapFinding:
    """Tests for GapFinding dataclass."""

    def test_gap_creation(self):
        gap = GapFinding(
            gap_id="GAP-001",
            title="Missing MFA",
            description="Multi-factor auth not implemented",
            severity="high",
            affected_controls=["AC-2", "IA-2"],
            root_cause="Legacy system",
            remediation_recommendation="Deploy MFA solution",
        )
        assert gap.gap_id == "GAP-001"
        assert gap.severity == "high"
        assert len(gap.affected_controls) == 2

    def test_gap_to_dict(self):
        gap = GapFinding(
            gap_id="GAP-001",
            title="Test Gap",
            description="Test description",
            severity="medium",
        )
        result = gap.to_dict()
        assert result['gap_id'] == "GAP-001"
        assert result['severity'] == "medium"
        assert isinstance(result['affected_controls'], list)


class TestComplianceAssessment:
    """Tests for ComplianceAssessment dataclass."""

    def test_assessment_creation(self):
        assessment = ComplianceAssessment(
            framework="NIST 800-53",
            overall_compliance_score=0.72,
            control_family_scores={"AC": 0.80, "AU": 0.65},
            fully_compliant_controls=["AC-1", "AC-3"],
            partially_compliant_controls=["AC-2"],
            non_compliant_controls=["IA-8"],
        )
        assert assessment.framework == "NIST 800-53"
        assert assessment.overall_compliance_score == 0.72
        assert len(assessment.control_family_scores) == 2

    def test_assessment_to_dict(self):
        gap = GapFinding(
            gap_id="GAP-001",
            title="Test",
            description="Test",
            severity="medium",
        )
        assessment = ComplianceAssessment(
            framework="NIST",
            overall_compliance_score=0.75,
            gaps=[gap],
        )
        result = assessment.to_dict()
        assert result['framework'] == "NIST"
        assert len(result['gaps']) == 1
        assert isinstance(result['gaps'][0], dict)


class TestEvidenceReview:
    """Tests for EvidenceReview dataclass."""

    def test_review_creation(self):
        review = EvidenceReview(
            evidence_id="EVD-001",
            evidence_type="screenshot",
            relevance_score=0.85,
            sufficiency_rating="sufficient",
            currency_assessment="current",
            reliability_assessment="high",
        )
        assert review.evidence_id == "EVD-001"
        assert review.relevance_score == 0.85

    def test_review_to_dict(self):
        review = EvidenceReview(
            evidence_id="EVD-001",
            evidence_type="document",
            relevance_score=0.9,
            sufficiency_rating="sufficient",
            currency_assessment="current",
            reliability_assessment="high",
            observations=["Clear documentation"],
        )
        result = review.to_dict()
        assert result['evidence_id'] == "EVD-001"
        assert len(result['observations']) == 1


class TestAIAuditorService:
    """Tests for AIAuditorService."""

    def test_init_without_client(self):
        service = AIAuditorService()
        assert service._llm_client is None

    def test_init_with_client(self, mock_llm_client):
        service = AIAuditorService(llm_client=mock_llm_client)
        assert service._llm_client == mock_llm_client

    def test_evaluate_control_effectiveness(self, mock_llm_client, evaluation_response):
        mock_llm_client.response_content = evaluation_response
        service = AIAuditorService(llm_client=mock_llm_client)

        result = service.evaluate_control_effectiveness(
            control_id="AC-2",
            control_description="Account management control",
            requirement_text="Manage user accounts properly",
            implementation_statement="AD-based account management",
            evidence_summary="Access review reports, AD configs",
        )

        assert isinstance(result, ControlEvaluation)
        assert result.control_id == "AC-2"
        assert result.effectiveness_rating == "largely_effective"
        assert result.effectiveness_score == 0.75

    def test_evaluate_control_minimal_input(self, mock_llm_client, evaluation_response):
        mock_llm_client.response_content = evaluation_response
        service = AIAuditorService(llm_client=mock_llm_client)

        result = service.evaluate_control_effectiveness(
            control_id="AC-2",
            control_description="Account management",
            requirement_text="Manage accounts",
        )

        assert isinstance(result, ControlEvaluation)
        assert result.control_id == "AC-2"

    def test_evaluate_control_error_handling(self, mock_llm_client):
        mock_llm_client.chat = MagicMock(side_effect=Exception("LLM Error"))
        service = AIAuditorService(llm_client=mock_llm_client)

        result = service.evaluate_control_effectiveness(
            control_id="AC-2",
            control_description="Test",
            requirement_text="Test requirement",
        )

        assert result.effectiveness_rating == "not_implemented"
        assert result.effectiveness_score == 0.0
        assert "Error" in result.audit_observations

    def test_perform_gap_analysis(self, mock_llm_client, gap_analysis_response):
        mock_llm_client.response_content = gap_analysis_response
        service = AIAuditorService(llm_client=mock_llm_client)

        current_state = {
            "access_control": "Basic AD authentication",
            "logging": "Partial logging enabled",
        }

        result = service.perform_gap_analysis(
            current_state=current_state,
            target_framework="NIST 800-53",
        )

        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0].gap_id == "GAP-001"
        assert result[0].severity == "high"

    def test_gap_analysis_with_requirements(self, mock_llm_client, gap_analysis_response):
        mock_llm_client.response_content = gap_analysis_response
        service = AIAuditorService(llm_client=mock_llm_client)

        requirements = [
            {"control_id": "AC-2", "description": "Account Management"},
            {"control_id": "IA-2", "description": "Identification and Authentication"},
        ]

        result = service.perform_gap_analysis(
            current_state={"access_control": "Basic"},
            target_framework="NIST",
            control_requirements=requirements,
        )

        assert isinstance(result, list)

    def test_gap_analysis_error_handling(self, mock_llm_client):
        mock_llm_client.chat = MagicMock(side_effect=Exception("LLM Error"))
        service = AIAuditorService(llm_client=mock_llm_client)

        result = service.perform_gap_analysis(
            current_state={},
            target_framework="NIST",
        )

        assert len(result) == 1
        assert result[0].gap_id == "GAP-ERROR"

    def test_assess_compliance(self, mock_llm_client, compliance_assessment_response):
        mock_llm_client.response_content = compliance_assessment_response
        service = AIAuditorService(llm_client=mock_llm_client)

        controls_data = [
            {"control_id": "AC-1", "implementation_status": "implemented"},
            {"control_id": "AC-2", "implementation_status": "partial"},
        ]

        result = service.assess_compliance(
            framework="NIST 800-53",
            controls_data=controls_data,
        )

        assert isinstance(result, ComplianceAssessment)
        assert result.framework == "NIST 800-53"
        assert result.overall_compliance_score == 0.72

    def test_assess_compliance_error_handling(self, mock_llm_client):
        mock_llm_client.chat = MagicMock(side_effect=Exception("LLM Error"))
        service = AIAuditorService(llm_client=mock_llm_client)

        result = service.assess_compliance(
            framework="NIST",
            controls_data=[],
        )

        assert result.overall_compliance_score == 0.0
        assert "Error" in result.summary

    def test_review_evidence(self, mock_llm_client, evidence_review_response):
        mock_llm_client.response_content = evidence_review_response
        service = AIAuditorService(llm_client=mock_llm_client)

        result = service.review_evidence(
            evidence_description="Screenshot of AD configuration",
            evidence_type="screenshot",
            control_requirement="Configure account lockout policies",
            evidence_date="2024-01-15",
        )

        assert isinstance(result, EvidenceReview)
        assert result.evidence_type == "screenshot"
        assert result.relevance_score == 0.85
        assert result.sufficiency_rating == "sufficient"

    def test_review_evidence_error_handling(self, mock_llm_client):
        mock_llm_client.chat = MagicMock(side_effect=Exception("LLM Error"))
        service = AIAuditorService(llm_client=mock_llm_client)

        result = service.review_evidence(
            evidence_description="Test",
            evidence_type="document",
            control_requirement="Test requirement",
        )

        assert result.relevance_score == 0.0
        assert result.sufficiency_rating == "insufficient"

    def test_generate_audit_findings(self):
        service = AIAuditorService()

        evaluations = [
            ControlEvaluation(
                control_id="AC-1",
                effectiveness_rating="fully_effective",
                effectiveness_score=0.95,
            ),
            ControlEvaluation(
                control_id="AC-2",
                effectiveness_rating="partially_effective",
                effectiveness_score=0.55,
                weaknesses=["Manual processes", "No automation"],
                recommendations=["Implement automation"],
                audit_observations="Control needs improvement",
            ),
            ControlEvaluation(
                control_id="IA-2",
                effectiveness_rating="ineffective",
                effectiveness_score=0.20,
                weaknesses=["MFA not implemented"],
                recommendations=["Deploy MFA"],
            ),
        ]

        result = service.generate_audit_findings(evaluations)

        assert isinstance(result, list)
        assert len(result) == 2  # Only 2 controls have issues
        assert result[0]['control_id'] == "AC-2"
        assert result[1]['control_id'] == "IA-2"
        assert result[1]['severity'] == "critical"  # ineffective maps to critical

    def test_generate_audit_findings_no_issues(self):
        service = AIAuditorService()

        evaluations = [
            ControlEvaluation(
                control_id="AC-1",
                effectiveness_rating="fully_effective",
                effectiveness_score=0.95,
            ),
            ControlEvaluation(
                control_id="AC-2",
                effectiveness_rating="largely_effective",
                effectiveness_score=0.80,
            ),
        ]

        result = service.generate_audit_findings(evaluations)
        assert len(result) == 0

    def test_compare_assessments(self):
        service = AIAuditorService()

        previous = ComplianceAssessment(
            framework="NIST",
            overall_compliance_score=0.65,
            control_family_scores={"AC": 0.70, "AU": 0.60},
            fully_compliant_controls=["AC-1"],
            gaps=[],
        )

        current = ComplianceAssessment(
            framework="NIST",
            overall_compliance_score=0.75,
            control_family_scores={"AC": 0.80, "AU": 0.65},
            fully_compliant_controls=["AC-1", "AC-2"],
            gaps=[],
        )

        result = service.compare_assessments(previous, current)

        assert result['overall_trend'] == "improving"
        assert abs(result['score_change'] - 0.10) < 0.01  # Handle floating point
        assert "AC-2" in result['newly_compliant_controls']
        assert result['family_trends']['AC']['trend'] == "improving"

    def test_compare_assessments_declining(self):
        service = AIAuditorService()

        previous = ComplianceAssessment(
            framework="NIST",
            overall_compliance_score=0.80,
            fully_compliant_controls=["AC-1", "AC-2"],
            gaps=[],
        )

        current = ComplianceAssessment(
            framework="NIST",
            overall_compliance_score=0.70,
            fully_compliant_controls=["AC-1"],
            gaps=[GapFinding(gap_id="GAP-001", title="Test", description="Test", severity="medium")],
        )

        result = service.compare_assessments(previous, current)

        assert result['overall_trend'] == "declining"
        assert "AC-2" in result['newly_non_compliant_controls']
        assert result['gap_count_change'] == 1

    def test_format_context(self):
        service = AIAuditorService()
        context = {"key1": "value1", "key2": ["a", "b"]}
        result = service._format_context(context)
        assert "key1: value1" in result
        assert "a, b" in result

    def test_format_context_empty(self):
        service = AIAuditorService()
        result = service._format_context({})
        assert "No additional context" in result

    def test_summarize_controls(self):
        service = AIAuditorService()
        controls = [
            {"control_id": "AC-1", "implementation_status": "implemented", "description": "Test control"},
        ]
        result = service._summarize_controls(controls)
        assert "AC-1" in result
        assert "implemented" in result

    def test_summarize_controls_empty(self):
        service = AIAuditorService()
        result = service._summarize_controls([])
        assert "No control data" in result

    def test_parse_evaluation_response(self, evaluation_response):
        service = AIAuditorService()
        result = service._parse_evaluation_response(evaluation_response, "AC-2")

        assert result.control_id == "AC-2"
        assert result.effectiveness_rating == "largely_effective"
        assert result.effectiveness_score == 0.75
        assert len(result.strengths) >= 1
        assert len(result.weaknesses) >= 1

    def test_parse_gaps_response(self, gap_analysis_response):
        service = AIAuditorService()
        result = service._parse_gaps_response(gap_analysis_response)

        assert len(result) == 2
        assert result[0].gap_id == "GAP-001"
        assert result[0].severity == "high"
        assert "AC-1" in result[0].affected_controls

    def test_parse_compliance_response(self, compliance_assessment_response):
        service = AIAuditorService()
        result = service._parse_compliance_response(compliance_assessment_response, "NIST")

        assert result.framework == "NIST"
        assert result.overall_compliance_score == 0.72
        assert "AC-1" in result.fully_compliant_controls

    def test_parse_evidence_response(self, evidence_review_response):
        service = AIAuditorService()
        result = service._parse_evidence_response(evidence_review_response, "screenshot")

        assert result.evidence_type == "screenshot"
        assert result.relevance_score == 0.85
        assert result.sufficiency_rating == "sufficient"

    def test_map_rating_to_severity(self):
        service = AIAuditorService()
        assert service._map_rating_to_severity("ineffective") == "critical"
        assert service._map_rating_to_severity("not_implemented") == "critical"
        assert service._map_rating_to_severity("largely_ineffective") == "high"
        assert service._map_rating_to_severity("partially_effective") == "medium"
        assert service._map_rating_to_severity("largely_effective") == "low"
        assert service._map_rating_to_severity("fully_effective") == "informational"
        assert service._map_rating_to_severity("unknown") == "medium"


class TestGetAIAuditorService:
    """Tests for singleton service getter."""

    def test_get_service_returns_instance(self):
        import ai_assistant.services.ai_auditor as module
        module._ai_auditor_service = None

        service = get_ai_auditor_service()
        assert isinstance(service, AIAuditorService)

    def test_get_service_returns_same_instance(self):
        service1 = get_ai_auditor_service()
        service2 = get_ai_auditor_service()
        assert service1 is service2
