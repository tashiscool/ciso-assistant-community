"""
Jira Connector.

Imports security-related issues and tickets from Jira via the REST API,
mapping them to CISO Assistant findings for tracking and correlation.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import logging

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
class JiraFinding:
    """Represents a Jira issue mapped as a security finding."""

    id: str
    key: str
    summary: str
    severity: str
    status: str
    issue_type: str
    priority: Optional[str] = None
    description: Optional[str] = None
    assignee: Optional[str] = None
    reporter: Optional[str] = None
    project_key: Optional[str] = None
    project_name: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None
    resolved: Optional[str] = None
    due_date: Optional[str] = None
    resolution: Optional[str] = None
    components: List[str] = field(default_factory=list)
    labels: List[str] = field(default_factory=list)
    fix_versions: List[str] = field(default_factory=list)
    affected_versions: List[str] = field(default_factory=list)
    custom_severity: Optional[str] = None
    link_url: Optional[str] = None


@ConnectorRegistry.register
class JiraConnector(BaseConnector[JiraFinding]):
    """
    Connector for Jira.

    Searches for issues using JQL and maps them to normalized security
    findings. Supports both Jira Cloud and Jira Data Center/Server.
    """

    connector_type = "jira"
    display_name = "Jira"
    description = "Security issue tracking from Jira Cloud or Data Center"
    category = ConnectorCategory.CRM_GRC
    supported_auth_types = ["api_key"]

    supports_sync = True
    supports_webhook = False
    supports_bidirectional = True

    config_schema = {
        "required": ["url", "email", "api_token"],
        "properties": {
            "url": {
                "type": "string",
                "format": "uri",
                "description": "Jira instance URL (e.g. https://mycompany.atlassian.net)",
            },
            "email": {
                "type": "string",
                "description": "Jira account email (Cloud) or username (Server)",
            },
            "api_token": {
                "type": "string",
                "format": "password",
                "description": "Jira API token (Cloud) or password (Server)",
            },
            "project_key": {
                "type": "string",
                "description": "Jira project key to query (e.g. SEC)",
            },
            "jql_filter": {
                "type": "string",
                "description": "JQL query filter (overrides project_key)",
            },
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._api_base: Optional[str] = None
        self._auth: Optional[tuple] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate Jira connection settings."""
        url = (
            self.config.base_url
            or self.config.extra_settings.get("url")
        )
        if not url:
            return ConnectorResult(
                success=False,
                error_message="Jira URL is required",
                error_code="MISSING_CONFIG",
            )

        required_creds = ["email", "api_token"]
        missing = [
            f for f in required_creds if not self.config.credentials.get(f)
        ]
        if missing:
            return ConnectorResult(
                success=False,
                error_message=f"Missing required credentials: {', '.join(missing)}",
                error_code="MISSING_CREDENTIALS",
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to Jira by fetching server info."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self._api_base}/rest/api/2/myself",
                    auth=self._auth,
                    headers={"Accept": "application/json"},
                    timeout=self.config.timeout_seconds,
                )

                if response.status_code == 200:
                    user_info = response.json()
                    return ConnectorResult(
                        success=True,
                        metadata={
                            "user": user_info.get("displayName", ""),
                            "instance": self._api_base,
                        },
                    )
                elif response.status_code == 401:
                    return ConnectorResult(
                        success=False,
                        error_message="Authentication failed. Check email and API token.",
                        error_code="AUTH_ERROR",
                    )
                else:
                    return ConnectorResult(
                        success=False,
                        error_message=f"Jira API returned {response.status_code}",
                        error_code="API_ERROR",
                    )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=f"Failed to connect to Jira: {e}",
                error_code="CONNECTION_ERROR",
            )

    async def authenticate(self) -> ConnectorResult:
        """Set up Basic authentication for Jira API."""
        try:
            import httpx  # noqa: F401 - verify import availability
        except ImportError:
            raise AuthenticationError(
                "httpx is required for the Jira connector. "
                "Install it with: pip install httpx"
            )

        self._api_base = (
            self.config.base_url
            or self.config.extra_settings.get("url", "")
        ).rstrip("/")

        email = self.config.credentials.get("email")
        api_token = self.config.credentials.get("api_token")

        if not email or not api_token:
            raise AuthenticationError(
                "Jira email and api_token are required"
            )

        self._auth = (email, api_token)
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Search Jira issues using JQL and fetch full details."""
        if not self._api_base or not self._auth:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED",
            )

        try:
            import httpx

            # Build JQL query
            jql = kwargs.get(
                "jql",
                self.config.extra_settings.get("jql_filter"),
            )

            if not jql:
                project_key = kwargs.get(
                    "project_key",
                    self.config.extra_settings.get("project_key"),
                )
                if project_key:
                    jql = f"project = {project_key} ORDER BY created DESC"
                else:
                    jql = "ORDER BY created DESC"

            all_issues = []
            start_at = 0
            max_results = 50

            # Fields to retrieve
            fields = (
                "summary,description,status,priority,issuetype,assignee,"
                "reporter,project,created,updated,resolutiondate,duedate,"
                "resolution,components,labels,fixVersions,versions"
            )

            async with httpx.AsyncClient() as client:
                while True:
                    response = await client.post(
                        f"{self._api_base}/rest/api/2/search",
                        json={
                            "jql": jql,
                            "startAt": start_at,
                            "maxResults": max_results,
                            "fields": fields.split(","),
                        },
                        auth=self._auth,
                        headers={
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        timeout=self.config.timeout_seconds,
                    )

                    if response.status_code != 200:
                        error_messages = response.json().get(
                            "errorMessages", [response.text]
                        )
                        return ConnectorResult(
                            success=False,
                            error_message=f"Jira search failed: {'; '.join(error_messages)}",
                            error_code="API_ERROR",
                        )

                    data = response.json()
                    issues = data.get("issues", [])
                    all_issues.extend(issues)

                    total = data.get("total", 0)

                    start_at += len(issues)
                    if start_at >= total or not issues:
                        break

                    # Safety limit
                    if start_at > 5000:
                        logger.warning(
                            "Jira fetch reached safety limit of 5000 issues"
                        )
                        break

            return ConnectorResult(
                success=True,
                data=all_issues,
                items_processed=len(all_issues),
                metadata={
                    "jql": jql,
                    "total_issues": len(all_issues),
                    "instance": self._api_base,
                },
            )

        except Exception as e:
            logger.error(f"Jira fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    async def transform_data(
        self, raw_data: Any
    ) -> List[JiraFinding]:
        """Transform Jira issues to JiraFinding objects."""
        findings = []

        # Jira priority mapping
        priority_severity_map = {
            "Highest": "critical",
            "Blocker": "critical",
            "High": "high",
            "Critical": "critical",
            "Medium": "medium",
            "Low": "low",
            "Lowest": "info",
            "Trivial": "info",
            "Minor": "low",
            "Major": "high",
        }

        for issue in raw_data:
            fields = issue.get("fields", {})

            # Extract priority and map to severity
            priority_obj = fields.get("priority") or {}
            priority_name = priority_obj.get("name", "Medium")
            severity = priority_severity_map.get(priority_name, "medium")

            # Extract status
            status_obj = fields.get("status") or {}
            status = status_obj.get("name", "Unknown")

            # Extract issue type
            issue_type_obj = fields.get("issuetype") or {}
            issue_type = issue_type_obj.get("name", "Task")

            # Extract assignee
            assignee_obj = fields.get("assignee") or {}
            assignee = assignee_obj.get("displayName")

            # Extract reporter
            reporter_obj = fields.get("reporter") or {}
            reporter = reporter_obj.get("displayName")

            # Extract project
            project_obj = fields.get("project") or {}
            project_key = project_obj.get("key")
            project_name = project_obj.get("name")

            # Extract resolution
            resolution_obj = fields.get("resolution") or {}
            resolution = resolution_obj.get("name")

            # Extract components
            components = [
                c.get("name", "")
                for c in (fields.get("components") or [])
            ]

            # Extract labels
            labels = fields.get("labels", []) or []

            # Extract versions
            fix_versions = [
                v.get("name", "")
                for v in (fields.get("fixVersions") or [])
            ]
            affected_versions = [
                v.get("name", "")
                for v in (fields.get("versions") or [])
            ]

            # Extract description (limit length)
            description = fields.get("description", "")
            if description and len(description) > 5000:
                description = description[:5000] + "... (truncated)"

            # Build link URL
            link_url = f"{self._api_base}/browse/{issue.get('key', '')}"

            finding = JiraFinding(
                id=issue.get("id", ""),
                key=issue.get("key", ""),
                summary=fields.get("summary", ""),
                severity=severity,
                status=status,
                issue_type=issue_type,
                priority=priority_name,
                description=description,
                assignee=assignee,
                reporter=reporter,
                project_key=project_key,
                project_name=project_name,
                created=fields.get("created"),
                updated=fields.get("updated"),
                resolved=fields.get("resolutiondate"),
                due_date=fields.get("duedate"),
                resolution=resolution,
                components=components,
                labels=labels,
                fix_versions=fix_versions,
                affected_versions=affected_versions,
                link_url=link_url,
            )
            findings.append(finding)

        return findings

    def get_config_schema(self) -> dict:
        """Return Jira specific config schema."""
        base = super().get_config_schema()
        base["properties"].update(
            {
                "url": {
                    "type": "string",
                    "format": "uri",
                    "description": "Jira Instance URL",
                },
                "email": {
                    "type": "string",
                    "description": "Jira Account Email",
                },
                "api_token": {
                    "type": "string",
                    "format": "password",
                    "description": "Jira API Token",
                },
                "project_key": {
                    "type": "string",
                    "description": "Jira Project Key (e.g. SEC)",
                },
                "jql_filter": {
                    "type": "string",
                    "description": "JQL query filter",
                },
            }
        )
        base["required"].extend(["url", "email", "api_token"])
        return base
