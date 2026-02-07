"""
MCP Tools for CISO Assistant.

Each tool is a function that accepts keyword arguments and returns a dict.
The function docstring serves as the tool description shown to AI clients.
The ``input_schema`` attribute defines the JSON Schema for accepted arguments.

All Django model imports happen inside function bodies to avoid circular
imports and to ensure ``django.setup()`` has already been called by the
server before any ORM access.
"""
import logging
import uuid as _uuid
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _valid_uuid(value: str) -> bool:
    """Return True if *value* is a valid UUID string."""
    try:
        _uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False


def _serialize_assessment(assessment) -> dict:
    """Return a lightweight dict representation of a ComplianceAssessment."""
    return {
        "id": str(assessment.id),
        "name": assessment.name,
        "version": assessment.version,
        "status": assessment.status,
        "framework": str(assessment.framework),
        "framework_id": str(assessment.framework_id),
        "perimeter": str(assessment.perimeter) if assessment.perimeter else None,
        "created_at": str(assessment.created_at),
        "updated_at": str(assessment.updated_at),
    }


# ---------------------------------------------------------------------------
# get_compliance_status
# ---------------------------------------------------------------------------

def get_compliance_status(assessment_id: str = None, framework: str = None) -> dict:
    """Get the compliance status for an assessment or all assessments.

    Returns compliance percentages, control counts, and status breakdown
    for each matching compliance assessment.
    """
    from core.models import ComplianceAssessment, RequirementAssessment

    try:
        qs = ComplianceAssessment.objects.select_related("framework", "perimeter")

        if assessment_id and _valid_uuid(assessment_id):
            qs = qs.filter(id=assessment_id)
        if framework:
            qs = qs.filter(framework__name__icontains=framework)

        results = []
        for ca in qs[:50]:
            # Status counts
            status_counts = {}
            for count, status in ca.get_requirements_status_count():
                status_counts[str(status)] = count

            # Result counts
            result_counts = {}
            for count, result in ca.get_requirements_result_count():
                result_counts[str(result)] = count

            total = RequirementAssessment.objects.filter(
                compliance_assessment=ca
            ).count()

            results.append({
                **_serialize_assessment(ca),
                "progress_percentage": ca.get_progress(),
                "global_score": ca.get_global_score(),
                "total_requirements": total,
                "status_breakdown": status_counts,
                "result_breakdown": result_counts,
            })

        return {"assessments": results, "count": len(results)}
    except Exception as e:
        logger.exception("get_compliance_status failed")
        return {"error": str(e)}


get_compliance_status.input_schema = {
    "type": "object",
    "properties": {
        "assessment_id": {
            "type": "string",
            "description": "UUID of a specific compliance assessment",
        },
        "framework": {
            "type": "string",
            "description": "Filter by framework name (case-insensitive substring match)",
        },
    },
}


# ---------------------------------------------------------------------------
# get_risk_scenarios
# ---------------------------------------------------------------------------

def get_risk_scenarios(risk_assessment_id: str = None, min_severity: str = None) -> dict:
    """List risk scenarios with their current scores and treatment status.

    Optionally filter by risk assessment ID or minimum severity level
    (0-based integer from the risk matrix).
    """
    from core.models import RiskScenario

    try:
        qs = RiskScenario.objects.select_related(
            "risk_assessment", "risk_assessment__risk_matrix"
        )

        if risk_assessment_id and _valid_uuid(risk_assessment_id):
            qs = qs.filter(risk_assessment_id=risk_assessment_id)

        if min_severity is not None:
            try:
                min_val = int(min_severity)
                qs = qs.filter(current_level__gte=min_val)
            except (ValueError, TypeError):
                pass

        scenarios = []
        for rs in qs[:100]:
            try:
                current_risk = rs.get_current_risk()
            except Exception:
                current_risk = {"name": "--", "value": rs.current_level}

            try:
                residual_risk = rs.get_residual_risk()
            except Exception:
                residual_risk = {"name": "--", "value": rs.residual_level}

            scenarios.append({
                "id": str(rs.id),
                "name": rs.name,
                "ref_id": rs.ref_id,
                "description": rs.description or "",
                "treatment": rs.treatment,
                "current_level": rs.current_level,
                "current_risk": current_risk,
                "residual_level": rs.residual_level,
                "residual_risk": residual_risk,
                "current_proba": rs.current_proba,
                "current_impact": rs.current_impact,
                "risk_assessment": str(rs.risk_assessment),
                "risk_assessment_id": str(rs.risk_assessment_id),
                "within_tolerance": rs.within_tolerance,
            })

        return {"scenarios": scenarios, "count": len(scenarios)}
    except Exception as e:
        logger.exception("get_risk_scenarios failed")
        return {"error": str(e)}


