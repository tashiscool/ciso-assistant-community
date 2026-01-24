from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    QuantitativeRiskHypothesisViewSet,
    QuantitativeRiskScenarioViewSet,
    QuantitativeRiskStudyViewSet,
    QuantitativeRiskStudyActionPlanList,
    # Advanced Analytics
    PortfolioAnalysisView,
    PortfolioStressTestView,
    PortfolioCompareView,
    ControlROIView,
    TreatmentComparisonView,
    OptimalControlsView,
    BreakevenAnalysisView,
    SensitivityAnalysisView,
)

router = DefaultRouter()
router.register(
    "quantitative-risk-studies",
    QuantitativeRiskStudyViewSet,
    basename="quantitative-risk-studies",
)
router.register(
    "quantitative-risk-scenarios",
    QuantitativeRiskScenarioViewSet,
    basename="quantitative-risk-scenarios",
)
router.register(
    "quantitative-risk-hypotheses",
    QuantitativeRiskHypothesisViewSet,
    basename="quantitative-risk-hypotheses",
)

urlpatterns = [
    path("", include(router.urls)),
    path(
        "quantitative-risk-studies/<uuid:pk>/action-plan/",
        QuantitativeRiskStudyActionPlanList.as_view(),
        name="quantitative-risk-study-action-plan",
    ),
    # Portfolio Analytics
    path(
        "analytics/portfolio/analyze/",
        PortfolioAnalysisView.as_view(),
        name="portfolio-analyze",
    ),
    path(
        "analytics/portfolio/stress-test/",
        PortfolioStressTestView.as_view(),
        name="portfolio-stress-test",
    ),
    path(
        "analytics/portfolio/compare/",
        PortfolioCompareView.as_view(),
        name="portfolio-compare",
    ),
    # ROI Analytics
    path(
        "analytics/roi/calculate/",
        ControlROIView.as_view(),
        name="roi-calculate",
    ),
    path(
        "analytics/roi/compare-treatments/",
        TreatmentComparisonView.as_view(),
        name="roi-compare-treatments",
    ),
    path(
        "analytics/roi/optimize-controls/",
        OptimalControlsView.as_view(),
        name="roi-optimize-controls",
    ),
    path(
        "analytics/roi/breakeven/",
        BreakevenAnalysisView.as_view(),
        name="roi-breakeven",
    ),
    path(
        "analytics/roi/sensitivity/",
        SensitivityAnalysisView.as_view(),
        name="roi-sensitivity",
    ),
]
