"""
Assessment Engine API Views

REST API endpoints for Lightning Assessment and Master Assessment functionality.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import (
    LightningAssessment,
    MasterAssessment,
    AssessmentTemplate,
    ControlGroup,
    TestCase,
    TestResult,
    AssessmentRun,
)
from .services import (
    LightningAssessmentService,
    MasterAssessmentService,
    AssessmentExecutionService,
    BulkOperationService,
)


class AssessmentTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for AssessmentTemplate CRUD operations.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = AssessmentTemplate.objects.all()

        # Filter by template type
        template_type = self.request.query_params.get('type')
        if template_type:
            queryset = queryset.filter(template_type=template_type)

        # Filter by public/private
        is_public = self.request.query_params.get('public')
        if is_public is not None:
            queryset = queryset.filter(is_public=is_public == 'true')

        return queryset.order_by('-times_used', 'name')

    def get_serializer_data(self, instance):
        return {
            'id': str(instance.id),
            'name': instance.name,
            'description': instance.description,
            'template_type': instance.template_type,
            'configuration': instance.configuration,
            'default_test_cases': instance.default_test_cases,
            'is_public': instance.is_public,
            'times_used': instance.times_used,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
            'updated_at': instance.updated_at.isoformat() if instance.updated_at else None,
        }

    def list(self, request):
        queryset = self.get_queryset()
        data = [self.get_serializer_data(t) for t in queryset]
        return Response(data)

    def retrieve(self, request, pk=None):
        template = get_object_or_404(AssessmentTemplate, pk=pk)
        return Response(self.get_serializer_data(template))

    def create(self, request):
        data = request.data
        template = AssessmentTemplate.objects.create(
            name=data.get('name'),
            description=data.get('description', ''),
            template_type=data.get('template_type', 'lightning'),
            configuration=data.get('configuration', {}),
            default_test_cases=data.get('default_test_cases', []),
            is_public=data.get('is_public', False),
            created_by=request.user,
        )
        return Response(self.get_serializer_data(template), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        template = get_object_or_404(AssessmentTemplate, pk=pk)
        data = request.data

        template.name = data.get('name', template.name)
        template.description = data.get('description', template.description)
        template.template_type = data.get('template_type', template.template_type)
        template.configuration = data.get('configuration', template.configuration)
        template.default_test_cases = data.get('default_test_cases', template.default_test_cases)
        template.is_public = data.get('is_public', template.is_public)
        template.save()

        return Response(self.get_serializer_data(template))

    def destroy(self, request, pk=None):
        template = get_object_or_404(AssessmentTemplate, pk=pk)
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LightningAssessmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Lightning Assessment operations.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = LightningAssessment.objects.all()

        # Filter by status
        assessment_status = self.request.query_params.get('status')
        if assessment_status:
            queryset = queryset.filter(status=assessment_status)

        return queryset.order_by('-created_at')

    def get_serializer_data(self, instance, include_test_cases=False):
        data = {
            'id': str(instance.id),
            'name': instance.name,
            'description': instance.description,
            'status': instance.status,
            'scoring_method': instance.scoring_method,
            'scope': instance.scope,
            'total_controls': instance.total_controls,
            'tested_controls': instance.tested_controls,
            'passed_controls': instance.passed_controls,
            'failed_controls': instance.failed_controls,
            'not_applicable': instance.not_applicable,
            'progress_percentage': instance.progress_percentage,
            'compliance_score': instance.compliance_score,
            'started_at': instance.started_at.isoformat() if instance.started_at else None,
            'completed_at': instance.completed_at.isoformat() if instance.completed_at else None,
            'target_completion': instance.target_completion.isoformat() if instance.target_completion else None,
            'results_summary': instance.results_summary,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
            'updated_at': instance.updated_at.isoformat() if instance.updated_at else None,
        }

        if include_test_cases:
            data['test_cases'] = [
                {
                    'id': str(tc.id),
                    'control_id': tc.control_id,
                    'control_name': tc.control_name,
                    'test_procedure': tc.test_procedure,
                    'expected_result': tc.expected_result,
                    'test_type': tc.test_type,
                    'priority': tc.priority,
                    'sequence': tc.sequence,
                }
                for tc in instance.test_cases.all().order_by('sequence')
            ]

            data['results'] = {
                str(tr.test_case_id): {
                    'id': str(tr.id),
                    'result': tr.result,
                    'actual_result': tr.actual_result,
                    'notes': tr.notes,
                    'findings': tr.findings,
                    'recommendations': tr.recommendations,
                    'tested_by': tr.tested_by.username if tr.tested_by else None,
                    'tested_at': tr.tested_at.isoformat() if tr.tested_at else None,
                }
                for tr in TestResult.objects.filter(test_case__lightning_assessment=instance)
            }

        return data

    def list(self, request):
        queryset = self.get_queryset()
        data = [self.get_serializer_data(a) for a in queryset]
        return Response(data)

    def retrieve(self, request, pk=None):
        assessment = get_object_or_404(LightningAssessment, pk=pk)
        return Response(self.get_serializer_data(assessment, include_test_cases=True))

    def create(self, request):
        data = request.data
        service = LightningAssessmentService()

        assessment = service.create_assessment(
            name=data.get('name'),
            description=data.get('description', ''),
            scope=data.get('scope', {}),
            scoring_method=data.get('scoring_method', 'pass_fail'),
            template_id=data.get('template_id'),
            created_by=request.user,
        )

        return Response(self.get_serializer_data(assessment), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        assessment = get_object_or_404(LightningAssessment, pk=pk)
        data = request.data

        assessment.name = data.get('name', assessment.name)
        assessment.description = data.get('description', assessment.description)
        assessment.scope = data.get('scope', assessment.scope)
        assessment.scoring_method = data.get('scoring_method', assessment.scoring_method)
        assessment.target_completion = data.get('target_completion', assessment.target_completion)
        assessment.save()

        return Response(self.get_serializer_data(assessment))

    def destroy(self, request, pk=None):
        assessment = get_object_or_404(LightningAssessment, pk=pk)
        assessment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start the assessment."""
        assessment = get_object_or_404(LightningAssessment, pk=pk)
        assessment.start()
        return Response(self.get_serializer_data(assessment))

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete the assessment."""
        assessment = get_object_or_404(LightningAssessment, pk=pk)
        assessment.complete()
        return Response(self.get_serializer_data(assessment))

    @action(detail=True, methods=['post'])
    def record_result(self, request, pk=None):
        """Record a test result for a specific test case."""
        assessment = get_object_or_404(LightningAssessment, pk=pk)
        data = request.data

        service = AssessmentExecutionService()
        result = service.record_test_result(
            assessment=assessment,
            test_case_id=data.get('test_case_id'),
            result=data.get('result'),
            actual_result=data.get('actual_result', ''),
            notes=data.get('notes', ''),
            findings=data.get('findings', ''),
            recommendations=data.get('recommendations', ''),
            tested_by=request.user,
        )

        return Response({
            'id': str(result.id),
            'result': result.result,
            'tested_at': result.tested_at.isoformat() if result.tested_at else None,
        })

    @action(detail=True, methods=['post'])
    def bulk_record(self, request, pk=None):
        """Bulk record test results."""
        assessment = get_object_or_404(LightningAssessment, pk=pk)
        data = request.data

        service = BulkOperationService()
        results = service.bulk_update_results(
            assessment=assessment,
            test_case_ids=data.get('test_case_ids', []),
            result=data.get('result'),
            notes=data.get('notes', ''),
            user=request.user,
        )

        return Response({
            'updated_count': len(results),
            'test_case_ids': [str(r.test_case_id) for r in results],
        })

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """Export assessment results."""
        assessment = get_object_or_404(LightningAssessment, pk=pk)
        export_format = request.query_params.get('format', 'json')

        service = LightningAssessmentService()
        export_data = service.export_results(assessment, export_format)

        return Response(export_data)


class MasterAssessmentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Master Assessment operations.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = MasterAssessment.objects.all()

        # Filter by status
        assessment_status = self.request.query_params.get('status')
        if assessment_status:
            queryset = queryset.filter(status=assessment_status)

        return queryset.order_by('-created_at')

    def get_serializer_data(self, instance, include_groups=False):
        data = {
            'id': str(instance.id),
            'name': instance.name,
            'description': instance.description,
            'status': instance.status,
            'framework_ids': instance.framework_ids,
            'perimeter_ids': instance.perimeter_ids,
            'grouping_method': instance.grouping_method,
            'total_groups': instance.total_groups,
            'completed_groups': instance.completed_groups,
            'total_controls': instance.total_controls,
            'tested_controls': instance.tested_controls,
            'progress_percentage': instance.progress_percentage,
            'enable_inheritance': instance.enable_inheritance,
            'planned_start': instance.planned_start.isoformat() if instance.planned_start else None,
            'planned_end': instance.planned_end.isoformat() if instance.planned_end else None,
            'actual_start': instance.actual_start.isoformat() if instance.actual_start else None,
            'actual_end': instance.actual_end.isoformat() if instance.actual_end else None,
            'results': instance.results,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
            'updated_at': instance.updated_at.isoformat() if instance.updated_at else None,
        }

        if include_groups:
            data['groups'] = [
                {
                    'id': str(g.id),
                    'name': g.name,
                    'description': g.description,
                    'group_type': g.group_type,
                    'sequence': g.sequence,
                    'status': g.status,
                    'assigned_to': g.assigned_to.username if g.assigned_to else None,
                    'total_controls': g.total_controls,
                    'tested_controls': g.tested_controls,
                    'passed_controls': g.passed_controls,
                    'started_at': g.started_at.isoformat() if g.started_at else None,
                    'completed_at': g.completed_at.isoformat() if g.completed_at else None,
                }
                for g in instance.groups.all().order_by('sequence')
            ]

        return data

    def list(self, request):
        queryset = self.get_queryset()
        data = [self.get_serializer_data(a) for a in queryset]
        return Response(data)

    def retrieve(self, request, pk=None):
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        return Response(self.get_serializer_data(assessment, include_groups=True))

    def create(self, request):
        data = request.data
        service = MasterAssessmentService()

        assessment = service.create_assessment(
            name=data.get('name'),
            description=data.get('description', ''),
            framework_ids=data.get('framework_ids', []),
            perimeter_ids=data.get('perimeter_ids', []),
            grouping_method=data.get('grouping_method', 'family'),
            enable_inheritance=data.get('enable_inheritance', True),
            created_by=request.user,
        )

        return Response(self.get_serializer_data(assessment), status=status.HTTP_201_CREATED)

    def update(self, request, pk=None):
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        data = request.data

        assessment.name = data.get('name', assessment.name)
        assessment.description = data.get('description', assessment.description)
        assessment.planned_start = data.get('planned_start', assessment.planned_start)
        assessment.planned_end = data.get('planned_end', assessment.planned_end)
        assessment.save()

        return Response(self.get_serializer_data(assessment))

    def destroy(self, request, pk=None):
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        assessment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start the master assessment."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        assessment.status = MasterAssessment.Status.IN_PROGRESS
        assessment.actual_start = timezone.now()
        assessment.save()
        return Response(self.get_serializer_data(assessment))

    @action(detail=True, methods=['post'])
    def submit_for_review(self, request, pk=None):
        """Submit for review."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        assessment.status = MasterAssessment.Status.REVIEW
        assessment.save()
        return Response(self.get_serializer_data(assessment))

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete the master assessment."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)
        assessment.status = MasterAssessment.Status.COMPLETED
        assessment.actual_end = timezone.now()
        assessment.save()
        return Response(self.get_serializer_data(assessment))

    @action(detail=True, methods=['post'])
    def apply_inheritance(self, request, pk=None):
        """Apply control inheritance across frameworks."""
        assessment = get_object_or_404(MasterAssessment, pk=pk)

        service = MasterAssessmentService()
        inherited_count = service.apply_inheritance(assessment)

        return Response({
            'inherited_count': inherited_count,
            'assessment': self.get_serializer_data(assessment),
        })


class ControlGroupViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Control Group operations within a Master Assessment.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        assessment_id = self.kwargs.get('assessment_pk')
        return ControlGroup.objects.filter(master_assessment_id=assessment_id).order_by('sequence')

    def get_serializer_data(self, instance, include_test_cases=False):
        data = {
            'id': str(instance.id),
            'name': instance.name,
            'description': instance.description,
            'group_type': instance.group_type,
            'sequence': instance.sequence,
            'status': instance.status,
            'assigned_to': instance.assigned_to.username if instance.assigned_to else None,
            'total_controls': instance.total_controls,
            'tested_controls': instance.tested_controls,
            'passed_controls': instance.passed_controls,
            'started_at': instance.started_at.isoformat() if instance.started_at else None,
            'completed_at': instance.completed_at.isoformat() if instance.completed_at else None,
        }

        if include_test_cases:
            data['test_cases'] = [
                {
                    'id': str(tc.id),
                    'control_id': tc.control_id,
                    'control_name': tc.control_name,
                    'test_procedure': tc.test_procedure,
                    'expected_result': tc.expected_result,
                    'test_type': tc.test_type,
                    'priority': tc.priority,
                    'sequence': tc.sequence,
                }
                for tc in instance.test_cases.all().order_by('sequence')
            ]

            data['results'] = {
                str(tr.test_case_id): {
                    'id': str(tr.id),
                    'result': tr.result,
                    'actual_result': tr.actual_result,
                    'notes': tr.notes,
                    'findings': tr.findings,
                    'recommendations': tr.recommendations,
                    'tested_by': tr.tested_by.username if tr.tested_by else None,
                    'tested_at': tr.tested_at.isoformat() if tr.tested_at else None,
                }
                for tr in TestResult.objects.filter(test_case__control_group=instance)
            }

        return data

    def list(self, request, assessment_pk=None):
        queryset = self.get_queryset()
        data = [self.get_serializer_data(g) for g in queryset]
        return Response(data)

    def retrieve(self, request, assessment_pk=None, pk=None):
        group = get_object_or_404(ControlGroup, pk=pk, master_assessment_id=assessment_pk)
        return Response(self.get_serializer_data(group, include_test_cases=True))

    @action(detail=True, methods=['post'])
    def start(self, request, assessment_pk=None, pk=None):
        """Start working on this control group."""
        group = get_object_or_404(ControlGroup, pk=pk, master_assessment_id=assessment_pk)
        group.status = 'in_progress'
        group.started_at = timezone.now()
        group.save()
        return Response(self.get_serializer_data(group))

    @action(detail=True, methods=['post'])
    def complete(self, request, assessment_pk=None, pk=None):
        """Complete this control group."""
        group = get_object_or_404(ControlGroup, pk=pk, master_assessment_id=assessment_pk)
        group.status = 'completed'
        group.completed_at = timezone.now()
        group.save()

        # Update master assessment progress
        assessment = group.master_assessment
        assessment.completed_groups = assessment.groups.filter(status='completed').count()
        assessment.save()

        return Response(self.get_serializer_data(group))

    @action(detail=True, methods=['post'])
    def assign(self, request, assessment_pk=None, pk=None):
        """Assign this group to a user."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        group = get_object_or_404(ControlGroup, pk=pk, master_assessment_id=assessment_pk)
        user_id = request.data.get('user_id')

        if user_id:
            user = get_object_or_404(User, pk=user_id)
            group.assigned_to = user
        else:
            group.assigned_to = None

        group.save()
        return Response(self.get_serializer_data(group))


class TestResultViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Test Result operations.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TestResult.objects.all().order_by('-tested_at')

    def get_serializer_data(self, instance):
        return {
            'id': str(instance.id),
            'test_case_id': str(instance.test_case_id),
            'result': instance.result,
            'score': str(instance.score) if instance.score else None,
            'actual_result': instance.actual_result,
            'notes': instance.notes,
            'evidence_ids': instance.evidence_ids,
            'findings': instance.findings,
            'recommendations': instance.recommendations,
            'tested_by': instance.tested_by.username if instance.tested_by else None,
            'tested_at': instance.tested_at.isoformat() if instance.tested_at else None,
            'reviewed_by': instance.reviewed_by.username if instance.reviewed_by else None,
            'reviewed_at': instance.reviewed_at.isoformat() if instance.reviewed_at else None,
        }

    def create(self, request):
        data = request.data
        test_case = get_object_or_404(TestCase, pk=data.get('test_case_id'))

        result, created = TestResult.objects.update_or_create(
            test_case=test_case,
            defaults={
                'result': data.get('result', 'not_tested'),
                'actual_result': data.get('actual_result', ''),
                'notes': data.get('notes', ''),
                'findings': data.get('findings', ''),
                'recommendations': data.get('recommendations', ''),
                'evidence_ids': data.get('evidence_ids', []),
                'tested_by': request.user,
                'tested_at': timezone.now(),
            }
        )

        return Response(
            self.get_serializer_data(result),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """Mark a test result as reviewed."""
        result = get_object_or_404(TestResult, pk=pk)
        result.reviewed_by = request.user
        result.reviewed_at = timezone.now()
        result.save()
        return Response(self.get_serializer_data(result))


class AssessmentRunViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Assessment Run tracking.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AssessmentRun.objects.all().order_by('-created_at')

    def get_serializer_data(self, instance):
        return {
            'id': str(instance.id),
            'lightning_assessment_id': str(instance.lightning_assessment_id) if instance.lightning_assessment_id else None,
            'master_assessment_id': str(instance.master_assessment_id) if instance.master_assessment_id else None,
            'run_number': instance.run_number,
            'run_type': instance.run_type,
            'status': instance.status,
            'scheduled_start': instance.scheduled_start.isoformat() if instance.scheduled_start else None,
            'actual_start': instance.actual_start.isoformat() if instance.actual_start else None,
            'actual_end': instance.actual_end.isoformat() if instance.actual_end else None,
            'executed_by': instance.executed_by.username if instance.executed_by else None,
            'results_snapshot': instance.results_snapshot,
            'notes': instance.notes,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
        }

    def list(self, request):
        queryset = self.get_queryset()

        # Filter by assessment
        lightning_id = request.query_params.get('lightning_assessment')
        master_id = request.query_params.get('master_assessment')

        if lightning_id:
            queryset = queryset.filter(lightning_assessment_id=lightning_id)
        if master_id:
            queryset = queryset.filter(master_assessment_id=master_id)

        data = [self.get_serializer_data(r) for r in queryset]
        return Response(data)

    def retrieve(self, request, pk=None):
        run = get_object_or_404(AssessmentRun, pk=pk)
        return Response(self.get_serializer_data(run))
