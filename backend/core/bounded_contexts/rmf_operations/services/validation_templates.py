"""
Persistent Validation Rule Templates

Pre-built validation rule templates for common FedRAMP 20x KSI validations.
These templates can be instantiated to create actual PersistentValidationRule records.
"""

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Any, Optional
from uuid import UUID
import structlog

from django.db import transaction

logger = structlog.get_logger(__name__)


@dataclass
class ValidationRuleTemplate:
    """
    Template for a persistent validation rule.

    Templates define the structure and default configuration for
    validation rules that can be applied to KSIs.
    """
    id: str
    name: str
    description: str
    rule_type: str  # api, scanner, config, log, evidence, manual
    applicable_ksi_refs: List[str]  # KSI ref IDs this template can validate

    # Default configuration
    default_frequency: str = 'daily'  # hourly, daily, weekly, monthly
    default_definition: Dict[str, Any] = field(default_factory=dict)
    default_pass_criteria: Dict[str, Any] = field(default_factory=dict)

    # Integration requirements
    requires_integration: Optional[str] = None  # e.g., 'aws', 'azure', 'okta'

    # Customization parameters that users can configure
    parameters: List[Dict[str, Any]] = field(default_factory=list)

    # Category for grouping
    category: str = 'general'

    def to_dict(self) -> Dict[str, Any]:
        """Convert template to dictionary."""
        return asdict(self)


# =============================================================================
# Pre-built Validation Rule Templates
# =============================================================================

