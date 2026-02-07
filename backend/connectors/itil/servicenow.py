"""
ServiceNow Connector.

Imports incidents, configuration items, and security findings from
ServiceNow via the Table REST API.
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
class ServiceNowRecord:
    """Represents a ServiceNow record mapped as a finding."""

    id: str
    number: str
    short_description: str
    severity: str
    state: str
    table: str
    priority: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    assignment_group: Optional[str] = None
    caller: Optional[str] = None
    cmdb_ci: Optional[str] = None
    impact: Optional[str] = None
    urgency: Optional[str] = None
    opened_at: Optional[str] = None
    closed_at: Optional[str] = None
    resolved_at: Optional[str] = None
    updated_at: Optional[str] = None
    close_notes: Optional[str] = None
    resolution_code: Optional[str] = None
    work_notes: Optional[str] = None
    sys_id: Optional[str] = None


@ConnectorRegistry.register
class ServiceNowConnector(BaseConnector[ServiceNowRecord]):
    """
    Connector for ServiceNow.

    Queries the ServiceNow Table REST API to fetch incidents,
    security incidents, configuration items, or other records and maps
    them to normalized findings for CISO Assistant.
    """

    connector_type = "servicenow"
    display_name = "ServiceNow"
    description = "Incidents and CMDB data from ServiceNow"
    category = ConnectorCategory.CRM_GRC
    supported_auth_types = ["api_key"]

    supports_sync = True
    supports_webhook = False
    supports_bidirectional = True

    config_schema = {
        "required": ["instance_url", "username", "password"],
        "properties": {
            "instance_url": {
                "type": "string",
                "format": "uri",
                "description": "ServiceNow instance URL (e.g. https://mycompany.service-now.com)",
            },
            "username": {
                "type": "string",
                "description": "ServiceNow username",
            },
            "password": {
                "type": "string",
                "format": "password",
                "description": "ServiceNow password",
            },
            "table": {
                "type": "string",
                "description": "ServiceNow table to query",
                "default": "incident",
            },
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._instance_url: Optional[str] = None
        self._auth: Optional[tuple] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate ServiceNow connection settings."""
        instance_url = (
            self.config.base_url
            or self.config.extra_settings.get("instance_url")
        )
        if not instance_url:
            return ConnectorResult(
                success=False,
                error_message="ServiceNow instance_url is required",
                error_code="MISSING_CONFIG",
            )

        required_creds = ["username", "password"]
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
        """Test connection to ServiceNow by querying the table API."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            import httpx

            table = self.config.extra_settings.get("table", "incident")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self._instance_url}/api/now/table/{table}",
                    params={"sysparm_limit": 1},
                    auth=self._auth,
                    headers={"Accept": "application/json"},
                    timeout=self.config.timeout_seconds,
                )

                if response.status_code == 200:
                    return ConnectorResult(
                        success=True,
                        metadata={
                            "instance_url": self._instance_url,
                            "table": table,
                        },
                    )
                elif response.status_code == 401:
                    return ConnectorResult(
                        success=False,
                        error_message="Authentication failed",
                        error_code="AUTH_ERROR",
                    )
                else:
                    return ConnectorResult(
                        success=False,
                        error_message=f"ServiceNow API returned {response.status_code}",
                        error_code="API_ERROR",
                    )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=f"Failed to connect to ServiceNow: {e}",
                error_code="CONNECTION_ERROR",
            )

    async def authenticate(self) -> ConnectorResult:
        """Set up Basic authentication for ServiceNow."""
        try:
            import httpx  # noqa: F401 - verify import availability
        except ImportError:
            raise AuthenticationError(
                "httpx is required for the ServiceNow connector. "
                "Install it with: pip install httpx"
            )

        self._instance_url = (
            self.config.base_url
            or self.config.extra_settings.get("instance_url", "")
        ).rstrip("/")

        username = self.config.credentials.get("username")
        password = self.config.credentials.get("password")

        if not username or not password:
            raise AuthenticationError(
                "ServiceNow username and password are required"
            )

        self._auth = (username, password)
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch records from ServiceNow Table REST API."""
        if not self._instance_url or not self._auth:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED",
            )

        try:
            import httpx

            table = kwargs.get(
                "table",
                self.config.extra_settings.get("table", "incident"),
            )

            all_records = []
            offset = 0
            page_size = 100

            # Build query parameters
            query = kwargs.get(
                "query",
                self.config.extra_settings.get("query", ""),
            )

            # Optional: fields to retrieve
            fields = kwargs.get(
                "fields",
                self.config.extra_settings.get(
                    "fields",
                    "sys_id,number,short_description,description,priority,"
                    "severity,state,category,subcategory,assigned_to,"
                    "assignment_group,caller_id,cmdb_ci,impact,urgency,"
                    "opened_at,closed_at,resolved_at,sys_updated_on,"
                    "close_notes,resolution_code",
                ),
            )

            async with httpx.AsyncClient() as client:
                while True:
                    params = {
                        "sysparm_limit": page_size,
                        "sysparm_offset": offset,
                        "sysparm_display_value": "true",
                    }

                    if query:
                        params["sysparm_query"] = query
                    if fields:
                        params["sysparm_fields"] = fields

                    response = await client.get(
                        f"{self._instance_url}/api/now/table/{table}",
                        params=params,
                        auth=self._auth,
                        headers={"Accept": "application/json"},
                        timeout=self.config.timeout_seconds,
                    )

                    if response.status_code != 200:
                        return ConnectorResult(
                            success=False,
                            error_message=f"ServiceNow API error: {response.status_code} - {response.text}",
                            error_code="API_ERROR",
                        )

                    data = response.json()
                    records = data.get("result", [])
                    all_records.extend(records)

                    # Check if there are more records
                    if len(records) < page_size:
                        break

                    offset += page_size

                    # Safety limit to prevent infinite loops
                    if offset > 10000:
                        logger.warning(
                            "ServiceNow fetch reached safety limit of 10000 records"
                        )
                        break

            # Tag each record with the table name for transform
            for record in all_records:
                record["_table"] = table

            return ConnectorResult(
                success=True,
                data=all_records,
                items_processed=len(all_records),
                metadata={
                    "table": table,
                    "total_records": len(all_records),
                    "instance_url": self._instance_url,
                },
            )

        except Exception as e:
            logger.error(f"ServiceNow fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    async def transform_data(
        self, raw_data: Any
    ) -> List[ServiceNowRecord]:
        """Transform ServiceNow records to ServiceNowRecord objects."""
        records = []

        # ServiceNow priority/severity mapping
        # Priority: 1 - Critical, 2 - High, 3 - Moderate, 4 - Low, 5 - Planning
        priority_severity_map = {
            "1": "critical",
            "1 - Critical": "critical",
            "2": "high",
            "2 - High": "high",
            "3": "medium",
            "3 - Moderate": "medium",
            "4": "low",
            "4 - Low": "low",
            "5": "info",
            "5 - Planning": "info",
        }

        # State display values
        state_map = {
            "1": "New",
            "2": "In Progress",
            "3": "On Hold",
            "6": "Resolved",
            "7": "Closed",
            "8": "Canceled",
        }

        for r in raw_data:
            priority_raw = r.get("priority", "")
            severity = priority_severity_map.get(
                str(priority_raw), "info"
            )

            # Also check the severity field directly
            severity_raw = r.get("severity", "")
            if severity_raw:
                direct_severity = priority_severity_map.get(
                    str(severity_raw)
                )
                if direct_severity:
                    severity = direct_severity

            state_raw = r.get("state", "")
            state = state_map.get(str(state_raw), str(state_raw))

            # Handle display values vs sys_id references
            def get_display_value(field_val):
                if isinstance(field_val, dict):
                    return field_val.get("display_value", field_val.get("value", ""))
                return str(field_val) if field_val else None

            record = ServiceNowRecord(
                id=r.get("sys_id", ""),
                number=r.get("number", ""),
                short_description=r.get("short_description", ""),
                severity=severity,
                state=state,
                table=r.get("_table", "incident"),
                priority=str(priority_raw),
                category=r.get("category"),
                subcategory=r.get("subcategory"),
                description=r.get("description"),
                assigned_to=get_display_value(r.get("assigned_to")),
                assignment_group=get_display_value(
                    r.get("assignment_group")
                ),
                caller=get_display_value(r.get("caller_id")),
                cmdb_ci=get_display_value(r.get("cmdb_ci")),
                impact=r.get("impact"),
                urgency=r.get("urgency"),
                opened_at=r.get("opened_at"),
                closed_at=r.get("closed_at"),
                resolved_at=r.get("resolved_at"),
                updated_at=r.get("sys_updated_on"),
                close_notes=r.get("close_notes"),
                resolution_code=r.get("resolution_code"),
                sys_id=r.get("sys_id"),
            )
            records.append(record)

        return records

    def get_config_schema(self) -> dict:
        """Return ServiceNow specific config schema."""
        base = super().get_config_schema()
        base["properties"].update(
            {
                "instance_url": {
                    "type": "string",
                    "format": "uri",
                    "description": "ServiceNow Instance URL",
                },
                "username": {
                    "type": "string",
                    "description": "ServiceNow Username",
                },
                "password": {
                    "type": "string",
                    "format": "password",
                    "description": "ServiceNow Password",
                },
                "table": {
                    "type": "string",
                    "description": "Table to query (default: incident)",
                    "default": "incident",
                },
                "query": {
                    "type": "string",
                    "description": "ServiceNow encoded query filter",
                },
            }
        )
        base["required"].extend(["instance_url", "username", "password"])
        return base
