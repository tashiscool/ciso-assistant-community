"""
IAM Models - MIT Licensed

Clean-room implementation of identity and access management.
Copyright (c) 2026 Tash
"""

import uuid
import secrets
import hashlib
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from django.core.validators import MinLengthValidator


class UserManager(BaseUserManager):
    """Manager for User model."""

    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user."""
        if not email:
            raise ValueError('Email address is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model for GRC platform.

    Uses email as the unique identifier instead of username.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text="Email address (used for login)"
    )

    # Profile information
    first_name = models.CharField(
        max_length=150,
        blank=True,
        default=""
    )
    last_name = models.CharField(
        max_length=150,
        blank=True,
        default=""
    )
    display_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Display name shown in the UI"
    )
    job_title = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    department = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    phone = models.CharField(
        max_length=50,
        blank=True,
        default=""
    )

    # Avatar/profile image
    avatar_url = models.URLField(
        blank=True,
        default=""
    )

    # Organization association (multi-tenant support)
    # This creates a soft relationship - users can belong to multiple orgs
    primary_organization_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="User's primary organization"
    )

    # Account status
    is_active = models.BooleanField(
        default=True,
        help_text="Whether the user account is active"
    )
    is_staff = models.BooleanField(
        default=False,
        help_text="Whether user can access admin site"
    )

    # Dates
    date_joined = models.DateTimeField(
        default=timezone.now
    )
    last_login = models.DateTimeField(
        null=True,
        blank=True
    )
    last_activity = models.DateTimeField(
        null=True,
        blank=True
    )

    # Security settings
    mfa_enabled = models.BooleanField(
        default=False,
        help_text="Whether MFA is enabled for this user"
    )
    mfa_secret = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    password_changed_at = models.DateTimeField(
        null=True,
        blank=True
    )
    failed_login_attempts = models.PositiveSmallIntegerField(
        default=0
    )
    locked_until = models.DateTimeField(
        null=True,
        blank=True
    )

    # Preferences
    preferences = models.JSONField(
        default=dict,
        blank=True,
        help_text="User preferences and settings"
    )
    timezone = models.CharField(
        max_length=50,
        blank=True,
        default="UTC"
    )
    locale = models.CharField(
        max_length=10,
        blank=True,
        default="en"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ['email']

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        """Get user's full name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.display_name or self.email

    def get_display_name(self):
        """Get the best display name for the user."""
        return self.display_name or self.full_name or self.email

    def is_account_locked(self):
        """Check if the account is currently locked."""
        if self.locked_until:
            return timezone.now() < self.locked_until
        return False


class Permission(models.Model):
    """
    A specific permission that can be granted.

    Permissions define fine-grained access rights to resources
    and actions within the GRC platform.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Permission identification
    codename = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique permission identifier (e.g., 'risk.create')"
    )
    name = models.CharField(
        max_length=255,
        help_text="Human-readable permission name"
    )
    description = models.TextField(
        blank=True,
        default=""
    )

    # Permission categorization
    class PermissionCategory(models.TextChoices):
        ORGANIZATION = 'organization', 'Organization'
        GOVERNANCE = 'governance', 'Governance'
        RISK = 'risk', 'Risk Management'
        COMPLIANCE = 'compliance', 'Compliance'
        ASSETS = 'assets', 'Assets'
        USERS = 'users', 'User Management'
        SYSTEM = 'system', 'System'

    category = models.CharField(
        max_length=20,
        choices=PermissionCategory.choices,
        default=PermissionCategory.SYSTEM
    )

    # Permission type (CRUD operations)
    class PermissionType(models.TextChoices):
        CREATE = 'create', 'Create'
        READ = 'read', 'Read'
        UPDATE = 'update', 'Update'
        DELETE = 'delete', 'Delete'
        APPROVE = 'approve', 'Approve'
        ASSIGN = 'assign', 'Assign'
        EXECUTE = 'execute', 'Execute'

    permission_type = models.CharField(
        max_length=20,
        choices=PermissionType.choices,
        default=PermissionType.READ
    )

    # Resource this permission applies to
    resource = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Resource type this permission applies to"
    )

    # System permission (cannot be deleted)
    is_system = models.BooleanField(
        default=False,
        help_text="System permissions cannot be modified"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Permission"
        verbose_name_plural = "Permissions"
        ordering = ['category', 'resource', 'codename']

    def __str__(self):
        return f"{self.codename}: {self.name}"


class Role(models.Model):
    """
    A role that groups permissions together.

    Roles simplify permission management by allowing
    permissions to be assigned to roles, then roles to users.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=100,
        help_text="Role name"
    )
    description = models.TextField(
        blank=True,
        default=""
    )

    # Organization scope (null = global role)
    organization_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Organization this role belongs to (null = global)"
    )

    # Role type
    class RoleType(models.TextChoices):
        SYSTEM = 'system', 'System Role'
        ORGANIZATION = 'organization', 'Organization Role'
        CUSTOM = 'custom', 'Custom Role'

    role_type = models.CharField(
        max_length=20,
        choices=RoleType.choices,
        default=RoleType.CUSTOM
    )

    # Permissions associated with this role
    permissions = models.ManyToManyField(
        Permission,
        through='RolePermission',
        related_name='roles'
    )

    # Role hierarchy (for role inheritance)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        help_text="Parent role to inherit permissions from"
    )

    # System role (cannot be deleted or modified)
    is_system = models.BooleanField(
        default=False
    )

    # Active status
    is_active = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Role"
        verbose_name_plural = "Roles"
        ordering = ['name']
        unique_together = [['organization_id', 'name']]

    def __str__(self):
        return self.name

    def get_all_permissions(self):
        """Get all permissions including inherited ones."""
        permissions = set(self.permissions.all())
        if self.parent:
            permissions.update(self.parent.get_all_permissions())
        return permissions


