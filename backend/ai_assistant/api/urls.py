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
)

app_name = 'ai_assistant'

urlpatterns = [
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
]
