"""
DORA Export Utilities - MIT Licensed

Generate DORA (Digital Operational Resilience Act) compliance reports.
Copyright (c) 2026 Tash
"""

import csv
import io
import json
import zipfile
from datetime import datetime
from typing import Dict, List, Any, BinaryIO

from .models import Entity, Solution, Contract, EntityAssessment


def generate_dora_roi_export(organization_id: str, main_entity_name: str = "") -> BinaryIO:
    """
    Generate DORA Register of Information (ROI) export.

    Returns a ZIP file containing all required CSV files for DORA compliance.
    """
    # Create in-memory ZIP file
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Generate all required files
        files = {
            'B_01_01_MainEntity.csv': generate_b_01_01_main_entity(organization_id, main_entity_name),
            'B_01_02_EntityRegister.csv': generate_b_01_02_entity_register(organization_id),
            'B_01_03_BranchesRegister.csv': generate_b_01_03_branches_register(organization_id),
            'B_02_01_ContractualArrangements.csv': generate_b_02_01_contractual_arrangements(organization_id),
            'B_02_02_SubstitutionAnalysis.csv': generate_b_02_02_substitution_analysis(organization_id),
            'B_03_01_ICTProviders.csv': generate_b_03_01_ict_providers(organization_id),
            'B_04_01_ICTServices.csv': generate_b_04_01_ict_services(organization_id),
            'B_05_01_ProviderChain.csv': generate_b_05_01_provider_chain(organization_id),
            'B_06_01_CriticalFunctions.csv': generate_b_06_01_critical_functions(organization_id),
            'B_07_01_ICTAssessment.csv': generate_b_07_01_ict_assessment(organization_id),
            'FilingIndicators.csv': generate_filing_indicators(),
            'parameters.csv': generate_parameters(organization_id),
        }

        for filename, content in files.items():
            zf.writestr(filename, content)

        # Add metadata files
        meta_inf = {
            'reportPackage': {
                'version': '1.0',
                'generatedAt': datetime.now().isoformat(),
                'format': 'DORA-ROI',
            }
        }
        zf.writestr('META-INF/reportPackage.json', json.dumps(meta_inf, indent=2))

        report_info = {
            'reportType': 'DORA_ROI',
            'version': '2024.1',
            'generatedAt': datetime.now().isoformat(),
        }
        zf.writestr('reports/report.json', json.dumps(report_info, indent=2))

    zip_buffer.seek(0)
    return zip_buffer


def generate_b_01_01_main_entity(organization_id: str, main_entity_name: str) -> str:
    """Generate B.01.01 - Main Entity Information."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'EntityName', 'EntityType', 'LEI', 'Country', 'Currency',
        'CompetentAuthority', 'TotalAssets', 'ReportingDate'
    ]
    writer.writerow(headers)

    # Get main entity data (typically the organization itself)
    writer.writerow([
        main_entity_name or 'Main Entity',
        'FINANCIAL_ENTITY',
        '',  # LEI
        '',  # Country
        'EUR',
        '',  # Competent Authority
        '',  # Total Assets
        datetime.now().strftime('%Y-%m-%d'),
    ])

    return output.getvalue()


def generate_b_01_02_entity_register(organization_id: str) -> str:
    """Generate B.01.02 - Entity Register."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'EntityID', 'EntityName', 'EntityType', 'LEI', 'ParentEntityID',
        'Country', 'IsActive', 'DORAEntityType', 'DORAHierarchy'
    ]
    writer.writerow(headers)

    entities = Entity.objects.filter(organization_id=organization_id)

    for entity in entities:
        lei = entity.legal_identifiers.get('lei', '') if entity.legal_identifiers else ''
        writer.writerow([
            str(entity.id),
            entity.name,
            entity.entity_type,
            lei,
            str(entity.parent_id) if entity.parent_id else '',
            entity.country,
            'Yes' if entity.is_active else 'No',
            entity.dora_entity_type,
            entity.dora_hierarchy,
        ])

    return output.getvalue()


