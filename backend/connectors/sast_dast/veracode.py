"""
Veracode Security Connector.

Veracode provides enterprise application security testing (SAST, DAST, SCA).
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import hmac
import hashlib
import logging
import time
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
class VeracodeFinding:
    """Represents a Veracode security finding."""
    id: str
    issue_id: str
    cwe_id: str
    severity: int
    severity_name: str
    finding_category: str
    finding_type: str
    application_name: str
    module_name: Optional[str] = None
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    description: Optional[str] = None
    remediation: Optional[str] = None
    mitigation_status: Optional[str] = None
    first_found_date: Optional[str] = None
    date_last_updated: Optional[str] = None
    policy_name: Optional[str] = None
    grace_period_expires: Optional[str] = None
    exploitability: Optional[str] = None


@ConnectorRegistry.register
class VeracodeConnector(BaseConnector[VeracodeFinding]):
    """
    Connector for Veracode application security platform.

    Capabilities:
    - Fetch SAST findings
    - Get SCA vulnerabilities
    - Retrieve DAST results
    - Pull policy compliance data
    """

    connector_type = "veracode"
    display_name = "Veracode"
    description = "Enterprise application security testing platform"
    category = ConnectorCategory.SAST_DAST
    supported_auth_types = ["api_key"]

    supports_sync = True
    supports_webhook = True
    supports_bidirectional = False

    API_BASE = "https://api.veracode.com"

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._api_id: Optional[str] = None
        self._api_key: Optional[str] = None

    def _generate_auth_header(self, method: str, url: str) -> str:
        """Generate HMAC authentication header for Veracode API."""
        # Veracode HMAC authentication
        nonce = hashlib.md5(str(time.time()).encode()).hexdigest()
        timestamp = str(int(time.time() * 1000))

        # Parse URL for signing
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path
        if parsed.query:
            path = f"{path}?{parsed.query}"

        data = f"id={self._api_id}&host={parsed.netloc}&url={path}&method={method}"
        signature_data = f"{nonce}{timestamp}{data}"

        signature = hmac.new(
            self._api_key.encode(),
            signature_data.encode(),
            hashlib.sha256
        ).hexdigest()

        return (
            f'VERACODE-HMAC-SHA-256 id={self._api_id},'
            f'ts={timestamp},'
            f'nonce={nonce},'
            f'sig={signature}'
        )

    async def validate_config(self) -> ConnectorResult:
        """Validate Veracode configuration."""
        required = ["api_id", "api_key"]
        missing = [f for f in required if not self.config.credentials.get(f)]

        if missing:
            return ConnectorResult(
                success=False,
                error_message=f"Missing required credentials: {', '.join(missing)}",
                error_code="MISSING_CREDENTIALS"
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to Veracode API."""
        try:
            self._api_id = self.config.credentials["api_id"]
            self._api_key = self.config.credentials["api_key"]

            url = f"{self.API_BASE}/appsec/v1/applications"
            auth_header = self._generate_auth_header("GET", url)

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers={"Authorization": auth_header},
                    params={"size": 1},
                    timeout=self.config.timeout_seconds
                )

                if response.status_code == 200:
                    return ConnectorResult(success=True)
                elif response.status_code == 401:
                    return ConnectorResult(
                        success=False,
                        error_message="Invalid API credentials",
                        error_code="AUTH_ERROR"
                    )

            return ConnectorResult(
                success=False,
                error_message="Failed to connect to Veracode API",
                error_code="CONNECTION_ERROR"
            )

        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="CONNECTION_ERROR"
            )

    async def authenticate(self) -> ConnectorResult:
        """Set up Veracode credentials."""
        self._api_id = self.config.credentials.get("api_id")
        self._api_key = self.config.credentials.get("api_key")

        if not self._api_id or not self._api_key:
            raise AuthenticationError("API credentials not configured")

        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch findings from Veracode."""
        if self._api_id is None or self._api_key is None:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED"
            )

        all_findings = []

        try:
            async with httpx.AsyncClient() as client:
                # Get applications
                apps_url = f"{self.API_BASE}/appsec/v1/applications"
                auth_header = self._generate_auth_header("GET", apps_url)

                response = await client.get(
                    apps_url,
                    headers={"Authorization": auth_header},
                    params={"size": 500},
                    timeout=self.config.timeout_seconds
                )

                if response.status_code != 200:
                    return ConnectorResult(
                        success=False,
                        error_message=f"Failed to fetch applications: {response.status_code}",
                        error_code="API_ERROR"
                    )

                apps_data = response.json()
                applications = apps_data.get("_embedded", {}).get("applications", [])

                # Filter applications if specified
                app_filter = kwargs.get("application_guids")
                if app_filter:
                    applications = [a for a in applications if a["guid"] in app_filter]

                # Fetch findings for each application
                for app in applications:
                    app_guid = app["guid"]
                    app_name = app.get("profile", {}).get("name", app_guid)

                    findings_url = f"{self.API_BASE}/appsec/v2/applications/{app_guid}/findings"
                    auth_header = self._generate_auth_header("GET", findings_url)

                    findings_response = await client.get(
                        findings_url,
                        headers={"Authorization": auth_header},
                        params={
                            "size": 500,
                            "scan_type": kwargs.get("scan_type", "STATIC,DYNAMIC,SCA"),
                        },
                        timeout=self.config.timeout_seconds
                    )

                    if findings_response.status_code == 200:
                        findings_data = findings_response.json()
                        for finding in findings_data.get("_embedded", {}).get("findings", []):
                            finding["_application_name"] = app_name
                            all_findings.append(finding)

            return ConnectorResult(
                success=True,
                data=all_findings,
                items_processed=len(all_findings),
                metadata={"applications_scanned": len(applications)}
            )

        except Exception as e:
            logger.error(f"Veracode fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def transform_data(self, raw_data: Any) -> List[VeracodeFinding]:
        """Transform Veracode findings to VeracodeFinding objects."""
        findings = []
        severity_map = {0: "Informational", 1: "Very Low", 2: "Low", 3: "Medium", 4: "High", 5: "Very High"}

        for finding in raw_data:
            finding_details = finding.get("finding_details", {})
            severity = finding.get("finding_status", {}).get("severity", 0)

            veracode_finding = VeracodeFinding(
                id=finding.get("guid", ""),
                issue_id=str(finding.get("issue_id", "")),
                cwe_id=str(finding_details.get("cwe", {}).get("id", "")),
                severity=severity,
                severity_name=severity_map.get(severity, "Unknown"),
                finding_category=finding.get("finding_category", {}).get("name", ""),
                finding_type=finding.get("scan_type", ""),
                application_name=finding.get("_application_name", ""),
                module_name=finding_details.get("module"),
                source_file=finding_details.get("file_path"),
                line_number=finding_details.get("file_line_number"),
                description=finding.get("description"),
                remediation=finding_details.get("cwe", {}).get("remediation"),
                mitigation_status=finding.get("finding_status", {}).get("status"),
                first_found_date=finding.get("finding_status", {}).get("first_found_date"),
                date_last_updated=finding.get("finding_status", {}).get("last_seen_date"),
                exploitability=finding.get("finding_details", {}).get("exploitability"),
            )
            findings.append(veracode_finding)

        return findings

    def get_config_schema(self) -> dict:
        """Return Veracode-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "api_id": {
                "type": "string",
                "description": "Veracode API ID"
            },
            "api_key": {
                "type": "string",
                "description": "Veracode API Key",
                "format": "password"
            }
        })
        base["required"].extend(["api_id", "api_key"])
        return base