class RolePermission(models.Model):
    """
    Association between a role and a permission.

    Includes optional constraints for conditional permissions.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name='role_permissions'
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name='role_permissions'
    )

    # Optional constraints
    constraints = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional constraints for this permission"
    )

    granted_at = models.DateTimeField(auto_now_add=True)
    granted_by_id = models.UUIDField(
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = "Role Permission"
        verbose_name_plural = "Role Permissions"
        unique_together = [['role', 'permission']]


class UserRole(models.Model):
    """
    Association between a user and a role.

    Supports scoped role assignments (organization, domain).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='user_roles'
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name='user_roles'
    )

    # Scope of the role assignment
    organization_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Organization scope for this role assignment"
    )
    domain_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Domain scope for this role assignment"
    )

    # Validity period
    valid_from = models.DateTimeField(
        default=timezone.now
    )
    valid_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this role assignment expires"
    )

    # Assignment metadata
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by_id = models.UUIDField(
        null=True,
        blank=True
    )
    reason = models.TextField(
        blank=True,
        default="",
        help_text="Reason for role assignment"
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "User Role"
        verbose_name_plural = "User Roles"
        unique_together = [['user', 'role', 'organization_id']]

    def is_valid(self):
        """Check if this role assignment is currently valid."""
        now = timezone.now()
        if not self.is_active:
            return False
        if self.valid_from > now:
            return False
        if self.valid_until and self.valid_until < now:
            return False
        return True


class UserGroup(models.Model):
    """
    A group of users for easier management.

    Groups allow assigning roles and permissions to
    multiple users at once.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=100
    )
    description = models.TextField(
        blank=True,
        default=""
    )

    # Organization scope
    organization_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True
    )

    # Members
    members = models.ManyToManyField(
        User,
        through='GroupMembership',
        related_name='member_of_groups'
    )

    # Roles assigned to this group
    roles = models.ManyToManyField(
        Role,
        blank=True,
        related_name='groups'
    )

    # Group managers
    managers = models.ManyToManyField(
        User,
        blank=True,
        related_name='managed_groups'
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Group"
        verbose_name_plural = "User Groups"
        ordering = ['name']
        unique_together = [['organization_id', 'name']]

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    """
    Membership of a user in a group.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='group_memberships'
    )
    group = models.ForeignKey(
        UserGroup,
        on_delete=models.CASCADE,
        related_name='memberships'
    )

    # Membership type
    class MembershipType(models.TextChoices):
        MEMBER = 'member', 'Member'
        ADMIN = 'admin', 'Admin'
        OWNER = 'owner', 'Owner'

    membership_type = models.CharField(
        max_length=10,
        choices=MembershipType.choices,
        default=MembershipType.MEMBER
    )

    joined_at = models.DateTimeField(auto_now_add=True)
    added_by_id = models.UUIDField(
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = "Group Membership"
        verbose_name_plural = "Group Memberships"
        unique_together = [['user', 'group']]


class AccessPolicy(models.Model):
    """
    A policy-based access control rule.

    Access policies define rules for conditional access
    based on attributes (ABAC).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=100
    )
    description = models.TextField(
        blank=True,
        default=""
    )

    # Organization scope
    organization_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True
    )

    # Policy definition (JSON-based rules)
    rules = models.JSONField(
        default=list,
        help_text="Policy rules in JSON format"
    )

    # Effect when rules match
    class PolicyEffect(models.TextChoices):
        ALLOW = 'allow', 'Allow'
        DENY = 'deny', 'Deny'

    effect = models.CharField(
        max_length=10,
        choices=PolicyEffect.choices,
        default=PolicyEffect.ALLOW
    )

    # Priority (higher = evaluated first)
    priority = models.PositiveIntegerField(
        default=100,
        help_text="Policy priority (higher = evaluated first)"
    )

    # Resource pattern
    resource_pattern = models.CharField(
        max_length=255,
        blank=True,
        default="*",
        help_text="Resource pattern this policy applies to"
    )

    # Action pattern
    action_pattern = models.CharField(
        max_length=255,
        blank=True,
        default="*",
        help_text="Action pattern this policy applies to"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Access Policy"
        verbose_name_plural = "Access Policies"
        ordering = ['-priority', 'name']

    def __str__(self):
        return f"{self.name} ({self.effect})"


class APIKey(models.Model):
    """
    API key for programmatic access.

    API keys allow service accounts and integrations
    to authenticate without user credentials.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=100,
        help_text="Name/description for this API key"
    )

    # Key hash (actual key is only shown once at creation)
    key_prefix = models.CharField(
        max_length=8,
        db_index=True,
        help_text="First 8 characters of the key for identification"
    )
    key_hash = models.CharField(
        max_length=64,
        help_text="SHA-256 hash of the full API key"
    )

    # Owner
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='api_keys'
    )

    # Organization scope
    organization_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True
    )

    # Permissions (can be restricted from user's full permissions)
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name='api_keys'
    )

    # Validity
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this API key expires"
    )
    last_used_at = models.DateTimeField(
        null=True,
        blank=True
    )

    # IP restrictions
    allowed_ips = models.JSONField(
        default=list,
        blank=True,
        help_text="List of allowed IP addresses/ranges"
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "API Key"
        verbose_name_plural = "API Keys"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"

    @classmethod
    def generate_key(cls):
        """Generate a new API key."""
        key = secrets.token_urlsafe(32)
        return key

    @classmethod
    def hash_key(cls, key):
        """Hash an API key for storage."""
        return hashlib.sha256(key.encode()).hexdigest()

    def verify_key(self, key):
        """Verify an API key matches this record."""
        return self.key_hash == self.hash_key(key)

    def is_valid(self):
        """Check if this API key is currently valid."""
        if not self.is_active:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True


class AuditLog(models.Model):
    """
    Audit log for security-relevant events.

    Captures authentication, authorization, and other
    security events for compliance and forensics.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Event classification
    class EventCategory(models.TextChoices):
        AUTHENTICATION = 'authentication', 'Authentication'
        AUTHORIZATION = 'authorization', 'Authorization'
        DATA_ACCESS = 'data_access', 'Data Access'
        DATA_MODIFICATION = 'data_modification', 'Data Modification'
        ADMIN_ACTION = 'admin_action', 'Admin Action'
        SECURITY_EVENT = 'security_event', 'Security Event'
        SYSTEM_EVENT = 'system_event', 'System Event'

    category = models.CharField(
        max_length=20,
        choices=EventCategory.choices,
        db_index=True
    )

    # Event details
    action = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Action performed (e.g., 'login', 'create', 'delete')"
    )
    resource_type = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Type of resource affected"
    )
    resource_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="ID of resource affected"
    )

    # Actor information
    user_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="User who performed the action"
    )
    user_email = models.EmailField(
        blank=True,
        default="",
        help_text="Email of user (denormalized for audit)"
    )

    # Organization context
    organization_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True
    )

    # Request context
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True
    )
    user_agent = models.TextField(
        blank=True,
        default=""
    )
    request_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Request correlation ID"
    )

    # Outcome
    class Outcome(models.TextChoices):
        SUCCESS = 'success', 'Success'
        FAILURE = 'failure', 'Failure'
        ERROR = 'error', 'Error'
        DENIED = 'denied', 'Denied'

    outcome = models.CharField(
        max_length=10,
        choices=Outcome.choices,
        default=Outcome.SUCCESS,
        db_index=True
    )
    outcome_reason = models.TextField(
        blank=True,
        default="",
        help_text="Reason for failure/denial"
    )

    # Additional data
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional event details"
    )

    # Timestamps
    timestamp = models.DateTimeField(
        default=timezone.now,
        db_index=True
    )

    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['category', 'timestamp']),
            models.Index(fields=['user_id', 'timestamp']),
            models.Index(fields=['organization_id', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.timestamp}: {self.action} by {self.user_email or 'system'}"
