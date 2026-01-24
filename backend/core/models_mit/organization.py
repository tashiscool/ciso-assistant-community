"""
Organization Models - MIT Licensed

Clean-room implementation of organizational structure for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.conf import settings
from ..base_models_mit import AbstractGRCEntity, TaggableModel, UUIDModel, TimeStampedModel


class Organization(AbstractGRCEntity):
    """
    Top-level organizational entity for multi-tenant GRC.

    An organization represents a company, agency, or other entity
    that owns GRC data. All other entities belong to an organization.
    """
    short_name = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Short name or abbreviation"
    )

    # Contact information
    contact_email = models.EmailField(
        blank=True,
        default="",
        help_text="Primary contact email"
    )
    contact_phone = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Primary contact phone"
    )
    website = models.URLField(
        blank=True,
        default="",
        help_text="Organization website"
    )

    # Address
    address_line1 = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    address_line2 = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    city = models.CharField(
        max_length=100,
        blank=True,
        default=""
    )
    state_province = models.CharField(
        max_length=100,
        blank=True,
        default=""
    )
    postal_code = models.CharField(
        max_length=20,
        blank=True,
        default=""
    )
    country = models.CharField(
        max_length=100,
        blank=True,
        default=""
    )

    # Organization metadata
    industry = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Industry sector"
    )
    employee_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Approximate number of employees"
    )

    # Settings
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this organization is active"
    )
    settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="Organization-specific settings"
    )

    class Meta:
        verbose_name = "Organization"
        verbose_name_plural = "Organizations"
        ordering = ['name']

    def __str__(self):
        return self.name


class Domain(AbstractGRCEntity):
    """
    A logical grouping within an organization.

    Domains organize GRC entities (controls, risks, assets) into
    manageable groups. Examples: IT, HR, Finance, Operations.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='domains',
        help_text="Organization this domain belongs to"
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        help_text="Parent domain for hierarchical structure"
    )

    # Domain metadata
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_domains',
        help_text="User responsible for this domain"
    )

    # Display settings
    color = models.CharField(
        max_length=7,
        blank=True,
        default="#3B82F6",
        help_text="Display color (hex format)"
    )
    icon = models.CharField(
        max_length=50,
        blank=True,
        default="folder",
        help_text="Icon identifier"
    )

    is_active = models.BooleanField(
        default=True
    )

    class Meta:
        verbose_name = "Domain"
        verbose_name_plural = "Domains"
        ordering = ['name']
        unique_together = [['organization', 'name']]

    def __str__(self):
        return f"{self.organization.name} / {self.name}"

    def get_ancestors(self):
        """Get all ancestor domains."""
        ancestors = []
        current = self.parent
        while current:
            ancestors.append(current)
            current = current.parent
        return ancestors

    def get_descendants(self):
        """Get all descendant domains."""
        descendants = list(self.children.all())
        for child in self.children.all():
            descendants.extend(child.get_descendants())
        return descendants


class Perimeter(AbstractGRCEntity):
    """
    A security perimeter or boundary.

    Perimeters define logical or physical boundaries for
    security assessments, such as networks, buildings, or systems.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='perimeters'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='perimeters',
        help_text="Domains within this perimeter"
    )

    # Perimeter type
    class PerimeterType(models.TextChoices):
        PHYSICAL = 'physical', 'Physical'
        NETWORK = 'network', 'Network'
        APPLICATION = 'application', 'Application'
        DATA = 'data', 'Data'
        ORGANIZATIONAL = 'organizational', 'Organizational'

    perimeter_type = models.CharField(
        max_length=20,
        choices=PerimeterType.choices,
        default=PerimeterType.ORGANIZATIONAL
    )

    # Boundary definition
    boundary_definition = models.TextField(
        blank=True,
        default="",
        help_text="Detailed definition of the perimeter boundary"
    )

    # Compliance scope
    in_scope_for_compliance = models.BooleanField(
        default=True,
        help_text="Whether this perimeter is in scope for compliance"
    )

    class Meta:
        verbose_name = "Perimeter"
        verbose_name_plural = "Perimeters"
        ordering = ['name']


class OrganizationalUnit(AbstractGRCEntity):
    """
    An organizational unit or department.

    Represents the organizational structure for assigning
    responsibilities and ownership.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='organizational_units'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )

    # Unit metadata
    unit_type = models.CharField(
        max_length=50,
        blank=True,
        default="department",
        help_text="Type of unit (department, team, division, etc.)"
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_units'
    )

    # Contact
    contact_email = models.EmailField(
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Organizational Unit"
        verbose_name_plural = "Organizational Units"
        ordering = ['name']
