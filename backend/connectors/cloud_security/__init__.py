"""
Cloud Security Platform Connectors.

Supported platforms:
- Wiz: Cloud security posture management
- Prisma Cloud: Comprehensive cloud security
- Aqua: Cloud native security platform
- AWS Security Hub: Aggregated AWS security findings
- AWS GuardDuty: AWS threat detection
- AWS Config: AWS resource compliance evaluation
- GCP SCC: Google Cloud Security Command Center
"""

from .wiz import WizConnector
from .prisma import PrismaCloudConnector
from .aqua import AquaConnector
from .aws_security_hub import AWSSecurityHubConnector
from .aws_guardduty import AWSGuardDutyConnector
from .aws_config import AWSConfigConnector
from .gcp_scc import GCPSCCConnector

__all__ = [
    'WizConnector',
    'PrismaCloudConnector',
    'AquaConnector',
    'AWSSecurityHubConnector',
    'AWSGuardDutyConnector',
    'AWSConfigConnector',
    'GCPSCCConnector',
]
