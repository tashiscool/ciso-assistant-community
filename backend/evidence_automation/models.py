"""
Evidence Automation Models

Defines models for automated evidence collection configuration and tracking.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from core.base_models import AbstractBaseModel
from iam.models import FolderMixin
import uuid


class EvidenceSource(AbstractBaseModel, FolderMixin):
    """
    Represents a source for automated evidence collection.

    Sources can be cloud providers, identity systems, security tools, etc.
    """

    class SourceType(models.TextChoices):
        AWS = 'aws', 'Amazon Web Services'
        AZURE = 'azure', 'Microsoft Azure'
        GCP = 'gcp', 'Google Cloud Platform'
        OKTA = 'okta', 'Okta Identity'
        AZURE_AD = 'azure_ad', 'Azure Active Directory'
        GITHUB = 'github', 'GitHub'
        JIRA = 'jira', 'Jira'
        SERVICENOW = 'servicenow', 'ServiceNow'
        SPLUNK = 'splunk', 'Splunk'
        QUALYS = 'qualys', 'Qualys'
        TENABLE = 'tenable', 'Tenable'
        CROWDSTRIKE = 'crowdstrike', 'CrowdStrike'
        API = 'api', 'Custom API'
        FILE = 'file', 'File Upload'
        MANUAL = 'manual', 'Manual Collection'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        ERROR = 'error', 'Error'
        PENDING = 'pending', 'Pending Configuration'

    name = models.CharField(max_length=255, verbose_name=_('Name'))
    description = models.TextField(blank=True, null=True, verbose_name=_('Description'))
    source_type = models.CharField(
        max_length=50,
        choices=SourceType.choices,
        verbose_name=_('Source Type')
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name=_('Status')
    )

    # Connection configuration (encrypted in production)
    config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Configuration'),
        help_text=_('Connection configuration (API keys, endpoints, etc.)')
    )

    # Collection schedule
    collection_enabled = models.BooleanField(
        default=False,
        verbose_name=_('Collection Enabled')
    )
    collection_schedule = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name=_('Collection Schedule'),
        help_text=_('Cron expression for collection schedule')
    )

    # Last collection info
    last_collection_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name=_('Last Collection')
    )
    last_collection_status = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name=_('Last Collection Status')
    )
    last_error = models.TextField(
        blank=True,
        null=True,
        verbose_name=_('Last Error')
    )

    class Meta:
        verbose_name = _('Evidence Source')
        verbose_name_plural = _('Evidence Sources')

    def __str__(self):
        return f"{self.name} ({self.get_source_type_display()})"


class EvidenceCollectionRule(AbstractBaseModel, FolderMixin):
    """
    Defines rules for collecting specific types of evidence from sources.
    """

    class CollectionType(models.TextChoices):
        SCREENSHOT = 'screenshot', 'Screenshot'
        CONFIGURATION = 'configuration', 'Configuration Export'
        LOG = 'log', 'Log Export'
        REPORT = 'report', 'Report'
        POLICY = 'policy', 'Policy Document'
        INVENTORY = 'inventory', 'Asset Inventory'
        SCAN_RESULT = 'scan_result', 'Security Scan Result'
        AUDIT_LOG = 'audit_log', 'Audit Log'
        USER_LIST = 'user_list', 'User/Access List'
        CERTIFICATE = 'certificate', 'Certificate/Key Info'

    source = models.ForeignKey(
        EvidenceSource,
        on_delete=models.CASCADE,
        related_name='collection_rules',
        verbose_name=_('Source')
    )
    name = models.CharField(max_length=255, verbose_name=_('Name'))
    description = models.TextField(blank=True, null=True, verbose_name=_('Description'))

    collection_type = models.CharField(
        max_length=50,
        choices=CollectionType.choices,
        verbose_name=_('Collection Type')
    )

    # Rule configuration
    query = models.TextField(
        blank=True,
        null=True,
        verbose_name=_('Query/Filter'),
        help_text=_('API query, filter expression, or path')
    )
    parameters = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_('Parameters')
    )

    # Target controls/requirements
    target_controls = models.ManyToManyField(
        'core.AppliedControl',
        blank=True,
        related_name='evidence_rules',
        verbose_name=_('Target Controls')
    )
    target_requirements = models.ManyToManyField(
        'core.RequirementAssessment',
        blank=True,
        related_name='evidence_rules',
        verbose_name=_('Target Requirements')
    )

    # Scheduling
    enabled = models.BooleanField(default=True, verbose_name=_('Enabled'))
    schedule = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name=_('Schedule Override'),
        help_text=_('Override source schedule for this rule')
    )

    # Retention
    retention_days = models.IntegerField(
        default=365,
        verbose_name=_('Retention Days')
    )

    class Meta:
        verbose_name = _('Evidence Collection Rule')
        verbose_name_plural = _('Evidence Collection Rules')

    def __str__(self):
        return f"{self.name} ({self.source.name})"


class EvidenceCollectionRun(AbstractBaseModel):
    """
    Tracks individual evidence collection runs.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        SUCCESS = 'success', 'Success'
        PARTIAL = 'partial', 'Partial Success'
        FAILED = 'failed', 'Failed'

    rule = models.ForeignKey(
        EvidenceCollectionRule,
        on_delete=models.CASCADE,
        related_name='runs',
        verbose_name=_('Rule')
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name=_('Status')
    )

    started_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name=_('Started At')
    )
    completed_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name=_('Completed At')
    )

    # Results
    evidence_created = models.ForeignKey(
        'core.Evidence',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='collection_runs',
        verbose_name=_('Evidence Created')
    )
    items_collected = models.IntegerField(
        default=0,
        verbose_name=_('Items Collected')
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        verbose_name=_('Error Message')
    )
    run_log = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Run Log')
    )

    class Meta:
        verbose_name = _('Evidence Collection Run')
        verbose_name_plural = _('Evidence Collection Runs')
        ordering = ['-created_at']

    def __str__(self):
        return f"Run {self.id} - {self.rule.name} ({self.status})"
