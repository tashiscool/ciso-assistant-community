"""
IBM AppScan Security Connector.

IBM AppScan provides application security testing (SAST/DAST).
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
class AppScanIssue:
    """Represents an IBM AppScan security finding."""
    id: str
    name: str
    severity: str
    status: str
    issue_type: str
    location: str
    application_name: str
    cwe_id: Optional[str] = None
    cvss_score: Optional[float] = None
    description: Optional[str] = None
    fix_recommendation: Optional[str] = None
    api: Optional[str] = None
    http_method: Optional[str] = None
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    created_at: Optional[str] = None
    last_updated: Optional[str] = None


@ConnectorRegistry.register
class AppScanConnector(BaseConnector[AppScanIssue]):
    """
    Connector for IBM AppScan Enterprise/Cloud.

    Capabilities:
    - Fetch SAST findings
    - Get DAST results
    - Retrieve application inventory
    - Pull compliance reports
    """

    connector_type = "appscan"
    display_name = "IBM AppScan"
    description = "IBM application security testing platform"
    category = ConnectorCategory.SAST_DAST
    supported_auth_types = ["api_key", "oauth2"]

    supports_sync = True
    supports_webhook = True
    supports_bidirectional = False

    CLOUD_API = "https://cloud.appscan.com/api/v4"

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._token: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate AppScan configuration."""
        required = ["key_id", "key_secret"]
        missing = [f for f in required if not self.config.credentials.get(f)]

        if missing:
            return ConnectorResult(
                success=False,
                error_message=f"Missing required credentials: {', '.join(missing)}",
                error_code="MISSING_CREDENTIALS"
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to AppScan API."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            api_base = self.config.base_url or self.CLOUD_API

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{api_base}/Account",
                    headers={"Authorization": f"Bearer {self._token}"},
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    return ConnectorResult(success=True)

            return ConnectorResult(
                success=False,
                error_message="Failed to connect to AppScan API",
                error_code="CONNECTION_ERROR"
            )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="CONNECTION_ERROR"
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with AppScan."""
        try:
            api_base = self.config.base_url or self.CLOUD_API

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{api_base}/Account/ApiKeyLogin",
                    json={
                        "KeyId": self.config.credentials["key_id"],
                        "KeySecret": self.config.credentials["key_secret"]
                    },
                    timeout=self.config.timeout_seconds
                )

                if response.status_code != 200:
                    raise AuthenticationError(f"Login failed: {response.status_code}")

                data = response.json()
                self._token = data.get("Token")

                if not self._token:
                    raise AuthenticationError("No token in response")

                return ConnectorResult(success=True)

        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"AppScan authentication failed: {e}")
            raise AuthenticationError(f"Authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch issues from AppScan."""
        if self._token is None:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED"
            )

        api_base = self.config.base_url or self.CLOUD_API
        all_issues = []

        try:
            async with httpx.AsyncClient() as client:
                # Get applications
                apps_response = await client.get(
                    f"{api_base}/Apps",
                    headers={"Authorization": f"Bearer {self._token}"},
                    timeout=self.config.timeout_seconds
                )

                if apps_response.status_code != 200:
                    return ConnectorResult(
                        success=False,
                        error_message=f"Failed to fetch applications: {apps_response.status_code}",
                        error_code="API_ERROR"
                    )

                applications = apps_response.json()

                # Filter applications if specified
                app_filter = kwargs.get("application_ids")
                if app_filter:
                    applications = [a for a in applications if a["Id"] in app_filter]

                # Fetch issues for each application
                for app in applications:
                    app_id = app["Id"]
                    app_name = app.get("Name", app_id)

                    issues_response = await client.get(
                        f"{api_base}/Issues/Application/{app_id}",
                        headers={"Authorization": f"Bearer {self._token}"},
                        params={
                            "$top": kwargs.get("limit", 500),
                            "$filter": kwargs.get("filter", ""),
                        },
                        timeout=self.config.timeout_seconds
                    )

                    if issues_response.status_code == 200:
                        issues = issues_response.json().get("Items", [])
                        for issue in issues:
                            issue["_application_name"] = app_name
                            all_issues.append(issue)

            return ConnectorResult(
                success=True,
                data=all_issues,
                items_processed=len(all_issues),
                metadata={"applications_scanned": len(applications)}
            )

        except Exception as e:
            logger.error(f"AppScan fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def transform_data(self, raw_data: Any) -> List[AppScanIssue]:
        """Transform AppScan issues to AppScanIssue objects."""
        issues = []

        for issue in raw_data:
            appscan_issue = AppScanIssue(
                id=issue.get("Id", ""),
                name=issue.get("IssueType", "Unknown Issue"),
                severity=issue.get("Severity", "Unknown"),
                status=issue.get("Status", "Open"),
                issue_type=issue.get("Classification", ""),
                location=issue.get("Location", ""),
                application_name=issue.get("_application_name", ""),
                cwe_id=issue.get("Cwe"),
                cvss_score=issue.get("CvssScore"),
                description=issue.get("Description"),
                fix_recommendation=issue.get("FixRecommendation"),
                api=issue.get("Api"),
                http_method=issue.get("HttpMethod"),
                source_file=issue.get("SourceFile"),
                line_number=issue.get("Line"),
                created_at=issue.get("DateCreated"),
                last_updated=issue.get("LastUpdated"),
            )
            issues.append(appscan_issue)

        return issues

    def get_config_schema(self) -> dict:
        """Return AppScan-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "key_id": {
                "type": "string",
                "description": "AppScan API Key ID"
            },
            "key_secret": {
                "type": "string",
                "description": "AppScan API Key Secret",
                "format": "password"
            },
            "api_url": {
                "type": "string",
                "format": "uri",
                "description": "AppScan API URL (leave empty for cloud)",
                "default": "https://cloud.appscan.com/api/v4"
            }
        })
        base["required"].extend(["key_id", "key_secret"])
        return base
