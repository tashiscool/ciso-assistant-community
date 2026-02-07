"""
AI POA&M Generator Service

Generates Plan of Action and Milestones (POA&M) items from vulnerability
findings and compliance findings using AI-powered analysis, including
remediation plans, milestones, and timeline estimation.
"""

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from django.utils import timezone

logger = logging.getLogger(__name__)


@dataclass
class GeneratedPOAMItem:
    """A single AI-generated POA&M item ready for review or creation."""
    weakness_id: str
    title: str
    description: str
    control_id: str
    risk_level: str
    remediation_plan: str
    milestones: List[Dict]  # [{description, target_date}]
    estimated_completion_days: int
    source_finding_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'weakness_id': self.weakness_id,
            'title': self.title,
            'description': self.description,
            'control_id': self.control_id,
            'risk_level': self.risk_level,
            'remediation_plan': self.remediation_plan,
            'milestones': self.milestones,
            'estimated_completion_days': self.estimated_completion_days,
            'source_finding_ids': self.source_finding_ids,
        }


# ---------------------------------------------------------------------------
# Severity / risk-level mapping helpers
# ---------------------------------------------------------------------------

_SEVERITY_TO_RISK = {
    'critical': 'very_high',
    'high': 'high',
    'medium': 'moderate',
    'low': 'low',
    'informational': 'very_low',
    'cat1': 'very_high',
    'cat2': 'high',
    'cat3': 'moderate',
}

_DEFAULT_COMPLETION_DAYS = {
    'very_high': 30,
    'high': 60,
    'moderate': 90,
    'low': 180,
    'very_low': 365,
}


