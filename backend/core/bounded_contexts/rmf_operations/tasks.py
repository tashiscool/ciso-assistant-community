"""
RMF Operations Background Tasks

Periodic tasks for monitoring and notifications related to:
- US-CERT/CISA incident reporting deadlines
- FedRAMP Significant Change Notification (SCN) tracking
- Incident response SLA monitoring
- Change control workflow reminders
"""

from collections import defaultdict
from datetime import timedelta
from huey import crontab
from huey.contrib.djhuey import db_periodic_task, task
from django.conf import settings
from django.utils import timezone

import structlog

logger = structlog.getLogger(__name__)


# =============================================================================
# US-CERT Reporting Deadline Monitoring
# =============================================================================

# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(hour="*/1"))  # Check every hour
def check_uscert_reporting_deadlines():
    """
    Check for incidents with approaching US-CERT reporting deadlines.
    Sends alerts at:
    - 4 hours before deadline (for critical)
    - 8 hours before deadline (for high)
    - 24 hours before deadline (for moderate/low)
    """
    from .aggregates import SecurityIncident

    now = timezone.now()

    # Find incidents pending US-CERT reporting
    pending_incidents = SecurityIncident.objects.filter(
        uscert_reporting_status='pending',
        uscert_reporting_deadline__isnull=False
    )

    for incident in pending_incidents:
        hours_remaining = (incident.uscert_reporting_deadline - now).total_seconds() / 3600

        # Determine notification thresholds based on severity
        if incident.severity == SecurityIncident.IncidentSeverity.CRITICAL:
            notify_threshold = 4  # 4 hours for critical
        elif incident.severity == SecurityIncident.IncidentSeverity.HIGH:
            notify_threshold = 8  # 8 hours for high
        else:
            notify_threshold = 24  # 24 hours for moderate/low

        # Send notification if approaching deadline
        if 0 < hours_remaining <= notify_threshold:
            send_uscert_deadline_approaching_notification(incident, hours_remaining)
            logger.info(
                f"US-CERT deadline approaching alert sent",
                incident=incident.incident_number,
                hours_remaining=hours_remaining
            )


# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(minute="*/30"))  # Check every 30 minutes
def check_overdue_uscert_reports():
    """
    Check for incidents with overdue US-CERT reporting.
    Sends escalation alerts for overdue reports.
    """
    from .aggregates import SecurityIncident

    now = timezone.now()

    # Find overdue incidents
    overdue_incidents = SecurityIncident.objects.filter(
        uscert_reporting_status='pending',
        uscert_reporting_deadline__lt=now
    )

    for incident in overdue_incidents:
        hours_overdue = (now - incident.uscert_reporting_deadline).total_seconds() / 3600
        send_uscert_deadline_overdue_notification(incident, hours_overdue)
        logger.warning(
            f"US-CERT reporting OVERDUE",
            incident=incident.incident_number,
            hours_overdue=hours_overdue
        )


# =============================================================================
# Significant Change Notification (SCN) Monitoring
# =============================================================================

# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(hour="8", minute="0"))  # Daily at 8 AM
def check_pending_scn_submissions():
    """
    Check for change requests requiring SCN submission.
    Sends daily reminders for pending SCN submissions.
    """
    from .aggregates import SignificantChangeRequest

    pending_scn = SignificantChangeRequest.objects.filter(
        status='scn_required'
    )

    for change_request in pending_scn:
        # Check if approaching planned implementation date
        if change_request.planned_implementation_date:
            days_until = (change_request.planned_implementation_date - timezone.now().date()).days
            if days_until <= 14:  # Within 2 weeks of implementation
                send_scn_reminder_notification(change_request, days_until)
                logger.info(
                    f"SCN reminder sent",
                    change=change_request.change_number,
                    days_until_implementation=days_until
                )


# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(hour="9", minute="0"))  # Daily at 9 AM
def check_stale_change_requests():
    """
    Check for change requests that have been in progress too long
    without movement through the workflow.
    """
    from .aggregates import SignificantChangeRequest

    stale_threshold = timezone.now() - timedelta(days=14)

    stale_statuses = [
        'submitted',
        'impact_analysis',
        'impact_assessed',
        'scn_submitted'
    ]

    stale_requests = SignificantChangeRequest.objects.filter(
        status__in=stale_statuses,
        updated_at__lt=stale_threshold
    )

    for change_request in stale_requests:
        days_stale = (timezone.now() - change_request.updated_at).days
        send_stale_change_request_notification(change_request, days_stale)
        logger.info(
            f"Stale change request alert sent",
            change=change_request.change_number,
            days_stale=days_stale
        )


