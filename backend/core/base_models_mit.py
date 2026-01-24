"""
Base Models for CISO Assistant GRC Platform

MIT Licensed - Clean-room implementation
Copyright (c) 2026 Tash
"""

import uuid
from django.db import models
from django.utils import timezone
from django.conf import settings


class TimeStampedModel(models.Model):
    """
    Abstract base model providing timestamp fields.

    Provides created_at and updated_at fields that are automatically
    managed by Django.
    """
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when this record was created"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when this record was last updated"
    )

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """
    Abstract base model using UUID as primary key.

    Provides a UUID primary key instead of auto-incrementing integer,
    which is better for distributed systems and API exposure.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for this record"
    )

    class Meta:
        abstract = True


class AuditableModel(models.Model):
    """
    Abstract base model providing audit trail fields.

    Tracks who created and last modified the record.
    """
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_created",
        help_text="User who created this record"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_updated",
        help_text="User who last updated this record"
    )

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """
    Abstract base model providing soft delete functionality.

    Instead of actually deleting records, marks them as deleted.
    This preserves referential integrity and allows recovery.
    """
    is_deleted = models.BooleanField(
        default=False,
        help_text="Whether this record has been soft-deleted"
    )
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when this record was deleted"
    )
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_deleted",
        help_text="User who deleted this record"
    )

    class Meta:
        abstract = True

    def soft_delete(self, user=None):
        """Mark this record as deleted."""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])

    def restore(self):
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=['is_deleted', 'deleted_at', 'deleted_by'])


class NamedModel(models.Model):
    """
    Abstract base model for entities with name and description.

    Common pattern for GRC entities that have a human-readable name
    and optional description.
    """
    name = models.CharField(
        max_length=255,
        help_text="Human-readable name for this entity"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Detailed description of this entity"
    )

    class Meta:
        abstract = True

    def __str__(self):
        return self.name


class ReferenceModel(models.Model):
    """
    Abstract base model for entities with external references.

    Provides a reference ID field for linking to external systems
    or maintaining backward compatibility with imports.
    """
    ref_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="External reference identifier"
    )
    urn = models.CharField(
        max_length=500,
        blank=True,
        default="",
        db_index=True,
        help_text="Uniform Resource Name for this entity"
    )

    class Meta:
        abstract = True


class TaggableModel(models.Model):
    """
    Abstract base model providing tagging functionality.

    Stores tags as a JSON array for flexible categorization.
    """
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="List of tags for categorization"
    )

    class Meta:
        abstract = True

    def add_tag(self, tag: str):
        """Add a tag if not already present."""
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: str):
        """Remove a tag if present."""
        if tag in self.tags:
            self.tags.remove(tag)

    def has_tag(self, tag: str) -> bool:
        """Check if entity has a specific tag."""
        return tag in self.tags


class OrderedModel(models.Model):
    """
    Abstract base model for entities that can be ordered.

    Provides an order field for manual sorting.
    """
    order = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="Sort order for this entity"
    )

    class Meta:
        abstract = True
        ordering = ['order']


class PublishableModel(models.Model):
    """
    Abstract base model for entities with publish/draft workflow.

    Provides status field for managing content lifecycle.
    """
    class PublishStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    status = models.CharField(
        max_length=20,
        choices=PublishStatus.choices,
        default=PublishStatus.DRAFT,
        help_text="Publication status"
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this entity was published"
    )

    class Meta:
        abstract = True

    def publish(self):
        """Publish this entity."""
        self.status = self.PublishStatus.PUBLISHED
        self.published_at = timezone.now()
        self.save(update_fields=['status', 'published_at'])

    def archive(self):
        """Archive this entity."""
        self.status = self.PublishStatus.ARCHIVED
        self.save(update_fields=['status'])

    @property
    def is_published(self) -> bool:
        """Check if entity is published."""
        return self.status == self.PublishStatus.PUBLISHED


class AbstractGRCEntity(UUIDModel, TimeStampedModel, AuditableModel,
                        NamedModel, ReferenceModel, TaggableModel):
    """
    Comprehensive abstract base model for GRC entities.

    Combines all common functionality needed by most GRC entities:
    - UUID primary key
    - Timestamps (created/updated)
    - Audit trail (created_by/updated_by)
    - Name and description
    - External references
    - Tags

    This is the recommended base class for most GRC domain models.
    """

    class Meta:
        abstract = True
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        """Override save to handle any pre-save logic."""
        super().save(*args, **kwargs)


class AbstractOwnedEntity(AbstractGRCEntity):
    """
    Abstract base model for entities that belong to an organization/domain.

    Provides owner_id field for multi-tenant scenarios.
    """
    # Note: The actual ForeignKey to Domain/Organization should be
    # defined in concrete models to avoid circular imports

    class Meta:
        abstract = True


# ============================================================================
# Manager Classes
# ============================================================================

class SoftDeleteManager(models.Manager):
    """
    Manager that excludes soft-deleted records by default.
    """
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    """
    Manager that includes all records, including soft-deleted ones.
    """
    pass


class PublishedManager(models.Manager):
    """
    Manager that only returns published records.
    """
    def get_queryset(self):
        return super().get_queryset().filter(status='published')


# ============================================================================
# Utility Mixins
# ============================================================================

class SlugMixin(models.Model):
    """
    Mixin providing URL-friendly slug field.
    """
    slug = models.SlugField(
        max_length=255,
        blank=True,
        db_index=True,
        help_text="URL-friendly identifier"
    )

    class Meta:
        abstract = True


class VersionedMixin(models.Model):
    """
    Mixin for entities that track version numbers.
    """
    version = models.PositiveIntegerField(
        default=1,
        help_text="Version number of this entity"
    )
    version_comment = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Comment describing this version"
    )

    class Meta:
        abstract = True

    def increment_version(self, comment: str = ""):
        """Increment the version number."""
        self.version += 1
        self.version_comment = comment
        self.save(update_fields=['version', 'version_comment'])


class MetadataMixin(models.Model):
    """
    Mixin for storing arbitrary metadata as JSON.
    """
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata as key-value pairs"
    )

    class Meta:
        abstract = True

    def get_metadata(self, key: str, default=None):
        """Get a metadata value by key."""
        return self.metadata.get(key, default)

    def set_metadata(self, key: str, value):
        """Set a metadata value."""
        self.metadata[key] = value
