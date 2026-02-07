"""
Checkmarx SAST Connector.

Imports static application security testing (SAST) scan results from
Checkmarx, mapping vulnerability findings with CWE classification.
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
class CheckmarxFinding:
    """Represents a Checkmarx SAST vulnerability finding."""

    id: str
    query_name: str
    severity: str
    status: str
    state: str
    cwe_id: Optional[int] = None
    cwe_name: Optional[str] = None
    language: Optional[str] = None
    source_file: Optional[str] = None
    source_line: Optional[int] = None
    source_method: Optional[str] = None
    dest_file: Optional[str] = None
    dest_line: Optional[int] = None
    dest_method: Optional[str] = None
    description: Optional[str] = None
    categories: List[str] = field(default_factory=list)
    project_name: Optional[str] = None
    scan_id: Optional[str] = None
    result_deep_link: Optional[str] = None
    false_positive: bool = False
    first_found: Optional[str] = None


@ConnectorRegistry.register
class CheckmarxConnector(BaseConnector[CheckmarxFinding]):
    """
    Connector for Checkmarx SAST.

    Authenticates with the Checkmarx REST API, fetches SAST scan results
    for a given project, and maps findings with CWE IDs and code locations.
    Supports both Checkmarx SAST (on-prem) and Checkmarx One (cloud).
    """

    connector_type = "checkmarx"
    display_name = "Checkmarx SAST"
    description = "Static application security testing results from Checkmarx"
    category = ConnectorCategory.SAST_DAST
    supported_auth_types = ["oauth2"]

    supports_sync = True
    supports_webhook = False
    supports_bidirectional = False

    config_schema = {
        "required": ["url", "username", "password"],
        "properties": {
            "url": {
                "type": "string",
                "format": "uri",
                "description": "Checkmarx server URL",
            },
            "username": {
                "type": "string",
                "description": "Checkmarx username",
            },
            "password": {
                "type": "string",
                "format": "password",
                "description": "Checkmarx password",
            },
            "project_id": {
                "type": "string",
                "description": "Checkmarx project ID (fetches latest scan)",
            },
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._access_token: Optional[str] = None
        self._api_base: Optional[str] = None

    async def validate_config(self) -> ConnectorResult:
        """Validate Checkmarx credentials and URL are configured."""
        url = self.config.base_url or self.config.extra_settings.get("url")
        if not url:
            return ConnectorResult(
                success=False,
                error_message="Checkmarx server URL is required",
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
        """Test connection by authenticating with Checkmarx."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            return ConnectorResult(
                success=True,
                metadata={"api_base": self._api_base},
            )
        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=f"Failed to connect to Checkmarx: {e}",
                error_code="CONNECTION_ERROR",
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with Checkmarx using username/password OAuth2 flow."""
        try:
            import httpx
        except ImportError:
            raise AuthenticationError(
                "httpx is required for the Checkmarx connector. "
                "Install it with: pip install httpx"
            )

        self._api_base = (
            self.config.base_url
            or self.config.extra_settings.get("url", "")
        ).rstrip("/")

        try:
            async with httpx.AsyncClient(verify=False) as client:
                # Checkmarx SAST uses OAuth2 resource owner password flow
                response = await client.post(
                    f"{self._api_base}/cxrestapi/auth/identity/connect/token",
                    data={
                        "username": self.config.credentials["username"],
                        "password": self.config.credentials["password"],
                        "grant_type": "password",
                        "scope": "sast_rest_api",
                        "client_id": "resource_owner_client",
                        "client_secret": "014DF517-39D1-4453-B7B3-9930C563627C",
                    },
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    timeout=self.config.timeout_seconds,
                )

                if response.status_code != 200:
                    raise AuthenticationError(
                        f"Checkmarx authentication failed with status {response.status_code}: "
                        f"{response.text}"
                    )

                token_data = response.json()
                self._access_token = token_data.get("access_token")

                if not self._access_token:
                    raise AuthenticationError(
                        "No access_token in Checkmarx OAuth2 response"
                    )

                return ConnectorResult(success=True)

        except AuthenticationError:
            raise
        except Exception as e:
            raise AuthenticationError(
                f"Checkmarx authentication failed: {e}"
            )

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch SAST scan results from Checkmarx."""
        if not self._access_token:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED",
            )

        try:
            import httpx

            headers = {
                "Authorization": f"Bearer {self._access_token}",
                "Accept": "application/json",
            }

            project_id = kwargs.get(
                "project_id",
                self.config.extra_settings.get("project_id"),
            )

            async with httpx.AsyncClient(verify=False) as client:
                # Step 1: Get the most recent scan for the project
                scan_id = kwargs.get("scan_id")

                if not scan_id:
                    if not project_id:
                        return ConnectorResult(
                            success=False,
                            error_message="project_id or scan_id is required",
                            error_code="MISSING_CONFIG",
                        )

                    scans_response = await client.get(
                        f"{self._api_base}/cxrestapi/sast/scans",
                        params={
                            "projectId": project_id,
                            "last": 1,
                        },
                        headers=headers,
                        timeout=self.config.timeout_seconds,
                    )

                    if scans_response.status_code != 200:
                        return ConnectorResult(
                            success=False,
                            error_message=f"Failed to fetch scans: {scans_response.status_code}",
                            error_code="API_ERROR",
                        )

                    scans = scans_response.json()
                    if not scans:
                        return ConnectorResult(
                            success=True,
                            data=[],
                            items_processed=0,
                            metadata={"message": "No scans found for project"},
                        )

                    scan_id = scans[0].get("id")

                # Step 2: Get scan results (vulnerabilities)
                all_results = []
                offset = 0
                page_size = 100

                while True:
                    results_response = await client.get(
                        f"{self._api_base}/cxrestapi/sast/scans/{scan_id}/resultsStatistics",
                        headers=headers,
                        timeout=self.config.timeout_seconds,
                    )

                    # Also get detailed results via report
                    # Register a scan report
                    report_response = await client.post(
                        f"{self._api_base}/cxrestapi/reports/sastScan",
                        json={
                            "reportType": "XML",
                            "scanId": scan_id,
                        },
                        headers=headers,
                        timeout=self.config.timeout_seconds,
                    )

                    if report_response.status_code in (200, 202):
                        report_id = report_response.json().get("reportId")

                        # Poll for report completion
                        import asyncio

                        for _ in range(30):
                            status_response = await client.get(
                                f"{self._api_base}/cxrestapi/reports/sastScan/{report_id}/status",
                                headers=headers,
                                timeout=self.config.timeout_seconds,
                            )
                            if status_response.status_code == 200:
                                status = status_response.json().get("status", {})
                                if status.get("value") == "Created":
                                    break
                            await asyncio.sleep(2)

                        # Download the report
                        report_content_response = await client.get(
                            f"{self._api_base}/cxrestapi/reports/sastScan/{report_id}",
                            headers=headers,
                            timeout=self.config.timeout_seconds * 2,
                        )

                        if report_content_response.status_code == 200:
                            all_results = self._parse_xml_report(
                                report_content_response.text
                            )

                    break

                return ConnectorResult(
                    success=True,
                    data=all_results,
                    items_processed=len(all_results),
                    metadata={
                        "scan_id": scan_id,
                        "project_id": project_id,
                        "total_results": len(all_results),
                    },
                )

        except Exception as e:
            logger.error(f"Checkmarx fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    def _parse_xml_report(self, xml_content: str) -> List[dict]:
        """Parse Checkmarx XML scan report into a list of findings."""
        import xml.etree.ElementTree as ET

        findings = []

        try:
            root = ET.fromstring(xml_content)

            project_name = root.attrib.get("ProjectName", "")
            scan_id = root.attrib.get("ScanId", "")

            for query in root.findall(".//Query"):
                query_name = query.attrib.get("name", "")
                cwe_id = query.attrib.get("cweId")
                language = query.attrib.get("Language", "")
                categories = query.attrib.get("categories", "")
                severity = query.attrib.get("Severity", "")

                for result in query.findall("Result"):
                    # Extract source and destination nodes from the path
                    path_nodes = result.findall(".//PathNode")
                    source_node = path_nodes[0] if path_nodes else None
                    dest_node = path_nodes[-1] if len(path_nodes) > 1 else None

                    finding_dict = {
                        "id": result.attrib.get("NodeId", ""),
                        "query_name": query_name,
                        "severity": severity,
                        "status": result.attrib.get("Status", ""),
                        "state": result.attrib.get("state", "0"),
                        "cwe_id": int(cwe_id) if cwe_id else None,
                        "language": language,
                        "categories": [
                            c.strip()
                            for c in categories.split(";")
                            if c.strip()
                        ],
                        "project_name": project_name,
                        "scan_id": scan_id,
                        "deep_link": result.attrib.get("DeepLink", ""),
                        "false_positive": result.attrib.get("FalsePositive", "False") == "True",
                    }

                    if source_node is not None:
                        finding_dict["source_file"] = source_node.findtext(
                            "FileName", ""
                        )
                        finding_dict["source_line"] = source_node.findtext(
                            "Line", ""
                        )
                        finding_dict["source_method"] = source_node.findtext(
                            "Name", ""
                        )

                    if dest_node is not None:
                        finding_dict["dest_file"] = dest_node.findtext(
                            "FileName", ""
                        )
                        finding_dict["dest_line"] = dest_node.findtext(
                            "Line", ""
                        )
                        finding_dict["dest_method"] = dest_node.findtext(
                            "Name", ""
                        )

                    findings.append(finding_dict)

        except ET.ParseError as e:
            logger.error(f"Failed to parse Checkmarx XML report: {e}")

        return findings

    async def transform_data(
        self, raw_data: Any
    ) -> List[CheckmarxFinding]:
        """Transform Checkmarx scan results to CheckmarxFinding objects."""
        findings = []

        severity_map = {
            "High": "high",
            "Medium": "medium",
            "Low": "low",
            "Information": "info",
        }

        state_map = {
            "0": "to_verify",
            "1": "not_exploitable",
            "2": "confirmed",
            "3": "urgent",
            "4": "proposed_not_exploitable",
        }

        for f in raw_data:
            severity_raw = f.get("severity", "Information")
            severity = severity_map.get(severity_raw, "info")

            state_raw = f.get("state", "0")
            state = state_map.get(str(state_raw), "to_verify")

            source_line = f.get("source_line")
            if source_line:
                try:
                    source_line = int(source_line)
                except (ValueError, TypeError):
                    source_line = None

            dest_line = f.get("dest_line")
            if dest_line:
                try:
                    dest_line = int(dest_line)
                except (ValueError, TypeError):
                    dest_line = None

            finding = CheckmarxFinding(
                id=str(f.get("id", "")),
                query_name=f.get("query_name", ""),
                severity=severity,
                status=f.get("status", ""),
                state=state,
                cwe_id=f.get("cwe_id"),
                language=f.get("language"),
                source_file=f.get("source_file"),
                source_line=source_line,
                source_method=f.get("source_method"),
                dest_file=f.get("dest_file"),
                dest_line=dest_line,
                dest_method=f.get("dest_method"),
                categories=f.get("categories", []),
                project_name=f.get("project_name"),
                scan_id=f.get("scan_id"),
                result_deep_link=f.get("deep_link"),
                false_positive=f.get("false_positive", False),
            )
            findings.append(finding)

        return findings

    def get_config_schema(self) -> dict:
        """Return Checkmarx specific config schema."""
        base = super().get_config_schema()
        base["properties"].update(
            {
                "url": {
                    "type": "string",
                    "format": "uri",
                    "description": "Checkmarx Server URL",
                },
                "username": {
                    "type": "string",
                    "description": "Checkmarx Username",
                },
                "password": {
                    "type": "string",
                    "format": "password",
                    "description": "Checkmarx Password",
                },
                "project_id": {
                    "type": "string",
                    "description": "Checkmarx Project ID",
                },
            }
        )
        base["required"].extend(["url", "username", "password"])
        return base
