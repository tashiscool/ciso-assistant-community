"""
Asset Management Models - MIT Licensed

Clean-room implementation of asset management for GRC.
Copyright (c) 2026 Tash
"""

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from ..base_models_mit import AbstractGRCEntity, TaggableModel
from .organization import Organization, Domain


class AssetCategory(AbstractGRCEntity):
    """
    A category for classifying assets.

    Asset categories help organize assets into logical groups
    for management and reporting purposes.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='asset_categories'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )

    # Category metadata
    icon = models.CharField(
        max_length=50,
        blank=True,
        default="cube",
        help_text="Icon identifier for display"
    )
    color = models.CharField(
        max_length=7,
        blank=True,
        default="#6B7280",
        help_text="Display color (hex format)"
    )

    class Meta:
        verbose_name = "Asset Category"
        verbose_name_plural = "Asset Categories"
        ordering = ['name']
        unique_together = [['organization', 'name']]

    def get_descendants(self):
        """Get all descendant categories."""
        descendants = list(self.children.all())
        for child in self.children.all():
            descendants.extend(child.get_descendants())
        return descendants


class AssetClassification(AbstractGRCEntity):
    """
    A classification level for assets.

    Classifications define sensitivity or criticality levels
    for assets (e.g., Public, Internal, Confidential, Restricted).
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='asset_classifications'
    )

    # Classification level (higher = more sensitive)
    level = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text="Classification level (1-10, higher = more sensitive)"
    )

    # Handling requirements
    handling_requirements = models.TextField(
        blank=True,
        default="",
        help_text="Requirements for handling assets at this classification"
    )

    # Display settings
    color = models.CharField(
        max_length=7,
        blank=True,
        default="#6B7280",
        help_text="Display color (hex format)"
    )

    class Meta:
        verbose_name = "Asset Classification"
        verbose_name_plural = "Asset Classifications"
        ordering = ['level', 'name']
        unique_together = [['organization', 'name']]


class Asset(AbstractGRCEntity, TaggableModel):
    """
    An organizational asset.

    Assets represent anything of value to the organization that
    needs to be protected. This includes information, systems,
    hardware, software, and other resources.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='assets'
    )
    domains = models.ManyToManyField(
        Domain,
        blank=True,
        related_name='assets'
    )
    category = models.ForeignKey(
        AssetCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assets'
    )
    classification = models.ForeignKey(
        AssetClassification,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assets'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        help_text="Parent asset for hierarchical structure"
    )

    # Asset type classification
    class AssetType(models.TextChoices):
        HARDWARE = 'hardware', 'Hardware'
        SOFTWARE = 'software', 'Software'
        DATA = 'data', 'Data/Information'
        NETWORK = 'network', 'Network'
        PERSONNEL = 'personnel', 'Personnel'
        FACILITY = 'facility', 'Facility'
        SERVICE = 'service', 'Service'
        PROCESS = 'process', 'Process'
        INTANGIBLE = 'intangible', 'Intangible'

    asset_type = models.CharField(
        max_length=20,
        choices=AssetType.choices,
        default=AssetType.DATA
    )

    # Status
    class AssetStatus(models.TextChoices):
        ACTIVE = 'active', 'Active'
        INACTIVE = 'inactive', 'Inactive'
        PLANNED = 'planned', 'Planned'
        RETIRED = 'retired', 'Retired'
        DISPOSED = 'disposed', 'Disposed'

    status = models.CharField(
        max_length=20,
        choices=AssetStatus.choices,
        default=AssetStatus.ACTIVE
    )

    # Asset identification
    asset_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="Unique asset identifier"
    )
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        default=""
    )

    # Location
    location = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Physical or logical location"
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_assets',
        help_text="Asset owner"
    )
    custodian = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='custodian_of_assets',
        help_text="Asset custodian (day-to-day responsibility)"
    )

    # Business value
    class BusinessCriticality(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'

    business_criticality = models.CharField(
        max_length=20,
        choices=BusinessCriticality.choices,
        default=BusinessCriticality.MEDIUM
    )

    # Financial information
    purchase_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    current_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    replacement_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Dates
    acquisition_date = models.DateField(
        null=True,
        blank=True
    )
    end_of_life_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expected end of life date"
    )
    warranty_expiration = models.DateField(
        null=True,
        blank=True
    )
    last_inventory_date = models.DateField(
        null=True,
        blank=True
    )

    # Technical details (stored as JSON for flexibility)
    technical_details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Technical specifications and details"
    )

    # Vendor/supplier information
    vendor = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    vendor_contact = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    support_contract = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )

    # CIA triad ratings (1-5)
    confidentiality_requirement = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Confidentiality requirement (1-5)"
    )
    integrity_requirement = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Integrity requirement (1-5)"
    )
    availability_requirement = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Availability requirement (1-5)"
    )

    # Dependencies
    depends_on = models.ManyToManyField(
        'self',
        blank=True,
        symmetrical=False,
        related_name='dependents',
        help_text="Assets this asset depends on"
    )

    class Meta:
        verbose_name = "Asset"
        verbose_name_plural = "Assets"
        ordering = ['-created_at']

    def __str__(self):
        if self.asset_id:
            return f"{self.asset_id}: {self.name}"
        return self.name

    @property
    def overall_sensitivity(self) -> int:
        """Calculate overall sensitivity based on CIA requirements."""
        return max(
            self.confidentiality_requirement,
            self.integrity_requirement,
            self.availability_requirement
        )

    def get_all_dependents(self):
        """Get all assets that depend on this asset (recursive)."""
        dependents = list(self.dependents.all())
        for dependent in self.dependents.all():
            dependents.extend(dependent.get_all_dependents())
        return dependents

    def get_all_dependencies(self):
        """Get all assets this asset depends on (recursive)."""
        dependencies = list(self.depends_on.all())
        for dep in self.depends_on.all():
            dependencies.extend(dep.get_all_dependencies())
        return dependencies


class AssetRelationship(models.Model):
    """
    A relationship between two assets.

    Captures various types of relationships between assets
    beyond simple dependencies.
    """
    class RelationshipType(models.TextChoices):
        CONTAINS = 'contains', 'Contains'
        RUNS_ON = 'runs_on', 'Runs On'
        CONNECTS_TO = 'connects_to', 'Connects To'
        STORES = 'stores', 'Stores'
        PROCESSES = 'processes', 'Processes'
        SUPPORTS = 'supports', 'Supports'
        BACKS_UP = 'backs_up', 'Backs Up'

    source_asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='outgoing_relationships'
    )
    target_asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='incoming_relationships'
    )
    relationship_type = models.CharField(
        max_length=20,
        choices=RelationshipType.choices,
        default=RelationshipType.CONNECTS_TO
    )
    description = models.TextField(
        blank=True,
        default=""
    )

    class Meta:
        verbose_name = "Asset Relationship"
        verbose_name_plural = "Asset Relationships"
        unique_together = [['source_asset', 'target_asset', 'relationship_type']]

    def __str__(self):
        return f"{self.source_asset} {self.relationship_type} {self.target_asset}"
