"""
Security Graph URL Configuration
"""

from django.urls import path
from .api.graph_views import (
    SecurityGraphView,
    SecurityGraphFromFolderView,
    SecurityGraphFromAssetsView,
    RiskGraphView,
    BlastRadiusView,
    AttackPathsView,
    CriticalPathsView,
    CriticalNodesView,
    ImpactSummaryView,
    GraphStatisticsView,
)

urlpatterns = [
    # Main graph endpoints
    path('', SecurityGraphView.as_view(), name='security-graph'),
    path('folder/<uuid:folder_id>/', SecurityGraphFromFolderView.as_view(), name='security-graph-folder'),
    path('assets/', SecurityGraphFromAssetsView.as_view(), name='security-graph-assets'),
    path('risk/<uuid:risk_assessment_id>/', RiskGraphView.as_view(), name='risk-graph'),

    # Analysis endpoints
    path('blast-radius/', BlastRadiusView.as_view(), name='blast-radius'),
    path('attack-paths/', AttackPathsView.as_view(), name='attack-paths'),
    path('folder/<uuid:folder_id>/critical-paths/', CriticalPathsView.as_view(), name='critical-paths'),
    path('folder/<uuid:folder_id>/critical-nodes/', CriticalNodesView.as_view(), name='critical-nodes'),
    path('impact-summary/', ImpactSummaryView.as_view(), name='impact-summary'),

    # Statistics
    path('folder/<uuid:folder_id>/statistics/', GraphStatisticsView.as_view(), name='graph-statistics'),
]
