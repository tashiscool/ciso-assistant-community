"""
SARIF (Static Analysis Results Interchange Format) Importer.

Imports findings from SARIF v2.1.0 JSON files, the OASIS standard
for the output of static analysis tools.
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
class SARIFFinding:
    """Represents a SARIF result finding."""

    id: str
    rule_id: str
    message: str
    severity: str
    level: str
    tool_name: str
    tool_version: Optional[str] = None
    file_path: Optional[str] = None
    start_line: Optional[int] = None
    start_column: Optional[int] = None
    end_line: Optional[int] = None
    end_column: Optional[int] = None
    snippet: Optional[str] = None
    rule_name: Optional[str] = None
    rule_description: Optional[str] = None
    rule_help_uri: Optional[str] = None
    precision: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    cwe_ids: List[str] = field(default_factory=list)
    fingerprint: Optional[str] = None
    kind: Optional[str] = None
    run_index: int = 0


@ConnectorRegistry.register
class SARIFImporterConnector(BaseConnector[SARIFFinding]):
    """
    Universal SARIF 2.1.0 format importer.

    Parses SARIF JSON files (the standard output format for static
    analysis tools) and maps results to normalized findings. Supports
    multi-run SARIF files and extracts rule metadata, code locations,
    and severity information.
    """

    connector_type = "sarif_importer"
    display_name = "SARIF Importer"
    description = "Import findings from SARIF v2.1.0 static analysis reports"
    category = ConnectorCategory.SAST_DAST
    supported_auth_types = ["none"]

    supports_sync = True
    supports_webhook = False
    supports_bidirectional = False

    config_schema = {
        "required": [],
        "properties": {
            "report_path": {
                "type": "string",
                "description": "Path to SARIF JSON file",
            },
            "report_content": {
                "type": "string",
                "description": "SARIF JSON content (alternative to report_path)",
            },
        },
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)

    async def validate_config(self) -> ConnectorResult:
        """Validate that a SARIF source is configured."""
        report_path = self.config.extra_settings.get("report_path")
        report_content = self.config.extra_settings.get("report_content")

        if not report_path and not report_content:
            return ConnectorResult(
                success=False,
                error_message="Either report_path or report_content is required",
                error_code="MISSING_CONFIG",
            )

        if report_content:
            try:
                data = json.loads(report_content) if isinstance(
                    report_content, str
                ) else report_content

                # Verify SARIF schema
                schema_uri = data.get("$schema", "")
                version = data.get("version", "")
                if "sarif" not in schema_uri.lower() and version != "2.1.0":
                    return ConnectorResult(
                        success=False,
                        error_message="Content does not appear to be a valid SARIF 2.1.0 document",
                        error_code="INVALID_FORMAT",
                    )

            except json.JSONDecodeError:
                return ConnectorResult(
                    success=False,
                    error_message="report_content is not valid JSON",
                    error_code="INVALID_CONFIG",
                )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test access to the SARIF report."""
        report_path = self.config.extra_settings.get("report_path")
        report_content = self.config.extra_settings.get("report_content")

        if report_content:
            try:
                data = json.loads(report_content) if isinstance(
                    report_content, str
                ) else report_content
                runs = data.get("runs", [])
                return ConnectorResult(
                    success=True,
                    metadata={
                        "runs": len(runs),
                        "version": data.get("version", "unknown"),
                    },
                )
            except (json.JSONDecodeError, TypeError) as e:
                return ConnectorResult(
                    success=False,
                    error_message=f"Invalid SARIF content: {e}",
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
            error_message="No SARIF source configured",
            error_code="MISSING_CONFIG",
        )

    async def authenticate(self) -> ConnectorResult:
        """File-based importer does not require authentication."""
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Read and parse the SARIF JSON report."""
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
                    error_message="No SARIF source provided",
                    error_code="MISSING_CONFIG",
                )

            # Basic SARIF validation
            version = data.get("version", "")
            if version and version != "2.1.0":
                logger.warning(
                    f"SARIF version {version} detected; this connector targets 2.1.0"
                )

            runs = data.get("runs", [])
            total_results = sum(
                len(run.get("results", [])) for run in runs
            )

            return ConnectorResult(
                success=True,
                data=data,
                items_processed=total_results,
                metadata={
                    "sarif_version": version,
                    "total_runs": len(runs),
                    "total_results": total_results,
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
            logger.error(f"SARIF fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    async def transform_data(
        self, raw_data: Any
    ) -> List[SARIFFinding]:
        """Transform SARIF runs/results into SARIFFinding objects."""
        findings = []

        level_severity_map = {
            "error": "high",
            "warning": "medium",
            "note": "low",
            "none": "info",
        }

        runs = raw_data.get("runs", [])

        for run_index, run in enumerate(runs):
            # Extract tool info
            tool = run.get("tool", {})
            driver = tool.get("driver", {})
            tool_name = driver.get("name", "unknown")
            tool_version = driver.get("version")

            # Build rule lookup from driver.rules
            rules_lookup = {}
            for rule in driver.get("rules", []):
                rule_id = rule.get("id", "")
                rules_lookup[rule_id] = rule

            # Also check extensions for additional rules
            for extension in tool.get("extensions", []):
                for rule in extension.get("rules", []):
                    rule_id = rule.get("id", "")
                    rules_lookup[rule_id] = rule

            # Process results
            results = run.get("results", [])

            for result_index, result in enumerate(results):
                rule_id = result.get("ruleId", "")
                rule_index = result.get("ruleIndex")

                # Resolve rule metadata
                rule_meta = rules_lookup.get(rule_id, {})
                if not rule_meta and rule_index is not None:
                    rules_list = driver.get("rules", [])
                    if 0 <= rule_index < len(rules_list):
                        rule_meta = rules_list[rule_index]

                # Extract level/severity
                level = result.get("level", "warning")
                severity = level_severity_map.get(level, "medium")

                # Override severity from rule properties if available
                rule_properties = rule_meta.get("properties", {})
                precision = rule_properties.get("precision")

                # Check for security-severity in properties
                security_severity = rule_properties.get("security-severity")
                if security_severity:
                    try:
                        score = float(security_severity)
                        if score >= 9.0:
                            severity = "critical"
                        elif score >= 7.0:
                            severity = "high"
                        elif score >= 4.0:
                            severity = "medium"
                        else:
                            severity = "low"
                    except (ValueError, TypeError):
                        pass

                # Extract message
                message_obj = result.get("message", {})
                message = message_obj.get("text", "")
                if not message:
                    message = message_obj.get("markdown", "")
                if not message and "id" in message_obj:
                    # Try to resolve from rule messageStrings
                    msg_strings = rule_meta.get("messageStrings", {})
                    msg_template = msg_strings.get(
                        message_obj["id"], {}
                    )
                    message = msg_template.get("text", message_obj["id"])

                # Extract primary location
                locations = result.get("locations", [])
                file_path = None
                start_line = None
                start_column = None
                end_line = None
                end_column = None
                snippet = None

                if locations:
                    primary_location = locations[0]
                    physical_location = primary_location.get(
                        "physicalLocation", {}
                    )
                    artifact_location = physical_location.get(
                        "artifactLocation", {}
                    )
                    file_path = artifact_location.get("uri")

                    region = physical_location.get("region", {})
                    start_line = region.get("startLine")
                    start_column = region.get("startColumn")
                    end_line = region.get("endLine")
                    end_column = region.get("endColumn")

                    snippet_obj = region.get("snippet", {})
                    snippet = snippet_obj.get("text")

                # Extract rule metadata
                rule_name = rule_meta.get("name")
                short_desc = rule_meta.get("shortDescription", {})
                full_desc = rule_meta.get("fullDescription", {})
                rule_description = (
                    full_desc.get("text")
                    or short_desc.get("text")
                )
                rule_help_uri = rule_meta.get("helpUri")

                # Extract tags and CWE IDs from rule properties
                tags = rule_properties.get("tags", [])
                cwe_ids = []
                for tag in tags:
                    if tag.startswith("external/cwe/cwe-"):
                        cwe_ids.append(tag.replace("external/cwe/", ""))
                    elif tag.startswith("CWE-"):
                        cwe_ids.append(tag)

                # Extract fingerprint
                fingerprints = result.get("fingerprints", {})
                fingerprint = (
                    fingerprints.get("primaryLocationLineHash")
                    or fingerprints.get("0")
                    or next(iter(fingerprints.values()), None)
                    if fingerprints
                    else None
                )

                finding_id = (
                    f"run{run_index}:{rule_id}:{file_path or ''}:"
                    f"{start_line or ''}:{result_index}"
                )

                finding = SARIFFinding(
                    id=finding_id,
                    rule_id=rule_id,
                    message=message,
                    severity=severity,
                    level=level,
                    tool_name=tool_name,
                    tool_version=tool_version,
                    file_path=file_path,
                    start_line=start_line,
                    start_column=start_column,
                    end_line=end_line,
                    end_column=end_column,
                    snippet=snippet,
                    rule_name=rule_name,
                    rule_description=rule_description,
                    rule_help_uri=rule_help_uri,
                    precision=precision,
                    tags=tags,
                    cwe_ids=cwe_ids,
                    fingerprint=fingerprint,
                    kind=result.get("kind"),
                    run_index=run_index,
                )
                findings.append(finding)

        return findings

    def get_config_schema(self) -> dict:
        """Return SARIF importer specific config schema."""
        base = super().get_config_schema()
        base["properties"].update(
            {
                "report_path": {
                    "type": "string",
                    "description": "Path to SARIF JSON report file",
                },
                "report_content": {
                    "type": "string",
                    "description": "SARIF JSON report content",
                },
            }
        )
        return base
