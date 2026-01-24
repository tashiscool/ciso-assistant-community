# MIT License - See LICENSE-MIT.txt in repository root
"""
Global Settings Models - Clean-room MIT implementation

Provides application-wide configuration management including:
- General application settings
- SSO configuration
- Feature flags
- Branding customization
"""

import uuid
from django.db import models
from django.core.cache import cache
from django.utils.translation import gettext_lazy as _


class GlobalSettings(models.Model):
    """
    Application-wide settings stored as JSON key-value pairs.

    Settings are organized by category (name) and store their
    configuration in a JSON value field.
    """

    class SettingsCategory(models.TextChoices):
        """Categories of global settings."""
        GENERAL = 'general', _('General')
        SSO = 'sso', _('Single Sign-On')
        FEATURE_FLAGS = 'feature_flags', _('Feature Flags')
        BRANDING = 'branding', _('Branding')
        SECURITY = 'security', _('Security')
        NOTIFICATIONS = 'notifications', _('Notifications')
        INTEGRATIONS = 'integrations', _('Integrations')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Setting identification
    name = models.CharField(
        max_length=50,
        unique=True,
        choices=SettingsCategory.choices,
        default=SettingsCategory.GENERAL,
        verbose_name=_('Setting Category'),
        help_text=_('Category name for this settings group')
    )

    # Setting value (JSON)
    value = models.JSONField(
        default=dict,
        verbose_name=_('Settings Value'),
        help_text=_('JSON object containing setting key-value pairs')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Folder scoping (null = global)
    folder_id = models.UUIDField(
        null=True,
        blank=True,
        verbose_name=_('Folder'),
        help_text=_('If set, settings apply only to this folder')
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Global Settings')
        verbose_name_plural = _('Global Settings')

    def __str__(self):
        return self.get_name_display()

    # Cache key prefix
    CACHE_PREFIX = 'global_settings_'
    CACHE_TIMEOUT = 300  # 5 minutes

    @classmethod
    def get_cache_key(cls, name: str) -> str:
        """Generate cache key for a settings category."""
        return f"{cls.CACHE_PREFIX}{name}"

    @classmethod
    def get_settings(cls, name: str) -> dict:
        """
        Get settings for a category with caching.

        Args:
            name: Settings category name

        Returns:
            dict: Settings value or empty dict if not found
        """
        cache_key = cls.get_cache_key(name)
        cached = cache.get(cache_key)

        if cached is not None:
            return cached

        try:
            settings = cls.objects.get(name=name)
            cache.set(cache_key, settings.value, cls.CACHE_TIMEOUT)
            return settings.value
        except cls.DoesNotExist:
            return {}

    @classmethod
    def set_settings(cls, name: str, value: dict) -> 'GlobalSettings':
        """
        Set settings for a category.

        Args:
            name: Settings category name
            value: Settings dictionary

        Returns:
            GlobalSettings: Updated settings object
        """
        settings, created = cls.objects.update_or_create(
            name=name,
            defaults={'value': value}
        )
        # Invalidate cache
        cache.delete(cls.get_cache_key(name))
        return settings

    @classmethod
    def get_value(cls, name: str, key: str, default=None):
        """
        Get a specific value from a settings category.

        Args:
            name: Settings category name
            key: Key within the settings
            default: Default value if not found

        Returns:
            Value for the key or default
        """
        settings = cls.get_settings(name)
        return settings.get(key, default)

    @classmethod
    def set_value(cls, name: str, key: str, value) -> 'GlobalSettings':
        """
        Set a specific value within a settings category.

        Args:
            name: Settings category name
            key: Key within the settings
            value: Value to set

        Returns:
            GlobalSettings: Updated settings object
        """
        settings = cls.get_settings(name)
        settings[key] = value
        return cls.set_settings(name, settings)

    def get(self, key: str, default=None):
        """Get a value from this settings instance."""
        return self.value.get(key, default)

    def set(self, key: str, value) -> None:
        """Set a value in this settings instance and save."""
        self.value[key] = value
        self.save(update_fields=['value', 'updated_at'])
        cache.delete(self.get_cache_key(self.name))

    def clear_cache(self):
        """Clear cache for this settings category."""
        cache.delete(self.get_cache_key(self.name))


class FeatureFlag(models.Model):
    """
    Feature toggle for enabling/disabling functionality.

    Supports various targeting options including percentage rollout,
    folder-specific, and user-specific flags.
    """

    class RolloutStrategy(models.TextChoices):
        """How the feature is rolled out."""
        ALL = 'all', _('All Users')
        PERCENTAGE = 'percentage', _('Percentage Rollout')
        FOLDERS = 'folders', _('Specific Folders')
        USERS = 'users', _('Specific Users')
        INTERNAL = 'internal', _('Internal Only')

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Flag identification
    key = models.CharField(
        max_length=100,
        unique=True,
        verbose_name=_('Feature Key'),
        help_text=_('Unique identifier for this feature flag')
    )
    name = models.CharField(
        max_length=200,
        verbose_name=_('Feature Name'),
        help_text=_('Human-readable name')
    )
    description = models.TextField(
        blank=True,
        verbose_name=_('Description'),
        help_text=_('Description of what this feature does')
    )

    # Flag state
    is_enabled = models.BooleanField(
        default=False,
        verbose_name=_('Enabled'),
        help_text=_('Whether the feature is enabled')
    )

    # Rollout configuration
    rollout_strategy = models.CharField(
        max_length=20,
        choices=RolloutStrategy.choices,
        default=RolloutStrategy.ALL,
        verbose_name=_('Rollout Strategy')
    )
    rollout_percentage = models.PositiveSmallIntegerField(
        default=100,
        verbose_name=_('Rollout Percentage'),
        help_text=_('Percentage of users (0-100) for percentage rollout')
    )

    # Targeting (JSON lists of IDs)
    target_folder_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Target Folders'),
        help_text=_('List of folder UUIDs for folder-specific rollout')
    )
    target_user_ids = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_('Target Users'),
        help_text=_('List of user UUIDs for user-specific rollout')
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Lifecycle
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_('Expires At'),
        help_text=_('When this feature flag expires (optional)')
    )

    class Meta:
        ordering = ['key']
        verbose_name = _('Feature Flag')
        verbose_name_plural = _('Feature Flags')

    def __str__(self):
        status = "enabled" if self.is_enabled else "disabled"
        return f"{self.key} ({status})"

    # Cache settings
    CACHE_PREFIX = 'feature_flag_'
    CACHE_TIMEOUT = 60  # 1 minute

    @classmethod
    def get_cache_key(cls, key: str) -> str:
        """Generate cache key for a feature flag."""
        return f"{cls.CACHE_PREFIX}{key}"

    @classmethod
    def is_feature_enabled(cls, key: str, user_id: str = None, folder_id: str = None) -> bool:
        """
        Check if a feature is enabled for a given context.

        Args:
            key: Feature flag key
            user_id: Optional user ID for user-specific checks
            folder_id: Optional folder ID for folder-specific checks

        Returns:
            bool: Whether the feature is enabled
        """
        from django.utils import timezone

        cache_key = cls.get_cache_key(key)
        flag_data = cache.get(cache_key)

        if flag_data is None:
            try:
                flag = cls.objects.get(key=key)
                flag_data = {
                    'is_enabled': flag.is_enabled,
                    'rollout_strategy': flag.rollout_strategy,
                    'rollout_percentage': flag.rollout_percentage,
                    'target_folder_ids': flag.target_folder_ids,
                    'target_user_ids': flag.target_user_ids,
                    'expires_at': flag.expires_at.isoformat() if flag.expires_at else None,
                }
                cache.set(cache_key, flag_data, cls.CACHE_TIMEOUT)
            except cls.DoesNotExist:
                return False

        # Check if expired
        if flag_data.get('expires_at'):
            from datetime import datetime
            expires = datetime.fromisoformat(flag_data['expires_at'])
            if timezone.now() > timezone.make_aware(expires) if timezone.is_naive(expires) else expires:
                return False

        # If not enabled, return False
        if not flag_data['is_enabled']:
            return False

        strategy = flag_data['rollout_strategy']

        if strategy == cls.RolloutStrategy.ALL:
            return True

        elif strategy == cls.RolloutStrategy.INTERNAL:
            # Would check if user is internal - for now return False
            return False

        elif strategy == cls.RolloutStrategy.FOLDERS:
            if folder_id and str(folder_id) in [str(f) for f in flag_data.get('target_folder_ids', [])]:
                return True
            return False

        elif strategy == cls.RolloutStrategy.USERS:
            if user_id and str(user_id) in [str(u) for u in flag_data.get('target_user_ids', [])]:
                return True
            return False

        elif strategy == cls.RolloutStrategy.PERCENTAGE:
            # Deterministic percentage based on user_id hash
            if user_id:
                import hashlib
                hash_val = int(hashlib.md5(str(user_id).encode()).hexdigest(), 16)
                bucket = hash_val % 100
                return bucket < flag_data['rollout_percentage']
            return False

        return False

    def enable(self):
        """Enable this feature flag."""
        self.is_enabled = True
        self.save(update_fields=['is_enabled', 'updated_at'])
        cache.delete(self.get_cache_key(self.key))

    def disable(self):
        """Disable this feature flag."""
        self.is_enabled = False
        self.save(update_fields=['is_enabled', 'updated_at'])
        cache.delete(self.get_cache_key(self.key))

    def set_percentage(self, percentage: int):
        """Set rollout percentage and switch to percentage strategy."""
        self.rollout_strategy = self.RolloutStrategy.PERCENTAGE
        self.rollout_percentage = max(0, min(100, percentage))
        self.save(update_fields=['rollout_strategy', 'rollout_percentage', 'updated_at'])
        cache.delete(self.get_cache_key(self.key))
