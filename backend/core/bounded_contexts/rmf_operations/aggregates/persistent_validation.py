"""
Persistent Validation Aggregate

Tracks automated validation rules and their execution results for
FedRAMP 20x persistent validation requirements (70%+ automation target).
"""

import uuid
from typing import Optional, List, Dict, Any
from django.db import models
from django.utils import timezone
from decimal import Decimal

from core.domain.aggregate import AggregateRoot


class PersistentValidationRule(AggregateRoot):
    """
    Persistent Validation Rule aggregate.

    Represents an automated validation rule that can be executed to verify
    KSI compliance. Supports various validation types including scanner
    integration, API checks, and custom scripts.
    """

    class RuleType(models.TextChoices):
        SCANNER_INTEGRATION = "scanner", "Scanner Integration"
        API_CHECK = "api", "API Check"
        CONFIGURATION_CHECK = "config", "Configuration Check"
        LOG_ANALYSIS = "log", "Log Analysis"
        EVIDENCE_CHECK = "evidence", "Evidence Check"
        CUSTOM_SCRIPT = "custom", "Custom Script"
        MANUAL_WITH_REMINDER = "manual", "Manual with Reminder"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        DEPRECATED = "deprecated", "Deprecated"
        ERROR = "error", "Error"

    class Frequency(models.TextChoices):
        CONTINUOUS = "continuous", "Continuous (Real-time)"
        HOURLY = "hourly", "Hourly"
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        QUARTERLY = "quarterly", "Quarterly"
        ON_DEMAND = "on_demand", "On Demand"

    # Identity
    name = models.CharField(max_length=255, help_text="Rule name")
    description = models.TextField(blank=True, null=True, help_text="Rule description")

    # Rule type and configuration
    rule_type = models.CharField(
        max_length=20,
        choices=RuleType.choices,
        default=RuleType.API_CHECK,
        help_text="Type of validation rule"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
        help_text="Current rule status"
    )

    # KSI linkage
    ksi_ref_ids = models.JSONField(
        default=list,
        help_text="List of KSI reference IDs this rule validates"
    )
    cloud_service_offering_id = models.UUIDField(
        null=True, blank=True, db_index=True,
        help_text="CSO this rule applies to (null for global rules)"
    )

    # Execution configuration
    frequency = models.CharField(
        max_length=20,
        choices=Frequency.choices,
        default=Frequency.DAILY,
        help_text="How often the rule should run"
    )
    cron_expression = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="Cron expression for custom scheduling"
    )
    next_scheduled_run = models.DateTimeField(
        null=True, blank=True,
        help_text="Next scheduled execution time"
    )

    # Rule definition
    rule_definition = models.JSONField(
        default=dict,
        help_text="Rule definition/configuration"
    )
    """
    Rule definition structure varies by type:
    - scanner: {scanner_type, scan_profile, target_scope, thresholds}
    - api: {endpoint, method, headers, expected_response, timeout}
    - config: {targets, expected_values, check_script}
    - log: {log_source, query, time_range, expected_pattern}
    - evidence: {evidence_type, required_fields, max_age_days}
    - custom: {script_path, script_content, interpreter, args}
    """

    # Pass/fail criteria
    pass_criteria = models.JSONField(
        default=dict,
        help_text="Criteria for determining pass/fail"
    )
    fail_threshold = models.IntegerField(
        default=0,
        help_text="Number of failures before rule is marked as failing"
    )
    warning_threshold = models.IntegerField(
        default=1,
        help_text="Number of issues before warning"
    )

    # Integration settings
    integration_type = models.CharField(
        max_length=50, blank=True, null=True,
        help_text="Integration type (e.g., nessus, qualys, aws_config)"
    )
    integration_config = models.JSONField(
        default=dict, blank=True,
        help_text="Integration-specific configuration"
    )

    # Execution tracking
    last_execution = models.DateTimeField(
        null=True, blank=True,
        help_text="Last execution timestamp"
    )
    last_result = models.BooleanField(
        null=True, blank=True,
        help_text="Result of last execution (pass/fail)"
    )
    last_error = models.TextField(
        blank=True, null=True,
        help_text="Error message from last failed execution"
    )
    consecutive_failures = models.IntegerField(
        default=0,
        help_text="Number of consecutive failures"
    )
    total_executions = models.IntegerField(
        default=0,
        help_text="Total number of executions"
    )
    total_passes = models.IntegerField(
        default=0,
        help_text="Total number of passed executions"
    )

    # Notifications
    notify_on_failure = models.BooleanField(
        default=True,
        help_text="Send notification on failure"
    )
    notification_recipients = models.JSONField(
        default=list,
        help_text="Email addresses for failure notifications"
    )

    # Metadata
    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fedramp_persistent_validation_rules'
        verbose_name = 'Persistent Validation Rule'
        verbose_name_plural = 'Persistent Validation Rules'
        ordering = ['name']
        indexes = [
            models.Index(fields=['status', 'frequency']),
            models.Index(fields=['cloud_service_offering_id', 'status']),
            models.Index(fields=['next_scheduled_run']),
            models.Index(fields=['rule_type']),
        ]

    def __str__(self):
        return f"ValidationRule({self.name}): {self.status}"

    # Factory method
    @classmethod
    def create(cls, name: str, rule_type: str, ksi_ref_ids: List[str],
               description: str = None, frequency: str = None,
               cso_id: uuid.UUID = None, created_by: uuid.UUID = None) -> 'PersistentValidationRule':
        """Create a new validation rule"""
        rule = cls()
        rule.name = name
        rule.description = description
        rule.rule_type = rule_type
        rule.ksi_ref_ids = ksi_ref_ids
        rule.frequency = frequency or cls.Frequency.DAILY
        rule.cloud_service_offering_id = cso_id
        rule.created_by = created_by

        from ..domain_events import ValidationRuleCreated
        rule._raise_event(ValidationRuleCreated(
            aggregate_id=rule.id,
            name=name,
            ksi_count=len(ksi_ref_ids)
        ))

        return rule

    # Business methods
    def configure_scanner_integration(self, scanner_type: str, scan_profile: str,
                                      target_scope: List[str], thresholds: Dict = None) -> None:
        """Configure scanner integration rule"""
        self.rule_type = self.RuleType.SCANNER_INTEGRATION
        self.integration_type = scanner_type
        self.rule_definition = {
            'scanner_type': scanner_type,
            'scan_profile': scan_profile,
            'target_scope': target_scope,
            'thresholds': thresholds or {}
        }

    def configure_api_check(self, endpoint: str, method: str = 'GET',
                           headers: Dict = None, expected_response: Dict = None,
                           timeout: int = 30) -> None:
        """Configure API check rule"""
        self.rule_type = self.RuleType.API_CHECK
        self.rule_definition = {
            'endpoint': endpoint,
            'method': method,
            'headers': headers or {},
            'expected_response': expected_response or {},
            'timeout': timeout
        }

    def configure_config_check(self, targets: List[str], expected_values: Dict,
                               check_script: str = None) -> None:
        """Configure configuration check rule"""
        self.rule_type = self.RuleType.CONFIGURATION_CHECK
        self.rule_definition = {
            'targets': targets,
            'expected_values': expected_values,
            'check_script': check_script
        }

    def activate(self) -> None:
        """Activate the validation rule"""
        if self.status == self.Status.DRAFT or self.status == self.Status.PAUSED:
            self.status = self.Status.ACTIVE
            self._schedule_next_run()

            from ..domain_events import ValidationRuleActivated
            self._raise_event(ValidationRuleActivated(
                aggregate_id=self.id,
                name=self.name
            ))

    def pause(self) -> None:
        """Pause the validation rule"""
        if self.status == self.Status.ACTIVE:
            self.status = self.Status.PAUSED
            self.next_scheduled_run = None

    def deprecate(self) -> None:
        """Deprecate the validation rule"""
        self.status = self.Status.DEPRECATED
        self.next_scheduled_run = None

    def record_execution(self, passed: bool, details: Dict = None,
                        error: str = None) -> 'ValidationExecution':
        """Record an execution result"""
        self.last_execution = timezone.now()
        self.last_result = passed
        self.total_executions += 1

        if passed:
            self.total_passes += 1
            self.consecutive_failures = 0
            self.last_error = None
            if self.status == self.Status.ERROR:
                self.status = self.Status.ACTIVE
        else:
            self.consecutive_failures += 1
            self.last_error = error
            if self.consecutive_failures >= 3:
                self.status = self.Status.ERROR

        # Schedule next run
        self._schedule_next_run()

        # Create execution record
        execution = ValidationExecution.create(
            rule_id=self.id,
            passed=passed,
            details=details,
            error=error
        )

        from ..domain_events import ValidationExecutionRecorded
        self._raise_event(ValidationExecutionRecorded(
            aggregate_id=self.id,
            rule_name=self.name,
            passed=passed,
            consecutive_failures=self.consecutive_failures
        ))

        return execution

    def _schedule_next_run(self) -> None:
        """Schedule the next execution based on frequency"""
        from datetime import timedelta
        now = timezone.now()

        frequency_map = {
            self.Frequency.CONTINUOUS: timedelta(minutes=5),
            self.Frequency.HOURLY: timedelta(hours=1),
            self.Frequency.DAILY: timedelta(days=1),
            self.Frequency.WEEKLY: timedelta(weeks=1),
            self.Frequency.MONTHLY: timedelta(days=30),
            self.Frequency.QUARTERLY: timedelta(days=90),
        }

        if self.frequency in frequency_map:
            self.next_scheduled_run = now + frequency_map[self.frequency]
        elif self.frequency == self.Frequency.ON_DEMAND:
            self.next_scheduled_run = None

    def set_pass_criteria(self, criteria: Dict) -> None:
        """Set pass/fail criteria"""
        self.pass_criteria = criteria

    def add_notification_recipient(self, email: str) -> None:
        """Add notification recipient"""
        if email not in self.notification_recipients:
            self.notification_recipients.append(email)

    # Query methods
    def is_active(self) -> bool:
        """Check if rule is active"""
        return self.status == self.Status.ACTIVE

    def is_due_for_execution(self) -> bool:
        """Check if rule is due for execution"""
        if not self.is_active():
            return False
        if not self.next_scheduled_run:
            return self.frequency != self.Frequency.ON_DEMAND
        return timezone.now() >= self.next_scheduled_run

    def get_pass_rate(self) -> float:
        """Get historical pass rate"""
        if self.total_executions == 0:
            return 0.0
        return (self.total_passes / self.total_executions) * 100

    def get_status_summary(self) -> Dict[str, Any]:
        """Get status summary"""
        return {
            'id': str(self.id),
            'name': self.name,
            'status': self.status,
            'rule_type': self.rule_type,
            'frequency': self.frequency,
            'ksi_count': len(self.ksi_ref_ids),
            'last_execution': self.last_execution.isoformat() if self.last_execution else None,
            'last_result': self.last_result,
            'pass_rate': self.get_pass_rate(),
            'consecutive_failures': self.consecutive_failures,
            'next_run': self.next_scheduled_run.isoformat() if self.next_scheduled_run else None
        }


