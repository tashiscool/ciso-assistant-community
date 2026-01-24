"""
AI Explainer Service

Provides AI-powered explanations of security controls, compliance
requirements, and risk concepts tailored to different audiences.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
import logging

from .llm_client import get_default_llm_client, LLMMessage

logger = logging.getLogger(__name__)


class Audience(str, Enum):
    """Target audience for explanations."""
    EXECUTIVE = 'executive'
    AUDITOR = 'auditor'
    ENGINEER = 'engineer'
    ANALYST = 'analyst'
    END_USER = 'end_user'
    LEGAL = 'legal'
    BOARD = 'board'


class ExplanationFormat(str, Enum):
    """Format for explanations."""
    BRIEF = 'brief'
    DETAILED = 'detailed'
    BULLET_POINTS = 'bullet_points'
    FAQ = 'faq'
    ANALOGY = 'analogy'


@dataclass
class Explanation:
    """Result of an explanation request."""
    topic: str
    audience: str
    format: str
    content: str
    key_points: List[str] = field(default_factory=list)
    related_topics: List[str] = field(default_factory=list)
    action_items: List[str] = field(default_factory=list)
    additional_resources: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'topic': self.topic,
            'audience': self.audience,
            'format': self.format,
            'content': self.content,
            'key_points': self.key_points,
            'related_topics': self.related_topics,
            'action_items': self.action_items,
            'additional_resources': self.additional_resources,
        }


@dataclass
class ControlExplanation:
    """Explanation of a security control."""
    control_id: str
    control_name: str
    audience: str
    purpose: str
    implementation_overview: str
    business_impact: str
    compliance_relevance: str
    key_points: List[str] = field(default_factory=list)
    common_challenges: List[str] = field(default_factory=list)
    best_practices: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'control_id': self.control_id,
            'control_name': self.control_name,
            'audience': self.audience,
            'purpose': self.purpose,
            'implementation_overview': self.implementation_overview,
            'business_impact': self.business_impact,
            'compliance_relevance': self.compliance_relevance,
            'key_points': self.key_points,
            'common_challenges': self.common_challenges,
            'best_practices': self.best_practices,
        }


@dataclass
class RiskExplanation:
    """Explanation of a risk."""
    risk_id: str
    risk_title: str
    audience: str
    risk_summary: str
    potential_impact: str
    likelihood_explanation: str
    mitigation_overview: str
    business_context: str
    key_points: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'risk_id': self.risk_id,
            'risk_title': self.risk_title,
            'audience': self.audience,
            'risk_summary': self.risk_summary,
            'potential_impact': self.potential_impact,
            'likelihood_explanation': self.likelihood_explanation,
            'mitigation_overview': self.mitigation_overview,
            'business_context': self.business_context,
            'key_points': self.key_points,
        }


class AIExplainerService:
    """
    AI-powered explanation service.

    Provides audience-appropriate explanations of security controls,
    compliance requirements, risks, and technical concepts.
    """

    AUDIENCE_PROFILES = {
        'executive': {
            'focus': 'business impact, strategic value, ROI',
            'language': 'high-level, non-technical, action-oriented',
            'length': 'concise with clear takeaways',
        },
        'auditor': {
            'focus': 'compliance, evidence, control effectiveness',
            'language': 'precise, formal, reference-oriented',
            'length': 'detailed with specific criteria',
        },
        'engineer': {
            'focus': 'implementation details, technical requirements',
            'language': 'technical, specific, practical',
            'length': 'comprehensive with examples',
        },
        'analyst': {
            'focus': 'risk analysis, metrics, trends',
            'language': 'analytical, data-oriented',
            'length': 'balanced with supporting data',
        },
        'end_user': {
            'focus': 'practical impact, daily operations',
            'language': 'simple, clear, relatable',
            'length': 'brief with practical examples',
        },
        'legal': {
            'focus': 'regulatory requirements, liability, obligations',
            'language': 'precise, cautious, regulatory-aware',
            'length': 'thorough with legal context',
        },
        'board': {
            'focus': 'strategic risk, fiduciary responsibility, governance',
            'language': 'executive-level, strategic, governance-focused',
            'length': 'concise with governance implications',
        },
    }

    def __init__(self, llm_client=None):
        """
        Initialize the AI Explainer service.

        Args:
            llm_client: LLM client instance. Uses default if not provided.
        """
        self._llm_client = llm_client

    @property
    def llm_client(self):
        """Lazy load LLM client."""
        if self._llm_client is None:
            self._llm_client = get_default_llm_client()
        return self._llm_client

    def explain_control(
        self,
        control_id: str,
        control_name: str,
        control_description: str,
        audience: str = 'executive',
        context: Optional[Dict[str, Any]] = None,
    ) -> ControlExplanation:
        """
        Explain a security control for a specific audience.

        Args:
            control_id: Control identifier
            control_name: Name of the control
            control_description: Full control description
            audience: Target audience
            context: Additional context

        Returns:
            ControlExplanation tailored to audience
        """
        context = context or {}
        profile = self.AUDIENCE_PROFILES.get(audience, self.AUDIENCE_PROFILES['executive'])

        system_prompt = f"""You are an expert at explaining security controls to different audiences.
