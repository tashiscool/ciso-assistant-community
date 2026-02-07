import pytest
from rest_framework import status
from rest_framework.test import APIClient
from core.models import AccessReview, CryptoAsset, DetectionRule
from iam.models import Folder

from test_utils import EndpointTestsQueries


# ────────────────────────────────────────────────────────
#  AccessReview API Tests
# ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAccessReviewsUnauthenticated:
    """Test Access Reviews API endpoint without authentication."""

    client = APIClient()

    def test_get_access_reviews(self):
        EndpointTestsQueries.get_object(
            self.client,
            "Access reviews",
            AccessReview,
            {
                "name": "Q1 Access Review",
                "description": "Quarterly review",
                "folder": Folder.objects.create(name="test"),
            },
        )

    def test_create_access_reviews(self):
        EndpointTestsQueries.create_object(
            self.client,
            "Access reviews",
            AccessReview,
            {
                "name": "Q1 Access Review",
                "description": "Quarterly review",
                "folder": Folder.objects.create(name="test").id,
            },
        )

    def test_delete_access_reviews(self):
        EndpointTestsQueries.delete_object(
            self.client,
            "Access reviews",
            AccessReview,
            {"name": "Q1 Access Review", "folder": Folder.objects.create(name="test")},
        )


@pytest.mark.django_db
class TestAccessReviewsAuthenticated:
    """Test Access Reviews API endpoint with authentication."""

    def test_create_access_reviews(self, test):
        EndpointTestsQueries.Auth.create_object(
            test.client,
            "Access reviews",
            AccessReview,
            {
                "name": "Q1 Access Review",
                "description": "Quarterly review",
                "review_type": "user_access",
                "status": "planned",
                "result": "--",
                "findings_count": 0,
                "folder": str(test.folder.id),
            },
            {
                "folder": {"id": str(test.folder.id), "str": test.folder.name},
                "review_type": "User access",
                "status": "Planned",
                "result": "Undefined",
            },
            user_group=test.user_group,
            scope=str(test.folder),
        )

    def test_get_review_type_choices(self, test):
        EndpointTestsQueries.Auth.get_object_options(
            test.client,
            "Access reviews",
            "review_type",
            AccessReview.ReviewType.choices,
        )

    def test_get_status_choices(self, test):
        EndpointTestsQueries.Auth.get_object_options(
            test.client,
            "Access reviews",
            "status",
            AccessReview.Status.choices,
        )

    def test_get_result_choices(self, test):
        EndpointTestsQueries.Auth.get_object_options(
            test.client,
            "Access reviews",
            "result",
            AccessReview.Result.choices,
        )


# ────────────────────────────────────────────────────────
#  CryptoAsset API Tests
# ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCryptoAssetsUnauthenticated:
    """Test Crypto Assets API endpoint without authentication."""

    client = APIClient()

    def test_get_crypto_assets(self):
        EndpointTestsQueries.get_object(
            self.client,
            "Crypto assets",
            CryptoAsset,
            {
                "name": "wildcard.example.com",
                "description": "Wildcard TLS cert",
                "folder": Folder.objects.create(name="test"),
            },
        )

    def test_create_crypto_assets(self):
        EndpointTestsQueries.create_object(
            self.client,
            "Crypto assets",
            CryptoAsset,
            {
                "name": "wildcard.example.com",
                "description": "Wildcard TLS cert",
                "folder": Folder.objects.create(name="test").id,
            },
        )

    def test_delete_crypto_assets(self):
        EndpointTestsQueries.delete_object(
            self.client,
            "Crypto assets",
            CryptoAsset,
            {"name": "wildcard.example.com", "folder": Folder.objects.create(name="test")},
        )


@pytest.mark.django_db
class TestCryptoAssetsAuthenticated:
    """Test Crypto Assets API endpoint with authentication."""

    def test_create_crypto_assets(self, test):
        EndpointTestsQueries.Auth.create_object(
            test.client,
            "Crypto assets",
            CryptoAsset,
            {
                "name": "wildcard.example.com",
                "description": "Wildcard TLS cert",
                "crypto_type": "tls_certificate",
                "status": "active",
                "algorithm": "RSA-2048",
                "folder": str(test.folder.id),
            },
            {
                "folder": {"id": str(test.folder.id), "str": test.folder.name},
                "crypto_type": "TLS certificate",
                "status": "Active",
            },
            user_group=test.user_group,
            scope=str(test.folder),
        )

    def test_get_crypto_type_choices(self, test):
        EndpointTestsQueries.Auth.get_object_options(
            test.client,
            "Crypto assets",
            "crypto_type",
            CryptoAsset.CryptoType.choices,
        )

    def test_get_status_choices(self, test):
        EndpointTestsQueries.Auth.get_object_options(
            test.client,
            "Crypto assets",
            "status",
            CryptoAsset.Status.choices,
        )


# ────────────────────────────────────────────────────────
#  DetectionRule API Tests
# ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestDetectionRulesUnauthenticated:
    """Test Detection Rules API endpoint without authentication."""

    client = APIClient()

    def test_get_detection_rules(self):
        EndpointTestsQueries.get_object(
            self.client,
            "Detection rules",
            DetectionRule,
            {
                "name": "Brute Force Detection",
                "description": "Detects brute force login attempts",
                "folder": Folder.objects.create(name="test"),
            },
        )

    def test_create_detection_rules(self):
        EndpointTestsQueries.create_object(
            self.client,
            "Detection rules",
            DetectionRule,
            {
                "name": "Brute Force Detection",
                "description": "Detects brute force login attempts",
                "folder": Folder.objects.create(name="test").id,
            },
        )

    def test_delete_detection_rules(self):
        EndpointTestsQueries.delete_object(
            self.client,
            "Detection rules",
            DetectionRule,
            {"name": "Brute Force Detection", "folder": Folder.objects.create(name="test")},
        )


@pytest.mark.django_db
class TestDetectionRulesAuthenticated:
    """Test Detection Rules API endpoint with authentication."""

    def test_create_detection_rules(self, test):
        EndpointTestsQueries.Auth.create_object(
            test.client,
            "Detection rules",
            DetectionRule,
            {
                "name": "Brute Force Detection",
                "description": "Detects brute force login attempts",
                "rule_type": "siem_rule",
                "status": "active",
                "data_source": "CloudTrail",
                "detection_target": "Unauthorized API calls",
                "false_positive_rate": "low",
                "folder": str(test.folder.id),
            },
            {
                "folder": {"id": str(test.folder.id), "str": test.folder.name},
                "rule_type": "SIEM rule",
                "status": "Active",
                "false_positive_rate": "Low",
            },
            user_group=test.user_group,
            scope=str(test.folder),
        )

    def test_get_rule_type_choices(self, test):
        EndpointTestsQueries.Auth.get_object_options(
            test.client,
            "Detection rules",
            "rule_type",
            DetectionRule.RuleType.choices,
        )

    def test_get_status_choices(self, test):
        EndpointTestsQueries.Auth.get_object_options(
            test.client,
            "Detection rules",
            "status",
            DetectionRule.Status.choices,
        )

    def test_get_false_positive_rate_choices(self, test):
        EndpointTestsQueries.Auth.get_object_options(
            test.client,
            "Detection rules",
            "false_positive_rate",
            DetectionRule.FalsePositiveRate.choices,
        )
