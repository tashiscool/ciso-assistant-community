"""
Assessment Artifact Package Models

Defines models for managing assessment artifact packages — structured collections
of evidence requests mapped to NIST 800-53 (and other framework) controls with
periodicity, platform tags, and collection playbooks.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from core.base_models import AbstractBaseModel, NameDescriptionMixin
from iam.models import FolderMixin


class ArtifactPackage(NameDescriptionMixin, AbstractBaseModel, FolderMixin):
    """
    A collection of evidence requests organized by control family, with
    associated schedules, playbooks, and quality diagnostics.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    class PackageType(models.TextChoices):
        FEDRAMP = "fedramp", "FedRAMP Assessment"
        NIST_800_53 = "nist_800_53", "NIST 800-53"
        ISO_27001 = "iso_27001", "ISO 27001"
        SOC_2 = "soc_2", "SOC 2"
        CMMC = "cmmc", "CMMC"
        CUSTOM = "custom", "Custom"

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    package_type = models.CharField(
        max_length=30, choices=PackageType.choices, default=PackageType.FEDRAMP
    )

    # Target system identification
    system_name = models.CharField(
        max_length=255, blank=True, verbose_name=_("System Name"),
        help_text=_("Name of the system being assessed (e.g., MyApp on AWS/RHEL 7)")
    )
    system_description = models.TextField(
        blank=True, verbose_name=_("System Description")
    )

    # Link to compliance assessment
    compliance_assessment = models.ForeignKey(
        "core.ComplianceAssessment",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="artifact_packages",
        verbose_name=_("Compliance Assessment"),
    )

    # Platform tags for this package
    platform_tags = models.JSONField(
        default=list, blank=True,
        verbose_name=_("Platform Tags"),
        help_text=_("e.g. ['AWS', 'RHEL7', 'ORACLE_DB', 'SPLUNK']"),
    )

    # Package-level statistics (computed)
    stats = models.JSONField(default=dict, blank=True, verbose_name=_("Statistics"))

    # Collection playbooks (computed)
    collection_playbooks = models.JSONField(
        default=list, blank=True, verbose_name=_("Collection Playbooks")
    )

    # Quality report
    quality_report = models.JSONField(
        default=dict, blank=True, verbose_name=_("Quality Report")
    )

    # Indexes for fast lookup
    indexes = models.JSONField(default=dict, blank=True, verbose_name=_("Indexes"))

    # Import source
    source_file = models.CharField(
        max_length=500, blank=True, verbose_name=_("Source File")
    )

    class Meta:
        verbose_name = _("Artifact Package")
        verbose_name_plural = _("Artifact Packages")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    @property
    def total_items(self):
        return self.request_items.count()

    @property
    def schedule_count(self):
        return self.evidence_schedules.count()


