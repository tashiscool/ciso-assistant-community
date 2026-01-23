"""
Assessment Engine Services

Services for Lightning Assessment and Master Assessment functionality.
"""

from django.db import transaction
from django.utils import timezone
from typing import List, Dict, Optional, Any
import uuid

from .models import (
    AssessmentTemplate,
    LightningAssessment,
    MasterAssessment,
    ControlGroup,
    TestCase,
    TestResult,
    AssessmentRun,
)


class LightningAssessmentService:
    """
    Service for Lightning Assessment - rapid assessment execution.
    """

    @classmethod
    def create_from_template(
        cls,
        template_id: str,
        name: str,
        scope: Dict,
        user=None,
    ) -> LightningAssessment:
        """Create a lightning assessment from a template."""
        template = AssessmentTemplate.objects.get(id=template_id)

        assessment = LightningAssessment.objects.create(
            name=name,
            description=template.description,
            template=template,
            scope=scope,
            scoring_method=template.configuration.get('scoring_method', 'pass_fail'),
            created_by=user,
        )

        # Create test cases from template
        for test_def in template.default_test_cases:
            TestCase.objects.create(
                lightning_assessment=assessment,
                control_id=test_def.get('control_id', ''),
                control_name=test_def.get('control_name', ''),
                test_procedure=test_def.get('test_procedure', ''),
                expected_result=test_def.get('expected_result', ''),
                test_type=test_def.get('test_type', 'manual'),
                priority=test_def.get('priority', 'medium'),
            )

        # Update template usage count
        template.times_used += 1
        template.save()

        # Calculate totals
        assessment.total_controls = assessment.test_cases.count()
        assessment.save()

        return assessment

    @classmethod
    def create_quick(
        cls,
        name: str,
        control_ids: List[str],
        scoring_method: str = 'pass_fail',
        user=None,
    ) -> LightningAssessment:
        """Create a quick lightning assessment from control list."""
        assessment = LightningAssessment.objects.create(
            name=name,
            scope={'control_ids': control_ids},
            scoring_method=scoring_method,
            created_by=user,
        )

        # Create basic test cases for each control
        for idx, control_id in enumerate(control_ids):
            TestCase.objects.create(
                lightning_assessment=assessment,
                control_id=control_id,
                control_name=f"Control {control_id}",
                test_procedure="Verify control implementation",
                sequence=idx,
            )

        assessment.total_controls = len(control_ids)
        assessment.save()

        return assessment

    @classmethod
    def start_assessment(cls, assessment_id: str) -> LightningAssessment:
        """Start a lightning assessment."""
        assessment = LightningAssessment.objects.get(id=assessment_id)
        assessment.start()

        # Create initial run
        AssessmentRun.objects.create(
            lightning_assessment=assessment,
            run_number=1,
            run_type='initial',
            status='running',
            actual_start=timezone.now(),
            executed_by=assessment.created_by,
        )

        return assessment

    @classmethod
    def record_result(
        cls,
        test_case_id: str,
        result: str,
        actual_result: str = '',
        notes: str = '',
        evidence_ids: List[str] = None,
        findings: str = '',
        recommendations: str = '',
        user=None,
    ) -> TestResult:
        """Record a test result."""
        test_case = TestCase.objects.get(id=test_case_id)

        test_result = TestResult.objects.create(
            test_case=test_case,
            result=result,
            actual_result=actual_result,
            notes=notes,
            evidence_ids=evidence_ids or [],
            findings=findings,
            recommendations=recommendations,
            tested_by=user,
            tested_at=timezone.now(),
        )

        # Update assessment progress
        assessment = test_case.lightning_assessment
        if assessment:
            cls._update_progress(assessment)

        return test_result

    @classmethod
    def bulk_record_results(
        cls,
        results: List[Dict],
        user=None,
    ) -> List[TestResult]:
        """Record multiple test results at once."""
        test_results = []

        with transaction.atomic():
            for result_data in results:
                test_result = cls.record_result(
                    test_case_id=result_data['test_case_id'],
                    result=result_data['result'],
                    actual_result=result_data.get('actual_result', ''),
                    notes=result_data.get('notes', ''),
                    evidence_ids=result_data.get('evidence_ids'),
                    findings=result_data.get('findings', ''),
                    recommendations=result_data.get('recommendations', ''),
                    user=user,
                )
                test_results.append(test_result)

        return test_results

    @classmethod
    def _update_progress(cls, assessment: LightningAssessment):
        """Update assessment progress counters."""
        results = TestResult.objects.filter(
            test_case__lightning_assessment=assessment
        ).exclude(result='not_tested')

        assessment.tested_controls = results.count()
        assessment.passed_controls = results.filter(result='pass').count()
        assessment.failed_controls = results.filter(result='fail').count()
        assessment.not_applicable = results.filter(result='na').count()
        assessment.save()

    @classmethod
    def complete_assessment(cls, assessment_id: str) -> LightningAssessment:
        """Complete a lightning assessment."""
        assessment = LightningAssessment.objects.get(id=assessment_id)
        assessment.complete()

        # Update run
        run = assessment.runs.filter(status='running').last()
        if run:
            run.status = 'completed'
            run.actual_end = timezone.now()
            run.results_snapshot = assessment.results_summary
            run.save()

        return assessment

    @classmethod
    def get_progress(cls, assessment_id: str) -> Dict:
        """Get detailed progress report."""
        assessment = LightningAssessment.objects.get(id=assessment_id)

        test_cases = assessment.test_cases.all()
        results_by_status = {}

        for tc in test_cases:
            latest_result = tc.results.order_by('-tested_at').first()
            status = latest_result.result if latest_result else 'not_tested'
            if status not in results_by_status:
                results_by_status[status] = []
            results_by_status[status].append({
                'test_case_id': str(tc.id),
                'control_id': tc.control_id,
                'control_name': tc.control_name,
            })

        return {
            'assessment_id': str(assessment.id),
            'name': assessment.name,
            'status': assessment.status,
            'progress_percentage': assessment.progress_percentage,
            'compliance_score': assessment.compliance_score,
            'total_controls': assessment.total_controls,
            'tested_controls': assessment.tested_controls,
            'passed_controls': assessment.passed_controls,
            'failed_controls': assessment.failed_controls,
            'not_applicable': assessment.not_applicable,
            'remaining': assessment.total_controls - assessment.tested_controls,
            'by_status': results_by_status,
        }


