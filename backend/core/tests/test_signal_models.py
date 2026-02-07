import pytest
from datetime import date, timedelta
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.utils import timezone
from iam.models import Folder

from core.models import (
    AccessReview,
    CryptoAsset,
    DetectionRule,
    AppliedControl,
    Asset,
    Evidence,
)

from .fixtures import *

User = get_user_model()


@pytest.fixture
def test_folder():
    root_folder = Folder.objects.get(content_type=Folder.ContentType.ROOT)
    return Folder.objects.create(
        parent_folder=root_folder,
        name="signal test folder",
        description="folder for signal model tests",
    )


@pytest.fixture
def test_user():
    return User.objects.create_user("signaltester@tests.com")


@pytest.fixture
def test_assets(test_folder):
    return [
        Asset.objects.create(name="Web Server", folder=test_folder),
        Asset.objects.create(name="Database Server", folder=test_folder),
    ]


@pytest.fixture
def test_evidence(test_folder):
    return Evidence.objects.create(name="Test Evidence", folder=test_folder)


# ────────────────────────────────────────────────────────
#  AccessReview Tests
# ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAccessReview:
    def test_basic_creation(self, test_folder):
        """Test creating an AccessReview with minimal fields."""
        review = AccessReview.objects.create(
            name="Q1 2026 User Access Review",
            folder=test_folder,
        )

        assert review is not None
        assert review.name == "Q1 2026 User Access Review"
        assert review.review_type == AccessReview.ReviewType.USER_ACCESS
        assert review.status == AccessReview.Status.PLANNED
        assert review.result == AccessReview.Result.UNDEFINED
        assert review.findings_count == 0
        assert review.due_date is None
        assert review.completed_date is None
        assert review.reviewer is None
        assert review.scope_assets.count() == 0
        assert review.evidences.count() == 0
        assert review.applied_controls.count() == 0
        assert review.created_at is not None
        assert review.updated_at is not None

    def test_full_creation(self, test_folder, test_user, test_assets, applied_controls, test_evidence):
        """Test creating an AccessReview with all fields populated."""
        review = AccessReview.objects.create(
            name="Privileged Access Review",
            description="Review of all privileged accounts",
            folder=test_folder,
            reviewer=test_user,
            review_type=AccessReview.ReviewType.PRIVILEGED,
            status=AccessReview.Status.COMPLETED,
            due_date=date(2026, 3, 31),
            completed_date=date(2026, 3, 15),
            findings_count=3,
            result=AccessReview.Result.NON_COMPLIANT,
        )
        review.scope_assets.set(test_assets)
        review.applied_controls.set(applied_controls[:1])
        review.evidences.add(test_evidence)

        assert review.review_type == AccessReview.ReviewType.PRIVILEGED
        assert review.status == AccessReview.Status.COMPLETED
        assert review.result == AccessReview.Result.NON_COMPLIANT
        assert review.findings_count == 3
        assert review.scope_assets.count() == 2
        assert review.applied_controls.count() == 1
        assert review.evidences.count() == 1
        assert review.reviewer == test_user
        assert str(review) == "Privileged Access Review"

    def test_duplicate_name_same_folder(self, test_folder):
        """Test that duplicate names in the same folder raise ValidationError."""
        AccessReview.objects.create(
            name="Duplicate Review", folder=test_folder
        )
        with pytest.raises(ValidationError):
            AccessReview.objects.create(
                name="Duplicate Review", folder=test_folder
            )

    def test_all_review_types(self, test_folder):
        """Test that all ReviewType choices are valid."""
        for i, (value, label) in enumerate(AccessReview.ReviewType.choices):
            review = AccessReview.objects.create(
                name=f"Review Type Test {i}",
                folder=test_folder,
                review_type=value,
            )
            assert review.review_type == value
            assert review.get_review_type_display() == label

    def test_all_status_choices(self, test_folder):
        """Test that all Status choices are valid."""
        for i, (value, label) in enumerate(AccessReview.Status.choices):
            review = AccessReview.objects.create(
                name=f"Status Test {i}",
                folder=test_folder,
                status=value,
            )
            assert review.status == value
            assert review.get_status_display() == label

    def test_all_result_choices(self, test_folder):
        """Test that all Result choices are valid."""
        for i, (value, label) in enumerate(AccessReview.Result.choices):
            review = AccessReview.objects.create(
                name=f"Result Test {i}",
                folder=test_folder,
                result=value,
            )
            assert review.result == value
            assert review.get_result_display() == label

    def test_meta_verbose_names(self):
        """Test model Meta verbose names."""
        assert AccessReview._meta.verbose_name == "Access review"
        assert AccessReview._meta.verbose_name_plural == "Access reviews"