class ArtifactRequestItem(AbstractBaseModel, FolderMixin):
    """
    A single evidence request within an artifact package.

    Maps one or more NIST 800-53 controls to a specific evidence artifact,
    with platform tags, collection channel, and periodicity.
    """

    class PrimaryArtifactType(models.TextChoices):
        SYSTEM_GENERATED_OUTPUT = "system_generated_output", "System-Generated Output"
        CONFIGURATION_SNAPSHOT = "configuration_snapshot", "Configuration Snapshot"
        COMMAND_OUTPUT = "command_output", "Command Output"
        SCAN_EVIDENCE = "scan_evidence", "Scan Evidence"
        REPORT = "report", "Report"
        POLICY_DOCUMENT = "policy_document", "Policy Document"
        PROCEDURE_DOCUMENT = "procedure_document", "Procedure Document"
        PLAN_DOCUMENT = "plan_document", "Plan Document"
        RECORDS = "records", "Records"
        MEETING_EVIDENCE = "meeting_evidence", "Meeting Evidence"
        COMMUNICATION_EVIDENCE = "communication_evidence", "Communication Evidence"
        SCREENSHOT = "screenshot", "Screenshot"
        INVENTORY_LISTING = "inventory_listing", "Inventory Listing"
        TRAINING_ARTIFACT = "training_artifact", "Training Artifact"
        MATRIX_OR_MAPPING = "matrix_or_mapping", "Matrix/Mapping"
        ALERT_EVIDENCE = "alert_evidence", "Alert Evidence"
        TICKETING_EVIDENCE = "ticketing_evidence", "Ticketing Evidence"
        GENERIC_EVIDENCE = "generic_evidence", "Generic Evidence"

    class CollectionChannel(models.TextChoices):
        TOOL_EXPORT = "tool_export", "Tool Export"
        CLI_CAPTURE = "cli_capture", "CLI Capture"
        SCANNER_EXPORT = "scanner_export", "Scanner Export"
        REPORT_EXPORT = "report_export", "Report Export"
        DOCUMENT_REPOSITORY = "document_repository", "Document Repository"
        SYSTEM_OF_RECORD_EXPORT = "system_of_record_export", "System of Record Export"
        GOVERNANCE_RECORDS = "governance_records", "Governance Records"
        MAIL_TICKET_EXPORT = "mail_ticket_export", "Mail/Ticket Export"
        SCREENSHOT_CAPTURE = "screenshot_capture", "Screenshot Capture"
        MANUAL_COLLECTION = "manual_collection", "Manual Collection"

    class Periodicity(models.TextChoices):
        ON_DEMAND = "on_demand", "On Demand"
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        QUARTERLY = "quarterly", "Quarterly"
        SEMI_ANNUAL = "semi_annual", "Semi-Annual"
        ANNUAL = "annual", "Annual"
        EVENT_DRIVEN = "event_driven", "Event-Driven"
        CONTINUOUS = "continuous", "Continuous"

    package = models.ForeignKey(
        ArtifactPackage,
        on_delete=models.CASCADE,
        related_name="request_items",
        verbose_name=_("Artifact Package"),
    )

    # Identity
    request_id = models.CharField(
        max_length=20, verbose_name=_("Request ID"),
        help_text=_("e.g. REQ-0001")
    )
    source_line = models.IntegerField(default=0, verbose_name=_("Source Line"))

    # Request details
    category = models.CharField(max_length=255, blank=True, verbose_name=_("Category"))
    artifact_request = models.TextField(verbose_name=_("Artifact Request Text"))
    request_date = models.DateField(null=True, blank=True, verbose_name=_("Request Date"))

    # Control mappings (stored as JSON arrays of canonical control IDs)
    controls = models.JSONField(
        default=list, verbose_name=_("Controls"),
        help_text=_("e.g. ['AC-2', 'AC-2(4)', 'AU-6']")
    )
    control_families = models.JSONField(
        default=list, verbose_name=_("Control Families"),
        help_text=_("e.g. ['AC', 'AU']")
    )
    control_domains = models.JSONField(
        default=list, verbose_name=_("Control Domains"),
        help_text=_("e.g. ['Access Control and Authorization']")
    )
    workstreams = models.JSONField(default=list, verbose_name=_("Workstreams"))
    supplemental_references = models.JSONField(default=list)

    # Artifact classification
    primary_artifact_type = models.CharField(
        max_length=50,
        choices=PrimaryArtifactType.choices,
        default=PrimaryArtifactType.GENERIC_EVIDENCE,
    )
    artifact_types = models.JSONField(default=list, verbose_name=_("All Artifact Types"))
    collection_channel = models.CharField(
        max_length=50,
        choices=CollectionChannel.choices,
        default=CollectionChannel.MANUAL_COLLECTION,
    )

    # Platform and technology tags
    platform_tags = models.JSONField(default=list, verbose_name=_("Platform Tags"))

    # Time scope and periodicity
    time_scopes = models.JSONField(default=list, verbose_name=_("Time Scopes"))
    periodicity = models.CharField(
        max_length=20,
        choices=Periodicity.choices,
        default=Periodicity.ON_DEMAND,
        verbose_name=_("Periodicity"),
    )

    # Extracted collection instructions
    commands = models.JSONField(
        default=list, verbose_name=_("Commands"),
        help_text=_("Extracted CLI commands for evidence collection"),
    )
    config_paths = models.JSONField(
        default=list, verbose_name=_("Config Paths"),
        help_text=_("Extracted config file paths"),
    )

    # Bundle hint
    bundle_hint = models.JSONField(
        default=dict, verbose_name=_("Bundle Hint"),
        help_text=_("Suggested file path and extension"),
    )

    # Link to actual collected evidence (once gathered)
    evidence = models.ForeignKey(
        "core.Evidence",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="artifact_request_items",
        verbose_name=_("Collected Evidence"),
    )

    class Meta:
        verbose_name = _("Artifact Request Item")
        verbose_name_plural = _("Artifact Request Items")
        ordering = ["request_id"]
        unique_together = [["package", "request_id"]]

    def __str__(self):
        ctrls = ", ".join(self.controls[:3])
        return f"{self.request_id}: {ctrls}"


