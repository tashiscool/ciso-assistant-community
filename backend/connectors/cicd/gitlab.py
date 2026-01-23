"""
GitLab Security Connector.

Provides security scanning results from GitLab CI/CD pipelines.
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
class GitLabVulnerability:
    """Represents a GitLab security vulnerability."""
    id: str
    name: str
    severity: str
    state: str
    scanner_type: str
    project_name: str
    project_id: int
    cve_ids: List[str] = field(default_factory=list)
    cwe_ids: List[str] = field(default_factory=list)
    description: Optional[str] = None
    solution: Optional[str] = None
    location_file: Optional[str] = None
    location_line: Optional[int] = None
    detected_at: Optional[str] = None
    dismissed_at: Optional[str] = None
    resolved_at: Optional[str] = None


@ConnectorRegistry.register
class GitLabSecurityConnector(BaseConnector[GitLabVulnerability]):
    """Connector for GitLab Security scanning results."""

    connector_type = "gitlab_security"
    display_name = "GitLab Security"
    description = "Security scanning from GitLab CI/CD pipelines"
    category = ConnectorCategory.CICD
    supported_auth_types = ["api_key"]
    supports_sync = True
    supports_webhook = True

    GITLAB_COM_API = "https://gitlab.com/api/v4"

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._token: Optional[str] = None
        self._api_base: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        if not self.config.credentials.get("access_token"):
            return ConnectorResult(success=False, error_message="Access token required", error_code="MISSING_CREDENTIALS")
        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        try:
            await self.authenticate()
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self._api_base}/user",
                    headers={"PRIVATE-TOKEN": self._token},
                    timeout=self.config.timeout_seconds
                )
                if response.status_code == 200:
                    return ConnectorResult(success=True)
            return ConnectorResult(success=False, error_message="API connection failed", error_code="CONNECTION_ERROR")
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="CONNECTION_ERROR")

    async def authenticate(self) -> ConnectorResult:
        self._token = self.config.credentials.get("access_token")
        self._api_base = self.config.base_url or self.GITLAB_COM_API
        if not self._token:
            raise AuthenticationError("Access token not configured")
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        if not self._token:
            return ConnectorResult(success=False, error_message="Not authenticated", error_code="NOT_AUTHENTICATED")

        all_vulns = []
        try:
            async with httpx.AsyncClient() as client:
                headers = {"PRIVATE-TOKEN": self._token}

                # Get projects
                projects_url = f"{self._api_base}/projects"
                params = {"membership": True, "per_page": 100}

                if kwargs.get("group_id"):
                    projects_url = f"{self._api_base}/groups/{kwargs['group_id']}/projects"

                response = await client.get(projects_url, headers=headers, params=params, timeout=self.config.timeout_seconds)

                if response.status_code != 200:
                    return ConnectorResult(success=False, error_message=f"Failed to fetch projects", error_code="API_ERROR")

                projects = response.json()

                for project in projects:
                    project_id = project["id"]
                    project_name = project.get("name_with_namespace", project["name"])

                    # Get vulnerabilities for project
                    vulns_response = await client.get(
                        f"{self._api_base}/projects/{project_id}/vulnerability_findings",
                        headers=headers,
                        params={"per_page": 100},
                        timeout=self.config.timeout_seconds
                    )

                    if vulns_response.status_code == 200:
                        vulns = vulns_response.json()
                        for v in vulns:
                            v["_project_name"] = project_name
                            v["_project_id"] = project_id
                            all_vulns.append(v)

            return ConnectorResult(success=True, data=all_vulns, items_processed=len(all_vulns))
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="FETCH_ERROR")

    async def transform_data(self, raw_data: Any) -> List[GitLabVulnerability]:
        vulns = []
        for v in raw_data:
            location = v.get("location", {})
            identifiers = v.get("identifiers", [])
            cve_ids = [i.get("value") for i in identifiers if i.get("type") == "cve"]
            cwe_ids = [i.get("value") for i in identifiers if i.get("type") == "cwe"]

            vulns.append(GitLabVulnerability(
                id=str(v.get("id", "")),
                name=v.get("name", "Unknown"),
                severity=v.get("severity", "unknown"),
                state=v.get("state", "detected"),
                scanner_type=v.get("report_type", ""),
                project_name=v.get("_project_name", ""),
                project_id=v.get("_project_id", 0),
                cve_ids=cve_ids,
                cwe_ids=cwe_ids,
                description=v.get("description"),
                solution=v.get("solution"),
                location_file=location.get("file"),
                location_line=location.get("start_line"),
            ))
        return vulns

    def get_config_schema(self) -> dict:
        base = super().get_config_schema()
        base["properties"].update({
            "access_token": {"type": "string", "format": "password", "description": "GitLab Personal Access Token or Project Token"},
            "gitlab_url": {"type": "string", "format": "uri", "description": "GitLab URL (leave empty for gitlab.com)"},
            "group_id": {"type": "string", "description": "Optional Group ID to limit scope"},
        })
        base["required"].append("access_token")
        return base
