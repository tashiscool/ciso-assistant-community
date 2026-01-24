"""
AI Auditor Service

Provides AI-powered control evaluation, gap analysis, and audit
assessment capabilities.
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
import logging

from .llm_client import get_default_llm_client, LLMMessage

logger = logging.getLogger(__name__)


class EffectivenessRating(str, Enum):
    """Control effectiveness ratings."""
    FULLY_EFFECTIVE = 'fully_effective'
    LARGELY_EFFECTIVE = 'largely_effective'
    PARTIALLY_EFFECTIVE = 'partially_effective'
    LARGELY_INEFFECTIVE = 'largely_ineffective'
    INEFFECTIVE = 'ineffective'
    NOT_IMPLEMENTED = 'not_implemented'


class GapSeverity(str, Enum):
    """Gap severity levels."""
    CRITICAL = 'critical'
    HIGH = 'high'
    MEDIUM = 'medium'
    LOW = 'low'
    INFORMATIONAL = 'informational'


@dataclass
class ControlEvaluation:
    """Result of control effectiveness evaluation."""
    control_id: str
    effectiveness_rating: str
    effectiveness_score: float  # 0.0 to 1.0
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    evidence_assessment: str = ''
    audit_observations: str = ''

    def to_dict(self) -> Dict[str, Any]:
        return {
            'control_id': self.control_id,
            'effectiveness_rating': self.effectiveness_rating,
            'effectiveness_score': self.effectiveness_score,
            'strengths': self.strengths,
            'weaknesses': self.weaknesses,
            'recommendations': self.recommendations,
            'evidence_assessment': self.evidence_assessment,
            'audit_observations': self.audit_observations,
        }


@dataclass
class GapFinding:
    """Represents a gap identified during analysis."""
    gap_id: str
    title: str
    description: str
    severity: str
    affected_controls: List[str] = field(default_factory=list)
    root_cause: Optional[str] = None
    remediation_recommendation: Optional[str] = None
    estimated_effort: Optional[str] = None
    risk_if_not_addressed: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'gap_id': self.gap_id,
            'title': self.title,
            'description': self.description,
            'severity': self.severity,
            'affected_controls': self.affected_controls,
            'root_cause': self.root_cause,
            'remediation_recommendation': self.remediation_recommendation,
            'estimated_effort': self.estimated_effort,
            'risk_if_not_addressed': self.risk_if_not_addressed,
        }


@dataclass
class ComplianceAssessment:
    """Result of compliance assessment."""
    framework: str
    overall_compliance_score: float
    control_family_scores: Dict[str, float] = field(default_factory=dict)
    fully_compliant_controls: List[str] = field(default_factory=list)
    partially_compliant_controls: List[str] = field(default_factory=list)
    non_compliant_controls: List[str] = field(default_factory=list)
    gaps: List[GapFinding] = field(default_factory=list)
    summary: str = ''

    def to_dict(self) -> Dict[str, Any]:
        return {
            'framework': self.framework,
            'overall_compliance_score': self.overall_compliance_score,
            'control_family_scores': self.control_family_scores,
            'fully_compliant_controls': self.fully_compliant_controls,
            'partially_compliant_controls': self.partially_compliant_controls,
            'non_compliant_controls': self.non_compliant_controls,
            'gaps': [g.to_dict() for g in self.gaps],
            'summary': self.summary,
        }


@dataclass
class EvidenceReview:
    """Result of evidence review."""
    evidence_id: str
    evidence_type: str
    relevance_score: float
    sufficiency_rating: str
    currency_assessment: str
    reliability_assessment: str
    observations: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'evidence_id': self.evidence_id,
            'evidence_type': self.evidence_type,
            'relevance_score': self.relevance_score,
            'sufficiency_rating': self.sufficiency_rating,
            'currency_assessment': self.currency_assessment,
            'reliability_assessment': self.reliability_assessment,
            'observations': self.observations,
            'recommendations': self.recommendations,
        }


class AIAuditorService:
    """
    AI-powered audit and assessment service.

    Provides control effectiveness evaluation, gap analysis,
    compliance assessment, and evidence review capabilities.
    """

    def __init__(self, llm_client=None):
        """
        Initialize the AI Auditor service.

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

    def evaluate_control_effectiveness(
        self,
        control_id: str,
        control_description: str,
        requirement_text: str,
        implementation_statement: Optional[str] = None,
        evidence_summary: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ControlEvaluation:
        """
        Evaluate the effectiveness of a control implementation.

        Args:
            control_id: Control identifier
            control_description: Description of the control
            requirement_text: The control requirement
            implementation_statement: How the control is implemented
            evidence_summary: Summary of supporting evidence
            context: Additional context

        Returns:
            ControlEvaluation with assessment results
        """
        context = context or {}

        system_prompt = """You are an expert security auditor evaluating control effectiveness.
Assess the control implementation against the requirement and available evidence.

Provide your evaluation in this format:
EFFECTIVENESS_RATING: [fully_effective/largely_effective/partially_effective/largely_ineffective/ineffective/not_implemented]
EFFECTIVENESS_SCORE: [0.0-1.0]
STRENGTHS:
- [Strength 1]
- [Strength 2]
WEAKNESSES:
- [Weakness 1]
- [Weakness 2]
RECOMMENDATIONS:
- [Recommendation 1]
- [Recommendation 2]
EVIDENCE_ASSESSMENT: [Assessment of the evidence provided]
AUDIT_OBSERVATIONS: [Key observations from audit perspective]
"""

        user_prompt = f"""Evaluate the effectiveness of this control:

Control ID: {control_id}
Control Description: {control_description}

Requirement:
{requirement_text}

Implementation Statement:
{implementation_statement or 'Not provided'}

Evidence Summary:
{evidence_summary or 'No evidence provided'}

Context:
{self._format_context(context)}

Provide a thorough effectiveness evaluation."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.2)
            return self._parse_evaluation_response(response.content, control_id)
        except Exception as e:
            logger.error(f"Error evaluating control: {e}")
            return ControlEvaluation(
                control_id=control_id,
                effectiveness_rating='not_implemented',
                effectiveness_score=0.0,
                audit_observations=f"Error during evaluation: {str(e)}",
            )

    def perform_gap_analysis(
        self,
        current_state: Dict[str, Any],
        target_framework: str,
        control_requirements: Optional[List[Dict[str, Any]]] = None,
    ) -> List[GapFinding]:
        """
        Perform gap analysis between current state and target requirements.

        Args:
            current_state: Description of current security posture
            target_framework: Target compliance framework
            control_requirements: Specific requirements to assess against

        Returns:
            List of identified gaps
        """
        system_prompt = f"""You are an expert compliance analyst performing a gap analysis
against {target_framework} requirements.

Identify gaps between the current state and compliance requirements.

For each gap found, provide:
GAP:
ID: GAP-[number]
TITLE: [Short title]
DESCRIPTION: [Detailed description]
SEVERITY: [critical/high/medium/low/informational]
AFFECTED_CONTROLS: [Comma-separated control IDs]
ROOT_CAUSE: [Underlying cause]
REMEDIATION: [Recommended remediation]
EFFORT: [low/medium/high]
RISK: [Risk if not addressed]
---
"""

        user_prompt = f"""Analyze gaps in the following current state:

Current Security Posture:
{self._format_context(current_state)}

Target Framework: {target_framework}

"""
        if control_requirements:
            user_prompt += "Specific Requirements to Assess:\n"
            for req in control_requirements[:10]:  # Limit for context
                user_prompt += f"- {req.get('control_id', 'N/A')}: {req.get('description', '')[:200]}\n"

        user_prompt += "\nIdentify all significant gaps."

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.2)
            return self._parse_gaps_response(response.content)
        except Exception as e:
            logger.error(f"Error performing gap analysis: {e}")
            return [GapFinding(
                gap_id='GAP-ERROR',
                title='Gap Analysis Error',
                description=f"Error during gap analysis: {str(e)}",
                severity='informational',
            )]

    def assess_compliance(
        self,
        framework: str,
        controls_data: List[Dict[str, Any]],
    ) -> ComplianceAssessment:
        """
        Assess overall compliance against a framework.

        Args:
            framework: Target compliance framework
            controls_data: List of control data with implementation status

        Returns:
            ComplianceAssessment with overall results
        """
        # Summarize control data for LLM
        control_summary = self._summarize_controls(controls_data)

        system_prompt = f"""You are an expert compliance assessor evaluating compliance with {framework}.
Analyze the control implementation data and provide a compliance assessment.

Format your response as:
OVERALL_SCORE: [0.0-1.0]
SUMMARY: [Overall compliance summary]
FULLY_COMPLIANT: [Comma-separated control IDs]
PARTIALLY_COMPLIANT: [Comma-separated control IDs]
NON_COMPLIANT: [Comma-separated control IDs]
FAMILY_SCORES:
- [Family Name]: [Score]
- [Family Name]: [Score]
KEY_FINDINGS:
- [Finding 1]
- [Finding 2]
"""

        user_prompt = f"""Assess compliance for these controls:

{control_summary}

Provide a comprehensive compliance assessment."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.2)
            return self._parse_compliance_response(response.content, framework)
        except Exception as e:
            logger.error(f"Error assessing compliance: {e}")
            return ComplianceAssessment(
                framework=framework,
                overall_compliance_score=0.0,
                summary=f"Error during assessment: {str(e)}",
            )

    def review_evidence(
        self,
        evidence_description: str,
        evidence_type: str,
        control_requirement: str,
        evidence_date: Optional[str] = None,
    ) -> EvidenceReview:
        """
        Review evidence for a control.

        Args:
            evidence_description: Description of the evidence
            evidence_type: Type of evidence
            control_requirement: The control requirement it supports
            evidence_date: Date of the evidence

        Returns:
            EvidenceReview with assessment
        """
        system_prompt = """You are an expert auditor reviewing evidence for control compliance.
Assess the evidence for relevance, sufficiency, currency, and reliability.

Format your response as:
RELEVANCE_SCORE: [0.0-1.0]
SUFFICIENCY: [sufficient/partially_sufficient/insufficient]
CURRENCY: [current/outdated/unknown]
RELIABILITY: [high/medium/low]
OBSERVATIONS:
- [Observation 1]
- [Observation 2]
RECOMMENDATIONS:
- [Recommendation 1]
- [Recommendation 2]
"""

        user_prompt = f"""Review this evidence:

Evidence Type: {evidence_type}
Evidence Description: {evidence_description}
Evidence Date: {evidence_date or 'Not specified'}

Control Requirement:
{control_requirement}

Assess the evidence quality and suitability."""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.2)
            return self._parse_evidence_response(response.content, evidence_type)
        except Exception as e:
            logger.error(f"Error reviewing evidence: {e}")
            return EvidenceReview(
                evidence_id='',
                evidence_type=evidence_type,
                relevance_score=0.0,
                sufficiency_rating='insufficient',
                currency_assessment='unknown',
                reliability_assessment='low',
                observations=[f"Error during review: {str(e)}"],
            )

    def generate_audit_findings(
        self,
        control_evaluations: List[ControlEvaluation],
        assessment_type: str = 'internal',
    ) -> List[Dict[str, Any]]:
        """
        Generate formal audit findings from evaluations.

        Args:
            control_evaluations: List of control evaluations
            assessment_type: Type of assessment (internal, external, etc.)

        Returns:
            List of formatted audit findings
        """
        # Filter for controls with issues
        problematic_controls = [
            e for e in control_evaluations
            if e.effectiveness_rating in [
                'partially_effective', 'largely_ineffective',
                'ineffective', 'not_implemented'
            ]
        ]

        if not problematic_controls:
            return []

        findings = []
        for i, eval in enumerate(problematic_controls, 1):
            finding = {
                'finding_id': f'FIND-{i:03d}',
                'control_id': eval.control_id,
                'title': f'{eval.control_id} - {eval.effectiveness_rating.replace("_", " ").title()}',
                'condition': '; '.join(eval.weaknesses) if eval.weaknesses else 'Control deficiencies identified',
                'criteria': 'Control requirement not fully met',
                'cause': eval.audit_observations or 'Root cause analysis pending',
                'effect': 'Increased risk to the organization',
                'recommendation': '; '.join(eval.recommendations) if eval.recommendations else 'Improve control implementation',
                'severity': self._map_rating_to_severity(eval.effectiveness_rating),
                'assessment_type': assessment_type,
            }
            findings.append(finding)

        return findings

    def compare_assessments(
        self,
        previous_assessment: ComplianceAssessment,
        current_assessment: ComplianceAssessment,
    ) -> Dict[str, Any]:
        """
        Compare two compliance assessments to identify trends.

        Args:
            previous_assessment: Previous assessment
            current_assessment: Current assessment

        Returns:
            Comparison analysis
        """
        score_change = (
            current_assessment.overall_compliance_score -
            previous_assessment.overall_compliance_score
        )

        # Identify control status changes
        prev_compliant = set(previous_assessment.fully_compliant_controls)
        curr_compliant = set(current_assessment.fully_compliant_controls)

        newly_compliant = list(curr_compliant - prev_compliant)
        newly_non_compliant = list(prev_compliant - curr_compliant)

        # Family score changes
        family_trends = {}
        for family, score in current_assessment.control_family_scores.items():
            prev_score = previous_assessment.control_family_scores.get(family, 0)
            family_trends[family] = {
                'previous': prev_score,
                'current': score,
                'change': score - prev_score,
                'trend': 'improving' if score > prev_score else 'declining' if score < prev_score else 'stable',
            }

        return {
            'overall_trend': 'improving' if score_change > 0 else 'declining' if score_change < 0 else 'stable',
            'score_change': score_change,
            'previous_score': previous_assessment.overall_compliance_score,
            'current_score': current_assessment.overall_compliance_score,
            'newly_compliant_controls': newly_compliant,
            'newly_non_compliant_controls': newly_non_compliant,
            'family_trends': family_trends,
            'gap_count_change': len(current_assessment.gaps) - len(previous_assessment.gaps),
        }

    def _format_context(self, context: Dict[str, Any]) -> str:
        """Format context dictionary for prompts."""
        if not context:
            return "No additional context provided."

        lines = []
        for key, value in context.items():
            if isinstance(value, list):
                value = ', '.join(str(v) for v in value)
            elif isinstance(value, dict):
                value = str(value)
            lines.append(f"- {key}: {value}")

        return '\n'.join(lines)

    def _summarize_controls(self, controls_data: List[Dict[str, Any]]) -> str:
        """Summarize controls data for LLM processing."""
        if not controls_data:
            return "No control data provided."

        lines = []
        for control in controls_data[:50]:  # Limit for context
            control_id = control.get('control_id', 'Unknown')
            status = control.get('implementation_status', 'unknown')
            description = control.get('description', '')[:100]
            lines.append(f"- {control_id} [{status}]: {description}")

        return '\n'.join(lines)

    def _parse_evaluation_response(
        self,
        content: str,
        control_id: str
    ) -> ControlEvaluation:
        """Parse LLM response for control evaluation."""
        result = ControlEvaluation(
            control_id=control_id,
            effectiveness_rating='not_implemented',
            effectiveness_score=0.0,
        )

        lines = content.split('\n')
        current_section = None

        for line in lines:
            line = line.strip()

            if line.startswith('EFFECTIVENESS_RATING:'):
                rating = line[21:].strip().lower()
                valid_ratings = [
                    'fully_effective', 'largely_effective', 'partially_effective',
                    'largely_ineffective', 'ineffective', 'not_implemented'
                ]
                if rating in valid_ratings:
                    result.effectiveness_rating = rating
            elif line.startswith('EFFECTIVENESS_SCORE:'):
                try:
                    score = float(line[20:].strip())
                    result.effectiveness_score = max(0.0, min(1.0, score))
                except ValueError:
                    pass
            elif line.startswith('STRENGTHS:'):
                current_section = 'strengths'
            elif line.startswith('WEAKNESSES:'):
                current_section = 'weaknesses'
            elif line.startswith('RECOMMENDATIONS:'):
                current_section = 'recommendations'
            elif line.startswith('EVIDENCE_ASSESSMENT:'):
                result.evidence_assessment = line[20:].strip()
                current_section = None
            elif line.startswith('AUDIT_OBSERVATIONS:'):
                result.audit_observations = line[19:].strip()
                current_section = None
            elif line.startswith('- ') and current_section:
                item = line[2:].strip()
                if current_section == 'strengths':
                    result.strengths.append(item)
                elif current_section == 'weaknesses':
                    result.weaknesses.append(item)
                elif current_section == 'recommendations':
                    result.recommendations.append(item)

        return result

    def _parse_gaps_response(self, content: str) -> List[GapFinding]:
        """Parse LLM response for gap analysis."""
        gaps = []
        gap_blocks = content.split('---')

        for block in gap_blocks:
            if 'GAP:' not in block and 'ID:' not in block:
                continue

            gap_data = {
                'gap_id': '',
                'title': '',
                'description': '',
                'severity': 'medium',
                'affected_controls': [],
                'root_cause': None,
                'remediation_recommendation': None,
                'estimated_effort': None,
                'risk_if_not_addressed': None,
            }

            lines = block.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('ID:'):
                    gap_data['gap_id'] = line[3:].strip()
                elif line.startswith('TITLE:'):
                    gap_data['title'] = line[6:].strip()
                elif line.startswith('DESCRIPTION:'):
                    gap_data['description'] = line[12:].strip()
                elif line.startswith('SEVERITY:'):
                    sev = line[9:].strip().lower()
                    if sev in ['critical', 'high', 'medium', 'low', 'informational']:
                        gap_data['severity'] = sev
                elif line.startswith('AFFECTED_CONTROLS:'):
                    controls = line[18:].strip()
                    if controls:
                        gap_data['affected_controls'] = [
                            c.strip() for c in controls.split(',')
                        ]
                elif line.startswith('ROOT_CAUSE:'):
                    gap_data['root_cause'] = line[11:].strip()
                elif line.startswith('REMEDIATION:'):
                    gap_data['remediation_recommendation'] = line[12:].strip()
                elif line.startswith('EFFORT:'):
                    gap_data['estimated_effort'] = line[7:].strip()
                elif line.startswith('RISK:'):
                    gap_data['risk_if_not_addressed'] = line[5:].strip()

            if gap_data['gap_id'] and gap_data['title']:
                gaps.append(GapFinding(**gap_data))

        return gaps

    def _parse_compliance_response(
        self,
        content: str,
        framework: str
    ) -> ComplianceAssessment:
        """Parse LLM response for compliance assessment."""
        result = ComplianceAssessment(
            framework=framework,
            overall_compliance_score=0.0,
        )

        lines = content.split('\n')
        current_section = None

        for line in lines:
            line = line.strip()

            if line.startswith('OVERALL_SCORE:'):
                try:
                    score = float(line[14:].strip())
                    result.overall_compliance_score = max(0.0, min(1.0, score))
                except ValueError:
                    pass
            elif line.startswith('SUMMARY:'):
                result.summary = line[8:].strip()
            elif line.startswith('FULLY_COMPLIANT:'):
                controls = line[16:].strip()
                if controls:
                    result.fully_compliant_controls = [
                        c.strip() for c in controls.split(',')
                    ]
            elif line.startswith('PARTIALLY_COMPLIANT:'):
                controls = line[20:].strip()
                if controls:
                    result.partially_compliant_controls = [
                        c.strip() for c in controls.split(',')
                    ]
            elif line.startswith('NON_COMPLIANT:'):
                controls = line[14:].strip()
                if controls:
                    result.non_compliant_controls = [
                        c.strip() for c in controls.split(',')
                    ]
            elif line.startswith('FAMILY_SCORES:'):
                current_section = 'family_scores'
            elif line.startswith('KEY_FINDINGS:'):
                current_section = 'findings'
            elif line.startswith('- ') and current_section == 'family_scores':
                # Parse "- Family Name: Score"
                family_line = line[2:].strip()
                if ':' in family_line:
                    family, score_str = family_line.rsplit(':', 1)
                    try:
                        score = float(score_str.strip())
                        result.control_family_scores[family.strip()] = score
                    except ValueError:
                        pass

        return result

    def _parse_evidence_response(
        self,
        content: str,
        evidence_type: str
    ) -> EvidenceReview:
        """Parse LLM response for evidence review."""
        result = EvidenceReview(
            evidence_id='',
            evidence_type=evidence_type,
            relevance_score=0.0,
            sufficiency_rating='insufficient',
            currency_assessment='unknown',
            reliability_assessment='low',
        )

        lines = content.split('\n')
        current_section = None

        for line in lines:
            line = line.strip()

            if line.startswith('RELEVANCE_SCORE:'):
                try:
                    score = float(line[16:].strip())
                    result.relevance_score = max(0.0, min(1.0, score))
                except ValueError:
                    pass
            elif line.startswith('SUFFICIENCY:'):
                suff = line[12:].strip().lower()
                if suff in ['sufficient', 'partially_sufficient', 'insufficient']:
                    result.sufficiency_rating = suff
            elif line.startswith('CURRENCY:'):
                curr = line[9:].strip().lower()
                if curr in ['current', 'outdated', 'unknown']:
                    result.currency_assessment = curr
            elif line.startswith('RELIABILITY:'):
                rel = line[12:].strip().lower()
                if rel in ['high', 'medium', 'low']:
                    result.reliability_assessment = rel
            elif line.startswith('OBSERVATIONS:'):
                current_section = 'observations'
            elif line.startswith('RECOMMENDATIONS:'):
                current_section = 'recommendations'
            elif line.startswith('- ') and current_section:
                item = line[2:].strip()
                if current_section == 'observations':
                    result.observations.append(item)
                elif current_section == 'recommendations':
                    result.recommendations.append(item)

        return result

    def _map_rating_to_severity(self, rating: str) -> str:
        """Map effectiveness rating to finding severity."""
        mapping = {
            'ineffective': 'critical',
            'not_implemented': 'critical',
            'largely_ineffective': 'high',
            'partially_effective': 'medium',
            'largely_effective': 'low',
            'fully_effective': 'informational',
        }
        return mapping.get(rating, 'medium')


# Singleton instance
_ai_auditor_service: Optional[AIAuditorService] = None


def get_ai_auditor_service() -> AIAuditorService:
    """Get or create the AI Auditor service instance."""
    global _ai_auditor_service
    if _ai_auditor_service is None:
        _ai_auditor_service = AIAuditorService()
    return _ai_auditor_service
