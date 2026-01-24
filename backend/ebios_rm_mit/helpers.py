"""
EBIOS RM Helpers - MIT Licensed

Chart data generation and analysis utilities for EBIOS RM.
Copyright (c) 2026 Tash
"""

from typing import Dict, List, Any
from collections import defaultdict


def generate_ecosystem_radar_chart(study) -> Dict[str, Any]:
    """
    Generate radar chart data for stakeholder ecosystem analysis.

    Returns data for a radar/spider chart showing:
    - Dependency
    - Penetration
    - Maturity
    - Trust
    - Criticality

    For each stakeholder category.
    """
    stakeholders = study.stakeholders.all()

    # Group by category
    categories = defaultdict(list)
    for s in stakeholders:
        categories[s.category].append(s)

    # Calculate averages per category
    chart_data = {
        'labels': ['Dependency', 'Penetration', 'Maturity', 'Trust'],
        'datasets': []
    }

    colors = {
        'partner': 'rgba(59, 130, 246, 0.5)',
        'supplier': 'rgba(16, 185, 129, 0.5)',
        'client': 'rgba(245, 158, 11, 0.5)',
        'subcontractor': 'rgba(239, 68, 68, 0.5)',
        'service_provider': 'rgba(139, 92, 246, 0.5)',
        'internal': 'rgba(107, 114, 128, 0.5)',
        'other': 'rgba(156, 163, 175, 0.5)',
    }

    for category, stakeholder_list in categories.items():
        if not stakeholder_list:
            continue

        n = len(stakeholder_list)
        avg_dep = sum(s.current_dependency for s in stakeholder_list) / n
        avg_pen = sum(s.current_penetration for s in stakeholder_list) / n
        avg_mat = sum(s.current_maturity for s in stakeholder_list) / n
        avg_trust = sum(s.current_trust for s in stakeholder_list) / n

        chart_data['datasets'].append({
            'label': category.replace('_', ' ').title(),
            'data': [avg_dep, avg_pen, avg_mat, avg_trust],
            'backgroundColor': colors.get(category, 'rgba(107, 114, 128, 0.5)'),
            'borderColor': colors.get(category, 'rgba(107, 114, 128, 1)').replace('0.5', '1'),
        })

    return chart_data


def generate_ecosystem_circular_chart(study) -> Dict[str, Any]:
    """
    Generate circular/donut chart data for ecosystem visualization.

    Groups stakeholders by maturity/reliability level and shows distribution.
    """
    stakeholders = study.stakeholders.all()

    # Group by maturity level
    maturity_groups = {
        'high': [],     # maturity >= 3 and trust >= 3
        'medium': [],   # maturity >= 2 or trust >= 2
        'low': [],      # rest
    }

    for s in stakeholders:
        if s.current_maturity >= 3 and s.current_trust >= 3:
            maturity_groups['high'].append(s)
        elif s.current_maturity >= 2 or s.current_trust >= 2:
            maturity_groups['medium'].append(s)
        else:
            maturity_groups['low'].append(s)

    chart_data = {
        'labels': ['High Reliability', 'Medium Reliability', 'Low Reliability'],
        'datasets': [{
            'data': [
                len(maturity_groups['high']),
                len(maturity_groups['medium']),
                len(maturity_groups['low']),
            ],
            'backgroundColor': [
                'rgba(16, 185, 129, 0.8)',
                'rgba(245, 158, 11, 0.8)',
                'rgba(239, 68, 68, 0.8)',
            ],
        }],
        'details': {
            'high': [{'id': str(s.id), 'name': s.name} for s in maturity_groups['high']],
            'medium': [{'id': str(s.id), 'name': s.name} for s in maturity_groups['medium']],
            'low': [{'id': str(s.id), 'name': s.name} for s in maturity_groups['low']],
        }
    }

    return chart_data


