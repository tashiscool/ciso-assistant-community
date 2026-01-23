"""
Tests for Continuous Monitoring models.
"""

import pytest
from datetime import date, timedelta
from django.utils import timezone

from iam.models import Folder
from continuous_monitoring.models import (
    ConMonProfile,
    ConMonActivityConfig,
    ConMonExecution,
    ConMonMetric,
)


@pytest.fixture
def folder():
    """Create a test folder."""
    root_folder = Folder.objects.get(content_type=Folder.ContentType.ROOT)
    return Folder.objects.create(
        parent_folder=root_folder,
        name="Test ConMon Folder",
        description="Test folder for ConMon tests",
    )


@pytest.fixture
def conmon_profile(folder):
    """Create a test ConMon profile."""
    return ConMonProfile.objects.create(
        name="Test ConMon Profile",
        description="Test profile for unit tests",
        folder=folder,
        profile_type="custom",
        status="draft",
        implementation_groups=["BASIC", "STANDARD"],
        notification_lead_days=7,
        notification_enabled=True,
    )


@pytest.fixture
def conmon_activity(folder, conmon_profile):
    """Create a test ConMon activity configuration."""
    return ConMonActivityConfig.objects.create(
        folder=folder,
        profile=conmon_profile,
        requirement_urn="urn:test:req:conmon-test-01",
        ref_id="TEST-01",
        name="Test Activity",
        enabled=True,
        frequency_override="monthly",
        notes="Test notes",
    )


@pytest.fixture
def conmon_execution(folder, conmon_activity):
    """Create a test ConMon execution."""
    today = timezone.localdate()
    return ConMonExecution.objects.create(
        folder=folder,
        activity_config=conmon_activity,
        period_start=today - timedelta(days=30),
        period_end=today,
        due_date=today + timedelta(days=7),
        status="pending",
        result="not_assessed",
    )


@pytest.mark.django_db
class TestConMonProfile:
    """Tests for ConMonProfile model."""

    def test_create_profile(self, folder):
        """Test creating a ConMon profile."""
        profile = ConMonProfile.objects.create(
            name="Test Profile",
            folder=folder,
            profile_type="fedramp_moderate",
            status="draft",
        )

        assert profile.id is not None
        assert profile.name == "Test Profile"
        assert profile.profile_type == "fedramp_moderate"
        assert profile.status == "draft"
        assert profile.folder == folder

    def test_profile_type_choices(self, conmon_profile):
        """Test that profile type choices work correctly."""
        valid_types = [
            'fedramp_low', 'fedramp_moderate', 'fedramp_high',
            'iso_27001', 'soc_2', 'nist_csf',
            'cmmc_l1', 'cmmc_l2', 'cmmc_l3', 'custom'
        ]

        for profile_type in valid_types:
            conmon_profile.profile_type = profile_type
            conmon_profile.save()
            conmon_profile.refresh_from_db()
            assert conmon_profile.profile_type == profile_type

    def test_profile_status_choices(self, conmon_profile):
        """Test that status choices work correctly."""
        valid_statuses = ['draft', 'active', 'archived']

        for status in valid_statuses:
            conmon_profile.status = status
            conmon_profile.save()
            conmon_profile.refresh_from_db()
            assert conmon_profile.status == status

    def test_profile_implementation_groups(self, conmon_profile):
        """Test implementation groups JSON field."""
        conmon_profile.implementation_groups = ["L", "M", "H"]
        conmon_profile.save()
        conmon_profile.refresh_from_db()

        assert conmon_profile.implementation_groups == ["L", "M", "H"]

    def test_profile_str_representation(self, conmon_profile):
        """Test string representation of profile."""
        # Format: "{name} ({profile_type_display})"
        assert str(conmon_profile) == "Test ConMon Profile (Custom)"


@pytest.mark.django_db
class TestConMonActivityConfig:
    """Tests for ConMonActivityConfig model."""

    def test_create_activity(self, folder, conmon_profile):
        """Test creating a ConMon activity configuration."""
        activity = ConMonActivityConfig.objects.create(
            folder=folder,
            profile=conmon_profile,
            requirement_urn="urn:test:req:activity-01",
            ref_id="ACT-01",
            name="Test Activity Config",
            enabled=True,
            frequency_override="quarterly",
        )

        assert activity.id is not None
        assert activity.profile == conmon_profile
        assert activity.ref_id == "ACT-01"
        assert activity.enabled is True
        assert activity.frequency_override == "quarterly"

    def test_activity_frequency_choices(self, conmon_activity):
        """Test that frequency override choices work correctly."""
        valid_frequencies = [
            'inherit', 'continuous', 'daily', 'weekly', 'biweekly',
            'monthly', 'quarterly', 'semi_annual', 'annual',
            'biennial', 'triennial', 'event_driven'
        ]

        for freq in valid_frequencies:
            conmon_activity.frequency_override = freq
            conmon_activity.save()
            conmon_activity.refresh_from_db()
            assert conmon_activity.frequency_override == freq

    def test_activity_custom_schedule(self, conmon_activity):
        """Test custom schedule JSON field."""
        custom_schedule = {
            "frequency": "WEEKLY",
            "interval": 2,
            "day_of_week": "monday"
        }
        conmon_activity.custom_schedule = custom_schedule
        conmon_activity.save()
        conmon_activity.refresh_from_db()

        assert conmon_activity.custom_schedule == custom_schedule

    def test_activity_str_representation(self, conmon_activity):
        """Test string representation of activity."""
        # Format: "{ref_id} ({enabled/disabled})"
        expected = "TEST-01 (enabled)"
        assert str(conmon_activity) == expected


