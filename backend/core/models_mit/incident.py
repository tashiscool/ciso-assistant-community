"""
Incident Management Models - MIT Licensed

Clean-room implementation of incident management for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.conf import settings
from ..base_models_mit import AbstractGRCEntity
from .organization import Organization, Domain


class Incident(AbstractGRCEntity):
    """
    A security or operational incident.

    Incidents represent events that have or could negatively
    impact the organization's operations, assets, or reputation.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='incidents'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='incidents'
    )

    # Incident classification
    class IncidentType(models.TextChoices):
        SECURITY = 'security', 'Security Incident'
        DATA_BREACH = 'data_breach', 'Data Breach'
        SERVICE_OUTAGE = 'service_outage', 'Service Outage'
        MALWARE = 'malware', 'Malware'
        PHISHING = 'phishing', 'Phishing'
        UNAUTHORIZED_ACCESS = 'unauthorized_access', 'Unauthorized Access'
        DENIAL_OF_SERVICE = 'denial_of_service', 'Denial of Service'
        INSIDER_THREAT = 'insider_threat', 'Insider Threat'
        PHYSICAL = 'physical', 'Physical Security'
        COMPLIANCE = 'compliance', 'Compliance Violation'
        OTHER = 'other', 'Other'

    incident_type = models.CharField(
        max_length=25,
        choices=IncidentType.choices,
        default=IncidentType.SECURITY
    )

    # Severity
    class Severity(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'
        INFORMATIONAL = 'informational', 'Informational'

    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MEDIUM
    )

    # Status workflow
    class IncidentStatus(models.TextChoices):
        REPORTED = 'reported', 'Reported'
        TRIAGED = 'triaged', 'Triaged'
        INVESTIGATING = 'investigating', 'Investigating'
        CONTAINED = 'contained', 'Contained'
        ERADICATING = 'eradicating', 'Eradicating'
        RECOVERING = 'recovering', 'Recovering'
        CLOSED = 'closed', 'Closed'
        FALSE_POSITIVE = 'false_positive', 'False Positive'

    status = models.CharField(
        max_length=20,
        choices=IncidentStatus.choices,
        default=IncidentStatus.REPORTED
    )

    # Incident details
    detailed_description = models.TextField(
        blank=True,
        default="",
        help_text="Detailed description of the incident"
    )
    root_cause = models.TextField(
        blank=True,
        default="",
        help_text="Root cause analysis"
    )
    impact_description = models.TextField(
        blank=True,
        default="",
        help_text="Description of the impact"
    )
    lessons_learned = models.TextField(
        blank=True,
        default="",
        help_text="Lessons learned from this incident"
    )

    # Timeline
    reported_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the incident was reported"
    )
    detected_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the incident was detected"
    )
    occurred_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the incident actually occurred"
    )
    contained_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the incident was contained"
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the incident was resolved"
    )
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the incident was closed"
    )

    # Ownership
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reported_incidents',
        help_text="User who reported the incident"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_incidents',
        help_text="User responsible for handling the incident"
    )
    responders = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='responding_incidents',
        help_text="Users involved in incident response"
    )

    # Impact metrics
    affected_users_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of affected users"
    )
    affected_systems = models.JSONField(
        default=list,
        blank=True,
        help_text="List of affected systems"
    )
    data_compromised = models.BooleanField(
        default=False,
        help_text="Whether data was compromised"
    )
    financial_impact = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Estimated financial impact"
    )

    # External reporting
    requires_notification = models.BooleanField(
        default=False,
        help_text="Whether external notification is required"
    )
    notification_sent = models.BooleanField(
        default=False,
        help_text="Whether notification has been sent"
    )
    notification_date = models.DateField(
        null=True,
        blank=True
    )
    regulatory_bodies_notified = models.JSONField(
        default=list,
        blank=True,
        help_text="List of regulatory bodies notified"
    )

    # Reference ID for external tracking
    external_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="External reference/ticket number"
    )

    class Meta:
        verbose_name = "Incident"
        verbose_name_plural = "Incidents"
        ordering = ['-reported_at', '-created_at']

    def __str__(self):
        return f"{self.get_severity_display()} - {self.name}"


class TimelineEntry(AbstractGRCEntity):
    """
    A timeline entry for an incident.

    Timeline entries document the chronological sequence
    of events, actions, and observations during incident handling.
    """
    incident = models.ForeignKey(
        Incident,
        on_delete=models.CASCADE,
        related_name='timeline_entries'
    )

    # Entry classification
    class EntryType(models.TextChoices):
        DETECTION = 'detection', 'Detection'
        TRIAGE = 'triage', 'Triage'
        ANALYSIS = 'analysis', 'Analysis'
        CONTAINMENT = 'containment', 'Containment'
        ERADICATION = 'eradication', 'Eradication'
        RECOVERY = 'recovery', 'Recovery'
        COMMUNICATION = 'communication', 'Communication'
        ESCALATION = 'escalation', 'Escalation'
        EVIDENCE = 'evidence', 'Evidence Collection'
        NOTE = 'note', 'Note'
        OTHER = 'other', 'Other'

    entry_type = models.CharField(
        max_length=20,
        choices=EntryType.choices,
        default=EntryType.NOTE
    )

    # Timestamp
    occurred_at = models.DateTimeField(
        help_text="When this event occurred"
    )

    # Content
    content = models.TextField(
        help_text="Description of the event or action"
    )

    # Technical details (optional)
    technical_details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured technical details"
    )

    # Who took the action or observed it
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='incident_timeline_entries'
    )

    # Visibility
    is_internal = models.BooleanField(
        default=True,
        help_text="Whether this entry is internal only"
    )

    # Attachments (file references)
    attachments = models.JSONField(
        default=list,
        blank=True,
        help_text="List of attached file references"
    )

    class Meta:
        verbose_name = "Timeline Entry"
        verbose_name_plural = "Timeline Entries"
        ordering = ['occurred_at']

    def __str__(self):
        return f"{self.incident.name} - {self.occurred_at}"