Explain the control for a {audience} audience.

Audience focus: {profile['focus']}
Language style: {profile['language']}
Expected length: {profile['length']}

Format your response as:
PURPOSE: [Why this control exists]
IMPLEMENTATION_OVERVIEW: [How it's implemented]
BUSINESS_IMPACT: [Impact on the business]
COMPLIANCE_RELEVANCE: [Compliance implications]
KEY_POINTS:
- [Point 1]
- [Point 2]
COMMON_CHALLENGES:
- [Challenge 1]
- [Challenge 2]
BEST_PRACTICES:
- [Practice 1]
- [Practice 2]
"""

        user_prompt = f"""Explain this control for a {audience}:

Control ID: {control_id}
Control Name: {control_name}
Description: {control_description}

Context:
{self._format_context(context)}

Provide an explanation appropriate for the audience."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            return self._parse_control_explanation(
                response.content, control_id, control_name, audience
            )
        except Exception as e:
            logger.error(f"Error explaining control: {e}")
            return ControlExplanation(
                control_id=control_id,
                control_name=control_name,
                audience=audience,
                purpose=f"Error generating explanation: {str(e)}",
                implementation_overview='',
                business_impact='',
                compliance_relevance='',
            )

    def explain_risk(
        self,
        risk_id: str,
        risk_title: str,
        risk_description: str,
        risk_score: Optional[float] = None,
        audience: str = 'executive',
        context: Optional[Dict[str, Any]] = None,
    ) -> RiskExplanation:
        """
        Explain a risk for a specific audience.

        Args:
            risk_id: Risk identifier
            risk_title: Title of the risk
            risk_description: Full risk description
            risk_score: Quantitative risk score if available
            audience: Target audience
            context: Additional context

        Returns:
            RiskExplanation tailored to audience
        """
        context = context or {}
        profile = self.AUDIENCE_PROFILES.get(audience, self.AUDIENCE_PROFILES['executive'])

        system_prompt = f"""You are an expert at explaining cybersecurity risks to different audiences.
Explain the risk for a {audience} audience.

Audience focus: {profile['focus']}
Language style: {profile['language']}
Expected length: {profile['length']}

Format your response as:
RISK_SUMMARY: [Clear summary of the risk]
POTENTIAL_IMPACT: [What could happen if realized]
LIKELIHOOD_EXPLANATION: [Why this might occur]
MITIGATION_OVERVIEW: [How to address it]
BUSINESS_CONTEXT: [Business relevance]
KEY_POINTS:
- [Point 1]
- [Point 2]
"""

        score_info = f"\nRisk Score: {risk_score}" if risk_score is not None else ""

        user_prompt = f"""Explain this risk for a {audience}:

Risk ID: {risk_id}
Risk Title: {risk_title}
Description: {risk_description}{score_info}

Context:
{self._format_context(context)}

Provide an explanation appropriate for the audience."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            return self._parse_risk_explanation(
                response.content, risk_id, risk_title, audience
            )
        except Exception as e:
            logger.error(f"Error explaining risk: {e}")
            return RiskExplanation(
                risk_id=risk_id,
                risk_title=risk_title,
                audience=audience,
                risk_summary=f"Error generating explanation: {str(e)}",
                potential_impact='',
                likelihood_explanation='',
                mitigation_overview='',
                business_context='',
            )

    def explain_framework(
        self,
        framework_name: str,
        framework_description: str,
        audience: str = 'executive',
    ) -> Explanation:
        """
        Explain a compliance framework for a specific audience.

        Args:
            framework_name: Name of the framework
            framework_description: Description of the framework
            audience: Target audience

        Returns:
            Explanation of the framework
        """
        profile = self.AUDIENCE_PROFILES.get(audience, self.AUDIENCE_PROFILES['executive'])

        system_prompt = f"""You are an expert at explaining compliance frameworks.