@pytest.mark.django_db
class TestConMonExecution:
    """Tests for ConMonExecution model."""

    def test_create_execution(self, folder, conmon_activity):
        """Test creating a ConMon execution."""
        today = timezone.localdate()
        execution = ConMonExecution.objects.create(
            folder=folder,
            activity_config=conmon_activity,
            period_start=today - timedelta(days=30),
            period_end=today,
            due_date=today + timedelta(days=5),
            status="pending",
        )

        assert execution.id is not None
        assert execution.activity_config == conmon_activity
        assert execution.status == "pending"

    def test_execution_status_choices(self, conmon_execution):
        """Test that status choices work correctly."""
        valid_statuses = [
            'pending', 'in_progress', 'completed',
            'completed_late', 'missed', 'not_applicable'
        ]

        for status in valid_statuses:
            conmon_execution.status = status
            conmon_execution.save()
            conmon_execution.refresh_from_db()
            assert conmon_execution.status == status

    def test_execution_result_choices(self, conmon_execution):
        """Test that result choices work correctly."""
        valid_results = ['pass', 'fail', 'partial', 'not_assessed']

        for result in valid_results:
            conmon_execution.result = result
            conmon_execution.save()
            conmon_execution.refresh_from_db()
            assert conmon_execution.result == result

    def test_execution_is_overdue(self, conmon_execution):
        """Test is_overdue property."""
        today = timezone.localdate()

        # Not overdue - due date in future
        conmon_execution.due_date = today + timedelta(days=1)
        conmon_execution.status = "pending"
        conmon_execution.save()
        assert conmon_execution.is_overdue is False

        # Overdue - due date in past, still pending
        conmon_execution.due_date = today - timedelta(days=1)
        conmon_execution.save()
        assert conmon_execution.is_overdue is True

        # Not overdue - completed
        conmon_execution.status = "completed"
        conmon_execution.save()
        assert conmon_execution.is_overdue is False


@pytest.mark.django_db
class TestConMonMetric:
    """Tests for ConMonMetric model."""

    def test_create_metric(self, folder, conmon_profile):
        """Test creating a ConMon metric."""
        today = timezone.localdate()
        metric = ConMonMetric.objects.create(
            folder=folder,
            profile=conmon_profile,
            metric_type="completion_rate",
            period_start=today - timedelta(days=30),
            period_end=today,
            value=85.5,
            target=90.0,
            unit="%",
            trend="up",
            trend_value=5.0,
        )

        assert metric.id is not None
        assert metric.profile == conmon_profile
        assert metric.metric_type == "completion_rate"
        assert metric.value == 85.5
        assert metric.target == 90.0
        assert metric.trend == "up"

    def test_metric_type_choices(self, folder, conmon_profile):
        """Test that metric type choices work correctly."""
        today = timezone.localdate()
        valid_types = [
            'completion_rate', 'on_time_rate', 'evidence_freshness',
            'vuln_remediation_time', 'poam_aging', 'scan_compliance',
            'control_effectiveness', 'incident_response_time'
        ]

        for metric_type in valid_types:
            metric = ConMonMetric.objects.create(
                folder=folder,
                profile=conmon_profile,
                metric_type=metric_type,
                period_start=today - timedelta(days=30),
                period_end=today,
                value=80.0,
            )
            assert metric.metric_type == metric_type

    def test_metric_trend_choices(self, folder, conmon_profile):
        """Test that trend choices work correctly."""
        today = timezone.localdate()
        valid_trends = ['up', 'down', 'stable']

        for trend in valid_trends:
            metric = ConMonMetric.objects.create(
                folder=folder,
                profile=conmon_profile,
                metric_type="completion_rate",
                period_start=today - timedelta(days=30),
                period_end=today,
                value=80.0,
                trend=trend,
            )
            assert metric.trend == trend

    def test_metric_status_property(self, folder, conmon_profile):
        """Test status property calculation."""
        today = timezone.localdate()

        # Good status - value >= target
        metric = ConMonMetric.objects.create(
            folder=folder,
            profile=conmon_profile,
            metric_type="completion_rate",
            period_start=today - timedelta(days=30),
            period_end=today,
            value=95.0,
            target=90.0,
        )
        assert metric.status == "good"

        # Warning status - value between 70% and 100% of target
        metric.value = 75.0
        metric.save()
        assert metric.status == "warning"

        # Critical status - value below 70% of target
        metric.value = 50.0
        metric.save()
        assert metric.status == "critical"

    def test_metric_breakdown_json(self, folder, conmon_profile):
        """Test breakdown JSON field."""
        today = timezone.localdate()
        breakdown = {
            "by_frequency": {
                "monthly": 90,
                "quarterly": 85,
                "annual": 100
            }
        }

        metric = ConMonMetric.objects.create(
            folder=folder,
            profile=conmon_profile,
            metric_type="completion_rate",
            period_start=today - timedelta(days=30),
            period_end=today,
            value=90.0,
            breakdown=breakdown,
        )

        assert metric.breakdown == breakdown