get_risk_scenarios.input_schema = {
    "type": "object",
    "properties": {
        "risk_assessment_id": {
            "type": "string",
            "description": "UUID of a specific risk assessment to filter scenarios",
        },
        "min_severity": {
            "type": "string",
            "description": "Minimum current risk level (0-based integer from the risk matrix)",
        },
    },
}


# ---------------------------------------------------------------------------
# create_poam_item
# ---------------------------------------------------------------------------

def create_poam_item(
    title: str,
    description: str,
    control_id: str = None,
    risk_level: str = "moderate",
    remediation_plan: str = "",
) -> dict:
    """Create a new POA&M (Plan of Action and Milestones) item.

    Returns the created item's ID and details.  The item is created in
    *draft* status.
    """
    from poam.models.poam_item import POAMItem
    from iam.models import Folder
    import uuid

    try:
        # Generate a unique weakness ID
        weakness_id = f"MCP-{uuid.uuid4().hex[:8].upper()}"

        # Use the root folder's ID as the system_group_id fallback
        root_folder = Folder.get_root_folder()
        system_group_id = root_folder.id if root_folder else uuid.uuid4()

        item = POAMItem()
        item.create_poam_item(
            weakness_id=weakness_id,
            title=title,
            description=description,
            system_group_id=system_group_id,
            risk_level=risk_level,
            source_type="manual",
        )

        if control_id:
            item.control_id = control_id
        if remediation_plan:
            item.remediation_plan = remediation_plan

        item.save()

        return {
            "id": str(item.id),
            "weakness_id": item.weakness_id,
            "title": item.title,
            "status": item.status,
            "risk_level": item.risk_level,
            "control_id": item.control_id,
            "created_at": str(item.created_at),
        }
    except Exception as e:
        logger.exception("create_poam_item failed")
        return {"error": str(e)}


create_poam_item.input_schema = {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "description": "Title of the POA&M item",
        },
        "description": {
            "type": "string",
            "description": "Detailed description of the weakness",
        },
        "control_id": {
            "type": "string",
            "description": "Associated security control identifier (e.g., AC-2, IA-5)",
        },
        "risk_level": {
            "type": "string",
            "enum": ["very_low", "low", "moderate", "high", "very_high"],
            "description": "Risk/severity level (default: moderate)",
        },
        "remediation_plan": {
            "type": "string",
            "description": "Detailed remediation plan text",
        },
    },
    "required": ["title", "description"],
}


# ---------------------------------------------------------------------------
# search_evidence
# ---------------------------------------------------------------------------

def search_evidence(query: str, control_id: str = None, max_results: int = 20) -> dict:
    """Search the evidence repository by keyword or control ID.

    Searches evidence name, description, and related applied-control names.
    """
    from core.models import Evidence
    from django.db.models import Q

    try:
        qs = Evidence.objects.all()

        if query:
            qs = qs.filter(
                Q(name__icontains=query) | Q(description__icontains=query)
            )

        if control_id and _valid_uuid(control_id):
            qs = qs.filter(applied_controls__id=control_id)
        elif control_id:
            qs = qs.filter(
                Q(applied_controls__name__icontains=control_id)
                | Q(applied_controls__ref_id__icontains=control_id)
            )

        qs = qs.distinct()

        evidences = []
        for ev in qs[:max_results]:
            applied_controls = list(
                ev.applied_controls.values_list("name", flat=True)[:5]
            )
            evidences.append({
                "id": str(ev.id),
                "name": ev.name,
                "description": ev.description or "",
                "status": ev.status,
                "filename": ev.filename(),
                "size": ev.get_size(),
                "expiry_date": str(ev.expiry_date) if ev.expiry_date else None,
                "applied_controls": applied_controls,
                "created_at": str(ev.created_at),
            })

        return {"evidences": evidences, "count": len(evidences)}
    except Exception as e:
        logger.exception("search_evidence failed")
        return {"error": str(e)}


