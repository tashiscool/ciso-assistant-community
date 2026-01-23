"""
Privacy Models Package
"""

from .data_asset import DataAsset
from .consent_record import ConsentRecord
from .data_subject_right import DataSubjectRight
from .domain_events import *

# Re-export legacy models for backward compatibility
from ..legacy_models import (
    Processing,
    ProcessingNature,
    PersonalData,
    DataRecipient,
    Purpose,
    DataSubject,
    DataContractor,
    DataTransfer,
    RightRequest,
    DataBreach,
    LEGAL_BASIS_CHOICES,
)

__all__ = [
    'DataAsset',
    'ConsentRecord',
    'DataSubjectRight',
    # Legacy models
    'Processing',
    'ProcessingNature',
    'PersonalData',
    'DataRecipient',
    'Purpose',
    'DataSubject',
    'DataContractor',
    'DataTransfer',
    'RightRequest',
    'DataBreach',
    'LEGAL_BASIS_CHOICES',
]
