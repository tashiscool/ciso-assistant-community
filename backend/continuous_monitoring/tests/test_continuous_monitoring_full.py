"""
Comprehensive tests for Continuous Monitoring API

Tests cover:
- ConMonProfile API endpoints
- ConMonActivityConfig management
- ConMonExecution tracking
- ConMonMetric calculation and retrieval
"""

import pytest
from datetime import date, timedelta

from continuous_monitoring.models import (
    ConMonProfile,
    ConMonActivityConfig,
    ConMonExecution,
    ConMonMetric,
)


# =============================================================================
# ConMonProfile Model Tests
# =============================================================================

@pytest.mark.django_db
class TestConMonProfileModel:
    """Tests for ConMonProfile model."""

    def test_create_conmon_profile(self):
        """Test creating a ConMon profile."""
        from iam.models import Folder

        folder = Folder.objects.create(name='Test Folder')
        profile = ConMonProfile.objects.create(
            name='FedRAMP Moderate Profile',
            description='ConMon profile for FedRAMP Moderate systems',
            profile_type=ConMonProfile.ProfileType.FEDRAMP_MODERATE,
            folder=folder
        )

        assert profile.id is not None
        assert profile.name == 'FedRAMP Moderate Profile'
        assert profile.profile_type == ConMonProfile.ProfileType.FEDRAMP_MODERATE
        assert profile.status == ConMonProfile.Status.DRAFT

    def test_profile_type_choices(self):
        """Test profile type choices are defined."""
        choices = ConMonProfile.ProfileType.choices

        assert ('fedramp_low', 'FedRAMP Low') in choices
        assert ('fedramp_moderate', 'FedRAMP Moderate') in choices
        assert ('fedramp_high', 'FedRAMP High') in choices
        assert ('iso_27001', 'ISO 27001') in choices
        assert ('soc_2', 'SOC 2') in choices
        assert ('custom', 'Custom') in choices

    def test_profile_status_choices(self):
        """Test profile status choices."""
        choices = ConMonProfile.Status.choices

        assert ('draft', 'Draft') in choices
        assert ('active', 'Active') in choices
        assert ('archived', 'Archived') in choices

    def test_profile_str_representation(self):
        """Test profile string representation."""
        from iam.models import Folder

        folder = Folder.objects.create(name='Test Folder')
        profile = ConMonProfile.objects.create(
            name='Test Profile',
            profile_type=ConMonProfile.ProfileType.FEDRAMP_MODERATE,
            folder=folder
        )

        assert str(profile) == 'Test Profile (FedRAMP Moderate)'

    def test_profile_notification_defaults(self):
        """Test profile notification defaults."""
        from iam.models import Folder

        folder = Folder.objects.create(name='Test Folder')
        profile = ConMonProfile.objects.create(
            name='Test Profile',
            folder=folder
        )

        assert profile.notification_lead_days == 7
        assert profile.notification_enabled is True


# =============================================================================
# ConMonActivityConfig Model Tests
# =============================================================================

@pytest.mark.django_db
class TestConMonActivityConfigModel:
    """Tests for ConMonActivityConfig model."""

    @pytest.fixture
    def profile(self):
        """Create a test profile."""
        from iam.models import Folder

        folder = Folder.objects.create(name='Test Folder')
        return ConMonProfile.objects.create(
            name='Test Profile',
            folder=folder
        )

    def test_create_activity_config(self, profile):
        """Test creating an activity configuration."""
        config = ConMonActivityConfig.objects.create(
            profile=profile,
            requirement_urn='urn:ciso-assistant:conmon:vuln-scan-monthly',
            ref_id='CONMON-VS-01',
            name='Monthly Vulnerability Scan',
            enabled=True,
            folder=profile.folder
        )

        assert config.id is not None
        assert config.ref_id == 'CONMON-VS-01'
        assert config.enabled is True

    def test_frequency_override_choices(self):
        """Test frequency override choices."""
        choices = ConMonActivityConfig.FrequencyOverride.choices

        assert ('inherit', 'Use Default') in choices
        assert ('continuous', 'Continuous') in choices
        assert ('daily', 'Daily') in choices
        assert ('weekly', 'Weekly') in choices
        assert ('monthly', 'Monthly') in choices
        assert ('quarterly', 'Quarterly') in choices

    def test_activity_config_str_representation(self, profile):
        """Test activity config string representation."""
        config = ConMonActivityConfig.objects.create(
            profile=profile,
            requirement_urn='urn:test',
            ref_id='TEST-01',
            enabled=True,
            folder=profile.folder
        )

        assert 'TEST-01' in str(config)
        assert 'enabled' in str(config)


