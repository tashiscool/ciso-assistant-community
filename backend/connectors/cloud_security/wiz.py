"""
Wiz Cloud Security Connector.

Wiz provides cloud security posture management (CSPM) and vulnerability detection.
"""

from dataclasses import dataclass
from typing import Any, List, Optional
import logging
import httpx

from ..base.connector import (
    BaseConnector,
    ConnectorCategory,
    ConnectorConfig,
    ConnectorResult,
    ConnectorError,
    AuthenticationError,
)
from ..base.registry import ConnectorRegistry
from ..base.auth import OAuth2Provider

logger = logging.getLogger(__name__)


@dataclass
class WizFinding:
    """Represents a Wiz security finding."""
    id: str
    title: str
    severity: str
    status: str
    resource_type: str
    resource_id: str
    resource_name: str
    cloud_provider: str
    description: Optional[str] = None
    remediation: Optional[str] = None
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    control_id: Optional[str] = None
    framework_mapping: Optional[dict] = None


@ConnectorRegistry.register
class WizConnector(BaseConnector[WizFinding]):
    """
    Connector for Wiz cloud security platform.

    Capabilities:
    - Fetch security issues and findings
    - Get cloud resource inventory
    - Retrieve compliance assessments
    - Pull vulnerability data
    """

    connector_type = "wiz"
    display_name = "Wiz"
    description = "Cloud security posture management and vulnerability detection"
    category = ConnectorCategory.CLOUD_SECURITY
    supported_auth_types = ["oauth2"]

    supports_sync = True
    supports_webhook = True
    supports_bidirectional = False

    # Wiz GraphQL API endpoint
    DEFAULT_API_URL = "https://api.wiz.io/graphql"

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._auth_provider: Optional[OAuth2Provider] = None
        self._token = None

    async def validate_config(self) -> ConnectorResult:
        """Validate Wiz configuration."""
        required = ["client_id", "client_secret"]
        missing = [f for f in required if f not in self.config.credentials]

        if missing:
            return ConnectorResult(
                success=False,
                error_message=f"Missing required credentials: {', '.join(missing)}",
                error_code="MISSING_CREDENTIALS"
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to Wiz API."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            # Test with a simple query
            query = """
            query {
                tenantDetails {
                    name
                }
            }
            """
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.config.base_url or self.DEFAULT_API_URL,
                    json={"query": query},
                    headers={
                        "Authorization": f"Bearer {self._token.access_token}",
                        "Content-Type": "application/json"
                    },
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    data = response.json()
                    if "errors" not in data:
                        return ConnectorResult(
                            success=True,
                            metadata={"tenant": data.get("data", {}).get("tenantDetails", {})}
                        )

            return ConnectorResult(
                success=False,
                error_message="Failed to query Wiz API",
                error_code="API_ERROR"
            )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="CONNECTION_ERROR"
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with Wiz using OAuth2."""
        try:
            self._auth_provider = OAuth2Provider(
                client_id=self.config.credentials["client_id"],
                client_secret=self.config.credentials["client_secret"],
                token_url=self.config.credentials.get(
                    "auth_url",
                    "https://auth.app.wiz.io/oauth/token"
                ),
                audience="wiz-api",
            )

            self._token = await self._auth_provider.authenticate()
            return ConnectorResult(success=True)

        except Exception as e:
            logger.error(f"Wiz authentication failed: {e}")
            raise AuthenticationError(f"Authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch security issues from Wiz."""
        if self._token is None:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED"
            )

        # GraphQL query for security issues
        query = """
        query IssuesTable(
            $filterBy: IssueFilters
            $first: Int
            $after: String
        ) {
            issues(
                filterBy: $filterBy
                first: $first
                after: $after
            ) {
                nodes {
                    id
                    control {
                        id
                        name
                        severity
                    }
                    createdAt
                    updatedAt
                    status
                    severity
                    entity {
                        id
                        name
                        type
                        ... on CloudResource {
                            cloudPlatform
                            cloudProviderURL
                            region
                        }
                    }
                    note
                    dueAt
                    resolvedAt
                }
                pageInfo {
                    hasNextPage
                    endCursor
                }
            }
        }
        """

        variables = {
            "filterBy": kwargs.get("filters", {}),
            "first": kwargs.get("limit", 100),
            "after": kwargs.get("cursor"),
        }

        all_issues = []
        has_more = True
        cursor = None

        try:
            async with httpx.AsyncClient() as client:
                while has_more:
                    variables["after"] = cursor
                    response = await client.post(
                        self.config.base_url or self.DEFAULT_API_URL,
                        json={"query": query, "variables": variables},
                        headers={
                            "Authorization": f"Bearer {self._token.access_token}",
                            "Content-Type": "application/json"
                        },
                        timeout=self.config.timeout_seconds
                    )

                    if response.status_code != 200:
                        return ConnectorResult(
                            success=False,
                            error_message=f"API error: {response.status_code}",
                            error_code="API_ERROR"
                        )

                    data = response.json()
                    if "errors" in data:
                        return ConnectorResult(
                            success=False,
                            error_message=str(data["errors"]),
                            error_code="GRAPHQL_ERROR"
                        )

                    issues_data = data.get("data", {}).get("issues", {})
                    all_issues.extend(issues_data.get("nodes", []))

                    page_info = issues_data.get("pageInfo", {})
                    has_more = page_info.get("hasNextPage", False)
                    cursor = page_info.get("endCursor")

                    # Limit pagination for safety
                    if len(all_issues) >= kwargs.get("max_results", 1000):
                        break

            return ConnectorResult(
                success=True,
                data=all_issues,
                items_processed=len(all_issues),
                metadata={"total_fetched": len(all_issues)}
            )

        except Exception as e:
            logger.error(f"Wiz fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def transform_data(self, raw_data: Any) -> List[WizFinding]:
        """Transform Wiz issues to WizFinding objects."""
        findings = []

        for issue in raw_data:
            entity = issue.get("entity", {}) or {}
            control = issue.get("control", {}) or {}

            finding = WizFinding(
                id=issue.get("id", ""),
                title=control.get("name", "Unknown Issue"),
                severity=issue.get("severity", "UNKNOWN"),
                status=issue.get("status", "OPEN"),
                resource_type=entity.get("type", ""),
                resource_id=entity.get("id", ""),
                resource_name=entity.get("name", ""),
                cloud_provider=entity.get("cloudPlatform", ""),
                first_seen=issue.get("createdAt"),
                last_seen=issue.get("updatedAt"),
                control_id=control.get("id"),
            )
            findings.append(finding)

        return findings

    def get_config_schema(self) -> dict:
        """Return Wiz-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "client_id": {
                "type": "string",
                "description": "Wiz API Client ID"
            },
            "client_secret": {
                "type": "string",
                "description": "Wiz API Client Secret",
                "format": "password"
            },
            "auth_url": {
                "type": "string",
                "description": "Wiz Auth URL (optional)",
                "default": "https://auth.app.wiz.io/oauth/token"
            }
        })
        base["required"].extend(["client_id", "client_secret"])
        return base
