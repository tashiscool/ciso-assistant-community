"""
Library Models - MIT Licensed

Clean-room implementation of library management models.
Copyright (c) 2026 Tash
"""

import uuid
from django.db import models
from django.conf import settings


class StoredLibrary(models.Model):
    """
    A library stored in the system.

    Stored libraries are reference libraries (frameworks, controls, threats)
    that can be loaded into an organization.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True
    )

    # Library metadata
    version = models.CharField(
        max_length=50,
        default="1.0"
    )
    provider = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    locale = models.CharField(
        max_length=10,
        default="en"
    )

    # Object type
    class ObjectType(models.TextChoices):
        FRAMEWORK = 'framework', 'Framework'
        RISK_MATRIX = 'risk_matrix', 'Risk Matrix'
        THREAT_CATALOG = 'threat_catalog', 'Threat Catalog'
        CONTROL_CATALOG = 'control_catalog', 'Control Catalog'
        REFERENCE_CONTROLS = 'reference_controls', 'Reference Controls'
        MIXED = 'mixed', 'Mixed'

    object_type = models.CharField(
        max_length=20,
        choices=ObjectType.choices,
        default=ObjectType.FRAMEWORK
    )

    # Library content (JSON)
    content = models.JSONField(
        default=dict,
        help_text="Library content in JSON format"
    )

    # Dependencies
    dependencies = models.JSONField(
        default=list,
        blank=True,
        help_text="Library dependencies (ref_ids)"
    )

    # Status flags
    is_loaded = models.BooleanField(
        default=False,
        help_text="Whether this library has been loaded"
    )
    is_builtin = models.BooleanField(
        default=False,
        help_text="Whether this is a built-in library"
    )
    is_update = models.BooleanField(
        default=False,
        help_text="Whether this is an update to an existing library"
    )
    is_deprecated = models.BooleanField(
        default=False
    )

    # Checksums for integrity
    content_hash = models.CharField(
        max_length=64,
        blank=True,
        default=""
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Stored Library"
        verbose_name_plural = "Stored Libraries"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.version})"

    def get_object_count(self) -> dict:
        """Get count of objects in the library."""
        content = self.content or {}
        counts = {}
        for key in ['frameworks', 'controls', 'threats', 'risk_matrices', 'reference_controls']:
            if key in content:
                counts[key] = len(content[key])
        return counts


class LoadedLibrary(models.Model):
    """
    A library loaded into an organization.

    Represents a library that has been activated and its
    content imported into the system.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Reference to stored library
    stored_library = models.ForeignKey(
        StoredLibrary,
        on_delete=models.CASCADE,
        related_name='loaded_instances'
    )

    # Organization scope
    organization_id = models.UUIDField(db_index=True)

    # Loaded version info
    loaded_version = models.CharField(max_length=50)
    loaded_at = models.DateTimeField(auto_now_add=True)
    loaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Import status
    class ImportStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    import_status = models.CharField(
        max_length=15,
        choices=ImportStatus.choices,
        default=ImportStatus.PENDING
    )
    import_errors = models.JSONField(
        default=list,
        blank=True
    )

    # Created objects tracking
    created_objects = models.JSONField(
        default=dict,
        blank=True,
        help_text="UUIDs of objects created from this library"
    )

    # Is current (latest version)
    is_current = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Loaded Library"
        verbose_name_plural = "Loaded Libraries"
        ordering = ['-loaded_at']
        unique_together = [['stored_library', 'organization_id']]

    def __str__(self):
        return f"{self.stored_library.name} @ {self.organization_id}"
