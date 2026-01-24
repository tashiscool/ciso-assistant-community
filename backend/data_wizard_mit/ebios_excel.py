# MIT License - See LICENSE-MIT.txt in repository root
"""
EBIOS RM Excel Helpers - Clean-room MIT implementation

Import/export EBIOS RM studies from/to Excel format.
Supports the standard EBIOS RM Excel template structure with
workshop-numbered sheets (e.g., "1.1 Study", "1.3 Feared Events").
"""

from io import BytesIO
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

from .excel_helpers import (
    ExcelReader,
    ExcelWriter,
    get_sheet_rows,
    parse_multiline,
    normalize_header,
    coalesce,
)


# Sheet prefix mappings for EBIOS RM Excel format
SHEET_PREFIXES = {
    "study": "1.1",
    "assets": "1.2",
    "feared_events": "1.3",
    "compliance": "1.4",
    "ro_to": "2.1",
    "stakeholders": "3.1",
    "strategic_scenarios": "3.2.1",
    "attack_paths": "3.2.2",
    "stakeholder_controls": "3.3",
    "elementary_actions": "4.0",
    "operational_scenarios": "4.1.1",
    "operating_modes": "4.1.2",
}


@dataclass
class EbiosStudyData:
    """Container for EBIOS RM study import data."""
    # Study metadata
    ref_id: str = ""
    name: str = ""
    description: str = ""
    version: str = ""
    status: str = ""
    observation: str = ""

    # Workshop 1 - Scope
    assets: List[Dict[str, Any]] = field(default_factory=list)
    feared_events: List[Dict[str, Any]] = field(default_factory=list)
    compliance_assessments: List[Dict[str, Any]] = field(default_factory=list)

    # Workshop 2 - Risk Origins
    ro_to_pairs: List[Dict[str, Any]] = field(default_factory=list)

    # Workshop 3 - Strategic Scenarios
    stakeholders: List[Dict[str, Any]] = field(default_factory=list)
    strategic_scenarios: List[Dict[str, Any]] = field(default_factory=list)
    attack_paths: List[Dict[str, Any]] = field(default_factory=list)

    # Workshop 4 - Operational Scenarios
    elementary_actions: List[Dict[str, Any]] = field(default_factory=list)
    operational_scenarios: List[Dict[str, Any]] = field(default_factory=list)

    # Workshop 5 - Treatment
    operating_modes: List[Dict[str, Any]] = field(default_factory=list)


