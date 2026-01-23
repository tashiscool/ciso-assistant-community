"""
Salesforce Connector.

Provides CRM data integration and compliance evidence from Salesforce.
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


class ConnectorCategoryCRM(ConnectorCategory):
    """Extended category for CRM."""
    CRM_GRC = "crm_grc"


@dataclass
class SalesforceRecord:
    """Represents a Salesforce record."""
    id: str
    object_type: str
    name: str
    created_date: Optional[str]
    last_modified_date: Optional[str]
    owner_id: Optional[str]
    attributes: dict = field(default_factory=dict)


@dataclass
class SalesforceUser:
    """Represents a Salesforce user."""
    id: str
    username: str
    email: str
    name: str
    profile_name: str
    is_active: bool
    user_type: str
    last_login_date: Optional[str] = None
    created_date: Optional[str] = None
    roles: List[str] = field(default_factory=list)
    permission_sets: List[str] = field(default_factory=list)


@ConnectorRegistry.register
class SalesforceConnector(BaseConnector[SalesforceRecord]):
    """Connector for Salesforce CRM."""

    connector_type = "salesforce"
    display_name = "Salesforce"
    description = "CRM data integration and compliance evidence"
    category = ConnectorCategory.CRM_GRC
    supported_auth_types = ["oauth2"]
    supports_sync = True
    supports_webhook = True
    supports_bidirectional = True

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._access_token: Optional[str] = None
        self._instance_url: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        if self.config.credentials.get("auth_type") == "oauth2":
            required = ["client_id", "client_secret", "username", "password", "security_token"]
        else:
            required = ["username", "password", "security_token"]
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
                    f"{self._instance_url}/services/data/v58.0/limits",
                    headers={"Authorization": f"Bearer {self._access_token}"},
                    timeout=self.config.timeout_seconds
                )
                if response.status_code == 200:
                    return ConnectorResult(success=True)
            return ConnectorResult(success=False, error_message="API connection failed", error_code="CONNECTION_ERROR")
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="CONNECTION_ERROR")

    async def authenticate(self) -> ConnectorResult:
        try:
            login_url = self.config.credentials.get("login_url", "https://login.salesforce.com")

            async with httpx.AsyncClient() as client:
                if self.config.credentials.get("client_id"):
                    # OAuth2 Username-Password flow
                    response = await client.post(
                        f"{login_url}/services/oauth2/token",
                        data={
                            "grant_type": "password",
                            "client_id": self.config.credentials["client_id"],
                            "client_secret": self.config.credentials["client_secret"],
                            "username": self.config.credentials["username"],
                            "password": f"{self.config.credentials['password']}{self.config.credentials.get('security_token', '')}",
                        },
                        timeout=self.config.timeout_seconds
                    )
                else:
                    # SOAP login (legacy)
                    soap_body = f"""<?xml version="1.0" encoding="utf-8"?>
                    <env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                        xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
                        <env:Body>
                            <n1:login xmlns:n1="urn:partner.soap.sforce.com">
                                <n1:username>{self.config.credentials['username']}</n1:username>
                                <n1:password>{self.config.credentials['password']}{self.config.credentials.get('security_token', '')}</n1:password>
                            </n1:login>
                        </env:Body>
                    </env:Envelope>"""
                    response = await client.post(
                        f"{login_url}/services/Soap/u/58.0",
                        content=soap_body,
                        headers={"Content-Type": "text/xml", "SOAPAction": "login"},
                        timeout=self.config.timeout_seconds
                    )

                if response.status_code != 200:
                    raise AuthenticationError(f"Login failed: {response.status_code}")

                if self.config.credentials.get("client_id"):
                    data = response.json()
                    self._access_token = data.get("access_token")
                    self._instance_url = data.get("instance_url")
                else:
                    # Parse SOAP response
                    import xml.etree.ElementTree as ET
                    root = ET.fromstring(response.text)
                    ns = {"sf": "urn:partner.soap.sforce.com"}
                    self._access_token = root.find(".//sf:sessionId", ns).text
                    self._instance_url = root.find(".//sf:serverUrl", ns).text.rsplit("/services", 1)[0]

                return ConnectorResult(success=True)
        except Exception as e:
            raise AuthenticationError(f"Salesforce authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        if not self._access_token:
            return ConnectorResult(success=False, error_message="Not authenticated", error_code="NOT_AUTHENTICATED")

        soql_query = kwargs.get("query")
        object_type = kwargs.get("object_type", "User")
        all_records = []

        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {self._access_token}"}

                if soql_query:
                    url = f"{self._instance_url}/services/data/v58.0/query?q={soql_query}"
                else:
                    # Default queries for common compliance needs
                    if object_type == "User":
                        soql_query = "SELECT Id, Username, Email, Name, Profile.Name, IsActive, UserType, LastLoginDate, CreatedDate FROM User"
                    elif object_type == "LoginHistory":
                        soql_query = "SELECT UserId, LoginTime, SourceIp, Status, Application FROM LoginHistory ORDER BY LoginTime DESC LIMIT 1000"
                    elif object_type == "SetupAuditTrail":
                        soql_query = "SELECT CreatedDate, CreatedById, Display, Section, Action FROM SetupAuditTrail ORDER BY CreatedDate DESC LIMIT 1000"
                    else:
                        soql_query = f"SELECT Id, Name, CreatedDate, LastModifiedDate FROM {object_type} LIMIT 1000"

                    url = f"{self._instance_url}/services/data/v58.0/query?q={soql_query}"

                while url:
                    response = await client.get(url, headers=headers, timeout=self.config.timeout_seconds)

                    if response.status_code != 200:
                        return ConnectorResult(success=False, error_message=f"Query failed: {response.status_code}", error_code="API_ERROR")

                    data = response.json()
                    records = data.get("records", [])
                    for r in records:
                        r["_object_type"] = object_type
                    all_records.extend(records)

                    if data.get("nextRecordsUrl"):
                        url = f"{self._instance_url}{data['nextRecordsUrl']}"
                    else:
                        url = None

                    if len(all_records) >= kwargs.get("max_results", 10000):
                        break

            return ConnectorResult(success=True, data=all_records, items_processed=len(all_records))
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="FETCH_ERROR")

    async def transform_data(self, raw_data: Any) -> List[SalesforceRecord]:
        records = []
        for r in raw_data:
            attrs = {k: v for k, v in r.items() if not k.startswith("_") and k not in ["attributes", "Id"]}
            records.append(SalesforceRecord(
                id=r.get("Id", ""),
                object_type=r.get("_object_type", r.get("attributes", {}).get("type", "Unknown")),
                name=r.get("Name") or r.get("Username") or r.get("Id", ""),
                created_date=r.get("CreatedDate"),
                last_modified_date=r.get("LastModifiedDate"),
                owner_id=r.get("OwnerId"),
                attributes=attrs,
            ))
        return records

    def get_config_schema(self) -> dict:
        base = super().get_config_schema()
        base["properties"].update({
            "login_url": {"type": "string", "format": "uri", "description": "Salesforce login URL", "default": "https://login.salesforce.com"},
            "client_id": {"type": "string", "description": "Connected App Client ID (Consumer Key)"},
            "client_secret": {"type": "string", "format": "password", "description": "Connected App Client Secret"},
            "username": {"type": "string", "description": "Salesforce username"},
            "password": {"type": "string", "format": "password", "description": "Salesforce password"},
            "security_token": {"type": "string", "format": "password", "description": "Salesforce security token"},
        })
        base["required"].extend(["username", "password"])
        return base
