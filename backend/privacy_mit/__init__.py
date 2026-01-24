"""
Privacy Management Module - MIT Licensed

Clean-room implementation of privacy management for GDPR/data protection.
Copyright (c) 2026 Tash

This module provides:
- Processing: Data processing activities (Records of Processing Activities)
- ProcessingNature: Nature/purpose of processing
- PersonalData: Personal data categories tracked
- DataSubject: Categories of data subjects
- DataRecipient: Recipients of personal data
- DataContractor: Data processors and sub-processors
- DataTransfer: Cross-border data transfers
- RightRequest: Data subject rights requests (DSAR)
- DataBreach: Personal data breach management
"""

# Lazy imports to allow testing without Django
__all__ = [
    'Processing',
    'ProcessingNature',
    'PersonalData',
    'DataSubject',
    'DataRecipient',
    'DataContractor',
    'DataTransfer',
    'RightRequest',
    'DataBreach',
]


def __getattr__(name):
    """Lazy import to avoid Django dependency at import time."""
    if name in __all__:
        from . import models
        return getattr(models, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
