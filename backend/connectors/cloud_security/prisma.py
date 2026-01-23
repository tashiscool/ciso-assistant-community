"""
Prisma Cloud Connector.

Prisma Cloud provides comprehensive cloud security including CSPM, CWPP, and code security.
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
class PrismaAlert:
    """Represents a Prisma Cloud alert."""
    id: str
    policy_name: str
    policy_type: str
    severity: str
    status: str
    resource_type: str
    resource_id: str
    resource_name: str
    cloud_type: str
    account_id: str
    region: Optional[str] = None
    description: Optional[str] = None
    recommendation: Optional[str] = None
    first_seen: Optional[str] = None
    last_seen: Optional[str] = None
    compliance_standards: Optional[List[str]] = None


@ConnectorRegistry.register
class PrismaCloudConnector(BaseConnector[PrismaAlert]):
    """
    Connector for Palo Alto Prisma Cloud.

    Capabilities:
    - Fetch alerts and findings
    - Get compliance posture
    - Retrieve asset inventory
    - Pull vulnerability data
    """

    connector_type = "prisma_cloud"
    display_name = "Prisma Cloud"
    description = "Comprehensive cloud security platform by Palo Alto Networks"
    category = ConnectorCategory.CLOUD_SECURITY
    supported_auth_types = ["api_key"]

    supports_sync = True
    supports_webhook = True
    supports_bidirectional = False

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._access_token: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate Prisma Cloud configuration."""
        required = ["access_key", "secret_key", "api_url"]
        missing = [f for f in required if not self.config.credentials.get(f)]

        if missing:
            return ConnectorResult(
                success=False,
                error_message=f"Missing required credentials: {', '.join(missing)}",
                error_code="MISSING_CREDENTIALS"
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to Prisma Cloud API."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            # Test with license info endpoint
            api_url = self.config.credentials["api_url"].rstrip("/")
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{api_url}/license",
                    headers={"x-redlock-auth": self._access_token},
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    return ConnectorResult(success=True)

            return ConnectorResult(
                success=False,
                error_message="Failed to query Prisma Cloud API",
                error_code="API_ERROR"
            )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="CONNECTION_ERROR"
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with Prisma Cloud."""
        try:
            api_url = self.config.credentials["api_url"].rstrip("/")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{api_url}/login",
                    json={
                        "username": self.config.credentials["access_key"],
                        "password": self.config.credentials["secret_key"]
                    },
                    timeout=self.config.timeout_seconds
                )

                if response.status_code != 200:
                    raise AuthenticationError(f"Login failed: {response.status_code}")

                data = response.json()
                self._access_token = data.get("token")

                if not self._access_token:
                    raise AuthenticationError("No token in response")

                return ConnectorResult(success=True)

        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Prisma Cloud authentication failed: {e}")
            raise AuthenticationError(f"Authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch alerts from Prisma Cloud."""
        if self._access_token is None:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED"
            )

        api_url = self.config.credentials["api_url"].rstrip("/")
        all_alerts = []

        try:
            async with httpx.AsyncClient() as client:
                # Get alerts with pagination
                page_token = None
                while True:
                    params = {
                        "detailed": "true",
                        "limit": kwargs.get("limit", 100),
                    }
                    if page_token:
                        params["pageToken"] = page_token

                    # Apply filters if provided
                    filters = kwargs.get("filters", {})
                    body = {
                        "filters": [
                            {"name": k, "value": v}
                            for k, v in filters.items()
                        ] if filters else [],
                        "timeRange": kwargs.get("time_range", {
                            "type": "relative",
                            "value": {"amount": 30, "unit": "day"}
                        })
                    }

                    response = await client.post(
                        f"{api_url}/v2/alert",
                        headers={"x-redlock-auth": self._access_token},
                        params=params,
                        json=body,
                        timeout=self.config.timeout_seconds
                    )

                    if response.status_code != 200:
                        return ConnectorResult(
                            success=False,
                            error_message=f"API error: {response.status_code}",
                            error_code="API_ERROR"
                        )

                    data = response.json()
                    all_alerts.extend(data.get("items", []))

                    page_token = data.get("nextPageToken")
                    if not page_token or len(all_alerts) >= kwargs.get("max_results", 1000):
                        break

            return ConnectorResult(
                success=True,
                data=all_alerts,
                items_processed=len(all_alerts)
            )

        except Exception as e:
            logger.error(f"Prisma Cloud fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def transform_data(self, raw_data: Any) -> List[PrismaAlert]:
        """Transform Prisma Cloud alerts to PrismaAlert objects."""
        alerts = []

        for alert in raw_data:
            resource = alert.get("resource", {})
            policy = alert.get("policy", {})

            prisma_alert = PrismaAlert(
                id=alert.get("id", ""),
                policy_name=policy.get("name", "Unknown"),
                policy_type=policy.get("policyType", ""),
                severity=policy.get("severity", "UNKNOWN"),
                status=alert.get("status", "open"),
                resource_type=resource.get("resourceType", ""),
                resource_id=resource.get("id", ""),
                resource_name=resource.get("name", ""),
                cloud_type=resource.get("cloudType", ""),
                account_id=resource.get("accountId", ""),
                region=resource.get("region"),
                description=policy.get("description"),
                recommendation=policy.get("recommendation"),
                first_seen=alert.get("firstSeen"),
                last_seen=alert.get("lastSeen"),
                compliance_standards=[
                    c.get("name") for c in policy.get("complianceMetadata", [])
                ]
            )
            alerts.append(prisma_alert)

        return alerts

    def get_config_schema(self) -> dict:
        """Return Prisma Cloud-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "access_key": {
                "type": "string",
                "description": "Prisma Cloud Access Key"
            },
            "secret_key": {
                "type": "string",
                "description": "Prisma Cloud Secret Key",
                "format": "password"
            },
            "api_url": {
                "type": "string",
                "description": "Prisma Cloud API URL (e.g., https://api.prismacloud.io)",
                "format": "uri"
            }
        })
        base["required"].extend(["access_key", "secret_key", "api_url"])
        return base
