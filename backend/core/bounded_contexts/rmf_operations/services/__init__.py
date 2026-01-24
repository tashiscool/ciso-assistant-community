"""
RMF Operations Services

Services for CKL parsing, exporting, audit logging, and other RMF operations.
Enhanced with SCAP parsing, RMF document generation, and system scoring.
"""


def __getattr__(name):
    """Lazy import to avoid circular dependencies and optional dependency issues"""
    if name == 'CKLParser':
        from .ckl_parser import CKLParser
        return CKLParser
    elif name == 'CKLExporter':
        from .ckl_exporter import CKLExporter
        return CKLExporter
    elif name == 'BulkOperationsService':
        from .bulk_operations import BulkOperationsService
        return BulkOperationsService
    elif name == 'AuditService':
        from .audit_service import AuditService
        return AuditService
    elif name == 'audit_service':
        from .audit_service import audit_service
        return audit_service
    elif name == 'NessusParser':
        from .nessus_parser import NessusParser
        return NessusParser
    elif name == 'VulnerabilityCorrelationService':
        from .vulnerability_correlation import VulnerabilityCorrelationService
        return VulnerabilityCorrelationService
    elif name == 'SCAPParser':
        from .rmf_enhanced import SCAPParser
        return SCAPParser
    elif name == 'RMFDocumentGenerator':
        from .rmf_enhanced import RMFDocumentGenerator
        return RMFDocumentGenerator
    elif name == 'SystemScoringService':
        from .rmf_enhanced import SystemScoringService
        return SystemScoringService
    elif name == 'AssetMetadataService':
        from .rmf_enhanced import AssetMetadataService
        return AssetMetadataService
    elif name == 'KSIImportService':
        from .ksi_import import KSIImportService
        return KSIImportService
    elif name == 'KSILibraryParser':
        from .ksi_import import KSILibraryParser
        return KSILibraryParser
    elif name == 'import_ksis_for_cso':
        from .ksi_import import import_ksis_for_cso
        return import_ksis_for_cso
    elif name == 'ValidationRuleTemplateService':
        from .validation_templates import ValidationRuleTemplateService
        return ValidationRuleTemplateService
    elif name == 'get_validation_template_service':
        from .validation_templates import get_validation_template_service
        return get_validation_template_service
    elif name == 'VALIDATION_RULE_TEMPLATES':
        from .validation_templates import VALIDATION_RULE_TEMPLATES
        return VALIDATION_RULE_TEMPLATES
    elif name == 'OARGenerationService':
        from .oar_workflow import OARGenerationService
        return OARGenerationService
    elif name == 'get_oar_generation_service':
        from .oar_workflow import get_oar_generation_service
        return get_oar_generation_service
    elif name == 'TrustCenterService':
        from .trust_center import TrustCenterService
        return TrustCenterService
    elif name == 'get_trust_center_service':
        from .trust_center import get_trust_center_service
        return get_trust_center_service
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    'CKLParser',
    'CKLExporter',
    'BulkOperationsService',
    'AuditService',
    'audit_service',
    'NessusParser',
    'VulnerabilityCorrelationService',
    'SCAPParser',
    'RMFDocumentGenerator',
    'SystemScoringService',
    'AssetMetadataService',
    # KSI Import
    'KSIImportService',
    'KSILibraryParser',
    'import_ksis_for_cso',
    # Validation Templates
    'ValidationRuleTemplateService',
    'get_validation_template_service',
    'VALIDATION_RULE_TEMPLATES',
    # OAR Generation
    'OARGenerationService',
    'get_oar_generation_service',
    # Trust Center
    'TrustCenterService',
    'get_trust_center_service',
]