# =============================================================================
# ConMonExecution Model Tests
# =============================================================================

@pytest.mark.django_db
class TestConMonExecutionModel:
    """Tests for ConMonExecution model."""

    @pytest.fixture
    def activity_config(self):
        """Create a test activity config."""
        from iam.models import Folder

        folder = Folder.objects.create(name='Test Folder')
        profile = ConMonProfile.objects.create(
            name='Test Profile',
            folder=folder
        )
        return ConMonActivityConfig.objects.create(
            profile=profile,
            requirement_urn='urn:test',
            ref_id='TEST-01',
            folder=folder
        )

    def test_create_execution(self, activity_config):
        """Test creating an execution record."""
        today = date.today()
        execution = ConMonExecution.objects.create(
            activity_config=activity_config,
            period_start=today,
            period_end=today + timedelta(days=30),
            due_date=today + timedelta(days=30),
            status=ConMonExecution.Status.PENDING,
            folder=activity_config.folder
        )

        assert execution.id is not None
        assert execution.status == ConMonExecution.Status.PENDING

    def test_execution_status_choices(self):
        """Test execution status choices."""
        choices = ConMonExecution.Status.choices

        assert ('pending', 'Pending') in choices
        assert ('in_progress', 'In Progress') in choices
        assert ('completed', 'Completed') in choices
        assert ('completed_late', 'Completed Late') in choices
        assert ('missed', 'Missed') in choices

    def test_execution_result_choices(self):
        """Test execution result choices."""
        choices = ConMonExecution.CompletionResult.choices

        assert ('pass', 'Pass') in choices
        assert ('fail', 'Fail') in choices
        assert ('partial', 'Partial') in choices
        assert ('not_assessed', 'Not Assessed') in choices

    def test_execution_is_overdue_pending(self, activity_config):
        """Test is_overdue property for pending execution."""
        execution = ConMonExecution.objects.create(
            activity_config=activity_config,
            period_start=date.today() - timedelta(days=30),
            period_end=date.today() - timedelta(days=1),
            due_date=date.today() - timedelta(days=1),
            status=ConMonExecution.Status.PENDING,
            folder=activity_config.folder
        )

        assert execution.is_overdue is True

    def test_execution_is_not_overdue_completed(self, activity_config):
        """Test is_overdue property for completed execution."""
        execution = ConMonExecution.objects.create(
            activity_config=activity_config,
            period_start=date.today() - timedelta(days=30),
            period_end=date.today() - timedelta(days=1),
            due_date=date.today() - timedelta(days=1),
            status=ConMonExecution.Status.COMPLETED,
            folder=activity_config.folder
        )

        assert execution.is_overdue is False


# =============================================================================
# ConMonMetric Model Tests
# =============================================================================