search_evidence.input_schema = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "Search keyword (matched against name and description)",
        },
        "control_id": {
            "type": "string",
            "description": "Filter by applied control UUID or name/ref_id substring",
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum number of results to return (default: 20)",
        },
    },
    "required": ["query"],
}


# ---------------------------------------------------------------------------
# get_control_status
# ---------------------------------------------------------------------------

def get_control_status(control_id: str = None, assessment_id: str = None) -> dict:
    """Get implementation status for applied controls.

    Filter by a specific control UUID or by the compliance assessment
    that references them.
    """
    from core.models import AppliedControl, RequirementAssessment
    from django.db.models import Q

    try:
        qs = AppliedControl.objects.select_related("reference_control")

        if control_id and _valid_uuid(control_id):
            qs = qs.filter(id=control_id)
        elif control_id:
            qs = qs.filter(
                Q(name__icontains=control_id) | Q(ref_id__icontains=control_id)
            )

        if assessment_id and _valid_uuid(assessment_id):
            ra_ids = RequirementAssessment.objects.filter(
                compliance_assessment_id=assessment_id
            ).values_list("applied_controls", flat=True)
            qs = qs.filter(id__in=ra_ids)

        controls = []
        for ac in qs.distinct()[:100]:
            ref_ctrl = ac.reference_control
            controls.append({
                "id": str(ac.id),
                "name": ac.name,
                "ref_id": ac.ref_id,
                "description": ac.description or "",
                "status": ac.status,
                "category": ac.category,
                "csf_function": ac.csf_function,
                "priority": ac.priority,
                "effort": ac.effort,
                "eta": str(ac.eta) if ac.eta else None,
                "expiry_date": str(ac.expiry_date) if ac.expiry_date else None,
                "reference_control": str(ref_ctrl) if ref_ctrl else None,
                "evidence_count": ac.evidences.count(),
                "created_at": str(ac.created_at),
            })

        # Summary statistics
        status_summary = {}
        for item in controls:
            st = item["status"]
            status_summary[st] = status_summary.get(st, 0) + 1

        return {
            "controls": controls,
            "count": len(controls),
            "status_summary": status_summary,
        }
    except Exception as e:
        logger.exception("get_control_status failed")
        return {"error": str(e)}


get_control_status.input_schema = {
    "type": "object",
    "properties": {
        "control_id": {
            "type": "string",
            "description": "UUID or name/ref_id of a specific applied control",
        },
        "assessment_id": {
            "type": "string",
            "description": "UUID of a compliance assessment to get all its linked controls",
        },
    },
}


# ---------------------------------------------------------------------------
# score_vendor
# ---------------------------------------------------------------------------

def score_vendor(entity_assessment_id: str) -> dict:
    """Get vendor risk scoring details for an entity assessment.

    Returns the entity assessment scores including criticality, penetration,
    dependency, maturity, trust, and the overall conclusion.
    """
    from tprm.models import EntityAssessment

    try:
        if not _valid_uuid(entity_assessment_id):
            return {"error": "Invalid entity_assessment_id UUID"}

        ea = EntityAssessment.objects.select_related(
            "entity", "perimeter", "compliance_assessment"
        ).get(id=entity_assessment_id)

        solutions = list(
            ea.solutions.values("id", "name", "criticality", "is_active")[:20]
        )
        for s in solutions:
            s["id"] = str(s["id"])

        return {
            "id": str(ea.id),
            "name": ea.name,
            "status": ea.status,
            "entity": {
                "id": str(ea.entity_id),
                "name": str(ea.entity),
            },
            "conclusion": ea.conclusion,
            "criticality": ea.criticality,
            "penetration": ea.penetration,
            "dependency": ea.dependency,
            "maturity": ea.maturity,
            "trust": ea.trust,
            "compliance_assessment_id": str(ea.compliance_assessment_id)
            if ea.compliance_assessment_id
            else None,
            "solutions": solutions,
            "created_at": str(ea.created_at),
        }
    except EntityAssessment.DoesNotExist:
        return {"error": f"Entity assessment not found: {entity_assessment_id}"}
    except Exception as e:
        logger.exception("score_vendor failed")
        return {"error": str(e)}