class MasterAssessmentService:
    """
    Service for Master Assessment - grouped control testing.
    """

    @classmethod
    def create(
        cls,
        name: str,
        framework_ids: List[str],
        grouping_method: str = 'family',
        enable_inheritance: bool = True,
        user=None,
    ) -> MasterAssessment:
        """Create a master assessment."""
        assessment = MasterAssessment.objects.create(
            name=name,
            framework_ids=framework_ids,
            grouping_method=grouping_method,
            enable_inheritance=enable_inheritance,
            created_by=user,
            lead_assessor=user,
        )

        return assessment

    @classmethod
    def generate_control_groups(
        cls,
        assessment_id: str,
        grouping_config: Dict = None,
    ) -> List[ControlGroup]:
        """Generate control groups based on grouping method."""
        assessment = MasterAssessment.objects.get(id=assessment_id)
        groups = []

        # This would integrate with the framework/control models
        # For now, create placeholder groups
        if assessment.grouping_method == 'family':
            families = cls._get_control_families(assessment.framework_ids)
            for idx, family in enumerate(families):
                group = ControlGroup.objects.create(
                    master_assessment=assessment,
                    name=family['name'],
                    description=family.get('description', ''),
                    group_type='family',
                    sequence=idx,
                    control_references=family.get('control_ids', []),
                    total_controls=len(family.get('control_ids', [])),
                )
                groups.append(group)

        assessment.total_groups = len(groups)
        assessment.total_controls = sum(g.total_controls for g in groups)
        assessment.save()

        return groups

    @classmethod
    def _get_control_families(cls, framework_ids: List[str]) -> List[Dict]:
        """Get control families from frameworks."""
        # Placeholder - would integrate with actual framework data
        return [
            {'name': 'Access Control', 'control_ids': ['AC-1', 'AC-2', 'AC-3']},
            {'name': 'Audit and Accountability', 'control_ids': ['AU-1', 'AU-2', 'AU-3']},
            {'name': 'Security Assessment', 'control_ids': ['CA-1', 'CA-2', 'CA-3']},
            {'name': 'Configuration Management', 'control_ids': ['CM-1', 'CM-2', 'CM-3']},
            {'name': 'Contingency Planning', 'control_ids': ['CP-1', 'CP-2', 'CP-3']},
        ]

    @classmethod
    def assign_group(
        cls,
        group_id: str,
        user_id: str,
    ) -> ControlGroup:
        """Assign a control group to an assessor."""
        group = ControlGroup.objects.get(id=group_id)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(id=user_id)

        group.assigned_to = user
        group.save()

        return group

    @classmethod
    def start_group_testing(cls, group_id: str) -> ControlGroup:
        """Start testing a control group."""
        group = ControlGroup.objects.get(id=group_id)
        group.status = 'in_progress'
        group.started_at = timezone.now()
        group.save()

        # Create test cases for controls in group
        for idx, control_ref in enumerate(group.control_references):
            TestCase.objects.create(
                control_group=group,
                control_id=control_ref,
                control_name=f"Control {control_ref}",
                test_procedure="Verify control implementation",
                sequence=idx,
            )

        return group

    @classmethod
    def complete_group(cls, group_id: str) -> ControlGroup:
        """Complete testing a control group."""
        group = ControlGroup.objects.get(id=group_id)
        group.status = 'completed'
        group.completed_at = timezone.now()

        # Calculate results
        results = TestResult.objects.filter(test_case__control_group=group)
        group.tested_controls = results.exclude(result='not_tested').count()
        group.passed_controls = results.filter(result='pass').count()
        group.save()

        # Update master assessment progress
        assessment = group.master_assessment
        completed = assessment.groups.filter(status='completed').count()
        tested = sum(g.tested_controls for g in assessment.groups.all())

        assessment.completed_groups = completed
        assessment.tested_controls = tested
        assessment.save()

        return group

    @classmethod
    def apply_inheritance(cls, assessment_id: str) -> Dict:
        """Apply control inheritance across groups."""
        assessment = MasterAssessment.objects.get(id=assessment_id)

        if not assessment.enable_inheritance:
            return {'inherited': 0}

        # Find common controls and apply inheritance
        inherited_count = 0
        # Implementation would compare control results and inherit where appropriate

        return {'inherited': inherited_count}

    @classmethod
    def get_consolidated_results(cls, assessment_id: str) -> Dict:
        """Get consolidated results across all groups."""
        assessment = MasterAssessment.objects.get(id=assessment_id)
        groups = assessment.groups.all()

        results = {
            'assessment_id': str(assessment.id),
            'name': assessment.name,
            'status': assessment.status,
            'frameworks': assessment.framework_ids,
            'total_groups': assessment.total_groups,
            'completed_groups': assessment.completed_groups,
            'total_controls': assessment.total_controls,
            'tested_controls': assessment.tested_controls,
            'progress_percentage': assessment.progress_percentage,
            'groups': [],
            'by_framework': {},
            'by_status': {
                'pass': 0,
                'fail': 0,
                'partial': 0,
                'na': 0,
                'not_tested': 0,
            }
        }

        for group in groups:
            group_results = TestResult.objects.filter(test_case__control_group=group)
            group_data = {
                'id': str(group.id),
                'name': group.name,
                'status': group.status,
                'total': group.total_controls,
                'tested': group.tested_controls,
                'passed': group.passed_controls,
                'assigned_to': str(group.assigned_to) if group.assigned_to else None,
            }
            results['groups'].append(group_data)

            # Aggregate by status
            for result in group_results:
                results['by_status'][result.result] = results['by_status'].get(result.result, 0) + 1

        return results