# =============================================================================
# Incident Response Monitoring
# =============================================================================

# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(hour="*/4"))  # Every 4 hours
def check_open_incident_sla():
    """
    Monitor open incidents for SLA compliance.
    Alert if incidents are open longer than expected based on severity.
    """
    from .aggregates import SecurityIncident

    now = timezone.now()

    # SLA thresholds in hours
    sla_thresholds = {
        SecurityIncident.IncidentSeverity.CRITICAL: 24,  # 24 hours
        SecurityIncident.IncidentSeverity.HIGH: 72,  # 3 days
        SecurityIncident.IncidentSeverity.MODERATE: 168,  # 7 days
        SecurityIncident.IncidentSeverity.LOW: 336,  # 14 days
    }

    open_statuses = [
        'detected', 'reported', 'analyzing', 'contained',
        'eradicating', 'eradicated', 'recovering'
    ]

    open_incidents = SecurityIncident.objects.filter(
        status__in=open_statuses
    )

    for incident in open_incidents:
        hours_open = (now - incident.detected_at).total_seconds() / 3600
        sla_hours = sla_thresholds.get(incident.severity, 168)

        if hours_open > sla_hours:
            logger.warning(
                f"Incident exceeds SLA",
                incident=incident.incident_number,
                severity=incident.severity,
                hours_open=hours_open,
                sla_hours=sla_hours
            )


# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(hour="7", minute="0"))  # Daily at 7 AM
def generate_daily_incident_summary():
    """
    Generate daily summary of incident response activity.
    """
    from .aggregates import SecurityIncident

    now = timezone.now()
    yesterday = now - timedelta(days=1)

    # New incidents in last 24 hours
    new_incidents = SecurityIncident.objects.filter(
        created_at__gte=yesterday
    ).count()

    # Open incidents by severity
    open_by_severity = {}
    for severity in SecurityIncident.IncidentSeverity.values:
        count = SecurityIncident.objects.filter(
            severity=severity,
            status__in=['detected', 'reported', 'analyzing', 'contained', 'eradicating']
        ).count()
        open_by_severity[severity] = count

    # Closed in last 24 hours
    closed_incidents = SecurityIncident.objects.filter(
        closed_at__gte=yesterday
    ).count()

    # Overdue US-CERT reporting
    overdue_count = SecurityIncident.objects.filter(
        uscert_reporting_status='pending',
        uscert_reporting_deadline__lt=now
    ).count()

    logger.info(
        "Daily incident summary",
        new_incidents=new_incidents,
        open_by_severity=open_by_severity,
        closed_incidents=closed_incidents,
        overdue_uscert=overdue_count
    )


# =============================================================================
# Change Control Monitoring
# =============================================================================

# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(hour="7", minute="30"))  # Daily at 7:30 AM
def check_upcoming_implementations():
    """
    Check for change requests with implementations coming up.
    Alerts for changes due to be implemented in the next 7 days.
    """
    from .aggregates import SignificantChangeRequest

    today = timezone.now().date()
    week_out = today + timedelta(days=7)

    upcoming_changes = SignificantChangeRequest.objects.filter(
        status='approved',
        planned_implementation_date__gte=today,
        planned_implementation_date__lte=week_out
    )

    for change in upcoming_changes:
        days_until = (change.planned_implementation_date - today).days
        logger.info(
            f"Upcoming implementation",
            change=change.change_number,
            days_until=days_until
        )


# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(hour="8", minute="30"))  # Daily at 8:30 AM
def check_overdue_implementations():
    """
    Check for approved change requests past their planned implementation date.
    """
    from .aggregates import SignificantChangeRequest

    today = timezone.now().date()

    overdue_changes = SignificantChangeRequest.objects.filter(
        status='approved',
        planned_implementation_date__lt=today
    )

    for change in overdue_changes:
        days_overdue = (today - change.planned_implementation_date).days
        logger.warning(
            f"Implementation overdue",
            change=change.change_number,
            days_overdue=days_overdue
        )


# =============================================================================
# Notification Sending Functions
# =============================================================================

