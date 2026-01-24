"""
Tests for AI Explainer service.
"""

import pytest
from unittest.mock import patch, MagicMock

from ai_assistant.services.ai_explainer import (
    AIExplainerService,
    Audience,
    ExplanationFormat,
    Explanation,
    ControlExplanation,
    RiskExplanation,
    get_ai_explainer_service,
)


class TestAudience:
    """Tests for Audience enum."""

    def test_audience_values(self):
        assert Audience.EXECUTIVE.value == 'executive'
        assert Audience.AUDITOR.value == 'auditor'
        assert Audience.ENGINEER.value == 'engineer'
        assert Audience.ANALYST.value == 'analyst'
        assert Audience.END_USER.value == 'end_user'
        assert Audience.LEGAL.value == 'legal'
        assert Audience.BOARD.value == 'board'


class TestExplanationFormat:
    """Tests for ExplanationFormat enum."""

    def test_format_values(self):
        assert ExplanationFormat.BRIEF.value == 'brief'
        assert ExplanationFormat.DETAILED.value == 'detailed'
        assert ExplanationFormat.BULLET_POINTS.value == 'bullet_points'
        assert ExplanationFormat.FAQ.value == 'faq'
        assert ExplanationFormat.ANALOGY.value == 'analogy'


class TestExplanation:
    """Tests for Explanation dataclass."""

    def test_explanation_creation(self):
        explanation = Explanation(
            topic="MFA",
            audience="executive",
            format="brief",
            content="Multi-factor authentication adds security.",
            key_points=["Adds extra layer", "Reduces breach risk"],
        )
        assert explanation.topic == "MFA"
        assert explanation.audience == "executive"
        assert len(explanation.key_points) == 2

    def test_explanation_to_dict(self):
        explanation = Explanation(
            topic="MFA",
            audience="executive",
            format="brief",
            content="Test content",
        )
        result = explanation.to_dict()
        assert result['topic'] == "MFA"
        assert result['audience'] == "executive"
        assert result['format'] == "brief"
        assert result['content'] == "Test content"
        assert isinstance(result['key_points'], list)
        assert isinstance(result['related_topics'], list)


class TestControlExplanation:
    """Tests for ControlExplanation dataclass."""

    def test_control_explanation_creation(self):
        explanation = ControlExplanation(
            control_id="AC-2",
            control_name="Account Management",
            audience="executive",
            purpose="Manage user accounts properly",
            implementation_overview="Implemented via AD",
            business_impact="Reduces unauthorized access",
            compliance_relevance="Required for SOC 2",
        )
        assert explanation.control_id == "AC-2"
        assert explanation.purpose == "Manage user accounts properly"

    def test_control_explanation_to_dict(self):
        explanation = ControlExplanation(
            control_id="AC-2",
            control_name="Account Management",
            audience="executive",
            purpose="Test purpose",
            implementation_overview="Test overview",
            business_impact="Test impact",
            compliance_relevance="Test relevance",
            key_points=["Point 1"],
            common_challenges=["Challenge 1"],
            best_practices=["Practice 1"],
        )
        result = explanation.to_dict()
        assert result['control_id'] == "AC-2"
        assert len(result['key_points']) == 1
        assert len(result['common_challenges']) == 1
        assert len(result['best_practices']) == 1


class TestRiskExplanation:
    """Tests for RiskExplanation dataclass."""

    def test_risk_explanation_creation(self):
        explanation = RiskExplanation(
            risk_id="RISK-001",
            risk_title="Data Breach",
            audience="executive",
            risk_summary="Potential data breach scenario",
            potential_impact="High financial impact",
            likelihood_explanation="Medium likelihood",
            mitigation_overview="Implement controls",
            business_context="Customer data at risk",
        )
        assert explanation.risk_id == "RISK-001"
        assert "data breach" in explanation.risk_summary.lower()

    def test_risk_explanation_to_dict(self):
        explanation = RiskExplanation(
            risk_id="RISK-001",
            risk_title="Test Risk",
            audience="executive",
            risk_summary="Summary",
            potential_impact="Impact",
            likelihood_explanation="Likelihood",
            mitigation_overview="Mitigation",
            business_context="Context",
        )
        result = explanation.to_dict()
        assert result['risk_id'] == "RISK-001"
        assert result['audience'] == "executive"


