"""
SonarCloud/SonarQube Security Connector.

SonarCloud provides code quality and security analysis.
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
class SonarIssue:
    """Represents a SonarCloud/SonarQube security issue."""
    id: str
    key: str
    rule: str
    severity: str
    issue_type: str
    component: str
    project: str
    message: str
    line: Optional[int] = None
    effort: Optional[str] = None
    debt: Optional[str] = None
    status: str = "OPEN"
    resolution: Optional[str] = None
    security_category: Optional[str] = None
    vulnerability_probability: Optional[str] = None
    cwe_ids: List[str] = field(default_factory=list)
    owasp_ids: List[str] = field(default_factory=list)
    creation_date: Optional[str] = None
    update_date: Optional[str] = None


@ConnectorRegistry.register
class SonarCloudConnector(BaseConnector[SonarIssue]):
    """
    Connector for SonarCloud/SonarQube.

    Capabilities:
    - Fetch security vulnerabilities
    - Get code smells and bugs
    - Retrieve security hotspots
    - Pull project quality metrics
    """

    connector_type = "sonarcloud"
    display_name = "SonarCloud"
    description = "Code quality and security analysis platform"
    category = ConnectorCategory.SAST_DAST
    supported_auth_types = ["api_key"]

    supports_sync = True
    supports_webhook = True
    supports_bidirectional = False

    SONARCLOUD_API = "https://sonarcloud.io/api"

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._token: Optional[str] = None
        self._api_base: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate SonarCloud configuration."""
        if not self.config.credentials.get("token"):
            return ConnectorResult(
                success=False,
                error_message="API token required",
                error_code="MISSING_CREDENTIALS"
            )

        if not self.config.credentials.get("organization"):
            return ConnectorResult(
                success=False,
                error_message="Organization key required",
                error_code="MISSING_CREDENTIALS"
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to SonarCloud API."""
        try:
            self._token = self.config.credentials["token"]
            self._api_base = self.config.base_url or self.SONARCLOUD_API

            org = self.config.credentials["organization"]

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self._api_base}/organizations/search",
                    auth=(self._token, ""),
                    params={"organizations": org},
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    data = response.json()
                    orgs = data.get("organizations", [])
                    if orgs:
                        return ConnectorResult(
                            success=True,
                            metadata={"organization": orgs[0].get("name")}
                        )

                return ConnectorResult(
                    success=False,
                    error_message="Organization not found or invalid credentials",
                    error_code="AUTH_ERROR"
                )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="CONNECTION_ERROR"
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with SonarCloud (token-based)."""
        self._token = self.config.credentials.get("token")
        self._api_base = self.config.base_url or self.SONARCLOUD_API

        if not self._token:
            raise AuthenticationError("API token not configured")

        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch security issues from SonarCloud."""
        if self._token is None:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED"
            )

        org = self.config.credentials["organization"]
        all_issues = []

        try:
            async with httpx.AsyncClient() as client:
                # Get projects in organization
                projects_params = {
                    "organization": org,
                    "ps": 500,
                }

                project_filter = kwargs.get("project_keys")
                if project_filter:
                    projects_params["projects"] = ",".join(project_filter)

                projects_response = await client.get(
                    f"{self._api_base}/components/search_projects",
                    auth=(self._token, ""),
                    params=projects_params,
                    timeout=self.config.timeout_seconds
                )

                if projects_response.status_code != 200:
                    return ConnectorResult(
                        success=False,
                        error_message=f"Failed to fetch projects: {projects_response.status_code}",
                        error_code="API_ERROR"
                    )

                projects = projects_response.json().get("components", [])

                # Fetch issues for each project
                for project in projects:
                    project_key = project["key"]
                    page = 1

                    while True:
                        issues_params = {
                            "componentKeys": project_key,
                            "types": kwargs.get("types", "VULNERABILITY,SECURITY_HOTSPOT"),
                            "statuses": kwargs.get("statuses", "OPEN,CONFIRMED,REOPENED"),
                            "ps": 100,
                            "p": page,
                        }

                        if kwargs.get("severities"):
                            issues_params["severities"] = kwargs["severities"]

                        issues_response = await client.get(
                            f"{self._api_base}/issues/search",
                            auth=(self._token, ""),
                            params=issues_params,
                            timeout=self.config.timeout_seconds
                        )

                        if issues_response.status_code != 200:
                            break

                        data = issues_response.json()
                        issues = data.get("issues", [])
                        all_issues.extend(issues)

                        # Check pagination
                        total = data.get("paging", {}).get("total", 0)
                        page_size = data.get("paging", {}).get("pageSize", 100)
                        if page * page_size >= total:
                            break

                        page += 1

            return ConnectorResult(
                success=True,
                data=all_issues,
                items_processed=len(all_issues),
                metadata={"projects_scanned": len(projects)}
            )

        except Exception as e:
            logger.error(f"SonarCloud fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def transform_data(self, raw_data: Any) -> List[SonarIssue]:
        """Transform SonarCloud issues to SonarIssue objects."""
        issues = []

        for issue in raw_data:
            # Extract security tags
            tags = issue.get("tags", [])
            cwe_ids = [t.replace("cwe:", "CWE-") for t in tags if t.startswith("cwe:")]
            owasp_ids = [t for t in tags if t.startswith("owasp-")]

            sonar_issue = SonarIssue(
                id=issue.get("key", ""),
                key=issue.get("key", ""),
                rule=issue.get("rule", ""),
                severity=issue.get("severity", "UNKNOWN"),
                issue_type=issue.get("type", "VULNERABILITY"),
                component=issue.get("component", ""),
                project=issue.get("project", ""),
                message=issue.get("message", ""),
                line=issue.get("line"),
                effort=issue.get("effort"),
                debt=issue.get("debt"),
                status=issue.get("status", "OPEN"),
                resolution=issue.get("resolution"),
                security_category=issue.get("securityCategory"),
                vulnerability_probability=issue.get("vulnerabilityProbability"),
                cwe_ids=cwe_ids,
                owasp_ids=owasp_ids,
                creation_date=issue.get("creationDate"),
                update_date=issue.get("updateDate"),
            )
            issues.append(sonar_issue)

        return issues

    def get_config_schema(self) -> dict:
        """Return SonarCloud-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "token": {
                "type": "string",
                "description": "SonarCloud/SonarQube User Token",
                "format": "password"
            },
            "organization": {
                "type": "string",
                "description": "Organization Key"
            },
            "server_url": {
                "type": "string",
                "format": "uri",
                "description": "SonarQube server URL (leave empty for SonarCloud)",
                "default": "https://sonarcloud.io/api"
            }
        })
        base["required"].extend(["token", "organization"])
        return base
