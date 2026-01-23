"""
Microsoft Defender for Endpoint Connector.

Provides endpoint detection and response data from Microsoft Defender.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import logging
import httpx

from ..base.connector import (
    BaseConnector, ConnectorCategory, ConnectorConfig, ConnectorResult, AuthenticationError
)
from ..base.registry import ConnectorRegistry
from ..base.auth import AzureADProvider

logger = logging.getLogger(__name__)


@dataclass
class DefenderAlert:
    """Represents a Microsoft Defender alert."""
    id: str
    title: str
    severity: str
    status: str
    classification: Optional[str]
    determination: Optional[str]
    category: str
    machine_id: Optional[str]
    computer_dns_name: Optional[str]
    first_event_time: Optional[str]
    last_event_time: Optional[str]
    alert_creation_time: Optional[str]
    resolved_time: Optional[str]
    assigned_to: Optional[str] = None
    description: Optional[str] = None
    recommended_action: Optional[str] = None
    mitre_techniques: List[str] = field(default_factory=list)
    related_user: Optional[str] = None
    evidence: List[dict] = field(default_factory=list)


@dataclass
class DefenderVulnerability:
    """Represents a vulnerability from Microsoft Defender."""
    id: str
    cve_id: str
    severity: str
    cvss_score: Optional[float]
    machine_id: str
    machine_name: str
    software_name: str
    software_version: str
    exposed_machines: int = 0
    public_exploit: bool = False
    exploited_in_wild: bool = False
    description: Optional[str] = None
    published_on: Optional[str] = None


@ConnectorRegistry.register
class DefenderConnector(BaseConnector[DefenderAlert]):
    """Connector for Microsoft Defender for Endpoint."""

    connector_type = "defender"
    display_name = "Microsoft Defender"
    description = "Endpoint detection and response from Microsoft Defender"
    category = ConnectorCategory.ENDPOINT
    supported_auth_types = ["oauth2"]
    supports_sync = True
    supports_webhook = True

    SECURITY_API = "https://api.securitycenter.microsoft.com/api"

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._auth_provider: Optional[AzureADProvider] = None
        self._token = None

    async def validate_config(self) -> ConnectorResult:
        required = ["tenant_id", "client_id", "client_secret"]
        missing = [f for f in required if not self.config.credentials.get(f)]
        if missing:
            return ConnectorResult(success=False, error_message=f"Missing: {', '.join(missing)}", error_code="MISSING_CREDENTIALS")
        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.SECURITY_API}/alerts?$top=1",
                    headers={"Authorization": f"Bearer {self._token.access_token}"},
                    timeout=self.config.timeout_seconds
                )
                if response.status_code == 200:
                    return ConnectorResult(success=True)
            return ConnectorResult(success=False, error_message="API connection failed", error_code="CONNECTION_ERROR")
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="CONNECTION_ERROR")

    async def authenticate(self) -> ConnectorResult:
        try:
            self._auth_provider = AzureADProvider(
                tenant_id=self.config.credentials["tenant_id"],
                client_id=self.config.credentials["client_id"],
                client_secret=self.config.credentials["client_secret"],
                scope="https://api.securitycenter.microsoft.com/.default"
            )
            self._token = await self._auth_provider.authenticate()
            return ConnectorResult(success=True)
        except Exception as e:
            raise AuthenticationError(f"Azure AD authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        if not self._token:
            return ConnectorResult(success=False, error_message="Not authenticated", error_code="NOT_AUTHENTICATED")

        data_type = kwargs.get("data_type", "alerts")
        all_data = []

        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {self._token.access_token}"}

                if data_type == "alerts":
                    url = f"{self.SECURITY_API}/alerts"
                elif data_type == "vulnerabilities":
                    url = f"{self.SECURITY_API}/vulnerabilities"
                elif data_type == "machines":
                    url = f"{self.SECURITY_API}/machines"
                else:
                    url = f"{self.SECURITY_API}/{data_type}"

                params = {"$top": kwargs.get("limit", 1000)}
                if kwargs.get("status"):
                    params["$filter"] = f"status eq '{kwargs['status']}'"

                while url:
                    response = await client.get(url, headers=headers, params=params if "?" not in url else None, timeout=self.config.timeout_seconds)

                    if response.status_code != 200:
                        return ConnectorResult(success=False, error_message=f"API error: {response.status_code}", error_code="API_ERROR")

                    data = response.json()
                    all_data.extend(data.get("value", []))

                    url = data.get("@odata.nextLink")
                    if len(all_data) >= kwargs.get("max_results", 5000):
                        break

            return ConnectorResult(success=True, data=all_data, items_processed=len(all_data), metadata={"data_type": data_type})
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="FETCH_ERROR")

    async def transform_data(self, raw_data: Any) -> List[DefenderAlert]:
        alerts = []
        for a in raw_data:
            alerts.append(DefenderAlert(
                id=a.get("id", ""),
                title=a.get("title", ""),
                severity=a.get("severity", "unknown"),
                status=a.get("status", ""),
                classification=a.get("classification"),
                determination=a.get("determination"),
                category=a.get("category", ""),
                machine_id=a.get("machineId"),
                computer_dns_name=a.get("computerDnsName"),
                first_event_time=a.get("firstEventTime"),
                last_event_time=a.get("lastEventTime"),
                alert_creation_time=a.get("alertCreationTime"),
                resolved_time=a.get("resolvedTime"),
                assigned_to=a.get("assignedTo"),
                description=a.get("description"),
                recommended_action=a.get("recommendedAction"),
                mitre_techniques=a.get("mitreTechniques", []),
                related_user=a.get("relatedUser", {}).get("userName") if a.get("relatedUser") else None,
                evidence=a.get("evidence", []),
            ))
        return alerts

    def get_config_schema(self) -> dict:
        base = super().get_config_schema()
        base["properties"].update({
            "tenant_id": {"type": "string", "description": "Azure AD Tenant ID"},
            "client_id": {"type": "string", "description": "Application (Client) ID"},
            "client_secret": {"type": "string", "format": "password", "description": "Client Secret"},
        })
        base["required"].extend(["tenant_id", "client_id", "client_secret"])
        return base
