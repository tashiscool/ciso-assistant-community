"""
SCAP XCCDF Result Importer.

Imports compliance findings from SCAP (Security Content Automation Protocol)
XCCDF (Extensible Configuration Checklist Description Format) benchmark
result XML files.
"""

from dataclasses import dataclass, field
from typing import Any, List, Optional
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
class SCAPFinding:
    """Represents an SCAP XCCDF compliance finding."""

    id: str
    rule_id: str
    result: str
    severity: str
    title: Optional[str] = None
    description: Optional[str] = None
    benchmark_id: Optional[str] = None
    benchmark_version: Optional[str] = None
    profile_id: Optional[str] = None
    target_host: Optional[str] = None
    target_address: Optional[str] = None
    ident_system: Optional[str] = None
    ident_value: Optional[str] = None
    cce_id: Optional[str] = None
    cve_ids: List[str] = field(default_factory=list)
    fix_text: Optional[str] = None
    check_content_ref: Optional[str] = None
    test_time: Optional[str] = None
    weight: Optional[float] = None


@ConnectorRegistry.register
class SCAPImporterConnector(BaseConnector[SCAPFinding]):
    """
    SCAP XCCDF result file importer.

    Parses XCCDF benchmark result XML files produced by SCAP scanning
    tools (OpenSCAP, SCAP Workbench, etc.) and maps rule-result pairs
    to compliance findings with severity and remediation information.
    """

    connector_type = "scap_importer"
    display_name = "SCAP/XCCDF Importer"
    description = "Import compliance results from SCAP XCCDF benchmark reports"
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
                "description": "Path to XCCDF result XML file",
            },
            "report_content": {
                "type": "string",
                "description": "XCCDF result XML content (alternative to report_path)",
            },
        },
    }

    # XCCDF namespaces used in the XML
    XCCDF_NAMESPACES = {
        "xccdf12": "http://checklists.nist.gov/xccdf/1.2",
        "xccdf11": "http://checklists.nist.gov/xccdf/1.1",
    }

    def __init__(self, config: ConnectorConfig):
        super().__init__(config)

    async def validate_config(self) -> ConnectorResult:
        """Validate that an XCCDF source is configured."""
        report_path = self.config.extra_settings.get("report_path")
        report_content = self.config.extra_settings.get("report_content")

        if not report_path and not report_content:
            return ConnectorResult(
                success=False,
                error_message="Either report_path or report_content is required",
                error_code="MISSING_CONFIG",
            )

        return ConnectorResult(success=True)

    async def test_connection(self) -> ConnectorResult:
        """Test access to the XCCDF report."""
        report_path = self.config.extra_settings.get("report_path")
        report_content = self.config.extra_settings.get("report_content")

        if report_content:
            try:
                import xml.etree.ElementTree as ET

                ET.fromstring(report_content)
                return ConnectorResult(success=True)
            except ET.ParseError as e:
                return ConnectorResult(
                    success=False,
                    error_message=f"Invalid XML content: {e}",
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
            error_message="No XCCDF source configured",
            error_code="MISSING_CONFIG",
        )

    async def authenticate(self) -> ConnectorResult:
        """File-based importer does not require authentication."""
        return ConnectorResult(success=True)

    async def fetch_data(self, **kwargs) -> ConnectorResult:
        """Read and parse the XCCDF XML report."""
        import xml.etree.ElementTree as ET

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
                root = ET.fromstring(report_content)
            elif report_path:
                tree = ET.parse(report_path)
                root = tree.getroot()
            else:
                return ConnectorResult(
                    success=False,
                    error_message="No XCCDF source provided",
                    error_code="MISSING_CONFIG",
                )

            # Detect XCCDF namespace version
            root_tag = root.tag
            ns = ""
            if "}" in root_tag:
                ns = root_tag.split("}")[0] + "}"

            # Extract data as a structured dict for transform_data
            parsed_data = self._parse_xccdf(root, ns)

            total_results = len(parsed_data.get("rule_results", []))

            return ConnectorResult(
                success=True,
                data=parsed_data,
                items_processed=total_results,
                metadata={
                    "benchmark_id": parsed_data.get("benchmark_id", ""),
                    "benchmark_version": parsed_data.get(
                        "benchmark_version", ""
                    ),
                    "profile_id": parsed_data.get("profile_id", ""),
                    "target": parsed_data.get("target", ""),
                    "total_rule_results": total_results,
                    "namespace": ns,
                },
            )

        except FileNotFoundError:
            return ConnectorResult(
                success=False,
                error_message=f"Report file not found: {report_path}",
                error_code="FILE_NOT_FOUND",
            )
        except ET.ParseError as e:
            return ConnectorResult(
                success=False,
                error_message=f"Invalid XML: {e}",
                error_code="PARSE_ERROR",
            )
        except Exception as e:
            logger.error(f"SCAP fetch error: {e}")
            return ConnectorResult(
                success=False,
                error_message=str(e),
                error_code="FETCH_ERROR",
            )

    def _parse_xccdf(self, root, ns: str) -> dict:
        """Parse XCCDF result XML into a structured dictionary."""
        data = {
            "benchmark_id": "",
            "benchmark_version": "",
            "profile_id": "",
            "target": "",
            "target_address": "",
            "test_time": "",
            "rules": {},
            "rule_results": [],
        }

        # The root could be a Benchmark or TestResult element
        # Handle both cases

        # Find TestResult element
        test_result = root.find(f".//{ns}TestResult")
        if test_result is None:
            # The root itself might be a TestResult
            if root.tag.endswith("TestResult"):
                test_result = root
            else:
                # Try without namespace
                test_result = root.find(".//TestResult")

        # Extract benchmark info from root
        if root.tag.endswith("Benchmark"):
            data["benchmark_id"] = root.attrib.get("id", "")
            version_elem = root.find(f"{ns}version")
            if version_elem is None:
                version_elem = root.find("version")
            if version_elem is not None:
                data["benchmark_version"] = version_elem.text or ""

            # Build rule lookup from benchmark
            self._build_rule_lookup(root, ns, data["rules"])

        if test_result is not None:
            # Extract target info
            target_elem = test_result.find(f"{ns}target")
            if target_elem is None:
                target_elem = test_result.find("target")
            if target_elem is not None:
                data["target"] = target_elem.text or ""

            target_addr_elem = test_result.find(f"{ns}target-address")
            if target_addr_elem is None:
                target_addr_elem = test_result.find("target-address")
            if target_addr_elem is not None:
                data["target_address"] = target_addr_elem.text or ""

            # Extract profile
            profile_elem = test_result.find(f"{ns}profile")
            if profile_elem is None:
                profile_elem = test_result.find("profile")
            if profile_elem is not None:
                data["profile_id"] = profile_elem.attrib.get("idref", "")

            data["test_time"] = test_result.attrib.get("end-time", "")

            # Extract rule-results
            rule_results = test_result.findall(f"{ns}rule-result")
            if not rule_results:
                rule_results = test_result.findall("rule-result")

            for rr in rule_results:
                rule_id = rr.attrib.get("idref", "")
                severity = rr.attrib.get("severity", "unknown")
                weight = rr.attrib.get("weight")

                # Get result value
                result_elem = rr.find(f"{ns}result")
                if result_elem is None:
                    result_elem = rr.find("result")
                result_value = (
                    result_elem.text if result_elem is not None else "unknown"
                )

                # Get idents (CCE, CVE references)
                idents = []
                for ident in rr.findall(f"{ns}ident"):
                    idents.append(
                        {
                            "system": ident.attrib.get("system", ""),
                            "value": ident.text or "",
                        }
                    )
                if not idents:
                    for ident in rr.findall("ident"):
                        idents.append(
                            {
                                "system": ident.attrib.get("system", ""),
                                "value": ident.text or "",
                            }
                        )

                # Get check reference
                check_elem = rr.find(f"{ns}check")
                if check_elem is None:
                    check_elem = rr.find("check")
                check_content_ref = None
                if check_elem is not None:
                    ref_elem = check_elem.find(f"{ns}check-content-ref")
                    if ref_elem is None:
                        ref_elem = check_elem.find("check-content-ref")
                    if ref_elem is not None:
                        check_content_ref = ref_elem.attrib.get("href", "")

                rule_result_dict = {
                    "rule_id": rule_id,
                    "result": result_value,
                    "severity": severity,
                    "weight": float(weight) if weight else None,
                    "idents": idents,
                    "check_content_ref": check_content_ref,
                    "time": rr.attrib.get("time", ""),
                }

                data["rule_results"].append(rule_result_dict)

        return data

    def _build_rule_lookup(self, root, ns: str, rules: dict) -> None:
        """Build a lookup of rule definitions from the benchmark."""
        # Find all Rule elements
        for rule in root.iter(f"{ns}Rule"):
            rule_id = rule.attrib.get("id", "")
            if not rule_id:
                continue

            title_elem = rule.find(f"{ns}title")
            desc_elem = rule.find(f"{ns}description")
            fixtext_elem = rule.find(f"{ns}fixtext")

            rules[rule_id] = {
                "title": title_elem.text if title_elem is not None else "",
                "description": desc_elem.text
                if desc_elem is not None
                else "",
                "fixtext": fixtext_elem.text
                if fixtext_elem is not None
                else "",
            }

        # Also try without namespace
        if not rules:
            for rule in root.iter("Rule"):
                rule_id = rule.attrib.get("id", "")
                if not rule_id:
                    continue

                title_elem = rule.find("title")
                desc_elem = rule.find("description")
                fixtext_elem = rule.find("fixtext")

                rules[rule_id] = {
                    "title": title_elem.text
                    if title_elem is not None
                    else "",
                    "description": desc_elem.text
                    if desc_elem is not None
                    else "",
                    "fixtext": fixtext_elem.text
                    if fixtext_elem is not None
                    else "",
                }

    async def transform_data(
        self, raw_data: Any
    ) -> List[SCAPFinding]:
        """Transform XCCDF rule-results into SCAPFinding objects."""
        findings = []

        severity_map = {
            "high": "high",
            "medium": "medium",
            "low": "low",
            "info": "info",
            "unknown": "info",
        }

        # Result-based severity override: failing rules get elevated
        result_severity_modifier = {
            "fail": 1,  # elevate severity
            "error": 1,
            "pass": 0,
            "notapplicable": 0,
            "notchecked": 0,
            "notselected": 0,
            "informational": 0,
            "fixed": 0,
        }

        rules_lookup = raw_data.get("rules", {})
        benchmark_id = raw_data.get("benchmark_id", "")
        benchmark_version = raw_data.get("benchmark_version", "")
        profile_id = raw_data.get("profile_id", "")
        target = raw_data.get("target", "")
        target_address = raw_data.get("target_address", "")
        test_time = raw_data.get("test_time", "")

        for rr in raw_data.get("rule_results", []):
            rule_id = rr.get("rule_id", "")
            result_value = rr.get("result", "unknown")
            severity_raw = rr.get("severity", "unknown")
            severity = severity_map.get(severity_raw.lower(), "info")

            # Enrich with rule metadata from benchmark
            rule_meta = rules_lookup.get(rule_id, {})

            # Extract CCE and CVE identifiers
            cce_id = None
            cve_ids = []
            for ident in rr.get("idents", []):
                system = ident.get("system", "")
                value = ident.get("value", "")
                if "cce" in system.lower():
                    cce_id = value
                elif "cve" in system.lower():
                    cve_ids.append(value)

            finding = SCAPFinding(
                id=f"{benchmark_id}:{rule_id}:{target}",
                rule_id=rule_id,
                result=result_value,
                severity=severity,
                title=rule_meta.get("title"),
                description=rule_meta.get("description"),
                benchmark_id=benchmark_id,
                benchmark_version=benchmark_version,
                profile_id=profile_id,
                target_host=target,
                target_address=target_address,
                ident_system=rr.get("idents", [{}])[0].get("system")
                if rr.get("idents")
                else None,
                ident_value=rr.get("idents", [{}])[0].get("value")
                if rr.get("idents")
                else None,
                cce_id=cce_id,
                cve_ids=cve_ids,
                fix_text=rule_meta.get("fixtext"),
                check_content_ref=rr.get("check_content_ref"),
                test_time=test_time or rr.get("time"),
                weight=rr.get("weight"),
            )
            findings.append(finding)

        return findings

    def get_config_schema(self) -> dict:
        """Return SCAP importer specific config schema."""
        base = super().get_config_schema()
        base["properties"].update(
            {
                "report_path": {
                    "type": "string",
                    "description": "Path to XCCDF result XML file",
                },
                "report_content": {
                    "type": "string",
                    "description": "XCCDF result XML content",
                },
            }
        )
        return base
