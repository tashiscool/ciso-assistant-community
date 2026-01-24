"""
AI Author Service

Provides AI-powered drafting of control implementation statements,
policy documents, and compliance narratives.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
import logging

from .llm_client import get_default_llm_client, LLMMessage, LLMResponse

logger = logging.getLogger(__name__)


class DocumentType(str, Enum):
    """Types of documents the AI Author can generate."""
    CONTROL_STATEMENT = 'control_statement'
    POLICY_SECTION = 'policy_section'
    PROCEDURE = 'procedure'
    SSP_NARRATIVE = 'ssp_narrative'
    POAM_ENTRY = 'poam_entry'
    RISK_STATEMENT = 'risk_statement'
    EVIDENCE_DESCRIPTION = 'evidence_description'


class Framework(str, Enum):
    """Supported compliance frameworks."""
    NIST_800_53 = 'nist_800_53'
    FEDRAMP = 'fedramp'
    ISO_27001 = 'iso_27001'
    SOC2 = 'soc2'
    HIPAA = 'hipaa'
    PCI_DSS = 'pci_dss'
    CMMC = 'cmmc'
    CISA_CPG = 'cisa_cpg'


@dataclass
class ControlDraft:
    """Represents a drafted control implementation statement."""
    control_id: str
    requirement_text: str
    implementation_statement: str
    responsible_roles: List[str] = field(default_factory=list)
    implementation_status: str = 'planned'
    suggested_evidence: List[str] = field(default_factory=list)
    confidence_score: float = 0.0
    framework: str = ''

    def to_dict(self) -> Dict[str, Any]:
        return {
            'control_id': self.control_id,
            'requirement_text': self.requirement_text,
            'implementation_statement': self.implementation_statement,
            'responsible_roles': self.responsible_roles,
            'implementation_status': self.implementation_status,
            'suggested_evidence': self.suggested_evidence,
            'confidence_score': self.confidence_score,
            'framework': self.framework,
        }


@dataclass
class PolicyDraft:
    """Represents a drafted policy section."""
    title: str
    content: str
    sections: List[Dict[str, str]] = field(default_factory=list)
    related_controls: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'title': self.title,
            'content': self.content,
            'sections': self.sections,
            'related_controls': self.related_controls,
        }


@dataclass
class ProcedureDraft:
    """Represents a drafted procedure document."""
    title: str
    purpose: str
    scope: str
    steps: List[Dict[str, Any]] = field(default_factory=list)
    roles_responsibilities: Dict[str, List[str]] = field(default_factory=dict)
    related_controls: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'title': self.title,
            'purpose': self.purpose,
            'scope': self.scope,
            'steps': self.steps,
            'roles_responsibilities': self.roles_responsibilities,
            'related_controls': self.related_controls,
        }


class AIAuthorService:
    """
    AI-powered document authoring service.

    Generates control implementation statements, policies, procedures,
    and other compliance documentation using LLM.
    """

    def __init__(self, llm_client=None):
        """
        Initialize the AI Author service.

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

    def draft_control_implementation(
        self,
        control_id: str,
        requirement_text: str,
        framework: str = 'nist_800_53',
        context: Optional[Dict[str, Any]] = None,
        existing_implementation: Optional[str] = None,
    ) -> ControlDraft:
        """
        Draft a control implementation statement.

        Args:
            control_id: Control identifier (e.g., 'AC-2')
            requirement_text: The control requirement text
            framework: Compliance framework
            context: Additional context (organization info, system info, etc.)
            existing_implementation: Existing implementation to improve

        Returns:
            ControlDraft with generated implementation statement
        """
        context = context or {}

        # Build the prompt
        system_prompt = self._build_control_system_prompt(framework)
        user_prompt = self._build_control_user_prompt(
            control_id, requirement_text, context, existing_implementation
        )

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.3)

            # Parse the response
            parsed = self._parse_control_response(response.content)

            return ControlDraft(
                control_id=control_id,
                requirement_text=requirement_text,
                implementation_statement=parsed.get('implementation', ''),
                responsible_roles=parsed.get('roles', []),
                implementation_status='planned',
                suggested_evidence=parsed.get('evidence', []),
                confidence_score=self._calculate_confidence(response),
                framework=framework,
            )

        except Exception as e:
            logger.error(f"Error drafting control implementation: {e}")
            return ControlDraft(
                control_id=control_id,
                requirement_text=requirement_text,
                implementation_statement=f"Error generating draft: {str(e)}",
                confidence_score=0.0,
                framework=framework,
            )

    def draft_policy_section(
        self,
        topic: str,
        framework: str = 'nist_800_53',
        related_controls: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> PolicyDraft:
        """
        Draft a policy section for a given topic.

        Args:
            topic: Policy topic (e.g., 'Access Control', 'Incident Response')
            framework: Compliance framework
            related_controls: List of related control IDs
            context: Additional context

        Returns:
            PolicyDraft with generated policy content
        """
        context = context or {}
        related_controls = related_controls or []

        system_prompt = """You are an expert security policy writer. Generate clear,
concise, and actionable policy content that aligns with industry best practices
and compliance requirements.

Format your response as:
TITLE: [Policy section title]
PURPOSE: [Brief purpose statement]
CONTENT:
[Main policy content with clear sections]
SECTIONS:
- [Section 1 title]: [Content]
- [Section 2 title]: [Content]
"""

        user_prompt = f"""Draft a policy section for: {topic}

Framework: {framework}
Related Controls: {', '.join(related_controls) if related_controls else 'None specified'}

Organization Context:
{self._format_context(context)}

Generate a comprehensive but concise policy section that addresses the topic
and aligns with the specified framework requirements."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            parsed = self._parse_policy_response(response.content)

            return PolicyDraft(
                title=parsed.get('title', topic),
                content=parsed.get('content', ''),
                sections=parsed.get('sections', []),
                related_controls=related_controls,
            )

        except Exception as e:
            logger.error(f"Error drafting policy section: {e}")
            return PolicyDraft(
                title=topic,
                content=f"Error generating draft: {str(e)}",
                related_controls=related_controls,
            )

    def draft_procedure(
        self,
        procedure_name: str,
        purpose: str,
        related_controls: Optional[List[str]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ProcedureDraft:
        """
        Draft a procedure document.

        Args:
            procedure_name: Name of the procedure
            purpose: Purpose of the procedure
            related_controls: Related control IDs
            context: Additional context

        Returns:
            ProcedureDraft with generated procedure content
        """
        context = context or {}
        related_controls = related_controls or []

        system_prompt = """You are an expert in writing security and compliance procedures.
Generate clear, step-by-step procedures that are actionable and auditable.

Format your response as:
TITLE: [Procedure title]
PURPOSE: [Purpose statement]
SCOPE: [Scope of the procedure]
STEPS:
1. [Step description] | Responsible: [Role]
2. [Step description] | Responsible: [Role]
ROLES:
- [Role 1]: [Responsibilities]
- [Role 2]: [Responsibilities]
"""

        user_prompt = f"""Draft a procedure for: {procedure_name}

Purpose: {purpose}
Related Controls: {', '.join(related_controls) if related_controls else 'None specified'}

Context:
{self._format_context(context)}

Generate a detailed but practical procedure with clear steps and role assignments."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.3)
            parsed = self._parse_procedure_response(response.content)

            return ProcedureDraft(
                title=parsed.get('title', procedure_name),
                purpose=parsed.get('purpose', purpose),
                scope=parsed.get('scope', ''),
                steps=parsed.get('steps', []),
                roles_responsibilities=parsed.get('roles', {}),
                related_controls=related_controls,
            )

        except Exception as e:
            logger.error(f"Error drafting procedure: {e}")
            return ProcedureDraft(
                title=procedure_name,
                purpose=purpose,
                scope='',
                related_controls=related_controls,
            )

    def draft_ssp_narrative(
        self,
        control_id: str,
        requirement_text: str,
        system_description: str,
        implementation_details: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Draft an SSP narrative for a control.

        Args:
            control_id: Control identifier
            requirement_text: Control requirement
            system_description: Description of the system
            implementation_details: Existing implementation details

        Returns:
            SSP narrative text
        """
        implementation_details = implementation_details or {}

        system_prompt = """You are an expert at writing System Security Plan (SSP) narratives.
Write clear, specific narratives that describe how the system implements security controls.
Use professional language appropriate for federal security documentation.
Be specific about technologies, processes, and responsible parties where possible."""

        user_prompt = f"""Write an SSP narrative for control {control_id}.

Control Requirement:
{requirement_text}

System Description:
{system_description}

Implementation Details:
{self._format_context(implementation_details)}

Write a comprehensive SSP narrative that describes how this control is implemented
in the context of the described system."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.3)
            return response.content.strip()
        except Exception as e:
            logger.error(f"Error drafting SSP narrative: {e}")
            return f"Error generating SSP narrative: {str(e)}"

    def draft_poam_entry(
        self,
        weakness_description: str,
        control_id: str,
        severity: str = 'medium',
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Draft a POA&M entry for a weakness.

        Args:
            weakness_description: Description of the weakness
            control_id: Related control ID
            severity: Severity level (low, medium, high, critical)
            context: Additional context

        Returns:
            Dictionary with POA&M entry fields
        """
        context = context or {}

        system_prompt = """You are an expert at writing Plan of Action and Milestones (POA&M) entries.
Generate actionable remediation plans with realistic milestones.

Format your response as:
WEAKNESS: [Concise weakness statement]
REMEDIATION: [Remediation approach]
MILESTONES:
1. [Milestone] | [Days to complete]
2. [Milestone] | [Days to complete]
RESOURCES: [Required resources]
RISK_ACCEPTANCE: [If applicable, risk acceptance justification]
"""

        user_prompt = f"""Create a POA&M entry for the following weakness:

Weakness: {weakness_description}
Related Control: {control_id}
Severity: {severity}

Context:
{self._format_context(context)}

Generate a complete POA&M entry with remediation plan and milestones."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.3)
            return self._parse_poam_response(response.content, control_id, severity)
        except Exception as e:
            logger.error(f"Error drafting POA&M entry: {e}")
            return {
                'weakness': weakness_description,
                'control_id': control_id,
                'severity': severity,
                'error': str(e),
            }

    def improve_existing_text(
        self,
        text: str,
        document_type: str,
        improvement_focus: Optional[List[str]] = None,
    ) -> str:
        """
        Improve existing compliance text.

        Args:
            text: Existing text to improve
            document_type: Type of document
            improvement_focus: Areas to focus improvement on

        Returns:
            Improved text
        """
        improvement_focus = improvement_focus or ['clarity', 'completeness', 'specificity']

        system_prompt = """You are an expert compliance documentation editor.
Improve the provided text while maintaining its original meaning and intent.
Focus on clarity, completeness, and professional language."""

        user_prompt = f"""Improve the following {document_type}:

Original Text:
{text}

Focus on improving:
{', '.join(improvement_focus)}

Provide the improved version of the text."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.3)
            return response.content.strip()
        except Exception as e:
            logger.error(f"Error improving text: {e}")
            return text  # Return original on error

    def _build_control_system_prompt(self, framework: str) -> str:
        """Build system prompt for control drafting."""
        framework_guidance = {
            'nist_800_53': 'NIST 800-53 control implementation language',
            'fedramp': 'FedRAMP-compliant control implementation statements',
            'iso_27001': 'ISO 27001 control implementation descriptions',
            'soc2': 'SOC 2 Trust Services Criteria language',
            'hipaa': 'HIPAA security rule compliance language',
            'pci_dss': 'PCI DSS requirement implementation language',
            'cmmc': 'CMMC practice implementation descriptions',
        }

        guidance = framework_guidance.get(framework, 'security control implementation language')

        return f"""You are an expert security compliance writer specializing in {guidance}.

When drafting control implementations, follow these guidelines:
1. Be specific about technologies, processes, and responsible parties
2. Use active voice and clear, professional language
3. Include measurable and auditable statements
4. Reference relevant policies and procedures
5. Identify responsible roles/parties

Format your response as:
IMPLEMENTATION:
[Detailed implementation statement]

RESPONSIBLE_ROLES:
- [Role 1]
- [Role 2]

SUGGESTED_EVIDENCE:
- [Evidence type 1]
- [Evidence type 2]
"""

    def _build_control_user_prompt(
        self,
        control_id: str,
        requirement_text: str,
        context: Dict[str, Any],
        existing_implementation: Optional[str],
    ) -> str:
        """Build user prompt for control drafting."""
        prompt = f"""Draft an implementation statement for control {control_id}.

Control Requirement:
{requirement_text}

Organization Context:
{self._format_context(context)}
"""

        if existing_implementation:
            prompt += f"""
Existing Implementation (improve this):
{existing_implementation}
"""

        prompt += """
Generate a comprehensive implementation statement that addresses all aspects
of the control requirement."""

        return prompt

    def _format_context(self, context: Dict[str, Any]) -> str:
        """Format context dictionary for prompts."""
        if not context:
            return "No additional context provided."

        lines = []
        for key, value in context.items():
            if isinstance(value, list):
                value = ', '.join(str(v) for v in value)
            lines.append(f"- {key}: {value}")

        return '\n'.join(lines)

    def _parse_control_response(self, content: str) -> Dict[str, Any]:
        """Parse LLM response for control drafting."""
        result = {
            'implementation': '',
            'roles': [],
            'evidence': [],
        }

        # Simple parsing based on expected format
        lines = content.split('\n')
        current_section = None
        current_content = []

        for line in lines:
            line_stripped = line.strip()

            if line_stripped.startswith('IMPLEMENTATION:'):
                if current_section and current_content:
                    self._store_section(result, current_section, current_content)
                current_section = 'implementation'
                current_content = []
            elif line_stripped.startswith('RESPONSIBLE_ROLES:'):
                if current_section and current_content:
                    self._store_section(result, current_section, current_content)
                current_section = 'roles'
                current_content = []
            elif line_stripped.startswith('SUGGESTED_EVIDENCE:'):
                if current_section and current_content:
                    self._store_section(result, current_section, current_content)
                current_section = 'evidence'
                current_content = []
            elif line_stripped.startswith('- ') and current_section in ['roles', 'evidence']:
                current_content.append(line_stripped[2:])
            elif current_section == 'implementation':
                current_content.append(line)

        # Store final section
        if current_section and current_content:
            self._store_section(result, current_section, current_content)

        # If parsing failed, use the whole content as implementation
        if not result['implementation']:
            result['implementation'] = content.strip()

        return result

    def _store_section(
        self,
        result: Dict[str, Any],
        section: str,
        content: List[str]
    ) -> None:
        """Store parsed section content."""
        if section == 'implementation':
            result['implementation'] = '\n'.join(content).strip()
        elif section in ['roles', 'evidence']:
            result[section] = [c.strip() for c in content if c.strip()]

    def _parse_policy_response(self, content: str) -> Dict[str, Any]:
        """Parse LLM response for policy drafting."""
        result = {
            'title': '',
            'content': '',
            'sections': [],
        }

        lines = content.split('\n')
        current_section = None
        current_content = []

        for line in lines:
            if line.startswith('TITLE:'):
                result['title'] = line[6:].strip()
            elif line.startswith('CONTENT:'):
                current_section = 'content'
                current_content = []
            elif line.startswith('SECTIONS:'):
                if current_section == 'content':
                    result['content'] = '\n'.join(current_content).strip()
                current_section = 'sections'
            elif current_section == 'content':
                current_content.append(line)
            elif current_section == 'sections' and line.strip().startswith('- '):
                section_text = line.strip()[2:]
                if ':' in section_text:
                    title, content = section_text.split(':', 1)
                    result['sections'].append({
                        'title': title.strip(),
                        'content': content.strip()
                    })

        if current_section == 'content' and not result['content']:
            result['content'] = '\n'.join(current_content).strip()

        # Fallback: use entire content if parsing failed
        if not result['content']:
            result['content'] = content

        return result

    def _parse_procedure_response(self, content: str) -> Dict[str, Any]:
        """Parse LLM response for procedure drafting."""
        result = {
            'title': '',
            'purpose': '',
            'scope': '',
            'steps': [],
            'roles': {},
        }

        lines = content.split('\n')
        current_section = None

        for line in lines:
            line_stripped = line.strip()

            if line_stripped.startswith('TITLE:'):
                result['title'] = line_stripped[6:].strip()
            elif line_stripped.startswith('PURPOSE:'):
                result['purpose'] = line_stripped[8:].strip()
            elif line_stripped.startswith('SCOPE:'):
                result['scope'] = line_stripped[6:].strip()
            elif line_stripped.startswith('STEPS:'):
                current_section = 'steps'
            elif line_stripped.startswith('ROLES:'):
                current_section = 'roles'
            elif current_section == 'steps' and line_stripped and line_stripped[0].isdigit():
                # Parse step: "1. [Step] | Responsible: [Role]"
                step_parts = line_stripped.split('|')
                step_text = step_parts[0].strip()
                # Remove leading number and dot
                if '.' in step_text:
                    step_text = step_text.split('.', 1)[1].strip()

                responsible = ''
                if len(step_parts) > 1:
                    resp_part = step_parts[1].strip()
                    if resp_part.startswith('Responsible:'):
                        responsible = resp_part[12:].strip()

                result['steps'].append({
                    'step': step_text,
                    'responsible': responsible,
                })
            elif current_section == 'roles' and line_stripped.startswith('- '):
                role_text = line_stripped[2:]
                if ':' in role_text:
                    role, responsibilities = role_text.split(':', 1)
                    result['roles'][role.strip()] = [
                        r.strip() for r in responsibilities.split(',')
                    ]

        return result

    def _parse_poam_response(
        self,
        content: str,
        control_id: str,
        severity: str
    ) -> Dict[str, Any]:
        """Parse LLM response for POA&M drafting."""
        result = {
            'control_id': control_id,
            'severity': severity,
            'weakness': '',
            'remediation': '',
            'milestones': [],
            'resources': '',
            'risk_acceptance': '',
        }

        lines = content.split('\n')
        current_section = None

        for line in lines:
            line_stripped = line.strip()

            if line_stripped.startswith('WEAKNESS:'):
                result['weakness'] = line_stripped[9:].strip()
            elif line_stripped.startswith('REMEDIATION:'):
                result['remediation'] = line_stripped[12:].strip()
            elif line_stripped.startswith('MILESTONES:'):
                current_section = 'milestones'
            elif line_stripped.startswith('RESOURCES:'):
                result['resources'] = line_stripped[10:].strip()
                current_section = None
            elif line_stripped.startswith('RISK_ACCEPTANCE:'):
                result['risk_acceptance'] = line_stripped[16:].strip()
                current_section = None
            elif current_section == 'milestones' and line_stripped and line_stripped[0].isdigit():
                # Parse milestone: "1. [Milestone] | [Days]"
                parts = line_stripped.split('|')
                milestone_text = parts[0].strip()
                if '.' in milestone_text:
                    milestone_text = milestone_text.split('.', 1)[1].strip()

                days = 30  # default
                if len(parts) > 1:
                    days_text = parts[1].strip()
                    # Extract number from text like "30 days"
                    import re
                    match = re.search(r'(\d+)', days_text)
                    if match:
                        days = int(match.group(1))

                result['milestones'].append({
                    'description': milestone_text,
                    'days_to_complete': days,
                })

        return result

    def _calculate_confidence(self, response: LLMResponse) -> float:
        """Calculate confidence score for a response."""
        # Simple heuristic based on response characteristics
        content = response.content

        score = 0.7  # Base score

        # Longer, more detailed responses get higher scores
        if len(content) > 500:
            score += 0.1
        if len(content) > 1000:
            score += 0.05

        # Responses with structured sections get higher scores
        if 'IMPLEMENTATION:' in content or 'RESPONSIBLE' in content:
            score += 0.1

        # Cap at 0.95
        return min(score, 0.95)


# Singleton instance
_ai_author_service: Optional[AIAuthorService] = None


def get_ai_author_service() -> AIAuthorService:
    """Get or create the AI Author service instance."""
    global _ai_author_service
    if _ai_author_service is None:
        _ai_author_service = AIAuthorService()
    return _ai_author_service
