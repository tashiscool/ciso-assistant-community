# MIT License - See LICENSE-MIT.txt in repository root
"""
Data Wizard Module (MIT Licensed)

Clean-room implementation of Excel import/export utilities for GRC data.

Modules:
    - excel_helpers: Generic Excel parsing utilities
    - ebios_excel: EBIOS RM Excel format support
    - arm_helpers: ARM format Excel support
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .excel_helpers import (
        ExcelReader,
        ExcelWriter,
        find_sheet_by_name,
        find_sheet_by_prefix,
        get_sheet_rows,
        parse_multiline,
    )
    from .ebios_excel import EbiosExcelImporter, EbiosExcelExporter
    from .arm_helpers import ArmExcelImporter

__all__ = [
    "ExcelReader",
    "ExcelWriter",
    "find_sheet_by_name",
    "find_sheet_by_prefix",
    "get_sheet_rows",
    "parse_multiline",
    "EbiosExcelImporter",
    "EbiosExcelExporter",
    "ArmExcelImporter",
]


def __getattr__(name: str):
    """Lazy import to allow testing without dependencies."""
    if name in ["ExcelReader", "ExcelWriter", "find_sheet_by_name",
                "find_sheet_by_prefix", "get_sheet_rows", "parse_multiline"]:
        from . import excel_helpers
        return getattr(excel_helpers, name)
    elif name in ["EbiosExcelImporter", "EbiosExcelExporter"]:
        from . import ebios_excel
        return getattr(ebios_excel, name)
    elif name == "ArmExcelImporter":
        from . import arm_helpers
        return getattr(arm_helpers, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
