"""
Master Assessment Feature

Orchestrates assessments across multiple systems, frameworks, and KSIs.
Provides task generation, assignment, tracking, and reporting capabilities.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional, Set
from uuid import UUID
import uuid

from django.db import models, transaction
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# Models
# =============================================================================

class MasterAssessment(models.Model):
    """
    A master assessment that orchestrates evaluation across multiple targets.

    Can assess multiple systems against multiple frameworks, generating
    individual tasks for each assessment item.
    """

    class AssessmentType(models.TextChoices):
        FEDRAMP_ANNUAL = 'fedramp_annual', 'FedRAMP Annual Assessment'
        FEDRAMP_3PAO = 'fedramp_3pao', 'FedRAMP 3PAO Assessment'
        KSI_VALIDATION = 'ksi_validation', 'KSI Validation Assessment'
        CONTROL_TESTING = 'control_testing', 'Control Testing'
        RISK_ASSESSMENT = 'risk_assessment', 'Risk Assessment'
        GAP_ANALYSIS = 'gap_analysis', 'Gap Analysis'
        READINESS = 'readiness', 'Readiness Assessment'
        CONTINUOUS_MONITORING = 'conmon', 'Continuous Monitoring'
        CUSTOM = 'custom', 'Custom Assessment'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PLANNING = 'planning', 'Planning'
        IN_PROGRESS = 'in_progress', 'In Progress'
        REVIEW = 'review', 'Under Review'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    assessment_type = models.CharField(
        max_length=30,
        choices=AssessmentType.choices,
        default=AssessmentType.CUSTOM
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Target scope - can assess multiple CSOs/systems
    target_systems = models.JSONField(default=list)  # List of system/CSO UUIDs
    target_frameworks = models.JSONField(default=list)  # List of framework refs

    # Associated workflow for automation
    workflow_id = models.UUIDField(null=True, blank=True)

    # Timeline
    planned_start_date = models.DateField(null=True, blank=True)
    planned_end_date = models.DateField(null=True, blank=True)
    actual_start_date = models.DateField(null=True, blank=True)
    actual_end_date = models.DateField(null=True, blank=True)

    # Assignment
    lead_assessor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='led_assessments'
    )
    assessor_team = models.JSONField(default=list)  # List of user IDs

    # Configuration
    settings = models.JSONField(default=dict)
    # Example settings:
    # {
    #   "sampling_rate": 0.3,
    #   "evidence_required": true,
    #   "auto_generate_poams": true,
    #   "notify_on_findings": true,
    # }

    # Results summary
    summary = models.JSONField(default=dict)
    # Example summary:
    # {
    #   "total_tasks": 100,
    #   "completed_tasks": 85,
    #   "findings_count": 12,
    #   "pass_rate": 0.88,
    # }

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_assessments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        app_label = 'workflow_engine'

    def __str__(self):
        return f"{self.name} ({self.get_assessment_type_display()})"

    @property
    def completion_percentage(self) -> float:
        """Calculate completion percentage from summary."""
        total = self.summary.get('total_tasks', 0)
        completed = self.summary.get('completed_tasks', 0)
        return (completed / total * 100) if total > 0 else 0

    @property
    def is_overdue(self) -> bool:
        """Check if assessment is overdue."""
        if self.planned_end_date and self.status not in [self.Status.COMPLETED, self.Status.CANCELLED]:
            return date.today() > self.planned_end_date
        return False


class AssessmentTask(models.Model):
    """
    An individual task within a master assessment.

    Represents a single assessment item (control, KSI, requirement)
    that needs to be evaluated.
    """

    class TaskType(models.TextChoices):
        CONTROL_TEST = 'control_test', 'Control Test'
        KSI_VALIDATION = 'ksi_validation', 'KSI Validation'
        EVIDENCE_REVIEW = 'evidence_review', 'Evidence Review'
        INTERVIEW = 'interview', 'Interview'
        OBSERVATION = 'observation', 'Observation'
        DOCUMENT_REVIEW = 'document_review', 'Document Review'
        TECHNICAL_TEST = 'technical_test', 'Technical Test'
        VULNERABILITY_SCAN = 'vuln_scan', 'Vulnerability Scan'
        PENETRATION_TEST = 'pen_test', 'Penetration Test'
        CONFIGURATION_REVIEW = 'config_review', 'Configuration Review'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ASSIGNED = 'assigned', 'Assigned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        BLOCKED = 'blocked', 'Blocked'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    class Result(models.TextChoices):
        NOT_ASSESSED = 'not_assessed', 'Not Assessed'
        PASS = 'pass', 'Pass'
        FAIL = 'fail', 'Fail'
        PARTIAL = 'partial', 'Partial'
        NOT_APPLICABLE = 'na', 'Not Applicable'
        INCONCLUSIVE = 'inconclusive', 'Inconclusive'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    master_assessment = models.ForeignKey(
        MasterAssessment,
        on_delete=models.CASCADE,
        related_name='tasks'
    )

    # Task identification
    task_type = models.CharField(
        max_length=20,
        choices=TaskType.choices,
        default=TaskType.CONTROL_TEST
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Target references
    target_ksi_id = models.UUIDField(null=True, blank=True)
    target_control_id = models.UUIDField(null=True, blank=True)
    target_system_id = models.UUIDField(null=True, blank=True)
    reference_id = models.CharField(max_length=100, blank=True)  # e.g., KSI-IAM-01, AC-2

    # Status and result
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    result = models.CharField(
        max_length=20,
        choices=Result.choices,
        default=Result.NOT_ASSESSED
    )

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_assessment_tasks'
    )

    # Dependencies
    depends_on = models.ManyToManyField(
        'self',
        symmetrical=False,
        related_name='dependents',
        blank=True
    )

    # Timeline
    due_date = models.DateField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Evidence and findings
    evidence = models.JSONField(default=list)  # List of evidence IDs
    findings = models.JSONField(default=list)  # List of findings
    notes = models.TextField(blank=True)

    # Test procedures
    test_procedures = models.JSONField(default=list)
    # Example:
    # [
    #   {"step": 1, "procedure": "Review MFA configuration", "expected": "MFA enabled"},
    #   {"step": 2, "procedure": "Test login with MFA", "expected": "MFA prompted"},
    # ]

    # Scoring (for quantitative assessments)
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    max_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Sequence for ordering
    sequence = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sequence', 'created_at']
        app_label = 'workflow_engine'

    def __str__(self):
        return f"{self.name} - {self.get_status_display()}"

    @property
    def is_blocked(self) -> bool:
        """Check if task is blocked by dependencies."""
        return self.depends_on.exclude(
            status=AssessmentTask.Status.COMPLETED
        ).exists()


# =============================================================================
# Service
# =============================================================================

@dataclass
class TaskGenerationOptions:
    """Options for generating assessment tasks."""
    include_ksis: bool = True
    include_controls: bool = True
    ksi_categories: List[str] = field(default_factory=list)
    control_families: List[str] = field(default_factory=list)
    sampling_rate: float = 1.0  # 1.0 = all, 0.3 = 30% sample
    task_types: List[str] = field(default_factory=list)


class MasterAssessmentService:
    """
    Service for managing master assessments.

    Handles assessment creation, task generation, tracking, and reporting.
    """

    def create_assessment(
        self,
        name: str,
        assessment_type: str,
        target_systems: List[UUID],
        target_frameworks: List[str] = None,
        lead_assessor_id: UUID = None,
        planned_start: date = None,
        planned_end: date = None,
        description: str = "",
        settings: Dict = None,
        created_by: UUID = None,
    ) -> MasterAssessment:
        """
        Create a new master assessment.

        Args:
            name: Assessment name
            assessment_type: Type of assessment
            target_systems: List of CSO/system UUIDs to assess
            target_frameworks: List of framework references
            lead_assessor_id: Lead assessor user ID
            planned_start: Planned start date
            planned_end: Planned end date
            description: Assessment description
            settings: Assessment configuration
            created_by: User creating the assessment

        Returns:
            Created MasterAssessment instance
        """
        assessment = MasterAssessment(
            name=name,
            description=description,
            assessment_type=assessment_type,
            target_systems=[str(s) for s in target_systems],
            target_frameworks=target_frameworks or [],
            planned_start_date=planned_start,
            planned_end_date=planned_end,
            settings=settings or {},
            lead_assessor_id=lead_assessor_id,
            created_by_id=created_by,
        )
        assessment.save()

        logger.info(f"Created master assessment: {assessment.id}")
        return assessment

    def generate_tasks(
        self,
        assessment: MasterAssessment,
        options: TaskGenerationOptions = None,
    ) -> List[AssessmentTask]:
        """
        Generate assessment tasks for a master assessment.

        Automatically creates tasks based on the assessment type and targets.

        Args:
            assessment: The master assessment
            options: Task generation options

        Returns:
            List of created AssessmentTask instances
        """
        options = options or TaskGenerationOptions()
        tasks = []

        with transaction.atomic():
            if assessment.assessment_type == MasterAssessment.AssessmentType.KSI_VALIDATION:
                tasks = self._generate_ksi_validation_tasks(assessment, options)
            elif assessment.assessment_type == MasterAssessment.AssessmentType.CONTROL_TESTING:
                tasks = self._generate_control_testing_tasks(assessment, options)
            elif assessment.assessment_type == MasterAssessment.AssessmentType.FEDRAMP_ANNUAL:
                tasks = self._generate_fedramp_annual_tasks(assessment, options)
            elif assessment.assessment_type == MasterAssessment.AssessmentType.GAP_ANALYSIS:
                tasks = self._generate_gap_analysis_tasks(assessment, options)
            else:
                # Generic task generation
                tasks = self._generate_generic_tasks(assessment, options)

            # Update assessment summary
            assessment.summary['total_tasks'] = len(tasks)
            assessment.summary['completed_tasks'] = 0
            assessment.status = MasterAssessment.Status.PLANNING
            assessment.save()

        logger.info(f"Generated {len(tasks)} tasks for assessment {assessment.id}")
        return tasks

    def _generate_ksi_validation_tasks(
        self,
        assessment: MasterAssessment,
        options: TaskGenerationOptions,
    ) -> List[AssessmentTask]:
        """Generate tasks for KSI validation assessment."""
        tasks = []
        sequence = 0

        for system_id in assessment.target_systems:
            # Get KSIs for this system
            ksis = self._get_ksis_for_system(UUID(system_id), options.ksi_categories)

            for ksi in ksis:
                # Apply sampling if configured
                if options.sampling_rate < 1.0:
                    import random
                    if random.random() > options.sampling_rate:
                        continue

                task = AssessmentTask(
                    master_assessment=assessment,
                    task_type=AssessmentTask.TaskType.KSI_VALIDATION,
                    name=f"Validate {ksi.get('ref_id', 'KSI')}",
                    description=f"Validate compliance for {ksi.get('name', 'KSI')}",
                    target_ksi_id=ksi.get('id'),
                    target_system_id=UUID(system_id),
                    reference_id=ksi.get('ref_id', ''),
                    test_procedures=self._get_ksi_test_procedures(ksi.get('ref_id')),
                    sequence=sequence,
                )
                task.save()
                tasks.append(task)
                sequence += 1

        return tasks

    def _generate_control_testing_tasks(
        self,
        assessment: MasterAssessment,
        options: TaskGenerationOptions,
    ) -> List[AssessmentTask]:
        """Generate tasks for control testing assessment."""
        tasks = []
        sequence = 0

        for system_id in assessment.target_systems:
            for framework in assessment.target_frameworks:
                # Get controls for this framework
                controls = self._get_controls_for_framework(
                    UUID(system_id),
                    framework,
                    options.control_families
                )

                for control in controls:
                    if options.sampling_rate < 1.0:
                        import random
                        if random.random() > options.sampling_rate:
                            continue

                    task = AssessmentTask(
                        master_assessment=assessment,
                        task_type=AssessmentTask.TaskType.CONTROL_TEST,
                        name=f"Test {control.get('ref_id', 'Control')}",
                        description=f"Test implementation of {control.get('name', 'Control')}",
                        target_control_id=control.get('id'),
                        target_system_id=UUID(system_id),
                        reference_id=control.get('ref_id', ''),
                        sequence=sequence,
                    )
                    task.save()
                    tasks.append(task)
                    sequence += 1

        return tasks

    def _generate_fedramp_annual_tasks(
        self,
        assessment: MasterAssessment,
        options: TaskGenerationOptions,
    ) -> List[AssessmentTask]:
        """Generate tasks for FedRAMP annual assessment."""
        tasks = []
        sequence = 0

        for system_id in assessment.target_systems:
            # Generate KSI validation tasks
            ksi_tasks = self._generate_ksi_validation_tasks(assessment, options)
            tasks.extend(ksi_tasks)
            sequence = len(tasks)

            # Add additional FedRAMP-specific tasks
            fedramp_tasks = [
                {
                    'type': AssessmentTask.TaskType.DOCUMENT_REVIEW,
                    'name': 'SSP Review',
                    'description': 'Review System Security Plan for accuracy and completeness',
                    'ref': 'SSP-REVIEW',
                },
                {
                    'type': AssessmentTask.TaskType.VULNERABILITY_SCAN,
                    'name': 'Vulnerability Assessment',
                    'description': 'Perform vulnerability scanning and analysis',
                    'ref': 'VULN-SCAN',
                },
                {
                    'type': AssessmentTask.TaskType.PENETRATION_TEST,
                    'name': 'Penetration Testing',
                    'description': 'Conduct penetration testing per FedRAMP requirements',
                    'ref': 'PEN-TEST',
                },
                {
                    'type': AssessmentTask.TaskType.CONFIGURATION_REVIEW,
                    'name': 'Configuration Baseline Review',
                    'description': 'Verify configuration baselines are maintained',
                    'ref': 'CONFIG-REVIEW',
                },
                {
                    'type': AssessmentTask.TaskType.INTERVIEW,
                    'name': 'Staff Interviews',
                    'description': 'Conduct interviews with key security personnel',
                    'ref': 'INTERVIEWS',
                },
            ]

            for ft in fedramp_tasks:
                task = AssessmentTask(
                    master_assessment=assessment,
                    task_type=ft['type'],
                    name=ft['name'],
                    description=ft['description'],
                    target_system_id=UUID(system_id),
                    reference_id=ft['ref'],
                    sequence=sequence,
                )
                task.save()
                tasks.append(task)
                sequence += 1

        return tasks

    def _generate_gap_analysis_tasks(
        self,
        assessment: MasterAssessment,
        options: TaskGenerationOptions,
    ) -> List[AssessmentTask]:
        """Generate tasks for gap analysis assessment."""
        tasks = []
        sequence = 0

        for system_id in assessment.target_systems:
            for framework in assessment.target_frameworks:
                controls = self._get_controls_for_framework(UUID(system_id), framework, [])

                for control in controls:
                    task = AssessmentTask(
                        master_assessment=assessment,
                        task_type=AssessmentTask.TaskType.DOCUMENT_REVIEW,
                        name=f"Gap Analysis: {control.get('ref_id', 'Control')}",
                        description=f"Analyze implementation gap for {control.get('name', 'Control')}",
                        target_control_id=control.get('id'),
                        target_system_id=UUID(system_id),
                        reference_id=control.get('ref_id', ''),
                        sequence=sequence,
                    )
                    task.save()
                    tasks.append(task)
                    sequence += 1

        return tasks

    def _generate_generic_tasks(
        self,
        assessment: MasterAssessment,
        options: TaskGenerationOptions,
    ) -> List[AssessmentTask]:
        """Generate generic assessment tasks."""
        tasks = []

        # For generic assessments, create a single planning task
        task = AssessmentTask(
            master_assessment=assessment,
            task_type=AssessmentTask.TaskType.DOCUMENT_REVIEW,
            name="Assessment Planning",
            description="Plan and scope the assessment",
            sequence=0,
        )
        task.save()
        tasks.append(task)

        return tasks

    def _get_ksis_for_system(self, system_id: UUID, categories: List[str]) -> List[Dict]:
        """Get KSIs for a system, optionally filtered by categories."""
        try:
            from core.bounded_contexts.rmf_operations.models import KSIImplementation

            queryset = KSIImplementation.objects.filter(
                cloud_service_offering_id=system_id
            )

            if categories:
                # Filter by KSI category prefix
                from django.db.models import Q
                q = Q()
                for cat in categories:
                    q |= Q(ksi_ref_id__startswith=f'KSI-{cat}-')
                queryset = queryset.filter(q)

            return [
                {
                    'id': ksi.id,
                    'ref_id': ksi.ksi_ref_id,
                    'name': ksi.name,
                }
                for ksi in queryset
            ]
        except Exception as e:
            logger.warning(f"Error fetching KSIs: {e}")
            # Return sample data
            return [
                {'id': uuid.uuid4(), 'ref_id': 'KSI-IAM-01', 'name': 'MFA Enforcement'},
                {'id': uuid.uuid4(), 'ref_id': 'KSI-IAM-02', 'name': 'Phishing-Resistant MFA'},
                {'id': uuid.uuid4(), 'ref_id': 'KSI-CMT-01', 'name': 'Change Logging'},
            ]

    def _get_controls_for_framework(
        self,
        system_id: UUID,
        framework: str,
        families: List[str]
    ) -> List[Dict]:
        """Get controls for a framework, optionally filtered by families."""
        try:
            from core.models import AppliedControl

            queryset = AppliedControl.objects.filter(
                folder_id=system_id,
                reference_control__framework__ref_id=framework
            )

            if families:
                from django.db.models import Q
                q = Q()
                for family in families:
                    q |= Q(reference_control__ref_id__startswith=family)
                queryset = queryset.filter(q)

            return [
                {
                    'id': ctrl.id,
                    'ref_id': ctrl.reference_control.ref_id if ctrl.reference_control else '',
                    'name': ctrl.name,
                }
                for ctrl in queryset
            ]
        except Exception as e:
            logger.warning(f"Error fetching controls: {e}")
            return []

    def _get_ksi_test_procedures(self, ksi_ref: str) -> List[Dict]:
        """Get test procedures for a KSI."""
        # Define standard test procedures for common KSIs
        procedures = {
            'KSI-IAM-01': [
                {'step': 1, 'procedure': 'Review MFA policy configuration', 'expected': 'MFA required for all users'},
                {'step': 2, 'procedure': 'Verify MFA enrollment status', 'expected': '100% enrollment'},
                {'step': 3, 'procedure': 'Test login with MFA', 'expected': 'MFA prompt displayed'},
            ],
            'KSI-IAM-02': [
                {'step': 1, 'procedure': 'Review phishing-resistant MFA configuration', 'expected': 'WebAuthn/FIDO2 enabled'},
                {'step': 2, 'procedure': 'Test authentication flow', 'expected': 'Phishing-resistant method used'},
            ],
            'KSI-CMT-01': [
                {'step': 1, 'procedure': 'Review change logging configuration', 'expected': 'All changes logged'},
                {'step': 2, 'procedure': 'Verify log integrity', 'expected': 'Logs tamper-evident'},
                {'step': 3, 'procedure': 'Sample change records', 'expected': 'Complete audit trail'},
            ],
        }

        return procedures.get(ksi_ref, [
            {'step': 1, 'procedure': 'Review implementation evidence', 'expected': 'Evidence available'},
            {'step': 2, 'procedure': 'Verify control effectiveness', 'expected': 'Control effective'},
        ])

    def update_task_status(
        self,
        task_id: UUID,
        status: str,
        result: str = None,
        findings: List[Dict] = None,
        notes: str = None,
        score: float = None,
        completed_by: UUID = None,
    ) -> AssessmentTask:
        """
        Update an assessment task's status and results.

        Args:
            task_id: Task ID
            status: New status
            result: Assessment result
            findings: List of findings
            notes: Additional notes
            score: Score if applicable
            completed_by: User completing the task

        Returns:
            Updated AssessmentTask
        """
        task = AssessmentTask.objects.get(id=task_id)

        task.status = status
        if result:
            task.result = result
        if findings:
            task.findings = findings
        if notes:
            task.notes = notes
        if score is not None:
            task.score = score

        if status == AssessmentTask.Status.IN_PROGRESS and not task.started_at:
            task.started_at = timezone.now()

        if status == AssessmentTask.Status.COMPLETED:
            task.completed_at = timezone.now()

        task.save()

        # Update master assessment summary
        self._update_assessment_summary(task.master_assessment)

        return task

    def _update_assessment_summary(self, assessment: MasterAssessment):
        """Update the summary statistics for a master assessment."""
        tasks = assessment.tasks.all()

        total = tasks.count()
        completed = tasks.filter(status=AssessmentTask.Status.COMPLETED).count()
        passed = tasks.filter(result=AssessmentTask.Result.PASS).count()
        failed = tasks.filter(result=AssessmentTask.Result.FAIL).count()

        assessment.summary = {
            'total_tasks': total,
            'completed_tasks': completed,
            'pending_tasks': total - completed,
            'pass_count': passed,
            'fail_count': failed,
            'pass_rate': (passed / completed) if completed > 0 else 0,
            'completion_percentage': (completed / total * 100) if total > 0 else 0,
        }

        # Update status if all tasks complete
        if completed == total and total > 0:
            assessment.status = MasterAssessment.Status.REVIEW

        assessment.save()

    def generate_assessment_report(self, assessment: MasterAssessment) -> Dict[str, Any]:
        """
        Generate a comprehensive assessment report.

        Args:
            assessment: The master assessment

        Returns:
            Report data dictionary
        """
        tasks = assessment.tasks.all()

        # Group tasks by result
        by_result = {}
        for result_choice in AssessmentTask.Result.choices:
            by_result[result_choice[0]] = tasks.filter(result=result_choice[0]).count()

        # Group tasks by type
        by_type = {}
        for type_choice in AssessmentTask.TaskType.choices:
            by_type[type_choice[0]] = tasks.filter(task_type=type_choice[0]).count()

        # Collect all findings
        all_findings = []
        for task in tasks.filter(result=AssessmentTask.Result.FAIL):
            for finding in task.findings:
                all_findings.append({
                    'task_id': str(task.id),
                    'task_name': task.name,
                    'reference': task.reference_id,
                    **finding,
                })

        report = {
            'assessment': {
                'id': str(assessment.id),
                'name': assessment.name,
                'type': assessment.get_assessment_type_display(),
                'status': assessment.get_status_display(),
                'planned_start': assessment.planned_start_date.isoformat() if assessment.planned_start_date else None,
                'planned_end': assessment.planned_end_date.isoformat() if assessment.planned_end_date else None,
                'actual_start': assessment.actual_start_date.isoformat() if assessment.actual_start_date else None,
                'actual_end': assessment.actual_end_date.isoformat() if assessment.actual_end_date else None,
            },
            'summary': assessment.summary,
            'results': {
                'by_result': by_result,
                'by_type': by_type,
            },
            'findings': all_findings,
            'target_systems': assessment.target_systems,
            'target_frameworks': assessment.target_frameworks,
            'generated_at': timezone.now().isoformat(),
        }

        return report

    def assign_tasks(
        self,
        assessment: MasterAssessment,
        assignments: Dict[UUID, List[UUID]],  # {user_id: [task_ids]}
    ):
        """
        Bulk assign tasks to assessors.

        Args:
            assessment: The master assessment
            assignments: Mapping of user IDs to task IDs
        """
        with transaction.atomic():
            for user_id, task_ids in assignments.items():
                AssessmentTask.objects.filter(
                    master_assessment=assessment,
                    id__in=task_ids
                ).update(
                    assigned_to_id=user_id,
                    status=AssessmentTask.Status.ASSIGNED
                )

            # Update assessment status
            if assessment.status == MasterAssessment.Status.PLANNING:
                assessment.status = MasterAssessment.Status.IN_PROGRESS
                assessment.actual_start_date = date.today()
                assessment.save()

    def start_assessment(self, assessment: MasterAssessment):
        """Start an assessment (transition from planning to in progress)."""
        if assessment.status == MasterAssessment.Status.PLANNING:
            assessment.status = MasterAssessment.Status.IN_PROGRESS
            assessment.actual_start_date = date.today()
            assessment.save()

    def complete_assessment(self, assessment: MasterAssessment):
        """Mark an assessment as completed."""
        assessment.status = MasterAssessment.Status.COMPLETED
        assessment.actual_end_date = date.today()
        assessment.save()


# Singleton service instance
_assessment_service: Optional[MasterAssessmentService] = None


def get_assessment_service() -> MasterAssessmentService:
    """Get the master assessment service instance."""
    global _assessment_service
    if _assessment_service is None:
        _assessment_service = MasterAssessmentService()
    return _assessment_service
