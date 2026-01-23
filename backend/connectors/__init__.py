"""
CISO Assistant Connector Framework

A modular framework for integrating with security tools, scanners,
and third-party systems to automate evidence collection and compliance monitoring.

Supported Integration Categories:
- Cloud Security: Wiz, Prisma Cloud, Aqua
- SAST/DAST: Snyk, Veracode, SonarCloud, Burp Suite, IBM AppScan
- Container Security: Trivy
- Vulnerability Scanners: Rapid7/InsightVM, Nessus, Qualys
- CI/CD Security: GitLab Security, JFrog Xray, GitHub Advanced Security
- Identity & Access: Active Directory, Microsoft Intune, Okta
- Endpoint Security: Microsoft Defender
- CRM/GRC: Salesforce

Usage:
    from connectors import ConnectorRegistry, get_registry

    # Get available connectors
    registry = get_registry()
    connectors = registry.get_metadata()

    # Create a connector instance
    from connectors.base import ConnectorConfig
    config = ConnectorConfig(
        connector_type="snyk",
        name="My Snyk Integration",
        credentials={"api_key": "...", "org_id": "..."}
    )
    connector = registry.create("snyk", config)

    # Sync data
    result = await connector.sync()
"""

from .base.connector import (
    BaseConnector,
    ConnectorConfig,
    ConnectorStatus,
    ConnectorResult,
    ConnectorError,
    ConnectorCategory,
    AuthenticationError,
    ConnectionError,
    RateLimitError,
    ValidationError,
)
from .base.registry import ConnectorRegistry, get_registry, discover_connectors
from .base.auth import (
    AuthProvider,
    AuthToken,
    OAuth2Provider,
    APIKeyProvider,
    ServiceAccountProvider,
    AzureADProvider,
    BasicAuthProvider,
)
from .base.scheduler import (
    ConnectorScheduler,
    SyncSchedule,
    SyncTask,
    SyncExecution,
    ScheduleType,
)

__all__ = [
    # Base classes
    'BaseConnector',
    'ConnectorConfig',
    'ConnectorStatus',
    'ConnectorResult',
    'ConnectorError',
    'ConnectorCategory',
    'AuthenticationError',
    'ConnectionError',
    'RateLimitError',
    'ValidationError',
    # Registry
    'ConnectorRegistry',
    'get_registry',
    'discover_connectors',
    # Auth
    'AuthProvider',
    'AuthToken',
    'OAuth2Provider',
    'APIKeyProvider',
    'ServiceAccountProvider',
    'AzureADProvider',
    'BasicAuthProvider',
    # Scheduler
    'ConnectorScheduler',
    'SyncSchedule',
    'SyncTask',
    'SyncExecution',
    'ScheduleType',
]


def init_connectors():
    """Initialize all connectors by importing them."""
    # Import all connector modules to trigger registration
    try:
        from .cloud_security import WizConnector, PrismaCloudConnector, AquaConnector
    except ImportError:
        pass

    try:
        from .sast_dast import (
            SnykConnector, VeracodeConnector, SonarCloudConnector,
            BurpSuiteConnector, AppScanConnector
        )
    except ImportError:
        pass

    try:
        from .container import TrivyConnector
    except ImportError:
        pass

    try:
        from .vulnerability import Rapid7Connector, NessusConnector, QualysConnector
    except ImportError:
        pass

    try:
        from .cicd import GitLabSecurityConnector, XrayConnector, GitHubSecurityConnector
    except ImportError:
        pass

    try:
        from .identity import ActiveDirectoryConnector, IntuneConnector, OktaConnector
    except ImportError:
        pass

    try:
        from .endpoint import DefenderConnector
    except ImportError:
        pass

    try:
        from .crm import SalesforceConnector
    except ImportError:
        pass
