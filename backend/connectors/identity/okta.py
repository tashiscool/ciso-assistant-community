"""
Okta Connector.

Provides identity and access management data from Okta.
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
class OktaUser:
    """Represents an Okta user."""
    id: str
    login: str
    email: str
    first_name: str
    last_name: str
    status: str
    created: Optional[str]
    activated: Optional[str]
    last_login: Optional[str]
    status_changed: Optional[str]
    password_changed: Optional[str]
    department: Optional[str] = None
    title: Optional[str] = None
    manager: Optional[str] = None
    groups: List[str] = field(default_factory=list)
    mfa_factors: List[str] = field(default_factory=list)


@dataclass
class OktaSecurityEvent:
    """Represents an Okta security event from system log."""
    id: str
    event_type: str
    severity: str
    display_message: str
    published: str
    actor_id: Optional[str]
    actor_display_name: Optional[str]
    target_id: Optional[str]
    target_display_name: Optional[str]
    client_ip: Optional[str] = None
    client_user_agent: Optional[str] = None
    outcome: str = "UNKNOWN"


@ConnectorRegistry.register
class OktaConnector(BaseConnector[OktaUser]):
    """Connector for Okta Identity Management."""

    connector_type = "okta"
    display_name = "Okta"
    description = "Cloud identity and access management platform"
    category = ConnectorCategory.IDENTITY
    supported_auth_types = ["api_key", "oauth2"]
    supports_sync = True
    supports_webhook = True

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._api_token: Optional[str] = None
        self._domain: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        required = ["domain", "api_token"]
        missing = [f for f in required if not self.config.credentials.get(f)]
        if missing:
            return ConnectorResult(success=False, error_message=f"Missing: {', '.join(missing)}", error_code="MISSING_CREDENTIALS")
        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        try:
            await self.authenticate()
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://{self._domain}/api/v1/org",
                    headers={"Authorization": f"SSWS {self._api_token}"},
                    timeout=self.config.timeout_seconds
                )
                if response.status_code == 200:
                    data = response.json()
                    return ConnectorResult(success=True, metadata={"org_name": data.get("name")})

            return ConnectorResult(success=False, error_message="API connection failed", error_code="CONNECTION_ERROR")
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="CONNECTION_ERROR")

    async def authenticate(self) -> ConnectorResult:
        self._api_token = self.config.credentials.get("api_token")
        self._domain = self.config.credentials.get("domain", "").replace("https://", "").rstrip("/")
        if not self._api_token or not self._domain:
            raise AuthenticationError("API token and domain required")
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        if not self._api_token:
            return ConnectorResult(success=False, error_message="Not authenticated", error_code="NOT_AUTHENTICATED")

        data_type = kwargs.get("data_type", "users")
        all_data = []

        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"SSWS {self._api_token}"}

                if data_type == "users":
                    url = f"https://{self._domain}/api/v1/users"
                elif data_type == "security_events":
                    url = f"https://{self._domain}/api/v1/logs"
                else:
                    url = f"https://{self._domain}/api/v1/{data_type}"

                while url:
                    response = await client.get(
                        url,
                        headers=headers,
                        params={"limit": 200} if "?" not in url else None,
                        timeout=self.config.timeout_seconds
                    )

                    if response.status_code != 200:
                        return ConnectorResult(success=False, error_message=f"API error: {response.status_code}", error_code="API_ERROR")

                    data = response.json()
                    all_data.extend(data)

                    # Handle pagination via Link header
                    link_header = response.headers.get("Link", "")
                    url = None
                    for link in link_header.split(","):
                        if 'rel="next"' in link:
                            url = link.split(";")[0].strip("<> ")
                            break

                    if len(all_data) >= kwargs.get("max_results", 5000):
                        break

            return ConnectorResult(success=True, data=all_data, items_processed=len(all_data), metadata={"data_type": data_type})
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="FETCH_ERROR")

    async def transform_data(self, raw_data: Any) -> List[OktaUser]:
        users = []
        for u in raw_data:
            profile = u.get("profile", {})
            users.append(OktaUser(
                id=u.get("id", ""),
                login=profile.get("login", ""),
                email=profile.get("email", ""),
                first_name=profile.get("firstName", ""),
                last_name=profile.get("lastName", ""),
                status=u.get("status", ""),
                created=u.get("created"),
                activated=u.get("activated"),
                last_login=u.get("lastLogin"),
                status_changed=u.get("statusChanged"),
                password_changed=u.get("passwordChanged"),
                department=profile.get("department"),
                title=profile.get("title"),
                manager=profile.get("manager"),
            ))
        return users

    def get_config_schema(self) -> dict:
        base = super().get_config_schema()
        base["properties"].update({
            "domain": {"type": "string", "description": "Okta domain (e.g., yourorg.okta.com)"},
            "api_token": {"type": "string", "format": "password", "description": "Okta API Token"},
        })
        base["required"].extend(["domain", "api_token"])
        return base