Explain the framework for a {audience} audience.

Audience focus: {profile['focus']}
Language style: {profile['language']}

Format your response as:
CONTENT: [Main explanation]
KEY_POINTS:
- [Point 1]
- [Point 2]
RELATED_TOPICS:
- [Topic 1]
- [Topic 2]
ACTION_ITEMS:
- [Action 1]
- [Action 2]
"""

        user_prompt = f"""Explain this compliance framework for a {audience}:

Framework: {framework_name}
Description: {framework_description}

Provide a clear, audience-appropriate explanation."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            return self._parse_explanation(
                response.content, framework_name, audience, 'detailed'
            )
        except Exception as e:
            logger.error(f"Error explaining framework: {e}")
            return Explanation(
                topic=framework_name,
                audience=audience,
                format='detailed',
                content=f"Error generating explanation: {str(e)}",
            )

    def explain_finding(
        self,
        finding_title: str,
        finding_description: str,
        severity: str,
        audience: str = 'executive',
        remediation: Optional[str] = None,
    ) -> Explanation:
        """
        Explain an audit finding for a specific audience.

        Args:
            finding_title: Title of the finding
            finding_description: Description of the finding
            severity: Severity level
            audience: Target audience
            remediation: Remediation steps if available

        Returns:
            Explanation of the finding
        """
        profile = self.AUDIENCE_PROFILES.get(audience, self.AUDIENCE_PROFILES['executive'])

        system_prompt = f"""You are an expert at explaining audit findings.
Explain the finding for a {audience} audience.

Audience focus: {profile['focus']}
Language style: {profile['language']}

Format your response as:
CONTENT: [Clear explanation of the finding]
KEY_POINTS:
- [Point 1]
- [Point 2]
ACTION_ITEMS:
- [Action 1]
- [Action 2]
"""

        remediation_text = f"\nRemediation: {remediation}" if remediation else ""

        user_prompt = f"""Explain this audit finding for a {audience}:

Finding: {finding_title}
Description: {finding_description}
Severity: {severity}{remediation_text}

Explain what this means and what should be done."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            return self._parse_explanation(
                response.content, finding_title, audience, 'detailed'
            )
        except Exception as e:
            logger.error(f"Error explaining finding: {e}")
            return Explanation(
                topic=finding_title,
                audience=audience,
                format='detailed',
                content=f"Error generating explanation: {str(e)}",
            )

    def explain_concept(
        self,
        concept: str,
        audience: str = 'end_user',
        format: str = 'detailed',
        context: Optional[Dict[str, Any]] = None,
    ) -> Explanation:
        """
        Explain a security or compliance concept.

        Args:
            concept: The concept to explain
            audience: Target audience
            format: Explanation format
            context: Additional context

        Returns:
            Explanation of the concept
        """
        context = context or {}
        profile = self.AUDIENCE_PROFILES.get(audience, self.AUDIENCE_PROFILES['end_user'])

        format_instructions = {
            'brief': 'Keep the explanation very short (2-3 sentences).',
            'detailed': 'Provide a comprehensive explanation.',
            'bullet_points': 'Use bullet points for easy scanning.',
            'faq': 'Format as frequently asked questions.',
            'analogy': 'Use analogies to make the concept relatable.',
        }

        system_prompt = f"""You are an expert at explaining security and compliance concepts.
