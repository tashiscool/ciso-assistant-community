"""
IAM Models - MIT Licensed

Clean-room implementation of folder-based hierarchical RBAC.
Copyright (c) 2026 Tash

This module implements:
- Folder: Hierarchical organizational structure (ROOT, DOMAIN, ENCLAVE)
- FolderMixin: Multi-tenant scoping for any model
- User, UserGroup: User and group management
- Role, RoleAssignment: Permission management with folder-based scoping
- PersonalAccessToken: API authentication
"""

import uuid
import secrets
import hashlib
from functools import lru_cache
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from django.core.validators import MinLengthValidator


# =============================================================================
# FOLDER HIERARCHY - Foundation for Multi-Tenant Scoping
# =============================================================================

class Folder(models.Model):
    """
    Hierarchical folder structure for organizing GRC objects.

    Folders provide multi-tenant isolation and permission scoping.
    The hierarchy supports three content types:
    - ROOT (GL): Global root folder (singleton)
    - DOMAIN (DO): Organizational domains/departments
    - ENCLAVE (EN): Isolated security enclaves
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    # Hierarchical structure - self-referential
    parent_folder = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subfolders',
        help_text="Parent folder in hierarchy (null = root)"
    )

    # Content type classification
    class ContentType(models.TextChoices):
        ROOT = 'GL', 'Global (Root)'
        DOMAIN = 'DO', 'Domain'
        ENCLAVE = 'EN', 'Enclave'

    content_type = models.CharField(
        max_length=2,
        choices=ContentType.choices,
        default=ContentType.DOMAIN
    )

    # Folder icon/color for UI
    icon = models.CharField(max_length=50, blank=True, default="folder")
    color = models.CharField(max_length=20, blank=True, default="blue")

    # Ordering within parent
    order = models.PositiveIntegerField(default=0)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Folder"
        verbose_name_plural = "Folders"
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """Ensure root folder constraints."""
        if self.content_type == self.ContentType.ROOT:
            # Root folder cannot have a parent
            self.parent_folder = None
        super().save(*args, **kwargs)

    @classmethod
    def get_root_folder(cls):
        """Get or create the root folder."""
        root, _ = cls.objects.get_or_create(
            content_type=cls.ContentType.ROOT,
            defaults={
                'name': 'Global',
                'description': 'Root folder for all objects',
            }
        )
        return root

    @classmethod
    def get_root_folder_id(cls):
        """Get root folder ID (for default FK values)."""
        return cls.get_root_folder().id

    def get_ancestors(self):
        """Get all ancestor folders (from parent to root)."""
        ancestors = []
        current = self.parent_folder
        while current:
            ancestors.append(current)
            current = current.parent_folder
        return ancestors

    def get_descendants(self):
        """Get all descendant folders recursively."""
        descendants = []
        for subfolder in self.subfolders.all():
            descendants.append(subfolder)
            descendants.extend(subfolder.get_descendants())
        return descendants

    def get_full_path(self):
        """Get full path from root to this folder."""
        path = [self]
        path.extend(self.get_ancestors())
        path.reverse()
        return path

    def get_path_string(self, separator=" / "):
        """Get path as string."""
        return separator.join(f.name for f in self.get_full_path())

    def is_ancestor_of(self, folder):
        """Check if this folder is an ancestor of another."""
        return self in folder.get_ancestors()

    def is_descendant_of(self, folder):
        """Check if this folder is a descendant of another."""
        return folder in self.get_ancestors()

    @property
    def depth(self):
        """Get depth in folder hierarchy (root = 0)."""
        return len(self.get_ancestors())


class FolderMixin(models.Model):
    """
    Abstract mixin for models that belong to a folder.

    Provides multi-tenant isolation by associating objects
    with folders in the hierarchy.
    """
    folder = models.ForeignKey(
        Folder,
        on_delete=models.CASCADE,
        related_name="%(class)s_set",
        default=Folder.get_root_folder_id,
        help_text="Folder this object belongs to"
    )

    class Meta:
        abstract = True

    def get_folder_path(self):
        """Get the folder path for this object."""
        return self.folder.get_path_string() if self.folder else ""


class PublishInRootFolderMixin(models.Model):
    """
    Mixin for objects that can be published globally.

    Objects with this mixin can be made visible across
    all folders when published.
    """
    is_published = models.BooleanField(
        default=False,
        help_text="Whether this object is published globally"
    )
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def publish(self):
        """Publish this object globally."""
        self.is_published = True
        self.published_at = timezone.now()
        self.save(update_fields=['is_published', 'published_at'])

    def unpublish(self):
        """Unpublish this object."""
        self.is_published = False
        self.published_at = None
        self.save(update_fields=['is_published', 'published_at'])


# =============================================================================
# USER MANAGEMENT
# =============================================================================

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


class User(AbstractBaseUser, PermissionsMixin, FolderMixin):
    """
    Custom user model with folder-based scoping.

    Uses email as the unique identifier and belongs to a folder
    for organizational scoping.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    email = models.EmailField(
        unique=True,
        db_index=True
    )

    # Profile
    first_name = models.CharField(max_length=150, blank=True, default="")
    last_name = models.CharField(max_length=150, blank=True, default="")
    display_name = models.CharField(max_length=255, blank=True, default="")
    job_title = models.CharField(max_length=255, blank=True, default="")
    department = models.CharField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    avatar_url = models.URLField(blank=True, default="")

    # Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # Dates
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)
    last_activity = models.DateTimeField(null=True, blank=True)

    # Security
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=255, blank=True, default="")
    password_changed_at = models.DateTimeField(null=True, blank=True)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    # Preferences
    preferences = models.JSONField(default=dict, blank=True)
    timezone = models.CharField(max_length=50, blank=True, default="UTC")
    locale = models.CharField(max_length=10, blank=True, default="en")

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
        """Get the best display name."""
        return self.display_name or self.full_name or self.email

    def is_account_locked(self):
        """Check if account is locked."""
        if self.locked_until:
            return timezone.now() < self.locked_until
        return False

    def has_role_in_folder(self, role_name, folder):
        """Check if user has a specific role in a folder."""
        return RoleAssignment.objects.filter(
            models.Q(user=self) | models.Q(user_group__members=self),
            role__name=role_name,
            perimeter_folders=folder
        ).exists()