class ValidationExecution(AggregateRoot):
    """
    Records individual validation execution results.
    """

    class Status(models.TextChoices):
        PASSED = "passed", "Passed"
        FAILED = "failed", "Failed"
        ERROR = "error", "Error"
        SKIPPED = "skipped", "Skipped"

    # Foreign key
    validation_rule_id = models.UUIDField(
        db_index=True,
        help_text="The validation rule that was executed"
    )

    # Execution details
    execution_timestamp = models.DateTimeField(
        default=timezone.now,
        help_text="When the validation was executed"
    )
    duration_ms = models.IntegerField(
        default=0,
        help_text="Execution duration in milliseconds"
    )

    # Results
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        db_index=True,
        help_text="Execution status"
    )
    passed = models.BooleanField(
        help_text="Whether validation passed"
    )
    score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Numeric score if applicable"
    )

    # Details
    result_details = models.JSONField(
        default=dict, blank=True,
        help_text="Detailed results from execution"
    )
    error_message = models.TextField(
        blank=True, null=True,
        help_text="Error message if failed"
    )
    findings = models.JSONField(
        default=list, blank=True,
        help_text="List of findings/issues discovered"
    )

    # Evidence
    evidence_collected = models.JSONField(
        default=list, blank=True,
        help_text="Evidence collected during execution"
    )
    screenshot_paths = models.JSONField(
        default=list, blank=True,
        help_text="Paths to screenshots if applicable"
    )

    # Metadata
    executed_by = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="System or user that triggered execution"
    )
    trigger_type = models.CharField(
        max_length=50, default="scheduled",
        help_text="What triggered the execution (scheduled, manual, event)"
    )

    class Meta:
        db_table = 'fedramp_validation_executions'
        verbose_name = 'Validation Execution'
        verbose_name_plural = 'Validation Executions'
        ordering = ['-execution_timestamp']
        indexes = [
            models.Index(fields=['validation_rule_id', 'execution_timestamp']),
            models.Index(fields=['status', 'execution_timestamp']),
            models.Index(fields=['passed']),
        ]

    def __str__(self):
        return f"Execution({self.validation_rule_id}): {self.status} at {self.execution_timestamp}"

    @classmethod
    def create(cls, rule_id: uuid.UUID, passed: bool, details: Dict = None,
               error: str = None, duration_ms: int = 0,
               findings: List = None) -> 'ValidationExecution':
        """Create a new execution record"""
        execution = cls()
        execution.validation_rule_id = rule_id
        execution.passed = passed
        execution.status = (cls.Status.PASSED if passed else
                          cls.Status.ERROR if error else cls.Status.FAILED)
        execution.result_details = details or {}
        execution.error_message = error
        execution.duration_ms = duration_ms
        execution.findings = findings or []
        return execution

    def add_finding(self, severity: str, message: str, details: Dict = None) -> None:
        """Add a finding to the execution"""
        self.findings.append({
            'severity': severity,
            'message': message,
            'details': details or {},
            'timestamp': timezone.now().isoformat()
        })

    def add_evidence(self, evidence_type: str, content: str, metadata: Dict = None) -> None:
        """Add evidence to the execution"""
        self.evidence_collected.append({
            'type': evidence_type,
            'content': content,
            'metadata': metadata or {},
            'collected_at': timezone.now().isoformat()
        })