score_vendor.input_schema = {
    "type": "object",
    "properties": {
        "entity_assessment_id": {
            "type": "string",
            "description": "UUID of the entity assessment to score",
        },
    },
    "required": ["entity_assessment_id"],
}


# ---------------------------------------------------------------------------
# list_frameworks
# ---------------------------------------------------------------------------

def list_frameworks() -> dict:
    """List all loaded compliance frameworks with their control counts and assessment counts."""
    from core.models import Framework, RequirementNode, ComplianceAssessment

    try:
        frameworks = []
        for fw in Framework.objects.select_related("library").order_by("name"):
            req_count = RequirementNode.objects.filter(framework=fw).count()
            assessable_count = RequirementNode.objects.filter(
                framework=fw, assessable=True
            ).count()
            assessment_count = ComplianceAssessment.objects.filter(
                framework=fw
            ).count()

            frameworks.append({
                "id": str(fw.id),
                "name": fw.name,
                "ref_id": fw.ref_id,
                "description": fw.description or "",
                "urn": fw.urn,
                "provider": fw.provider,
                "min_score": fw.min_score,
                "max_score": fw.max_score,
                "requirement_count": req_count,
                "assessable_requirement_count": assessable_count,
                "assessment_count": assessment_count,
                "library": str(fw.library) if fw.library else None,
            })

        return {"frameworks": frameworks, "count": len(frameworks)}
    except Exception as e:
        logger.exception("list_frameworks failed")
        return {"error": str(e)}


list_frameworks.input_schema = {
    "type": "object",
    "properties": {},
}


# ---------------------------------------------------------------------------
# get_assessment_summary
# ---------------------------------------------------------------------------

def get_assessment_summary(assessment_id: str) -> dict:
    """Get a comprehensive summary of a compliance assessment.

    Includes scores, gaps, top non-compliant requirements, and progress
    metrics.
    """
    from core.models import ComplianceAssessment, RequirementAssessment

    try:
        if not _valid_uuid(assessment_id):
            return {"error": "Invalid assessment_id UUID"}

        ca = ComplianceAssessment.objects.select_related(
            "framework", "perimeter"
        ).get(id=assessment_id)

        # Basic info
        summary = _serialize_assessment(ca)

        # Scores and progress
        summary["progress_percentage"] = ca.get_progress()
        summary["global_score"] = ca.get_global_score()
        summary["min_score"] = ca.min_score
        summary["max_score"] = ca.max_score

        # Status breakdown
        status_counts = {}
        for count, status in ca.get_requirements_status_count():
            status_counts[str(status)] = count
        summary["status_breakdown"] = status_counts

        # Result breakdown
        result_counts = {}
        for count, result in ca.get_requirements_result_count():
            result_counts[str(result)] = count
        summary["result_breakdown"] = result_counts

        # Top gaps: non-compliant requirements
        non_compliant = (
            RequirementAssessment.objects.filter(
                compliance_assessment=ca,
                result__in=[
                    RequirementAssessment.Result.NON_COMPLIANT,
                    RequirementAssessment.Result.PARTIALLY_COMPLIANT,
                ],
                requirement__assessable=True,
            )
            .select_related("requirement")
            .order_by("result")[:20]
        )

        gaps = []
        for ra in non_compliant:
            gaps.append({
                "requirement_id": str(ra.requirement_id),
                "requirement": str(ra.requirement),
                "ref_id": ra.requirement.ref_id,
                "result": ra.result,
                "status": ra.status,
                "score": ra.score,
                "observation": ra.observation or "",
            })
        summary["gaps"] = gaps

        # Recommendations
        recommendations = []
        if result_counts.get("non_compliant", 0) > 0:
            recommendations.append(
                f"Address {result_counts['non_compliant']} non-compliant requirements as priority."
            )
        if result_counts.get("not_assessed", 0) > 0:
            recommendations.append(
                f"Complete assessment for {result_counts['not_assessed']} unassessed requirements."
            )
        progress = summary["progress_percentage"]
        if progress < 50:
            recommendations.append(
                f"Assessment is only {progress}% complete. Consider accelerating the review process."
            )
        summary["recommendations"] = recommendations

        return summary
    except ComplianceAssessment.DoesNotExist:
        return {"error": f"Assessment not found: {assessment_id}"}
    except Exception as e:
        logger.exception("get_assessment_summary failed")
        return {"error": str(e)}


