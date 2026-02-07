"""
MCP Resources for CISO Assistant.

Resources provide direct data access via URI templates.  Each resource
handler receives the URI template parameters as keyword arguments and
returns a dict that the MCP server serialises to JSON.

All Django model imports happen inside function bodies to avoid circular
imports and to ensure ``django.setup()`` has already been called.
"""
import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# compliance://assessment/{id}
# ---------------------------------------------------------------------------

def compliance_assessment_resource(id: str) -> dict:
    """Compliance assessment details including all requirement statuses."""
    from core.models import ComplianceAssessment, RequirementAssessment

    ca = ComplianceAssessment.objects.select_related(
        "framework", "perimeter"
    ).get(id=id)

    # Requirement-level details
    requirement_assessments = (
        RequirementAssessment.objects.filter(compliance_assessment=ca)
        .select_related("requirement")
        .order_by("requirement__order_id")
    )

    requirements = []
    for ra in requirement_assessments:
        req = ra.requirement
        requirements.append({
            "id": str(ra.id),
            "requirement_id": str(req.id),
            "ref_id": req.ref_id,
            "name": req.name,
            "description": req.description or "",
            "assessable": req.assessable,
            "result": ra.result,
            "status": ra.status,
            "score": ra.score,
            "is_scored": ra.is_scored,
            "observation": ra.observation or "",
            "applied_controls": [
                {"id": str(ac.id), "name": ac.name, "status": ac.status}
                for ac in ra.applied_controls.all()
            ],
            "evidence_count": ra.evidences.count(),
        })

    # Status and result breakdowns
    status_counts = {}
    for count, status in ca.get_requirements_status_count():
        status_counts[str(status)] = count

    result_counts = {}
    for count, result in ca.get_requirements_result_count():
        result_counts[str(result)] = count

    return {
        "id": str(ca.id),
        "name": ca.name,
        "version": ca.version,
        "status": ca.status,
        "framework": {
            "id": str(ca.framework_id),
            "name": ca.framework.name,
            "ref_id": ca.framework.ref_id,
            "urn": ca.framework.urn,
            "min_score": ca.framework.min_score,
            "max_score": ca.framework.max_score,
        },
        "perimeter": {
            "id": str(ca.perimeter_id),
            "name": str(ca.perimeter),
        }
        if ca.perimeter
        else None,
        "progress_percentage": ca.get_progress(),
        "global_score": ca.get_global_score(),
        "min_score": ca.min_score,
        "max_score": ca.max_score,
        "status_breakdown": status_counts,
        "result_breakdown": result_counts,
        "requirement_assessments": requirements,
        "created_at": str(ca.created_at),
        "updated_at": str(ca.updated_at),
    }


# ---------------------------------------------------------------------------
# risk://scenario/{id}
# ---------------------------------------------------------------------------

def risk_scenario_resource(id: str) -> dict:
    """Risk scenario details with threat, vulnerability, and control information."""
    from core.models import RiskScenario

    rs = RiskScenario.objects.select_related(
        "risk_assessment",
        "risk_assessment__risk_matrix",
        "risk_assessment__perimeter",
    ).get(id=id)

    # Threats
    threats = [
        {
            "id": str(t.id),
            "name": t.name,
            "ref_id": t.ref_id,
            "description": t.description or "",
        }
        for t in rs.threats.all()
    ]

    # Vulnerabilities
    vulnerabilities = [
        {
            "id": str(v.id),
            "name": v.name,
            "description": v.description or "",
        }
        for v in rs.vulnerabilities.all()
    ]

    # Applied controls (mitigating)
    applied_controls = [
        {
            "id": str(ac.id),
            "name": ac.name,
            "ref_id": ac.ref_id,
            "status": ac.status,
            "category": ac.category,
        }
        for ac in rs.applied_controls.all()
    ]

    # Existing applied controls
    existing_applied_controls = [
        {
            "id": str(ac.id),
            "name": ac.name,
            "ref_id": ac.ref_id,
            "status": ac.status,
        }
        for ac in rs.existing_applied_controls.all()
    ]

    # Assets
    assets = [
        {
            "id": str(a.id),
            "name": a.name,
            "description": a.description or "",
        }
        for a in rs.assets.all()
    ]

    # Risk level data
    try:
        current_risk = rs.get_current_risk()
    except Exception:
        current_risk = {"name": "--", "value": rs.current_level}

    try:
        residual_risk = rs.get_residual_risk()
    except Exception:
        residual_risk = {"name": "--", "value": rs.residual_level}

    try:
        inherent_risk = rs.get_inherent_risk()
    except Exception:
        inherent_risk = {"name": "--", "value": rs.inherent_level}

    return {
        "id": str(rs.id),
        "name": rs.name,
        "ref_id": rs.ref_id,
        "description": rs.description or "",
        "treatment": rs.treatment,
        "justification": rs.justification or "",
        "within_tolerance": rs.within_tolerance,
        "inherent": {
            "probability": rs.inherent_proba,
            "impact": rs.inherent_impact,
            "level": rs.inherent_level,
            "risk": inherent_risk,
        },
        "current": {
            "probability": rs.current_proba,
            "impact": rs.current_impact,
            "level": rs.current_level,
            "risk": current_risk,
        },
        "residual": {
            "probability": rs.residual_proba,
            "impact": rs.residual_impact,
            "level": rs.residual_level,
            "risk": residual_risk,
        },
        "risk_assessment": {
            "id": str(rs.risk_assessment_id),
            "name": str(rs.risk_assessment),
        },
        "threats": threats,
        "vulnerabilities": vulnerabilities,
        "applied_controls": applied_controls,
        "existing_applied_controls": existing_applied_controls,
        "assets": assets,
        "strength_of_knowledge": rs.get_strength_of_knowledge(),
        "created_at": str(rs.created_at),
        "updated_at": str(rs.updated_at),
    }