class UserGroup(FolderMixin):
    """
    Group of users for collective role assignment.

    Groups belong to folders and can have roles assigned
    that apply to all members.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    # Members via M2M
    members = models.ManyToManyField(
        User,
        related_name='user_groups',
        blank=True
    )

    # Builtin groups cannot be deleted
    builtin = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Group"
        verbose_name_plural = "User Groups"
        ordering = ['name']

    def __str__(self):
        return self.name

    def add_member(self, user):
        """Add a user to the group."""
        self.members.add(user)

    def remove_member(self, user):
        """Remove a user from the group."""
        self.members.remove(user)


# =============================================================================
# ROLE-BASED ACCESS CONTROL
# =============================================================================

class Role(FolderMixin):
    """
    A role that grants permissions.

    Roles contain permissions and can be assigned to users
    or groups within specific folders.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    # Permissions as a list of codenames
    permissions = models.JSONField(
        default=list,
        help_text="List of permission codenames granted by this role"
    )

    # Builtin roles cannot be deleted
    builtin = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Role"
        verbose_name_plural = "Roles"
        ordering = ['name']

    def __str__(self):
        return self.name

    def has_permission(self, codename):
        """Check if role has a specific permission."""
        return codename in self.permissions

    def grant_permission(self, codename):
        """Add a permission to the role."""
        if codename not in self.permissions:
            self.permissions.append(codename)
            self.save(update_fields=['permissions'])

    def revoke_permission(self, codename):
        """Remove a permission from the role."""
        if codename in self.permissions:
            self.permissions.remove(codename)
            self.save(update_fields=['permissions'])


