"""
Microsoft Intune Connector.

Provides device management and compliance data from Microsoft Intune.
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
class IntuneDevice:
    """Represents a Microsoft Intune managed device."""
    id: str
    device_name: str
    user_display_name: Optional[str]
    user_principal_name: Optional[str]
    operating_system: str
    os_version: str
    compliance_state: str
    managed_device_owner_type: str
    enrollment_type: str
    is_encrypted: bool = False
    is_supervised: bool = False
    jail_broken: str = "Unknown"
    azure_ad_registered: bool = False
    azure_ad_device_id: Optional[str] = None
    last_sync: Optional[str] = None
    enrolled_datetime: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    compliance_policies: List[dict] = field(default_factory=list)


@ConnectorRegistry.register
class IntuneConnector(BaseConnector[IntuneDevice]):
    """Connector for Microsoft Intune."""

    connector_type = "intune"
    display_name = "Microsoft Intune"
    description = "Cloud-based device and application management"
    category = ConnectorCategory.IDENTITY
    supported_auth_types = ["oauth2"]
    supports_sync = True
    supports_webhook = True

    GRAPH_API = "https://graph.microsoft.com/v1.0"

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
                    f"{self.GRAPH_API}/organization",
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
                scope="https://graph.microsoft.com/.default"
            )
            self._token = await self._auth_provider.authenticate()
            return ConnectorResult(success=True)
        except Exception as e:
            raise AuthenticationError(f"Azure AD authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        if not self._token:
            return ConnectorResult(success=False, error_message="Not authenticated", error_code="NOT_AUTHENTICATED")

        all_devices = []

        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {self._token.access_token}"}
                url = f"{self.GRAPH_API}/deviceManagement/managedDevices"

                while url:
                    response = await client.get(
                        url,
                        headers=headers,
                        params={"$top": 100} if "?" not in url else None,
                        timeout=self.config.timeout_seconds
                    )

                    if response.status_code != 200:
                        return ConnectorResult(success=False, error_message=f"API error: {response.status_code}", error_code="API_ERROR")

                    data = response.json()
                    all_devices.extend(data.get("value", []))

                    url = data.get("@odata.nextLink")

                    if len(all_devices) >= kwargs.get("max_results", 5000):
                        break

            return ConnectorResult(success=True, data=all_devices, items_processed=len(all_devices))
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="FETCH_ERROR")

    async def transform_data(self, raw_data: Any) -> List[IntuneDevice]:
        devices = []
        for d in raw_data:
            devices.append(IntuneDevice(
                id=d.get("id", ""),
                device_name=d.get("deviceName", ""),
                user_display_name=d.get("userDisplayName"),
                user_principal_name=d.get("userPrincipalName"),
                operating_system=d.get("operatingSystem", ""),
                os_version=d.get("osVersion", ""),
                compliance_state=d.get("complianceState", "unknown"),
                managed_device_owner_type=d.get("managedDeviceOwnerType", ""),
                enrollment_type=d.get("enrollmentType", ""),
                is_encrypted=d.get("isEncrypted", False),
                is_supervised=d.get("isSupervised", False),
                jail_broken=d.get("jailBroken", "Unknown"),
                azure_ad_registered=d.get("azureADRegistered", False),
                azure_ad_device_id=d.get("azureADDeviceId"),
                last_sync=d.get("lastSyncDateTime"),
                enrolled_datetime=d.get("enrolledDateTime"),
                manufacturer=d.get("manufacturer"),
                model=d.get("model"),
                serial_number=d.get("serialNumber"),
            ))
        return devices

    def get_config_schema(self) -> dict:
        base = super().get_config_schema()
        base["properties"].update({
            "tenant_id": {"type": "string", "description": "Azure AD Tenant ID"},
            "client_id": {"type": "string", "description": "Application (Client) ID"},
            "client_secret": {"type": "string", "format": "password", "description": "Client Secret"},
        })
        base["required"].extend(["tenant_id", "client_id", "client_secret"])
        return base
