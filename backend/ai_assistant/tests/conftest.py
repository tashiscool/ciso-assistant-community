"""
Pytest fixtures for AI Assistant tests.
"""

import pytest
from unittest.mock import Mock, MagicMock, AsyncMock
from dataclasses import dataclass


@dataclass
class MockLLMResponse:
    """Mock LLM response."""
    content: str


class MockLLMClient:
    """Mock LLM client for testing."""

    def __init__(self, response_content: str = ""):
        self.response_content = response_content
        self.calls = []

    def chat(self, messages, temperature=0.4):
        self.calls.append({
            "messages": messages,
            "temperature": temperature,
        })
        return MockLLMResponse(content=self.response_content)

    async def achat(self, messages, temperature=0.4):
        return self.chat(messages, temperature)


@pytest.fixture
def mock_llm_client():
    """Create a mock LLM client."""
    return MockLLMClient()


@pytest.fixture
def control_explanation_response():
    """Sample control explanation response from LLM."""
    return """PURPOSE: This control ensures that access to sensitive systems is properly managed.
IMPLEMENTATION_OVERVIEW: Access controls are implemented through identity management systems.
BUSINESS_IMPACT: Prevents unauthorized access and reduces risk of data breaches.
COMPLIANCE_RELEVANCE: Required by SOC 2, ISO 27001, and NIST frameworks.
KEY_POINTS:
- Identity verification before access
- Regular access reviews
- Principle of least privilege
COMMON_CHALLENGES:
- Orphaned accounts
- Excessive permissions
BEST_PRACTICES:
- Automated provisioning/deprovisioning
- Role-based access control
"""


@pytest.fixture
def risk_explanation_response():
    """Sample risk explanation response from LLM."""
    return """RISK_SUMMARY: Unauthorized access to customer data could lead to significant data breach.
POTENTIAL_IMPACT: Financial losses, regulatory fines, and reputational damage.
LIKELIHOOD_EXPLANATION: Medium likelihood due to current control gaps.
MITIGATION_OVERVIEW: Implement stronger access controls and monitoring.
BUSINESS_CONTEXT: Directly impacts customer trust and regulatory compliance.
KEY_POINTS:
- Data breach could affect 100K+ customers
- GDPR fines could be substantial
- Competitor advantage lost
"""


@pytest.fixture
def evaluation_response():
    """Sample control evaluation response from LLM."""
    return """EFFECTIVENESS_RATING: largely_effective
EFFECTIVENESS_SCORE: 0.75
STRENGTHS:
- Strong authentication mechanisms
- Regular access reviews conducted
WEAKNESSES:
- No automated deprovisioning
- Some orphaned accounts exist
RECOMMENDATIONS:
- Implement automated account lifecycle management
- Deploy privileged access management solution
EVIDENCE_ASSESSMENT: Evidence demonstrates control is operational with minor gaps.
AUDIT_OBSERVATIONS: Control is largely meeting requirements but has room for improvement.
"""


@pytest.fixture
def gap_analysis_response():
    """Sample gap analysis response from LLM."""
    return """GAP:
ID: GAP-001
TITLE: Missing Multi-Factor Authentication
DESCRIPTION: MFA is not enforced for all privileged accounts.
SEVERITY: high
AFFECTED_CONTROLS: AC-1, AC-2, IA-2
ROOT_CAUSE: Legacy system limitations
REMEDIATION: Deploy MFA solution for all privileged access
EFFORT: medium
RISK: Increased risk of credential-based attacks
---
GAP:
ID: GAP-002
TITLE: Incomplete Logging
DESCRIPTION: Security events are not comprehensively logged.
SEVERITY: medium
AFFECTED_CONTROLS: AU-2, AU-3, AU-6
ROOT_CAUSE: Logging infrastructure gaps
REMEDIATION: Expand logging to cover all critical events
EFFORT: low
RISK: Inability to detect and investigate security incidents
"""


@pytest.fixture
def compliance_assessment_response():
    """Sample compliance assessment response from LLM."""
    return """OVERALL_SCORE: 0.72
SUMMARY: Organization demonstrates good compliance posture with some gaps in access management.
FULLY_COMPLIANT: AC-1, AC-3, AU-1, AU-2
PARTIALLY_COMPLIANT: AC-2, IA-2, IA-5
NON_COMPLIANT: IA-8, SC-8
FAMILY_SCORES:
- Access Control: 0.80
- Audit and Accountability: 0.75
- Identification and Authentication: 0.65
KEY_FINDINGS:
- Strong access control policies
- Audit logging needs improvement
"""


@pytest.fixture
def evidence_review_response():
    """Sample evidence review response from LLM."""
    return """RELEVANCE_SCORE: 0.85
SUFFICIENCY: sufficient
CURRENCY: current
RELIABILITY: high
OBSERVATIONS:
- Evidence clearly demonstrates control implementation
- Screenshots show proper configuration
- Audit logs confirm regular execution
RECOMMENDATIONS:
- Include date stamps on all evidence
- Add system-generated reports for verification
"""


@pytest.fixture
def sample_control_data():
    """Sample control data for testing."""
    return {
        "control_id": "AC-2",
        "control_name": "Account Management",
        "description": "The organization manages information system accounts.",
        "implementation_statement": "User accounts are managed through Active Directory.",
        "evidence_summary": "AD configuration, access review reports",
    }


@pytest.fixture
def sample_risk_data():
    """Sample risk data for testing."""
    return {
        "risk_id": "RISK-001",
        "risk_title": "Unauthorized Data Access",
        "description": "Risk of unauthorized access to sensitive customer data.",
        "risk_score": 7.5,
    }


@pytest.fixture
def sample_controls_list():
    """Sample list of controls for compliance assessment."""
    return [
        {"control_id": "AC-1", "implementation_status": "implemented", "description": "Access Control Policy"},
        {"control_id": "AC-2", "implementation_status": "partial", "description": "Account Management"},
        {"control_id": "AC-3", "implementation_status": "implemented", "description": "Access Enforcement"},
        {"control_id": "AU-1", "implementation_status": "implemented", "description": "Audit Policy"},
        {"control_id": "AU-2", "implementation_status": "partial", "description": "Audit Events"},
    ]
