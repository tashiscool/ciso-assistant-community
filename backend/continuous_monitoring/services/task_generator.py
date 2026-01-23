"""
ConMon Task Generator Service

Generates TaskTemplates and TaskNodes from ConMon activity configurations.
Integrates with the existing task management system for seamless workflow.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, date
from django.utils import timezone
from django.db import transaction
import structlog
import yaml

logger = structlog.get_logger(__name__)


class ConMonTaskGenerator:
    """
    Generates recurring tasks from ConMon schedule frameworks.

    Takes ConMon profiles and activity configurations and creates
    corresponding TaskTemplates with appropriate schedules.
    """

    # Mapping from frequency to TaskTemplate schedule format
    FREQUENCY_TO_SCHEDULE = {
        'continuous': {'frequency': 'DAILY', 'interval': 1},
        'daily': {'frequency': 'DAILY', 'interval': 1},
        'weekly': {'frequency': 'WEEKLY', 'interval': 1},
        'biweekly': {'frequency': 'WEEKLY', 'interval': 2},
        'every_10_days': {'frequency': 'DAILY', 'interval': 10},
        'monthly': {'frequency': 'MONTHLY', 'interval': 1},
        'every_60_days': {'frequency': 'MONTHLY', 'interval': 2},
        'quarterly': {'frequency': 'MONTHLY', 'interval': 3},
        'semi_annual': {'frequency': 'MONTHLY', 'interval': 6},
        'annual': {'frequency': 'YEARLY', 'interval': 1},
        'biennial': {'frequency': 'YEARLY', 'interval': 2},
        'triennial': {'frequency': 'YEARLY', 'interval': 3},
        'quinquennial': {'frequency': 'YEARLY', 'interval': 5},
    }

    # Infer frequency from ref_id patterns
    REF_ID_FREQUENCY_MAP = {
        'CONT': 'continuous',
        'WEEKLY': 'weekly',
        'MONTHLY': 'monthly',
        'QUARTERLY': 'quarterly',
        'ANNUAL': 'annual',
        'MULTI-YEAR': 'annual',  # Default to annual for multi-year
        'EVENT': None,  # Event-driven, no recurring schedule
        'FEDRAMP-M': 'monthly',
        'FEDRAMP-V': 'monthly',  # Vulnerability tracking is monthly
        'FEDRAMP-AA': 'annual',
        'FEDRAMP-SC': None,  # Significant change is event-driven
        'FEDRAMP-IR': None,  # Incident response is event-driven
        'FEDRAMP-P': None,  # Periodic has custom frequencies
    }

    def __init__(self, folder):
        """
        Initialize the task generator.

        Args:
            folder: The folder to create tasks in
        """
        self.folder = folder

    def generate_tasks_from_profile(
        self,
        profile,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        create_nodes: bool = True
    ) -> Dict[str, Any]:
        """
        Generate TaskTemplates from a ConMon profile's activity configurations.

        Args:
            profile: ConMonProfile instance
            start_date: Start date for task nodes (default: today)
            end_date: End date for task nodes (default: 1 year from start)
            create_nodes: Whether to create TaskNode instances

        Returns:
            Summary of created tasks
        """
        from continuous_monitoring.models import ConMonActivityConfig

        if start_date is None:
            start_date = timezone.localdate()
        if end_date is None:
            end_date = start_date + timedelta(days=365)

        activities = ConMonActivityConfig.objects.filter(
            profile=profile,
            enabled=True
        )

        results = {
            'created_templates': 0,
            'updated_templates': 0,
            'created_nodes': 0,
            'skipped': 0,
            'errors': [],
        }

        for activity in activities:
            try:
                template, created = self._create_or_update_task_template(
                    activity,
                    profile.assigned_actors.all()
                )

                if created:
                    results['created_templates'] += 1
                else:
                    results['updated_templates'] += 1

                if create_nodes and template and template.is_recurrent:
                    nodes_created = self._create_task_nodes(
                        template,
                        start_date,
                        end_date
                    )
                    results['created_nodes'] += nodes_created

                # Link template to activity config
                activity.task_template = template
                activity.save(update_fields=['task_template'])

            except Exception as e:
                logger.error(
                    "Error creating task for activity",
                    activity_id=str(activity.id),
                    error=str(e)
                )
                results['errors'].append({
                    'activity_id': str(activity.id),
                    'ref_id': activity.ref_id,
                    'error': str(e)
                })

        return results

    def _create_or_update_task_template(
        self,
        activity,
        default_actors
    ) -> Tuple[Any, bool]:
        """
        Create or update a TaskTemplate for an activity.

        Returns:
            Tuple of (TaskTemplate, was_created)
        """
        from core.models import TaskTemplate

        # Determine frequency and schedule
        frequency = self._get_activity_frequency(activity)
        schedule = self._get_schedule_for_frequency(frequency, activity)

        if schedule is None:
            # Event-driven activity, create non-recurring template
            is_recurrent = False
        else:
            is_recurrent = True

        # Check for existing template
        existing = activity.task_template

        if existing:
            # Update existing template
            existing.name = activity.name or f"ConMon: {activity.ref_id}"
            existing.description = self._build_task_description(activity)
            existing.is_recurrent = is_recurrent
            existing.schedule = schedule
            existing.enabled = activity.enabled
            existing.save()

            # Update actors
            if activity.assigned_actors.exists():
                existing.assigned_to.set(activity.assigned_actors.all())
            else:
                existing.assigned_to.set(default_actors)

            return existing, False

        # Create new template
        template = TaskTemplate.objects.create_task_template(
            name=activity.name or f"ConMon: {activity.ref_id}",
            description=self._build_task_description(activity),
            ref_id=f"CONMON-{activity.ref_id}",
            folder=self.folder,
            is_recurrent=is_recurrent,
            schedule=schedule,
            enabled=activity.enabled,
            task_date=timezone.localdate() if not is_recurrent else None,
        )

        # Assign actors
        if activity.assigned_actors.exists():
            template.assigned_to.set(activity.assigned_actors.all())
        else:
            template.assigned_to.set(default_actors)

        # Link applied controls
        if activity.applied_controls.exists():
            template.applied_controls.set(activity.applied_controls.all())

        return template, True

    def _get_activity_frequency(self, activity) -> Optional[str]:
        """Determine the frequency for an activity."""
        # Check for override
        if activity.frequency_override and activity.frequency_override != 'inherit':
            return activity.frequency_override

        # Infer from ref_id
        ref_id = activity.ref_id or ''
        ref_upper = ref_id.upper()

        for prefix, freq in self.REF_ID_FREQUENCY_MAP.items():
            if ref_upper.startswith(prefix):
                return freq

        # Default to monthly
        return 'monthly'

    def _get_schedule_for_frequency(
        self,
        frequency: Optional[str],
        activity
    ) -> Optional[Dict[str, Any]]:
        """Get TaskTemplate schedule for a frequency."""
        if frequency is None:
            return None

        # Check for custom schedule
        if activity.custom_schedule:
            return activity.custom_schedule

        # Use standard mapping
        schedule = self.FREQUENCY_TO_SCHEDULE.get(frequency)

        if schedule:
            return dict(schedule)  # Return a copy

        return None

    def _build_task_description(self, activity) -> str:
        """Build task description from activity configuration."""
        parts = []

        if activity.name:
            parts.append(f"**{activity.name}**")

        parts.append(f"Reference: {activity.ref_id}")

        if activity.notes:
            parts.append(f"\n{activity.notes}")

        parts.append(f"\nURN: {activity.requirement_urn}")

        return "\n".join(parts)

    def _create_task_nodes(
        self,
        template,
        start_date: date,
        end_date: date
    ) -> int:
        """
        Create TaskNode instances for a template within date range.

        Returns:
            Number of nodes created
        """
        from core.models import TaskNode

        if not template.schedule:
            return 0

        schedule = template.schedule
        frequency = schedule.get('frequency', 'MONTHLY')
        interval = schedule.get('interval', 1)

        # Calculate due dates
        due_dates = self._calculate_due_dates(
            start_date,
            end_date,
            frequency,
            interval
        )

        # Create nodes for dates that don't already exist
        existing_dates = set(
            TaskNode.objects.filter(
                task_template=template,
                due_date__gte=start_date,
                due_date__lte=end_date
            ).values_list('due_date', flat=True)
        )

        nodes_created = 0
        for due_date in due_dates:
            if due_date not in existing_dates:
                TaskNode.objects.create(
                    task_template=template,
                    folder=template.folder,
                    due_date=due_date,
                    status='pending'
                )
                nodes_created += 1

        return nodes_created

    def _calculate_due_dates(
        self,
        start_date: date,
        end_date: date,
        frequency: str,
        interval: int
    ) -> List[date]:
        """Calculate due dates for a recurring schedule."""
        from dateutil.relativedelta import relativedelta

        dates = []
        current = start_date

        while current <= end_date:
            dates.append(current)

            if frequency == 'DAILY':
                current = current + timedelta(days=interval)
            elif frequency == 'WEEKLY':
                current = current + timedelta(weeks=interval)
            elif frequency == 'MONTHLY':
                current = current + relativedelta(months=interval)
            elif frequency == 'YEARLY':
                current = current + relativedelta(years=interval)
            else:
                break

        return dates

    @classmethod
    def setup_from_framework(
        cls,
        folder,
        framework_urn: str,
        profile_name: str,
        profile_type: str = 'custom',
        implementation_groups: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Set up ConMon profile and activities from a framework library.

        This is the main entry point for setting up ConMon from the
        conmon-schedule or fedramp-conmon-checklist frameworks.

        Args:
            folder: Folder to create the profile in
            framework_urn: URN of the framework (e.g., 'urn:intuitem:risk:framework:conmon-schedule')
            profile_name: Name for the new profile
            profile_type: Profile type (fedramp_low, fedramp_moderate, etc.)
            implementation_groups: List of implementation groups to include

        Returns:
            Summary of created objects
        """
        from core.models import Framework, RequirementNode
        from continuous_monitoring.models import ConMonProfile, ConMonActivityConfig

        results = {
            'profile_id': None,
            'activities_created': 0,
            'errors': [],
        }

        try:
            # Get the framework
            framework = Framework.objects.get(urn=framework_urn)
        except Framework.DoesNotExist:
            results['errors'].append(f"Framework not found: {framework_urn}")
            return results

        with transaction.atomic():
            # Create profile
            profile = ConMonProfile.objects.create(
                name=profile_name,
                folder=folder,
                profile_type=profile_type,
                status='draft',
                base_framework=framework,
                implementation_groups=implementation_groups or [],
            )
            results['profile_id'] = str(profile.id)

            # Get assessable requirements
            requirements = RequirementNode.objects.filter(
                framework=framework,
                assessable=True
            )

            # Filter by implementation groups if specified
            if implementation_groups:
                requirements = requirements.filter(
                    implementation_groups__overlap=implementation_groups
                )

            # Create activity configs for each requirement
            for req in requirements:
                try:
                    ConMonActivityConfig.objects.create(
                        profile=profile,
                        folder=folder,
                        requirement_urn=req.urn,
                        ref_id=req.ref_id or '',
                        name=req.name or '',
                        enabled=True,
                    )
                    results['activities_created'] += 1
                except Exception as e:
                    results['errors'].append({
                        'requirement_urn': req.urn,
                        'error': str(e)
                    })

        return results
