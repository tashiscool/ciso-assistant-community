"""
OCSF (Open Cybersecurity Schema Framework) Integration

Provides parsing and translation capabilities for OCSF events
to integrate with CISO Assistant's security data model.

Supported Event Classes:
- Security Finding (1001)
- Vulnerability Finding (2001)
- Compliance Finding (2002)
- Detection Finding (2004)
"""

from .ocsf_models import (
    OCSFEvent,
    OCSFSeverity,
    OCSFStatus,
    SecurityFinding,
    VulnerabilityFinding,
    ComplianceFinding,
    DetectionFinding,
)
from .ocsf_parser import OCSFParser, get_ocsf_parser
from .ocsf_to_oscal import OCSFToOSCALTranslator, get_ocsf_translator

__all__ = [
    # Models
    'OCSFEvent',
    'OCSFSeverity',
    'OCSFStatus',
    'SecurityFinding',
    'VulnerabilityFinding',
    'ComplianceFinding',
    'DetectionFinding',
    # Parser
    'OCSFParser',
    'get_ocsf_parser',
    # Translator
    'OCSFToOSCALTranslator',
    'get_ocsf_translator',
]