VALIDATION_RULE_TEMPLATES: Dict[str, ValidationRuleTemplate] = {
    # =========================================================================
    # Identity and Access Management (IAM) KSI Validations
    # =========================================================================
    'mfa_enforcement_check': ValidationRuleTemplate(
        id='mfa_enforcement_check',
        name='MFA Enforcement Check',
        description='Validates that phishing-resistant MFA is enforced for all user authentication. '
                    'Checks identity provider configuration and user enrollment status.',
        rule_type='api',
        applicable_ksi_refs=['KSI-IAM-01', 'KSI-IAM-02'],
        category='identity',
        default_frequency='daily',
        default_definition={
            'check_type': 'mfa_enforcement',
            'endpoints': [
                {'path': '/api/identity/mfa-policy', 'method': 'GET'},
                {'path': '/api/identity/mfa-enrollment', 'method': 'GET'},
            ],
            'expected_values': {
                'mfa_required': True,
                'phishing_resistant_methods': ['webauthn', 'fido2', 'piv'],
            }
        },
        default_pass_criteria={
            'mfa_policy_enabled': True,
            'phishing_resistant_required': True,
            'enrollment_percentage': 100,
        },
        requires_integration='identity_provider',
        parameters=[
            {'name': 'exclude_service_accounts', 'type': 'boolean', 'default': True,
             'description': 'Exclude service accounts from MFA requirement'},
            {'name': 'acceptable_mfa_methods', 'type': 'multiselect',
             'options': ['webauthn', 'fido2', 'piv', 'totp', 'push'],
             'default': ['webauthn', 'fido2', 'piv'],
             'description': 'Acceptable MFA methods (phishing-resistant recommended)'},
            {'name': 'grace_period_days', 'type': 'number', 'default': 0,
             'description': 'Grace period for new user enrollment'},
        ]
    ),

    'privileged_access_review': ValidationRuleTemplate(
        id='privileged_access_review',
        name='Privileged Access Review',
        description='Validates just-in-time (JIT) access controls and least privilege '
                    'enforcement for privileged accounts.',
        rule_type='api',
        applicable_ksi_refs=['KSI-IAM-04', 'KSI-IAM-05'],
        category='identity',
        default_frequency='daily',
        default_definition={
            'check_type': 'privileged_access',
            'endpoints': [
                {'path': '/api/identity/privileged-accounts', 'method': 'GET'},
                {'path': '/api/identity/access-reviews', 'method': 'GET'},
            ],
        },
        default_pass_criteria={
            'no_standing_privileges': True,
            'jit_enabled': True,
            'access_review_current': True,
            'max_privilege_duration_hours': 8,
        },
        requires_integration='identity_provider',
        parameters=[
            {'name': 'max_session_duration', 'type': 'number', 'default': 8,
             'description': 'Maximum privileged session duration in hours'},
            {'name': 'require_approval', 'type': 'boolean', 'default': True,
             'description': 'Require approval for privilege elevation'},
        ]
    ),

    'session_management_check': ValidationRuleTemplate(
        id='session_management_check',
        name='Session Management Validation',
        description='Validates session timeout configurations and concurrent session limits.',
        rule_type='config',
        applicable_ksi_refs=['KSI-IAM-06'],
        category='identity',
        default_frequency='daily',
        default_definition={
            'check_type': 'session_config',
            'config_sources': ['identity_provider', 'application_config'],
        },
        default_pass_criteria={
            'idle_timeout_minutes': 15,
            'absolute_timeout_hours': 12,
            'concurrent_sessions_limited': True,
        },
        parameters=[
            {'name': 'max_idle_timeout', 'type': 'number', 'default': 15,
             'description': 'Maximum idle timeout in minutes'},
            {'name': 'max_session_duration', 'type': 'number', 'default': 720,
             'description': 'Maximum session duration in minutes'},
        ]
    ),

    # =========================================================================
    # Change Management (CMT) KSI Validations
    # =========================================================================
    'change_logging_check': ValidationRuleTemplate(
        id='change_logging_check',
        name='Change Logging Verification',
        description='Validates that all system changes are logged and monitored with '
                    'complete audit trails.',
        rule_type='log',
        applicable_ksi_refs=['KSI-CMT-01', 'KSI-CMT-02'],
        category='change_management',
        default_frequency='hourly',
        default_definition={
            'check_type': 'change_audit_logs',
            'log_sources': ['change_management_system', 'infrastructure_logs'],
            'required_fields': ['timestamp', 'user', 'change_type', 'target', 'before', 'after'],
        },
        default_pass_criteria={
            'all_changes_logged': True,
            'logs_complete': True,
            'logs_tamper_proof': True,
        },
        parameters=[
            {'name': 'log_retention_days', 'type': 'number', 'default': 365,
             'description': 'Minimum log retention period in days'},
        ]
    ),

    'automated_testing_check': ValidationRuleTemplate(
        id='automated_testing_check',
        name='Automated Testing Validation',
        description='Validates that automated testing is performed for all deployments '
                    'including security tests.',
        rule_type='api',
        applicable_ksi_refs=['KSI-CMT-03'],
        category='change_management',
        default_frequency='daily',
        default_definition={
            'check_type': 'ci_cd_pipeline',
            'endpoints': [
                {'path': '/api/ci/pipelines', 'method': 'GET'},
                {'path': '/api/ci/test-results', 'method': 'GET'},
            ],
        },
        default_pass_criteria={
            'security_tests_enabled': True,
            'tests_required_for_deploy': True,
            'test_coverage_percentage': 80,
        },
        requires_integration='ci_cd',
        parameters=[
            {'name': 'min_test_coverage', 'type': 'number', 'default': 80,
             'description': 'Minimum test coverage percentage'},
            {'name': 'require_security_scan', 'type': 'boolean', 'default': True,
             'description': 'Require security scan before deployment'},
        ]
    ),

    # =========================================================================
    # Cloud Native Architecture (CNA) KSI Validations
    # =========================================================================
    'network_segmentation_check': ValidationRuleTemplate(
        id='network_segmentation_check',
        name='Network Segmentation Validation',
        description='Validates network traffic restrictions, segmentation, and '
                    'zero-trust network enforcement.',
        rule_type='scanner',
        applicable_ksi_refs=['KSI-CNA-01', 'KSI-CNA-02', 'KSI-CNA-03'],
        category='network',
        default_frequency='weekly',
        default_definition={
            'check_type': 'network_scan',
            'scan_types': ['segmentation', 'firewall_rules', 'traffic_flow'],
        },
        default_pass_criteria={
            'segmentation_enforced': True,
            'default_deny': True,
            'east_west_traffic_controlled': True,
        },
        requires_integration='network_scanner',
        parameters=[
            {'name': 'critical_segments', 'type': 'array', 'default': [],
             'description': 'List of critical network segments to validate'},
        ]
    ),

    'immutable_infrastructure_check': ValidationRuleTemplate(
        id='immutable_infrastructure_check',
        name='Immutable Infrastructure Validation',
        description='Validates that infrastructure follows immutable patterns with '
                    'no runtime modifications.',
        rule_type='config',
        applicable_ksi_refs=['KSI-CNA-04'],
        category='infrastructure',
        default_frequency='daily',
        default_definition={
            'check_type': 'infrastructure_immutability',
            'checks': ['no_ssh_access', 'no_runtime_changes', 'image_based_deploy'],
        },
        default_pass_criteria={
            'immutable_deployment': True,
            'no_runtime_modifications': True,
            'versioned_artifacts': True,
        },
        parameters=[
            {'name': 'allow_emergency_access', 'type': 'boolean', 'default': True,
             'description': 'Allow emergency break-glass access'},
        ]
    ),

    # =========================================================================
    # Authorization by FedRAMP (AFR) KSI Validations
    # =========================================================================
    'vulnerability_scan_compliance': ValidationRuleTemplate(
        id='vulnerability_scan_compliance',
        name='Vulnerability Scan Compliance',
        description='Validates that vulnerability scans are performed per FedRAMP '
                    'requirements with appropriate coverage and frequency.',
        rule_type='scanner',
        applicable_ksi_refs=['KSI-AFR-04'],
        category='vulnerability',
        default_frequency='daily',
        default_definition={
            'check_type': 'vulnerability_compliance',
            'scan_types': ['infrastructure', 'container', 'web_application', 'database'],
        },
        default_pass_criteria={
            'scan_frequency_met': True,
            'coverage_percentage': 100,
            'authenticated_scans': True,
            'critical_remediation_sla': 30,
            'high_remediation_sla': 90,
        },
        requires_integration='vulnerability_scanner',
        parameters=[
            {'name': 'scan_frequency_days', 'type': 'number', 'default': 30,
             'description': 'Required scan frequency in days'},
            {'name': 'critical_sla_days', 'type': 'number', 'default': 30,
             'description': 'SLA for critical vulnerability remediation'},
            {'name': 'high_sla_days', 'type': 'number', 'default': 90,
             'description': 'SLA for high vulnerability remediation'},
        ]
    ),

    # =========================================================================
    # Service Configuration (SVC) KSI Validations
    # =========================================================================
    'encryption_in_transit': ValidationRuleTemplate(
        id='encryption_in_transit',
        name='Encryption in Transit Check',
        description='Validates TLS encryption for all network communications with '
                    'appropriate cipher suites and certificate validity.',
        rule_type='config',
        applicable_ksi_refs=['KSI-SVC-02', 'KSI-AFR-10'],
        category='encryption',
        default_frequency='daily',
        default_definition={
            'check_type': 'tls_configuration',
            'targets': ['load_balancers', 'api_gateways', 'databases', 'message_queues'],
            'expected_values': {
                'min_tls_version': '1.2',
                'preferred_tls_version': '1.3',
                'certificate_valid': True,
            }
        },
        default_pass_criteria={
            'tls_enabled': True,
            'min_version_met': True,
            'certificates_valid': True,
            'strong_ciphers_only': True,
        },
        parameters=[
            {'name': 'min_tls_version', 'type': 'select',
             'options': ['1.2', '1.3'], 'default': '1.2',
             'description': 'Minimum TLS version'},
            {'name': 'cert_expiry_warning_days', 'type': 'number', 'default': 30,
             'description': 'Days before expiry to warn about certificates'},
        ]
    ),

    'data_protection_check': ValidationRuleTemplate(
        id='data_protection_check',
        name='Data Protection Validation',
        description='Validates encryption at rest for all data stores containing '
                    'federal data or sensitive information.',
        rule_type='config',
        applicable_ksi_refs=['KSI-SVC-06', 'KSI-SVC-07'],
        category='encryption',
        default_frequency='daily',
        default_definition={
            'check_type': 'encryption_at_rest',
            'targets': ['databases', 'object_storage', 'file_storage', 'backups'],
        },
        default_pass_criteria={
            'encryption_enabled': True,
            'key_management_compliant': True,
            'data_classification_tagged': True,
        },
        parameters=[
            {'name': 'require_customer_managed_keys', 'type': 'boolean', 'default': False,
             'description': 'Require customer-managed encryption keys'},
        ]
    ),

    # =========================================================================
    # Recovery Planning (RPL) KSI Validations
    # =========================================================================
    'backup_verification': ValidationRuleTemplate(
        id='backup_verification',
        name='Backup Verification',
        description='Validates backup completion, integrity, and alignment with '
                    'recovery objectives (RPO/RTO).',
        rule_type='api',
        applicable_ksi_refs=['KSI-RPL-03', 'KSI-RPL-04'],
        category='recovery',
        default_frequency='daily',
        default_definition={
            'check_type': 'backup_status',
            'endpoints': [
                {'path': '/api/backup/status', 'method': 'GET'},
                {'path': '/api/backup/integrity', 'method': 'GET'},
            ],
        },
        default_pass_criteria={
            'backup_successful': True,
            'within_rpo': True,
            'integrity_verified': True,
            'offsite_copy_exists': True,
        },
        parameters=[
            {'name': 'rpo_hours', 'type': 'number', 'default': 24,
             'description': 'Recovery Point Objective in hours'},
            {'name': 'require_offsite', 'type': 'boolean', 'default': True,
             'description': 'Require offsite backup copy'},
        ]
    ),

    'recovery_testing_check': ValidationRuleTemplate(
        id='recovery_testing_check',
        name='Recovery Testing Validation',
        description='Validates that disaster recovery tests are performed regularly '
                    'and meet RTO requirements.',
        rule_type='evidence',
        applicable_ksi_refs=['KSI-RPL-04'],
        category='recovery',
        default_frequency='monthly',
        default_definition={
            'check_type': 'recovery_test_evidence',
            'evidence_types': ['test_report', 'recovery_log', 'rto_measurement'],
        },
        default_pass_criteria={
            'test_completed': True,
            'rto_met': True,
            'test_within_period': True,
        },
        parameters=[
            {'name': 'test_frequency_days', 'type': 'number', 'default': 90,
             'description': 'Required test frequency in days'},
            {'name': 'rto_hours', 'type': 'number', 'default': 4,
             'description': 'Recovery Time Objective in hours'},
        ]
    ),

    # =========================================================================
    # Monitoring, Logging, and Auditing (MLA) KSI Validations
    # =========================================================================
    'siem_operational_check': ValidationRuleTemplate(
        id='siem_operational_check',
        name='SIEM Operational Status',
        description='Validates that SIEM is operational, receiving logs from all '
                    'sources, and generating alerts.',
        rule_type='api',
        applicable_ksi_refs=['KSI-MLA-01', 'KSI-MLA-02'],
        category='monitoring',
        default_frequency='hourly',
        default_definition={
            'check_type': 'siem_health',
            'endpoints': [
                {'path': '/api/siem/health', 'method': 'GET'},
                {'path': '/api/siem/log-sources', 'method': 'GET'},
            ],
        },
        default_pass_criteria={
            'siem_operational': True,
            'all_sources_active': True,
            'alerting_enabled': True,
            'log_ingestion_current': True,
        },
        requires_integration='siem',
        parameters=[
            {'name': 'max_lag_minutes', 'type': 'number', 'default': 15,
             'description': 'Maximum acceptable log ingestion lag'},
        ]
    ),

    'log_retention_check': ValidationRuleTemplate(
        id='log_retention_check',
        name='Log Retention Compliance',
        description='Validates that audit logs are retained for the required period '
                    'and protected from tampering.',
        rule_type='config',
        applicable_ksi_refs=['KSI-MLA-06'],
        category='monitoring',
        default_frequency='weekly',
        default_definition={
            'check_type': 'log_retention',
            'log_types': ['security', 'audit', 'application', 'system'],
        },
        default_pass_criteria={
            'retention_period_met': True,
            'immutable_storage': True,
            'logs_encrypted': True,
        },
        parameters=[
            {'name': 'min_retention_days', 'type': 'number', 'default': 365,
             'description': 'Minimum log retention period in days'},
        ]
    ),

    # =========================================================================
    # Incident Response (INR) KSI Validations
    # =========================================================================
    'incident_response_readiness': ValidationRuleTemplate(
        id='incident_response_readiness',
        name='Incident Response Readiness',
        description='Validates that incident response procedures are documented, '
                    'tested, and team is trained.',
        rule_type='evidence',
        applicable_ksi_refs=['KSI-INR-01', 'KSI-INR-02'],
        category='incident',
        default_frequency='monthly',
        default_definition={
            'check_type': 'ir_readiness',
            'evidence_types': ['ir_plan', 'contact_list', 'runbooks', 'training_records'],
        },
        default_pass_criteria={
            'ir_plan_current': True,
            'contacts_verified': True,
            'team_trained': True,
            'runbooks_available': True,
        },
        parameters=[
            {'name': 'plan_review_frequency_days', 'type': 'number', 'default': 365,
             'description': 'Frequency of IR plan review in days'},
            {'name': 'training_frequency_days', 'type': 'number', 'default': 365,
             'description': 'Frequency of IR training in days'},
        ]
    ),

    # =========================================================================
    # Third-Party Risk (TPR) KSI Validations
    # =========================================================================
    'supply_chain_risk_check': ValidationRuleTemplate(
        id='supply_chain_risk_check',
        name='Supply Chain Risk Assessment',
        description='Validates that third-party and supply chain risks are '
                    'assessed and monitored.',
        rule_type='evidence',
        applicable_ksi_refs=['KSI-TPR-03', 'KSI-TPR-04'],
        category='third_party',
        default_frequency='monthly',
        default_definition={
            'check_type': 'supply_chain_risk',
            'evidence_types': ['vendor_assessments', 'sbom', 'dependency_scans'],
        },
        default_pass_criteria={
            'vendors_assessed': True,
            'sbom_current': True,
            'critical_vendors_monitored': True,
        },
        parameters=[
            {'name': 'assessment_frequency_days', 'type': 'number', 'default': 365,
             'description': 'Vendor assessment frequency in days'},
            {'name': 'require_sbom', 'type': 'boolean', 'default': True,
             'description': 'Require Software Bill of Materials'},
        ]
    ),
}