class RoleAssignment(FolderMixin):
    """
    Assignment of a role to a user or group within folders.

    RoleAssignment is the core RBAC mechanism that links:
    - A principal (User OR UserGroup)
    - A Role (with its permissions)
    - Perimeter folders (where the role applies)
    - Recursion flag (whether to include subfolders)
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")

    # Principal: User OR UserGroup (at least one must be set)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='role_assignments'
    )
    user_group = models.ForeignKey(
        UserGroup,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='role_assignments'
    )

    # The role being assigned
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name='assignments'
    )

    # Perimeter: folders where this assignment applies
    perimeter_folders = models.ManyToManyField(
        Folder,
        related_name='role_assignments',
        help_text="Folders where this role assignment applies"
    )

    # Recursive: apply to subfolders
    is_recursive = models.BooleanField(
        default=True,
        help_text="Whether permissions apply to subfolders"
    )

    # Builtin assignments cannot be deleted
    builtin = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Role Assignment"
        verbose_name_plural = "Role Assignments"
        ordering = ['created_at']

    def __str__(self):
        principal = self.user.email if self.user else self.user_group.name
        return f"{principal} -> {self.role.name}"

    def clean(self):
        """Validate that either user or user_group is set."""
        from django.core.exceptions import ValidationError
        if not self.user and not self.user_group:
            raise ValidationError("Either user or user_group must be set")
        if self.user and self.user_group:
            raise ValidationError("Cannot set both user and user_group")

    @classmethod
    def is_access_allowed(cls, user, permission_codename, folder):
        """
        Check if a user has a permission in a folder.

        Evaluates all role assignments for the user (direct and via groups)
        and checks if any grant the required permission in the target folder.
        """
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        # Get all assignments for this user (direct and via groups)
        assignments = cls.objects.filter(
            models.Q(user=user) | models.Q(user_group__members=user)
        ).select_related('role').prefetch_related('perimeter_folders')

        for assignment in assignments:
            # Check if role has the permission
            if not assignment.role.has_permission(permission_codename):
                continue

            # Check if folder is in perimeter
            perimeter_ids = set(assignment.perimeter_folders.values_list('id', flat=True))

            if assignment.is_recursive:
                # Check folder and all ancestors
                check_folders = [folder] + folder.get_ancestors()
                for check_folder in check_folders:
                    if check_folder.id in perimeter_ids:
                        return True
            else:
                # Exact folder match only
                if folder.id in perimeter_ids:
                    return True

        return False

    @classmethod
    def get_accessible_folders(cls, user, permission_codename):
        """
        Get all folders a user can access with a specific permission.

        Returns a queryset of folders.
        """
        if not user or not user.is_authenticated:
            return Folder.objects.none()

        if user.is_superuser:
            return Folder.objects.all()

        # Get all assignments with the permission
        assignments = cls.objects.filter(
            models.Q(user=user) | models.Q(user_group__members=user),
            role__permissions__contains=[permission_codename]
        ).prefetch_related('perimeter_folders')

        accessible_folder_ids = set()

        for assignment in assignments:
            for folder in assignment.perimeter_folders.all():
                accessible_folder_ids.add(folder.id)
                if assignment.is_recursive:
                    # Add all descendants
                    for descendant in folder.get_descendants():
                        accessible_folder_ids.add(descendant.id)

        return Folder.objects.filter(id__in=accessible_folder_ids)

    @classmethod
    def get_user_permissions_in_folder(cls, user, folder):
        """
        Get all permissions a user has in a specific folder.

        Returns a set of permission codenames.
        """
        if not user or not user.is_authenticated:
            return set()

        if user.is_superuser:
            # Return all known permissions
            return {'*'}

        permissions = set()

        assignments = cls.objects.filter(
            models.Q(user=user) | models.Q(user_group__members=user)
        ).select_related('role').prefetch_related('perimeter_folders')

        for assignment in assignments:
            perimeter_ids = set(assignment.perimeter_folders.values_list('id', flat=True))

            # Check if this assignment applies to the folder
            applies = False
            if assignment.is_recursive:
                check_folders = [folder] + folder.get_ancestors()
                for check_folder in check_folders:
                    if check_folder.id in perimeter_ids:
                        applies = True
                        break
            else:
                applies = folder.id in perimeter_ids

            if applies:
                permissions.update(assignment.role.permissions)

        return permissions


# =============================================================================
# API AUTHENTICATION
# =============================================================================

class PersonalAccessToken(models.Model):
    """
    Personal access token for API authentication.

    Tokens provide programmatic access to the API with
    scoped permissions.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Token name/description"
    )

    # Token hash (actual token shown once at creation)
    token_prefix = models.CharField(
        max_length=8,
        db_index=True
    )
    token_hash = models.CharField(max_length=64)

    # Owner
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='personal_access_tokens'
    )

    # Scoped permissions (subset of user's permissions)
    scopes = models.JSONField(
        default=list,
        blank=True,
        help_text="Permission scopes for this token"
    )

    # Validity
    expires_at = models.DateTimeField(
        null=True,
        blank=True
    )
    last_used_at = models.DateTimeField(null=True, blank=True)
    last_used_ip = models.GenericIPAddressField(null=True, blank=True)

    # Revocation
    is_revoked = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Personal Access Token"
        verbose_name_plural = "Personal Access Tokens"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.token_prefix}...)"

    @classmethod
    def generate_token(cls):
        """Generate a new token."""
        return secrets.token_urlsafe(32)

    @classmethod
    def hash_token(cls, token):
        """Hash a token for storage."""
        return hashlib.sha256(token.encode()).hexdigest()

    @classmethod
    def create_for_user(cls, user, name, scopes=None, expires_at=None):
        """Create a new token for a user."""
        token = cls.generate_token()
        pat = cls.objects.create(
            name=name,
            user=user,
            token_prefix=token[:8],
            token_hash=cls.hash_token(token),
            scopes=scopes or [],
            expires_at=expires_at
        )
        return pat, token  # Return both PAT and raw token

    def verify_token(self, token):
        """Verify a token matches this record."""
        return self.token_hash == self.hash_token(token)

    def is_valid(self):
        """Check if token is currently valid."""
        if self.is_revoked:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True

    def revoke(self):
        """Revoke this token."""
        self.is_revoked = True
        self.revoked_at = timezone.now()
        self.save(update_fields=['is_revoked', 'revoked_at'])

    def record_usage(self, ip_address=None):
        """Record token usage."""
        self.last_used_at = timezone.now()
        self.last_used_ip = ip_address
        self.save(update_fields=['last_used_at', 'last_used_ip'])


