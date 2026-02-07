"""
Grype Container Vulnerability Scanner Connector.

Imports vulnerability findings from Grype JSON output files. Grype is an
open-source vulnerability scanner for container images and filesystems
maintained by Anchore.
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
)
from ..base.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


@dataclass
class GrypeVulnerability:
    """Represents a Grype vulnerability finding."""

    id: str
    vulnerability_id: str
    severity: str
    package_name: str
    package_version: str
    package_type: str
    description: Optional[str] = None
    data_source: Optional[str] = None
    fixed_versions: List[str] = field(default_factory=list)
    related_cves: List[str] = field(default_factory=list)
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    source_url: Optional[str] = None
    target: Optional[str] = None
    target_type: Optional[str] = None
    package_language: Optional[str] = None
    package_path: Optional[str] = None
    match_type: Optional[str] = None


@ConnectorRegistry.register
class GrypeConnector(BaseConnector[GrypeVulnerability]):
    """
    Connector for Grype vulnerability scanner.

    Reads and parses Grype JSON output files to extract container and
    filesystem vulnerability findings. Supports both file-based input
    and direct JSON content input.
    """

    connector_type = "grype"
    display_name = "Grype"
    description = "Container vulnerability scanner by Anchore (JSON report parser)"
    category = ConnectorCategory.CONTAINER
    supported_auth_types = ["none"]

    supports_sync = True
    supports_webhook = False
    supports_bidirectional = False

    config_schema = {
        "required": [],
        "properties": {
            "report_path": {
                "type": "string",
                "description": "Path to Grype JSON report file",
            },
            "report_content": {
                "type": "string",
                "description": "Grype JSON report content (alternative to report_path)",
            },
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)

    async def validate_config(self) -> ConnectorResult:
        """Validate that a report source is configured."""
        report_path = self.config.extra_settings.get("report_path")
        report_content = self.config.extra_settings.get("report_content")

        if not report_path and not report_content:
            return ConnectorResult(
                success=False,
                error_message="Either report_path or report_content is required",
                error_code="MISSING_CONFIG",
            )

        # Validate JSON content if provided directly
        if report_content:
            try:
                if isinstance(report_content, str):
                    json.loads(report_content)
            except json.JSONDecodeError:
                return ConnectorResult(
                    success=False,
                    error_message="report_content is not valid JSON",
                    error_code="INVALID_CONFIG",
                )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test access to the Grype report file or validate content."""
        report_path = self.config.extra_settings.get("report_path")
        report_content = self.config.extra_settings.get("report_content")

        if report_content:
            try:
                data = json.loads(report_content) if isinstance(
                    report_content, str
                ) else report_content
                # Verify it looks like a Grype report
                if "matches" in data or "vulnerabilities" in data:
                    return ConnectorResult(success=True)
                return ConnectorResult(
                    success=False,
                    error_message="JSON does not appear to be a Grype report (missing 'matches' key)",
                    error_code="INVALID_FORMAT",
                )
            except json.JSONDecodeError as e:
                return ConnectorResult(
                    success=False,
                    error_message=f"Invalid JSON content: {e}",
                    error_code="PARSE_ERROR",
                )

        if report_path:
            import os

            if os.path.exists(report_path):
                return ConnectorResult(success=True)
            return ConnectorResult(
                success=False,
                error_message=f"Report file not found: {report_path}",
                error_code="FILE_NOT_FOUND",
            )

        return ConnectorResult(
            success=False,
            error_message="No report source configured",
            error_code="MISSING_CONFIG",
        )

    async def authenticate(self) -> ConnectorResult:
        """Grype file-based connector does not require authentication."""
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Read and parse Grype JSON report."""
        report_path = kwargs.get(
            "report_path",
            self.config.extra_settings.get("report_path"),
        )
        report_content = kwargs.get(
            "report_content",
            self.config.extra_settings.get("report_content"),
        )

        try:
            if report_content:
                if isinstance(report_content, str):
                    data = json.loads(report_content)
                else:
                    data = report_content
            elif report_path:
                with open(report_path, "r") as f:
                    data = json.load(f)
            else:
                return ConnectorResult(
                    success=False,
                    error_message="No report source provided",
                    error_code="MISSING_CONFIG",
                )

            # Extract metadata from the report
            descriptor = data.get("descriptor", {})
            source = data.get("source", {})
            matches = data.get("matches", [])

            return ConnectorResult(
                success=True,
                data=data,
                items_processed=len(matches),
                metadata={
                    "grype_version": descriptor.get("version", "unknown"),
                    "source_type": source.get("type", "unknown"),
                    "source_target": source.get("target", {}).get(
                        "userInput",
                        source.get("target", "unknown"),
                    )
                    if isinstance(source.get("target"), dict)
                    else source.get("target", "unknown"),
                    "total_matches": len(matches),
                },
            )

        except FileNotFoundError:
            return ConnectorResult(
                success=False,
                error_message=f"Report file not found: {report_path}",
                error_code="FILE_NOT_FOUND",
            )
        except json.JSONDecodeError as e:
            return ConnectorResult(
                success=False,
                error_message=f"Invalid JSON: {e}",
                error_code="PARSE_ERROR",
            )
        except Exception as e:
            logger.error(f"Grype fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    async def transform_data(
        self, raw_data: Any
    ) -> List[GrypeVulnerability]:
        """Transform Grype JSON matches to GrypeVulnerability objects."""
        vulnerabilities = []

        matches = raw_data.get("matches", [])
        source = raw_data.get("source", {})
        source_target = source.get("target", {})

        # Determine target info
        if isinstance(source_target, dict):
            target_name = source_target.get(
                "userInput",
                source_target.get("imageID", "unknown"),
            )
        else:
            target_name = str(source_target)
        target_type = source.get("type", "unknown")

        severity_map = {
            "Critical": "critical",
            "High": "high",
            "Medium": "medium",
            "Low": "low",
            "Negligible": "info",
            "Unknown": "info",
        }

        for match in matches:
            vulnerability = match.get("vulnerability", {})
            artifact = match.get("artifact", {})

            vuln_id = vulnerability.get("id", "")
            severity_raw = vulnerability.get("severity", "Unknown")
            severity = severity_map.get(severity_raw, "info")

            # Extract CVSS data
            cvss_entries = vulnerability.get("cvss", [])
            cvss_score = None
            cvss_vector = None
            if cvss_entries:
                # Prefer the first entry (typically highest fidelity)
                first_cvss = cvss_entries[0]
                metrics = first_cvss.get("metrics", {})
                cvss_score = metrics.get("baseScore")
                cvss_vector = first_cvss.get("vector")

            # Extract fix versions
            fix = vulnerability.get("fix", {})
            fixed_versions = fix.get("versions", []) or []

            # Extract related vulnerabilities (additional CVEs)
            related_vulns = match.get("relatedVulnerabilities", [])
            related_cves = [
                rv.get("id", "")
                for rv in related_vulns
                if rv.get("id")
            ]

            # Extract package/artifact details
            locations = artifact.get("locations", [])
            package_path = locations[0].get("path", "") if locations else None

            vuln = GrypeVulnerability(
                id=f"{target_name}:{vuln_id}:{artifact.get('name', '')}",
                vulnerability_id=vuln_id,
                severity=severity,
                package_name=artifact.get("name", ""),
                package_version=artifact.get("version", ""),
                package_type=artifact.get("type", ""),
                description=vulnerability.get("description"),
                data_source=vulnerability.get("dataSource"),
                fixed_versions=fixed_versions,
                related_cves=related_cves,
                cvss_score=cvss_score,
                cvss_vector=cvss_vector,
                source_url=vulnerability.get("dataSource"),
                target=target_name,
                target_type=target_type,
                package_language=artifact.get("language"),
                package_path=package_path,
                match_type=match.get("matchDetails", [{}])[0].get("type")
                if match.get("matchDetails")
                else None,
            )
            vulnerabilities.append(vuln)

        return vulnerabilities

    def get_config_schema(self) -> dict:
        """Return Grype specific config schema."""
        base = super().get_config_schema()
        base["properties"].update(
            {
                "report_path": {
                    "type": "string",
                    "description": "Path to Grype JSON report file",
                },
                "report_content": {
                    "type": "string",
                    "description": "Grype JSON report content (alternative to file)",
                },
            }
        )
        return base
