"""
Tests for Continuous Monitoring API endpoints.
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from knox.models import AuthToken

from iam.models import Folder, RoleAssignment, Role, UserGroup
from continuous_monitoring.models import (
    ConMonProfile,
    ConMonActivityConfig,
    ConMonExecution,
    ConMonMetric,
)
from core.apps import startup

User = get_user_model()


@pytest.fixture
def app_config():
    """Initialize application startup."""
    startup(sender=None, **{})


@pytest.fixture
def authenticated_client(app_config, db):
    """Create an authenticated API client with admin privileges."""
    # Get or create admin user
    admin = User.objects.create_superuser("conmon_admin@test.com", is_published=True)

    # Get admin user group
    admin_group = UserGroup.objects.get(name="BI-UG-ADM")
    admin.folder = admin_group.folder
    admin.save()
    admin_group.user_set.add(admin)

    # Create client with token auth
    client = APIClient()
    _auth_token = AuthToken.objects.create(user=admin)
    auth_token = _auth_token[1]
    client.credentials(HTTP_AUTHORIZATION=f"Token {auth_token}")

    return client


@pytest.fixture
def test_folder(app_config, db):
    """Create a test folder under root."""
    root_folder = Folder.objects.get(content_type=Folder.ContentType.ROOT)
    return root_folder  # Use root folder for simplicity with admin user


@pytest.fixture
def conmon_profile(test_folder):
    """Create a test ConMon profile."""
    return ConMonProfile.objects.create(
        name="API Test Profile",
        description="Profile for API tests",
        folder=test_folder,
        profile_type="custom",
        status="active",
        implementation_groups=["BASIC"],
    )


@pytest.fixture
def conmon_activity(test_folder, conmon_profile):
    """Create a test ConMon activity."""
    return ConMonActivityConfig.objects.create(
        folder=test_folder,
        profile=conmon_profile,
        requirement_urn="urn:test:api:activity-01",
        ref_id="API-01",
        name="API Test Activity",
        enabled=True,
        frequency_override="monthly",
    )


@pytest.fixture
def conmon_execution(test_folder, conmon_activity):
    """Create a test ConMon execution."""
    today = timezone.localdate()
    return ConMonExecution.objects.create(
        folder=test_folder,
        activity_config=conmon_activity,
        period_start=today - timedelta(days=30),
        period_end=today,
        due_date=today + timedelta(days=7),
        status="pending",
    )


@pytest.mark.django_db
class TestConMonProfileAPI:
    """Tests for ConMon Profile API endpoints."""

    def test_list_profiles(self, authenticated_client, conmon_profile):
        """Test listing ConMon profiles."""
        response = authenticated_client.get("/api/conmon/profiles/")

        assert response.status_code == 200
        data = response.json()
        assert "results" in data or isinstance(data, list)

    def test_create_profile(self, authenticated_client, test_folder):
        """Test creating a ConMon profile via API."""
        payload = {
            "name": "New API Profile",
            "description": "Created via API",
            "folder": str(test_folder.id),
            "profile_type": "fedramp_moderate",
            "status": "draft",
            "implementation_groups": ["M"],
            "notification_lead_days": 14,
            "notification_enabled": True,
        }

        response = authenticated_client.post(
            "/api/conmon/profiles/",
            data=payload,
            format="json"
        )

        assert response.status_code in [200, 201]
        data = response.json()
        assert data["name"] == "New API Profile"
        assert data["profile_type"] == "fedramp_moderate"


@pytest.mark.django_db
class TestConMonActivityAPI:
    """Tests for ConMon Activity API endpoints."""

    def test_list_activities(self, authenticated_client, conmon_activity):
        """Test listing ConMon activities."""
        response = authenticated_client.get("/api/conmon/activities/")

        assert response.status_code == 200

    def test_create_activity(self, authenticated_client, test_folder, conmon_profile):
        """Test creating a ConMon activity via API."""
        payload = {
            "folder": str(test_folder.id),
            "profile": str(conmon_profile.id),
            "requirement_urn": "urn:test:new-activity-unique",
            "ref_id": "NEW-01",
            "name": "New Activity",
            "enabled": True,
            "frequency_override": "quarterly",
        }

        response = authenticated_client.post(
            "/api/conmon/activities/",
            data=payload,
            format="json"
        )

        assert response.status_code in [200, 201]


@pytest.mark.django_db
class TestConMonExecutionAPI:
    """Tests for ConMon Execution API endpoints."""

    def test_list_executions(self, authenticated_client, conmon_execution):
        """Test listing ConMon executions."""
        response = authenticated_client.get("/api/conmon/executions/")

        assert response.status_code == 200

    def test_upcoming_executions(self, authenticated_client, conmon_execution):
        """Test getting upcoming executions."""
        response = authenticated_client.get(
            "/api/conmon/executions/upcoming/?days=14"
        )

        assert response.status_code == 200

    def test_overdue_executions(self, authenticated_client, test_folder, conmon_activity):
        """Test getting overdue executions."""
        # Create an overdue execution
        today = timezone.localdate()
        ConMonExecution.objects.create(
            folder=test_folder,
            activity_config=conmon_activity,
            period_start=today - timedelta(days=60),
            period_end=today - timedelta(days=30),
            due_date=today - timedelta(days=7),  # Overdue
            status="pending",
        )

        response = authenticated_client.get("/api/conmon/executions/overdue/")

        assert response.status_code == 200


@pytest.mark.django_db
class TestConMonMetricAPI:
    """Tests for ConMon Metric API endpoints."""

    def test_list_metrics(self, authenticated_client, test_folder, conmon_profile):
        """Test listing ConMon metrics."""
        # Create a metric
        today = timezone.localdate()
        ConMonMetric.objects.create(
            folder=test_folder,
            profile=conmon_profile,
            metric_type="completion_rate",
            period_start=today - timedelta(days=30),
            period_end=today,
            value=85.0,
        )

        response = authenticated_client.get("/api/conmon/metrics/")

        assert response.status_code == 200

    def test_latest_metrics(self, authenticated_client, test_folder, conmon_profile):
        """Test getting latest metrics for a profile."""
        today = timezone.localdate()

        # Create metrics for different periods
        for i in range(3):
            ConMonMetric.objects.create(
                folder=test_folder,
                profile=conmon_profile,
                metric_type="completion_rate",
                period_start=today - timedelta(days=30 * (i + 1)),
                period_end=today - timedelta(days=30 * i),
                value=80.0 + i * 5,
            )

        response = authenticated_client.get(
            f"/api/conmon/metrics/latest/?profile={conmon_profile.id}"
        )

        assert response.status_code == 200


@pytest.mark.django_db
class TestConMonDashboardAPI:
    """Tests for ConMon Dashboard API endpoints."""

    def test_dashboard_list(self, authenticated_client, conmon_profile):
        """Test getting dashboard data."""
        response = authenticated_client.get("/api/conmon/dashboard/")

        assert response.status_code == 200

    def test_dashboard_with_profile(self, authenticated_client, conmon_profile):
        """Test getting dashboard data for specific profile."""
        response = authenticated_client.get(
            f"/api/conmon/dashboard/?profile={conmon_profile.id}"
        )

        assert response.status_code == 200

    def test_dashboard_health(self, authenticated_client, conmon_profile):
        """Test getting health summary."""
        response = authenticated_client.get(
            f"/api/conmon/dashboard/health/?profile={conmon_profile.id}"
        )

        assert response.status_code == 200