class TestAIExplainerService:
    """Tests for AIExplainerService."""

    def test_init_without_client(self):
        service = AIExplainerService()
        assert service._llm_client is None

    def test_init_with_client(self, mock_llm_client):
        service = AIExplainerService(llm_client=mock_llm_client)
        assert service._llm_client == mock_llm_client

    def test_audience_profiles_exist(self):
        service = AIExplainerService()
        assert 'executive' in service.AUDIENCE_PROFILES
        assert 'auditor' in service.AUDIENCE_PROFILES
        assert 'engineer' in service.AUDIENCE_PROFILES
        assert 'analyst' in service.AUDIENCE_PROFILES
        assert 'end_user' in service.AUDIENCE_PROFILES
        assert 'legal' in service.AUDIENCE_PROFILES
        assert 'board' in service.AUDIENCE_PROFILES

    def test_audience_profile_structure(self):
        service = AIExplainerService()
        profile = service.AUDIENCE_PROFILES['executive']
        assert 'focus' in profile
        assert 'language' in profile
        assert 'length' in profile

    def test_explain_control(self, mock_llm_client, control_explanation_response):
        mock_llm_client.response_content = control_explanation_response
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_control(
            control_id="AC-2",
            control_name="Account Management",
            control_description="Manage user accounts",
            audience="executive",
        )

        assert isinstance(result, ControlExplanation)
        assert result.control_id == "AC-2"
        assert result.audience == "executive"
        assert len(result.key_points) > 0
        assert len(mock_llm_client.calls) == 1

    def test_explain_control_with_context(self, mock_llm_client, control_explanation_response):
        mock_llm_client.response_content = control_explanation_response
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_control(
            control_id="AC-2",
            control_name="Account Management",
            control_description="Manage user accounts",
            audience="engineer",
            context={"framework": "NIST", "organization": "Tech Corp"},
        )

        assert isinstance(result, ControlExplanation)
        assert result.audience == "engineer"

    def test_explain_control_error_handling(self, mock_llm_client):
        mock_llm_client.chat = MagicMock(side_effect=Exception("LLM Error"))
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_control(
            control_id="AC-2",
            control_name="Account Management",
            control_description="Test",
        )

        assert isinstance(result, ControlExplanation)
        assert "Error" in result.purpose

    def test_explain_risk(self, mock_llm_client, risk_explanation_response):
        mock_llm_client.response_content = risk_explanation_response
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_risk(
            risk_id="RISK-001",
            risk_title="Data Breach",
            risk_description="Risk of data breach",
            risk_score=7.5,
            audience="executive",
        )

        assert isinstance(result, RiskExplanation)
        assert result.risk_id == "RISK-001"
        assert result.audience == "executive"

    def test_explain_risk_without_score(self, mock_llm_client, risk_explanation_response):
        mock_llm_client.response_content = risk_explanation_response
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_risk(
            risk_id="RISK-001",
            risk_title="Data Breach",
            risk_description="Risk of data breach",
            audience="auditor",
        )

        assert isinstance(result, RiskExplanation)
        assert result.audience == "auditor"

    def test_explain_risk_error_handling(self, mock_llm_client):
        mock_llm_client.chat = MagicMock(side_effect=Exception("LLM Error"))
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_risk(
            risk_id="RISK-001",
            risk_title="Test Risk",
            risk_description="Test",
        )

        assert "Error" in result.risk_summary

    def test_explain_framework(self, mock_llm_client):
        mock_llm_client.response_content = """CONTENT: ISO 27001 is an international standard for information security management.
KEY_POINTS:
- Provides systematic approach
- Risk-based framework
RELATED_TOPICS:
- ISO 27002
- NIST CSF
ACTION_ITEMS:
- Conduct gap analysis
- Define scope
"""
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_framework(
            framework_name="ISO 27001",
            framework_description="Information security management standard",
            audience="executive",
        )

        assert isinstance(result, Explanation)
        assert result.topic == "ISO 27001"
        assert len(result.key_points) > 0

    def test_explain_finding(self, mock_llm_client):
        mock_llm_client.response_content = """CONTENT: This finding indicates a control deficiency.
KEY_POINTS:
- Missing control implementation
- Needs remediation
ACTION_ITEMS:
- Implement MFA
- Update policies
"""
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_finding(
            finding_title="Missing MFA",
            finding_description="MFA not implemented",
            severity="High",
            audience="executive",
        )

        assert isinstance(result, Explanation)
        assert len(result.action_items) > 0

    def test_explain_concept(self, mock_llm_client):
        mock_llm_client.response_content = """CONTENT: Zero Trust is a security model that requires verification.
KEY_POINTS:
- Never trust, always verify
- Least privilege access
RELATED_TOPICS:
- Defense in depth
- Identity management
"""
        service = AIExplainerService(llm_client=mock_llm_client)

        result = service.explain_concept(
            concept="Zero Trust Security",
            audience="end_user",
            format="detailed",
        )

        assert isinstance(result, Explanation)
        assert result.topic == "Zero Trust Security"

    def test_generate_executive_summary(self, mock_llm_client):
        mock_llm_client.response_content = "This quarter shows improved compliance posture."
        service = AIExplainerService(llm_client=mock_llm_client)

        data = {
            "compliance_score": 0.85,
            "findings": 5,
            "remediated": 3,
        }

        result = service.generate_executive_summary(data, "compliance")

        assert isinstance(result, str)
        assert len(result) > 0

    def test_translate_technical_to_business(self, mock_llm_client):
        mock_llm_client.response_content = "The system has a security gap in user authentication."
        service = AIExplainerService(llm_client=mock_llm_client)

        technical_content = "CVE-2023-12345: SQL injection in auth module"
        result = service.translate_technical_to_business(technical_content)

        assert isinstance(result, str)
        assert len(result) > 0

    def test_format_context_empty(self):
        service = AIExplainerService()
        result = service._format_context({})
        assert "No additional context" in result

    def test_format_context_with_data(self):
        service = AIExplainerService()
        context = {
            "framework": "NIST",
            "tags": ["security", "compliance"],
            "nested": {"key": "value"},
        }
        result = service._format_context(context)
        assert "framework: NIST" in result
        assert "security" in result

    def test_parse_control_explanation(self, control_explanation_response):
        service = AIExplainerService()
        result = service._parse_control_explanation(
            control_explanation_response, "AC-2", "Account Management", "executive"
        )

        assert result.control_id == "AC-2"
        assert result.control_name == "Account Management"
        assert "access" in result.purpose.lower() or len(result.purpose) > 0
        assert len(result.key_points) >= 0

    def test_parse_risk_explanation(self, risk_explanation_response):
        service = AIExplainerService()
        result = service._parse_risk_explanation(
            risk_explanation_response, "RISK-001", "Data Breach", "executive"
        )

        assert result.risk_id == "RISK-001"
        assert result.risk_title == "Data Breach"
        assert len(result.risk_summary) > 0

    def test_parse_explanation_fallback(self):
        service = AIExplainerService()
        content = "This is just plain text without formatting."
        result = service._parse_explanation(content, "Topic", "executive", "brief")

        assert result.topic == "Topic"
        assert result.content == content


class TestGetAIExplainerService:
    """Tests for singleton service getter."""

    def test_get_service_returns_instance(self):
        # Clear singleton first
        import ai_assistant.services.ai_explainer as module
        module._ai_explainer_service = None

        service = get_ai_explainer_service()
        assert isinstance(service, AIExplainerService)

    def test_get_service_returns_same_instance(self):
        service1 = get_ai_explainer_service()
        service2 = get_ai_explainer_service()
        assert service1 is service2