# ---------------------------------------------------------------------------
# control://applied/{id}
# ---------------------------------------------------------------------------

def applied_control_resource(id: str) -> dict:
    """Applied control details with implementation status and evidence."""
    from core.models import AppliedControl

    ac = AppliedControl.objects.select_related("reference_control").get(id=id)

    # Evidence
    evidences = []
    for ev in ac.evidences.all():
        evidences.append({
            "id": str(ev.id),
            "name": ev.name,
            "description": ev.description or "",
            "status": ev.status,
            "filename": ev.filename(),
            "size": ev.get_size(),
            "expiry_date": str(ev.expiry_date) if ev.expiry_date else None,
        })

    # Linked requirement assessments
    requirement_assessments = []
    for ra in ac.requirement_assessments.select_related(
        "requirement", "compliance_assessment"
    )[:50]:
        requirement_assessments.append({
            "id": str(ra.id),
            "requirement": str(ra.requirement),
            "requirement_ref_id": ra.requirement.ref_id,
            "compliance_assessment": str(ra.compliance_assessment),
            "result": ra.result,
            "status": ra.status,
        })

    # Linked risk scenarios
    risk_scenarios = []
    for rs in ac.risk_scenarios.select_related("risk_assessment")[:50]:
        risk_scenarios.append({
            "id": str(rs.id),
            "name": rs.name,
            "ref_id": rs.ref_id,
            "treatment": rs.treatment,
            "current_level": rs.current_level,
            "risk_assessment": str(rs.risk_assessment),
        })

    ref_ctrl = ac.reference_control
    return {
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
        "start_date": str(ac.start_date) if ac.start_date else None,
        "expiry_date": str(ac.expiry_date) if ac.expiry_date else None,
        "link": ac.link,
        "reference_control": {
            "id": str(ref_ctrl.id),
            "name": str(ref_ctrl),
            "ref_id": ref_ctrl.ref_id,
            "urn": ref_ctrl.urn,
            "category": ref_ctrl.category,
        }
        if ref_ctrl
        else None,
        "evidences": evidences,
        "requirement_assessments": requirement_assessments,
        "risk_scenarios": risk_scenarios,
        "created_at": str(ac.created_at),
        "updated_at": str(ac.updated_at),
    }


# ---------------------------------------------------------------------------
# poam://item/{id}
# ---------------------------------------------------------------------------

def poam_item_resource(id: str) -> dict:
    """POA&M item details with milestones and remediation status."""
    from poam.models.poam_item import POAMItem

    item = POAMItem.objects.get(id=id)

    return {
        "id": str(item.id),
        "weakness_id": item.weakness_id,
        "title": item.title,
        "description": item.description,
        "source_type": item.source_type,
        "source_reference": item.source_reference,
        "control_id": item.control_id,
        "risk_level": item.risk_level,
        "likelihood": item.likelihood,
        "impact_description": item.impact_description,
        "status": item.status,
        "remediation_plan": item.remediation_plan,
        "resources_required": item.resources_required,
        "estimated_cost": str(item.estimated_cost) if item.estimated_cost else None,
        "responsible_organization": item.responsible_organization,
        "point_of_contact": item.point_of_contact,
        "contact_email": item.contact_email,
        "dates": {
            "identified": str(item.identified_date) if item.identified_date else None,
            "submitted": str(item.submitted_date) if item.submitted_date else None,
            "approved": str(item.approved_date) if item.approved_date else None,
            "estimated_completion": str(item.estimated_completion_date)
            if item.estimated_completion_date
            else None,
            "actual_completion": str(item.actual_completion_date)
            if item.actual_completion_date
            else None,
            "last_reviewed": str(item.last_reviewed_date)
            if item.last_reviewed_date
            else None,
            "next_review": str(item.next_review_date)
            if item.next_review_date
            else None,
        },
        "milestones": item.milestones or [],
        "completion_percentage": item.completion_percentage,
        "is_overdue": item.is_overdue,
        "days_overdue": item.days_overdue,
        "upcoming_milestones": item.upcoming_milestones,
        "overdue_milestones": item.overdue_milestones,
        "deviation": {
            "has_deviation": item.has_deviation,
            "justification": item.deviation_justification,
            "approved": item.deviation_approved,
            "approval_date": str(item.deviation_approval_date)
            if item.deviation_approval_date
            else None,
        },
        "evidence_before": item.evidence_before or [],
        "evidence_after": item.evidence_after or [],
        "supporting_documents": item.supporting_documents or [],
        "is_recurring": item.is_recurring,
        "tags": item.tags or [],
        "comments": item.comments,
        "created_at": str(item.created_at),
        "updated_at": str(item.updated_at),
    }
