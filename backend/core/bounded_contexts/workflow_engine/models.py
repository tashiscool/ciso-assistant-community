"""
Workflow Engine Models

Models for low-code/no-code workflow automation.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


class Workflow(models.Model):
    """
    A workflow definition containing nodes and connections.
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        ARCHIVED = 'archived', 'Archived'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Version control
    version = models.PositiveIntegerField(default=1)
    is_latest = models.BooleanField(default=True)
    parent_version = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='child_versions'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )

    # Trigger configuration (JSON)
    # - type: manual, schedule, event, webhook, connector
    # - config: trigger-specific configuration
    trigger = models.JSONField(default=dict)

    # Variables available in the workflow
    variables = models.JSONField(default=list)

    # Canvas settings for visual builder
    canvas_settings = models.JSONField(default=dict)  # zoom, pan, etc.

    # Metadata
    tags = models.JSONField(default=list)
    category = models.CharField(max_length=100, blank=True)

    # Ownership
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='workflows_created'
    )
    owned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workflows_owned'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Execution stats
    total_executions = models.PositiveIntegerField(default=0)
    successful_executions = models.PositiveIntegerField(default=0)
    failed_executions = models.PositiveIntegerField(default=0)
    last_executed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} v{self.version}"

    def activate(self):
        """Activate this workflow."""
        self.status = self.Status.ACTIVE
        self.save()

    def deactivate(self):
        """Deactivate this workflow."""
        self.status = self.Status.INACTIVE
        self.save()

    def create_new_version(self):
        """Create a new version of this workflow."""
        # Mark current as not latest
        self.is_latest = False
        self.save()

        # Create new version
        new_workflow = Workflow.objects.create(
            name=self.name,
            description=self.description,
            version=self.version + 1,
            is_latest=True,
            parent_version=self,
            status=self.Status.DRAFT,
            trigger=self.trigger,
            variables=self.variables,
            canvas_settings=self.canvas_settings,
            tags=self.tags,
            category=self.category,
            created_by=self.created_by,
            owned_by=self.owned_by,
        )

        # Copy nodes
        for node in self.nodes.all():
            WorkflowNode.objects.create(
                workflow=new_workflow,
                node_id=node.node_id,
                node_type=node.node_type,
                name=node.name,
                position_x=node.position_x,
                position_y=node.position_y,
                config=node.config,
            )

        # Copy connections
        for conn in self.connections.all():
            WorkflowConnection.objects.create(
                workflow=new_workflow,
                connection_id=conn.connection_id,
                source_node_id=conn.source_node_id,
                source_port=conn.source_port,
                target_node_id=conn.target_node_id,
                target_port=conn.target_port,
                condition=conn.condition,
            )

        return new_workflow


class WorkflowNode(models.Model):
    """
    A node in a workflow.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='nodes'
    )

    # Node identifier within workflow
    node_id = models.CharField(max_length=100)

    # Node type (trigger_, action_, logic_, data_, integration_, end_)
    node_type = models.CharField(max_length=50)
    name = models.CharField(max_length=200)

    # Position on canvas
    position_x = models.IntegerField(default=0)
    position_y = models.IntegerField(default=0)

    # Configuration (JSON)
    config = models.JSONField(default=dict)

    # Metadata
    description = models.TextField(blank=True)
    is_disabled = models.BooleanField(default=False)

    class Meta:
        unique_together = ['workflow', 'node_id']
        ordering = ['node_id']

    def __str__(self):
        return f"{self.name} ({self.node_type})"


class WorkflowConnection(models.Model):
    """
    A connection between two nodes in a workflow.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='connections'
    )

    # Connection identifier
    connection_id = models.CharField(max_length=100)

    # Source and target
    source_node_id = models.CharField(max_length=100)
    source_port = models.CharField(max_length=50)
    target_node_id = models.CharField(max_length=100)
    target_port = models.CharField(max_length=50)

    # Optional condition for conditional routing
    condition = models.TextField(blank=True)

    class Meta:
        unique_together = ['workflow', 'connection_id']

    def __str__(self):
        return f"{self.source_node_id}:{self.source_port} -> {self.target_node_id}:{self.target_port}"