get_assessment_summary.input_schema = {
    "type": "object",
    "properties": {
        "assessment_id": {
            "type": "string",
            "description": "UUID of the compliance assessment",
        },
    },
    "required": ["assessment_id"],
}


# ---------------------------------------------------------------------------
# search_findings
# ---------------------------------------------------------------------------

def search_findings(
    query: str = None,
    severity: str = None,
    status: str = None,
    max_results: int = 50,
) -> dict:
    """Search vulnerability and compliance findings.

    Searches across POA&M items, non-compliant requirement assessments,
    and risk scenarios.
    """
    from core.models import RequirementAssessment, RiskScenario
    from django.db.models import Q

    findings = []

    try:
        # 1. Search non-compliant requirement assessments
        ra_qs = RequirementAssessment.objects.filter(
            result__in=[
                RequirementAssessment.Result.NON_COMPLIANT,
                RequirementAssessment.Result.PARTIALLY_COMPLIANT,
            ],
            requirement__assessable=True,
        ).select_related("requirement", "compliance_assessment")

        if query:
            ra_qs = ra_qs.filter(
                Q(requirement__name__icontains=query)
                | Q(requirement__description__icontains=query)
                | Q(observation__icontains=query)
            )
        if status:
            ra_qs = ra_qs.filter(status=status)

        for ra in ra_qs[:max_results // 2]:
            findings.append({
                "type": "compliance_finding",
                "id": str(ra.id),
                "title": str(ra.requirement),
                "description": ra.observation or ra.requirement.description or "",
                "severity": ra.result,
                "status": ra.status,
                "assessment": str(ra.compliance_assessment),
                "assessment_id": str(ra.compliance_assessment_id),
            })

        # 2. Search risk scenarios with open treatment
        rs_qs = RiskScenario.objects.filter(
            treatment="open"
        ).select_related("risk_assessment")

        if query:
            rs_qs = rs_qs.filter(
                Q(name__icontains=query) | Q(description__icontains=query)
            )
        if severity:
            try:
                min_level = int(severity)
                rs_qs = rs_qs.filter(current_level__gte=min_level)
            except (ValueError, TypeError):
                pass

        remaining = max_results - len(findings)
        for rs in rs_qs[:max(remaining, 10)]:
            findings.append({
                "type": "risk_finding",
                "id": str(rs.id),
                "title": rs.name,
                "description": rs.description or "",
                "severity": f"level_{rs.current_level}",
                "status": rs.treatment,
                "assessment": str(rs.risk_assessment),
                "assessment_id": str(rs.risk_assessment_id),
            })

        # 3. Search POA&M items
        try:
            from poam.models.poam_item import POAMItem

            poam_qs = POAMItem.objects.all()
            if query:
                poam_qs = poam_qs.filter(
                    Q(title__icontains=query)
                    | Q(description__icontains=query)
                    | Q(weakness_id__icontains=query)
                )
            if severity:
                poam_qs = poam_qs.filter(risk_level=severity)
            if status:
                poam_qs = poam_qs.filter(status=status)

            remaining = max_results - len(findings)
            for item in poam_qs[:max(remaining, 10)]:
                findings.append({
                    "type": "poam_finding",
                    "id": str(item.id),
                    "title": item.title,
                    "weakness_id": item.weakness_id,
                    "description": item.description or "",
                    "severity": item.risk_level,
                    "status": item.status,
                })
        except Exception:
            logger.debug("POAMItem search skipped (module may not be available)")

        return {"findings": findings[:max_results], "count": len(findings)}
    except Exception as e:
        logger.exception("search_findings failed")
        return {"error": str(e)}


search_findings.input_schema = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "Search keyword across finding titles, descriptions, and observations",
        },
        "severity": {
            "type": "string",
            "description": "Filter by severity/risk level",
        },
        "status": {
            "type": "string",
            "description": "Filter by status (e.g., to_do, in_progress, done)",
        },
        "max_results": {
            "type": "integer",
            "description": "Maximum number of findings to return (default: 50)",
        },
    },
}