# ────────────────────────────────────────────────────────
#  CryptoAsset Tests
# ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCryptoAsset:
    def test_basic_creation(self, test_folder):
        """Test creating a CryptoAsset with minimal fields."""
        crypto = CryptoAsset.objects.create(
            name="wildcard.example.com",
            folder=test_folder,
        )

        assert crypto is not None
        assert crypto.name == "wildcard.example.com"
        assert crypto.crypto_type == CryptoAsset.CryptoType.TLS_CERTIFICATE
        assert crypto.status == CryptoAsset.Status.ACTIVE
        assert crypto.algorithm == ""
        assert crypto.key_size is None
        assert crypto.issuer == ""
        assert crypto.subject == ""
        assert crypto.serial_number == ""
        assert crypto.not_before is None
        assert crypto.not_after is None
        assert crypto.rotation_policy_days is None
        assert crypto.last_rotated is None
        assert crypto.owner is None
        assert crypto.assets.count() == 0
        assert crypto.applied_controls.count() == 0
        assert crypto.evidences.count() == 0

    def test_full_tls_certificate(self, test_folder, test_user, test_assets, test_evidence):
        """Test creating a fully populated TLS certificate."""
        now = timezone.now()
        crypto = CryptoAsset.objects.create(
            name="api.example.com",
            description="Production API TLS certificate",
            folder=test_folder,
            crypto_type=CryptoAsset.CryptoType.TLS_CERTIFICATE,
            algorithm="RSA-2048",
            key_size=2048,
            issuer="Let's Encrypt Authority X3",
            subject="CN=api.example.com",
            serial_number="03:ab:cd:ef:12:34",
            not_before=now - timedelta(days=30),
            not_after=now + timedelta(days=335),
            rotation_policy_days=365,
            last_rotated=now - timedelta(days=30),
            status=CryptoAsset.Status.ACTIVE,
            owner=test_user,
        )
        crypto.assets.set(test_assets)
        crypto.evidences.add(test_evidence)

        assert crypto.algorithm == "RSA-2048"
        assert crypto.key_size == 2048
        assert crypto.issuer == "Let's Encrypt Authority X3"
        assert crypto.owner == test_user
        assert crypto.assets.count() == 2
        assert crypto.evidences.count() == 1
        assert crypto.rotation_policy_days == 365
        assert str(crypto) == "api.example.com"

    def test_duplicate_name_same_folder(self, test_folder):
        """Test that duplicate names in the same folder raise ValidationError."""
        CryptoAsset.objects.create(name="Duplicate Cert", folder=test_folder)
        with pytest.raises(ValidationError):
            CryptoAsset.objects.create(name="Duplicate Cert", folder=test_folder)

    def test_all_crypto_types(self, test_folder):
        """Test that all CryptoType choices are valid."""
        for i, (value, label) in enumerate(CryptoAsset.CryptoType.choices):
            crypto = CryptoAsset.objects.create(
                name=f"Crypto Type Test {i}",
                folder=test_folder,
                crypto_type=value,
            )
            assert crypto.crypto_type == value
            assert crypto.get_crypto_type_display() == label

    def test_all_status_choices(self, test_folder):
        """Test that all Status choices are valid."""
        for i, (value, label) in enumerate(CryptoAsset.Status.choices):
            crypto = CryptoAsset.objects.create(
                name=f"Crypto Status Test {i}",
                folder=test_folder,
                status=value,
            )
            assert crypto.status == value
            assert crypto.get_status_display() == label

    def test_expired_certificate(self, test_folder):
        """Test creating an expired certificate."""
        now = timezone.now()
        crypto = CryptoAsset.objects.create(
            name="expired-cert.example.com",
            folder=test_folder,
            not_after=now - timedelta(days=10),
            status=CryptoAsset.Status.EXPIRED,
        )
        assert crypto.status == CryptoAsset.Status.EXPIRED
        assert crypto.not_after < now

    def test_meta_verbose_names(self):
        """Test model Meta verbose names."""
        assert CryptoAsset._meta.verbose_name == "Crypto asset"
        assert CryptoAsset._meta.verbose_name_plural == "Crypto assets"


