"""
JFrog Xray Connector.

Provides artifact security scanning from JFrog Xray.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import logging
import httpx
import base64

from ..base.connector import (
    BaseConnector, ConnectorCategory, ConnectorConfig, ConnectorResult, AuthenticationError
)
from ..base.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


@dataclass
class XrayViolation:
    """Represents a JFrog Xray security violation."""
    id: str
    issue_id: str
    severity: str
    violation_type: str
    component_name: str
    component_version: str
    artifact_name: str
    cve_ids: List[str] = field(default_factory=list)
    cvss_score: Optional[float] = None
    description: Optional[str] = None
    fixed_versions: List[str] = field(default_factory=list)
    watch_name: Optional[str] = None
    policy_name: Optional[str] = None
    created: Optional[str] = None


@ConnectorRegistry.register
class XrayConnector(BaseConnector[XrayViolation]):
    """Connector for JFrog Xray."""

    connector_type = "xray"
    display_name = "JFrog Xray"
    description = "Artifact security scanning for DevOps pipelines"
    category = ConnectorCategory.CICD
    supported_auth_types = ["api_key", "basic"]
    supports_sync = True
    supports_webhook = True

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._auth_header: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        if not self.config.base_url:
            return ConnectorResult(success=False, error_message="Xray URL required", error_code="MISSING_CONFIG")
        if not (self.config.credentials.get("api_key") or (self.config.credentials.get("username") and self.config.credentials.get("password"))):
            return ConnectorResult(success=False, error_message="API key or username/password required", error_code="MISSING_CREDENTIALS")
        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        try:
            await self.authenticate()
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.config.base_url}/api/v1/system/ping",
                    headers={"Authorization": self._auth_header},
                    timeout=self.config.timeout_seconds
                )
                if response.status_code == 200:
                    return ConnectorResult(success=True)
            return ConnectorResult(success=False, error_message="API connection failed", error_code="CONNECTION_ERROR")
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="CONNECTION_ERROR")

    async def authenticate(self) -> ConnectorResult:
        if self.config.credentials.get("api_key"):
            self._auth_header = f"Bearer {self.config.credentials['api_key']}"
        else:
            creds = f"{self.config.credentials['username']}:{self.config.credentials['password']}"
            self._auth_header = f"Basic {base64.b64encode(creds.encode()).decode()}"
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        if not self._auth_header:
            return ConnectorResult(success=False, error_message="Not authenticated", error_code="NOT_AUTHENTICATED")

        all_violations = []
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": self._auth_header, "Content-Type": "application/json"}

                # Get violations
                body = {
                    "filters": kwargs.get("filters", {}),
                    "pagination": {"limit": kwargs.get("limit", 500), "offset": 0}
                }

                response = await client.post(
                    f"{self.config.base_url}/api/v1/violations",
                    headers=headers,
                    json=body,
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    data = response.json()
                    all_violations = data.get("violations", [])

            return ConnectorResult(success=True, data=all_violations, items_processed=len(all_violations))
        except Exception as e:
            return ConnectorResult(success=False, error_message=str(e), error_code="FETCH_ERROR")

    async def transform_data(self, raw_data: Any) -> List[XrayViolation]:
        violations = []
        for v in raw_data:
            violations.append(XrayViolation(
                id=v.get("violation_details_url", ""),
                issue_id=v.get("issue_id", ""),
                severity=v.get("severity", "unknown"),
                violation_type=v.get("type", ""),
                component_name=v.get("infected_components", [{}])[0].get("name", "") if v.get("infected_components") else "",
                component_version=v.get("infected_components", [{}])[0].get("version", "") if v.get("infected_components") else "",
                artifact_name=v.get("artifact", ""),
                cve_ids=v.get("cve", []),
                cvss_score=v.get("cvss_v3_score"),
                description=v.get("description"),
                fixed_versions=v.get("fixed_versions", []),
                watch_name=v.get("watch_name"),
                policy_name=v.get("policy_name"),
                created=v.get("created"),
            ))
        return violations

    def get_config_schema(self) -> dict:
        base = super().get_config_schema()
        base["properties"].update({
            "xray_url": {"type": "string", "format": "uri", "description": "JFrog Xray URL"},
            "api_key": {"type": "string", "format": "password", "description": "JFrog API Key or Access Token"},
            "username": {"type": "string", "description": "JFrog Username (if not using API key)"},
            "password": {"type": "string", "format": "password", "description": "JFrog Password"},
        })
        return base
