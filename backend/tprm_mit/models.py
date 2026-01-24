"""
TPRM Models - MIT Licensed

Clean-room implementation of Third-Party Risk Management models.
Copyright (c) 2026 Tash
"""

import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Entity(models.Model):
    """
    A third-party entity (vendor, partner, supplier).

    Entities represent external organizations that interact
    with the organization and may pose risks.
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
        blank=True,
        default="",
        db_index=True
    )

    # Organization scope
    organization_id = models.UUIDField(db_index=True)

    # Entity hierarchy
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subsidiaries'
    )

    # Entity type
    class EntityType(models.TextChoices):
        VENDOR = 'vendor', 'Vendor'
        SUPPLIER = 'supplier', 'Supplier'
        PARTNER = 'partner', 'Partner'
        SUBCONTRACTOR = 'subcontractor', 'Subcontractor'
        SERVICE_PROVIDER = 'service_provider', 'Service Provider'
        CLOUD_PROVIDER = 'cloud_provider', 'Cloud Provider'
        CONSULTANT = 'consultant', 'Consultant'
        OTHER = 'other', 'Other'

    entity_type = models.CharField(
        max_length=20,
        choices=EntityType.choices,
        default=EntityType.VENDOR
    )

    # Status
    is_active = models.BooleanField(default=True)

    # Default risk metrics (1-4 scale)
    default_dependency = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )
    default_penetration = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )
    default_maturity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )
    default_trust = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )

    # Contact information
    website = models.URLField(blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=50, blank=True, default="")

    # Address
    address_line1 = models.CharField(max_length=255, blank=True, default="")
    address_line2 = models.CharField(max_length=255, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state_province = models.CharField(max_length=100, blank=True, default="")
    postal_code = models.CharField(max_length=20, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")

    # Legal identifiers (JSON for flexibility)
    legal_identifiers = models.JSONField(
        default=dict,
        blank=True,
        help_text="Legal identifiers: LEI, DUNS, VAT, etc."
    )

    # DORA-specific fields
    class DORAEntityType(models.TextChoices):
        FINANCIAL_ENTITY = 'financial_entity', 'Financial Entity'
        ICT_THIRD_PARTY = 'ict_third_party', 'ICT Third-Party Provider'
        CRITICAL_ICT = 'critical_ict', 'Critical ICT Third-Party Provider'
        GROUP_ENTITY = 'group_entity', 'Group Entity'
        OTHER = 'other', 'Other'

    dora_entity_type = models.CharField(
        max_length=20,
        choices=DORAEntityType.choices,
        default=DORAEntityType.OTHER,
        help_text="DORA entity classification"
    )

    # DORA hierarchy level
    class DORAHierarchy(models.TextChoices):
        DIRECT = 'direct', 'Direct Provider'
        SUB_CONTRACTED = 'sub_contracted', 'Sub-Contracted'
        CHAIN = 'chain', 'Supply Chain'

    dora_hierarchy = models.CharField(
        max_length=20,
        choices=DORAHierarchy.choices,
        default=DORAHierarchy.DIRECT
    )

    # DORA additional fields
    assets_value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total value of assets managed"
    )
    competent_authority = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Regulatory authority"
    )

    # Provider person type for DORA reporting
    class ProviderPersonType(models.TextChoices):
        NATURAL = 'natural', 'Natural Person'
        LEGAL = 'legal', 'Legal Entity'

    provider_person_type = models.CharField(
        max_length=10,
        choices=ProviderPersonType.choices,
        default=ProviderPersonType.LEGAL
    )

    # Currency for financial data
    currency = models.CharField(
        max_length=3,
        blank=True,
        default="EUR"
    )

    # Built-in flag (for library entities)
    is_builtin = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Entity"
        verbose_name_plural = "Entities"
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def default_criticality(self) -> float:
        """Calculate default criticality score."""
        denominator = self.default_maturity * self.default_trust
        if denominator == 0:
            return float('inf')
        return (self.default_dependency * self.default_penetration) / denominator


class Representative(models.Model):
    """
    A representative/contact at an entity.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='representatives'
    )

    # Personal information
    ref_id = models.CharField(max_length=100, blank=True, default="")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=50, blank=True, default="")
    role = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True, default="")

    # Link to user if they have system access
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='representative_profiles'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Representative"
        verbose_name_plural = "Representatives"
        ordering = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class Solution(models.Model):
    """
    A solution/service provided by an entity.

    Solutions represent specific products or services
    from a provider to a recipient entity.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Provider and recipient
    provider = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='provided_solutions'
    )
    recipient_id = models.UUIDField(
        db_index=True,
        help_text="Recipient entity/organization UUID"
    )

    # Criticality rating
    class CriticalityLevel(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    criticality = models.CharField(
        max_length=10,
        choices=CriticalityLevel.choices,
        default=CriticalityLevel.MEDIUM
    )

    # Related assets (UUIDs)
    asset_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Related asset UUIDs"
    )

    # Owners (user UUIDs)
    owner_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Owner user UUIDs"
    )

    # DORA-specific fields for ICT services
    class ICTServiceType(models.TextChoices):
        CLOUD_COMPUTING = 'cloud_computing', 'Cloud Computing'
        DATA_ANALYTICS = 'data_analytics', 'Data Analytics'
        SOFTWARE = 'software', 'Software'
        DATA_CENTRE = 'data_centre', 'Data Centre'
        NETWORK = 'network', 'Network'
        SECURITY = 'security', 'Security'
        ICT_CONSULTING = 'ict_consulting', 'ICT Consulting'
        OTHER = 'other', 'Other'

    ict_service_type = models.CharField(
        max_length=20,
        choices=ICTServiceType.choices,
        default=ICTServiceType.OTHER
    )

    # Data storage
    storage_of_data = models.BooleanField(
        default=False,
        help_text="Whether this service stores data"
    )

    # Data locations
    data_storage_locations = models.JSONField(
        default=list,
        blank=True,
        help_text="Countries where data is stored"
    )
    data_processing_locations = models.JSONField(
        default=list,
        blank=True,
        help_text="Countries where data is processed"
    )

    # Data sensitiveness
    class DataSensitiveness(models.TextChoices):
        PUBLIC = 'public', 'Public'
        INTERNAL = 'internal', 'Internal'
        CONFIDENTIAL = 'confidential', 'Confidential'
        RESTRICTED = 'restricted', 'Restricted'

    sensitiveness = models.CharField(
        max_length=15,
        choices=DataSensitiveness.choices,
        default=DataSensitiveness.INTERNAL
    )

    # Reliance and substitutability
    class RelianceLevel(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    reliance_level = models.CharField(
        max_length=10,
        choices=RelianceLevel.choices,
        default=RelianceLevel.MEDIUM
    )

    class Substitutability(models.TextChoices):
        EASILY = 'easily', 'Easily Substitutable'
        SUBSTITUTABLE = 'substitutable', 'Substitutable'
        DIFFICULT = 'difficult', 'Difficult to Substitute'
        NOT_SUBSTITUTABLE = 'not_substitutable', 'Not Substitutable'

    substitutability = models.CharField(
        max_length=20,
        choices=Substitutability.choices,
        default=Substitutability.SUBSTITUTABLE
    )
    non_substitutability_reason = models.TextField(
        blank=True,
        default="",
        help_text="Reason if not substitutable"
    )

    # Exit planning
    has_exit_plan = models.BooleanField(default=False)
    exit_plan_description = models.TextField(blank=True, default="")

    # Reintegration
    reintegration_possibility = models.BooleanField(
        default=True,
        help_text="Can this service be brought in-house?"
    )

    # Impact of discontinuing
    discontinuing_impact = models.TextField(
        blank=True,
        default="",
        help_text="Impact if service is discontinued"
    )

    # Alternative providers
    alternative_providers = models.TextField(
        blank=True,
        default="",
        help_text="Potential alternative providers"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Solution"
        verbose_name_plural = "Solutions"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.provider.name})"


class Contract(models.Model):
    """
    A contract between entities.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Parties
    provider = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='provider_contracts'
    )
    beneficiary_id = models.UUIDField(
        db_index=True,
        help_text="Beneficiary entity/organization UUID"
    )

    # Status
    class ContractStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        EXPIRED = 'expired', 'Expired'
        TERMINATED = 'terminated', 'Terminated'

    status = models.CharField(
        max_length=15,
        choices=ContractStatus.choices,
        default=ContractStatus.DRAFT
    )

    # Dates
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    signed_date = models.DateField(null=True, blank=True)

    # Related solutions
    solutions = models.ManyToManyField(
        Solution,
        blank=True,
        related_name='contracts'
    )

    # Overarching contract (for sub-contracts)
    overarching_contract = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sub_contracts'
    )

    # Financial
    currency = models.CharField(max_length=3, default="EUR")
    annual_expense = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Termination
    notice_period_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Notice period in days"
    )
    termination_reason = models.TextField(blank=True, default="")

    # Legal
    governing_law_country = models.CharField(
        max_length=100,
        blank=True,
        default=""
    )

    # Intragroup
    is_intragroup = models.BooleanField(
        default=False,
        help_text="Contract within same corporate group"
    )

    # Evidence (UUIDs)
    evidence_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Related evidence UUIDs"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Contract"
        verbose_name_plural = "Contracts"
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.name} ({self.provider.name})"

    @property
    def is_expired(self):
        from django.utils import timezone
        if self.end_date:
            return self.end_date < timezone.now().date()
        return False