@task()
def send_uscert_deadline_approaching_notification(incident, hours_remaining):
    """Send notification for approaching US-CERT deadline"""
    from core.tasks import check_email_configuration, send_notification_email
    from core.email_utils import render_email_template

    # Get CSO name
    from .aggregates import CloudServiceOffering
    try:
        cso = CloudServiceOffering.objects.get(id=incident.cloud_service_offering_id)
        cso_name = cso.name
    except CloudServiceOffering.DoesNotExist:
        cso_name = "Unknown CSO"

    context = {
        'incident_number': incident.incident_number,
        'incident_title': incident.title,
        'severity': incident.get_severity_display(),
        'category': incident.get_category_display(),
        'deadline': incident.uscert_reporting_deadline.strftime("%Y-%m-%d %H:%M UTC") if incident.uscert_reporting_deadline else "Unknown",
        'hours_remaining': f"{hours_remaining:.1f}",
        'cso_name': cso_name,
    }

    rendered = render_email_template('uscert_deadline_approaching', context)
    if rendered:
        # In production, this would send to incident response team
        # For now, log the notification
        logger.info(
            "US-CERT deadline approaching notification prepared",
            incident=incident.incident_number,
            subject=rendered['subject']
        )


@task()
def send_uscert_deadline_overdue_notification(incident, hours_overdue):
    """Send notification for overdue US-CERT deadline"""
    from core.tasks import check_email_configuration, send_notification_email
    from core.email_utils import render_email_template

    context = {
        'incident_number': incident.incident_number,
        'incident_title': incident.title,
        'severity': incident.get_severity_display(),
        'category': incident.get_category_display(),
        'deadline': incident.uscert_reporting_deadline.strftime("%Y-%m-%d %H:%M UTC") if incident.uscert_reporting_deadline else "Unknown",
        'hours_overdue': f"{hours_overdue:.1f}",
    }

    rendered = render_email_template('uscert_deadline_overdue', context)
    if rendered:
        logger.warning(
            "US-CERT deadline OVERDUE notification prepared",
            incident=incident.incident_number,
            subject=rendered['subject']
        )


@task()
def send_scn_reminder_notification(change_request, days_until_implementation):
    """Send reminder for pending SCN submission"""
    from core.tasks import check_email_configuration, send_notification_email
    from core.email_utils import render_email_template

    context = {
        'change_number': change_request.change_number,
        'change_title': change_request.title,
        'change_type': change_request.get_change_type_display(),
        'scn_category': change_request.get_scn_category_display(),
        'impact_level': change_request.get_impact_level_display(),
        'affected_ksi_count': len(change_request.affected_ksi_ids),
        'affected_control_count': len(change_request.affected_control_ids),
        'risk_delta': change_request.risk_delta,
        'planned_date': str(change_request.planned_implementation_date) if change_request.planned_implementation_date else "Not set",
    }

    rendered = render_email_template('scn_reminder', context)
    if rendered:
        logger.info(
            "SCN reminder notification prepared",
            change=change_request.change_number,
            subject=rendered['subject']
        )


@task()
def send_stale_change_request_notification(change_request, days_stale):
    """Send notification for stale change requests"""
    logger.info(
        "Stale change request notification",
        change=change_request.change_number,
        status=change_request.status,
        days_stale=days_stale
    )


@task()
def send_critical_incident_notification(incident):
    """Send immediate notification for critical incidents"""
    from core.tasks import check_email_configuration, send_notification_email
    from core.email_utils import render_email_template

    # Get CSO name
    from .aggregates import CloudServiceOffering
    try:
        cso = CloudServiceOffering.objects.get(id=incident.cloud_service_offering_id)
        cso_name = cso.name
    except CloudServiceOffering.DoesNotExist:
        cso_name = "Unknown CSO"

    context = {
        'incident_number': incident.incident_number,
        'incident_title': incident.title,
        'category': incident.get_category_display(),
        'detected_at': incident.detected_at.strftime("%Y-%m-%d %H:%M UTC") if incident.detected_at else "Unknown",
        'detection_method': incident.detection_method or "Unknown",
        'cso_name': cso_name,
        'uscert_deadline': incident.uscert_reporting_deadline.strftime("%Y-%m-%d %H:%M UTC") if incident.uscert_reporting_deadline else "1 hour from detection",
    }

    rendered = render_email_template('incident_critical_alert', context)
    if rendered:
        logger.critical(
            "CRITICAL incident notification prepared",
            incident=incident.incident_number,
            subject=rendered['subject']
        )


