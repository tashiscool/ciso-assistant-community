"""
Continuous Monitoring Service

Provides comprehensive ConMon dashboard data, metrics calculation, and
activity tracking. Designed to be framework-agnostic with FedRAMP as
the reference implementation.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from django.utils import timezone
from django.db.models import Count, Q, Avg, F
from collections import defaultdict
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class ConMonActivitySummary:
    """Summary of a ConMon activity's status."""
    ref_id: str
    name: str
    frequency: str
    status: str  # 'on_track', 'due_soon', 'overdue', 'completed', 'not_applicable'
    last_completed: Optional[date]
    next_due: Optional[date]
    completion_rate: float
    assigned_to: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            'ref_id': self.ref_id,
            'name': self.name,
            'frequency': self.frequency,
            'status': self.status,
            'last_completed': self.last_completed.isoformat() if self.last_completed else None,
            'next_due': self.next_due.isoformat() if self.next_due else None,
            'completion_rate': self.completion_rate,
            'assigned_to': self.assigned_to,
        }


@dataclass
class ConMonMetricSummary:
    """Summary of a ConMon KPI/metric."""
    name: str
    value: float
    target: float
    unit: str
    status: str  # 'good', 'warning', 'critical'
    trend: str  # 'up', 'down', 'stable'
    trend_value: float
    description: str
    category: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'value': self.value,
            'target': self.target,
            'unit': self.unit,
            'status': self.status,
            'trend': self.trend,
            'trend_value': self.trend_value,
            'description': self.description,
            'category': self.category,
        }


@dataclass
class ConMonDashboardData:
    """Complete ConMon dashboard data."""
    profile_summary: Dict[str, Any] = field(default_factory=dict)
    overall_health: Dict[str, Any] = field(default_factory=dict)
    activities_by_frequency: Dict[str, List[ConMonActivitySummary]] = field(default_factory=dict)
    metrics: List[ConMonMetricSummary] = field(default_factory=list)
    upcoming_activities: List[Dict[str, Any]] = field(default_factory=list)
    overdue_activities: List[Dict[str, Any]] = field(default_factory=list)
    recent_completions: List[Dict[str, Any]] = field(default_factory=list)
    compliance_by_frequency: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'profile_summary': self.profile_summary,
            'overall_health': self.overall_health,
            'activities_by_frequency': {
                freq: [a.to_dict() for a in activities]
                for freq, activities in self.activities_by_frequency.items()
            },
            'metrics': [m.to_dict() for m in self.metrics],
            'upcoming_activities': self.upcoming_activities,
            'overdue_activities': self.overdue_activities,
            'recent_completions': self.recent_completions,
            'compliance_by_frequency': self.compliance_by_frequency,
        }