def generate_b_01_03_branches_register(organization_id: str) -> str:
    """Generate B.01.03 - Branches Register."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'BranchID', 'ParentEntityID', 'BranchName', 'Country', 'City', 'IsActive'
    ]
    writer.writerow(headers)

    # Get entities that are subsidiaries
    branches = Entity.objects.filter(
        organization_id=organization_id,
        parent__isnull=False
    )

    for branch in branches:
        writer.writerow([
            str(branch.id),
            str(branch.parent_id),
            branch.name,
            branch.country,
            branch.city,
            'Yes' if branch.is_active else 'No',
        ])

    return output.getvalue()


def generate_b_02_01_contractual_arrangements(organization_id: str) -> str:
    """Generate B.02.01 - Contractual Arrangements."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'ContractID', 'ContractName', 'ProviderID', 'ProviderName',
        'StartDate', 'EndDate', 'Status', 'AnnualExpense', 'Currency',
        'NoticePeriodDays', 'GoverningLaw', 'IsIntragroup'
    ]
    writer.writerow(headers)

    # Get contracts for entities in this organization
    entity_ids = Entity.objects.filter(
        organization_id=organization_id
    ).values_list('id', flat=True)

    contracts = Contract.objects.filter(provider_id__in=entity_ids)

    for contract in contracts:
        writer.writerow([
            str(contract.id),
            contract.name,
            str(contract.provider_id),
            contract.provider.name,
            contract.start_date.strftime('%Y-%m-%d') if contract.start_date else '',
            contract.end_date.strftime('%Y-%m-%d') if contract.end_date else '',
            contract.status,
            str(contract.annual_expense) if contract.annual_expense else '',
            contract.currency,
            str(contract.notice_period_days) if contract.notice_period_days else '',
            contract.governing_law_country,
            'Yes' if contract.is_intragroup else 'No',
        ])

    return output.getvalue()


def generate_b_02_02_substitution_analysis(organization_id: str) -> str:
    """Generate B.02.02 - Substitution Analysis."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'SolutionID', 'SolutionName', 'ProviderID', 'Criticality',
        'Substitutability', 'NonSubstitutabilityReason', 'HasExitPlan',
        'ReintegrationPossible', 'AlternativeProviders'
    ]
    writer.writerow(headers)

    entity_ids = Entity.objects.filter(
        organization_id=organization_id
    ).values_list('id', flat=True)

    solutions = Solution.objects.filter(provider_id__in=entity_ids)

    for solution in solutions:
        writer.writerow([
            str(solution.id),
            solution.name,
            str(solution.provider_id),
            solution.criticality,
            solution.substitutability,
            solution.non_substitutability_reason,
            'Yes' if solution.has_exit_plan else 'No',
            'Yes' if solution.reintegration_possibility else 'No',
            solution.alternative_providers,
        ])

    return output.getvalue()


def generate_b_03_01_ict_providers(organization_id: str) -> str:
    """Generate B.03.01 - ICT Service Providers."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'ProviderID', 'ProviderName', 'EntityType', 'Country', 'LEI',
        'DORAEntityType', 'ProviderPersonType', 'CompetentAuthority'
    ]
    writer.writerow(headers)

    # Get ICT providers
    providers = Entity.objects.filter(
        organization_id=organization_id,
        dora_entity_type__in=['ict_third_party', 'critical_ict']
    )

    for provider in providers:
        lei = provider.legal_identifiers.get('lei', '') if provider.legal_identifiers else ''
        writer.writerow([
            str(provider.id),
            provider.name,
            provider.entity_type,
            provider.country,
            lei,
            provider.dora_entity_type,
            provider.provider_person_type,
            provider.competent_authority,
        ])

    return output.getvalue()


def generate_b_04_01_ict_services(organization_id: str) -> str:
    """Generate B.04.01 - ICT Services."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'ServiceID', 'ServiceName', 'ProviderID', 'ICTServiceType',
        'StoresData', 'DataStorageLocations', 'DataProcessingLocations',
        'Sensitiveness', 'RelianceLevel', 'Criticality'
    ]
    writer.writerow(headers)

    entity_ids = Entity.objects.filter(
        organization_id=organization_id
    ).values_list('id', flat=True)

    solutions = Solution.objects.filter(provider_id__in=entity_ids)

    for solution in solutions:
        writer.writerow([
            str(solution.id),
            solution.name,
            str(solution.provider_id),
            solution.ict_service_type,
            'Yes' if solution.storage_of_data else 'No',
            ','.join(solution.data_storage_locations or []),
            ','.join(solution.data_processing_locations or []),
            solution.sensitiveness,
            solution.reliance_level,
            solution.criticality,
        ])

    return output.getvalue()


def generate_b_05_01_provider_chain(organization_id: str) -> str:
    """Generate B.05.01 - Provider Supply Chain."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'ProviderID', 'ProviderName', 'ParentProviderID', 'ChainLevel',
        'ServiceDescription', 'DORAHierarchy'
    ]
    writer.writerow(headers)

    entities = Entity.objects.filter(
        organization_id=organization_id,
        parent__isnull=False
    )

    for entity in entities:
        # Calculate chain level
        chain_level = 1
        current = entity.parent
        while current:
            chain_level += 1
            current = current.parent

        writer.writerow([
            str(entity.id),
            entity.name,
            str(entity.parent_id) if entity.parent_id else '',
            chain_level,
            entity.description[:200] if entity.description else '',
            entity.dora_hierarchy,
        ])

    return output.getvalue()


