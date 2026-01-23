"""
Active Directory Connector.

Provides identity and access management data from on-premises AD.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import logging

from ..base.connector import (
    BaseConnector, ConnectorCategory, ConnectorConfig, ConnectorResult, AuthenticationError
)
from ..base.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


@dataclass
class ADUser:
    """Represents an Active Directory user."""
    id: str
    sam_account_name: str
    user_principal_name: str
    display_name: str
    email: Optional[str]
    enabled: bool
    locked_out: bool
    department: Optional[str] = None
    title: Optional[str] = None
    manager: Optional[str] = None
    groups: List[str] = field(default_factory=list)
    last_logon: Optional[str] = None
    password_last_set: Optional[str] = None
    password_never_expires: bool = False
    created: Optional[str] = None
    modified: Optional[str] = None


@dataclass
class ADComputer:
    """Represents an Active Directory computer."""
    id: str
    name: str
    dns_host_name: Optional[str]
    operating_system: Optional[str]
    operating_system_version: Optional[str]
    enabled: bool
    last_logon: Optional[str] = None
    created: Optional[str] = None


@ConnectorRegistry.register
class ActiveDirectoryConnector(BaseConnector[ADUser]):
    """Connector for Microsoft Active Directory."""

    connector_type = "active_directory"
    display_name = "Active Directory"
    description = "On-premises identity and access management"
    category = ConnectorCategory.IDENTITY
    supported_auth_types = ["basic", "kerberos"]
    supports_sync = True
    supports_webhook = False

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._connection = None

    async def validate_config(self) -> ConnectorResult:
        required = ["server", "base_dn", "username", "password"]
        missing = [f for f in required if not self.config.credentials.get(f)]
        if missing:
            return ConnectorResult(success=False, error_message=f"Missing: {', '.join(missing)}", error_code="MISSING_CREDENTIALS")
        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        try:
            # Note: Actual LDAP connection requires ldap3 library
            # This is a placeholder for the connection test
            server = self.config.credentials.get("server")
            if not server:
                return ConnectorResult(success=False, error_message="Server not configured", error_code="MISSING_CONFIG")

            # In production, would use ldap3 to test connection
            return ConnectorResult(
                success=True,
                metadata={"server": server, "note": "LDAP connection requires ldap3 library"}
            )
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="CONNECTION_ERROR")

    async def authenticate(self) -> ConnectorResult:
        try:
            # In production, establish LDAP connection here
            # from ldap3 import Server, Connection, ALL
            # server = Server(self.config.credentials["server"], get_info=ALL)
            # self._connection = Connection(
            #     server,
            #     user=self.config.credentials["username"],
            #     password=self.config.credentials["password"],
            #     auto_bind=True
            # )
            return ConnectorResult(success=True)
        except Exception as e:
            raise AuthenticationError(f"LDAP authentication failed: {e}")

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        # Placeholder for LDAP search
        # In production:
        # search_filter = kwargs.get("filter", "(objectClass=user)")
        # self._connection.search(
        #     self.config.credentials["base_dn"],
        #     search_filter,
        #     attributes=['*']
        # )
        # entries = self._connection.entries

        return ConnectorResult(
            success=True,
            data=[],
            metadata={"note": "LDAP search requires ldap3 library"}
        )

    async def transform_data(self, raw_data: Any) -> List[ADUser]:
        users = []
        for entry in raw_data:
            users.append(ADUser(
                id=str(entry.get("objectGUID", "")),
                sam_account_name=entry.get("sAMAccountName", ""),
                user_principal_name=entry.get("userPrincipalName", ""),
                display_name=entry.get("displayName", ""),
                email=entry.get("mail"),
                enabled=not (int(entry.get("userAccountControl", 0)) & 2),
                locked_out=bool(int(entry.get("userAccountControl", 0)) & 16),
                department=entry.get("department"),
                title=entry.get("title"),
                manager=entry.get("manager"),
                groups=entry.get("memberOf", []),
                last_logon=entry.get("lastLogon"),
                password_last_set=entry.get("pwdLastSet"),
                password_never_expires=bool(int(entry.get("userAccountControl", 0)) & 65536),
                created=entry.get("whenCreated"),
                modified=entry.get("whenChanged"),
            ))
        return users

    def get_config_schema(self) -> dict:
        base = super().get_config_schema()
        base["properties"].update({
            "server": {"type": "string", "description": "AD Domain Controller (ldap://dc.domain.com or ldaps://dc.domain.com)"},
            "base_dn": {"type": "string", "description": "Base DN (e.g., DC=domain,DC=com)"},
            "username": {"type": "string", "description": "Bind username (DOMAIN\\\\user or user@domain.com)"},
            "password": {"type": "string", "format": "password", "description": "Bind password"},
            "use_ssl": {"type": "boolean", "default": True, "description": "Use LDAPS"},
        })
        base["required"].extend(["server", "base_dn", "username", "password"])
        return base
