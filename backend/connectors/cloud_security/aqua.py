"""
Aqua Security Connector.

Aqua provides cloud native security including container and serverless protection.
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
    AuthenticationError,
)
from ..base.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


@dataclass
class AquaVulnerability:
    """Represents an Aqua security vulnerability."""
    id: str
    name: str
    severity: str
    resource_type: str
    resource_name: str
    image_name: Optional[str] = None
    cve_id: Optional[str] = None
    description: Optional[str] = None
    fix_version: Optional[str] = None
    nvd_url: Optional[str] = None
    score: Optional[float] = None
    vector: Optional[str] = None


@ConnectorRegistry.register
class AquaConnector(BaseConnector[AquaVulnerability]):
    """
    Connector for Aqua Security platform.

    Capabilities:
    - Fetch image vulnerabilities
    - Get container runtime findings
    - Retrieve compliance violations
    - Pull security assurance data
    """

    connector_type = "aqua"
    display_name = "Aqua Security"
    description = "Cloud native security platform for containers and serverless"
    category = ConnectorCategory.CLOUD_SECURITY
    supported_auth_types = ["api_key", "basic"]

    supports_sync = True
    supports_webhook = True
    supports_bidirectional = False

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._token: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate Aqua configuration."""
        required = ["api_url", "username", "password"]
        missing = [f for f in required if not self.config.credentials.get(f)]

        if missing:
            return ConnectorResult(
                success=False,
                error_message=f"Missing required credentials: {', '.join(missing)}",
                error_code="MISSING_CREDENTIALS"
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to Aqua API."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            api_url = self.config.credentials["api_url"].rstrip("/")
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{api_url}/api/v1/settings",
                    headers={"Authorization": f"Bearer {self._token}"},
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    return ConnectorResult(success=True)

            return ConnectorResult(
                success=False,
                error_message="Failed to query Aqua API",
                error_code="API_ERROR"
            )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="CONNECTION_ERROR"
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with Aqua."""
        try:
            api_url = self.config.credentials["api_url"].rstrip("/")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{api_url}/api/v1/login",
                    json={
                        "id": self.config.credentials["username"],
                        "password": self.config.credentials["password"]
                    },
                    timeout=self.config.timeout_seconds
                )

                if response.status_code != 200:
                    raise AuthenticationError(f"Login failed: {response.status_code}")

                data = response.json()
                self._token = data.get("token")

                if not self._token:
                    raise AuthenticationError("No token in response")

                return ConnectorResult(success=True)

        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Aqua authentication failed: {e}")
            raise AuthenticationError(f"Authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch vulnerabilities from Aqua."""
        if self._token is None:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED"
            )

        api_url = self.config.credentials["api_url"].rstrip("/")
        all_vulns = []

        try:
            async with httpx.AsyncClient() as client:
                page = 1
                page_size = kwargs.get("page_size", 100)

                while True:
                    params = {
                        "page": page,
                        "pagesize": page_size,
                    }

                    # Filter by severity if specified
                    if "severity" in kwargs:
                        params["severity"] = kwargs["severity"]

                    response = await client.get(
                        f"{api_url}/api/v2/risks/vulnerabilities",
                        headers={"Authorization": f"Bearer {self._token}"},
                        params=params,
                        timeout=self.config.timeout_seconds
                    )

                    if response.status_code != 200:
                        return ConnectorResult(
                            success=False,
                            error_message=f"API error: {response.status_code}",
                            error_code="API_ERROR"
                        )

                    data = response.json()
                    vulns = data.get("result", [])
                    all_vulns.extend(vulns)

                    if len(vulns) < page_size or len(all_vulns) >= kwargs.get("max_results", 1000):
                        break

                    page += 1

            return ConnectorResult(
                success=True,
                data=all_vulns,
                items_processed=len(all_vulns)
            )

        except Exception as e:
            logger.error(f"Aqua fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def transform_data(self, raw_data: Any) -> List[AquaVulnerability]:
        """Transform Aqua vulnerabilities to AquaVulnerability objects."""
        vulns = []

        for vuln in raw_data:
            aqua_vuln = AquaVulnerability(
                id=vuln.get("name", ""),
                name=vuln.get("name", ""),
                severity=vuln.get("aqua_severity", "unknown"),
                resource_type=vuln.get("resource_type", "image"),
                resource_name=vuln.get("resource_name", ""),
                image_name=vuln.get("image_name"),
                cve_id=vuln.get("name") if vuln.get("name", "").startswith("CVE") else None,
                description=vuln.get("description"),
                fix_version=vuln.get("fix_version"),
                nvd_url=vuln.get("nvd_url"),
                score=vuln.get("nvd_score"),
                vector=vuln.get("nvd_vectors"),
            )
            vulns.append(aqua_vuln)

        return vulns

    def get_config_schema(self) -> dict:
        """Return Aqua-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "api_url": {
                "type": "string",
                "description": "Aqua Console URL",
                "format": "uri"
            },
            "username": {
                "type": "string",
                "description": "Aqua username"
            },
            "password": {
                "type": "string",
                "description": "Aqua password",
                "format": "password"
            }
        })
        base["required"].extend(["api_url", "username", "password"])
        return base