class EvidenceSchedule(AbstractBaseModel, FolderMixin):
    """
    A periodic evidence collection schedule derived from artifact request items.

    Groups related request items by periodicity and generates a repeating
    collection calendar (weekly audit log reviews, monthly vuln scans, etc.).
    """

    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        QUARTERLY = "quarterly", "Quarterly"
        SEMI_ANNUAL = "semi_annual", "Semi-Annual"
        ANNUAL = "annual", "Annual"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        COMPLETED = "completed", "Completed"

    package = models.ForeignKey(
        ArtifactPackage,
        on_delete=models.CASCADE,
        related_name="evidence_schedules",
        verbose_name=_("Artifact Package"),
    )

    name = models.CharField(max_length=255, verbose_name=_("Schedule Name"))
    description = models.TextField(blank=True, verbose_name=_("Description"))

    frequency = models.CharField(
        max_length=20, choices=Frequency.choices, verbose_name=_("Frequency")
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )

    # Schedule details
    cron_expression = models.CharField(
        max_length=100, blank=True, verbose_name=_("Cron Expression"),
        help_text=_("e.g. '0 9 * * 1' for weekly Monday at 9 AM"),
    )

    # What this schedule covers
    control_families = models.JSONField(
        default=list, verbose_name=_("Control Families")
    )
    controls = models.JSONField(default=list, verbose_name=_("Controls"))
    evidence_types = models.JSONField(
        default=list, verbose_name=_("Evidence Types"),
        help_text=_("Types of evidence to collect on this schedule"),
    )
    platform_tags = models.JSONField(default=list, verbose_name=_("Platform Tags"))

    # Linked request items
    request_items = models.ManyToManyField(
        ArtifactRequestItem,
        blank=True,
        related_name="schedules",
        verbose_name=_("Request Items"),
    )

    # Example collection actions
    collection_actions = models.JSONField(
        default=list, verbose_name=_("Collection Actions"),
        help_text=_("Summary of what to collect on each occurrence"),
    )

    # Link to evidence automation rule (if auto-collection is configured)
    evidence_rule = models.ForeignKey(
        "evidence_automation.EvidenceCollectionRule",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="artifact_schedules",
        verbose_name=_("Evidence Collection Rule"),
    )

    # Link to ConMon activity (if ConMon integration is active)
    conmon_activity = models.ForeignKey(
        "continuous_monitoring.ConMonActivityConfig",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="artifact_schedules",
        verbose_name=_("ConMon Activity"),
    )

    # Tracking
    last_collected_at = models.DateTimeField(
        null=True, blank=True, verbose_name=_("Last Collected")
    )
    next_due_at = models.DateTimeField(
        null=True, blank=True, verbose_name=_("Next Due")
    )
    items_count = models.IntegerField(default=0, verbose_name=_("Items Count"))

    class Meta:
        verbose_name = _("Evidence Schedule")
        verbose_name_plural = _("Evidence Schedules")
        ordering = ["frequency", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_frequency_display()})"
