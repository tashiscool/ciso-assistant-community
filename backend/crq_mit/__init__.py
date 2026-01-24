"""
Cyber Risk Quantification Module - MIT Licensed

Clean-room implementation of quantitative risk assessment.
Copyright (c) 2026 Tash

This module provides:
- Monte Carlo simulation for risk scenarios
- Loss Exceedance Curves (LEC)
- Value-at-Risk (VaR) calculations
- Return on Controls (ROC) analysis
- Portfolio risk aggregation
"""

# Lazy imports to allow testing without Django
__all__ = [
    'QuantitativeRiskStudy',
    'QuantitativeRiskScenario',
    'QuantitativeRiskHypothesis',
]


def __getattr__(name):
    """Lazy import to avoid Django dependency at import time."""
    if name in __all__:
        from .models import (
            QuantitativeRiskStudy,
            QuantitativeRiskScenario,
            QuantitativeRiskHypothesis,
        )
        return locals()[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
