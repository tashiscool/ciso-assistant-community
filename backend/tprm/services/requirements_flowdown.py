"""
Requirements Flow-Down Service for TPRM.

Maps organizational compliance requirements (from compliance assessments
and frameworks) to vendor-specific requirements, tracks vendor compliance
against those flowed-down requirements, and generates gap reports.

Flow-down is the practice of passing contractual or regulatory requirements
from an organization to its vendors/suppliers to ensure end-to-end
compliance across the supply chain.
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Set

from django.db.models import Q
from django.utils import timezone


class RequirementMapping:
    """
    Represents a single requirement mapped from the organization
    to a vendor, including its compliance status.
    """

    def __init__(
        self,
        requirement_id: str,
        requirement_text: str,
        framework: str,
        category: str,
        criticality: str = "medium",
        vendor_status: str = "not_assessed",
        notes: str = "",
    ):
        self.requirement_id = requirement_id
        self.requirement_text = requirement_text
        self.framework = framework
        self.category = category
        self.criticality = criticality  # critical, high, medium, low
        self.vendor_status = vendor_status  # compliant, partial, non_compliant, not_assessed
        self.notes = notes

    def to_dict(self) -> Dict[str, Any]:
        return {
            "requirement_id": self.requirement_id,
            "requirement_text": self.requirement_text,
            "framework": self.framework,
            "category": self.category,
            "criticality": self.criticality,
            "vendor_status": self.vendor_status,
            "notes": self.notes,
        }


class RequirementsFlowdownService:
    """
    Service for mapping organizational compliance requirements to vendors
    and tracking vendor compliance against flowed-down requirements.
    """

    # Criticality levels for requirement prioritization
    CRITICALITY_LEVELS = ["critical", "high", "medium", "low"]

    # Vendor compliance statuses
    COMPLIANCE_STATUSES = ["compliant", "partial", "non_compliant", "not_assessed"]

    def map_requirements_to_vendor(
        self,
        org_assessment_id: str,
        vendor_entity_id: str,
        criticality_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Map organizational compliance requirements to vendor-specific requirements.

        Takes requirements from an organizational compliance assessment and
        creates a set of vendor-applicable requirements based on the vendor's
        role, the data they handle, and the services they provide.

        Args:
            org_assessment_id: UUID of the organizational ComplianceAssessment.
            vendor_entity_id: UUID of the vendor Entity.
            criticality_filter: Optional filter to only include requirements
                at or above this criticality level.

        Returns:
            List of mapped requirement dictionaries.
        """
        try:
            from core.models import ComplianceAssessment, RequirementAssessment
            from tprm.models import Entity, EntityAssessment, Solution
        except ImportError:
            # Return empty if models not available (e.g., during testing)
            return []

        # Load the organizational compliance assessment
        try:
            org_assessment = ComplianceAssessment.objects.get(id=org_assessment_id)
        except ComplianceAssessment.DoesNotExist:
            return []

        # Load the vendor entity and its assessment context
        try:
            vendor_entity = Entity.objects.get(id=vendor_entity_id)
        except Entity.DoesNotExist:
            return []

        # Determine vendor's role and data sensitivity
        vendor_context = self._build_vendor_context(vendor_entity)

        # Get all requirement assessments from the org compliance assessment
        requirement_assessments = RequirementAssessment.objects.filter(
            compliance_assessment=org_assessment
        ).select_related("requirement_node")

        mapped_requirements: List[Dict[str, Any]] = []

        for ra in requirement_assessments:
            req_node = ra.requirement_node
            if req_node is None:
                continue

            # Determine if this requirement is applicable to the vendor
            criticality = self._assess_requirement_criticality(
                req_node, vendor_context
            )

            # Apply criticality filter if specified
            if criticality_filter:
                filter_idx = self.CRITICALITY_LEVELS.index(criticality_filter)
                req_idx = self.CRITICALITY_LEVELS.index(criticality)
                if req_idx > filter_idx:
                    continue

            mapping = RequirementMapping(
                requirement_id=str(req_node.id),
                requirement_text=req_node.description or req_node.name or "",
                framework=str(org_assessment.framework) if hasattr(org_assessment, "framework") else "",
                category=req_node.parent_urn or "",
                criticality=criticality,
                vendor_status="not_assessed",
                notes="",
            )

            mapped_requirements.append(mapping.to_dict())

        return mapped_requirements

    def get_vendor_compliance_status(
        self,
        vendor_entity_id: str,
    ) -> Dict[str, Any]:
        """
        Get the overall compliance status of a vendor against all
        flowed-down requirements.

        Aggregates across all entity assessments and compliance assessments
        linked to the vendor to produce a summary view.

        Args:
            vendor_entity_id: UUID of the vendor Entity.

        Returns:
            Dictionary with compliance summary including counts by status,
            criticality breakdown, and overall compliance percentage.
        """
        try:
            from tprm.models import Entity, EntityAssessment
            from core.models import ComplianceAssessment, RequirementAssessment
        except ImportError:
            return self._empty_compliance_status()

        try:
            vendor_entity = Entity.objects.get(id=vendor_entity_id)
        except Entity.DoesNotExist:
            return self._empty_compliance_status()

        # Get all entity assessments for this vendor
        entity_assessments = EntityAssessment.objects.filter(
            entity=vendor_entity
        )

        total_requirements = 0
        compliant_count = 0
        partial_count = 0
        non_compliant_count = 0
        not_assessed_count = 0

        criticality_breakdown: Dict[str, Dict[str, int]] = {
            level: {"compliant": 0, "partial": 0, "non_compliant": 0, "not_assessed": 0}
            for level in self.CRITICALITY_LEVELS
        }

        framework_status: Dict[str, Dict[str, int]] = {}

        for ea in entity_assessments:
            # Check linked compliance assessment
            if ea.compliance_assessment:
                ca = ea.compliance_assessment
                framework_name = str(ca.framework) if hasattr(ca, "framework") else "Unknown"

                if framework_name not in framework_status:
                    framework_status[framework_name] = {
                        "total": 0,
                        "compliant": 0,
                        "partial": 0,
                        "non_compliant": 0,
                        "not_assessed": 0,
                    }

                req_assessments = RequirementAssessment.objects.filter(
                    compliance_assessment=ca
                )

                for ra in req_assessments:
                    total_requirements += 1
                    framework_status[framework_name]["total"] += 1

                    # Map RA status to our compliance categories
                    ra_status = getattr(ra, "status", None) or ""
                    mapped_status = self._map_ra_status(ra_status)

                    if mapped_status == "compliant":
                        compliant_count += 1
                        framework_status[framework_name]["compliant"] += 1
                    elif mapped_status == "partial":
                        partial_count += 1
                        framework_status[framework_name]["partial"] += 1
                    elif mapped_status == "non_compliant":
                        non_compliant_count += 1
                        framework_status[framework_name]["non_compliant"] += 1
                    else:
                        not_assessed_count += 1
                        framework_status[framework_name]["not_assessed"] += 1

        compliance_percentage = (
            round((compliant_count / total_requirements) * 100, 1)
            if total_requirements > 0
            else 0.0
        )

        return {
            "vendor_entity_id": vendor_entity_id,
            "vendor_name": vendor_entity.name,
            "total_requirements": total_requirements,
            "summary": {
                "compliant": compliant_count,
                "partial": partial_count,
                "non_compliant": non_compliant_count,
                "not_assessed": not_assessed_count,
            },
            "compliance_percentage": compliance_percentage,
            "criticality_breakdown": criticality_breakdown,
            "framework_status": framework_status,
            "entity_assessments_count": entity_assessments.count(),
            "last_assessed": (
                entity_assessments.order_by("-updated_at").first().updated_at.isoformat()
                if entity_assessments.exists()
                else None
            ),
        }

    def generate_gap_report(
        self,
        vendor_entity_id: str,
        include_recommendations: bool = True,
    ) -> Dict[str, Any]:
        """
        Generate a compliance gap report for a vendor.

        Identifies all requirements where the vendor is not fully compliant
        and produces a structured report with gaps categorized by criticality,
        framework, and optional remediation recommendations.

        Args:
            vendor_entity_id: UUID of the vendor Entity.
            include_recommendations: Whether to include remediation guidance.

        Returns:
            Gap report dictionary with categorized gaps and recommendations.
        """
        compliance_status = self.get_vendor_compliance_status(vendor_entity_id)

        try:
            from tprm.models import Entity, EntityAssessment
            from core.models import ComplianceAssessment, RequirementAssessment
        except ImportError:
            return self._empty_gap_report(vendor_entity_id)

        try:
            vendor_entity = Entity.objects.get(id=vendor_entity_id)
        except Entity.DoesNotExist:
            return self._empty_gap_report(vendor_entity_id)

        gaps: List[Dict[str, Any]] = []
        critical_gaps: List[Dict[str, Any]] = []
        high_gaps: List[Dict[str, Any]] = []
        medium_gaps: List[Dict[str, Any]] = []
        low_gaps: List[Dict[str, Any]] = []

        # Collect gaps from all entity assessments
        entity_assessments = EntityAssessment.objects.filter(entity=vendor_entity)

        for ea in entity_assessments:
            if not ea.compliance_assessment:
                continue

            ca = ea.compliance_assessment
            framework_name = str(ca.framework) if hasattr(ca, "framework") else "Unknown"

            req_assessments = RequirementAssessment.objects.filter(
                compliance_assessment=ca
            )

            for ra in req_assessments:
                ra_status = getattr(ra, "status", None) or ""
                mapped_status = self._map_ra_status(ra_status)

                if mapped_status in ("non_compliant", "partial", "not_assessed"):
                    req_node = ra.requirement_node
                    if req_node is None:
                        continue

                    vendor_context = self._build_vendor_context(vendor_entity)
                    criticality = self._assess_requirement_criticality(
                        req_node, vendor_context
                    )

                    gap_entry = {
                        "requirement_id": str(req_node.id),
                        "requirement_text": req_node.description or req_node.name or "",
                        "requirement_ref": getattr(req_node, "ref_id", "") or "",
                        "framework": framework_name,
                        "current_status": mapped_status,
                        "criticality": criticality,
                        "entity_assessment_id": str(ea.id),
                        "assessment_notes": getattr(ra, "observation", "") or "",
                    }

                    if include_recommendations:
                        gap_entry["recommendation"] = self._generate_recommendation(
                            mapped_status, criticality, req_node
                        )

                    gaps.append(gap_entry)

                    # Categorize by criticality
                    if criticality == "critical":
                        critical_gaps.append(gap_entry)
                    elif criticality == "high":
                        high_gaps.append(gap_entry)
                    elif criticality == "medium":
                        medium_gaps.append(gap_entry)
                    else:
                        low_gaps.append(gap_entry)

        return {
            "vendor_entity_id": vendor_entity_id,
            "vendor_name": vendor_entity.name,
            "report_generated_at": timezone.now().isoformat(),
            "compliance_summary": compliance_status["summary"],
            "compliance_percentage": compliance_status["compliance_percentage"],
            "total_gaps": len(gaps),
            "gaps_by_criticality": {
                "critical": len(critical_gaps),
                "high": len(high_gaps),
                "medium": len(medium_gaps),
                "low": len(low_gaps),
            },
            "critical_gaps": critical_gaps,
            "high_gaps": high_gaps,
            "medium_gaps": medium_gaps,
            "low_gaps": low_gaps,
            "all_gaps": gaps,
            "framework_status": compliance_status.get("framework_status", {}),
        }

    def get_flowdown_matrix(
        self,
        org_assessment_id: str,
        vendor_entity_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a requirements flow-down matrix showing which requirements
        apply to which vendors and their current compliance status.

        Useful for a dashboard view of supply chain compliance.

        Args:
            org_assessment_id: UUID of the organizational ComplianceAssessment.
            vendor_entity_ids: Optional list of vendor entity UUIDs to include.
                If None, includes all vendors with entity assessments.

        Returns:
            Matrix with requirements as rows, vendors as columns, and
            compliance status as cell values.
        """
        try:
            from tprm.models import Entity, EntityAssessment
            from core.models import ComplianceAssessment, RequirementAssessment
        except ImportError:
            return {"requirements": [], "vendors": [], "matrix": {}}

        try:
            org_assessment = ComplianceAssessment.objects.get(id=org_assessment_id)
        except ComplianceAssessment.DoesNotExist:
            return {"requirements": [], "vendors": [], "matrix": {}}

        # Get vendor entities
        if vendor_entity_ids:
            vendors = Entity.objects.filter(id__in=vendor_entity_ids)
        else:
            # Get all vendors with entity assessments linked to this compliance assessment
            ea_ids = EntityAssessment.objects.filter(
                compliance_assessment=org_assessment
            ).values_list("entity_id", flat=True)
            vendors = Entity.objects.filter(id__in=ea_ids)

        # Get requirements
        req_assessments = RequirementAssessment.objects.filter(
            compliance_assessment=org_assessment
        ).select_related("requirement_node")

        requirements = []
        for ra in req_assessments:
            if ra.requirement_node:
                requirements.append({
                    "id": str(ra.requirement_node.id),
                    "text": ra.requirement_node.description or ra.requirement_node.name or "",
                    "ref": getattr(ra.requirement_node, "ref_id", "") or "",
                })

        vendor_list = [
            {"id": str(v.id), "name": v.name}
            for v in vendors
        ]

        # Build matrix: requirement_id -> vendor_id -> status
        matrix: Dict[str, Dict[str, str]] = {}
        for req in requirements:
            matrix[req["id"]] = {}
            for vendor in vendor_list:
                matrix[req["id"]][vendor["id"]] = "not_assessed"

        # Fill in actual statuses from entity assessments
        for vendor in vendors:
            vendor_eas = EntityAssessment.objects.filter(
                entity=vendor,
                compliance_assessment=org_assessment,
            )
            for ea in vendor_eas:
                vendor_req_assessments = RequirementAssessment.objects.filter(
                    compliance_assessment=ea.compliance_assessment
                )
                for ra in vendor_req_assessments:
                    if ra.requirement_node:
                        req_id = str(ra.requirement_node.id)
                        vendor_id = str(vendor.id)
                        if req_id in matrix and vendor_id in matrix[req_id]:
                            ra_status = getattr(ra, "status", None) or ""
                            matrix[req_id][vendor_id] = self._map_ra_status(ra_status)

        return {
            "org_assessment_id": org_assessment_id,
            "requirements": requirements,
            "vendors": vendor_list,
            "matrix": matrix,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_vendor_context(self, vendor_entity) -> Dict[str, Any]:
        """Build context about the vendor for requirement applicability assessment."""
        try:
            from tprm.models import Solution

            solutions = Solution.objects.filter(provider_entity=vendor_entity)
            has_data_storage = any(s.storage_of_data for s in solutions)
            criticality_max = max(
                (s.criticality for s in solutions), default=0
            )
        except Exception:
            has_data_storage = False
            criticality_max = 0

        return {
            "entity_id": str(vendor_entity.id),
            "entity_name": vendor_entity.name,
            "has_data_storage": has_data_storage,
            "max_solution_criticality": criticality_max,
            "default_maturity": getattr(vendor_entity, "default_maturity", 1),
            "default_trust": getattr(vendor_entity, "default_trust", 1),
        }

    def _assess_requirement_criticality(
        self, requirement_node, vendor_context: Dict[str, Any]
    ) -> str:
        """
        Assess the criticality of a requirement for a specific vendor.

        Higher criticality is assigned when:
        - The vendor stores data (data security requirements become critical)
        - The vendor's solution criticality is high
        - The requirement relates to fundamental security controls
        """
        base_criticality = "medium"

        # Increase criticality for data-handling vendors
        if vendor_context.get("has_data_storage"):
            base_criticality = "high"

        # Increase criticality for high-criticality solutions
        if vendor_context.get("max_solution_criticality", 0) >= 3:
            base_criticality = "critical"
        elif vendor_context.get("max_solution_criticality", 0) >= 2:
            if base_criticality in ("medium", "low"):
                base_criticality = "high"

        return base_criticality

    @staticmethod
    def _map_ra_status(ra_status: str) -> str:
        """Map a RequirementAssessment status to our compliance status categories."""
        status_lower = ra_status.lower() if ra_status else ""

        compliant_statuses = {"compliant", "conform", "met", "implemented", "fully_implemented"}
        partial_statuses = {"partially_compliant", "partial", "partially_met", "partially_implemented"}
        non_compliant_statuses = {"non_compliant", "not_met", "not_implemented", "non_conform"}

        if status_lower in compliant_statuses:
            return "compliant"
        elif status_lower in partial_statuses:
            return "partial"
        elif status_lower in non_compliant_statuses:
            return "non_compliant"
        return "not_assessed"

    @staticmethod
    def _generate_recommendation(
        status: str, criticality: str, requirement_node
    ) -> str:
        """Generate a remediation recommendation based on gap characteristics."""
        req_text = (
            requirement_node.description or requirement_node.name or "this requirement"
        )[:100]

        if status == "non_compliant":
            if criticality in ("critical", "high"):
                return (
                    f"Immediate action required: Implement controls to address "
                    f"'{req_text}'. Consider requesting a formal remediation "
                    f"plan with defined milestones from the vendor."
                )
            return (
                f"Action needed: Work with the vendor to implement controls "
                f"for '{req_text}'. Include in the next assessment cycle."
            )
        elif status == "partial":
            return (
                f"Improvement needed: The vendor partially meets '{req_text}'. "
                f"Request documentation of current controls and a plan to "
                f"achieve full compliance."
            )
        else:  # not_assessed
            return (
                f"Assessment required: Evaluate vendor compliance with "
                f"'{req_text}' through questionnaire or evidence review."
            )

    @staticmethod
    def _empty_compliance_status() -> Dict[str, Any]:
        return {
            "vendor_entity_id": "",
            "vendor_name": "",
            "total_requirements": 0,
            "summary": {
                "compliant": 0,
                "partial": 0,
                "non_compliant": 0,
                "not_assessed": 0,
            },
            "compliance_percentage": 0.0,
            "criticality_breakdown": {},
            "framework_status": {},
            "entity_assessments_count": 0,
            "last_assessed": None,
        }

    @staticmethod
    def _empty_gap_report(vendor_entity_id: str) -> Dict[str, Any]:
        return {
            "vendor_entity_id": vendor_entity_id,
            "vendor_name": "",
            "report_generated_at": timezone.now().isoformat(),
            "compliance_summary": {
                "compliant": 0,
                "partial": 0,
                "non_compliant": 0,
                "not_assessed": 0,
            },
            "compliance_percentage": 0.0,
            "total_gaps": 0,
            "gaps_by_criticality": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
            },
            "critical_gaps": [],
            "high_gaps": [],
            "medium_gaps": [],
            "low_gaps": [],
            "all_gaps": [],
            "framework_status": {},
        }
