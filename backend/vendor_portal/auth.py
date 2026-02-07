"""
Token-based authentication for the vendor portal.

Vendors receive a unique, time-limited token via email that grants access
to a specific questionnaire without requiring a full user account.
Tokens are scoped to a single entity assessment and questionnaire.
"""

import secrets
import hashlib
from datetime import timedelta
from typing import Optional, Tuple, Dict, Any

from django.db import models
from django.utils import timezone
from django.conf import settings

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


# ---------------------------------------------------------------------------
# Token model
# ---------------------------------------------------------------------------

class VendorToken(models.Model):
    """
    Stores vendor portal access tokens.

    Each token is scoped to a specific entity (vendor), an optional
    questionnaire, and an optional entity assessment. Tokens expire
    after a configurable duration and can be revoked.
    """

    # The lookup value sent to the vendor (URL-safe random string).
    token = models.CharField(
        max_length=128,
        unique=True,
        db_index=True,
        help_text="URL-safe access token sent to the vendor.",
    )

    # SHA-256 hash of the token for secure storage comparison.
    token_hash = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="SHA-256 hash of the token for verification.",
    )

    # Scoping: which entity and questionnaire this token grants access to.
    entity_id = models.UUIDField(
        help_text="UUID of the vendor Entity this token belongs to.",
    )

    questionnaire_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="UUID of the Questionnaire this token grants access to.",
    )

    entity_assessment_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="UUID of the EntityAssessment this token is associated with.",
    )

    # Metadata
    vendor_email = models.EmailField(
        blank=True,
        help_text="Email address of the vendor contact who received this token.",
    )

    vendor_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Display name for the vendor contact.",
    )

    # Lifecycle
    created_at = models.DateTimeField(auto_now_add=True)

    expires_at = models.DateTimeField(
        help_text="Expiry timestamp after which the token is no longer valid.",
    )

    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of the most recent use of this token.",
    )

    is_revoked = models.BooleanField(
        default=False,
        help_text="Whether this token has been manually revoked.",
    )

    max_uses = models.IntegerField(
        default=0,
        help_text="Maximum number of times this token can be used (0 = unlimited).",
    )

    use_count = models.IntegerField(
        default=0,
        help_text="Number of times this token has been used.",
    )

    class Meta:
        db_table = "vendor_portal_tokens"
        indexes = [
            models.Index(fields=["entity_id"], name="vpt_entity_idx"),
            models.Index(fields=["expires_at"], name="vpt_expires_idx"),
            models.Index(fields=["token_hash"], name="vpt_hash_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        status = "revoked" if self.is_revoked else (
            "expired" if self.is_expired else "active"
        )
        return f"VendorToken(entity={self.entity_id}, status={status})"

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_valid(self) -> bool:
        if self.is_revoked:
            return False
        if self.is_expired:
            return False
        if self.max_uses > 0 and self.use_count >= self.max_uses:
            return False
        return True

    # ------------------------------------------------------------------
    # Class methods
    # ------------------------------------------------------------------

    @classmethod
    def generate_token(
        cls,
        entity_id: str,
        questionnaire_id: Optional[str] = None,
        entity_assessment_id: Optional[str] = None,
        vendor_email: str = "",
        vendor_name: str = "",
        expires_in_days: int = 30,
        max_uses: int = 0,
    ) -> "VendorToken":
        """
        Generate a new vendor access token.

        Args:
            entity_id: UUID of the vendor Entity.
            questionnaire_id: Optional UUID of the target Questionnaire.
            entity_assessment_id: Optional UUID of the EntityAssessment.
            vendor_email: Vendor contact email.
            vendor_name: Vendor contact display name.
            expires_in_days: Number of days until token expiry.
            max_uses: Maximum allowed uses (0 = unlimited).

        Returns:
            Persisted VendorToken instance. The plaintext token is available
            in the ``token`` field for sending to the vendor.
        """
        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        instance = cls(
            token=raw_token,
            token_hash=token_hash,
            entity_id=entity_id,
            questionnaire_id=questionnaire_id,
            entity_assessment_id=entity_assessment_id,
            vendor_email=vendor_email,
            vendor_name=vendor_name,
            expires_at=timezone.now() + timedelta(days=expires_in_days),
            max_uses=max_uses,
        )
        instance.save()
        return instance

    @classmethod
    def verify_token(cls, raw_token: str) -> Optional["VendorToken"]:
        """
        Verify a raw token string and return the corresponding VendorToken.

        Updates ``last_used_at`` and ``use_count`` on successful verification.

        Args:
            raw_token: The plaintext token from the URL.

        Returns:
            VendorToken if valid, None otherwise.
        """
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        try:
            vendor_token = cls.objects.get(token_hash=token_hash)
        except cls.DoesNotExist:
            return None

        if not vendor_token.is_valid:
            return None

        vendor_token.last_used_at = timezone.now()
        vendor_token.use_count += 1
        vendor_token.save(update_fields=["last_used_at", "use_count"])
        return vendor_token

    def revoke(self) -> None:
        """Revoke this token, preventing further use."""
        self.is_revoked = True
        self.save(update_fields=["is_revoked"])

    def extend(self, days: int) -> None:
        """Extend the expiry date by the given number of days."""
        self.expires_at = self.expires_at + timedelta(days=days)
        self.save(update_fields=["expires_at"])


# ---------------------------------------------------------------------------
# Lightweight user-like wrapper for DRF
# ---------------------------------------------------------------------------

class VendorUser:
    """
    Lightweight user-like object returned by VendorTokenAuthentication.

    Satisfies DRF's expectation of a user object in ``request.user``
    without being a real Django ``User`` instance.
    """

    is_authenticated = True
    is_anonymous = False
    is_staff = False
    is_superuser = False

    def __init__(self, vendor_token: VendorToken):
        self.vendor_token = vendor_token
        self.pk = str(vendor_token.entity_id)
        self.entity_id = vendor_token.entity_id
        self.questionnaire_id = vendor_token.questionnaire_id
        self.entity_assessment_id = vendor_token.entity_assessment_id
        self.email = vendor_token.vendor_email
        self.display_name = vendor_token.vendor_name or vendor_token.vendor_email

    def __str__(self) -> str:
        return f"VendorUser({self.display_name})"


# ---------------------------------------------------------------------------
# DRF Authentication backend
# ---------------------------------------------------------------------------

class VendorTokenAuthentication(BaseAuthentication):
    """
    REST Framework authentication backend for vendor portal tokens.

    Tokens can be provided in two ways:
      1. As a URL path parameter named ``token``.
      2. As a ``Bearer`` token in the ``Authorization`` header.

    On success, ``request.user`` is set to a ``VendorUser`` instance and
    ``request.auth`` is the ``VendorToken`` model instance.
    """

    keyword = "Bearer"

    def authenticate(self, request) -> Optional[Tuple["VendorUser", "VendorToken"]]:
        """
        Authenticate the request using the vendor token.

        Returns:
            (VendorUser, VendorToken) tuple on success, None otherwise.

        Raises:
            AuthenticationFailed: If a token is provided but invalid.
        """
        raw_token = self._extract_token(request)
        if raw_token is None:
            return None  # Let other auth backends try

        vendor_token = VendorToken.verify_token(raw_token)
        if vendor_token is None:
            raise AuthenticationFailed(
                "Invalid or expired vendor portal token. "
                "Please request a new link from your contact."
            )

        return (VendorUser(vendor_token), vendor_token)

    def authenticate_header(self, request) -> str:
        return f'{self.keyword} realm="vendor-portal"'

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _extract_token(self, request) -> Optional[str]:
        """
        Extract the token from the request (URL kwargs or Authorization header).
        """
        # 1. Try URL path parameter
        token = request.parser_context.get("kwargs", {}).get("token")
        if token:
            return token

        # 2. Try query parameter
        token = request.query_params.get("token")
        if token:
            return token

        # 3. Try Authorization header
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith(f"{self.keyword} "):
            return auth_header[len(self.keyword) + 1:].strip()

        return None