# ---------------------------------------------------------------------------
# generate_report
# ---------------------------------------------------------------------------

def generate_report(
    report_type: str,
    assessment_id: str = None,
    format: str = "summary",
) -> dict:
    """Generate a compliance or risk report.

    Supported report types:
    - compliance_summary: Overall compliance posture across assessments
    - risk_register: Current risk register with all scenarios
    - poam_status: POA&M status overview
    - conmon_monthly: Continuous monitoring monthly summary
    - vendor_summary: Third-party vendor risk summary
    """
    try:
        if report_type == "compliance_summary":
            return _report_compliance_summary(assessment_id, format)
        elif report_type == "risk_register":
            return _report_risk_register(assessment_id, format)
        elif report_type == "poam_status":
            return _report_poam_status(format)
        elif report_type == "conmon_monthly":
            return _report_conmon_monthly(format)
        elif report_type == "vendor_summary":
            return _report_vendor_summary(format)
        else:
            return {
                "error": f"Unknown report type: {report_type}",
                "available_types": [
                    "compliance_summary",
                    "risk_register",
                    "poam_status",
                    "conmon_monthly",
                    "vendor_summary",
                ],
            }
    except Exception as e:
        logger.exception("generate_report failed")
        return {"error": str(e)}


def _report_compliance_summary(assessment_id: Optional[str], fmt: str) -> dict:
    from core.models import ComplianceAssessment, RequirementAssessment

    qs = ComplianceAssessment.objects.select_related("framework", "perimeter")
    if assessment_id and _valid_uuid(assessment_id):
        qs = qs.filter(id=assessment_id)

    report = {
        "report_type": "compliance_summary",
        "generated_at": str(date.today()),
        "assessments": [],
    }

    total_reqs = 0
    total_compliant = 0

    for ca in qs[:50]:
        result_counts = {}
        for count, result in ca.get_requirements_result_count():
            result_counts[str(result)] = count

        reqs = sum(result_counts.values())
        compliant = result_counts.get("compliant", 0)
        total_reqs += reqs
        total_compliant += compliant

        report["assessments"].append({
            "name": ca.name,
            "framework": str(ca.framework),
            "status": ca.status,
            "progress": ca.get_progress(),
            "global_score": ca.get_global_score(),
            "result_breakdown": result_counts,
            "compliance_rate": round(compliant / reqs * 100, 1) if reqs > 0 else 0,
        })

    report["overall_compliance_rate"] = (
        round(total_compliant / total_reqs * 100, 1) if total_reqs > 0 else 0
    )
    report["total_requirements_assessed"] = total_reqs
    return report


def _report_risk_register(assessment_id: Optional[str], fmt: str) -> dict:
    from core.models import RiskScenario, RiskAssessment

    qs = RiskScenario.objects.select_related(
        "risk_assessment", "risk_assessment__risk_matrix"
    )
    if assessment_id and _valid_uuid(assessment_id):
        qs = qs.filter(risk_assessment_id=assessment_id)

    report = {
        "report_type": "risk_register",
        "generated_at": str(date.today()),
        "scenarios": [],
        "treatment_summary": {},
    }

    treatment_counts: dict = {}
    for rs in qs[:200]:
        treatment_counts[rs.treatment] = treatment_counts.get(rs.treatment, 0) + 1
        report["scenarios"].append({
            "ref_id": rs.ref_id,
            "name": rs.name,
            "treatment": rs.treatment,
            "current_level": rs.current_level,
            "residual_level": rs.residual_level,
            "risk_assessment": str(rs.risk_assessment),
        })

    report["treatment_summary"] = treatment_counts
    report["total_scenarios"] = len(report["scenarios"])
    return report


