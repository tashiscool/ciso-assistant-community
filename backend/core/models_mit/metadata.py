"""
Metadata Models - MIT Licensed

Clean-room implementation of metadata entities for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from ..base_models_mit import UUIDModel, TimeStampedModel
from .organization import Organization


class FilteringLabel(UUIDModel, TimeStampedModel):
    """
    A label for filtering and categorizing GRC entities.

    Filtering labels provide a flexible tagging system for
    organizing and filtering content across the platform.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='filtering_labels'
    )

    # Label content
    label = models.CharField(
        max_length=100,
        help_text="The label text"
    )

    # Display options
    color = models.CharField(
        max_length=7,
        blank=True,
        default="#6B7280",
        help_text="Display color (hex format, e.g., #FF5733)"
    )
    icon = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Icon identifier"
    )

    # Category for grouping labels
    category = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Category for grouping related labels"
    )

    # Description
    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of when to use this label"
    )

    # Visibility
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this label is available for use"
    )

    class Meta:
        verbose_name = "Filtering Label"
        verbose_name_plural = "Filtering Labels"
        ordering = ['category', 'label']
        unique_together = [['organization', 'label']]

    def __str__(self):
        if self.category:
            return f"{self.category}: {self.label}"
        return self.label


class Terminology(UUIDModel, TimeStampedModel):
    """
    Custom terminology definitions for an organization.

    Allows organizations to customize labels and terms
    used throughout the GRC platform to match their
    internal vocabulary.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='terminology'
    )

    # Term mapping
    standard_term = models.CharField(
        max_length=100,
        help_text="The standard term used by the system"
    )
    custom_term = models.CharField(
        max_length=100,
        help_text="The organization's custom term"
    )

    # Context
    class TermContext(models.TextChoices):
        GENERAL = 'general', 'General'
        RISK = 'risk', 'Risk Management'
        COMPLIANCE = 'compliance', 'Compliance'
        GOVERNANCE = 'governance', 'Governance'
        ASSETS = 'assets', 'Asset Management'
        INCIDENTS = 'incidents', 'Incident Management'
        TPRM = 'tprm', 'Third-Party Risk'

    context = models.CharField(
        max_length=20,
        choices=TermContext.choices,
        default=TermContext.GENERAL,
        help_text="Context where this term applies"
    )

    # Localization
    locale = models.CharField(
        max_length=10,
        default="en",
        help_text="Locale code (e.g., 'en', 'fr', 'de')"
    )

    # Usage notes
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Notes on usage of this term"
    )

    class Meta:
        verbose_name = "Terminology"
        verbose_name_plural = "Terminology"
        ordering = ['standard_term']
        unique_together = [['organization', 'standard_term', 'locale']]

    def __str__(self):
        return f"{self.standard_term} -> {self.custom_term}"
