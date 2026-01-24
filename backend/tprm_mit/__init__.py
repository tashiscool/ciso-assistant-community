"""
Third-Party Risk Management Module - MIT Licensed

Clean-room implementation of TPRM with DORA compliance.
Copyright (c) 2026 Tash

This module provides:
- Entity management for third-party vendors/partners
- Entity assessments with criticality scoring
- Solution/service tracking
- Contract management
- DORA (Digital Operational Resilience Act) compliance reporting
"""

from .models import (
    Entity,
    EntityAssessment,
    Representative,
    Solution,
    Contract,
)

__all__ = [
    'Entity',
    'EntityAssessment',
    'Representative',
    'Solution',
    'Contract',
]