# =============================================================================
# AUDIT LOGGING
# =============================================================================

class AuditLog(models.Model):
    """
    Audit log for security-relevant events.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    class EventCategory(models.TextChoices):
        AUTHENTICATION = 'authentication', 'Authentication'
        AUTHORIZATION = 'authorization', 'Authorization'
        DATA_ACCESS = 'data_access', 'Data Access'
        DATA_MODIFICATION = 'data_modification', 'Data Modification'
        ADMIN_ACTION = 'admin_action', 'Admin Action'
        SECURITY_EVENT = 'security_event', 'Security Event'

    category = models.CharField(
        max_length=20,
        choices=EventCategory.choices,
        db_index=True
    )
    action = models.CharField(max_length=100, db_index=True)
    resource_type = models.CharField(max_length=100, blank=True, default="")
    resource_id = models.CharField(max_length=100, blank=True, default="")

    # Actor
    user_id = models.UUIDField(null=True, blank=True, db_index=True)
    user_email = models.EmailField(blank=True, default="")

    # Context
    folder_id = models.UUIDField(null=True, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")
    request_id = models.CharField(max_length=100, blank=True, default="")

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
    outcome_reason = models.TextField(blank=True, default="")

    # Additional data
    details = models.JSONField(default=dict, blank=True)

    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['category', 'timestamp']),
            models.Index(fields=['user_id', 'timestamp']),
            models.Index(fields=['folder_id', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.timestamp}: {self.action} by {self.user_email or 'system'}"

    @classmethod
    def log(cls, category, action, user=None, folder=None, resource_type="",
            resource_id="", outcome="success", details=None, request=None):
        """Create an audit log entry."""
        entry = cls(
            category=category,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else "",
            outcome=outcome,
            details=details or {}
        )

        if user:
            entry.user_id = user.id
            entry.user_email = user.email

        if folder:
            entry.folder_id = folder.id

        if request:
            entry.ip_address = request.META.get('REMOTE_ADDR')
            entry.user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
            entry.request_id = request.META.get('HTTP_X_REQUEST_ID', '')

        entry.save()
        return entry