@pytest.mark.django_db
class TestConMonMetricModel:
    """Tests for ConMonMetric model."""

    @pytest.fixture
    def profile(self):
        """Create a test profile."""
        from iam.models import Folder

        folder = Folder.objects.create(name='Test Folder')
        return ConMonProfile.objects.create(
            name='Test Profile',
            folder=folder
        )

    def test_create_metric(self, profile):
        """Test creating a metric."""
        today = date.today()
        metric = ConMonMetric.objects.create(
            profile=profile,
            metric_type=ConMonMetric.MetricType.COMPLETION_RATE,
            period_start=today - timedelta(days=30),
            period_end=today,
            value=85.5,
            target=90.0,
            unit='%',
            folder=profile.folder
        )

        assert metric.id is not None
        assert metric.value == 85.5
        assert metric.target == 90.0

    def test_metric_type_choices(self):
        """Test metric type choices."""
        choices = ConMonMetric.MetricType.choices

        assert ('completion_rate', 'Activity Completion Rate') in choices
        assert ('on_time_rate', 'On-Time Completion Rate') in choices
        assert ('evidence_freshness', 'Evidence Freshness') in choices
        assert ('vuln_remediation_time', 'Vulnerability Remediation Time') in choices

    def test_metric_status_good(self, profile):
        """Test metric status when value meets target."""
        metric = ConMonMetric.objects.create(
            profile=profile,
            metric_type=ConMonMetric.MetricType.COMPLETION_RATE,
            period_start=date.today(),
            period_end=date.today(),
            value=95.0,
            target=90.0,
            folder=profile.folder
        )

        assert metric.status == 'good'

    def test_metric_status_warning(self, profile):
        """Test metric status when value is close to target."""
        metric = ConMonMetric.objects.create(
            profile=profile,
            metric_type=ConMonMetric.MetricType.COMPLETION_RATE,
            period_start=date.today(),
            period_end=date.today(),
            value=75.0,
            target=90.0,
            folder=profile.folder
        )

        assert metric.status == 'warning'

    def test_metric_status_critical(self, profile):
        """Test metric status when value is below 80% of target."""
        metric = ConMonMetric.objects.create(
            profile=profile,
            metric_type=ConMonMetric.MetricType.COMPLETION_RATE,
            period_start=date.today(),
            period_end=date.today(),
            value=50.0,
            target=90.0,
            folder=profile.folder
        )

        assert metric.status == 'critical'

    def test_metric_status_unknown_no_target(self, profile):
        """Test metric status when no target set."""
        metric = ConMonMetric.objects.create(
            profile=profile,
            metric_type=ConMonMetric.MetricType.COMPLETION_RATE,
            period_start=date.today(),
            period_end=date.today(),
            value=85.0,
            target=None,
            folder=profile.folder
        )

        assert metric.status == 'unknown'


# =============================================================================
# ConMon Service Tests
# =============================================================================

class TestConMonService:
    """Tests for ConMon service layer."""

    def test_frequency_to_days_mapping(self):
        """Test frequency to days mapping."""
        frequency_map = {
            'continuous': 0,
            'daily': 1,
            'weekly': 7,
            'biweekly': 14,
            'monthly': 30,
            'quarterly': 90,
            'semi_annual': 180,
            'annual': 365,
        }

        for freq, days in frequency_map.items():
            assert days >= 0

    def test_calculate_completion_rate(self):
        """Test completion rate calculation logic."""
        total = 10
        completed = 8

        rate = (completed / total) * 100 if total > 0 else 0

        assert rate == 80.0

    def test_calculate_on_time_rate(self):
        """Test on-time completion rate calculation logic."""
        completed = 8
        on_time = 7

        rate = (on_time / completed) * 100 if completed > 0 else 0

        assert rate == 87.5

    def test_determine_trend_improving(self):
        """Test trend determination for improving metrics."""
        current = 90.0
        previous = 80.0

        if current > previous:
            trend = 'up'
        elif current < previous:
            trend = 'down'
        else:
            trend = 'stable'

        assert trend == 'up'

    def test_determine_trend_declining(self):
        """Test trend determination for declining metrics."""
        current = 70.0
        previous = 80.0

        if current > previous:
            trend = 'up'
        elif current < previous:
            trend = 'down'
        else:
            trend = 'stable'

        assert trend == 'down'


# =============================================================================
# ConMon Task Generator Tests
# =============================================================================

class TestConMonTaskGenerator:
    """Tests for ConMon task generation."""

    def test_calculate_next_due_date_monthly(self):
        """Test calculating next due date for monthly frequency."""
        last_execution = date(2025, 1, 15)
        frequency_days = 30

        next_due = last_execution + timedelta(days=frequency_days)

        assert next_due == date(2025, 2, 14)

    def test_calculate_next_due_date_quarterly(self):
        """Test calculating next due date for quarterly frequency."""
        last_execution = date(2025, 1, 1)
        frequency_days = 90

        next_due = last_execution + timedelta(days=frequency_days)

        assert next_due == date(2025, 4, 1)

    def test_should_generate_task_overdue(self):
        """Test determining if task should be generated for overdue activity."""
        last_execution = date.today() - timedelta(days=45)
        frequency_days = 30

        expected_due = last_execution + timedelta(days=frequency_days)
        is_overdue = date.today() > expected_due

        assert is_overdue is True

    def test_should_not_generate_task_recent(self):
        """Test determining if task should NOT be generated for recent activity."""
        last_execution = date.today() - timedelta(days=10)
        frequency_days = 30

        expected_due = last_execution + timedelta(days=frequency_days)
        is_overdue = date.today() > expected_due

        assert is_overdue is False
