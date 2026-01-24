# MIT License - See LICENSE-MIT.txt in repository root
"""
ARM Format Helpers - Clean-room MIT implementation

Import EBIOS RM studies from ARM Excel format.
ARM (Analyse de Risques par la Méthode) exports studies with
workshop-organized sheets and supports French/English variants.
"""

from io import BytesIO
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

from .excel_helpers import (
    ExcelReader,
    get_sheet_rows,
    parse_multiline,
    coalesce,
)
from .ebios_excel import EbiosStudyData


# Sheet name variants for French/English ARM exports
SHEET_VARIANTS = {
    # Workshop 1 - Scope & Security Baseline
    "business_values": [
        "1 - Base de valeurs métier",
        "1 - Business values",
        "1 - Primary assets",
    ],
    "missions": [
        "1 - Base de missions",
        "1 - Missions",
    ],
    "feared_events": [
        "1 - Base d'évènements redoutés",
        "1 - Feared events",
    ],
    "supporting_assets": [
        "1 - Biens supports",
        "1 - Supporting assets",
    ],
    "impact_level_scale": [
        "1 - Échelle de niveau d'impact",
        "1 - Impact level scale",
    ],
    "complementary_measures": [
        "1 - Mesures complémentaires",
        "1 - Complementary measures",
        "1 - Applied controls",
    ],
    # Workshop 2 - Risk Origins
    "roto_couples": [
        "2 - Base de couples SR OV",
        "2 - Couples SR OV",
        "2 - RO TO pairs",
    ],
    # Workshop 3 - Stakeholders & Strategic Scenarios
    "stakeholder_categories": [
        "3 - Catégories de partie prena",
        "3 - Stakeholder types",
    ],
    "stakeholders": [
        "3 - Base de parties prenantes",
        "3 - Parties prenantes",
        "3 - Stakeholders",
    ],
    "stakeholder_danger_levels": [
        "3 - Niveau de danger des parti",
        "3 - Stakeholders danger level",
    ],
    "strategic_scenarios": [
        "3 - Synthèse des scénarios str",
        "3 - Strategic scenarios synthe",
    ],
    # Workshop 4 - Operational Scenarios
    "elementary_actions": [
        "4 - Actions élémentaires",
        "4 - Elementary actions",
    ],
}

# Column name variants for French/English
COLUMN_VARIANTS = {
    # Common columns
    "name": ["Nom", "Name"],
    "description": ["Description"],
    "ref_id": ["Réf.", "Ref.", "Ref", "Reference"],
    "abbreviation": ["Abrév.", "Abbrev.", "Abbreviation"],
    "justification": ["Justification"],
    "selected_check": ["✓/❒", "✓", "Selected"],
    # Workshop 1
    "mission": ["Mission"],
    "gravity_level": ["Niveau de gravité", "Gravity level", "Severity level"],
    "level": ["Niveau", "Level"],
    "supporting_assets": ["Biens supports", "Supporting assets"],
    "parent_asset": ["Bien support parent", "Parent supporting asset"],
    "feared_event": ["Évènement redouté", "Feared event"],
    "retained_gravity": ["Gravité retenue", "Retained gravity"],
    # Workshop 2
    "risk_origin": ["Source de risque", "Risk origin", "SR"],
    "target_objective": ["Objectif visé", "Target objective", "OV"],
    "motivation": ["Motivation"],
    "resources": ["Ressources", "Resources"],
    "activity": ["Activité", "Activity"],
    "pertinence": ["Pertinence", "Relevance"],
    # Workshop 3
    "category": ["Catégorie", "Category"],
    "dependency": ["Dépendance", "Dependency"],
    "penetration": ["Pénétration", "Penetration"],
    "maturity": ["Maturité", "Maturity"],
    "trust": ["Confiance", "Trust"],
    "exposure": ["Exposition", "Exposure"],
    "reliability": ["Fiabilité", "Reliability"],
    "danger_level": ["Niveau de danger", "Danger level"],
    # Workshop 4
    "action_type": ["Type d'action", "Action type"],
}


