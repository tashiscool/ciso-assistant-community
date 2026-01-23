"""
AI Suggestion Engine

Provides intelligent suggestions for compliance, risk management, and evidence collection.
Uses rule-based logic with optional LLM integration for enhanced recommendations.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import json
import re
from .context_builder import SuggestionContext, ContextBuilder


class SuggestionType(str, Enum):
    """Types of suggestions the engine can provide."""
    CONTROL_RECOMMENDATION = 'control_recommendation'
    EVIDENCE_SUGGESTION = 'evidence_suggestion'
    REMEDIATION_GUIDANCE = 'remediation_guidance'
    RISK_MITIGATION = 'risk_mitigation'
    IMPLEMENTATION_GUIDANCE = 'implementation_guidance'
    COMPLIANCE_GAP = 'compliance_gap'


@dataclass
class Suggestion:
    """A single AI-generated suggestion."""
    type: SuggestionType
    title: str
    description: str
    priority: str  # 'high', 'medium', 'low'
    confidence: float  # 0.0 to 1.0
    action_items: List[str] = field(default_factory=list)
    related_resources: List[Dict[str, str]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': self.type.value,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'confidence': self.confidence,
            'action_items': self.action_items,
            'related_resources': self.related_resources,
            'metadata': self.metadata,
        }


class SuggestionEngine:
    """
    AI-powered suggestion engine for GRC operations.

    Provides intelligent recommendations based on:
    - Compliance requirements and gaps
    - Risk scenarios and mitigations
    - Control implementations
    - Evidence collection needs
    """

    # Knowledge base for common control recommendations by category
    CONTROL_KNOWLEDGE_BASE = {
        'access_control': {
            'controls': [
                'Implement multi-factor authentication (MFA)',
                'Apply principle of least privilege',
                'Implement role-based access control (RBAC)',
                'Enable session timeout policies',
                'Implement account lockout after failed attempts',
            ],
            'evidences': [
                'Access control policy documentation',
                'MFA enrollment records',
                'User access review reports',
                'Privileged access management logs',
            ]
        },
        'audit_logging': {
            'controls': [
                'Enable comprehensive audit logging',
                'Implement log aggregation and SIEM',
                'Configure log retention policies',
                'Enable tamper-proof logging',
            ],
            'evidences': [
                'Audit log configuration screenshots',
                'SIEM dashboard reports',
                'Log retention policy documentation',
                'Log review procedures',
            ]
        },
        'encryption': {
            'controls': [
                'Implement encryption at rest for sensitive data',
                'Enable TLS 1.3 for data in transit',
                'Implement key management procedures',
                'Use approved cryptographic algorithms',
            ],
            'evidences': [
                'Encryption configuration documentation',
                'TLS certificate inventory',
                'Key management procedures',
                'Cryptographic assessment reports',
            ]
        },
        'incident_response': {
            'controls': [
                'Develop incident response plan',
                'Establish incident response team',
                'Implement automated alerting',
                'Conduct regular incident response drills',
            ],
            'evidences': [
                'Incident response plan document',
                'IR team roster and contact info',
                'Incident response drill reports',
                'Post-incident review documentation',
            ]
        },
        'vulnerability_management': {
            'controls': [
                'Implement continuous vulnerability scanning',
                'Establish patch management process',
                'Define vulnerability remediation SLAs',
                'Conduct regular penetration testing',
            ],
            'evidences': [
                'Vulnerability scan reports',
                'Patch management records',
                'Penetration test reports',
                'Remediation tracking documentation',
            ]
        },
        'configuration_management': {
            'controls': [
                'Implement secure baseline configurations',
                'Enable configuration change management',
                'Automate configuration compliance checks',
                'Maintain configuration inventory',
            ],
            'evidences': [
                'Baseline configuration documentation',
                'Configuration change records',
                'Compliance scan reports',
                'System inventory documentation',
            ]
        },
        'data_protection': {
            'controls': [
                'Implement data classification scheme',
                'Enable data loss prevention (DLP)',
                'Implement data retention policies',
                'Enable backup and recovery procedures',
            ],
            'evidences': [
                'Data classification policy',
                'DLP configuration and reports',
                'Backup verification records',
                'Data retention schedule',
            ]
        },
        'network_security': {
            'controls': [
                'Implement network segmentation',
                'Deploy next-generation firewalls',
                'Enable intrusion detection/prevention',
                'Implement secure DNS',
            ],
            'evidences': [
                'Network architecture diagrams',
                'Firewall rule documentation',
                'IDS/IPS configuration and alerts',
                'Network security assessment reports',
            ]
        },
    }

    # FedRAMP-specific control families
    FEDRAMP_CONTROL_FAMILIES = {
        'AC': 'access_control',
        'AU': 'audit_logging',
        'SC': 'encryption',
        'IR': 'incident_response',
        'RA': 'vulnerability_management',
        'CM': 'configuration_management',
        'MP': 'data_protection',
        'CA': 'audit_logging',
        'CP': 'incident_response',
        'IA': 'access_control',
        'PE': 'access_control',
        'PL': 'configuration_management',
        'PS': 'access_control',
        'SA': 'configuration_management',
        'SI': 'vulnerability_management',
    }

    def __init__(self, llm_client=None):
        """
        Initialize the suggestion engine.

        Args:
            llm_client: Optional LLM client for enhanced suggestions.
                       If not provided, uses rule-based suggestions only.
        """
        self.llm_client = llm_client
        self.context_builder = ContextBuilder()

    def get_requirement_suggestions(
        self,
        requirement_assessment_id: str,
        suggestion_types: Optional[List[SuggestionType]] = None
    ) -> List[Suggestion]:
        """
        Get AI suggestions for a requirement assessment.

        Args:
            requirement_assessment_id: UUID of the requirement assessment
            suggestion_types: Optional filter for specific suggestion types

        Returns:
            List of suggestions for the requirement
        """
        context = self.context_builder.build_requirement_context(requirement_assessment_id)
        suggestions = []

        # Determine relevant control category from requirement
        category = self._determine_control_category(context)

        # Generate control recommendations
        if not suggestion_types or SuggestionType.CONTROL_RECOMMENDATION in suggestion_types:
            suggestions.extend(self._generate_control_suggestions(context, category))

        # Generate evidence suggestions
        if not suggestion_types or SuggestionType.EVIDENCE_SUGGESTION in suggestion_types:
            suggestions.extend(self._generate_evidence_suggestions(context, category))

        # Generate remediation guidance if there are gaps
        if not suggestion_types or SuggestionType.REMEDIATION_GUIDANCE in suggestion_types:
            suggestions.extend(self._generate_remediation_suggestions(context))

        # If LLM is available, enhance suggestions
        if self.llm_client:
            suggestions = self._enhance_with_llm(suggestions, context)

        return suggestions

    def get_risk_suggestions(
        self,
        risk_scenario_id: str,
        suggestion_types: Optional[List[SuggestionType]] = None
    ) -> List[Suggestion]:
        """
        Get AI suggestions for a risk scenario.

        Args:
            risk_scenario_id: UUID of the risk scenario
            suggestion_types: Optional filter for specific suggestion types

        Returns:
            List of suggestions for risk mitigation
        """
        context = self.context_builder.build_risk_context(risk_scenario_id)
        suggestions = []

        # Generate risk mitigation suggestions
        if not suggestion_types or SuggestionType.RISK_MITIGATION in suggestion_types:
            suggestions.extend(self._generate_risk_mitigation_suggestions(context))

        # Generate control recommendations for risk
        if not suggestion_types or SuggestionType.CONTROL_RECOMMENDATION in suggestion_types:
            suggestions.extend(self._generate_risk_control_suggestions(context))

        return suggestions

    def get_control_suggestions(
        self,
        applied_control_id: str,
        suggestion_types: Optional[List[SuggestionType]] = None
    ) -> List[Suggestion]:
        """
        Get AI suggestions for control implementation.

        Args:
            applied_control_id: UUID of the applied control
            suggestion_types: Optional filter for specific suggestion types

        Returns:
            List of implementation suggestions
        """
        context = self.context_builder.build_control_context(applied_control_id)
        suggestions = []

        # Generate implementation guidance
        if not suggestion_types or SuggestionType.IMPLEMENTATION_GUIDANCE in suggestion_types:
            suggestions.extend(self._generate_implementation_suggestions(context))

        # Generate evidence suggestions for control
        if not suggestion_types or SuggestionType.EVIDENCE_SUGGESTION in suggestion_types:
            category = self._determine_control_category(context)
            suggestions.extend(self._generate_evidence_suggestions(context, category))

        return suggestions

    def get_evidence_suggestions(
        self,
        entity_type: str,
        entity_id: str
    ) -> List[Suggestion]:
        """
        Get AI suggestions for evidence collection.

        Args:
            entity_type: Type of entity ('requirement_assessment', 'applied_control', etc.)
            entity_id: UUID of the entity

        Returns:
            List of evidence collection suggestions
        """
        if entity_type == 'requirement_assessment':
            context = self.context_builder.build_requirement_context(entity_id)
        elif entity_type == 'applied_control':
            context = self.context_builder.build_control_context(entity_id)
        else:
            context = self.context_builder.build_evidence_context(entity_id)

        category = self._determine_control_category(context)
        return self._generate_evidence_suggestions(context, category)

    def get_compliance_gap_analysis(
        self,
        compliance_assessment_id: str
    ) -> List[Suggestion]:
        """
        Analyze compliance gaps and generate recommendations.

        Args:
            compliance_assessment_id: UUID of the compliance assessment

        Returns:
            List of gap analysis suggestions
        """
        from core.models import ComplianceAssessment, RequirementAssessment

        suggestions = []

        try:
            assessment = ComplianceAssessment.objects.prefetch_related(
                'requirement_assessments'
            ).get(id=compliance_assessment_id)

            # Analyze requirement statuses
            non_compliant = []
            partially_compliant = []
            missing_evidence = []

            for req_assessment in assessment.requirement_assessments.all():
                if req_assessment.result in ['non_compliant', 'not_compliant']:
                    non_compliant.append(req_assessment)
                elif req_assessment.result == 'partially_compliant':
                    partially_compliant.append(req_assessment)

                # Check for missing evidence
                if not req_assessment.evidences.exists():
                    missing_evidence.append(req_assessment)

            # Generate gap suggestions
            if non_compliant:
                suggestions.append(Suggestion(
                    type=SuggestionType.COMPLIANCE_GAP,
                    title=f'{len(non_compliant)} Non-Compliant Requirements Identified',
                    description='These requirements need immediate attention to achieve compliance.',
                    priority='high',
                    confidence=0.95,
                    action_items=[
                        f'Review and address {req.requirement.name if req.requirement else "requirement"}'
                        for req in non_compliant[:5]
                    ],
                    metadata={
                        'non_compliant_count': len(non_compliant),
                        'requirement_ids': [str(r.id) for r in non_compliant],
                    }
                ))

            if partially_compliant:
                suggestions.append(Suggestion(
                    type=SuggestionType.COMPLIANCE_GAP,
                    title=f'{len(partially_compliant)} Partially Compliant Requirements',
                    description='These requirements are partially met but need additional work.',
                    priority='medium',
                    confidence=0.90,
                    action_items=[
                        'Complete implementation of partially compliant controls',
                        'Gather additional evidence for partial compliance',
                        'Document remediation plans',
                    ],
                    metadata={
                        'partially_compliant_count': len(partially_compliant),
                    }
                ))

            if missing_evidence:
                suggestions.append(Suggestion(
                    type=SuggestionType.EVIDENCE_SUGGESTION,
                    title=f'{len(missing_evidence)} Requirements Missing Evidence',
                    description='These requirements need evidence to demonstrate compliance.',
                    priority='medium',
                    confidence=0.85,
                    action_items=[
                        'Collect and upload evidence for each requirement',
                        'Set up automated evidence collection where possible',
                        'Document evidence collection procedures',
                    ],
                    metadata={
                        'missing_evidence_count': len(missing_evidence),
                    }
                ))

        except ComplianceAssessment.DoesNotExist:
            pass

        return suggestions

    def _determine_control_category(self, context: SuggestionContext) -> str:
        """Determine the control category based on context."""
        # Check requirement URN for FedRAMP control family
        entity_data = context.entity_data
        requirement_urn = entity_data.get('requirement_urn', '') or ''
        requirement_name = entity_data.get('requirement_name', '') or ''
        requirement_desc = entity_data.get('requirement_description', '') or ''

        # Check for FedRAMP control family prefix
        for prefix, category in self.FEDRAMP_CONTROL_FAMILIES.items():
            if requirement_urn.upper().startswith(prefix) or requirement_name.upper().startswith(prefix):
                return category

        # Keyword-based detection
        combined_text = f"{requirement_name} {requirement_desc}".lower()

        keyword_mapping = {
            'access_control': ['access', 'authentication', 'authorization', 'login', 'password', 'mfa', 'identity'],
            'audit_logging': ['audit', 'log', 'monitor', 'track', 'record'],
            'encryption': ['encrypt', 'cryptograph', 'key', 'tls', 'ssl', 'certificate'],
            'incident_response': ['incident', 'breach', 'response', 'recovery', 'alert'],
            'vulnerability_management': ['vulnerab', 'patch', 'scan', 'penetration', 'security test'],
            'configuration_management': ['config', 'baseline', 'change', 'version', 'inventory'],
            'data_protection': ['data', 'privacy', 'classification', 'backup', 'retention'],
            'network_security': ['network', 'firewall', 'segment', 'intrusion', 'dns'],
        }

        for category, keywords in keyword_mapping.items():
            if any(kw in combined_text for kw in keywords):
                return category

        return 'configuration_management'  # Default category

    def _generate_control_suggestions(
        self,
        context: SuggestionContext,
        category: str
    ) -> List[Suggestion]:
        """Generate control recommendations based on category."""
        suggestions = []
        knowledge = self.CONTROL_KNOWLEDGE_BASE.get(category, {})
        controls = knowledge.get('controls', [])

        # Filter out controls that are already implemented
        existing_controls = {c['name'].lower() for c in context.related_controls}

        for i, control in enumerate(controls):
            if control.lower() not in existing_controls:
                suggestions.append(Suggestion(
                    type=SuggestionType.CONTROL_RECOMMENDATION,
                    title=f'Recommended Control: {control}',
                    description=f'Consider implementing this control to address {category.replace("_", " ")} requirements.',
                    priority='high' if i < 2 else 'medium',
                    confidence=0.85 - (i * 0.05),
                    action_items=[
                        f'Evaluate applicability of {control}',
                        'Develop implementation plan',
                        'Assign responsible party',
                        'Define success criteria',
                    ],
                    metadata={
                        'category': category,
                        'control_type': 'preventive' if 'implement' in control.lower() else 'detective',
                    }
                ))

        return suggestions[:5]  # Return top 5 suggestions

    def _generate_evidence_suggestions(
        self,
        context: SuggestionContext,
        category: str
    ) -> List[Suggestion]:
        """Generate evidence collection suggestions."""
        suggestions = []
        knowledge = self.CONTROL_KNOWLEDGE_BASE.get(category, {})
        evidence_types = knowledge.get('evidences', [])

        # Filter out evidence types that already exist
        existing_evidences = {e['name'].lower() for e in context.related_evidences}

        for evidence_type in evidence_types:
            if evidence_type.lower() not in existing_evidences:
                suggestions.append(Suggestion(
                    type=SuggestionType.EVIDENCE_SUGGESTION,
                    title=f'Collect Evidence: {evidence_type}',
                    description=f'This evidence type supports demonstrating compliance with {category.replace("_", " ")} requirements.',
                    priority='medium',
                    confidence=0.80,
                    action_items=[
                        f'Identify source for {evidence_type}',
                        'Establish collection procedure',
                        'Set up regular collection schedule',
                        'Define evidence retention period',
                    ],
                    metadata={
                        'category': category,
                        'evidence_type': evidence_type,
                        'automation_potential': 'high' if 'report' in evidence_type.lower() or 'log' in evidence_type.lower() else 'medium',
                    }
                ))

        return suggestions[:4]  # Return top 4 suggestions

    def _generate_remediation_suggestions(self, context: SuggestionContext) -> List[Suggestion]:
        """Generate remediation guidance for compliance gaps."""
        suggestions = []
        entity_data = context.entity_data

        current_status = entity_data.get('current_status', '')
        result = entity_data.get('result', '')

        if result in ['non_compliant', 'not_compliant', 'partially_compliant']:
            suggestions.append(Suggestion(
                type=SuggestionType.REMEDIATION_GUIDANCE,
                title='Remediation Plan Required',
                description='A formal remediation plan should be developed to address this compliance gap.',
                priority='high',
                confidence=0.90,
                action_items=[
                    'Document current state and gap analysis',
                    'Define target state and success criteria',
                    'Identify required resources and timeline',
                    'Assign ownership and accountability',
                    'Establish progress tracking mechanism',
                    'Schedule regular review checkpoints',
                ],
                metadata={
                    'current_result': result,
                    'remediation_type': 'full' if result == 'non_compliant' else 'partial',
                }
            ))

        return suggestions

    def _generate_risk_mitigation_suggestions(self, context: SuggestionContext) -> List[Suggestion]:
        """Generate risk mitigation suggestions."""
        suggestions = []
        entity_data = context.entity_data

        current_prob = entity_data.get('current_probability', 0)
        current_impact = entity_data.get('current_impact', 0)
        treatment = entity_data.get('treatment', '')

        # Calculate risk level
        risk_score = (current_prob or 0) * (current_impact or 0)

        if risk_score > 0:
            if risk_score >= 16:
                priority = 'high'
                urgency = 'immediate'
            elif risk_score >= 8:
                priority = 'medium'
                urgency = 'short-term'
            else:
                priority = 'low'
                urgency = 'planned'

            suggestions.append(Suggestion(
                type=SuggestionType.RISK_MITIGATION,
                title=f'Risk Mitigation Strategy Required ({urgency.title()} Action)',
                description=f'This risk scenario has a calculated risk score requiring {urgency} mitigation attention.',
                priority=priority,
                confidence=0.85,
                action_items=[
                    'Review and validate risk assessment',
                    'Identify applicable mitigation controls',
                    'Evaluate cost-benefit of mitigation options',
                    'Develop and implement mitigation plan',
                    'Monitor residual risk after mitigation',
                ],
                metadata={
                    'risk_score': risk_score,
                    'current_treatment': treatment,
                    'urgency': urgency,
                }
            ))

        return suggestions

    def _generate_risk_control_suggestions(self, context: SuggestionContext) -> List[Suggestion]:
        """Generate control suggestions for risk mitigation."""
        suggestions = []
        entity_data = context.entity_data

        threat_name = entity_data.get('threat_name', '')
        threat_desc = entity_data.get('threat_description', '')

        # Map threat to control categories
        threat_text = f"{threat_name} {threat_desc}".lower()

        recommended_categories = []
        if any(kw in threat_text for kw in ['malware', 'ransomware', 'virus']):
            recommended_categories.extend(['vulnerability_management', 'network_security'])
        if any(kw in threat_text for kw in ['phishing', 'social', 'credential']):
            recommended_categories.extend(['access_control', 'audit_logging'])
        if any(kw in threat_text for kw in ['breach', 'leak', 'exfiltration']):
            recommended_categories.extend(['data_protection', 'encryption'])
        if any(kw in threat_text for kw in ['denial', 'availability', 'disruption']):
            recommended_categories.extend(['incident_response', 'network_security'])

        if not recommended_categories:
            recommended_categories = ['vulnerability_management', 'access_control']

        for category in set(recommended_categories):
            knowledge = self.CONTROL_KNOWLEDGE_BASE.get(category, {})
            controls = knowledge.get('controls', [])[:2]

            for control in controls:
                suggestions.append(Suggestion(
                    type=SuggestionType.CONTROL_RECOMMENDATION,
                    title=f'Risk Control: {control}',
                    description=f'This control can help mitigate the identified threat.',
                    priority='high',
                    confidence=0.80,
                    action_items=[
                        'Assess control applicability',
                        'Evaluate implementation requirements',
                        'Plan deployment timeline',
                    ],
                    metadata={
                        'category': category,
                        'threat_name': threat_name,
                    }
                ))

        return suggestions[:4]

    def _generate_implementation_suggestions(self, context: SuggestionContext) -> List[Suggestion]:
        """Generate implementation guidance for controls."""
        suggestions = []
        entity_data = context.entity_data

        status = entity_data.get('status', '')
        category = entity_data.get('category', '')

        if status in ['planned', 'in_progress', '']:
            suggestions.append(Suggestion(
                type=SuggestionType.IMPLEMENTATION_GUIDANCE,
                title='Control Implementation Guidance',
                description='Follow these steps to successfully implement this control.',
                priority='medium',
                confidence=0.85,
                action_items=[
                    'Define detailed implementation requirements',
                    'Identify necessary tools and resources',
                    'Create implementation timeline with milestones',
                    'Assign technical implementation team',
                    'Develop testing and validation procedures',
                    'Plan evidence collection approach',
                    'Document implementation procedures',
                ],
                metadata={
                    'current_status': status,
                    'category': category,
                }
            ))

        return suggestions

    def _enhance_with_llm(
        self,
        suggestions: List[Suggestion],
        context: SuggestionContext
    ) -> List[Suggestion]:
        """Enhance suggestions using LLM if available."""
        if not self.llm_client:
            return suggestions

        # This would integrate with an LLM API (e.g., Claude, GPT)
        # For now, return suggestions as-is
        # In production, this would call the LLM to enhance descriptions
        # and provide more contextual recommendations

        return suggestions
