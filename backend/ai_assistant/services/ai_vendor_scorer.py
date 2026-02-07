"""
AI Vendor Scorer Service

Provides AI-powered scoring of vendor risk assessments based on
questionnaire responses, generating overall scores, category breakdowns,
strengths, weaknesses, and recommendations.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .llm_client import get_default_llm_client, LLMMessage

logger = logging.getLogger(__name__)


SCORING_CATEGORIES = [
    'security_controls',
    'data_protection',
    'access_management',
    'incident_response',
    'business_continuity',
    'compliance_posture',
    'vulnerability_management',
    'third_party_management',
]

RISK_RATING_THRESHOLDS = {
    'critical': (0, 25),
    'high': (25, 50),
    'medium': (50, 75),
    'low': (75, 101),
}


@dataclass
class VendorScoreResult:
    """Result of an AI-powered vendor risk scoring."""
    overall_score: float  # 0-100
    risk_rating: str  # critical, high, medium, low
    category_scores: Dict[str, float]
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    answer_evaluations: List[Dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'overall_score': self.overall_score,
            'risk_rating': self.risk_rating,
            'category_scores': self.category_scores,
            'strengths': self.strengths,
            'weaknesses': self.weaknesses,
            'recommendations': self.recommendations,
            'answer_evaluations': self.answer_evaluations,
        }


def _derive_risk_rating(score: float) -> str:
    """Derive risk rating from a 0-100 score."""
    for rating, (low, high) in RISK_RATING_THRESHOLDS.items():
        if low <= score < high:
            return rating
    return 'medium'


class AIVendorScorerService:
    """
    AI-powered vendor risk scoring service.

    Evaluates vendor questionnaire responses using an LLM to produce
    quantitative scores, qualitative analysis, and actionable recommendations.
    """

    def __init__(self, llm_client=None):
        self._llm_client = llm_client

    @property
    def llm_client(self):
        if self._llm_client is None:
            self._llm_client = get_default_llm_client()
        return self._llm_client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def score_vendor_assessment(
        self,
        entity_assessment_id: str,
        questionnaire_responses: Optional[List[Dict]] = None,
    ) -> VendorScoreResult:
        """
        Score a vendor based on their questionnaire responses.

        Args:
            entity_assessment_id: UUID of the EntityAssessment.
            questionnaire_responses: Optional pre-loaded responses.
                Each dict should contain at minimum:
                    question (str), answer (str),
                and optionally: category (str), weight (float 0-1).

        Returns:
            VendorScoreResult with full scoring breakdown.
        """
        if not questionnaire_responses:
            questionnaire_responses = self._fetch_responses_from_db(
                entity_assessment_id
            )

        if not questionnaire_responses:
            return VendorScoreResult(
                overall_score=0.0,
                risk_rating='critical',
                category_scores={},
                strengths=[],
                weaknesses=['No questionnaire responses available for scoring.'],
                recommendations=['Complete the vendor questionnaire before scoring.'],
                answer_evaluations=[],
            )

        # Step 1 -- score individual answers
        answer_evaluations = self.score_individual_answers(questionnaire_responses)

        # Step 2 -- aggregate into category and overall scores
        category_scores = self._aggregate_category_scores(answer_evaluations)
        overall_score = self._compute_overall_score(category_scores)
        risk_rating = _derive_risk_rating(overall_score)

        # Step 3 -- generate qualitative analysis
        analysis = self._generate_qualitative_analysis(
            answer_evaluations, category_scores, overall_score
        )

        return VendorScoreResult(
            overall_score=round(overall_score, 1),
            risk_rating=risk_rating,
            category_scores={k: round(v, 1) for k, v in category_scores.items()},
            strengths=analysis.get('strengths', []),
            weaknesses=analysis.get('weaknesses', []),
            recommendations=analysis.get('recommendations', []),
            answer_evaluations=answer_evaluations,
        )

    def score_individual_answers(
        self, questions_and_answers: List[Dict]
    ) -> List[Dict]:
        """
        Score each individual questionnaire answer using the LLM.

        Returns a list of dicts, each with:
            question, answer, score (0-100), justification, category
        """
        prompt = self._build_answer_scoring_prompt(questions_and_answers)

        messages = [
            LLMMessage(
                role='system',
                content=self._answer_scoring_system_prompt(),
            ),
            LLMMessage(role='user', content=prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.2)
            evaluations = self._parse_answer_evaluations(
                response.content, questions_and_answers
            )
            return evaluations
        except Exception as e:
            logger.error(f"Error scoring individual answers: {e}")
            # Return basic evaluations on failure
            return [
                {
                    'question': qa.get('question', ''),
                    'answer': qa.get('answer', ''),
                    'score': 50.0,
                    'justification': f'Scoring unavailable: {str(e)}',
                    'category': qa.get('category', 'general'),
                }
                for qa in questions_and_answers
            ]

    def generate_vendor_risk_summary(
        self, score_result: VendorScoreResult, vendor_name: str
    ) -> str:
        """
        Generate an executive summary of vendor risk.

        Args:
            score_result: Previously computed VendorScoreResult.
            vendor_name: Human-readable vendor name.

        Returns:
            Markdown-formatted executive summary string.
        """
        system_prompt = (
            "You are a cybersecurity risk analyst writing executive summaries "
            "about third-party vendor risk for senior leadership. "
            "Be concise, factual, and actionable."
        )

        user_prompt = f"""Write an executive risk summary for vendor "{vendor_name}".