def generate_visual_analysis(study) -> Dict[str, Any]:
    """
    Generate visual analysis data for the EBIOS RM study.

    Returns comprehensive analysis including:
    - Feared events by gravity
    - RoTo pertinence distribution
    - Stakeholder criticality heatmap
    - Risk distribution
    """
    analysis = {
        'feared_events': {
            'by_gravity': {},
            'selected_count': 0,
            'total_count': 0,
        },
        'rotos': {
            'by_pertinence': {},
            'selected_count': 0,
            'total_count': 0,
        },
        'stakeholders': {
            'by_criticality': [],
            'by_category': {},
        },
        'strategic_scenarios': {
            'by_gravity': {},
            'total_count': 0,
        },
        'operational_scenarios': {
            'risk_matrix': [],
            'total_count': 0,
        },
    }

    # Feared events analysis
    for fe in study.feared_events.all():
        analysis['feared_events']['total_count'] += 1
        if fe.is_selected:
            analysis['feared_events']['selected_count'] += 1

        gravity_key = str(fe.gravity)
        if gravity_key not in analysis['feared_events']['by_gravity']:
            analysis['feared_events']['by_gravity'][gravity_key] = 0
        analysis['feared_events']['by_gravity'][gravity_key] += 1

    # RoTo analysis
    for roto in study.rotos.all():
        analysis['rotos']['total_count'] += 1
        if roto.is_selected:
            analysis['rotos']['selected_count'] += 1

        # Group pertinence into buckets
        if roto.pertinence >= 12:
            bucket = 'high'
        elif roto.pertinence >= 6:
            bucket = 'medium'
        else:
            bucket = 'low'

        if bucket not in analysis['rotos']['by_pertinence']:
            analysis['rotos']['by_pertinence'][bucket] = 0
        analysis['rotos']['by_pertinence'][bucket] += 1

    # Stakeholder analysis
    stakeholder_criticality = []
    for s in study.stakeholders.all():
        stakeholder_criticality.append({
            'id': str(s.id),
            'name': s.name,
            'category': s.category,
            'criticality': s.current_criticality,
        })

        if s.category not in analysis['stakeholders']['by_category']:
            analysis['stakeholders']['by_category'][s.category] = 0
        analysis['stakeholders']['by_category'][s.category] += 1

    # Sort by criticality descending
    stakeholder_criticality.sort(key=lambda x: x['criticality'], reverse=True)
    analysis['stakeholders']['by_criticality'] = stakeholder_criticality[:10]  # Top 10

    # Strategic scenarios analysis
    for ss in study.strategic_scenarios.all():
        analysis['strategic_scenarios']['total_count'] += 1

        gravity_key = str(ss.gravity)
        if gravity_key not in analysis['strategic_scenarios']['by_gravity']:
            analysis['strategic_scenarios']['by_gravity'][gravity_key] = 0
        analysis['strategic_scenarios']['by_gravity'][gravity_key] += 1

    # Operational scenarios analysis (risk matrix)
    risk_matrix = defaultdict(lambda: {'count': 0, 'scenarios': []})
    for ss in study.strategic_scenarios.all():
        for ap in ss.attack_paths.all():
            for os in ap.operational_scenarios.all():
                analysis['operational_scenarios']['total_count'] += 1
                key = (os.likelihood, os.gravity)
                risk_matrix[key]['count'] += 1
                risk_matrix[key]['scenarios'].append({
                    'id': str(os.id),
                    'name': os.name,
                })

    analysis['operational_scenarios']['risk_matrix'] = [
        {
            'likelihood': k[0],
            'gravity': k[1],
            'risk_level': k[0] * k[1],
            'count': v['count'],
            'scenarios': v['scenarios'],
        }
        for k, v in risk_matrix.items()
    ]

    return analysis