class ConMonService:
    """
    Service for Continuous Monitoring operations.

    Provides:
    - Dashboard data aggregation
    - Activity status tracking
    - Metric calculation
    - Health scoring
    """

    # Default frequency mappings (days)
    FREQUENCY_DAYS = {
        'continuous': 1,
        'daily': 1,
        'weekly': 7,
        'biweekly': 14,
        'monthly': 30,
        'quarterly': 90,
        'semi_annual': 180,
        'annual': 365,
        'biennial': 730,
        'triennial': 1095,
    }

    # Thresholds for status calculation
    THRESHOLDS = {
        'due_soon_days': 7,  # Days before due to mark as "due soon"
        'completion_rate_good': 0.95,
        'completion_rate_warning': 0.80,
        'on_time_rate_good': 0.90,
        'on_time_rate_warning': 0.75,
    }

    def __init__(self, profile_id: Optional[str] = None, folder_id: Optional[str] = None):
        """
        Initialize the ConMon service.

        Args:
            profile_id: Optional ConMonProfile ID to scope data
            folder_id: Optional folder ID to scope data
        """
        self.profile_id = profile_id
        self.folder_id = folder_id

    def get_dashboard_data(self) -> ConMonDashboardData:
        """Get complete dashboard data for the ConMon profile."""
        from continuous_monitoring.models import (
            ConMonProfile, ConMonActivityConfig, ConMonExecution, ConMonMetric
        )

        data = ConMonDashboardData()

        # Get profile
        profile = None
        if self.profile_id:
            try:
                profile = ConMonProfile.objects.get(id=self.profile_id)
                data.profile_summary = self._get_profile_summary(profile)
            except ConMonProfile.DoesNotExist:
                pass

        # Calculate overall health
        data.overall_health = self._calculate_overall_health(profile)

        # Get activities grouped by frequency
        data.activities_by_frequency = self._get_activities_by_frequency(profile)

        # Calculate metrics
        data.metrics = self._calculate_metrics(profile)

        # Get upcoming activities (next 14 days)
        data.upcoming_activities = self._get_upcoming_activities(profile, days=14)

        # Get overdue activities
        data.overdue_activities = self._get_overdue_activities(profile)

        # Get recent completions (last 30 days)
        data.recent_completions = self._get_recent_completions(profile, days=30)

        # Calculate compliance by frequency
        data.compliance_by_frequency = self._calculate_compliance_by_frequency(profile)

        return data

    def _get_profile_summary(self, profile) -> Dict[str, Any]:
        """Get summary information about the profile."""
        if not profile:
            return {}

        return {
            'id': str(profile.id),
            'name': profile.name,
            'profile_type': profile.profile_type,
            'profile_type_display': profile.get_profile_type_display(),
            'status': profile.status,
            'status_display': profile.get_status_display(),
            'base_framework': profile.base_framework.name if profile.base_framework else None,
            'implementation_groups': profile.implementation_groups,
            'total_activities': profile.activity_configs.filter(enabled=True).count(),
            'assigned_actors': [
                {'id': str(a.id), 'name': str(a)}
                for a in profile.assigned_actors.all()
            ],
        }

    def _calculate_overall_health(self, profile) -> Dict[str, Any]:
        """Calculate overall ConMon health score."""
        from continuous_monitoring.models import ConMonExecution

        if not profile:
            return self._get_default_health()

        today = timezone.localdate()
        thirty_days_ago = today - timedelta(days=30)

        # Get executions for this profile
        executions = ConMonExecution.objects.filter(
            activity_config__profile=profile,
            due_date__gte=thirty_days_ago,
            due_date__lte=today
        )

        total = executions.count()
        if total == 0:
            return self._get_default_health()

        completed = executions.filter(
            status__in=['completed', 'completed_late']
        ).count()
        on_time = executions.filter(status='completed').count()
        overdue = executions.filter(
            status__in=['pending', 'in_progress'],
            due_date__lt=today
        ).count()

        completion_rate = (completed / total) * 100 if total > 0 else 0
        on_time_rate = (on_time / completed) * 100 if completed > 0 else 0

        # Calculate health score (weighted average)
        health_score = (completion_rate * 0.6) + (on_time_rate * 0.4)

        # Determine status
        if health_score >= 90:
            status = 'good'
        elif health_score >= 70:
            status = 'warning'
        else:
            status = 'critical'

        return {
            'score': round(health_score, 1),
            'status': status,
            'completion_rate': round(completion_rate, 1),
            'on_time_rate': round(on_time_rate, 1),
            'total_activities': total,
            'completed_activities': completed,
            'overdue_activities': overdue,
            'period': {
                'start': thirty_days_ago.isoformat(),
                'end': today.isoformat(),
            }
        }

    def _get_default_health(self) -> Dict[str, Any]:
        """Return default health data when no profile or data exists."""
        today = timezone.localdate()
        return {
            'score': 0,
            'status': 'unknown',
            'completion_rate': 0,
            'on_time_rate': 0,
            'total_activities': 0,
            'completed_activities': 0,
            'overdue_activities': 0,
            'period': {
                'start': (today - timedelta(days=30)).isoformat(),
                'end': today.isoformat(),
            }
        }

    def _get_activities_by_frequency(self, profile) -> Dict[str, List[ConMonActivitySummary]]:
        """Get activities grouped by frequency."""
        from continuous_monitoring.models import ConMonActivityConfig

        if not profile:
            return {}

        activities = ConMonActivityConfig.objects.filter(
            profile=profile,
            enabled=True
        ).select_related('task_template')

        result = defaultdict(list)

        for activity in activities:
            freq = activity.frequency_override
            if freq == 'inherit':
                # Determine from ref_id pattern
                freq = self._infer_frequency_from_ref(activity.ref_id)

            summary = ConMonActivitySummary(
                ref_id=activity.ref_id,
                name=activity.name,
                frequency=freq,
                status=self._get_activity_status(activity),
                last_completed=self._get_last_completed(activity),
                next_due=self._get_next_due(activity),
                completion_rate=self._calculate_activity_completion_rate(activity),
                assigned_to=[str(a) for a in activity.assigned_actors.all()],
            )
            result[freq].append(summary)

        return dict(result)

    def _infer_frequency_from_ref(self, ref_id: str) -> str:
        """Infer frequency from reference ID pattern."""
        if not ref_id:
            return 'unknown'

        ref_upper = ref_id.upper()
        if ref_upper.startswith('CONT-') or ref_upper.startswith('CONT'):
            return 'continuous'
        elif ref_upper.startswith('WEEKLY'):
            return 'weekly'
        elif ref_upper.startswith('MONTHLY'):
            return 'monthly'
        elif ref_upper.startswith('QUARTERLY'):
            return 'quarterly'
        elif ref_upper.startswith('ANNUAL'):
            return 'annual'
        elif ref_upper.startswith('MULTI-YEAR'):
            return 'multi_year'
        elif ref_upper.startswith('EVENT'):
            return 'event_driven'
        else:
            return 'monthly'  # Default

    def _get_activity_status(self, activity) -> str:
        """Get current status of an activity."""
        from continuous_monitoring.models import ConMonExecution

        today = timezone.localdate()

        # Check for overdue executions
        overdue = ConMonExecution.objects.filter(
            activity_config=activity,
            status__in=['pending', 'in_progress'],
            due_date__lt=today
        ).exists()

        if overdue:
            return 'overdue'

        # Check for upcoming due dates
        due_soon_threshold = today + timedelta(days=self.THRESHOLDS['due_soon_days'])
        due_soon = ConMonExecution.objects.filter(
            activity_config=activity,
            status='pending',
            due_date__lte=due_soon_threshold,
            due_date__gte=today
        ).exists()

        if due_soon:
            return 'due_soon'

        return 'on_track'

    def _get_last_completed(self, activity) -> Optional[date]:
        """Get date of last completion for an activity."""
        from continuous_monitoring.models import ConMonExecution

        execution = ConMonExecution.objects.filter(
            activity_config=activity,
            status__in=['completed', 'completed_late']
        ).order_by('-completed_date').first()

        return execution.completed_date if execution else None

    def _get_next_due(self, activity) -> Optional[date]:
        """Get next due date for an activity."""
        from continuous_monitoring.models import ConMonExecution

        today = timezone.localdate()
        execution = ConMonExecution.objects.filter(
            activity_config=activity,
            status='pending',
            due_date__gte=today
        ).order_by('due_date').first()

        return execution.due_date if execution else None

    def _calculate_activity_completion_rate(self, activity) -> float:
        """Calculate completion rate for an activity (last 12 months)."""
        from continuous_monitoring.models import ConMonExecution

        one_year_ago = timezone.localdate() - timedelta(days=365)

        executions = ConMonExecution.objects.filter(
            activity_config=activity,
            due_date__gte=one_year_ago
        )

        total = executions.count()
        if total == 0:
            return 100.0

        completed = executions.filter(
            status__in=['completed', 'completed_late']
        ).count()

        return round((completed / total) * 100, 1)

    def _calculate_metrics(self, profile) -> List[ConMonMetricSummary]:
        """Calculate ConMon metrics/KPIs."""
        metrics = []

        # Activity Completion Rate
        completion_data = self._calculate_completion_metric(profile)
        metrics.append(ConMonMetricSummary(
            name='Activity Completion Rate',
            value=completion_data['value'],
            target=95.0,
            unit='%',
            status=completion_data['status'],
            trend=completion_data['trend'],
            trend_value=completion_data['trend_value'],
            description='Percentage of ConMon activities completed',
            category='compliance',
        ))

        # On-Time Completion Rate
        on_time_data = self._calculate_on_time_metric(profile)
        metrics.append(ConMonMetricSummary(
            name='On-Time Completion Rate',
            value=on_time_data['value'],
            target=90.0,
            unit='%',
            status=on_time_data['status'],
            trend=on_time_data['trend'],
            trend_value=on_time_data['trend_value'],
            description='Percentage of activities completed by due date',
            category='compliance',
        ))

        # Evidence Freshness
        freshness_data = self._calculate_evidence_freshness(profile)
        metrics.append(ConMonMetricSummary(
            name='Evidence Freshness',
            value=freshness_data['value'],
            target=95.0,
            unit='%',
            status=freshness_data['status'],
            trend='stable',
            trend_value=0,
            description='Percentage of evidence collected within required windows',
            category='evidence',
        ))

        return metrics

    def _calculate_completion_metric(self, profile) -> Dict[str, Any]:
        """Calculate completion rate metric."""
        from continuous_monitoring.models import ConMonExecution

        if not profile:
            return {'value': 0, 'status': 'unknown', 'trend': 'stable', 'trend_value': 0}

        today = timezone.localdate()
        thirty_days_ago = today - timedelta(days=30)
        sixty_days_ago = today - timedelta(days=60)

        # Current period
        current = ConMonExecution.objects.filter(
            activity_config__profile=profile,
            due_date__gte=thirty_days_ago,
            due_date__lte=today
        )
        current_total = current.count()
        current_completed = current.filter(status__in=['completed', 'completed_late']).count()
        current_rate = (current_completed / current_total * 100) if current_total > 0 else 0

        # Previous period
        previous = ConMonExecution.objects.filter(
            activity_config__profile=profile,
            due_date__gte=sixty_days_ago,
            due_date__lt=thirty_days_ago
        )
        previous_total = previous.count()
        previous_completed = previous.filter(status__in=['completed', 'completed_late']).count()
        previous_rate = (previous_completed / previous_total * 100) if previous_total > 0 else 0

        trend_value = current_rate - previous_rate
        trend = 'up' if trend_value > 0 else ('down' if trend_value < 0 else 'stable')

        if current_rate >= 95:
            status = 'good'
        elif current_rate >= 80:
            status = 'warning'
        else:
            status = 'critical'

        return {
            'value': round(current_rate, 1),
            'status': status,
            'trend': trend,
            'trend_value': round(trend_value, 1),
        }

    def _calculate_on_time_metric(self, profile) -> Dict[str, Any]:
        """Calculate on-time completion metric."""
        from continuous_monitoring.models import ConMonExecution

        if not profile:
            return {'value': 0, 'status': 'unknown', 'trend': 'stable', 'trend_value': 0}

        today = timezone.localdate()
        thirty_days_ago = today - timedelta(days=30)

        completed = ConMonExecution.objects.filter(
            activity_config__profile=profile,
            due_date__gte=thirty_days_ago,
            status__in=['completed', 'completed_late']
        )

        total = completed.count()
        on_time = completed.filter(status='completed').count()
        rate = (on_time / total * 100) if total > 0 else 0

        if rate >= 90:
            status = 'good'
        elif rate >= 75:
            status = 'warning'
        else:
            status = 'critical'

        return {
            'value': round(rate, 1),
            'status': status,
            'trend': 'stable',
            'trend_value': 0,
        }

    def _calculate_evidence_freshness(self, profile) -> Dict[str, Any]:
        """Calculate evidence freshness metric."""
        # This would integrate with evidence_automation
        # For now, return placeholder data
        return {
            'value': 92.0,
            'status': 'warning',
        }

    def _get_upcoming_activities(self, profile, days: int = 14) -> List[Dict[str, Any]]:
        """Get activities due in the next N days."""
        from continuous_monitoring.models import ConMonExecution

        if not profile:
            return []

        today = timezone.localdate()
        upcoming_date = today + timedelta(days=days)

        executions = ConMonExecution.objects.filter(
            activity_config__profile=profile,
            status='pending',
            due_date__gte=today,
            due_date__lte=upcoming_date
        ).select_related('activity_config').order_by('due_date')[:10]

        return [
            {
                'id': str(e.id),
                'activity_ref_id': e.activity_config.ref_id,
                'activity_name': e.activity_config.name,
                'due_date': e.due_date.isoformat(),
                'days_until_due': (e.due_date - today).days,
            }
            for e in executions
        ]

    def _get_overdue_activities(self, profile) -> List[Dict[str, Any]]:
        """Get overdue activities."""
        from continuous_monitoring.models import ConMonExecution

        if not profile:
            return []

        today = timezone.localdate()

        executions = ConMonExecution.objects.filter(
            activity_config__profile=profile,
            status__in=['pending', 'in_progress'],
            due_date__lt=today
        ).select_related('activity_config').order_by('due_date')[:10]

        return [
            {
                'id': str(e.id),
                'activity_ref_id': e.activity_config.ref_id,
                'activity_name': e.activity_config.name,
                'due_date': e.due_date.isoformat(),
                'days_overdue': (today - e.due_date).days,
            }
            for e in executions
        ]

    def _get_recent_completions(self, profile, days: int = 30) -> List[Dict[str, Any]]:
        """Get recently completed activities."""
        from continuous_monitoring.models import ConMonExecution

        if not profile:
            return []

        cutoff = timezone.localdate() - timedelta(days=days)

        executions = ConMonExecution.objects.filter(
            activity_config__profile=profile,
            status__in=['completed', 'completed_late'],
            completed_date__gte=cutoff
        ).select_related('activity_config', 'completed_by').order_by('-completed_date')[:10]

        return [
            {
                'id': str(e.id),
                'activity_ref_id': e.activity_config.ref_id,
                'activity_name': e.activity_config.name,
                'completed_date': e.completed_date.isoformat() if e.completed_date else None,
                'completed_by': str(e.completed_by) if e.completed_by else None,
                'on_time': e.status == 'completed',
            }
            for e in executions
        ]

    def _calculate_compliance_by_frequency(self, profile) -> Dict[str, float]:
        """Calculate compliance rate by activity frequency."""
        if not profile:
            return {}

        activities = self._get_activities_by_frequency(profile)

        result = {}
        for frequency, activity_list in activities.items():
            if activity_list:
                avg_rate = sum(a.completion_rate for a in activity_list) / len(activity_list)
                result[frequency] = round(avg_rate, 1)

        return result
