"""
Trivy Container Security Connector.

Trivy is an open-source vulnerability scanner for containers and other artifacts.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
import json
import logging
import asyncio
import httpx

from ..base.connector import (
    BaseConnector,
    ConnectorCategory,
    ConnectorConfig,
    ConnectorResult,
)
from ..base.registry import ConnectorRegistry

logger = logging.getLogger(__name__)


@dataclass
class TrivyVulnerability:
    """Represents a Trivy vulnerability finding."""
    id: str
    vulnerability_id: str
    pkg_name: str
    installed_version: str
    severity: str
    target: str
    target_type: str
    title: Optional[str] = None
    description: Optional[str] = None
    fixed_version: Optional[str] = None
    primary_url: Optional[str] = None
    cvss_score: Optional[float] = None
    cvss_vector: Optional[str] = None
    references: List[str] = field(default_factory=list)


@ConnectorRegistry.register
class TrivyConnector(BaseConnector[TrivyVulnerability]):
    """
    Connector for Trivy vulnerability scanner.

    Supports two modes:
    1. Server mode: Connect to a Trivy server API
    2. CLI mode: Parse Trivy JSON output files

    Capabilities:
    - Scan container images
    - Scan filesystem paths
    - Parse SBOM and vulnerability reports
    """

    connector_type = "trivy"
    display_name = "Trivy"
    description = "Open-source vulnerability scanner for containers and filesystems"
    category = ConnectorCategory.CONTAINER
    supported_auth_types = ["api_key", "none"]

    supports_sync = True
    supports_webhook = False
    supports_bidirectional = False

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)
        self._mode = config.extra_settings.get("mode", "file")  # server or file

    async def validate_config(self) -> ConnectorResult:
        """Validate Trivy configuration."""
        mode = self.config.extra_settings.get("mode", "file")

        if mode == "server":
            if not self.config.base_url:
                return ConnectorResult(
                    success=False,
                    error_message="Server URL required for server mode",
                    error_code="MISSING_CONFIG"
                )
        elif mode == "file":
            if not self.config.extra_settings.get("report_path"):
                return ConnectorResult(
                    success=False,
                    error_message="Report path required for file mode",
                    error_code="MISSING_CONFIG"
                )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test connection to Trivy server or file access."""
        mode = self.config.extra_settings.get("mode", "file")

        if mode == "server":
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{self.config.base_url}/healthz",
                        timeout=self.config.timeout_seconds
                    )
                    if response.status_code == 200:
                        return ConnectorResult(success=True)

                return ConnectorResult(
                    success=False,
                    error_message="Trivy server not responding",
                    error_code="CONNECTION_ERROR"
                )
            except Exception as e:
                return ConnectorResult(
                    success=False,
                    error_message=str(e),
                    error_code="CONNECTION_ERROR"
                )

        elif mode == "file":
            import os
            report_path = self.config.extra_settings.get("report_path")
            if os.path.exists(report_path):
                return ConnectorResult(success=True)
            return ConnectorResult(
                success=False,
                error_message=f"Report file not found: {report_path}",
                error_code="FILE_NOT_FOUND"
            )

        return ConnectorResult(success=True)

    async def authenticate(self) -> ConnectorResult:
        """Trivy doesn't require authentication in most cases."""
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Fetch vulnerability data from Trivy."""
        mode = self.config.extra_settings.get("mode", "file")

        try:
            if mode == "server":
                return await self._fetch_from_server(**kwargs)
            elif mode == "file":
                return await self._fetch_from_file(**kwargs)
            elif mode == "cli":
                return await self._run_trivy_scan(**kwargs)
            else:
                return ConnectorResult(
                    success=False,
                    error_message=f"Unknown mode: {mode}",
                    error_code="INVALID_MODE"
                )

        except Exception as e:
            logger.error(f"Trivy fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR"
            )

    async def _fetch_from_server(self, **kwargs) -> ConnectorResult:
        """Fetch from Trivy server API."""
        target = kwargs.get("target")
        if not target:
            return ConnectorResult(
                success=False,
                error_message="Target (image name) required",
                error_code="MISSING_TARGET"
            )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.config.base_url}/scan",
                json={
                    "image": target,
                    "format": "json",
                    "severity": kwargs.get("severity", "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL")
                },
                timeout=self.config.timeout_seconds * 3  # Scans take longer
            )

            if response.status_code != 200:
                return ConnectorResult(
                    success=False,
                    error_message=f"Scan failed: {response.status_code}",
                    error_code="SCAN_ERROR"
                )

            data = response.json()
            return ConnectorResult(
                success=True,
                data=data,
                metadata={"target": target}
            )

    async def _fetch_from_file(self, **kwargs) -> ConnectorResult:
        """Parse Trivy JSON report from file."""
        report_path = kwargs.get("report_path") or self.config.extra_settings.get("report_path")

        try:
            with open(report_path, 'r') as f:
                data = json.load(f)

            return ConnectorResult(
                success=True,
                data=data,
                metadata={"source_file": report_path}
            )

        except FileNotFoundError:
            return ConnectorResult(
                success=False,
                error_message=f"Report file not found: {report_path}",
                error_code="FILE_NOT_FOUND"
            )
        except json.JSONDecodeError as e:
            return ConnectorResult(
                success=False,
                error_message=f"Invalid JSON: {e}",
                error_code="PARSE_ERROR"
            )

    async def _run_trivy_scan(self, **kwargs) -> ConnectorResult:
        """Run Trivy CLI scan (requires trivy installed)."""
        target = kwargs.get("target")
        if not target:
            return ConnectorResult(
                success=False,
                error_message="Target required for CLI scan",
                error_code="MISSING_TARGET"
            )

        scan_type = kwargs.get("scan_type", "image")  # image, fs, repo
        severity = kwargs.get("severity", "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL")

        cmd = [
            "trivy", scan_type, target,
            "--format", "json",
            "--severity", severity,
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                return ConnectorResult(
                    success=False,
                    error_message=f"Trivy scan failed: {stderr.decode()}",
                    error_code="SCAN_ERROR"
                )

            data = json.loads(stdout.decode())
            return ConnectorResult(
                success=True,
                data=data,
                metadata={"target": target, "scan_type": scan_type}
            )

        except FileNotFoundError:
            return ConnectorResult(
                success=False,
                error_message="Trivy CLI not found. Please install trivy.",
                error_code="CLI_NOT_FOUND"
            )

    async def transform_data(self, raw_data: Any) -> List[TrivyVulnerability]:
        """Transform Trivy report to TrivyVulnerability objects."""
        vulns = []

        # Handle both single result and multi-result formats
        results = raw_data.get("Results", [])
        if not results and "Target" in raw_data:
            results = [raw_data]

        for result in results:
            target = result.get("Target", "unknown")
            target_type = result.get("Type", "unknown")
            vulnerabilities = result.get("Vulnerabilities", []) or []

            for vuln in vulnerabilities:
                trivy_vuln = TrivyVulnerability(
                    id=f"{target}:{vuln.get('VulnerabilityID', '')}",
                    vulnerability_id=vuln.get("VulnerabilityID", ""),
                    pkg_name=vuln.get("PkgName", ""),
                    installed_version=vuln.get("InstalledVersion", ""),
                    severity=vuln.get("Severity", "UNKNOWN"),
                    target=target,
                    target_type=target_type,
                    title=vuln.get("Title"),
                    description=vuln.get("Description"),
                    fixed_version=vuln.get("FixedVersion"),
                    primary_url=vuln.get("PrimaryURL"),
                    cvss_score=self._extract_cvss_score(vuln),
                    cvss_vector=self._extract_cvss_vector(vuln),
                    references=vuln.get("References", [])
                )
                vulns.append(trivy_vuln)

        return vulns

    def _extract_cvss_score(self, vuln: dict) -> Optional[float]:
        """Extract CVSS score from vulnerability data."""
        cvss = vuln.get("CVSS", {})
        if cvss:
            # Try NVD first, then vendor
            for source in ["nvd", "redhat", "ghsa"]:
                if source in cvss:
                    return cvss[source].get("V3Score") or cvss[source].get("V2Score")
        return None

    def _extract_cvss_vector(self, vuln: dict) -> Optional[str]:
        """Extract CVSS vector from vulnerability data."""
        cvss = vuln.get("CVSS", {})
        if cvss:
            for source in ["nvd", "redhat", "ghsa"]:
                if source in cvss:
                    return cvss[source].get("V3Vector") or cvss[source].get("V2Vector")
        return None

    def get_config_schema(self) -> dict:
        """Return Trivy-specific config schema."""
        base = super().get_config_schema()
        base["properties"].update({
            "mode": {
                "type": "string",
                "enum": ["server", "file", "cli"],
                "default": "file",
                "description": "Operating mode: server (API), file (parse report), or cli (run trivy)"
            },
            "server_url": {
                "type": "string",
                "format": "uri",
                "description": "Trivy server URL (for server mode)"
            },
            "report_path": {
                "type": "string",
                "description": "Path to Trivy JSON report (for file mode)"
            }
        })
        return base
