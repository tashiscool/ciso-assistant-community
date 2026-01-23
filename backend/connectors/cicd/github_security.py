"""
GitHub Advanced Security Connector.

Provides code scanning, secret detection, and Dependabot alerts from GitHub.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import logging
import httpx

from ..base.connector import (
    BaseConnector, ConnectorCategory, ConnectorConfig, ConnectorResult, AuthenticationError
)
from ..base.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


@dataclass
class GitHubAlert:
    """Represents a GitHub security alert."""
    id: str
    number: int
    alert_type: str  # code_scanning, secret_scanning, dependabot
    state: str
    severity: str
    rule_id: Optional[str]
    rule_description: Optional[str]
    repository: str
    html_url: str
    cwe_ids: List[str] = field(default_factory=list)
    cve_id: Optional[str] = None
    file_path: Optional[str] = None
    start_line: Optional[int] = None
    secret_type: Optional[str] = None
    package_name: Optional[str] = None
    vulnerable_version_range: Optional[str] = None
    patched_version: Optional[str] = None
    created_at: Optional[str] = None
    dismissed_at: Optional[str] = None
    fixed_at: Optional[str] = None


@ConnectorRegistry.register
class GitHubSecurityConnector(BaseConnector[GitHubAlert]):
    """Connector for GitHub Advanced Security."""

    connector_type = "github_security"
    display_name = "GitHub Advanced Security"
    description = "Code scanning, secret scanning, and Dependabot from GitHub"
    category = ConnectorCategory.CICD
    supported_auth_types = ["api_key"]
    supports_sync = True
    supports_webhook = True

    GITHUB_API = "https://api.github.com"

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._token: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        if not self.config.credentials.get("token"):
            return ConnectorResult(success=False, error_message="GitHub token required", error_code="MISSING_CREDENTIALS")
        if not self.config.credentials.get("owner"):
            return ConnectorResult(success=False, error_message="Repository owner/org required", error_code="MISSING_CREDENTIALS")
        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        try:
            await self.authenticate()
            owner = self.config.credentials["owner"]
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.GITHUB_API}/orgs/{owner}" if "/" not in owner else f"{self.GITHUB_API}/users/{owner}",
                    headers={"Authorization": f"Bearer {self._token}", "Accept": "application/vnd.github+json"},
                    timeout=self.config.timeout_seconds
                )
                if response.status_code == 200:
                    return ConnectorResult(success=True)
            return ConnectorResult(success=False, error_message="API connection failed", error_code="CONNECTION_ERROR")
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="CONNECTION_ERROR")

    async def authenticate(self) -> ConnectorResult:
        self._token = self.config.credentials.get("token")
        if not self._token:
            raise AuthenticationError("Token not configured")
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        if not self._token:
            return ConnectorResult(success=False, error_message="Not authenticated", error_code="NOT_AUTHENTICATED")

        owner = self.config.credentials["owner"]
        repo = self.config.credentials.get("repo")
        alert_types = kwargs.get("alert_types", ["code_scanning", "secret_scanning", "dependabot"])
        all_alerts = []

        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {self._token}", "Accept": "application/vnd.github+json"}

                # Get repos if not specified
                repos = []
                if repo:
                    repos = [repo]
                else:
                    repos_response = await client.get(
                        f"{self.GITHUB_API}/orgs/{owner}/repos" if "/" not in owner else f"{self.GITHUB_API}/users/{owner}/repos",
                        headers=headers,
                        params={"per_page": 100},
                        timeout=self.config.timeout_seconds
                    )
                    if repos_response.status_code == 200:
                        repos = [r["name"] for r in repos_response.json()]

                for repo_name in repos:
                    if "code_scanning" in alert_types:
                        response = await client.get(
                            f"{self.GITHUB_API}/repos/{owner}/{repo_name}/code-scanning/alerts",
                            headers=headers,
                            params={"state": "open", "per_page": 100},
                            timeout=self.config.timeout_seconds
                        )
                        if response.status_code == 200:
                            for alert in response.json():
                                alert["_alert_type"] = "code_scanning"
                                alert["_repository"] = f"{owner}/{repo_name}"
                                all_alerts.append(alert)

                    if "secret_scanning" in alert_types:
                        response = await client.get(
                            f"{self.GITHUB_API}/repos/{owner}/{repo_name}/secret-scanning/alerts",
                            headers=headers,
                            params={"state": "open", "per_page": 100},
                            timeout=self.config.timeout_seconds
                        )
                        if response.status_code == 200:
                            for alert in response.json():
                                alert["_alert_type"] = "secret_scanning"
                                alert["_repository"] = f"{owner}/{repo_name}"
                                all_alerts.append(alert)

                    if "dependabot" in alert_types:
                        response = await client.get(
                            f"{self.GITHUB_API}/repos/{owner}/{repo_name}/dependabot/alerts",
                            headers=headers,
                            params={"state": "open", "per_page": 100},
                            timeout=self.config.timeout_seconds
                        )
                        if response.status_code == 200:
                            for alert in response.json():
                                alert["_alert_type"] = "dependabot"
                                alert["_repository"] = f"{owner}/{repo_name}"
                                all_alerts.append(alert)

            return ConnectorResult(success=True, data=all_alerts, items_processed=len(all_alerts))
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="FETCH_ERROR")

    async def transform_data(self, raw_data: Any) -> List[GitHubAlert]:
        alerts = []
        for a in raw_data:
            alert_type = a.get("_alert_type", "unknown")
            rule = a.get("rule", {})
            security_advisory = a.get("security_advisory", {})
            location = a.get("most_recent_instance", {}).get("location", {}) if alert_type == "code_scanning" else {}

            alerts.append(GitHubAlert(
                id=str(a.get("number", "")),
                number=a.get("number", 0),
                alert_type=alert_type,
                state=a.get("state", "open"),
                severity=rule.get("severity") or security_advisory.get("severity") or a.get("severity", "unknown"),
                rule_id=rule.get("id"),
                rule_description=rule.get("description") or security_advisory.get("summary"),
                repository=a.get("_repository", ""),
                html_url=a.get("html_url", ""),
                cwe_ids=[c.get("cwe_id") for c in security_advisory.get("cwes", [])],
                cve_id=security_advisory.get("cve_id"),
                file_path=location.get("path"),
                start_line=location.get("start_line"),
                secret_type=a.get("secret_type"),
                package_name=a.get("dependency", {}).get("package", {}).get("name"),
                vulnerable_version_range=a.get("security_vulnerability", {}).get("vulnerable_version_range"),
                patched_version=a.get("security_vulnerability", {}).get("first_patched_version", {}).get("identifier"),
                created_at=a.get("created_at"),
                dismissed_at=a.get("dismissed_at"),
                fixed_at=a.get("fixed_at"),
            ))
        return alerts

    def get_config_schema(self) -> dict:
        base = super().get_config_schema()
        base["properties"].update({
            "token": {"type": "string", "format": "password", "description": "GitHub Personal Access Token or App Token"},
            "owner": {"type": "string", "description": "Repository owner (user or organization)"},
            "repo": {"type": "string", "description": "Optional specific repository name"},
        })
        base["required"].extend(["token", "owner"])
        return base
