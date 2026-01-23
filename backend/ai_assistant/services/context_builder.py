"""
Context Builder for AI Suggestions

Builds context from various sources to provide relevant AI suggestions.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from core.models import (
    RequirementAssessment,
    ComplianceAssessment,
    RiskScenario,
    RiskAssessment,
    AppliedControl,
    Evidence,
    Framework,
)


@dataclass
class SuggestionContext:
    """Context data for generating AI suggestions."""
    entity_type: str
    entity_id: str
    entity_data: Dict[str, Any] = field(default_factory=dict)
    related_controls: List[Dict[str, Any]] = field(default_factory=list)
    related_evidences: List[Dict[str, Any]] = field(default_factory=list)
    framework_context: Optional[Dict[str, Any]] = None
    historical_patterns: List[Dict[str, Any]] = field(default_factory=list)


class ContextBuilder:
    """Builds context for AI suggestion generation."""

    def build_requirement_context(self, requirement_assessment_id: str) -> SuggestionContext:
        """Build context for a requirement assessment."""
        try:
            req_assessment = RequirementAssessment.objects.select_related(
                'requirement',
                'compliance_assessment',
                'compliance_assessment__framework'
            ).prefetch_related(
                'applied_controls',
                'evidences'
            ).get(id=requirement_assessment_id)

            # Build entity data
            entity_data = {
                'requirement_urn': req_assessment.requirement.urn if req_assessment.requirement else None,
                'requirement_name': req_assessment.requirement.name if req_assessment.requirement else None,
                'requirement_description': req_assessment.requirement.description if req_assessment.requirement else None,
                'current_status': req_assessment.status,
                'result': req_assessment.result,
                'observation': req_assessment.observation,
            }

            # Build framework context
            framework_context = None
            if req_assessment.compliance_assessment and req_assessment.compliance_assessment.framework:
                framework = req_assessment.compliance_assessment.framework
                framework_context = {
                    'name': framework.name,
                    'urn': framework.urn,
                    'description': framework.description,
                }

            # Get related controls
            related_controls = []
            for control in req_assessment.applied_controls.all():
                related_controls.append({
                    'id': str(control.id),
                    'name': control.name,
                    'description': control.description,
                    'status': control.status,
                    'category': control.category,
                })

            # Get related evidences
            related_evidences = []
            for evidence in req_assessment.evidences.all():
                related_evidences.append({
                    'id': str(evidence.id),
                    'name': evidence.name,
                    'status': evidence.status,
                })

            return SuggestionContext(
                entity_type='requirement_assessment',
                entity_id=requirement_assessment_id,
                entity_data=entity_data,
                related_controls=related_controls,
                related_evidences=related_evidences,
                framework_context=framework_context,
            )

        except RequirementAssessment.DoesNotExist:
            return SuggestionContext(
                entity_type='requirement_assessment',
                entity_id=requirement_assessment_id,
            )

    def build_risk_context(self, risk_scenario_id: str) -> SuggestionContext:
        """Build context for a risk scenario."""
        try:
            risk_scenario = RiskScenario.objects.select_related(
                'risk_assessment',
                'threat'
            ).prefetch_related(
                'applied_controls',
                'assets'
            ).get(id=risk_scenario_id)

            # Build entity data
            entity_data = {
                'name': risk_scenario.name,
                'description': risk_scenario.description,
                'threat_name': risk_scenario.threat.name if risk_scenario.threat else None,
                'threat_description': risk_scenario.threat.description if risk_scenario.threat else None,
                'current_probability': risk_scenario.current_proba,
                'current_impact': risk_scenario.current_impact,
                'residual_probability': risk_scenario.residual_proba,
                'residual_impact': risk_scenario.residual_impact,
                'treatment': risk_scenario.treatment,
            }

            # Get related controls
            related_controls = []
            for control in risk_scenario.applied_controls.all():
                related_controls.append({
                    'id': str(control.id),
                    'name': control.name,
                    'description': control.description,
                    'status': control.status,
                    'category': control.category,
                })

            # Get affected assets
            affected_assets = []
            for asset in risk_scenario.assets.all():
                affected_assets.append({
                    'id': str(asset.id),
                    'name': asset.name,
                    'type': asset.type,
                })

            entity_data['affected_assets'] = affected_assets

            return SuggestionContext(
                entity_type='risk_scenario',
                entity_id=risk_scenario_id,
                entity_data=entity_data,
                related_controls=related_controls,
            )

        except RiskScenario.DoesNotExist:
            return SuggestionContext(
                entity_type='risk_scenario',
                entity_id=risk_scenario_id,
            )

    def build_control_context(self, applied_control_id: str) -> SuggestionContext:
        """Build context for an applied control."""
        try:
            control = AppliedControl.objects.select_related(
                'reference_control'
            ).prefetch_related(
                'evidences'
            ).get(id=applied_control_id)

            # Build entity data
            entity_data = {
                'name': control.name,
                'description': control.description,
                'status': control.status,
                'category': control.category,
                'implementation_status': getattr(control, 'implementation_status', None),
                'reference_control_name': control.reference_control.name if control.reference_control else None,
                'reference_control_description': control.reference_control.description if control.reference_control else None,
            }

            # Get related evidences
            related_evidences = []
            for evidence in control.evidences.all():
                related_evidences.append({
                    'id': str(evidence.id),
                    'name': evidence.name,
                    'status': evidence.status,
                })

            return SuggestionContext(
                entity_type='applied_control',
                entity_id=applied_control_id,
                entity_data=entity_data,
                related_evidences=related_evidences,
            )

        except AppliedControl.DoesNotExist:
            return SuggestionContext(
                entity_type='applied_control',
                entity_id=applied_control_id,
            )

    def build_evidence_context(self, evidence_id: str) -> SuggestionContext:
        """Build context for evidence collection suggestion."""
        try:
            evidence = Evidence.objects.prefetch_related(
                'applied_controls',
                'requirement_assessments'
            ).get(id=evidence_id)

            # Build entity data
            entity_data = {
                'name': evidence.name,
                'description': evidence.description,
                'status': evidence.status,
                'expiry_date': str(evidence.expiry_date) if evidence.expiry_date else None,
            }

            # Get related controls
            related_controls = []
            for control in evidence.applied_controls.all():
                related_controls.append({
                    'id': str(control.id),
                    'name': control.name,
                    'category': control.category,
                })

            return SuggestionContext(
                entity_type='evidence',
                entity_id=evidence_id,
                entity_data=entity_data,
                related_controls=related_controls,
            )

        except Evidence.DoesNotExist:
            return SuggestionContext(
                entity_type='evidence',
                entity_id=evidence_id,
            )
