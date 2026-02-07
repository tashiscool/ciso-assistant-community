"""
POA&M Services

This module provides services for Plan of Action and Milestones (POA&M) management:
- POAMExportService: Export POA&M data in various formats (FedRAMP XLSX, CSV, OSCAL)
- AIPOAMGenerator: AI-powered POA&M item generation from findings
"""


def __getattr__(name):
    """Lazy import to avoid circular dependencies and optional dependency issues"""
    if name == 'POAMExportService':
        from poam.services.poam_export import POAMExportService
        return POAMExportService
    if name == 'AIPOAMGenerator':
        from poam.services.ai_poam_generator import AIPOAMGenerator
        return AIPOAMGenerator
    if name == 'get_ai_poam_generator':
        from poam.services.ai_poam_generator import get_ai_poam_generator
        return get_ai_poam_generator
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    'POAMExportService',
    'AIPOAMGenerator',
    'get_ai_poam_generator',
]
