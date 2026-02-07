"""
Django Signals for Triggering Automated Workflows

Hooks into Django's post_save signal to trigger:
- Control re-validation when evidence is uploaded
- Control re-validation when findings are created or remediated
- POA&M auto-generation for critical findings

These signals bridge the gap between model lifecycle events and
continuous monitoring workflows without coupling models directly
to service logic.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def register_signals():
    """
    Register all signal handlers.

    Call from AppConfig.ready() to ensure signals are connected
    when the application starts. The @receiver decorators below
    handle the actual registration, so this function serves as
    an explicit entry point.
    """
    logger.debug("ConMon signal handlers registered")


@receiver(post_save)
def handle_evidence_save(sender, instance, created, **kwargs):
    """
    Auto-validate controls when evidence is uploaded.

    Triggers the ControlValidatorService to re-assess all controls
    linked to the newly created evidence, updating their compliance
    status based on evidence freshness and related findings.
    """
    # Only act on Evidence model creation
    if sender.__name__ != "Evidence":
        return
    if not created:
        return

    try:
        from core.bounded_contexts.compliance.services.control_validator import (
            get_control_validator_service,
        )

        validator = get_control_validator_service()
        validator.on_evidence_uploaded(str(instance.id))
        logger.info(
            f"Control validation triggered for new evidence {instance.id}"
        )

        # Send notification for evidence upload
        _notify_evidence_uploaded(instance)
    except Exception as exc:
        logger.warning(
            f"Control validation failed for evidence {instance.id}: {exc}"
        )


@receiver(post_save)
def handle_finding_save(sender, instance, created, **kwargs):
    """
    Auto-validate controls when findings are created or status changes.

    When a new finding is created, linked controls may need to be
    flagged as at-risk. When a finding's lifecycle state changes
    (e.g., to 'closed' or 'verified'), controls may improve.
    """
    # Handle ComplianceFinding from bounded context
    if sender.__name__ == "ComplianceFinding":
        _handle_compliance_finding(instance, created)
        return

    # Handle VulnerabilityFinding from RMF operations
    if sender.__name__ == "VulnerabilityFinding":
        _handle_vulnerability_finding(instance, created)
        return


def _handle_compliance_finding(instance, created):
    """Process ComplianceFinding save events."""
    try:
        from core.bounded_contexts.compliance.services.control_validator import (
            get_control_validator_service,
        )

        validator = get_control_validator_service()

        if created:
            validator.on_finding_created(str(instance.id))
            logger.info(
                f"Control validation triggered for new compliance finding "
                f"{instance.id}"
            )
            severity = getattr(instance, "severity", None)
            if severity in ("critical", "high"):
                _notify_finding_critical(instance)
        else:
            # Check if finding was remediated (closed or verified)
            lifecycle_state = getattr(instance, "lifecycle_state", None)
            if lifecycle_state in ("closed", "verified"):
                validator.on_finding_remediated(str(instance.id))
                logger.info(
                    f"Control validation triggered for remediated compliance "
                    f"finding {instance.id} (state: {lifecycle_state})"
                )
    except Exception as exc:
        logger.warning(
            f"Control validation failed for compliance finding "
            f"{instance.id}: {exc}"
        )


def _handle_vulnerability_finding(instance, created):
    """Process VulnerabilityFinding save events."""
    try:
        from core.bounded_contexts.compliance.services.control_validator import (
            get_control_validator_service,
        )

        validator = get_control_validator_service()

        if created:
            validator.on_finding_created(str(instance.id))
            logger.info(
                f"Control validation triggered for new vulnerability finding "
                f"{instance.id}"
            )
        else:
            # Check if finding was remediated
            status = getattr(instance, "status", None)
            if status in ("not_a_finding", "not_applicable"):
                validator.on_finding_remediated(str(instance.id))
                logger.info(
                    f"Control validation triggered for remediated vulnerability "
                    f"finding {instance.id} (status: {status})"
                )
    except Exception as exc:
        logger.warning(
            f"Control validation failed for vulnerability finding "
            f"{instance.id}: {exc}"
        )


@receiver(post_save)
def handle_poam_auto_generation(sender, instance, created, **kwargs):
    """
    Auto-generate POA&M items when critical findings are created.

    When a ComplianceFinding with severity 'critical' or 'high' is created,
    automatically create a draft POA&M item to track remediation.
    """
    if sender.__name__ != "ComplianceFinding":
        return
    if not created:
        return

    severity = getattr(instance, "severity", None)
    if severity not in ("critical", "high"):
        return

    try:
        from poam.models.poam_item import POAMItem
        from django.utils import timezone
        import uuid

        # Check if a POA&M item already exists for this finding
        existing = POAMItem.objects.filter(
            vulnerability_finding_id=instance.id
        ).first()
        if existing:
            logger.debug(
                f"POA&M item already exists for finding {instance.id}"
            )
            return

        # Create a draft POA&M item
        poam = POAMItem()
        poam.weakness_id = f"CF-{str(instance.id)[:8].upper()}"
        poam.title = getattr(instance, "title", "Untitled Finding")
        poam.description = getattr(
            instance, "description", ""
        ) or f"Auto-generated from {severity} compliance finding"
        # Use a default system group UUID if not determinable
        poam.system_group_id = getattr(
            instance, "source_id", uuid.uuid4()
        )
        poam.vulnerability_finding_id = instance.id
        poam.risk_level = "very_high" if severity == "critical" else "high"
        poam.source_type = "assessment"
        poam.status = "draft"
        poam.identified_date = timezone.now().date()
        poam.tags = ["auto-generated", f"severity:{severity}"]
        poam.save()

        logger.info(
            f"Auto-generated POA&M item {poam.weakness_id} for "
            f"{severity} finding {instance.id}"
        )

        # Notify about the new POA&M item
        _notify_poam_created(poam)
    except Exception as exc:
        logger.warning(
            f"Failed to auto-generate POA&M for finding {instance.id}: {exc}"
        )


# -------------------------------------------------------------------------
# Notification helpers
# -------------------------------------------------------------------------

def _notify_evidence_uploaded(instance):
    """Send notification when evidence is uploaded."""
    try:
        from core.notifications.consumer import send_notification, NotificationType

        # Notify the evidence owner/folder owner
        folder = getattr(instance, "folder", None)
        if folder:
            owner = getattr(folder, "owner", None)
            if owner:
                send_notification(
                    user_id=str(owner.id),
                    notification_type=NotificationType.EVIDENCE_UPLOADED,
                    title="Evidence Uploaded",
                    message=f"New evidence '{instance.name}' has been uploaded.",
                    data={"evidence_id": str(instance.id)},
                )
    except Exception as exc:
        logger.debug(f"Evidence notification skipped: {exc}")


def _notify_finding_critical(instance):
    """Send notification for critical findings."""
    try:
        from core.notifications.consumer import send_notification, NotificationType

        send_notification(
            user_id="system",
            notification_type=NotificationType.FINDING_CRITICAL,
            title=f"Critical Finding Detected",
            message=f"A {getattr(instance, 'severity', 'critical')} finding has been created: "
                    f"{getattr(instance, 'title', str(instance.id))}",
            data={"finding_id": str(instance.id)},
        )
    except Exception as exc:
        logger.debug(f"Finding notification skipped: {exc}")


def _notify_poam_created(poam):
    """Send notification when a POA&M item is auto-generated."""
    try:
        from core.notifications.consumer import send_notification, NotificationType

        send_notification(
            user_id="system",
            notification_type=NotificationType.POAM_CREATED,
            title="POA&M Item Auto-Generated",
            message=f"POA&M item '{poam.weakness_id}' has been auto-generated "
                    f"for a {poam.risk_level} finding.",
            data={
                "poam_id": str(poam.id),
                "weakness_id": poam.weakness_id,
                "risk_level": poam.risk_level,
            },
        )
    except Exception as exc:
        logger.debug(f"POA&M notification skipped: {exc}")