class AIPOAMGenerator:
    """
    AI-powered POA&M item generator.

    Consumes vulnerability findings and/or compliance findings, groups
    related items, and uses an LLM to produce actionable remediation
    plans with milestones.
    """

    def __init__(self, llm_client=None):
        self._llm_client = llm_client

    @property
    def llm_client(self):
        if self._llm_client is None:
            from ai_assistant.services.llm_client import get_default_llm_client
            self._llm_client = get_default_llm_client()
        return self._llm_client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_from_findings(
        self, finding_ids: List[str]
    ) -> List[GeneratedPOAMItem]:
        """
        Generate POA&M items from a list of finding IDs.

        Accepts UUIDs that may refer to either ComplianceFinding or
        VulnerabilityFinding records.  Findings are grouped by control
        to consolidate related weaknesses into single POA&M items.

        Returns:
            List of GeneratedPOAMItem ready for review or auto-creation.
        """
        findings_data = self._load_findings(finding_ids)

        if not findings_data:
            logger.warning("No findings found for the provided IDs")
            return []

        # Group findings by control / category
        grouped = self._group_findings(findings_data)

        generated_items: List[GeneratedPOAMItem] = []
        for group_key, group_findings in grouped.items():
            item = self._generate_poam_for_group(group_key, group_findings)
            if item:
                generated_items.append(item)

        return generated_items

    def generate_from_scan_results(
        self, connector_id: str
    ) -> List[GeneratedPOAMItem]:
        """
        Generate POA&M items from the latest scan results of a connector.

        Loads the most recent VulnerabilityFinding records associated
        with the given connector/checklist and generates POA&M items
        for all open findings.
        """
        try:
            from core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding import (
                VulnerabilityFinding,
            )

            findings = VulnerabilityFinding.objects.filter(
                checklistId=connector_id,
            ).exclude(
                status_data__status__in=['not_applicable', 'not_a_finding'],
            )

            finding_ids = [str(f.id) for f in findings]
            return self.generate_from_findings(finding_ids)

        except Exception as e:
            logger.error(f"Error generating POA&M from scan results: {e}")
            return []

    def bulk_create_poam_items(
        self,
        generated_items: List[GeneratedPOAMItem],
        system_group_id: Optional[str] = None,
    ) -> List[str]:
        """
        Create actual POAMItem records from generated data.

        Args:
            generated_items: AI-generated items to persist.
            system_group_id: UUID of the system group to associate items with.

        Returns:
            List of created POAMItem UUIDs.
        """
        from poam.models.poam_item import POAMItem

        if not system_group_id:
            system_group_id = str(uuid.uuid4())

        created_ids: List[str] = []
        today = timezone.now().date()

        for item in generated_items:
            try:
                poam = POAMItem()
                poam.create_poam_item(
                    weakness_id=item.weakness_id,
                    title=item.title,
                    description=item.description,
                    system_group_id=uuid.UUID(system_group_id),
                    risk_level=item.risk_level,
                    source_type='assessment',
                    tags=['ai-generated'],
                )
                poam.control_id = item.control_id
                poam.remediation_plan = item.remediation_plan
                poam.estimated_completion_date = (
                    today + timedelta(days=item.estimated_completion_days)
                )

                # Add milestones
                for ms in item.milestones:
                    target = ms.get('target_date')
                    if isinstance(target, str):
                        try:
                            target = date.fromisoformat(target)
                        except (ValueError, TypeError):
                            target = today + timedelta(days=30)
                    elif not isinstance(target, date):
                        target = today + timedelta(days=30)

                    poam.add_milestone(
                        description=ms.get('description', ''),
                        target_date=target,
                    )

                poam.save()
                created_ids.append(str(poam.id))

            except Exception as e:
                logger.error(
                    f"Error creating POAMItem for {item.weakness_id}: {e}"
                )

        return created_ids

    # ------------------------------------------------------------------
    # Internal: loading findings
    # ------------------------------------------------------------------

    def _load_findings(self, finding_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Load findings from both ComplianceFinding and VulnerabilityFinding
        tables and normalise into a common dict shape.
        """
        results: List[Dict[str, Any]] = []

        # Try compliance findings
        try:
            from compliance.models.compliance_finding import ComplianceFinding

            cf_uuids = [uid for uid in finding_ids]
            compliance_findings = ComplianceFinding.objects.filter(
                id__in=cf_uuids
            )

            for cf in compliance_findings:
                results.append({
                    'id': str(cf.id),
                    'source': 'compliance',
                    'title': cf.finding_title,
                    'description': cf.finding_description,
                    'severity': cf.severity,
                    'control_id': cf.requirement_id or '',
                    'framework': cf.framework,
                    'finding_type': cf.finding_type,
                    'remediation_plan': cf.remediation_plan or '',
                    'root_cause': cf.root_cause or '',
                })
        except Exception as e:
            logger.debug(f"Could not load compliance findings: {e}")

        # Try vulnerability findings
        try:
            from core.bounded_contexts.rmf_operations.aggregates.vulnerability_finding import (
                VulnerabilityFinding,
            )

            remaining_ids = [
                uid for uid in finding_ids
                if uid not in {r['id'] for r in results}
            ]
            if remaining_ids:
                vuln_findings = VulnerabilityFinding.objects.filter(
                    id__in=remaining_ids
                )
                for vf in vuln_findings:
                    results.append({
                        'id': str(vf.id),
                        'source': 'vulnerability',
                        'title': vf.ruleTitle,
                        'description': vf.ruleDiscussion or '',
                        'severity': vf.severity_category,
                        'control_id': ','.join(vf.cciIds) if vf.cciIds else '',
                        'framework': 'STIG',
                        'finding_type': 'vulnerability',
                        'remediation_plan': vf.fixText or '',
                        'root_cause': '',
                    })
        except Exception as e:
            logger.debug(f"Could not load vulnerability findings: {e}")

        return results

    # ------------------------------------------------------------------
    # Internal: grouping
    # ------------------------------------------------------------------

    @staticmethod
    def _group_findings(
        findings: List[Dict[str, Any]],
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Group findings by control_id (or by individual finding if no control)."""
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for f in findings:
            key = f.get('control_id') or f.get('id', str(uuid.uuid4()))
            groups.setdefault(key, []).append(f)
        return groups

    # ------------------------------------------------------------------
    # Internal: AI generation per group
    # ------------------------------------------------------------------

    def _generate_poam_for_group(
        self,
        group_key: str,
        findings: List[Dict[str, Any]],
    ) -> Optional[GeneratedPOAMItem]:
        """Use the LLM to generate a single POA&M item for a group of findings."""
        # Determine worst-case severity
        severities = [f.get('severity', 'medium') for f in findings]
        risk_level = self._worst_risk_level(severities)
        default_days = _DEFAULT_COMPLETION_DAYS.get(risk_level, 90)

        # Build prompt
        system_prompt = self._poam_system_prompt()
        user_prompt = self._build_poam_prompt(group_key, findings, risk_level)

        messages = [
            _msg('system', system_prompt),
            _msg('user', user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.3)
            parsed = self._parse_poam_response(response.content)
        except Exception as e:
            logger.error(f"LLM error generating POA&M for {group_key}: {e}")
            parsed = {}

        # Build the GeneratedPOAMItem
        weakness_id = parsed.get(
            'weakness_id',
            f"POAM-{uuid.uuid4().hex[:8].upper()}",
        )
        title = parsed.get('title', findings[0].get('title', group_key))
        description = parsed.get(
            'description',
            '; '.join(f.get('description', '')[:200] for f in findings),
        )
        remediation_plan = parsed.get('remediation_plan', '')
        milestones = parsed.get('milestones', [])
        estimated_days = parsed.get('estimated_completion_days', default_days)

        # Compute target dates for milestones if only days offset given
        today = timezone.now().date()
        for ms in milestones:
            if 'target_date' not in ms and 'days_from_now' in ms:
                ms['target_date'] = (
                    today + timedelta(days=ms['days_from_now'])
                ).isoformat()
            elif 'target_date' not in ms:
                ms['target_date'] = (today + timedelta(days=30)).isoformat()

        return GeneratedPOAMItem(
            weakness_id=weakness_id,
            title=title,
            description=description,
            control_id=group_key,
            risk_level=risk_level,
            remediation_plan=remediation_plan,
            milestones=milestones,
            estimated_completion_days=estimated_days,
            source_finding_ids=[f['id'] for f in findings],
        )

    # ------------------------------------------------------------------
    # Prompt construction
    # ------------------------------------------------------------------

    @staticmethod
    def _poam_system_prompt() -> str:
        return """You are an expert security compliance analyst generating Plan of Action and Milestones (POA&M) items.

Given a set of related security findings, produce a consolidated POA&M item with:
1. A unique weakness ID (format: POAM-XXXXXXXX)
2. A clear title
3. A comprehensive description of the weakness
4. A detailed remediation plan
5. Milestones with estimated days from now for each step
6. Total estimated completion days

Respond ONLY with a valid JSON object with these keys:
  "weakness_id" (string),
  "title" (string, max 200 chars),
  "description" (string),
  "remediation_plan" (string),
  "milestones" (array of {"description": string, "days_from_now": int}),
  "estimated_completion_days" (int)

Be specific and actionable in your remediation plan. Milestones should be
measurable and progressive."""

    @staticmethod
    def _build_poam_prompt(
        group_key: str,
        findings: List[Dict[str, Any]],
        risk_level: str,
    ) -> str:
        finding_descriptions = []
        for i, f in enumerate(findings):
            finding_descriptions.append(
                f"Finding {i + 1}:\n"
                f"  Title: {f.get('title', 'N/A')}\n"
                f"  Description: {f.get('description', 'N/A')[:500]}\n"
                f"  Severity: {f.get('severity', 'N/A')}\n"
                f"  Framework: {f.get('framework', 'N/A')}\n"
                f"  Existing Remediation Info: {f.get('remediation_plan', 'None')[:300]}\n"
                f"  Root Cause: {f.get('root_cause', 'Not specified')[:200]}\n"
            )

        return f"""Generate a POA&M item for the following related findings.

Control / Group Key: {group_key}
Risk Level: {risk_level}
Number of Related Findings: {len(findings)}

{chr(10).join(finding_descriptions)}

Create a consolidated POA&M item that addresses all these findings together."""

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------

    def _parse_poam_response(self, content: str) -> Dict[str, Any]:
        """Parse the LLM JSON response for a generated POA&M item."""
        try:
            return self._extract_json_object(content)
        except Exception:
            logger.warning("Could not parse POA&M generation response as JSON")
            return {}

    @staticmethod
    def _extract_json_object(content: str) -> dict:
        """Extract a JSON object from LLM text that may contain markdown fences."""
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        if '```' in content:
            block = content.split('```')[1]
            if block.startswith('json'):
                block = block[4:]
            block = block.strip()
            try:
                return json.loads(block)
            except json.JSONDecodeError:
                pass

        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        return {}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _worst_risk_level(severities: List[str]) -> str:
        """Determine the worst (highest) risk level from a list of severities."""
        order = ['very_high', 'high', 'moderate', 'low', 'very_low']
        mapped = [_SEVERITY_TO_RISK.get(s, 'moderate') for s in severities]
        for level in order:
            if level in mapped:
                return level
        return 'moderate'


def _msg(role: str, content: str):
    """Helper to create an LLMMessage without importing at module level."""
    from ai_assistant.services.llm_client import LLMMessage
    return LLMMessage(role=role, content=content)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

_ai_poam_generator: Optional[AIPOAMGenerator] = None


def get_ai_poam_generator() -> AIPOAMGenerator:
    """Get or create the AI POA&M Generator singleton."""
    global _ai_poam_generator
    if _ai_poam_generator is None:
        _ai_poam_generator = AIPOAMGenerator()
    return _ai_poam_generator