class ArmExcelImporter:
    """
    Imports EBIOS RM studies from ARM Excel format.

    ARM format uses different sheet naming conventions and supports
    both French and English column names.
    """

    def __init__(self, file_content: bytes):
        """
        Initialize importer with file content.

        Args:
            file_content: Excel file as bytes
        """
        self._reader = ExcelReader(file_content)
        self._workbook = None
        self._data: Optional[EbiosStudyData] = None

    def parse(self) -> EbiosStudyData:
        """
        Parse the ARM Excel file and extract EBIOS RM data.

        Returns:
            EbiosStudyData containing all extracted data
        """
        self._reader.load()
        self._workbook = self._reader._workbook
        self._data = EbiosStudyData()

        # Extract each section
        self._extract_business_values()
        self._extract_feared_events()
        self._extract_supporting_assets()
        self._extract_roto_couples()
        self._extract_stakeholders()
        self._extract_strategic_scenarios()
        self._extract_elementary_actions()

        self._reader.close()
        return self._data

    def _find_sheet(self, logical_name: str) -> Optional[Any]:
        """Find a sheet by trying variant names."""
        variants = SHEET_VARIANTS.get(logical_name, [])
        for name in variants:
            # Try exact match
            if name in self._workbook.sheetnames:
                return self._workbook[name]
            # Try partial match (sheet names may be truncated)
            for sheet_name in self._workbook.sheetnames:
                if sheet_name.startswith(name[:20]):  # First 20 chars
                    return self._workbook[sheet_name]
        return None

    def _get_column_value(self, row: dict, logical_name: str) -> Any:
        """Get a column value trying variant names."""
        variants = COLUMN_VARIANTS.get(logical_name, [logical_name])
        for variant in variants:
            # Try normalized key
            key = variant.lower().replace(" ", "_").replace(".", "")
            if key in row:
                return row[key]
            # Try as-is
            if variant in row:
                return row[variant]
        return None

    def _extract_business_values(self):
        """Extract business values/primary assets."""
        sheet = self._find_sheet("business_values")
        if not sheet:
            return

        rows = get_sheet_rows(sheet)
        for row in rows:
            asset = {
                "ref_id": self._get_column_value(row, "ref_id") or "",
                "name": self._get_column_value(row, "name") or "",
                "description": self._get_column_value(row, "description") or "",
                "asset_type": "primary",
                "mission": self._get_column_value(row, "mission") or "",
            }
            if asset["name"]:
                self._data.assets.append(asset)

    def _extract_feared_events(self):
        """Extract feared events."""
        sheet = self._find_sheet("feared_events")
        if not sheet:
            return

        rows = get_sheet_rows(sheet)
        for row in rows:
            event = {
                "ref_id": self._get_column_value(row, "ref_id") or "",
                "name": self._get_column_value(row, "name") or "",
                "description": self._get_column_value(row, "description") or "",
                "gravity": self._get_column_value(row, "gravity_level") or "",
                "retained_gravity": self._get_column_value(row, "retained_gravity") or "",
                "justification": self._get_column_value(row, "justification") or "",
            }
            if event["name"]:
                self._data.feared_events.append(event)

    def _extract_supporting_assets(self):
        """Extract supporting assets."""
        sheet = self._find_sheet("supporting_assets")
        if not sheet:
            return

        rows = get_sheet_rows(sheet)
        for row in rows:
            asset = {
                "ref_id": self._get_column_value(row, "ref_id") or "",
                "name": self._get_column_value(row, "name") or "",
                "description": self._get_column_value(row, "description") or "",
                "asset_type": "supporting",
                "parent": self._get_column_value(row, "parent_asset") or "",
                "category": self._get_column_value(row, "category") or "",
            }
            if asset["name"]:
                self._data.assets.append(asset)

    def _extract_roto_couples(self):
        """Extract RO/TO couples."""
        sheet = self._find_sheet("roto_couples")
        if not sheet:
            return

        rows = get_sheet_rows(sheet)
        for row in rows:
            selected = self._get_column_value(row, "selected_check")
            pair = {
                "ref_id": self._get_column_value(row, "ref_id") or "",
                "risk_origin": self._get_column_value(row, "risk_origin") or "",
                "target_objective": self._get_column_value(row, "target_objective") or "",
                "motivation": self._get_column_value(row, "motivation") or "",
                "resources": self._get_column_value(row, "resources") or "",
                "activity": self._get_column_value(row, "activity") or "",
                "pertinence": self._get_column_value(row, "pertinence") or "",
                "selected": self._parse_selected(selected),
            }
            if pair["risk_origin"] or pair["target_objective"]:
                self._data.ro_to_pairs.append(pair)

    def _extract_stakeholders(self):
        """Extract stakeholders."""
        sheet = self._find_sheet("stakeholders")
        if not sheet:
            return

        rows = get_sheet_rows(sheet)
        for row in rows:
            selected = self._get_column_value(row, "selected_check")
            stakeholder = {
                "ref_id": self._get_column_value(row, "ref_id") or "",
                "name": self._get_column_value(row, "name") or "",
                "category": self._get_column_value(row, "category") or "",
                "description": self._get_column_value(row, "description") or "",
                "dependency": self._get_column_value(row, "dependency") or "",
                "penetration": self._get_column_value(row, "penetration") or "",
                "maturity": self._get_column_value(row, "maturity") or "",
                "trust": self._get_column_value(row, "trust") or "",
                "exposure": self._get_column_value(row, "exposure") or "",
                "reliability": self._get_column_value(row, "reliability") or "",
                "is_selected": self._parse_selected(selected),
            }
            if stakeholder["name"]:
                self._data.stakeholders.append(stakeholder)

    def _extract_strategic_scenarios(self):
        """Extract strategic scenarios."""
        sheet = self._find_sheet("strategic_scenarios")
        if not sheet:
            return

        rows = get_sheet_rows(sheet)
        for row in rows:
            scenario = {
                "ref_id": self._get_column_value(row, "ref_id") or "",
                "name": self._get_column_value(row, "name") or "",
                "description": self._get_column_value(row, "description") or "",
                "gravity": self._get_column_value(row, "gravity_level") or "",
                "likelihood": self._get_column_value(row, "level") or "",
            }
            if scenario["name"]:
                self._data.strategic_scenarios.append(scenario)

    def _extract_elementary_actions(self):
        """Extract elementary actions."""
        sheet = self._find_sheet("elementary_actions")
        if not sheet:
            return

        rows = get_sheet_rows(sheet)
        for row in rows:
            action = {
                "ref_id": self._get_column_value(row, "ref_id") or "",
                "name": self._get_column_value(row, "name") or "",
                "description": self._get_column_value(row, "description") or "",
                "action_type": self._get_column_value(row, "action_type") or "",
            }
            if action["name"]:
                self._data.elementary_actions.append(action)

    def _parse_selected(self, value: Any) -> bool:
        """Parse selection checkbox value."""
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ("true", "yes", "1", "✓", "x", "oui")
        return bool(value)