# ────────────────────────────────────────────────────────
#  DetectionRule Tests
# ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestDetectionRule:
    def test_basic_creation(self, test_folder):
        """Test creating a DetectionRule with minimal fields."""
        rule = DetectionRule.objects.create(
            name="Brute Force Login Detection",
            folder=test_folder,
        )

        assert rule is not None
        assert rule.name == "Brute Force Login Detection"
        assert rule.rule_type == DetectionRule.RuleType.SIEM_RULE
        assert rule.status == DetectionRule.Status.UNTESTED
        assert rule.false_positive_rate == DetectionRule.FalsePositiveRate.UNKNOWN
        assert rule.data_source == ""
        assert rule.detection_target == ""
        assert rule.last_validated is None
        assert rule.last_triggered is None
        assert rule.coverage_gaps == ""
        assert rule.assets.count() == 0
        assert rule.applied_controls.count() == 0
        assert rule.evidences.count() == 0

    def test_full_creation(self, test_folder, test_assets, applied_controls, test_evidence):
        """Test creating a DetectionRule with all fields populated."""
        now = timezone.now()
        rule = DetectionRule.objects.create(
            name="CloudTrail Unauthorized API Call",
            description="Detects unauthorized AWS API calls via CloudTrail",
            folder=test_folder,
            rule_type=DetectionRule.RuleType.SIEM_RULE,
            data_source="AWS CloudTrail",
            detection_target="Unauthorized API calls (AccessDenied, UnauthorizedAccess)",
            status=DetectionRule.Status.ACTIVE,
            last_validated=now - timedelta(days=7),
            last_triggered=now - timedelta(hours=2),
            false_positive_rate=DetectionRule.FalsePositiveRate.LOW,
            coverage_gaps="Does not cover S3 data-plane events",
        )
        rule.assets.set(test_assets)
        rule.applied_controls.set(applied_controls[:2])
        rule.evidences.add(test_evidence)

        assert rule.data_source == "AWS CloudTrail"
        assert rule.status == DetectionRule.Status.ACTIVE
        assert rule.false_positive_rate == DetectionRule.FalsePositiveRate.LOW
        assert rule.coverage_gaps == "Does not cover S3 data-plane events"
        assert rule.assets.count() == 2
        assert rule.applied_controls.count() == 2
        assert rule.evidences.count() == 1
        assert rule.last_validated is not None
        assert rule.last_triggered is not None
        assert str(rule) == "CloudTrail Unauthorized API Call"

    def test_duplicate_name_same_folder(self, test_folder):
        """Test that duplicate names in the same folder raise ValidationError."""
        DetectionRule.objects.create(
            name="Duplicate Rule", folder=test_folder
        )
        with pytest.raises(ValidationError):
            DetectionRule.objects.create(
                name="Duplicate Rule", folder=test_folder
            )

    def test_all_rule_types(self, test_folder):
        """Test that all RuleType choices are valid."""
        for i, (value, label) in enumerate(DetectionRule.RuleType.choices):
            rule = DetectionRule.objects.create(
                name=f"Rule Type Test {i}",
                folder=test_folder,
                rule_type=value,
            )
            assert rule.rule_type == value
            assert rule.get_rule_type_display() == label

    def test_all_status_choices(self, test_folder):
        """Test that all Status choices are valid."""
        for i, (value, label) in enumerate(DetectionRule.Status.choices):
            rule = DetectionRule.objects.create(
                name=f"Rule Status Test {i}",
                folder=test_folder,
                status=value,
            )
            assert rule.status == value
            assert rule.get_status_display() == label

    def test_all_false_positive_rate_choices(self, test_folder):
        """Test that all FalsePositiveRate choices are valid."""
        for i, (value, label) in enumerate(DetectionRule.FalsePositiveRate.choices):
            rule = DetectionRule.objects.create(
                name=f"FP Rate Test {i}",
                folder=test_folder,
                false_positive_rate=value,
            )
            assert rule.false_positive_rate == value
            assert rule.get_false_positive_rate_display() == label

    def test_degraded_rule(self, test_folder):
        """Test creating a degraded detection rule with coverage gaps."""
        rule = DetectionRule.objects.create(
            name="Degraded EDR Rule",
            folder=test_folder,
            rule_type=DetectionRule.RuleType.EDR_POLICY,
            status=DetectionRule.Status.DEGRADED,
            coverage_gaps="Agent not deployed on 3 out of 10 endpoints",
            false_positive_rate=DetectionRule.FalsePositiveRate.HIGH,
        )
        assert rule.status == DetectionRule.Status.DEGRADED
        assert rule.coverage_gaps != ""

    def test_meta_verbose_names(self):
        """Test model Meta verbose names."""
        assert DetectionRule._meta.verbose_name == "Detection rule"
        assert DetectionRule._meta.verbose_name_plural == "Detection rules"