class ValidationRuleTemplateService:
    """
    Service for managing validation rule templates.

    Provides methods to list, retrieve, and instantiate validation
    rule templates as actual PersistentValidationRule records.
    """

    def list_templates(
        self,
        category: str = None,
        ksi_ref_id: str = None,
        rule_type: str = None
    ) -> List[ValidationRuleTemplate]:
        """
        List available templates with optional filtering.

        Args:
            category: Filter by category (identity, network, etc.)
            ksi_ref_id: Filter by applicable KSI reference ID
            rule_type: Filter by rule type (api, scanner, config, etc.)

        Returns:
            List of matching ValidationRuleTemplate objects
        """
        templates = list(VALIDATION_RULE_TEMPLATES.values())

        if category:
            templates = [t for t in templates if t.category == category]

        if ksi_ref_id:
            templates = [t for t in templates if ksi_ref_id in t.applicable_ksi_refs]

        if rule_type:
            templates = [t for t in templates if t.rule_type == rule_type]

        return templates

    def get_template(self, template_id: str) -> Optional[ValidationRuleTemplate]:
        """
        Get a specific template by ID.

        Args:
            template_id: Template identifier

        Returns:
            ValidationRuleTemplate or None if not found
        """
        return VALIDATION_RULE_TEMPLATES.get(template_id)

    def get_templates_for_ksi(self, ksi_ref_id: str) -> List[ValidationRuleTemplate]:
        """
        Get all templates applicable to a specific KSI.

        Args:
            ksi_ref_id: KSI reference ID (e.g., 'KSI-IAM-01')

        Returns:
            List of applicable templates
        """
        return [
            t for t in VALIDATION_RULE_TEMPLATES.values()
            if ksi_ref_id in t.applicable_ksi_refs
        ]

    def get_categories(self) -> List[Dict[str, Any]]:
        """
        Get list of template categories with counts.

        Returns:
            List of category dicts with name and template count
        """
        category_counts: Dict[str, int] = {}
        for template in VALIDATION_RULE_TEMPLATES.values():
            cat = template.category
            category_counts[cat] = category_counts.get(cat, 0) + 1

        category_names = {
            'identity': 'Identity & Access Management',
            'change_management': 'Change Management',
            'network': 'Network Security',
            'infrastructure': 'Infrastructure',
            'vulnerability': 'Vulnerability Management',
            'encryption': 'Encryption & Data Protection',
            'recovery': 'Backup & Recovery',
            'monitoring': 'Monitoring & Logging',
            'incident': 'Incident Response',
            'third_party': 'Third-Party Risk',
            'general': 'General',
        }

        return [
            {
                'code': cat,
                'name': category_names.get(cat, cat.title()),
                'template_count': count
            }
            for cat, count in sorted(category_counts.items())
        ]

    @transaction.atomic
    def instantiate_template(
        self,
        template_id: str,
        cso_id: UUID,
        ksi_implementation_ids: List[UUID],
        name_override: str = None,
        parameters: Dict[str, Any] = None,
        created_by: UUID = None
    ) -> 'PersistentValidationRule':
        """
        Create a PersistentValidationRule from a template.

        Args:
            template_id: Template to instantiate
            cso_id: Cloud Service Offering ID
            ksi_implementation_ids: KSI implementations to link
            name_override: Optional custom name
            parameters: Custom parameter values
            created_by: User ID creating the rule

        Returns:
            Created PersistentValidationRule instance
        """
        from ..aggregates.persistent_validation import PersistentValidationRule

        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        # Merge default definition with custom parameters
        definition = {**template.default_definition}
        if parameters:
            # Apply parameter overrides
            for param in template.parameters:
                param_name = param['name']
                if param_name in parameters:
                    definition[param_name] = parameters[param_name]

        # Create the rule
        rule = PersistentValidationRule.create(
            name=name_override or template.name,
            description=template.description,
            rule_type=template.rule_type,
            cso_id=cso_id,
            created_by=created_by
        )

        rule.rule_definition = definition
        rule.pass_criteria = template.default_pass_criteria
        rule.frequency = template.default_frequency
        rule.integration_type = template.requires_integration
        rule.ksi_implementation_ids = [str(id) for id in ksi_implementation_ids]
        rule.template_id = template_id

        rule.save()

        logger.info(
            "Validation rule created from template",
            template_id=template_id,
            rule_id=str(rule.id),
            cso_id=str(cso_id),
            ksi_count=len(ksi_implementation_ids)
        )

        return rule

    def get_template_summary(self) -> Dict[str, Any]:
        """
        Get summary of all templates.

        Returns:
            Summary dict with counts and categories
        """
        templates = list(VALIDATION_RULE_TEMPLATES.values())

        # Count by category
        by_category: Dict[str, int] = {}
        for t in templates:
            by_category[t.category] = by_category.get(t.category, 0) + 1

        # Count by rule type
        by_type: Dict[str, int] = {}
        for t in templates:
            by_type[t.rule_type] = by_type.get(t.rule_type, 0) + 1

        # Count by KSI category
        ksi_coverage: Dict[str, int] = {}
        for t in templates:
            for ksi_ref in t.applicable_ksi_refs:
                cat = ksi_ref.split('-')[1] if '-' in ksi_ref else 'OTHER'
                ksi_coverage[cat] = ksi_coverage.get(cat, 0) + 1

        return {
            'total_templates': len(templates),
            'by_category': by_category,
            'by_rule_type': by_type,
            'ksi_coverage': ksi_coverage,
            'categories': self.get_categories(),
        }


def get_validation_template_service() -> ValidationRuleTemplateService:
    """Get instance of ValidationRuleTemplateService."""
    return ValidationRuleTemplateService()