class AssessmentExecutionService:
    """
    Service for executing assessments.
    """

    @classmethod
    def create_run(
        cls,
        assessment_type: str,
        assessment_id: str,
        run_type: str = 'initial',
        user=None,
    ) -> AssessmentRun:
        """Create a new assessment run."""
        if assessment_type == 'lightning':
            assessment = LightningAssessment.objects.get(id=assessment_id)
            existing_runs = AssessmentRun.objects.filter(lightning_assessment=assessment)
            run = AssessmentRun.objects.create(
                lightning_assessment=assessment,
                run_number=existing_runs.count() + 1,
                run_type=run_type,
                executed_by=user,
            )
        else:
            assessment = MasterAssessment.objects.get(id=assessment_id)
            existing_runs = AssessmentRun.objects.filter(master_assessment=assessment)
            run = AssessmentRun.objects.create(
                master_assessment=assessment,
                run_number=existing_runs.count() + 1,
                run_type=run_type,
                executed_by=user,
            )

        return run

    @classmethod
    def start_run(cls, run_id: str) -> AssessmentRun:
        """Start an assessment run."""
        run = AssessmentRun.objects.get(id=run_id)
        run.status = 'running'
        run.actual_start = timezone.now()
        run.save()

        return run

    @classmethod
    def pause_run(cls, run_id: str) -> AssessmentRun:
        """Pause an assessment run."""
        run = AssessmentRun.objects.get(id=run_id)
        run.status = 'paused'
        run.save()

        return run

    @classmethod
    def complete_run(cls, run_id: str) -> AssessmentRun:
        """Complete an assessment run."""
        run = AssessmentRun.objects.get(id=run_id)
        run.status = 'completed'
        run.actual_end = timezone.now()

        # Capture results snapshot
        if run.lightning_assessment:
            run.results_snapshot = run.lightning_assessment.results_summary
        elif run.master_assessment:
            run.results_snapshot = MasterAssessmentService.get_consolidated_results(
                str(run.master_assessment.id)
            )

        run.save()

        return run