Overall Score: {score_result.overall_score}/100
Risk Rating: {score_result.risk_rating.upper()}

Category Scores:
{self._format_category_scores(score_result.category_scores)}

Key Strengths:
{self._format_list(score_result.strengths)}

Key Weaknesses:
{self._format_list(score_result.weaknesses)}

Recommendations:
{self._format_list(score_result.recommendations)}

Write a 3-5 paragraph executive summary covering:
1. Overall risk posture and suitability
2. Critical areas of concern
3. Recommended next steps or conditions for engagement
"""

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.4)
            return response.content.strip()
        except Exception as e:
            logger.error(f"Error generating vendor risk summary: {e}")
            return (
                f"Error generating executive summary for {vendor_name}: {str(e)}"
            )

    # ------------------------------------------------------------------
    # Prompt construction
    # ------------------------------------------------------------------

    @staticmethod
    def _answer_scoring_system_prompt() -> str:
        return """You are an expert third-party risk management analyst evaluating vendor questionnaire responses.

For each question-answer pair, provide:
1. A score from 0 to 100 (where 100 = fully satisfactory, 0 = completely inadequate)
2. A brief justification for the score
3. The security category the question falls under

Respond ONLY with a valid JSON array. Each element must have these keys:
  "index" (int, 0-based), "score" (float 0-100), "justification" (string), "category" (string)

Category must be one of: security_controls, data_protection, access_management,
incident_response, business_continuity, compliance_posture,
vulnerability_management, third_party_management, general.

Example:
[
  {"index": 0, "score": 85, "justification": "Strong encryption at rest and in transit.", "category": "data_protection"},
  {"index": 1, "score": 40, "justification": "No documented incident response plan.", "category": "incident_response"}
]"""

    def _build_answer_scoring_prompt(
        self, questions_and_answers: List[Dict]
    ) -> str:
        lines = ["Score the following vendor questionnaire responses:\n"]
        for idx, qa in enumerate(questions_and_answers):
            q = qa.get('question', 'N/A')
            a = qa.get('answer', 'No answer provided')
            lines.append(f"[{idx}] Question: {q}")
            lines.append(f"    Answer: {a}\n")
        return '\n'.join(lines)

    def _build_qualitative_prompt(
        self,
        answer_evaluations: List[Dict],
        category_scores: Dict[str, float],
        overall_score: float,
    ) -> str:
        eval_summary = '\n'.join(
            f"- Q: {e.get('question', '')[:80]}... | Score: {e.get('score', 'N/A')} | "
            f"Category: {e.get('category', 'N/A')}"
            for e in answer_evaluations
        )

        cat_summary = '\n'.join(
            f"- {cat}: {score:.1f}/100" for cat, score in category_scores.items()
        )

        return f"""Based on the following vendor assessment results, identify strengths, weaknesses, and recommendations.