class EntityAssessment(models.Model):
    """
    An assessment of an entity's risk profile.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Entity being assessed
    entity = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='assessments'
    )

    # Assessment metrics
    criticality = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )
    dependency = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )
    penetration = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )
    maturity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )
    trust = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )

    # Conclusion
    class AssessmentConclusion(models.TextChoices):
        BLOCKER = 'blocker', 'Blocker'
        WARNING = 'warning', 'Warning'
        OK = 'ok', 'OK'
        NOT_APPLICABLE = 'not_applicable', 'Not Applicable'

    conclusion = models.CharField(
        max_length=20,
        choices=AssessmentConclusion.choices,
        default=AssessmentConclusion.OK
    )

    # Related solutions
    solutions = models.ManyToManyField(
        Solution,
        blank=True,
        related_name='assessments'
    )

    # Representatives involved
    representatives = models.ManyToManyField(
        Representative,
        blank=True,
        related_name='assessments'
    )

    # Evidence (UUIDs)
    evidence_ids = models.JSONField(
        default=list,
        blank=True
    )

    # Assessment date
    assessment_date = models.DateField(null=True, blank=True)
    next_assessment_date = models.DateField(null=True, blank=True)

    # Assessor
    assessor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_entity_assessments'
    )

    # Notes
    findings = models.TextField(blank=True, default="")
    recommendations = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Entity Assessment"
        verbose_name_plural = "Entity Assessments"
        ordering = ['-assessment_date']

    def __str__(self):
        return f"{self.entity.name} Assessment - {self.assessment_date}"

    @property
    def calculated_criticality(self) -> float:
        """Calculate criticality from assessment metrics."""
        denominator = self.maturity * self.trust
        if denominator == 0:
            return float('inf')
        return (self.dependency * self.penetration) / denominator