def _report_poam_status(fmt: str) -> dict:
    report = {
        "report_type": "poam_status",
        "generated_at": str(date.today()),
        "items": [],
        "status_summary": {},
    }

    try:
        from poam.models.poam_item import POAMItem

        status_counts: dict = {}
        for item in POAMItem.objects.all()[:200]:
            status_counts[item.status] = status_counts.get(item.status, 0) + 1
            report["items"].append({
                "weakness_id": item.weakness_id,
                "title": item.title,
                "status": item.status,
                "risk_level": item.risk_level,
                "is_overdue": item.is_overdue,
                "days_overdue": item.days_overdue,
                "completion_percentage": item.completion_percentage,
                "estimated_completion_date": str(item.estimated_completion_date)
                if item.estimated_completion_date
                else None,
            })

        report["status_summary"] = status_counts
        report["total_items"] = len(report["items"])
        overdue_count = sum(1 for i in report["items"] if i["is_overdue"])
        report["overdue_count"] = overdue_count
    except Exception:
        logger.debug("POAMItem not available for poam_status report")
        report["note"] = "POA&M module not available"

    return report


def _report_conmon_monthly(fmt: str) -> dict:
    from core.models import ComplianceAssessment, RiskScenario

    report = {
        "report_type": "conmon_monthly",
        "generated_at": str(date.today()),
        "compliance_assessments_count": ComplianceAssessment.objects.count(),
        "active_risk_scenarios": RiskScenario.objects.filter(treatment="open").count(),
        "mitigated_risk_scenarios": RiskScenario.objects.filter(
            treatment="mitigate"
        ).count(),
    }

    try:
        from poam.models.poam_item import POAMItem

        report["open_poam_items"] = POAMItem.objects.exclude(
            status__in=["completed", "cancelled"]
        ).count()
        report["overdue_poam_items"] = sum(
            1
            for item in POAMItem.objects.exclude(
                status__in=["completed", "cancelled"]
            )
            if item.is_overdue
        )
    except Exception:
        report["open_poam_items"] = "N/A"
        report["overdue_poam_items"] = "N/A"

    return report


def _report_vendor_summary(fmt: str) -> dict:
    from tprm.models import EntityAssessment, Entity

    report = {
        "report_type": "vendor_summary",
        "generated_at": str(date.today()),
        "total_entities": Entity.objects.count(),
        "total_assessments": EntityAssessment.objects.count(),
        "assessments": [],
    }

    conclusion_counts: dict = {}
    for ea in EntityAssessment.objects.select_related("entity")[:100]:
        conclusion = ea.conclusion or "not_assessed"
        conclusion_counts[conclusion] = conclusion_counts.get(conclusion, 0) + 1
        report["assessments"].append({
            "entity": str(ea.entity),
            "name": ea.name,
            "status": ea.status,
            "conclusion": ea.conclusion,
            "criticality": ea.criticality,
            "maturity": ea.maturity,
            "trust": ea.trust,
        })

    report["conclusion_summary"] = conclusion_counts
    return report


generate_report.input_schema = {
    "type": "object",
    "properties": {
        "report_type": {
            "type": "string",
            "enum": [
                "compliance_summary",
                "risk_register",
                "poam_status",
                "conmon_monthly",
                "vendor_summary",
            ],
            "description": "Type of report to generate",
        },
        "assessment_id": {
            "type": "string",
            "description": "UUID of a specific assessment (for compliance_summary and risk_register)",
        },
        "format": {
            "type": "string",
            "enum": ["summary", "detailed"],
            "description": "Output detail level (default: summary)",
        },
    },
    "required": ["report_type"],
}