Explain for a {audience} audience.

Audience focus: {profile['focus']}
Language style: {profile['language']}
{format_instructions.get(format, '')}

Format your response as:
CONTENT: [Main explanation]
KEY_POINTS:
- [Point 1]
- [Point 2]
RELATED_TOPICS:
- [Topic 1]
"""

        user_prompt = f"""Explain this concept for a {audience}:

Concept: {concept}

Context:
{self._format_context(context)}

Provide a clear, audience-appropriate explanation."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            return self._parse_explanation(response.content, concept, audience, format)
        except Exception as e:
            logger.error(f"Error explaining concept: {e}")
            return Explanation(
                topic=concept,
                audience=audience,
                format=format,
                content=f"Error generating explanation: {str(e)}",
            )

    def generate_executive_summary(
        self,
        data: Dict[str, Any],
        summary_type: str,
    ) -> str:
        """
        Generate an executive summary from data.

        Args:
            data: Data to summarize
            summary_type: Type of summary (risk, compliance, incident, etc.)

        Returns:
            Executive summary text
        """
        system_prompt = f"""You are an expert at writing executive summaries for security and compliance.
Generate a clear, concise executive summary for {summary_type}.

Focus on:
- Key findings and metrics
- Business impact
- Recommended actions
- Strategic implications

Keep it to 3-4 paragraphs maximum."""

        user_prompt = f"""Generate an executive summary for this {summary_type} data:

{self._format_context(data)}

Provide a clear, actionable executive summary."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            return response.content.strip()
        except Exception as e:
            logger.error(f"Error generating executive summary: {e}")
            return f"Error generating summary: {str(e)}"

    def translate_technical_to_business(
        self,
        technical_content: str,
        content_type: str = 'finding',
    ) -> str:
        """
        Translate technical content to business language.

        Args:
            technical_content: Technical content to translate
            content_type: Type of content

        Returns:
            Business-friendly version
        """
        system_prompt = """You are an expert at translating technical security content
to business language that executives can understand.

Maintain the essential meaning while:
- Removing jargon
- Focusing on business impact
- Making it actionable
- Keeping it concise"""

        user_prompt = f"""Translate this technical {content_type} to business language:

{technical_content}

