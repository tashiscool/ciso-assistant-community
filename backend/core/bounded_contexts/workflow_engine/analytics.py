"""
Workflow Analytics Service

Provides analytics and insights for workflow executions including:
- Execution metrics (counts, success rates, durations)
- Performance analysis (bottlenecks, slow steps)
- Trend analysis
- Optimization recommendations
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from uuid import UUID
from django.db.models import Count, Avg, Max, Min, Sum, F, Q
from django.db.models.functions import TruncDay, TruncHour, TruncWeek
from django.utils import timezone
import logging
from collections import defaultdict

from .models import (
    Workflow,
    WorkflowExecution,
    WorkflowStep,
    WorkflowSchedule,
)

logger = logging.getLogger(__name__)


@dataclass
class WorkflowMetrics:
    """Aggregated metrics for a workflow."""
    workflow_id: UUID
    workflow_name: str
    total_executions: int
    successful_executions: int
    failed_executions: int
    cancelled_executions: int
    success_rate: float
    avg_duration_seconds: float
    min_duration_seconds: float
    max_duration_seconds: float
    p95_duration_seconds: float
    last_execution_at: Optional[datetime] = None
    last_execution_status: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'workflow_id': str(self.workflow_id),
            'workflow_name': self.workflow_name,
            'total_executions': self.total_executions,
            'successful_executions': self.successful_executions,
            'failed_executions': self.failed_executions,
            'cancelled_executions': self.cancelled_executions,
            'success_rate': self.success_rate,
            'avg_duration_seconds': self.avg_duration_seconds,
            'min_duration_seconds': self.min_duration_seconds,
            'max_duration_seconds': self.max_duration_seconds,
            'p95_duration_seconds': self.p95_duration_seconds,
            'last_execution_at': self.last_execution_at.isoformat() if self.last_execution_at else None,
            'last_execution_status': self.last_execution_status,
        }


@dataclass
class StepPerformance:
    """Performance metrics for a workflow step."""
    node_id: str
    node_name: str
    node_type: str
    total_executions: int
    successful_executions: int
    failed_executions: int
    avg_duration_seconds: float
    max_duration_seconds: float
    failure_rate: float
    is_bottleneck: bool = False
    optimization_suggestions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'node_id': self.node_id,
            'node_name': self.node_name,
            'node_type': self.node_type,
            'total_executions': self.total_executions,
            'successful_executions': self.successful_executions,
            'failed_executions': self.failed_executions,
            'avg_duration_seconds': self.avg_duration_seconds,
            'max_duration_seconds': self.max_duration_seconds,
            'failure_rate': self.failure_rate,
            'is_bottleneck': self.is_bottleneck,
            'optimization_suggestions': self.optimization_suggestions,
        }


@dataclass
class ExecutionTrend:
    """Execution trend data point."""
    period: datetime
    total: int
    successful: int
    failed: int
    avg_duration: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            'period': self.period.isoformat(),
            'total': self.total,
            'successful': self.successful,
            'failed': self.failed,
            'avg_duration': self.avg_duration,
        }


@dataclass
class OptimizationRecommendation:
    """Optimization recommendation for a workflow."""
    workflow_id: UUID
    priority: str  # 'high', 'medium', 'low'
    category: str  # 'performance', 'reliability', 'cost', 'maintainability'
    title: str
    description: str
    impact: str
    steps: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'workflow_id': str(self.workflow_id),
            'priority': self.priority,
            'category': self.category,
            'title': self.title,
            'description': self.description,
            'impact': self.impact,
            'steps': self.steps,
        }


class WorkflowAnalyticsService:
    """
    Service for workflow analytics and insights.
    """

    def __init__(self):
        """Initialize the analytics service."""
        pass

    def get_workflow_metrics(
        self,
        workflow_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[WorkflowMetrics]:
        """
        Get aggregated metrics for workflows.

        Args:
            workflow_id: Optional specific workflow ID
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of WorkflowMetrics
        """
        # Build query filters
        filters = Q()
        if workflow_id:
            filters &= Q(workflow_id=workflow_id)
        if start_date:
            filters &= Q(created_at__gte=start_date)
        if end_date:
            filters &= Q(created_at__lte=end_date)

        # Aggregate by workflow
        executions = WorkflowExecution.objects.filter(filters)

        if workflow_id:
            workflows = Workflow.objects.filter(id=workflow_id)
        else:
            workflows = Workflow.objects.filter(
                id__in=executions.values_list('workflow_id', flat=True).distinct()
            )

        metrics = []
        for workflow in workflows:
            workflow_executions = executions.filter(workflow=workflow)

            # Get completed executions for duration stats
            completed = workflow_executions.filter(
                status__in=[WorkflowExecution.Status.COMPLETED, WorkflowExecution.Status.FAILED]
            ).exclude(started_at__isnull=True).exclude(completed_at__isnull=True)

            durations = [
                (e.completed_at - e.started_at).total_seconds()
                for e in completed
            ]

            total = workflow_executions.count()
            successful = workflow_executions.filter(status=WorkflowExecution.Status.COMPLETED).count()
            failed = workflow_executions.filter(status=WorkflowExecution.Status.FAILED).count()
            cancelled = workflow_executions.filter(status=WorkflowExecution.Status.CANCELLED).count()

            last_exec = workflow_executions.order_by('-created_at').first()

            metrics.append(WorkflowMetrics(
                workflow_id=workflow.id,
                workflow_name=workflow.name,
                total_executions=total,
                successful_executions=successful,
                failed_executions=failed,
                cancelled_executions=cancelled,
                success_rate=(successful / total * 100) if total > 0 else 0,
                avg_duration_seconds=sum(durations) / len(durations) if durations else 0,
                min_duration_seconds=min(durations) if durations else 0,
                max_duration_seconds=max(durations) if durations else 0,
                p95_duration_seconds=self._percentile(durations, 95) if durations else 0,
                last_execution_at=last_exec.created_at if last_exec else None,
                last_execution_status=last_exec.status if last_exec else None,
            ))

        return metrics

    def get_step_performance(
        self,
        workflow_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[StepPerformance]:
        """
        Get performance metrics for each step in a workflow.

        Args:
            workflow_id: Workflow ID
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of StepPerformance
        """
        # Build filters
        filters = Q(execution__workflow_id=workflow_id)
        if start_date:
            filters &= Q(started_at__gte=start_date)
        if end_date:
            filters &= Q(completed_at__lte=end_date)

        # Aggregate by node
        step_data = WorkflowStep.objects.filter(filters).values(
            'node_id', 'node_name', 'node_type'
        ).annotate(
            total=Count('id'),
            successful=Count('id', filter=Q(status=WorkflowStep.Status.COMPLETED)),
            failed=Count('id', filter=Q(status=WorkflowStep.Status.FAILED)),
        )

        performances = []
        avg_durations = []

        for data in step_data:
            steps = WorkflowStep.objects.filter(
                filters,
                node_id=data['node_id'],
                status=WorkflowStep.Status.COMPLETED,
            ).exclude(started_at__isnull=True).exclude(completed_at__isnull=True)

            durations = [
                (s.completed_at - s.started_at).total_seconds()
                for s in steps
            ]

            avg_duration = sum(durations) / len(durations) if durations else 0
            max_duration = max(durations) if durations else 0
            failure_rate = (data['failed'] / data['total'] * 100) if data['total'] > 0 else 0

            avg_durations.append((data['node_id'], avg_duration))

            perf = StepPerformance(
                node_id=data['node_id'],
                node_name=data['node_name'],
                node_type=data['node_type'],
                total_executions=data['total'],
                successful_executions=data['successful'],
                failed_executions=data['failed'],
                avg_duration_seconds=avg_duration,
                max_duration_seconds=max_duration,
                failure_rate=failure_rate,
            )
            performances.append(perf)

        # Identify bottlenecks (top 20% by duration)
        if avg_durations:
            sorted_durations = sorted(avg_durations, key=lambda x: x[1], reverse=True)
            threshold_idx = max(1, len(sorted_durations) // 5)  # Top 20%
            bottleneck_nodes = {d[0] for d in sorted_durations[:threshold_idx]}

            for perf in performances:
                if perf.node_id in bottleneck_nodes:
                    perf.is_bottleneck = True
                    perf.optimization_suggestions = self._get_step_suggestions(perf)

        return performances

    def get_execution_trends(
        self,
        workflow_id: Optional[UUID] = None,
        period: str = 'day',  # 'hour', 'day', 'week'
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[ExecutionTrend]:
        """
        Get execution trends over time.

        Args:
            workflow_id: Optional workflow ID filter
            period: Aggregation period ('hour', 'day', 'week')
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of ExecutionTrend
        """
        if start_date is None:
            start_date = timezone.now() - timedelta(days=30)
        if end_date is None:
            end_date = timezone.now()

        filters = Q(created_at__gte=start_date, created_at__lte=end_date)
        if workflow_id:
            filters &= Q(workflow_id=workflow_id)

        # Select truncation function
        if period == 'hour':
            trunc_func = TruncHour('created_at')
        elif period == 'week':
            trunc_func = TruncWeek('created_at')
        else:
            trunc_func = TruncDay('created_at')

        # Aggregate data
        data = WorkflowExecution.objects.filter(filters).annotate(
            period=trunc_func
        ).values('period').annotate(
            total=Count('id'),
            successful=Count('id', filter=Q(status=WorkflowExecution.Status.COMPLETED)),
            failed=Count('id', filter=Q(status=WorkflowExecution.Status.FAILED)),
        ).order_by('period')

        trends = []
        for row in data:
            # Calculate average duration for this period
            period_executions = WorkflowExecution.objects.filter(
                filters,
                created_at__date=row['period'].date() if period == 'day' else row['period'],
                status=WorkflowExecution.Status.COMPLETED,
            ).exclude(started_at__isnull=True).exclude(completed_at__isnull=True)

            durations = [
                (e.completed_at - e.started_at).total_seconds()
                for e in period_executions
            ]

            trends.append(ExecutionTrend(
                period=row['period'],
                total=row['total'],
                successful=row['successful'],
                failed=row['failed'],
                avg_duration=sum(durations) / len(durations) if durations else 0,
            ))

        return trends

    def get_optimization_recommendations(
        self,
        workflow_id: Optional[UUID] = None,
    ) -> List[OptimizationRecommendation]:
        """
        Get optimization recommendations for workflows.

        Args:
            workflow_id: Optional specific workflow ID

        Returns:
            List of OptimizationRecommendation
        """
        recommendations = []

        if workflow_id:
            workflows = Workflow.objects.filter(id=workflow_id)
        else:
            workflows = Workflow.objects.filter(status=Workflow.Status.ACTIVE)

        for workflow in workflows:
            # Check metrics
            metrics = self.get_workflow_metrics(workflow_id=workflow.id)
            if not metrics:
                continue

            m = metrics[0]

            # High failure rate
            if m.success_rate < 90:
                recommendations.append(OptimizationRecommendation(
                    workflow_id=workflow.id,
                    priority='high',
                    category='reliability',
                    title=f'High Failure Rate ({m.success_rate:.1f}%)',
                    description=f'Workflow "{workflow.name}" has a success rate below 90%. '
                                f'Review failed executions and address common failure causes.',
                    impact='Improve workflow reliability and reduce manual intervention',
                    steps=[
                        'Review recent failed executions for common error patterns',
                        'Add error handling and retry logic for transient failures',
                        'Validate input data before processing',
                        'Consider adding monitoring and alerting',
                    ],
                ))

            # Slow execution
            if m.avg_duration_seconds > 300:  # > 5 minutes
                recommendations.append(OptimizationRecommendation(
                    workflow_id=workflow.id,
                    priority='medium',
                    category='performance',
                    title=f'Long Average Duration ({m.avg_duration_seconds:.0f}s)',
                    description=f'Workflow "{workflow.name}" takes longer than expected. '
                                f'Consider optimizing slow steps or parallelizing operations.',
                    impact='Faster workflow completion and better resource utilization',
                    steps=[
                        'Identify bottleneck steps using step performance analysis',
                        'Parallelize independent operations where possible',
                        'Optimize database queries and external API calls',
                        'Consider caching frequently accessed data',
                    ],
                ))

            # High variance in duration
            if m.max_duration_seconds > m.avg_duration_seconds * 3:
                recommendations.append(OptimizationRecommendation(
                    workflow_id=workflow.id,
                    priority='low',
                    category='performance',
                    title='High Duration Variance',
                    description=f'Workflow "{workflow.name}" shows inconsistent execution times. '
                                f'Investigate what causes some runs to be significantly slower.',
                    impact='More predictable workflow performance',
                    steps=[
                        'Analyze slow executions for patterns',
                        'Check for external dependencies with variable latency',
                        'Review data volume variations between runs',
                        'Consider adding timeouts for long-running operations',
                    ],
                ))

            # Step-level analysis
            step_perf = self.get_step_performance(workflow.id)
            bottleneck_steps = [s for s in step_perf if s.is_bottleneck]

            if bottleneck_steps:
                bottleneck_names = [s.node_name for s in bottleneck_steps[:3]]
                recommendations.append(OptimizationRecommendation(
                    workflow_id=workflow.id,
                    priority='medium',
                    category='performance',
                    title='Bottleneck Steps Identified',
                    description=f'Steps {", ".join(bottleneck_names)} are taking longer than average. '
                                f'Optimizing these steps will improve overall workflow performance.',
                    impact='Significant reduction in overall execution time',
                    steps=[
                        f'Review and optimize: {", ".join(bottleneck_names)}',
                        'Consider breaking down complex steps',
                        'Add parallel execution where possible',
                        'Profile and optimize database queries',
                    ],
                ))

            # Inactive workflow check
            if workflow.last_executed_at and \
               workflow.last_executed_at < timezone.now() - timedelta(days=30):
                recommendations.append(OptimizationRecommendation(
                    workflow_id=workflow.id,
                    priority='low',
                    category='maintainability',
                    title='Inactive Workflow',
                    description=f'Workflow "{workflow.name}" has not been executed in over 30 days. '
                                f'Consider archiving if no longer needed.',
                    impact='Cleaner workflow inventory and reduced maintenance burden',
                    steps=[
                        'Verify if workflow is still needed',
                        'Update documentation if keeping',
                        'Archive or delete if no longer needed',
                    ],
                ))

        # Sort by priority
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        recommendations.sort(key=lambda r: priority_order.get(r.priority, 99))

        return recommendations

    def get_global_statistics(self) -> Dict[str, Any]:
        """
        Get global workflow statistics.

        Returns:
            Dictionary with global stats
        """
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)
        last_30d = now - timedelta(days=30)

        total_workflows = Workflow.objects.count()
        active_workflows = Workflow.objects.filter(status=Workflow.Status.ACTIVE).count()

        executions_24h = WorkflowExecution.objects.filter(created_at__gte=last_24h).count()
        executions_7d = WorkflowExecution.objects.filter(created_at__gte=last_7d).count()
        executions_30d = WorkflowExecution.objects.filter(created_at__gte=last_30d).count()

        success_24h = WorkflowExecution.objects.filter(
            created_at__gte=last_24h,
            status=WorkflowExecution.Status.COMPLETED
        ).count()
        failed_24h = WorkflowExecution.objects.filter(
            created_at__gte=last_24h,
            status=WorkflowExecution.Status.FAILED
        ).count()

        # Most active workflows
        most_active = Workflow.objects.filter(
            executions__created_at__gte=last_7d
        ).annotate(
            exec_count=Count('executions')
        ).order_by('-exec_count')[:5]

        # Workflows with highest failure rate
        failing_workflows = []
        for workflow in Workflow.objects.filter(
            executions__created_at__gte=last_7d
        ).distinct():
            recent = WorkflowExecution.objects.filter(
                workflow=workflow,
                created_at__gte=last_7d
            )
            total = recent.count()
            if total >= 5:  # Need minimum executions
                failed = recent.filter(status=WorkflowExecution.Status.FAILED).count()
                failure_rate = (failed / total) * 100
                if failure_rate > 10:
                    failing_workflows.append({
                        'workflow_id': str(workflow.id),
                        'workflow_name': workflow.name,
                        'failure_rate': failure_rate,
                        'total_executions': total,
                    })
        failing_workflows.sort(key=lambda x: x['failure_rate'], reverse=True)

        return {
            'overview': {
                'total_workflows': total_workflows,
                'active_workflows': active_workflows,
                'scheduled_workflows': WorkflowSchedule.objects.filter(is_active=True).count(),
            },
            'executions': {
                'last_24h': executions_24h,
                'last_7d': executions_7d,
                'last_30d': executions_30d,
                'success_rate_24h': (success_24h / executions_24h * 100) if executions_24h > 0 else 0,
            },
            'most_active_workflows': [
                {
                    'workflow_id': str(w.id),
                    'workflow_name': w.name,
                    'execution_count': w.exec_count,
                }
                for w in most_active
            ],
            'failing_workflows': failing_workflows[:5],
            'timestamp': now.isoformat(),
        }

    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile of a list."""
        if not data:
            return 0
        sorted_data = sorted(data)
        idx = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(idx, len(sorted_data) - 1)]

    def _get_step_suggestions(self, perf: StepPerformance) -> List[str]:
        """Generate optimization suggestions for a step."""
        suggestions = []

        if perf.failure_rate > 10:
            suggestions.append('High failure rate - review error handling and input validation')

        if perf.avg_duration_seconds > 60:
            suggestions.append('Consider async processing or breaking into smaller steps')

        if perf.node_type.startswith('integration_'):
            suggestions.append('Add caching for external API responses')
            suggestions.append('Implement retry logic with exponential backoff')

        if perf.node_type == 'data_query':
            suggestions.append('Optimize database queries and add indexes')

        if not suggestions:
            suggestions.append('Review step logic for optimization opportunities')

        return suggestions


# Singleton instance
_analytics_service: Optional[WorkflowAnalyticsService] = None


def get_workflow_analytics() -> WorkflowAnalyticsService:
    """Get or create the workflow analytics service instance."""
    global _analytics_service
    if _analytics_service is None:
        _analytics_service = WorkflowAnalyticsService()
    return _analytics_service
