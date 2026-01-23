"""
Burp Suite Enterprise Connector.

Burp Suite provides web application security testing (DAST).
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
class BurpIssue:
    """Represents a Burp Suite security finding."""
    id: str
    serial_number: str
    issue_type: str
    issue_name: str
    severity: str
    confidence: str
    path: str
    origin: str
    description: Optional[str] = None
    remediation: Optional[str] = None
    evidence: Optional[str] = None
    references: List[str] = field(default_factory=list)
    cwe_ids: List[str] = field(default_factory=list)
    scan_id: Optional[str] = None
    site_id: Optional[str] = None
    first_seen: Optional[str] = None


@ConnectorRegistry.register
class BurpSuiteConnector(BaseConnector[BurpIssue]):
    """
    Connector for Burp Suite Enterprise Edition.

    Capabilities:
    - Fetch scan results and issues
    - Get site configurations
    - Retrieve scan schedules
    - Pull vulnerability details
    """

    connector_type = "burp_suite"
    display_name = "Burp Suite Enterprise"
    description = "Web application security testing platform"
    category = ConnectorCategory.SAST_DAST
    supported_auth_types = ["api_key"]

    supports_sync = True
    supports_webhook = True
    supports_bidirectional = False

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._api_key: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate Burp Suite configuration."""
        if not self.config.credentials.get("api_key"):
            return ConnectorResult(
                success=False,
                error_message="API key required",
                error_code="MISSING_CREDENTIALS"
            )

        if not self.config.base_url:
            return ConnectorResult(
                success=False,
                error_message="Burp Suite Enterprise URL required",
                error_code="MISSING_CONFIG"
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to Burp Suite API."""
        try:
            self._api_key = self.config.credentials["api_key"]
            base_url = self.config.base_url.rstrip("/")

            async with httpx.AsyncClient() as client:
                # GraphQL query to test connection
                query = """
                query {
                    sites {
                        id
                        name
                    }
                }
                """

                response = await client.post(
                    f"{base_url}/graphql/v1",
                    headers={
                        "Authorization": self._api_key,
                        "Content-Type": "application/json"
                    },
                    json={"query": query},
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    data = response.json()
                    if "data" in data and "sites" in data["data"]:
                        return ConnectorResult(
                            success=True,
                            metadata={"sites_count": len(data["data"]["sites"])}
                        )

                return ConnectorResult(
                    success=False,
                    error_message="Failed to connect to Burp Suite API",
                    error_code="CONNECTION_ERROR"
                )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="CONNECTION_ERROR"
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with Burp Suite (API key based)."""
        self._api_key = self.config.credentials.get("api_key")
        if not self._api_key:
            raise AuthenticationError("API key not configured")
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch issues from Burp Suite."""
        if self._api_key is None:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED"
            )

        base_url = self.config.base_url.rstrip("/")
        all_issues = []

        try:
            async with httpx.AsyncClient() as client:
                # Query for issues
                query = """
                query GetIssues($site_id: ID, $scan_id: ID, $severity_filter: [Severity]) {
                    issues(
                        site_id: $site_id
                        scan_id: $scan_id
                        severity_filter: $severity_filter
                    ) {
                        serial_number
                        issue_type {
                            type_index
                            name
                            description_html
                            remediation_html
                            references {
                                url
                                title
                            }
                            vulnerability_classifications {
                                cwe_id
                            }
                        }
                        severity
                        confidence
                        path
                        origin
                        evidence {
                            request_response {
                                request
                                response
                            }
                        }
                        tickets {
                            link
                        }
                    }
                }
                """

                variables = {}

                if kwargs.get("site_id"):
                    variables["site_id"] = kwargs["site_id"]
                if kwargs.get("scan_id"):
                    variables["scan_id"] = kwargs["scan_id"]
                if kwargs.get("severity_filter"):
                    variables["severity_filter"] = kwargs["severity_filter"]

                response = await client.post(
                    f"{base_url}/graphql/v1",
                    headers={
                        "Authorization": self._api_key,
                        "Content-Type": "application/json"
                    },
                    json={"query": query, "variables": variables},
                    timeout=self.config.timeout_seconds * 2
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

                all_issues = data.get("data", {}).get("issues", [])

            return ConnectorResult(
                success=True,
                data=all_issues,
                items_processed=len(all_issues)
            )

        except Exception as e:
            logger.error(f"Burp Suite fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def transform_data(self, raw_data: Any) -> List[BurpIssue]:
        """Transform Burp Suite issues to BurpIssue objects."""
        issues = []

        for issue in raw_data:
            issue_type = issue.get("issue_type", {})
            vuln_class = issue_type.get("vulnerability_classifications", [])

            burp_issue = BurpIssue(
                id=str(issue.get("serial_number", "")),
                serial_number=str(issue.get("serial_number", "")),
                issue_type=str(issue_type.get("type_index", "")),
                issue_name=issue_type.get("name", "Unknown Issue"),
                severity=issue.get("severity", "info"),
                confidence=issue.get("confidence", "tentative"),
                path=issue.get("path", ""),
                origin=issue.get("origin", ""),
                description=issue_type.get("description_html"),
                remediation=issue_type.get("remediation_html"),
                references=[r.get("url", "") for r in issue_type.get("references", [])],
                cwe_ids=[f"CWE-{v.get('cwe_id')}" for v in vuln_class if v.get("cwe_id")],
            )
            issues.append(burp_issue)

        return issues

    def get_config_schema(self) -> dict:
        """Return Burp Suite-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "api_key": {
                "type": "string",
                "description": "Burp Suite Enterprise API Key",
                "format": "password"
            },
            "enterprise_url": {
                "type": "string",
                "format": "uri",
                "description": "Burp Suite Enterprise Server URL"
            }
        })
        base["required"].extend(["api_key", "enterprise_url"])
        return base
