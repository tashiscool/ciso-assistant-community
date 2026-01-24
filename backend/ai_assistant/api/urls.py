"""
AI Assistant API URLs
"""

from django.urls import path
from .views import (
    RequirementSuggestionsView,
    RiskSuggestionsView,
    ControlSuggestionsView,
    EvidenceSuggestionsView,
    ComplianceGapAnalysisView,
    BulkSuggestionsView,
    # AI Author
    AIAuthorDraftControlView,
    AIAuthorDraftPolicyView,
    AIAuthorDraftProcedureView,
    AIAuthorDraftSSPView,
    AIAuthorImproveTextView,
    # AI Extractor
    AIExtractorUploadView,
    AIExtractorTextView,
    AIExtractorMapControlsView,
    AIExtractorCoverageAnalysisView,
    # AI Auditor
    AIAuditorEvaluateControlView,
    AIAuditorGapAnalysisView,
    AIAuditorComplianceAssessmentView,
    AIAuditorEvidenceReviewView,
    # AI Explainer
    AIExplainerControlView,
    AIExplainerRiskView,
    AIExplainerConceptView,
    AIExplainerExecutiveSummaryView,
    AIExplainerTranslateView,
)

app_name = 'ai_assistant'

urlpatterns = [
    # Suggestion Engine endpoints
    path(
        'requirement-assessments/<uuid:pk>/suggestions/',
        RequirementSuggestionsView.as_view(),
        name='requirement-suggestions',
    ),
    path(
        'risk-scenarios/<uuid:pk>/suggestions/',
        RiskSuggestionsView.as_view(),
        name='risk-suggestions',
    ),
    path(
        'applied-controls/<uuid:pk>/suggestions/',
        ControlSuggestionsView.as_view(),
        name='control-suggestions',
    ),
    path(
        'entities/<uuid:pk>/evidence-suggestions/',
        EvidenceSuggestionsView.as_view(),
        name='evidence-suggestions',
    ),
    path(
        'compliance-assessments/<uuid:pk>/gap-analysis/',
        ComplianceGapAnalysisView.as_view(),
        name='gap-analysis',
    ),
    path(
        'bulk-suggestions/',
        BulkSuggestionsView.as_view(),
        name='bulk-suggestions',
    ),

    # AI Author endpoints
    path(
        'author/draft-control/',
        AIAuthorDraftControlView.as_view(),
        name='author-draft-control',
    ),
    path(
        'author/draft-policy/',
        AIAuthorDraftPolicyView.as_view(),
        name='author-draft-policy',
    ),
    path(
        'author/draft-procedure/',
        AIAuthorDraftProcedureView.as_view(),
        name='author-draft-procedure',
    ),
    path(
        'author/draft-ssp/',
        AIAuthorDraftSSPView.as_view(),
        name='author-draft-ssp',
    ),
    path(
        'author/improve-text/',
        AIAuthorImproveTextView.as_view(),
        name='author-improve-text',
    ),

    # AI Extractor endpoints
    path(
        'extractor/upload/',
        AIExtractorUploadView.as_view(),
        name='extractor-upload',
    ),
    path(
        'extractor/text/',
        AIExtractorTextView.as_view(),
        name='extractor-text',
    ),
    path(
        'extractor/map-controls/',
        AIExtractorMapControlsView.as_view(),
        name='extractor-map-controls',
    ),
    path(
        'extractor/coverage-analysis/',
        AIExtractorCoverageAnalysisView.as_view(),
        name='extractor-coverage-analysis',
    ),

    # AI Auditor endpoints
    path(
        'auditor/evaluate-control/',
        AIAuditorEvaluateControlView.as_view(),
        name='auditor-evaluate-control',
    ),
    path(
        'auditor/gap-analysis/',
        AIAuditorGapAnalysisView.as_view(),
        name='auditor-gap-analysis',
    ),
    path(
        'auditor/compliance-assessment/',
        AIAuditorComplianceAssessmentView.as_view(),
        name='auditor-compliance-assessment',
    ),
    path(
        'auditor/evidence-review/',
        AIAuditorEvidenceReviewView.as_view(),
        name='auditor-evidence-review',
    ),

    # AI Explainer endpoints
    path(
        'explainer/control/',
        AIExplainerControlView.as_view(),
        name='explainer-control',
    ),
    path(
        'explainer/risk/',
        AIExplainerRiskView.as_view(),
        name='explainer-risk',
    ),
    path(
        'explainer/concept/',
        AIExplainerConceptView.as_view(),
        name='explainer-concept',
    ),
    path(
        'explainer/executive-summary/',
        AIExplainerExecutiveSummaryView.as_view(),
        name='explainer-executive-summary',
    ),
    path(
        'explainer/translate/',
        AIExplainerTranslateView.as_view(),
        name='explainer-translate',
    ),
]