def generate_b_06_01_critical_functions(organization_id: str) -> str:
    """Generate B.06.01 - Critical Functions Register."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'FunctionID', 'FunctionName', 'SolutionID', 'ProviderID',
        'Criticality', 'ImpactIfDiscontinued'
    ]
    writer.writerow(headers)

    # Get critical solutions
    entity_ids = Entity.objects.filter(
        organization_id=organization_id
    ).values_list('id', flat=True)

    critical_solutions = Solution.objects.filter(
        provider_id__in=entity_ids,
        criticality__in=['high', 'critical']
    )

    for idx, solution in enumerate(critical_solutions, 1):
        writer.writerow([
            f'CF-{idx:04d}',
            solution.name,
            str(solution.id),
            str(solution.provider_id),
            solution.criticality,
            solution.discontinuing_impact[:500] if solution.discontinuing_impact else '',
        ])

    return output.getvalue()


def generate_b_07_01_ict_assessment(organization_id: str) -> str:
    """Generate B.07.01 - ICT Third-Party Assessment."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        'AssessmentID', 'EntityID', 'EntityName', 'AssessmentDate',
        'Criticality', 'Dependency', 'Penetration', 'Maturity', 'Trust',
        'Conclusion', 'NextAssessmentDate'
    ]
    writer.writerow(headers)

    entity_ids = Entity.objects.filter(
        organization_id=organization_id
    ).values_list('id', flat=True)

    assessments = EntityAssessment.objects.filter(entity_id__in=entity_ids)

    for assessment in assessments:
        writer.writerow([
            str(assessment.id),
            str(assessment.entity_id),
            assessment.entity.name,
            assessment.assessment_date.strftime('%Y-%m-%d') if assessment.assessment_date else '',
            assessment.criticality,
            assessment.dependency,
            assessment.penetration,
            assessment.maturity,
            assessment.trust,
            assessment.conclusion,
            assessment.next_assessment_date.strftime('%Y-%m-%d') if assessment.next_assessment_date else '',
        ])

    return output.getvalue()


def generate_filing_indicators() -> str:
    """Generate Filing Indicators file."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = ['Indicator', 'Value', 'Description']
    writer.writerow(headers)

    indicators = [
        ('ROI_VERSION', '2024.1', 'Register of Information version'),
        ('REPORTING_PERIOD', datetime.now().strftime('%Y'), 'Reporting period'),
        ('SUBMISSION_TYPE', 'INITIAL', 'Initial or Update submission'),
        ('CURRENCY', 'EUR', 'Reporting currency'),
    ]

    for indicator in indicators:
        writer.writerow(indicator)

    return output.getvalue()


def generate_parameters(organization_id: str) -> str:
    """Generate Parameters file."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = ['Parameter', 'Value']
    writer.writerow(headers)

    parameters = [
        ('OrganizationID', organization_id),
        ('GeneratedAt', datetime.now().isoformat()),
        ('Format', 'DORA-ROI-CSV'),
        ('Version', '1.0'),
    ]

    for param in parameters:
        writer.writerow(param)

    return output.getvalue()


# Aliases for test compatibility
generate_b_02_01_ict_services = generate_b_04_01_ict_services
generate_b_03_01_contracts = generate_b_02_01_contractual_arrangements
generate_b_04_01_subcontracting = generate_b_05_01_provider_chain


# Utility functions
def format_date_for_csv(date_obj) -> str:
    """Format a date for CSV output (YYYY-MM-DD)."""
    if date_obj is None:
        return ""
    if hasattr(date_obj, 'strftime'):
        return date_obj.strftime('%Y-%m-%d')
    return str(date_obj)


def format_bool_for_csv(value) -> str:
    """Format a boolean for CSV output (Y/N)."""
    if value is None:
        return ""
    return "Y" if value else "N"


def escape_csv_value(value: str) -> str:
    """Escape special characters in CSV values."""
    if value is None:
        return ""
    if ',' in value or '"' in value or '\n' in value:
        return '"' + value.replace('"', '""') + '"'
    return value


def validate_lei(lei: str) -> bool:
    """Validate LEI (Legal Entity Identifier) format."""
    if not lei:
        return False
    if len(lei) != 20:
        return False
    return lei.isalnum()


# ISO 3166-1 alpha-2 country codes (subset)
VALID_COUNTRY_CODES = {
    'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
    'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
    'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'GB', 'US', 'CH',
    'NO', 'IS', 'LI',
}


def validate_country_code(code: str) -> bool:
    """Validate ISO 3166-1 alpha-2 country code."""
    if not code:
        return False
    return code.upper() in VALID_COUNTRY_CODES