Provide a business-friendly version."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            return response.content.strip()
        except Exception as e:
            logger.error(f"Error translating content: {e}")
            return technical_content  # Return original on error

    def _format_context(self, context: Dict[str, Any]) -> str:
        """Format context dictionary for prompts."""
        if not context:
            return "No additional context provided."

        lines = []
        for key, value in context.items():
            if isinstance(value, list):
                value = ', '.join(str(v) for v in value[:10])
            elif isinstance(value, dict):
                value = str(value)[:500]
            lines.append(f"- {key}: {value}")

        return '\n'.join(lines)

    def _parse_control_explanation(
        self,
        content: str,
        control_id: str,
        control_name: str,
        audience: str,
    ) -> ControlExplanation:
        """Parse LLM response for control explanation."""
        result = ControlExplanation(
            control_id=control_id,
            control_name=control_name,
            audience=audience,
            purpose='',
            implementation_overview='',
            business_impact='',
            compliance_relevance='',
        )

        lines = content.split('\n')
        current_section = None

        for line in lines:
            line = line.strip()

            if line.startswith('PURPOSE:'):
                result.purpose = line[8:].strip()
            elif line.startswith('IMPLEMENTATION_OVERVIEW:'):
                result.implementation_overview = line[24:].strip()
            elif line.startswith('BUSINESS_IMPACT:'):
                result.business_impact = line[16:].strip()
            elif line.startswith('COMPLIANCE_RELEVANCE:'):
                result.compliance_relevance = line[21:].strip()
            elif line.startswith('KEY_POINTS:'):
                current_section = 'key_points'
            elif line.startswith('COMMON_CHALLENGES:'):
                current_section = 'challenges'
            elif line.startswith('BEST_PRACTICES:'):
                current_section = 'practices'
            elif line.startswith('- ') and current_section:
                item = line[2:].strip()
                if current_section == 'key_points':
                    result.key_points.append(item)
                elif current_section == 'challenges':
                    result.common_challenges.append(item)
                elif current_section == 'practices':
                    result.best_practices.append(item)

        return result

    def _parse_risk_explanation(
        self,
        content: str,
        risk_id: str,
        risk_title: str,
        audience: str,
    ) -> RiskExplanation:
        """Parse LLM response for risk explanation."""
        result = RiskExplanation(
            risk_id=risk_id,
            risk_title=risk_title,
            audience=audience,
            risk_summary='',
            potential_impact='',
            likelihood_explanation='',
            mitigation_overview='',
            business_context='',
        )

        lines = content.split('\n')
        current_section = None

        for line in lines:
            line = line.strip()

            if line.startswith('RISK_SUMMARY:'):
                result.risk_summary = line[13:].strip()
            elif line.startswith('POTENTIAL_IMPACT:'):
                result.potential_impact = line[17:].strip()
            elif line.startswith('LIKELIHOOD_EXPLANATION:'):
                result.likelihood_explanation = line[23:].strip()
            elif line.startswith('MITIGATION_OVERVIEW:'):
                result.mitigation_overview = line[20:].strip()
            elif line.startswith('BUSINESS_CONTEXT:'):
                result.business_context = line[17:].strip()
            elif line.startswith('KEY_POINTS:'):
                current_section = 'key_points'
            elif line.startswith('- ') and current_section == 'key_points':
                result.key_points.append(line[2:].strip())

        return result

    def _parse_explanation(
        self,
        content: str,
        topic: str,
        audience: str,
        format: str,
    ) -> Explanation:
        """Parse LLM response for general explanation."""
        result = Explanation(
            topic=topic,
            audience=audience,
            format=format,
            content='',
        )

        lines = content.split('\n')
        current_section = None
        content_lines = []

        for line in lines:
            line_stripped = line.strip()

            if line_stripped.startswith('CONTENT:'):
                remaining = line_stripped[8:].strip()
                if remaining:
                    content_lines.append(remaining)
                current_section = 'content'
            elif line_stripped.startswith('KEY_POINTS:'):
                if content_lines:
                    result.content = '\n'.join(content_lines).strip()
                current_section = 'key_points'
            elif line_stripped.startswith('RELATED_TOPICS:'):
                current_section = 'related'
            elif line_stripped.startswith('ACTION_ITEMS:'):
                current_section = 'actions'
            elif line_stripped.startswith('ADDITIONAL_RESOURCES:'):
                current_section = 'resources'
            elif line_stripped.startswith('- ') and current_section:
                item = line_stripped[2:].strip()
                if current_section == 'key_points':
                    result.key_points.append(item)
                elif current_section == 'related':
                    result.related_topics.append(item)
                elif current_section == 'actions':
                    result.action_items.append(item)
                elif current_section == 'resources':
                    result.additional_resources.append(item)
            elif current_section == 'content':
                content_lines.append(line)

        if not result.content and content_lines:
            result.content = '\n'.join(content_lines).strip()

        # Fallback: use entire content if parsing failed
        if not result.content:
            result.content = content

        return result


# Singleton instance
_ai_explainer_service: Optional[AIExplainerService] = None


def get_ai_explainer_service() -> AIExplainerService:
    """Get or create the AI Explainer service instance."""
    global _ai_explainer_service
    if _ai_explainer_service is None:
        _ai_explainer_service = AIExplainerService()
    return _ai_explainer_service