@task()
def send_incident_status_notification(incident, old_status, updated_by, notes=None):
    """Send notification when incident status changes"""
    from core.tasks import check_email_configuration, send_notification_email
    from core.email_utils import render_email_template

    hours_open = incident._hours_since_detection() if incident.is_open() else (incident.time_to_resolve() or 0)

    context = {
        'incident_number': incident.incident_number,
        'incident_title': incident.title,
        'old_status': old_status,
        'new_status': incident.get_status_display(),
        'severity': incident.get_severity_display(),
        'category': incident.get_category_display(),
        'detected_at': incident.detected_at.strftime("%Y-%m-%d %H:%M UTC") if incident.detected_at else "Unknown",
        'hours_open': f"{hours_open:.1f}",
        'updated_at': timezone.now().strftime("%Y-%m-%d %H:%M UTC"),
        'updated_by': updated_by or "System",
        'status_notes': notes or "",
        'uscert_status': incident.get_uscert_reporting_status_display(),
    }

    rendered = render_email_template('incident_status_update', context)
    if rendered:
        logger.info(
            "Incident status update notification prepared",
            incident=incident.incident_number,
            old_status=old_status,
            new_status=incident.status
        )


@task()
def send_change_approved_notification(change_request):
    """Send notification when change request is approved"""
    from core.tasks import check_email_configuration, send_notification_email
    from core.email_utils import render_email_template

    context = {
        'change_number': change_request.change_number,
        'change_title': change_request.title,
        'approver': change_request.approver_name or "Unknown",
        'approval_date': change_request.approval_date.strftime("%Y-%m-%d %H:%M UTC") if change_request.approval_date else "Unknown",
        'approval_notes': change_request.approval_notes or "No additional notes.",
        'change_type': change_request.get_change_type_display(),
        'impact_level': change_request.get_impact_level_display(),
        'scn_required': "Yes" if change_request.scn_required else "No",
        'scn_reference': change_request.scn_reference_number or "N/A",
        'planned_date': str(change_request.planned_implementation_date) if change_request.planned_implementation_date else "Not set",
    }

    rendered = render_email_template('change_request_approved', context)
    if rendered:
        logger.info(
            "Change approved notification prepared",
            change=change_request.change_number,
            subject=rendered['subject']
        )


# =============================================================================
# OAR Integration Tasks
# =============================================================================

# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(day_of_week="0", hour="2", minute="0"))  # Weekly on Sunday at 2 AM
def capture_weekly_incident_metrics():
    """
    Capture weekly incident metrics for OAR reporting.
    """
    from .aggregates import SecurityIncident

    now = timezone.now()
    week_ago = now - timedelta(days=7)

    # Calculate metrics
    total_incidents = SecurityIncident.objects.filter(
        detected_at__gte=week_ago
    ).count()

    critical_incidents = SecurityIncident.objects.filter(
        detected_at__gte=week_ago,
        severity='critical'
    ).count()

    closed_incidents = SecurityIncident.objects.filter(
        closed_at__gte=week_ago
    ).count()

    # Average time to contain for closed incidents
    contained_incidents = SecurityIncident.objects.filter(
        contained_at__gte=week_ago,
        contained_at__isnull=False,
        detected_at__isnull=False
    )

    if contained_incidents.exists():
        total_contain_hours = sum([
            (i.contained_at - i.detected_at).total_seconds() / 3600
            for i in contained_incidents
        ])
        avg_contain_hours = total_contain_hours / contained_incidents.count()
    else:
        avg_contain_hours = 0

    logger.info(
        "Weekly incident metrics captured",
        total_incidents=total_incidents,
        critical_incidents=critical_incidents,
        closed_incidents=closed_incidents,
        avg_contain_hours=f"{avg_contain_hours:.1f}"
    )


# @db_periodic_task(crontab(minute="*/1"))  # for testing
@db_periodic_task(crontab(day_of_week="0", hour="2", minute="30"))  # Weekly on Sunday at 2:30 AM
def capture_weekly_change_metrics():
    """
    Capture weekly change control metrics for OAR reporting.
    """
    from .aggregates import SignificantChangeRequest

    now = timezone.now()
    week_ago = now - timedelta(days=7)

    # Calculate metrics
    total_changes = SignificantChangeRequest.objects.filter(
        created_at__gte=week_ago
    ).count()

    scn_required_count = SignificantChangeRequest.objects.filter(
        created_at__gte=week_ago,
        scn_required=True
    ).count()

    implemented_count = SignificantChangeRequest.objects.filter(
        actual_implementation_date__gte=week_ago.date()
    ).count()

    logger.info(
        "Weekly change metrics captured",
        total_changes=total_changes,
        scn_required=scn_required_count,
        implemented=implemented_count
    )
