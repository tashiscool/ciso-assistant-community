"""
Custom Django Fields for DDD Patterns

Provides fields for embedded ID arrays and other DDD patterns.
"""

import uuid
from typing import List, Optional
from django.db import models
from django.core.exceptions import ValidationError


class EmbeddedIdArrayField(models.JSONField):
    """
    Field for storing arrays of UUIDs (embedded ID arrays).

    This replaces ManyToMany relationships with embedded arrays
    for aggregate-centric modeling. Uses JSONField for database
    compatibility (works with both PostgreSQL and SQLite).

    Usage:
        class Asset(AggregateRoot):
            controlIds = EmbeddedIdArrayField(
                default=list,
                blank=True,
                help_text="Array of control IDs"
            )
    """

    def __init__(self, base_field=None, **kwargs):
        # base_field is ignored but accepted for backward compatibility
        # with migrations that may have been generated with ArrayField signature

        # Set defaults
        kwargs.setdefault('default', list)
        kwargs.setdefault('blank', True)
        kwargs.setdefault('null', True)  # Allow null values

        super().__init__(**kwargs)

    def validate(self, value, model_instance):
        """Validate that all values are UUIDs"""
        # Skip validation for None or empty list (blank=True, null=True)
        if value is None or value == []:
            return

        # Convert UUIDs to strings before JSONField validation
        if isinstance(value, list):
            # Validate each item is a valid UUID
            for item in value:
                if isinstance(item, uuid.UUID):
                    continue  # Valid UUID object
                try:
                    uuid.UUID(str(item))
                except (ValueError, TypeError):
                    raise ValidationError(
                        f"All items in {self.name} must be valid UUIDs"
                    )

    def get_prep_value(self, value):
        """Convert UUIDs to strings before saving to database"""
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item) if isinstance(item, uuid.UUID) else item for item in value]
        return value

    def from_db_value(self, value, expression, connection):
        """Convert from database value - ensure we always return a list"""
        if value is None:
            return []
        if isinstance(value, str):
            import json
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return []
        return value if isinstance(value, list) else []

    def deconstruct(self):
        """Deconstruct for migrations"""
        name, path, args, kwargs = super().deconstruct()
        # Remove default from kwargs if it's list (will be added back in __init__)
        if kwargs.get('default') == list:
            kwargs.pop('default', None)
        return name, path, args, kwargs

