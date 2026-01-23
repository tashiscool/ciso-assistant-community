"""
Snyk Security Connector.

Snyk provides code and dependency vulnerability scanning for developers.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import logging
import httpx

from ..base.connector import (
    BaseConnector,
    ConnectorCategory,
    ConnectorConfig,
    ConnectorResult,
    AuthenticationError,
)
from ..base.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


@dataclass
class SnykIssue:
    """Represents a Snyk security issue."""
    id: str
    title: str
    severity: str
    issue_type: str
    package_name: str
    version: str
    project_name: str
    org_id: str
    exploit_maturity: Optional[str] = None
    cve_ids: List[str] = field(default_factory=list)
    cwe_ids: List[str] = field(default_factory=list)
    description: Optional[str] = None
    remediation: Optional[str] = None
    upgrade_path: Optional[List[str]] = None
    is_patchable: bool = False
    is_upgradeable: bool = False
    introduced_date: Optional[str] = None
    url: Optional[str] = None


@ConnectorRegistry.register
class SnykConnector(BaseConnector[SnykIssue]):
    """
    Connector for Snyk security platform.

    Capabilities:
    - Fetch vulnerability issues from projects
    - Get dependency information
    - Retrieve license compliance data
    - Pull code security findings
    """

    connector_type = "snyk"
    display_name = "Snyk"
    description = "Developer-first security platform for code and dependencies"
    category = ConnectorCategory.SAST_DAST
    supported_auth_types = ["api_key"]

    supports_sync = True
    supports_webhook = True
    supports_bidirectional = False

    API_BASE = "https://api.snyk.io/v1"
    REST_API_BASE = "https://api.snyk.io/rest"

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._api_key: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate Snyk configuration."""
        if not self.config.credentials.get("api_key"):
            return ConnectorResult(
                success=False,
                error_message="API key required",
                error_code="MISSING_CREDENTIALS"
            )

        if not self.config.credentials.get("org_id"):
            return ConnectorResult(
                success=False,
                error_message="Organization ID required",
                error_code="MISSING_CREDENTIALS"
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to Snyk API."""
        try:
            self._api_key = self.config.credentials["api_key"]
            org_id = self.config.credentials["org_id"]

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_BASE}/org/{org_id}",
                    headers={"Authorization": f"token {self._api_key}"},
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    data = response.json()
                    return ConnectorResult(
                        success=True,
                        metadata={"org_name": data.get("name")}
                    )
                elif response.status_code == 401:
                    return ConnectorResult(
                        success=False,
                        error_message="Invalid API key",
                        error_code="AUTH_ERROR"
                    )

            return ConnectorResult(
                success=False,
                error_message="Failed to connect to Snyk API",
                error_code="CONNECTION_ERROR"
            )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="CONNECTION_ERROR"
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with Snyk (API key based)."""
        self._api_key = self.config.credentials.get("api_key")
        if not self._api_key:
            raise AuthenticationError("API key not configured")
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch issues from Snyk."""
        if self._api_key is None:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED"
            )

        org_id = self.config.credentials["org_id"]
        all_issues = []

        try:
            async with httpx.AsyncClient() as client:
                # First, get all projects
                projects_response = await client.post(
                    f"{self.API_BASE}/org/{org_id}/projects",
                    headers={"Authorization": f"token {self._api_key}"},
                    json={},
                    timeout=self.config.timeout_seconds
                )

                if projects_response.status_code != 200:
                    return ConnectorResult(
                        success=False,
                        error_message=f"Failed to fetch projects: {projects_response.status_code}",
                        error_code="API_ERROR"
                    )

                projects = projects_response.json().get("projects", [])

                # Filter projects if specified
                project_filter = kwargs.get("project_ids")
                if project_filter:
                    projects = [p for p in projects if p["id"] in project_filter]

                # Fetch issues for each project
                for project in projects:
                    project_id = project["id"]
                    project_name = project.get("name", project_id)

                    issues_response = await client.post(
                        f"{self.API_BASE}/org/{org_id}/project/{project_id}/aggregated-issues",
                        headers={
                            "Authorization": f"token {self._api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "includeDescription": True,
                            "includeIntroducedThrough": True,
                        },
                        timeout=self.config.timeout_seconds
                    )

                    if issues_response.status_code == 200:
                        issues_data = issues_response.json()
                        for issue in issues_data.get("issues", []):
                            issue["_project_name"] = project_name
                            issue["_org_id"] = org_id
                            all_issues.append(issue)

                    # Rate limiting
                    if len(projects) > 10:
                        import asyncio
                        await asyncio.sleep(0.5)

            return ConnectorResult(
                success=True,
                data=all_issues,
                items_processed=len(all_issues),
                metadata={"projects_scanned": len(projects)}
            )

        except Exception as e:
            logger.error(f"Snyk fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def transform_data(self, raw_data: Any) -> List[SnykIssue]:
        """Transform Snyk issues to SnykIssue objects."""
        issues = []

        for issue in raw_data:
            issue_data = issue.get("issueData", {})
            pkg_versions = issue.get("pkgVersions", {})

            # Get first package/version
            pkg_name = ""
            version = ""
            if pkg_versions:
                for pkg, versions in pkg_versions.items():
                    pkg_name = pkg
                    version = versions[0] if versions else ""
                    break

            snyk_issue = SnykIssue(
                id=issue.get("id", ""),
                title=issue_data.get("title", "Unknown Issue"),
                severity=issue_data.get("severity", "unknown"),
                issue_type=issue.get("issueType", "vuln"),
                package_name=pkg_name,
                version=version,
                project_name=issue.get("_project_name", ""),
                org_id=issue.get("_org_id", ""),
                exploit_maturity=issue_data.get("exploitMaturity"),
                cve_ids=issue_data.get("identifiers", {}).get("CVE", []),
                cwe_ids=issue_data.get("identifiers", {}).get("CWE", []),
                description=issue_data.get("description"),
                remediation=issue_data.get("remediation"),
                is_patchable=issue.get("isPatched", False),
                is_upgradeable=issue.get("isUpgradable", False),
                introduced_date=issue.get("introducedDate"),
                url=issue_data.get("url"),
            )
            issues.append(snyk_issue)

        return issues

    def get_config_schema(self) -> dict:
        """Return Snyk-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "api_key": {
                "type": "string",
                "description": "Snyk API Token",
                "format": "password"
            },
            "org_id": {
                "type": "string",
                "description": "Snyk Organization ID"
            }
        })
        base["required"].extend(["api_key", "org_id"])
        return base
