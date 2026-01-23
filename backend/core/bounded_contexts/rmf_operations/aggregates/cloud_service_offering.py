"""
CloudServiceOffering Aggregate

Represents a Cloud Service Offering (CSO) undergoing FedRAMP 20x authorization.
This is the main aggregate root for FedRAMP 20x continuous authorization tracking.
"""

import uuid
from typing import Optional, List, Dict, Any
from django.db import models
from django.utils import timezone

from core.domain.aggregate import AggregateRoot
from core.domain.fields import EmbeddedIdArrayField


class CloudServiceOffering(AggregateRoot):
    """
    Cloud Service Offering aggregate.

    Represents a CSO undergoing FedRAMP 20x authorization. Tracks authorization
    status, Key Security Indicators, and continuous monitoring activities.
    """

    class AuthorizationStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        READY = "ready", "FedRAMP Ready"
        IN_PROCESS = "in_process", "In Process"
        AUTHORIZED = "authorized", "FedRAMP Authorized"
        REVOKED = "revoked", "Authorization Revoked"
        WITHDRAWN = "withdrawn", "Withdrawn"

    class ImpactLevel(models.TextChoices):
        LOW = "low", "Low"
        MODERATE = "moderate", "Moderate"
        HIGH = "high", "High"

    class DeploymentModel(models.TextChoices):
        PUBLIC = "public", "Public Cloud"
        PRIVATE = "private", "Private Cloud"
        COMMUNITY = "community", "Community Cloud"
        HYBRID = "hybrid", "Hybrid Cloud"
        GOVERNMENT = "government", "Government-Only Cloud"

    # Identity and core fields
    name = models.CharField(max_length=255, db_index=True, help_text="CSO name")
    description = models.TextField(blank=True, null=True, help_text="CSO description")
    service_model = models.CharField(
        max_length=20,
        choices=[("IaaS", "Infrastructure as a Service"),
                 ("PaaS", "Platform as a Service"),
                 ("SaaS", "Software as a Service")],
        default="SaaS",
        help_text="Cloud service model"
    )
    deployment_model = models.CharField(
        max_length=20,
        choices=DeploymentModel.choices,
        default=DeploymentModel.PUBLIC,
        help_text="Cloud deployment model"
    )

    # Authorization tracking
    authorization_status = models.CharField(
        max_length=20,
        choices=AuthorizationStatus.choices,
        default=AuthorizationStatus.DRAFT,
        db_index=True,
        help_text="Current FedRAMP authorization status"
    )
    impact_level = models.CharField(
        max_length=20,
        choices=ImpactLevel.choices,
        default=ImpactLevel.MODERATE,
        help_text="FedRAMP impact level"
    )

    # Authorization dates
    authorization_date = models.DateField(
        null=True, blank=True,
        help_text="Date of FedRAMP authorization"
    )
    authorization_expiration = models.DateField(
        null=True, blank=True,
        help_text="Authorization expiration date"
    )
    last_assessment_date = models.DateField(
        null=True, blank=True,
        help_text="Date of last assessment"
    )
    next_assessment_date = models.DateField(
        null=True, blank=True,
        help_text="Scheduled next assessment date"
    )

    # FedRAMP 20x specific fields
    fedramp_package_id = models.CharField(
        max_length=100, blank=True, null=True, unique=True,
        help_text="Official FedRAMP package identifier"
    )
    marketplace_listing_url = models.URLField(
        blank=True, null=True,
        help_text="FedRAMP Marketplace listing URL"
    )

    # Authorization boundary
    authorization_boundary = models.JSONField(
        default=dict, blank=True,
        help_text="Authorization boundary definition including components and data flows"
    )
    data_centers = models.JSONField(
        default=list, blank=True,
        help_text="List of data center regions/locations"
    )
    leveraged_services = models.JSONField(
        default=list, blank=True,
        help_text="Leveraged FedRAMP authorized services"
    )

    # Agency sponsors
    sponsoring_agencies = models.JSONField(
        default=list, blank=True,
        help_text="List of sponsoring federal agencies"
    )
    initial_sponsor = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Initial authorizing agency"
    )

    # 3PAO information
    third_party_assessment_org = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Third Party Assessment Organization (3PAO)"
    )
    last_3pao_assessment_date = models.DateField(
        null=True, blank=True,
        help_text="Date of last 3PAO assessment"
    )

    # KSI tracking (computed fields)
    total_ksi_count = models.IntegerField(default=0, help_text="Total number of applicable KSIs")
    compliant_ksi_count = models.IntegerField(default=0, help_text="Number of compliant KSIs")
    ksi_compliance_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Overall KSI compliance percentage"
    )
    persistent_validation_coverage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Percentage of KSIs with automated persistent validation (target: 70%+)"
    )

    # Relationships
    compliance_assessment_ids = EmbeddedIdArrayField(
        help_text="Array of linked compliance assessment IDs"
    )
    system_group_id = models.UUIDField(
        null=True, blank=True,
        help_text="Linked SystemGroup for RMF operations"
    )
    perimeter_id = models.UUIDField(
        null=True, blank=True,
        help_text="Linked Perimeter from CISO Assistant core"
    )

    # Metadata
    tags = models.JSONField(default=list, blank=True, help_text="CSO tags")
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional metadata")

    class Meta:
        db_table = 'fedramp_cloud_service_offerings'
        verbose_name = 'Cloud Service Offering'
        verbose_name_plural = 'Cloud Service Offerings'
        ordering = ['name']
        indexes = [
            models.Index(fields=['authorization_status', 'impact_level']),
            models.Index(fields=['fedramp_package_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"CSO({self.id}): {self.name} [{self.authorization_status}]"

    # Factory method
    @classmethod
    def create(cls, name: str, description: str = None, impact_level: str = None,
               service_model: str = "SaaS", created_by: uuid.UUID = None) -> 'CloudServiceOffering':
        """Create a new Cloud Service Offering"""
        cso = cls()
        cso.name = name
        cso.description = description
        cso.impact_level = impact_level or cls.ImpactLevel.MODERATE
        cso.service_model = service_model
        cso.authorization_status = cls.AuthorizationStatus.DRAFT
        cso.created_by = created_by

        from ..domain_events import CloudServiceOfferingCreated
        cso._raise_event(CloudServiceOfferingCreated(
            aggregate_id=cso.id,
            name=name,
            impact_level=cso.impact_level
        ))

        return cso

    # Business methods
    def submit_for_authorization(self) -> None:
        """Submit CSO for FedRAMP authorization process"""
        if self.authorization_status not in [self.AuthorizationStatus.DRAFT, self.AuthorizationStatus.READY]:
            raise ValueError("CSO must be in DRAFT or READY status to submit for authorization")

        self.authorization_status = self.AuthorizationStatus.IN_PROCESS

        from ..domain_events import CSOSubmittedForAuthorization
        self._raise_event(CSOSubmittedForAuthorization(
            aggregate_id=self.id,
            name=self.name,
            impact_level=self.impact_level
        ))

    def grant_authorization(self, authorization_date=None, package_id: str = None,
                           sponsor: str = None) -> None:
        """Grant FedRAMP authorization to the CSO"""
        if self.authorization_status != self.AuthorizationStatus.IN_PROCESS:
            raise ValueError("CSO must be IN_PROCESS to grant authorization")

        self.authorization_status = self.AuthorizationStatus.AUTHORIZED
        self.authorization_date = authorization_date or timezone.now().date()
        self.fedramp_package_id = package_id
        self.initial_sponsor = sponsor

        # Set next assessment date (annual)
        from datetime import timedelta
        self.next_assessment_date = self.authorization_date + timedelta(days=365)

        if sponsor and sponsor not in self.sponsoring_agencies:
            self.sponsoring_agencies.append(sponsor)

        from ..domain_events import CSOAuthorizationGranted
        self._raise_event(CSOAuthorizationGranted(
            aggregate_id=self.id,
            name=self.name,
            authorization_date=self.authorization_date,
            package_id=package_id
        ))

    def revoke_authorization(self, reason: str = None) -> None:
        """Revoke FedRAMP authorization"""
        if self.authorization_status != self.AuthorizationStatus.AUTHORIZED:
            raise ValueError("CSO must be AUTHORIZED to revoke")

        self.authorization_status = self.AuthorizationStatus.REVOKED

        from ..domain_events import CSOAuthorizationRevoked
        self._raise_event(CSOAuthorizationRevoked(
            aggregate_id=self.id,
            name=self.name,
            reason=reason
        ))

    def update_ksi_metrics(self, total: int, compliant: int, validation_coverage: float) -> None:
        """Update KSI compliance metrics"""
        self.total_ksi_count = total
        self.compliant_ksi_count = compliant
        self.ksi_compliance_percentage = (compliant / max(total, 1)) * 100
        self.persistent_validation_coverage = validation_coverage

        from ..domain_events import CSOKSIMetricsUpdated
        self._raise_event(CSOKSIMetricsUpdated(
            aggregate_id=self.id,
            name=self.name,
            compliant_count=compliant,
            total_count=total,
            compliance_percentage=float(self.ksi_compliance_percentage)
        ))

    def record_assessment(self, assessment_date=None, assessor: str = None) -> None:
        """Record a completed assessment"""
        self.last_assessment_date = assessment_date or timezone.now().date()
        self.last_3pao_assessment_date = self.last_assessment_date if assessor else None
        self.third_party_assessment_org = assessor

        # Update next assessment date
        from datetime import timedelta
        self.next_assessment_date = self.last_assessment_date + timedelta(days=365)

    def add_sponsor(self, agency_name: str) -> None:
        """Add a sponsoring agency"""
        if agency_name not in self.sponsoring_agencies:
            self.sponsoring_agencies.append(agency_name)

    def add_leveraged_service(self, service_name: str, package_id: str = None) -> None:
        """Add a leveraged FedRAMP authorized service"""
        self.leveraged_services.append({
            'name': service_name,
            'package_id': package_id,
            'added_at': timezone.now().isoformat()
        })

    # Query methods
    def is_authorized(self) -> bool:
        """Check if CSO is currently authorized"""
        return self.authorization_status == self.AuthorizationStatus.AUTHORIZED

    def meets_validation_coverage_target(self) -> bool:
        """Check if CSO meets 70% persistent validation coverage target"""
        return self.persistent_validation_coverage >= 70

    def get_ksi_status_summary(self) -> Dict[str, Any]:
        """Get summary of KSI compliance status"""
        return {
            'total': self.total_ksi_count,
            'compliant': self.compliant_ksi_count,
            'non_compliant': self.total_ksi_count - self.compliant_ksi_count,
            'compliance_percentage': float(self.ksi_compliance_percentage),
            'validation_coverage': float(self.persistent_validation_coverage),
            'meets_validation_target': self.meets_validation_coverage_target()
        }
