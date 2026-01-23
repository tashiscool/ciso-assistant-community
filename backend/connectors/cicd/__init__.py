"""
CI/CD Security Connectors.

Supported platforms:
- GitLab Security: GitLab security scanning results
- JFrog Xray: Artifact security scanning
- GitHub Advanced Security: Code scanning and secret detection
"""

from .gitlab import GitLabSecurityConnector
from .xray import XrayConnector
from .github_security import GitHubSecurityConnector

__all__ = ['GitLabSecurityConnector', 'XrayConnector', 'GitHubSecurityConnector']