class EbiosExcelImporter:
    """
    Imports EBIOS RM studies from Excel format.

    Supports the standard EBIOS RM Excel template with
    workshop-numbered sheets.
    """

    def __init__(self, file_content: bytes):
        """
        Initialize importer with file content.

        Args:
            file_content: Excel file as bytes
        """
        self._reader = ExcelReader(file_content)
        self._data: Optional[EbiosStudyData] = None

    def parse(self) -> EbiosStudyData:
        """
        Parse the Excel file and extract EBIOS RM data.

        Returns:
            EbiosStudyData containing all extracted data
        """
        self._reader.load()
        self._data = EbiosStudyData()

        # Extract each section
        self._extract_study_metadata()
        self._extract_assets()
        self._extract_feared_events()
        self._extract_compliance()
        self._extract_ro_to()
        self._extract_stakeholders()
        self._extract_strategic_scenarios()
        self._extract_attack_paths()
        self._extract_elementary_actions()
        self._extract_operational_scenarios()
        self._extract_operating_modes()

        self._reader.close()
        return self._data

    def _extract_study_metadata(self):
        """Extract study metadata from 1.1 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["study"])
        rows = get_sheet_rows(sheet)
        if rows:
            row = rows[0]
            self._data.ref_id = str(coalesce(row.get("ref_id"), row.get("ref"), ""))
            self._data.name = str(coalesce(row.get("name"), ""))
            self._data.description = str(coalesce(row.get("description"), ""))
            self._data.version = str(coalesce(row.get("version"), ""))
            self._data.status = str(coalesce(row.get("status"), ""))
            self._data.observation = str(coalesce(row.get("observation"), ""))

    def _extract_assets(self):
        """Extract assets from 1.2 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["assets"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            asset = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "name": coalesce(row.get("name"), ""),
                "description": coalesce(row.get("description"), ""),
                "asset_type": coalesce(row.get("type"), row.get("asset_type"), ""),
                "category": coalesce(row.get("category"), ""),
                "parent": coalesce(row.get("parent"), row.get("parent_asset"), ""),
            }
            self._data.assets.append(asset)

    def _extract_feared_events(self):
        """Extract feared events from 1.3 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["feared_events"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            event = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "name": coalesce(row.get("name"), ""),
                "description": coalesce(row.get("description"), ""),
                "assets": parse_multiline(coalesce(row.get("assets"), row.get("supporting_assets"), "")),
                "gravity": coalesce(row.get("gravity"), row.get("severity"), row.get("impact"), ""),
                "qualifications": parse_multiline(coalesce(row.get("qualifications"), "")),
            }
            self._data.feared_events.append(event)

    def _extract_compliance(self):
        """Extract compliance assessments from 1.4 sheets."""
        for name, sheet in self._reader.find_sheets_by_prefix(SHEET_PREFIXES["compliance"]):
            rows = get_sheet_rows(sheet)
            for row in rows:
                assessment = {
                    "sheet_name": name,
                    "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                    "control": coalesce(row.get("control"), row.get("measure"), ""),
                    "status": coalesce(row.get("status"), ""),
                    "observation": coalesce(row.get("observation"), row.get("comments"), ""),
                }
                self._data.compliance_assessments.append(assessment)

    def _extract_ro_to(self):
        """Extract RO/TO pairs from 2.1 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["ro_to"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            pair = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "risk_origin": coalesce(row.get("risk_origin"), row.get("ro"), row.get("source_risk"), ""),
                "target_objective": coalesce(row.get("target_objective"), row.get("to"), row.get("objective"), ""),
                "motivation": coalesce(row.get("motivation"), ""),
                "resources": coalesce(row.get("resources"), ""),
                "activity": coalesce(row.get("activity"), ""),
                "pertinence": coalesce(row.get("pertinence"), row.get("relevance"), ""),
                "selected": self._parse_selected(row),
            }
            self._data.ro_to_pairs.append(pair)

    def _extract_stakeholders(self):
        """Extract stakeholders from 3.1 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["stakeholders"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            stakeholder = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "name": coalesce(row.get("name"), ""),
                "category": coalesce(row.get("category"), row.get("type"), ""),
                "description": coalesce(row.get("description"), ""),
                "dependency": coalesce(row.get("dependency"), ""),
                "penetration": coalesce(row.get("penetration"), ""),
                "maturity": coalesce(row.get("maturity"), ""),
                "trust": coalesce(row.get("trust"), ""),
                "is_selected": self._parse_selected(row),
            }
            self._data.stakeholders.append(stakeholder)

    def _extract_strategic_scenarios(self):
        """Extract strategic scenarios from 3.2.1 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["strategic_scenarios"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            scenario = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "name": coalesce(row.get("name"), ""),
                "description": coalesce(row.get("description"), ""),
                "ro_to": coalesce(row.get("ro_to"), row.get("couple"), ""),
                "gravity": coalesce(row.get("gravity"), row.get("severity"), ""),
                "likelihood": coalesce(row.get("likelihood"), row.get("probability"), ""),
                "risk_level": coalesce(row.get("risk_level"), row.get("risk"), ""),
            }
            self._data.strategic_scenarios.append(scenario)

    def _extract_attack_paths(self):
        """Extract attack paths from 3.2.2 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["attack_paths"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            path = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "name": coalesce(row.get("name"), ""),
                "description": coalesce(row.get("description"), ""),
                "strategic_scenario": coalesce(row.get("strategic_scenario"), row.get("scenario"), ""),
                "stakeholders": parse_multiline(coalesce(row.get("stakeholders"), "")),
            }
            self._data.attack_paths.append(path)

    def _extract_elementary_actions(self):
        """Extract elementary actions from 4.0 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["elementary_actions"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            action = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "name": coalesce(row.get("name"), ""),
                "description": coalesce(row.get("description"), ""),
                "action_type": coalesce(row.get("type"), row.get("action_type"), ""),
            }
            self._data.elementary_actions.append(action)

    def _extract_operational_scenarios(self):
        """Extract operational scenarios from 4.1.1 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["operational_scenarios"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            scenario = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "name": coalesce(row.get("name"), ""),
                "description": coalesce(row.get("description"), ""),
                "attack_path": coalesce(row.get("attack_path"), row.get("path"), ""),
                "likelihood": coalesce(row.get("likelihood"), ""),
                "gravity": coalesce(row.get("gravity"), ""),
                "risk_level": coalesce(row.get("risk_level"), ""),
            }
            self._data.operational_scenarios.append(scenario)

    def _extract_operating_modes(self):
        """Extract operating modes from 4.1.2 sheet."""
        sheet = self._reader.find_sheet_by_prefix(SHEET_PREFIXES["operating_modes"])
        rows = get_sheet_rows(sheet)
        for row in rows:
            mode = {
                "ref_id": coalesce(row.get("ref_id"), row.get("ref"), ""),
                "name": coalesce(row.get("name"), ""),
                "description": coalesce(row.get("description"), ""),
                "operational_scenario": coalesce(row.get("operational_scenario"), row.get("scenario"), ""),
                "actions": parse_multiline(coalesce(row.get("actions"), row.get("elementary_actions"), "")),
            }
            self._data.operating_modes.append(mode)

    def _parse_selected(self, row: dict) -> bool:
        """Parse selection checkbox value."""
        value = coalesce(
            row.get("selected"),
            row.get("is_selected"),
            row.get("✓"),
            row.get("✓/❒"),
        )
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ("true", "yes", "1", "✓", "x")
        return bool(value)


class EbiosExcelExporter:
    """
    Exports EBIOS RM studies to Excel format.

    Creates Excel files following the standard EBIOS RM template
    with workshop-numbered sheets.
    """

    def __init__(self):
        """Initialize exporter."""
        self._writer = ExcelWriter()

    def export(self, data: EbiosStudyData) -> bytes:
        """
        Export EBIOS study data to Excel bytes.

        Args:
            data: EbiosStudyData to export

        Returns:
            Excel file as bytes
        """
        self._writer.create()

        # Create all worksheets
        self._write_study_sheet(data)
        self._write_assets_sheet(data)
        self._write_feared_events_sheet(data)
        self._write_ro_to_sheet(data)
        self._write_stakeholders_sheet(data)
        self._write_strategic_scenarios_sheet(data)
        self._write_attack_paths_sheet(data)
        self._write_operational_scenarios_sheet(data)

        buffer = BytesIO()
        result = self._writer.save(buffer)
        self._writer.close()
        return result

    def _write_study_sheet(self, data: EbiosStudyData):
        """Write study metadata sheet."""
        headers = ["ref_id", "name", "description", "version", "status", "observation"]
        self._writer.write_headers("1.1 Study", headers)
        self._writer.write_row(
            "1.1 Study",
            [data.ref_id, data.name, data.description, data.version, data.status, data.observation],
            2
        )

    def _write_assets_sheet(self, data: EbiosStudyData):
        """Write assets sheet."""
        headers = ["ref_id", "name", "description", "asset_type", "category", "parent"]
        rows = [
            {h: asset.get(h, "") for h in headers}
            for asset in data.assets
        ]
        self._writer.write_data("1.2 Assets", headers, rows)

    def _write_feared_events_sheet(self, data: EbiosStudyData):
        """Write feared events sheet."""
        headers = ["ref_id", "name", "description", "assets", "gravity", "qualifications"]
        rows = []
        for event in data.feared_events:
            row = {h: event.get(h, "") for h in headers}
            # Join list fields
            if isinstance(row["assets"], list):
                row["assets"] = "\n".join(row["assets"])
            if isinstance(row["qualifications"], list):
                row["qualifications"] = "\n".join(row["qualifications"])
            rows.append(row)
        self._writer.write_data("1.3 Feared Events", headers, rows)

    def _write_ro_to_sheet(self, data: EbiosStudyData):
        """Write RO/TO pairs sheet."""
        headers = ["ref_id", "risk_origin", "target_objective", "motivation", "pertinence", "selected"]
        rows = [
            {h: pair.get(h, "") for h in headers}
            for pair in data.ro_to_pairs
        ]
        self._writer.write_data("2.1 RO TO Pairs", headers, rows)

    def _write_stakeholders_sheet(self, data: EbiosStudyData):
        """Write stakeholders sheet."""
        headers = ["ref_id", "name", "category", "description", "dependency", "penetration", "maturity", "trust"]
        rows = [
            {h: sh.get(h, "") for h in headers}
            for sh in data.stakeholders
        ]
        self._writer.write_data("3.1 Stakeholders", headers, rows)

    def _write_strategic_scenarios_sheet(self, data: EbiosStudyData):
        """Write strategic scenarios sheet."""
        headers = ["ref_id", "name", "description", "ro_to", "gravity", "likelihood", "risk_level"]
        rows = [
            {h: sc.get(h, "") for h in headers}
            for sc in data.strategic_scenarios
        ]
        self._writer.write_data("3.2.1 Strategic Scenarios", headers, rows)

    def _write_attack_paths_sheet(self, data: EbiosStudyData):
        """Write attack paths sheet."""
        headers = ["ref_id", "name", "description", "strategic_scenario", "stakeholders"]
        rows = []
        for path in data.attack_paths:
            row = {h: path.get(h, "") for h in headers}
            if isinstance(row["stakeholders"], list):
                row["stakeholders"] = "\n".join(row["stakeholders"])
            rows.append(row)
        self._writer.write_data("3.2.2 Attack Paths", headers, rows)

    def _write_operational_scenarios_sheet(self, data: EbiosStudyData):
        """Write operational scenarios sheet."""
        headers = ["ref_id", "name", "description", "attack_path", "likelihood", "gravity", "risk_level"]
        rows = [
            {h: sc.get(h, "") for h in headers}
            for sc in data.operational_scenarios
        ]
        self._writer.write_data("4.1.1 Operational Scenarios", headers, rows)