Overall Score: {overall_score:.1f}/100

Category Scores:
{cat_summary}

Individual Answer Evaluations:
{eval_summary}

Respond ONLY with a valid JSON object with three keys:
  "strengths" (array of strings, max 5),
  "weaknesses" (array of strings, max 5),
  "recommendations" (array of strings, max 5).

Each entry should be a concise, actionable statement."""

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------

    def _parse_answer_evaluations(
        self, content: str, original_qa: List[Dict]
    ) -> List[Dict]:
        """Parse LLM JSON response into per-answer evaluation dicts."""
        parsed = self._extract_json_array(content)

        evaluations: List[Dict] = []
        for idx, qa in enumerate(original_qa):
            # Find matching entry from LLM output
            match = next((p for p in parsed if p.get('index') == idx), None)

            evaluations.append({
                'question': qa.get('question', ''),
                'answer': qa.get('answer', ''),
                'score': float(match['score']) if match and 'score' in match else 50.0,
                'justification': (
                    match.get('justification', 'No justification provided.')
                    if match
                    else 'Could not parse LLM evaluation.'
                ),
                'category': (
                    match.get('category', qa.get('category', 'general'))
                    if match
                    else qa.get('category', 'general')
                ),
            })

        return evaluations

    def _parse_qualitative_response(self, content: str) -> Dict:
        """Parse the qualitative analysis JSON from the LLM."""
        try:
            data = self._extract_json_object(content)
            return {
                'strengths': data.get('strengths', [])[:5],
                'weaknesses': data.get('weaknesses', [])[:5],
                'recommendations': data.get('recommendations', [])[:5],
            }
        except Exception:
            logger.warning("Could not parse qualitative analysis as JSON")
            return {
                'strengths': [],
                'weaknesses': [],
                'recommendations': ['Review vendor responses manually.'],
            }

    # ------------------------------------------------------------------
    # Aggregation helpers
    # ------------------------------------------------------------------

    def _aggregate_category_scores(
        self, evaluations: List[Dict]
    ) -> Dict[str, float]:
        """Compute average score per category from individual evaluations."""
        buckets: Dict[str, List[float]] = {}
        for ev in evaluations:
            cat = ev.get('category', 'general')
            score = ev.get('score', 50.0)
            buckets.setdefault(cat, []).append(score)

        return {
            cat: sum(scores) / len(scores) for cat, scores in buckets.items()
        }

    @staticmethod
    def _compute_overall_score(category_scores: Dict[str, float]) -> float:
        """Compute weighted overall score from category scores."""
        if not category_scores:
            return 0.0

        # Equal weighting across categories
        scores = list(category_scores.values())
        return sum(scores) / len(scores)

    # ------------------------------------------------------------------
    # LLM qualitative analysis step
    # ------------------------------------------------------------------

    def _generate_qualitative_analysis(
        self,
        answer_evaluations: List[Dict],
        category_scores: Dict[str, float],
        overall_score: float,
    ) -> Dict:
        """Use LLM to derive strengths / weaknesses / recommendations."""
        system_prompt = (
            "You are an expert third-party risk management analyst. "
            "Analyze vendor assessment data and provide structured findings."
        )

        user_prompt = self._build_qualitative_prompt(
            answer_evaluations, category_scores, overall_score
        )

        messages = [
            LLMMessage(role='system', content=system_prompt),
            LLMMessage(role='user', content=user_prompt),
        ]

        try:
            response = self.llm_client.chat(messages, temperature=0.3)
            return self._parse_qualitative_response(response.content)
        except Exception as e:
            logger.error(f"Error generating qualitative analysis: {e}")
            return {
                'strengths': [],
                'weaknesses': [],
                'recommendations': [f'Analysis unavailable: {str(e)}'],
            }

    # ------------------------------------------------------------------
    # Database helpers
    # ------------------------------------------------------------------

    def _fetch_responses_from_db(
        self, entity_assessment_id: str
    ) -> List[Dict]:
        """
        Fetch questionnaire responses for an entity assessment.

        Attempts to load the linked compliance assessment's requirement
        assessments and format them as question/answer pairs.
        """
        try:
            from tprm.models import EntityAssessment

            assessment = EntityAssessment.objects.select_related(
                'compliance_assessment', 'entity'
            ).get(id=entity_assessment_id)

            if not assessment.compliance_assessment:
                logger.warning(
                    f"EntityAssessment {entity_assessment_id} has no linked "
                    "compliance assessment."
                )
                return []

            # Attempt to fetch requirement assessments from the compliance module
            try:
                from compliance.models.requirement_assessment import (
                    RequirementAssessment,
                )

                requirement_assessments = RequirementAssessment.objects.filter(
                    compliance_assessment_id=assessment.compliance_assessment.id
                )

                responses = []
                for ra in requirement_assessments:
                    responses.append({
                        'question': (
                            f"{ra.requirement_id}: {ra.requirement_title}\n"
                            f"{ra.requirement_description}"
                        ),
                        'answer': getattr(ra, 'observation', '') or '',
                        'category': 'general',
                    })
                return responses

            except ImportError:
                # Fallback: try core model RequirementAssessment
                from core.models import RequirementAssessment as CoreRA

                ras = CoreRA.objects.filter(
                    compliance_assessment=assessment.compliance_assessment
                )
                responses = []
                for ra in ras:
                    responses.append({
                        'question': str(ra.requirement) if hasattr(ra, 'requirement') else str(ra),
                        'answer': getattr(ra, 'observation', '') or '',
                        'category': 'general',
                    })
                return responses

        except Exception as e:
            logger.error(
                f"Error fetching responses for assessment "
                f"{entity_assessment_id}: {e}"
            )
            return []

    # ------------------------------------------------------------------
    # JSON extraction utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_json_array(content: str) -> list:
        """Extract a JSON array from LLM text that may contain markdown fences."""
        # Try direct parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code block
        if '```' in content:
            block = content.split('```')[1]
            if block.startswith('json'):
                block = block[4:]
            block = block.strip()
            try:
                return json.loads(block)
            except json.JSONDecodeError:
                pass

        # Try regex extraction
        match = re.search(r'\[.*\]', content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        logger.warning("Could not extract JSON array from LLM response")
        return []

    @staticmethod
    def _extract_json_object(content: str) -> dict:
        """Extract a JSON object from LLM text."""
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

        logger.warning("Could not extract JSON object from LLM response")
        return {}

    # ------------------------------------------------------------------
    # Formatting helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _format_category_scores(scores: Dict[str, float]) -> str:
        if not scores:
            return "  No category scores available."
        return '\n'.join(f"  - {cat}: {score:.1f}/100" for cat, score in scores.items())

    @staticmethod
    def _format_list(items: List[str]) -> str:
        if not items:
            return "  None identified."
        return '\n'.join(f"  - {item}" for item in items)


# ---------------------------------------------------------------------------
# Singleton / factory
# ---------------------------------------------------------------------------

_ai_vendor_scorer_service: Optional[AIVendorScorerService] = None


def get_ai_vendor_scorer_service() -> AIVendorScorerService:
    """Get or create the AI Vendor Scorer service singleton."""
    global _ai_vendor_scorer_service
    if _ai_vendor_scorer_service is None:
        _ai_vendor_scorer_service = AIVendorScorerService()
    return _ai_vendor_scorer_service
