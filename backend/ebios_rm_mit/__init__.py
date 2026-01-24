"""
EBIOS RM Module - MIT Licensed

Clean-room implementation of EBIOS Risk Management methodology.
Copyright (c) 2026 Tash

EBIOS RM (Expression des Besoins et Identification des Objectifs de Sécurité)
is a French risk assessment methodology with 5 workshops:
1. Scope and Security Baseline
2. Risk Origins
3. Strategic Scenarios
4. Operational Scenarios
5. Risk Treatment
"""

# Lazy imports to allow testing without Django
__all__ = [
    'EbiosRMStudy',
    'FearedEvent',
    'RiskOrigin',
    'TargetObjective',
    'RoTo',
    'Stakeholder',
    'StrategicScenario',
    'AttackPath',
    'OperationalScenario',
    'ElementaryAction',
    'OperatingMode',
    'KillChain',
]


def __getattr__(name):
    """Lazy import to avoid Django dependency at import time."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