# ---------------------------------------------------------------------------
# get_vendor_portal_status
# ---------------------------------------------------------------------------

def get_vendor_portal_status(entity_id: str = None) -> dict:
    """Get vendor portal status including active tokens, questionnaire completion,
    and evidence upload status for vendor assessments.

    Optionally filter by entity ID.
    """
    try:
        from vendor_portal.auth import VendorToken

        qs = VendorToken.objects.all()
        if entity_id and _valid_uuid(entity_id):
            qs = qs.filter(entity_id=entity_id)

        tokens = []
        for vt in qs[:50]:
            tokens.append({
                "entity_id": str(vt.entity_id),
                "vendor_name": vt.vendor_name,
                "vendor_email": vt.vendor_email,
                "is_valid": vt.is_valid,
                "is_expired": vt.is_expired,
                "use_count": vt.use_count,
                "expires_at": str(vt.expires_at),
                "created_at": str(vt.created_at),
                "last_used_at": str(vt.last_used_at) if vt.last_used_at else None,
                "questionnaire_id": str(vt.questionnaire_id) if vt.questionnaire_id else None,
            })

        return {
            "tokens": tokens,
            "count": len(tokens),
            "active_count": sum(1 for t in tokens if t["is_valid"]),
            "expired_count": sum(1 for t in tokens if t["is_expired"]),
        }
    except Exception as e:
        logger.exception("get_vendor_portal_status failed")
        return {"error": str(e)}


get_vendor_portal_status.input_schema = {
    "type": "object",
    "properties": {
        "entity_id": {
            "type": "string",
            "description": "UUID of a specific entity to filter vendor tokens",
        },
    },
}


# ---------------------------------------------------------------------------
# get_conmon_report
# ---------------------------------------------------------------------------

def get_conmon_report(months_back: int = 1, system_id: str = None) -> dict:
    """Generate a continuous monitoring report for the specified period.

    Returns control validation status, vulnerability summary, POA&M status,
    incident tracking, evidence freshness, and recommendations.
    """
    from datetime import timedelta

    try:
        from core.bounded_contexts.conmon.services.conmon_reporter import (
            get_conmon_reporter,
        )

        reporter = get_conmon_reporter()

        now = date.today()
        period_end = now
        period_start = now.replace(day=1)
        if months_back > 1:
            month = now.month - (months_back - 1)
            year = now.year
            while month <= 0:
                month += 12
                year -= 1
            period_start = date(year, month, 1)

        report = reporter.generate_report(
            period_start=period_start,
            period_end=period_end,
            system_id=system_id,
        )

        return report.to_dict()
    except Exception as e:
        logger.exception("get_conmon_report failed")
        return {"error": str(e)}


get_conmon_report.input_schema = {
    "type": "object",
    "properties": {
        "months_back": {
            "type": "integer",
            "description": "Number of months to cover (default: 1, current month)",
        },
        "system_id": {
            "type": "string",
            "description": "Optional system/project group ID to scope the report",
        },
    },
}


# ---------------------------------------------------------------------------
# get_requirements_flowdown
# ---------------------------------------------------------------------------

def get_requirements_flowdown(entity_id: str = None) -> dict:
    """Get requirements flowdown matrix showing which compliance requirements
    flow down to which vendors, or get vendor-specific compliance status.

    If entity_id is provided, returns compliance status for that vendor.
    Otherwise returns the full flowdown matrix.
    """
    try:
        from tprm.services.requirements_flowdown import RequirementsFlowdownService

        service = RequirementsFlowdownService()

        if entity_id and _valid_uuid(entity_id):
            return service.get_vendor_compliance_status(entity_id)
        else:
            return service.get_flowdown_matrix()
    except Exception as e:
        logger.exception("get_requirements_flowdown failed")
        return {"error": str(e)}


get_requirements_flowdown.input_schema = {
    "type": "object",
    "properties": {
        "entity_id": {
            "type": "string",
            "description": "UUID of a specific entity/vendor for targeted compliance status. Omit for full matrix.",
        },
    },
}
