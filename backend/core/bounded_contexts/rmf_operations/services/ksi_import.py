"""
FedRAMP 20x KSI Library Import Service

Parses the fedramp-20x-ksi.yaml library and creates KSIImplementation records
for a Cloud Service Offering.
"""

import re
import yaml
from pathlib import Path
from typing import Dict, List, Any, Optional
from uuid import UUID
import structlog

from django.conf import settings
from django.db import transaction

from ..aggregates.ksi_implementation import KSIImplementation
from ..aggregates.cloud_service_offering import CloudServiceOffering

logger = structlog.get_logger(__name__)


class KSILibraryParser:
    """
    Parses the FedRAMP 20x KSI library YAML.

    The library contains a framework definition with requirement_nodes
    representing the 11 KSI categories and 61 individual KSIs.
    """

    # Path to the KSI library YAML file
    LIBRARY_PATH = Path(settings.BASE_DIR) / 'library' / 'libraries' / 'fedramp-20x-ksi.yaml'

    def __init__(self, library_path: Path = None):
        """
        Initialize the parser.

        Args:
            library_path: Optional custom path to the KSI library YAML
        """
        self.library_path = library_path or self.LIBRARY_PATH
        self._library_data: Optional[Dict[str, Any]] = None
        self._framework_data: Optional[Dict[str, Any]] = None
        self._requirement_nodes: List[Dict[str, Any]] = []
        self._categories_cache: Optional[List[Dict[str, Any]]] = None
        self._requirements_cache: Optional[List[Dict[str, Any]]] = None

    def load_library(self) -> None:
        """Load and parse the KSI library YAML."""
        if not self.library_path.exists():
            raise FileNotFoundError(f"KSI library not found at {self.library_path}")

        with open(self.library_path, 'r', encoding='utf-8') as f:
            self._library_data = yaml.safe_load(f)

        # Extract framework and requirement nodes
        objects = self._library_data.get('objects', {})
        self._framework_data = objects.get('framework', {})
        self._requirement_nodes = self._framework_data.get('requirement_nodes', [])

        logger.info(
            "KSI library loaded",
            path=str(self.library_path),
            total_nodes=len(self._requirement_nodes)
        )

    def get_library_metadata(self) -> Dict[str, Any]:
        """Get library metadata (version, provider, etc.)."""
        if not self._library_data:
            self.load_library()

        return {
            'urn': self._library_data.get('urn'),
            'ref_id': self._library_data.get('ref_id'),
            'name': self._library_data.get('name'),
            'version': self._library_data.get('version'),
            'publication_date': self._library_data.get('publication_date'),
            'provider': self._library_data.get('provider'),
        }

    def get_implementation_groups(self) -> List[Dict[str, Any]]:
        """Get implementation group definitions (LOW, MOD)."""
        if not self._framework_data:
            self.load_library()

        return self._framework_data.get('implementation_groups_definition', [])

    def get_ksi_categories(self) -> List[Dict[str, Any]]:
        """
        Get all KSI category definitions (depth 1 nodes).

        Categories are the 11 thematic groupings:
        - AFR: Authorization by FedRAMP
        - CED: Cybersecurity Education
        - CMT: Change Management
        - CNA: Cloud Native Architecture
        - IAM: Identity and Access Management
        - INR: Incident Response
        - MLA: Monitoring, Logging, and Auditing
        - PIY: Policy
        - RPL: Recovery Planning
        - SVC: Service Configuration
        - TPR: Third-Party Risk
        """
        if self._categories_cache is not None:
            return self._categories_cache

        if not self._requirement_nodes:
            self.load_library()

        self._categories_cache = [
            node for node in self._requirement_nodes
            if node.get('depth') == 1
        ]

        return self._categories_cache

    def get_ksi_requirements(self, category_urn: str = None) -> List[Dict[str, Any]]:
        """
        Get all assessable KSI requirements (depth 2 nodes).

        These are the individual KSIs that must be implemented.

        Args:
            category_urn: Optional URN to filter by category

        Returns:
            List of KSI requirement nodes
        """
        if not self._requirement_nodes:
            self.load_library()

        requirements = [
            node for node in self._requirement_nodes
            if node.get('depth') == 2 and node.get('assessable', False)
        ]

        if category_urn:
            requirements = [
                req for req in requirements
                if req.get('parent_urn') == category_urn
            ]

        return requirements

    def get_ksi_by_ref_id(self, ref_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific KSI by reference ID.

        Args:
            ref_id: KSI reference ID (e.g., "KSI-AFR-01")

        Returns:
            KSI node dict or None if not found
        """
        if not self._requirement_nodes:
            self.load_library()

        for node in self._requirement_nodes:
            if node.get('ref_id') == ref_id:
                return node
        return None

    def get_ksi_by_urn(self, urn: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific KSI by URN.

        Args:
            urn: KSI URN

        Returns:
            KSI node dict or None if not found
        """
        if not self._requirement_nodes:
            self.load_library()

        for node in self._requirement_nodes:
            if node.get('urn') == urn:
                return node
        return None

    def get_impact_levels_for_ksi(self, ksi: Dict[str, Any]) -> List[str]:
        """
        Extract impact levels from implementation_groups.

        Args:
            ksi: KSI node dict

        Returns:
            List of impact level codes (e.g., ['LOW', 'MOD'])
        """
        return ksi.get('implementation_groups', [])

    def parse_nist_controls(self, ksi: Dict[str, Any]) -> List[str]:
        """
        Extract NIST control mappings from annotation.

        The annotation field contains text like:
        "Related controls: AC-1, AC-21, AT-1, AU-1, CA-1..."

        Args:
            ksi: KSI node dict

        Returns:
            List of NIST control IDs
        """
        annotation = ksi.get('annotation', '')
        if not annotation:
            return []

        # Pattern: "Related controls:" followed by comma-separated control IDs
        match = re.search(r'Related controls?:\s*([^\n]+)', annotation, re.IGNORECASE)
        if not match:
            return []

        controls_text = match.group(1)
        # Split by comma and clean up
        controls = [
            c.strip() for c in controls_text.split(',')
            if c.strip() and re.match(r'^[A-Z]{2,3}-\d+', c.strip())
        ]

        return controls

    def get_ksi_count_by_impact_level(self) -> Dict[str, int]:
        """
        Get count of KSIs per impact level.

        Returns:
            Dict with counts: {'LOW': 56, 'MOD': 61}
        """
        requirements = self.get_ksi_requirements()

        counts = {'LOW': 0, 'MOD': 0, 'HIGH': 0}
        for ksi in requirements:
            levels = self.get_impact_levels_for_ksi(ksi)
            for level in levels:
                if level in counts:
                    counts[level] += 1

        return counts

    def get_ksis_by_category(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get all KSIs grouped by category.

        Returns:
            Dict mapping category codes to list of KSIs
        """
        requirements = self.get_ksi_requirements()

        by_category: Dict[str, List[Dict[str, Any]]] = {}
        for ksi in requirements:
            category = self._extract_category(ksi.get('ref_id', ''))
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(ksi)

        return by_category

    def _extract_category(self, ref_id: str) -> str:
        """
        Extract category code from ref_id.

        Args:
            ref_id: KSI reference ID (e.g., "KSI-AFR-01")

        Returns:
            Category code (e.g., "AFR")
        """
        parts = ref_id.split('-')
        if len(parts) >= 2:
            return parts[1]
        return ''


class KSIImportService:
    """
    Service for importing KSI requirements to a Cloud Service Offering.

    Creates KSIImplementation records based on the FedRAMP 20x KSI library
    and the CSO's impact level.
    """

    def __init__(self, library_path: Path = None):
        """
        Initialize the import service.

        Args:
            library_path: Optional custom path to the KSI library
        """
        self.parser = KSILibraryParser(library_path)
        self.parser.load_library()

    @transaction.atomic
    def import_ksis_for_cso(
        self,
        cso_id: UUID,
        impact_level: str = None,
        categories: List[str] = None,
        skip_existing: bool = True,
        created_by: UUID = None
    ) -> List[KSIImplementation]:
        """
        Import KSI requirements for a Cloud Service Offering.

        Creates KSIImplementation records for all KSIs applicable to the
        CSO's impact level.

        Args:
            cso_id: The Cloud Service Offering ID
            impact_level: Override impact level (defaults to CSO's level)
            categories: Specific KSI categories to import (None = all)
            skip_existing: Skip KSIs that already exist (default True)
            created_by: User ID performing the import

        Returns:
            List of created KSIImplementation records
        """
        cso = CloudServiceOffering.objects.get(id=cso_id)
        target_impact = impact_level or cso.impact_level

        logger.info(
            "Starting KSI import",
            cso_id=str(cso_id),
            cso_name=cso.name,
            impact_level=target_impact,
            categories=categories
        )

        created_implementations = []
        skipped_count = 0
        requirements = self.parser.get_ksi_requirements()

        for ksi in requirements:
            # Check if KSI applies to this impact level
            impact_levels = self.parser.get_impact_levels_for_ksi(ksi)
            if not self._applies_to_impact_level(impact_levels, target_impact):
                continue

            # Check category filter
            category = self._extract_category(ksi.get('ref_id', ''))
            if categories and category not in categories:
                continue

            # Check if already imported
            if skip_existing and KSIImplementation.objects.filter(
                cloud_service_offering_id=cso_id,
                ksi_urn=ksi['urn']
            ).exists():
                skipped_count += 1
                continue

            # Parse NIST controls from annotation
            nist_controls = self.parser.parse_nist_controls(ksi)

            # Create KSI Implementation
            impl = KSIImplementation.create(
                cso_id=cso_id,
                ksi_urn=ksi['urn'],
                ksi_ref_id=ksi.get('ref_id', ''),
                ksi_category=category,
                ksi_name=ksi.get('name', ''),
                impact_levels=impact_levels,
                nist_controls=nist_controls,
                created_by=created_by
            )
            impl.save()
            created_implementations.append(impl)

        # Update CSO KSI metrics
        self._update_cso_metrics(cso)

        logger.info(
            "KSI import completed",
            cso_id=str(cso_id),
            imported_count=len(created_implementations),
            skipped_count=skipped_count,
            impact_level=target_impact
        )

        return created_implementations

    def get_import_preview(
        self,
        cso_id: UUID,
        impact_level: str = None,
        categories: List[str] = None
    ) -> Dict[str, Any]:
        """
        Preview what would be imported without creating records.

        Useful for showing the user what KSIs will be created before
        confirming the import.

        Args:
            cso_id: The Cloud Service Offering ID
            impact_level: Override impact level
            categories: Specific categories to include

        Returns:
            Preview data including KSI counts and details
        """
        cso = CloudServiceOffering.objects.get(id=cso_id)
        target_impact = impact_level or cso.impact_level

        requirements = self.parser.get_ksi_requirements()
        applicable = []
        already_imported = []

        for ksi in requirements:
            impact_levels = self.parser.get_impact_levels_for_ksi(ksi)
            if not self._applies_to_impact_level(impact_levels, target_impact):
                continue

            category = self._extract_category(ksi.get('ref_id', ''))
            if categories and category not in categories:
                continue

            ksi_data = {
                'ref_id': ksi.get('ref_id'),
                'urn': ksi.get('urn'),
                'name': ksi.get('name'),
                'category': category,
                'impact_levels': impact_levels,
                'nist_controls': self.parser.parse_nist_controls(ksi),
            }

            # Check if already exists
            if KSIImplementation.objects.filter(
                cloud_service_offering_id=cso_id,
                ksi_urn=ksi['urn']
            ).exists():
                already_imported.append(ksi_data)
            else:
                applicable.append(ksi_data)

        # Group by category
        by_category: Dict[str, List[Dict[str, Any]]] = {}
        for ksi in applicable:
            cat = ksi['category']
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(ksi)

        # Get category names
        category_names = {
            'AFR': 'Authorization by FedRAMP',
            'CED': 'Cybersecurity Education',
            'CMT': 'Change Management',
            'CNA': 'Cloud Native Architecture',
            'IAM': 'Identity and Access Management',
            'INR': 'Incident Response',
            'MLA': 'Monitoring, Logging, and Auditing',
            'PIY': 'Policy',
            'RPL': 'Recovery Planning',
            'SVC': 'Service Configuration',
            'TPR': 'Third-Party Risk',
        }

        return {
            'cso_id': str(cso_id),
            'cso_name': cso.name,
            'impact_level': target_impact,
            'total_to_import': len(applicable),
            'already_imported': len(already_imported),
            'by_category': {
                cat: {
                    'name': category_names.get(cat, cat),
                    'count': len(ksis),
                    'ksis': ksis
                }
                for cat, ksis in by_category.items()
            },
            'category_summary': [
                {
                    'code': cat,
                    'name': category_names.get(cat, cat),
                    'count': len(ksis)
                }
                for cat, ksis in sorted(by_category.items())
            ],
            'ksis': applicable,
            'library_metadata': self.parser.get_library_metadata(),
        }

    def get_available_categories(self) -> List[Dict[str, Any]]:
        """
        Get list of available KSI categories.

        Returns:
            List of category dicts with code, name, and KSI count
        """
        category_names = {
            'AFR': 'Authorization by FedRAMP',
            'CED': 'Cybersecurity Education',
            'CMT': 'Change Management',
            'CNA': 'Cloud Native Architecture',
            'IAM': 'Identity and Access Management',
            'INR': 'Incident Response',
            'MLA': 'Monitoring, Logging, and Auditing',
            'PIY': 'Policy',
            'RPL': 'Recovery Planning',
            'SVC': 'Service Configuration',
            'TPR': 'Third-Party Risk',
        }

        by_category = self.parser.get_ksis_by_category()

        return [
            {
                'code': cat,
                'name': category_names.get(cat, cat),
                'ksi_count': len(ksis),
                'ksi_refs': [ksi.get('ref_id') for ksi in ksis]
            }
            for cat, ksis in sorted(by_category.items())
        ]

    def _applies_to_impact_level(self, ksi_levels: List[str], target: str) -> bool:
        """
        Check if KSI applies to the target impact level.

        Higher impact levels include all KSIs from lower levels.

        Args:
            ksi_levels: List of impact levels the KSI applies to
            target: Target impact level (low, moderate, high)

        Returns:
            True if KSI applies to the target level
        """
        target_lower = target.lower()

        # Map target impact level to applicable KSI levels
        level_map = {
            'low': ['LOW', 'low'],
            'moderate': ['MOD', 'moderate', 'LOW', 'low'],
            'high': ['HIGH', 'high', 'MOD', 'moderate', 'LOW', 'low'],
        }

        applicable = level_map.get(target_lower, [])
        return any(level in applicable for level in ksi_levels)

    def _extract_category(self, ref_id: str) -> str:
        """Extract category from ref_id (e.g., 'KSI-AFR-01' -> 'AFR')."""
        parts = ref_id.split('-')
        if len(parts) >= 2:
            return parts[1]
        return ''

    def _update_cso_metrics(self, cso: CloudServiceOffering) -> None:
        """
        Update CSO KSI compliance metrics after import.

        Args:
            cso: CloudServiceOffering instance to update
        """
        impls = KSIImplementation.objects.filter(cloud_service_offering_id=cso.id)
        total = impls.count()
        compliant = impls.filter(compliance_status='compliant').count()
        automated = impls.filter(has_persistent_validation=True).count()

        validation_coverage = (automated / max(total, 1)) * 100

        cso.update_ksi_metrics(
            total=total,
            compliant=compliant,
            validation_coverage=validation_coverage
        )
        cso.save()

        logger.info(
            "CSO KSI metrics updated",
            cso_id=str(cso.id),
            total_ksis=total,
            compliant_ksis=compliant,
            validation_coverage=validation_coverage
        )


def import_ksis_for_cso(
    cso_id: UUID,
    impact_level: str = None,
    categories: List[str] = None,
    created_by: UUID = None
) -> List[KSIImplementation]:
    """
    Convenience function to import KSIs for a CSO.

    Args:
        cso_id: Cloud Service Offering ID
        impact_level: Override impact level
        categories: Specific categories to import
        created_by: User ID performing import

    Returns:
        List of created KSIImplementation records
    """
    service = KSIImportService()
    return service.import_ksis_for_cso(
        cso_id=cso_id,
        impact_level=impact_level,
        categories=categories,
        created_by=created_by
    )