class BulkOperationService:
    """
    Service for bulk operations on assessments.
    """

    @classmethod
    def bulk_update_status(
        cls,
        test_case_ids: List[str],
        result: str,
        notes: str = '',
        user=None,
    ) -> int:
        """Bulk update status for multiple test cases."""
        updated = 0

        with transaction.atomic():
            for tc_id in test_case_ids:
                TestResult.objects.create(
                    test_case_id=tc_id,
                    result=result,
                    notes=notes,
                    tested_by=user,
                    tested_at=timezone.now(),
                )
                updated += 1

        return updated

    @classmethod
    def bulk_assign_evidence(
        cls,
        test_case_ids: List[str],
        evidence_ids: List[str],
    ) -> int:
        """Bulk assign evidence to test cases."""
        updated = 0

        with transaction.atomic():
            for tc_id in test_case_ids:
                latest_result = TestResult.objects.filter(
                    test_case_id=tc_id
                ).order_by('-tested_at').first()

                if latest_result:
                    existing = latest_result.evidence_ids or []
                    latest_result.evidence_ids = list(set(existing + evidence_ids))
                    latest_result.save()
                    updated += 1

        return updated

    @classmethod
    def copy_results(
        cls,
        source_assessment_id: str,
        target_assessment_id: str,
        include_evidence: bool = True,
    ) -> int:
        """Copy results from one assessment to another."""
        copied = 0

        source = LightningAssessment.objects.get(id=source_assessment_id)
        target = LightningAssessment.objects.get(id=target_assessment_id)

        with transaction.atomic():
            for source_tc in source.test_cases.all():
                target_tc = target.test_cases.filter(
                    control_id=source_tc.control_id
                ).first()

                if target_tc:
                    source_result = source_tc.results.order_by('-tested_at').first()
                    if source_result:
                        TestResult.objects.create(
                            test_case=target_tc,
                            result=source_result.result,
                            actual_result=source_result.actual_result,
                            notes=f"Copied from {source.name}",
                            evidence_ids=source_result.evidence_ids if include_evidence else [],
                            findings=source_result.findings,
                            recommendations=source_result.recommendations,
                        )
                        copied += 1

        return copied