def generate_report_data(study) -> Dict[str, Any]:
    """
    Generate comprehensive report data for the EBIOS RM study.

    Returns all data needed for generating a full EBIOS RM report.
    """
    report = {
        'study': {
            'id': str(study.id),
            'name': study.name,
            'description': study.description,
            'ref_id': study.ref_id,
            'status': study.status,
            'version': study.version,
            'quotation_method': study.quotation_method,
            'observation': study.observation,
            'created_at': study.created_at.isoformat() if study.created_at else None,
            'updated_at': study.updated_at.isoformat() if study.updated_at else None,
        },
        'workshop_1': {
            'feared_events': [],
        },
        'workshop_2': {
            'risk_origins': [],
            'target_objectives': [],
            'rotos': [],
        },
        'workshop_3': {
            'stakeholders': [],
            'strategic_scenarios': [],
        },
        'workshop_4': {
            'attack_paths': [],
            'operational_scenarios': [],
        },
        'workshop_5': {
            'risk_treatment_summary': [],
        },
        'summary': {
            'total_feared_events': 0,
            'selected_feared_events': 0,
            'total_rotos': 0,
            'selected_rotos': 0,
            'total_stakeholders': 0,
            'total_strategic_scenarios': 0,
            'total_operational_scenarios': 0,
            'high_risk_scenarios': 0,
        },
    }

    # Workshop 1: Feared Events
    for fe in study.feared_events.all():
        report['workshop_1']['feared_events'].append({
            'id': str(fe.id),
            'name': fe.name,
            'description': fe.description,
            'ref_id': fe.ref_id,
            'gravity': fe.gravity,
            'is_selected': fe.is_selected,
            'justification': fe.selection_justification,
        })
        report['summary']['total_feared_events'] += 1
        if fe.is_selected:
            report['summary']['selected_feared_events'] += 1

    # Workshop 2: Risk Origins, Target Objectives, RoTos
    for ro in study.risk_origins.all():
        report['workshop_2']['risk_origins'].append({
            'id': str(ro.id),
            'name': ro.name,
            'description': ro.description,
            'category': ro.category,
            'motivation': ro.motivation,
            'resources': ro.resources,
            'activity': ro.activity,
        })

    for to in study.target_objectives.all():
        report['workshop_2']['target_objectives'].append({
            'id': str(to.id),
            'name': to.name,
            'description': to.description,
        })

    for roto in study.rotos.all():
        report['workshop_2']['rotos'].append({
            'id': str(roto.id),
            'risk_origin': roto.risk_origin.name,
            'target_objective': roto.target_objective.name,
            'pertinence': roto.pertinence,
            'is_selected': roto.is_selected,
            'justification': roto.justification,
        })
        report['summary']['total_rotos'] += 1
        if roto.is_selected:
            report['summary']['selected_rotos'] += 1

    # Workshop 3: Stakeholders and Strategic Scenarios
    for s in study.stakeholders.all():
        report['workshop_3']['stakeholders'].append({
            'id': str(s.id),
            'name': s.name,
            'category': s.category,
            'current_dependency': s.current_dependency,
            'current_penetration': s.current_penetration,
            'current_maturity': s.current_maturity,
            'current_trust': s.current_trust,
            'current_criticality': s.current_criticality,
            'residual_criticality': s.residual_criticality,
        })
        report['summary']['total_stakeholders'] += 1

    for ss in study.strategic_scenarios.all():
        report['workshop_3']['strategic_scenarios'].append({
            'id': str(ss.id),
            'name': ss.name,
            'ref_id': ss.ref_id,
            'roto': str(ss.roto),
            'gravity': ss.gravity,
            'feared_events': [fe.name for fe in ss.feared_events.all()],
        })
        report['summary']['total_strategic_scenarios'] += 1

    # Workshop 4: Attack Paths and Operational Scenarios
    for ss in study.strategic_scenarios.all():
        for ap in ss.attack_paths.all():
            report['workshop_4']['attack_paths'].append({
                'id': str(ap.id),
                'name': ap.name,
                'ref_id': ap.ref_id,
                'strategic_scenario': ss.name,
                'stakeholders': [s.name for s in ap.stakeholders.all()],
            })

            for os in ap.operational_scenarios.all():
                report['workshop_4']['operational_scenarios'].append({
                    'id': str(os.id),
                    'name': os.name,
                    'ref_id': os.ref_id,
                    'attack_path': ap.name,
                    'likelihood': os.likelihood,
                    'gravity': os.gravity,
                    'risk_level': os.risk_level,
                })
                report['summary']['total_operational_scenarios'] += 1
                if os.risk_level >= 12:  # High risk threshold
                    report['summary']['high_risk_scenarios'] += 1

    # Workshop 5: Risk Treatment (summary based on residual metrics)
    for s in study.stakeholders.all():
        if s.residual_criticality < s.current_criticality:
            report['workshop_5']['risk_treatment_summary'].append({
                'stakeholder': s.name,
                'current_criticality': s.current_criticality,
                'residual_criticality': s.residual_criticality,
                'improvement': s.current_criticality - s.residual_criticality,
            })

    return report
