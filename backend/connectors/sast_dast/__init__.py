"""
SAST/DAST Security Connectors.

Supported platforms:
- Snyk: Code and dependency vulnerability scanning
- Veracode: Enterprise application security testing
- SonarCloud: Code quality and security analysis
- Burp Suite: Web application security testing
- IBM AppScan: Application security testing
- Checkmarx: Static application security testing
"""

from .snyk import SnykConnector
from .veracode import VeracodeConnector
from .sonarcloud import SonarCloudConnector
from .burp import BurpSuiteConnector
from .appscan import AppScanConnector
from .checkmarx import CheckmarxConnector

__all__ = [
    'SnykConnector',
    'VeracodeConnector',
    'SonarCloudConnector',
    'BurpSuiteConnector',
    'AppScanConnector',
    'CheckmarxConnector',
]
