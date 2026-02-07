"""
Google Cloud Security Command Center (SCC) Connector.

Imports security findings from Google Cloud SCC, which provides centralized
visibility into security and data risks across Google Cloud resources.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import json
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
class GCPSCCFinding:
    """Represents a Google Cloud SCC finding."""

    id: str
    name: str
    category: str
    severity: str
    state: str
    resource_name: str
    resource_type: str
    project_id: str
    description: Optional[str] = None
    external_uri: Optional[str] = None
    source_display_name: Optional[str] = None
    event_time: Optional[str] = None
    create_time: Optional[str] = None
    parent_display_name: Optional[str] = None
    indicator_domains: List[str] = field(default_factory=list)
    indicator_ips: List[str] = field(default_factory=list)
    vulnerability_cve_id: Optional[str] = None
    vulnerability_cvss_score: Optional[float] = None
    compliance_standards: List[str] = field(default_factory=list)
    mute_state: Optional[str] = None


@ConnectorRegistry.register
class GCPSCCConnector(BaseConnector[GCPSCCFinding]):
    """
    Connector for Google Cloud Security Command Center.

    Fetches security findings from GCP SCC including threat detections,
    vulnerability findings, and misconfiguration alerts from Security
    Health Analytics, Event Threat Detection, and Container Threat Detection.
    """

    connector_type = "gcp_scc"
    display_name = "Google Cloud SCC"
    description = "Security findings from Google Cloud Security Command Center"
    category = ConnectorCategory.CLOUD_SECURITY
    supported_auth_types = ["service_account"]

    supports_sync = True
    supports_webhook = False
    supports_bidirectional = False

    config_schema = {
        "required": ["project_id", "credentials_json"],
        "properties": {
            "project_id": {
                "type": "string",
                "description": "GCP project ID or organization ID",
            },
            "credentials_json": {
                "type": "string",
                "format": "password",
                "description": "GCP service account credentials JSON",
            },
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._scc_client = None
        self._organization_id = None

    async def validate_config(self) -> ConnectorResult:
        """Validate GCP credentials and project ID are configured."""
        project_id = self.config.extra_settings.get("project_id")
        if not project_id:
            return ConnectorResult(
                success=False,
                error_message="GCP project_id is required",
                error_code="MISSING_CONFIG",
            )

        credentials_json = self.config.credentials.get("credentials_json")
        if not credentials_json:
            return ConnectorResult(
                success=False,
                error_message="GCP service account credentials_json is required",
                error_code="MISSING_CREDENTIALS",
            )

        # Validate JSON is parseable
        try:
            if isinstance(credentials_json, str):
                json.loads(credentials_json)
        except json.JSONDecodeError:
            return ConnectorResult(
                success=False,
                error_message="credentials_json is not valid JSON",
                error_code="INVALID_CREDENTIALS",
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to GCP SCC by listing sources."""
        try:
            auth_result = await self.authenticate()
            if not auth_result.success:
                return auth_result

            parent = self._get_parent()

            # List sources to verify access
            sources = list(self._scc_client.list_sources(request={"parent": parent}))
            return ConnectorResult(
                success=True,
                metadata={"sources_count": len(sources)},
            )
        except Exception as e:
            return ConnectorResult(
                success=False,
                error_message=f"Failed to connect to GCP SCC: {e}",
                error_code="CONNECTION_ERROR",
            )

    async def authenticate(self) -> ConnectorResult:
        """Authenticate with GCP using service account credentials."""
        try:
            from google.cloud import securitycenter
            from google.oauth2 import service_account
        except ImportError:
            raise AuthenticationError(
                "google-cloud-securitycenter is required for the GCP SCC connector. "
                "Install it with: pip install google-cloud-securitycenter"
            )

        try:
            credentials_json = self.config.credentials.get("credentials_json")
            if isinstance(credentials_json, str):
                credentials_info = json.loads(credentials_json)
            else:
                credentials_info = credentials_json

            credentials = service_account.Credentials.from_service_account_info(
                credentials_info,
                scopes=["https://www.googleapis.com/auth/cloud-platform"],
            )

            self._scc_client = securitycenter.SecurityCenterClient(
                credentials=credentials
            )

            return ConnectorResult(success=True)
        except Exception as e:
            raise AuthenticationError(f"GCP authentication failed: {e}")

    def _get_parent(self) -> str:
        """Build the SCC parent resource name."""
        project_id = self.config.extra_settings.get("project_id", "")

        # If it looks like an org ID (numeric), use organizations/
        if project_id.isdigit():
            return f"organizations/{project_id}"
        # If it already has a prefix, use as-is
        if "/" in project_id:
            return project_id
        # Default to projects/
        return f"projects/{project_id}"

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch findings from GCP Security Command Center."""
        if not self._scc_client:
            return ConnectorResult(
                success=False,
                error_message="Not authenticated",
                error_code="NOT_AUTHENTICATED",
            )

        all_findings = []

        try:
            parent = self._get_parent()

            # Build filter string
            filter_parts = []

            # Default: only active findings
            state_filter = kwargs.get("state", "ACTIVE")
            if state_filter:
                filter_parts.append(f'state="{state_filter}"')

            # Optional severity filter
            severity_filter = kwargs.get("severity")
            if severity_filter:
                filter_parts.append(f'severity="{severity_filter}"')

            # Optional category filter
            category_filter = kwargs.get("category")
            if category_filter:
                filter_parts.append(f'category="{category_filter}"')

            filter_string = " AND ".join(filter_parts) if filter_parts else ""

            # List findings with pagination (handled by the client library)
            request = {
                "parent": f"{parent}/sources/-",
                "filter": filter_string,
                "order_by": "severity DESC",
            }

            finding_results = self._scc_client.list_findings(request=request)

            for finding_result in finding_results:
                finding = finding_result.finding
                # Convert protobuf to dict for easier processing
                finding_dict = {
                    "name": finding.name,
                    "canonical_name": getattr(finding, "canonical_name", ""),
                    "category": finding.category,
                    "severity": finding.severity.name
                    if hasattr(finding.severity, "name")
                    else str(finding.severity),
                    "state": finding.state.name
                    if hasattr(finding.state, "name")
                    else str(finding.state),
                    "resource_name": finding.resource_name,
                    "external_uri": finding.external_uri,
                    "event_time": finding.event_time.isoformat()
                    if finding.event_time
                    else None,
                    "create_time": finding.create_time.isoformat()
                    if finding.create_time
                    else None,
                    "source_properties": dict(finding.source_properties)
                    if finding.source_properties
                    else {},
                    "indicator": {
                        "domains": list(
                            getattr(finding.indicator, "domains", [])
                        ),
                        "ip_addresses": list(
                            getattr(finding.indicator, "ip_addresses", [])
                        ),
                    }
                    if hasattr(finding, "indicator")
                    else {},
                    "vulnerability": {},
                    "mute": getattr(finding, "mute", None),
                }

                # Extract vulnerability details if present
                if hasattr(finding, "vulnerability") and finding.vulnerability:
                    vuln = finding.vulnerability
                    if hasattr(vuln, "cve") and vuln.cve:
                        finding_dict["vulnerability"] = {
                            "cve_id": getattr(vuln.cve, "id", None),
                            "cvss_score": getattr(
                                getattr(vuln.cve, "cvssv3", None),
                                "base_score",
                                None,
                            ),
                        }

                # Extract compliance details if present
                compliances = []
                if hasattr(finding, "compliances"):
                    for comp in finding.compliances:
                        standard = getattr(comp, "standard", "")
                        version = getattr(comp, "version", "")
                        compliances.append(f"{standard} {version}".strip())
                finding_dict["compliances"] = compliances

                all_findings.append(finding_dict)

            return ConnectorResult(
                success=True,
                data=all_findings,
                items_processed=len(all_findings),
                metadata={
                    "total_findings": len(all_findings),
                    "parent": parent,
                    "filter": filter_string,
                },
            )

        except Exception as e:
            logger.error(f"GCP SCC fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    async def transform_data(
        self, raw_data: Any
    ) -> List[GCPSCCFinding]:
        """Transform GCP SCC findings to GCPSCCFinding objects."""
        findings = []

        severity_map = {
            "CRITICAL": "critical",
            "HIGH": "high",
            "MEDIUM": "medium",
            "LOW": "low",
            "UNSPECIFIED": "info",
        }

        for f in raw_data:
            # Extract project ID from resource name
            resource_name = f.get("resource_name", "")
            project_id = self._extract_project_id(resource_name)
            resource_type = self._extract_resource_type(resource_name)

            severity_raw = f.get("severity", "UNSPECIFIED")
            severity = severity_map.get(severity_raw, "info")

            # Extract vulnerability details
            vuln = f.get("vulnerability", {})

            # Build description from source properties
            source_props = f.get("source_properties", {})
            description = source_props.get(
                "Explanation",
                source_props.get(
                    "description",
                    f.get("category", ""),
                ),
            )

            indicator = f.get("indicator", {})

            mute_state = f.get("mute")
            if hasattr(mute_state, "name"):
                mute_state = mute_state.name

            finding = GCPSCCFinding(
                id=f.get("name", ""),
                name=f.get("canonical_name", f.get("name", "")),
                category=f.get("category", ""),
                severity=severity,
                state=f.get("state", ""),
                resource_name=resource_name,
                resource_type=resource_type,
                project_id=project_id,
                description=str(description) if description else None,
                external_uri=f.get("external_uri"),
                event_time=f.get("event_time"),
                create_time=f.get("create_time"),
                indicator_domains=indicator.get("domains", []),
                indicator_ips=indicator.get("ip_addresses", []),
                vulnerability_cve_id=vuln.get("cve_id"),
                vulnerability_cvss_score=vuln.get("cvss_score"),
                compliance_standards=f.get("compliances", []),
                mute_state=str(mute_state) if mute_state else None,
            )
            findings.append(finding)

        return findings

    @staticmethod
    def _extract_project_id(resource_name: str) -> str:
        """Extract project ID from a GCP resource name."""
        # Format: //service.googleapis.com/projects/PROJECT_ID/...
        parts = resource_name.split("/")
        try:
            project_idx = parts.index("projects")
            return parts[project_idx + 1]
        except (ValueError, IndexError):
            return ""

    @staticmethod
    def _extract_resource_type(resource_name: str) -> str:
        """Extract resource type from a GCP resource name."""
        # Take the service name and last resource type
        parts = resource_name.split("/")
        if len(parts) >= 2:
            # Try to extract the resource kind (e.g., "instances", "buckets")
            for i in range(len(parts) - 2, -1, -2):
                if parts[i] and not parts[i].startswith("projects"):
                    return parts[i]
        return "unknown"

    def get_config_schema(self) -> dict:
        """Return GCP SCC specific config schema."""
        base = super().get_config_schema()
        base["properties"].update(
            {
                "project_id": {
                    "type": "string",
                    "description": "GCP Project ID or Organization ID",
                },
                "credentials_json": {
                    "type": "string",
                    "format": "password",
                    "description": "GCP Service Account credentials JSON",
                },
            }
        )
        base["required"].extend(["project_id", "credentials_json"])
        return base