class WorkflowExecution(models.Model):
    """
    An execution instance of a workflow.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'
        PAUSED = 'paused', 'Paused'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='executions'
    )

    # Execution metadata
    execution_number = models.PositiveIntegerField(default=1)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    # Trigger info
    triggered_by = models.CharField(max_length=50)  # manual, schedule, event, webhook
    trigger_data = models.JSONField(default=dict)  # Data that triggered the workflow

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Context and variables during execution
    context = models.JSONField(default=dict)
    variables = models.JSONField(default=dict)

    # Results
    output = models.JSONField(default=dict)
    error = models.TextField(blank=True)

    # Executor
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workflow_executions'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.workflow.name} - Execution #{self.execution_number}"

    def start(self):
        """Start the execution."""
        self.status = self.Status.RUNNING
        self.started_at = timezone.now()
        self.save()

    def complete(self, output=None):
        """Complete the execution successfully."""
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        if output:
            self.output = output
        self.save()

        # Update workflow stats
        self.workflow.total_executions += 1
        self.workflow.successful_executions += 1
        self.workflow.last_executed_at = timezone.now()
        self.workflow.save()

    def fail(self, error):
        """Mark execution as failed."""
        self.status = self.Status.FAILED
        self.completed_at = timezone.now()
        self.error = str(error)
        self.save()

        # Update workflow stats
        self.workflow.total_executions += 1
        self.workflow.failed_executions += 1
        self.workflow.last_executed_at = timezone.now()
        self.workflow.save()

    def cancel(self):
        """Cancel the execution."""
        self.status = self.Status.CANCELLED
        self.completed_at = timezone.now()
        self.save()

    @property
    def duration_seconds(self):
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


class WorkflowStep(models.Model):
    """
    A step within a workflow execution.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        SKIPPED = 'skipped', 'Skipped'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    execution = models.ForeignKey(
        WorkflowExecution,
        on_delete=models.CASCADE,
        related_name='steps'
    )

    # Node reference
    node_id = models.CharField(max_length=100)
    node_type = models.CharField(max_length=50)
    node_name = models.CharField(max_length=200)

    # Step order
    sequence = models.PositiveIntegerField(default=0)

    # Status
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Input/Output
    input_data = models.JSONField(default=dict)
    output_data = models.JSONField(default=dict)

    # Error info
    error = models.TextField(blank=True)
    retry_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sequence']

    def __str__(self):
        return f"{self.node_name} - {self.status}"

    def start(self):
        """Start this step."""
        self.status = self.Status.RUNNING
        self.started_at = timezone.now()
        self.save()

    def complete(self, output_data=None):
        """Complete this step."""
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        if output_data:
            self.output_data = output_data
        self.save()

    def fail(self, error):
        """Fail this step."""
        self.status = self.Status.FAILED
        self.completed_at = timezone.now()
        self.error = str(error)
        self.save()

    def skip(self):
        """Skip this step."""
        self.status = self.Status.SKIPPED
        self.completed_at = timezone.now()
        self.save()


class WorkflowSchedule(models.Model):
    """
    Schedule for automatic workflow execution.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='schedules'
    )

    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    # Schedule type
    schedule_type = models.CharField(
        max_length=20,
        choices=[
            ('cron', 'Cron Expression'),
            ('interval', 'Interval'),
            ('once', 'Run Once'),
        ],
        default='cron'
    )

    # Cron expression (for cron type)
    cron_expression = models.CharField(max_length=100, blank=True)

    # Interval (for interval type)
    interval_minutes = models.PositiveIntegerField(null=True, blank=True)

    # Run once at (for once type)
    run_at = models.DateTimeField(null=True, blank=True)

    # Timezone
    timezone = models.CharField(max_length=50, default='UTC')

    # Next scheduled run
    next_run_at = models.DateTimeField(null=True, blank=True)
    last_run_at = models.DateTimeField(null=True, blank=True)

    # Run count
    run_count = models.PositiveIntegerField(default=0)
    max_runs = models.PositiveIntegerField(null=True, blank=True)  # None = unlimited

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['next_run_at']

    def __str__(self):
        return f"{self.name} - {self.workflow.name}"


class WorkflowWebhook(models.Model):
    """
    Webhook endpoint for triggering workflows.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(
        Workflow,
        on_delete=models.CASCADE,
        related_name='webhooks'
    )

    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)

    # Webhook token (for authentication)
    token = models.CharField(max_length=64, unique=True)

    # Allowed methods
    allowed_methods = models.JSONField(default=list)  # ['POST', 'PUT']

    # Rate limiting
    rate_limit_per_minute = models.PositiveIntegerField(default=60)

    # Stats
    total_calls = models.PositiveIntegerField(default=0)
    last_called_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.workflow.name}"
