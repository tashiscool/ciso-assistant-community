"""
Assessment Engine Models

Models for Lightning Assessment and Master Assessment functionality.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


class AssessmentTemplate(models.Model):
    """
    Reusable assessment template for quick setup.

    Templates define:
    - Which controls/requirements to test
    - Default test cases
    - Scoring methodology
    - Evidence requirements
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Template type
    template_type = models.CharField(
        max_length=50,
        choices=[
            ('lightning', 'Lightning Assessment'),
            ('master', 'Master Assessment'),
            ('compliance', 'Compliance Check'),
            ('gap', 'Gap Analysis'),
            ('readiness', 'Readiness Assessment'),
        ],
        default='lightning'
    )

    # Configuration (JSON)
    # - control_ids: List of control IDs to include
    # - framework_ids: List of framework IDs
    # - scoring_method: pass_fail, percentage, weighted
    # - evidence_required: bool
    # - auto_inherit: bool
    configuration = models.JSONField(default=dict)

    # Default test cases (JSON array)
    default_test_cases = models.JSONField(default=list)

    # Metadata
    is_public = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='assessment_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Usage tracking
    times_used = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-times_used', 'name']

    def __str__(self):
        return f"{self.name} ({self.template_type})"


class LightningAssessment(models.Model):
    """
    Lightning Assessment - Rapid, focused assessment execution.

    Features:
    - Quick setup from template or manual selection
    - Streamlined testing workflow
    - Bulk status updates
    - Real-time progress tracking
    - Instant scoring and reporting
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        IN_PROGRESS = 'in_progress', 'In Progress'
        PAUSED = 'paused', 'Paused'
        COMPLETED = 'completed', 'Completed'
        ARCHIVED = 'archived', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Template used (optional)
    template = models.ForeignKey(
        AssessmentTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lightning_assessments'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Target scope (JSON)
    # - perimeter_ids
    # - asset_ids
    # - control_ids
    # - framework_id
    scope = models.JSONField(default=dict)

    # Configuration
    scoring_method = models.CharField(
        max_length=20,
        choices=[
            ('pass_fail', 'Pass/Fail'),
            ('percentage', 'Percentage'),
            ('weighted', 'Weighted Score'),
            ('maturity', 'Maturity Level'),
        ],
        default='pass_fail'
    )

    # Progress tracking
    total_controls = models.PositiveIntegerField(default=0)
    tested_controls = models.PositiveIntegerField(default=0)
    passed_controls = models.PositiveIntegerField(default=0)
    failed_controls = models.PositiveIntegerField(default=0)
    not_applicable = models.PositiveIntegerField(default=0)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    target_completion = models.DateTimeField(null=True, blank=True)

    # Assignment
    assessors = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='lightning_assessments_assigned'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='lightning_assessments_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Results (JSON)
    results_summary = models.JSONField(default=dict)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.status})"

    @property
    def progress_percentage(self):
        if self.total_controls == 0:
            return 0
        return round((self.tested_controls / self.total_controls) * 100, 1)

    @property
    def compliance_score(self):
        tested = self.tested_controls - self.not_applicable
        if tested == 0:
            return 0
        return round((self.passed_controls / tested) * 100, 1)

    def start(self):
        """Start the assessment."""
        self.status = self.Status.IN_PROGRESS
        self.started_at = timezone.now()
        self.save()

    def complete(self):
        """Complete the assessment."""
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self._calculate_results()
        self.save()

    def _calculate_results(self):
        """Calculate final results summary."""
        self.results_summary = {
            'total_controls': self.total_controls,
            'tested': self.tested_controls,
            'passed': self.passed_controls,
            'failed': self.failed_controls,
            'not_applicable': self.not_applicable,
            'progress': self.progress_percentage,
            'compliance_score': self.compliance_score,
            'duration_hours': self._calculate_duration(),
        }

    def _calculate_duration(self):
        if self.started_at and self.completed_at:
            delta = self.completed_at - self.started_at
            return round(delta.total_seconds() / 3600, 2)
        return 0


class MasterAssessment(models.Model):
    """
    Master Assessment - Grouped control testing across frameworks.

    Features:
    - Cross-framework control mapping
    - Grouped testing by control family
    - Inheritance of common controls
    - Multi-assessor collaboration
    - Consolidated reporting
    """

    class Status(models.TextChoices):
        PLANNING = 'planning', 'Planning'
        IN_PROGRESS = 'in_progress', 'In Progress'
        REVIEW = 'review', 'Under Review'
        COMPLETED = 'completed', 'Completed'
        ARCHIVED = 'archived', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNING
    )

    # Scope - multiple frameworks
    framework_ids = models.JSONField(default=list)  # List of framework UUIDs
    perimeter_ids = models.JSONField(default=list)  # List of perimeter UUIDs

    # Control grouping configuration
    grouping_method = models.CharField(
        max_length=30,
        choices=[
            ('family', 'Control Family'),
            ('category', 'Category'),
            ('domain', 'Security Domain'),
            ('custom', 'Custom Groups'),
            ('mapping', 'Cross-Framework Mapping'),
        ],
        default='family'
    )

    # Control groups (JSON array of group definitions)
    control_groups = models.JSONField(default=list)

    # Progress
    total_groups = models.PositiveIntegerField(default=0)
    completed_groups = models.PositiveIntegerField(default=0)
    total_controls = models.PositiveIntegerField(default=0)
    tested_controls = models.PositiveIntegerField(default=0)

    # Inheritance settings
    enable_inheritance = models.BooleanField(default=True)
    inheritance_rules = models.JSONField(default=dict)

    # Timing
    planned_start = models.DateField(null=True, blank=True)
    planned_end = models.DateField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)

    # Team
    lead_assessor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='master_assessments_led'
    )
    assessors = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='master_assessments_assigned'
    )
    reviewers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='master_assessments_reviewing'
    )

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='master_assessments_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Results
    results = models.JSONField(default=dict)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.status})"

    @property
    def progress_percentage(self):
        if self.total_controls == 0:
            return 0
        return round((self.tested_controls / self.total_controls) * 100, 1)


class ControlGroup(models.Model):
    """
    A group of related controls for testing together.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Parent assessment
    master_assessment = models.ForeignKey(
        MasterAssessment,
        on_delete=models.CASCADE,
        related_name='groups'
    )

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Group metadata
    group_type = models.CharField(max_length=50, blank=True)  # family, category, etc.
    sequence = models.PositiveIntegerField(default=0)

    # Controls in this group (JSON array of control references)
    control_references = models.JSONField(default=list)

    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
            ('blocked', 'Blocked'),
        ],
        default='pending'
    )

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_control_groups'
    )

    # Progress
    total_controls = models.PositiveIntegerField(default=0)
    tested_controls = models.PositiveIntegerField(default=0)
    passed_controls = models.PositiveIntegerField(default=0)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['sequence', 'name']

    def __str__(self):
        return f"{self.name} ({self.master_assessment.name})"


class TestCase(models.Model):
    """
    A test case for validating control implementation.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Can be linked to lightning or master assessment
    lightning_assessment = models.ForeignKey(
        LightningAssessment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='test_cases'
    )
    control_group = models.ForeignKey(
        ControlGroup,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='test_cases'
    )

    # Control reference
    control_id = models.CharField(max_length=255)
    control_name = models.CharField(max_length=500)

    # Test definition
    test_procedure = models.TextField()
    expected_result = models.TextField(blank=True)

    # Test type
    test_type = models.CharField(
        max_length=30,
        choices=[
            ('manual', 'Manual Test'),
            ('automated', 'Automated Test'),
            ('interview', 'Interview'),
            ('observation', 'Observation'),
            ('document_review', 'Document Review'),
        ],
        default='manual'
    )

    # Priority
    priority = models.CharField(
        max_length=10,
        choices=[
            ('critical', 'Critical'),
            ('high', 'High'),
            ('medium', 'Medium'),
            ('low', 'Low'),
        ],
        default='medium'
    )

    # Sequence
    sequence = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sequence', 'priority']

    def __str__(self):
        return f"Test: {self.control_name}"


class TestResult(models.Model):
    """
    Result of executing a test case.
    """

    class Result(models.TextChoices):
        PASS = 'pass', 'Pass'
        FAIL = 'fail', 'Fail'
        PARTIAL = 'partial', 'Partial'
        NOT_APPLICABLE = 'na', 'Not Applicable'
        NOT_TESTED = 'not_tested', 'Not Tested'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Test case
    test_case = models.ForeignKey(
        TestCase,
        on_delete=models.CASCADE,
        related_name='results'
    )

    # Result
    result = models.CharField(
        max_length=20,
        choices=Result.choices,
        default=Result.NOT_TESTED
    )

    # Score (for weighted scoring)
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # Evidence and notes
    actual_result = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    evidence_ids = models.JSONField(default=list)  # List of evidence UUIDs

    # Findings
    findings = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)

    # Tester
    tested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='test_results'
    )
    tested_at = models.DateTimeField(null=True, blank=True)

    # Review
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='test_results_reviewed'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-tested_at']

    def __str__(self):
        return f"{self.test_case.control_name}: {self.result}"


class AssessmentRun(models.Model):
    """
    A single execution run of an assessment.

    Tracks the execution of either Lightning or Master assessments,
    storing runtime data and results.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Link to assessment
    lightning_assessment = models.ForeignKey(
        LightningAssessment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='runs'
    )
    master_assessment = models.ForeignKey(
        MasterAssessment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='runs'
    )

    # Run metadata
    run_number = models.PositiveIntegerField(default=1)
    run_type = models.CharField(
        max_length=20,
        choices=[
            ('initial', 'Initial Assessment'),
            ('retest', 'Retest'),
            ('followup', 'Follow-up'),
            ('validation', 'Validation'),
        ],
        default='initial'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('scheduled', 'Scheduled'),
            ('running', 'Running'),
            ('paused', 'Paused'),
            ('completed', 'Completed'),
            ('cancelled', 'Cancelled'),
        ],
        default='scheduled'
    )

    # Timing
    scheduled_start = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)

    # Executor
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='assessment_runs'
    )

    # Results snapshot
    results_snapshot = models.JSONField(default=dict)

    # Notes
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        assessment = self.lightning_assessment or self.master_assessment
        return f"Run #{self.run_number} - {assessment.name if assessment else 'Unknown'}"
