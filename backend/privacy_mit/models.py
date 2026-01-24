"""
Privacy Management Models - MIT Licensed

Clean-room implementation of privacy management for GDPR/data protection.
Copyright (c) 2026 Tash
"""

import uuid
from django.db import models
from django.conf import settings


class ProcessingNature(models.Model):
    """
    Nature and purpose of data processing.

    Defines the lawful basis and purpose for processing personal data,
    supporting GDPR Article 6 and Article 9 compliance.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the processing nature"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of this processing nature"
    )

    # Lawful basis (GDPR Article 6)
    class LawfulBasis(models.TextChoices):
        CONSENT = 'consent', 'Consent (Art. 6(1)(a))'
        CONTRACT = 'contract', 'Contract (Art. 6(1)(b))'
        LEGAL_OBLIGATION = 'legal_obligation', 'Legal Obligation (Art. 6(1)(c))'
        VITAL_INTERESTS = 'vital_interests', 'Vital Interests (Art. 6(1)(d))'
        PUBLIC_TASK = 'public_task', 'Public Task (Art. 6(1)(e))'
        LEGITIMATE_INTERESTS = 'legitimate_interests', 'Legitimate Interests (Art. 6(1)(f))'

    lawful_basis = models.CharField(
        max_length=25,
        choices=LawfulBasis.choices,
        default=LawfulBasis.CONSENT,
        help_text="Lawful basis for processing"
    )

    # Special categories (GDPR Article 9)
    is_special_category = models.BooleanField(
        default=False,
        help_text="Whether this involves special category data"
    )
    special_category_basis = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Basis for processing special category data"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Processing Nature"
        verbose_name_plural = "Processing Natures"
        ordering = ['name']

    def __str__(self):
        return self.name


class DataSubject(models.Model):
    """
    Category of data subjects.

    Represents categories of individuals whose personal data
    is processed (employees, customers, suppliers, etc.).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Category name (e.g., 'Employees', 'Customers')"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of this data subject category"
    )

    # Vulnerability status
    is_vulnerable = models.BooleanField(
        default=False,
        help_text="Whether this includes vulnerable individuals (children, etc.)"
    )
    vulnerability_notes = models.TextField(
        blank=True,
        default="",
        help_text="Notes on vulnerability considerations"
    )

    # Estimated count
    estimated_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Estimated number of data subjects in this category"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Data Subject"
        verbose_name_plural = "Data Subjects"
        ordering = ['name']

    def __str__(self):
        return self.name


class PersonalData(models.Model):
    """
    Category of personal data.

    Represents types of personal data processed
    (name, email, health data, etc.).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Data category name"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of this data category"
    )

    # Data classification
    class DataCategory(models.TextChoices):
        BASIC = 'basic', 'Basic Personal Data'
        CONTACT = 'contact', 'Contact Information'
        FINANCIAL = 'financial', 'Financial Data'
        EMPLOYMENT = 'employment', 'Employment Data'
        BEHAVIORAL = 'behavioral', 'Behavioral Data'
        LOCATION = 'location', 'Location Data'
        DEVICE = 'device', 'Device/Technical Data'
        HEALTH = 'health', 'Health Data (Special)'
        BIOMETRIC = 'biometric', 'Biometric Data (Special)'
        GENETIC = 'genetic', 'Genetic Data (Special)'
        RACIAL_ETHNIC = 'racial_ethnic', 'Racial/Ethnic Origin (Special)'
        POLITICAL = 'political', 'Political Opinions (Special)'
        RELIGIOUS = 'religious', 'Religious/Philosophical Beliefs (Special)'
        UNION = 'union', 'Trade Union Membership (Special)'
        SEX_LIFE = 'sex_life', 'Sex Life/Orientation (Special)'
        CRIMINAL = 'criminal', 'Criminal Data'

    category = models.CharField(
        max_length=20,
        choices=DataCategory.choices,
        default=DataCategory.BASIC
    )

    # Sensitivity
    is_special_category = models.BooleanField(
        default=False,
        help_text="Whether this is special category data (Art. 9)"
    )
    is_criminal_data = models.BooleanField(
        default=False,
        help_text="Whether this is criminal conviction data (Art. 10)"
    )

    # Retention
    retention_period = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Retention period for this data"
    )
    retention_justification = models.TextField(
        blank=True,
        default="",
        help_text="Justification for retention period"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Personal Data"
        verbose_name_plural = "Personal Data"
        ordering = ['name']

    def __str__(self):
        return self.name


class DataRecipient(models.Model):
    """
    Recipient of personal data.

    Represents entities that receive personal data
    (internal departments, external parties, etc.).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Recipient name"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of the recipient"
    )

    # Recipient type
    class RecipientType(models.TextChoices):
        INTERNAL = 'internal', 'Internal Department'
        CONTROLLER = 'controller', 'Data Controller'
        PROCESSOR = 'processor', 'Data Processor'
        AUTHORITY = 'authority', 'Supervisory Authority'
        LEGAL = 'legal', 'Legal Requirement'
        OTHER = 'other', 'Other'

    recipient_type = models.CharField(
        max_length=20,
        choices=RecipientType.choices,
        default=RecipientType.INTERNAL
    )

    # Contact information
    contact_email = models.EmailField(
        blank=True,
        default=""
    )
    contact_phone = models.CharField(
        max_length=50,
        blank=True,
        default=""
    )

    # Third country transfer
    is_third_country = models.BooleanField(
        default=False,
        help_text="Whether recipient is in a third country"
    )
    country = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Country where recipient is located"
    )

    # Safeguards
    safeguards = models.TextField(
        blank=True,
        default="",
        help_text="Safeguards for data transfer"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Data Recipient"
        verbose_name_plural = "Data Recipients"
        ordering = ['name']

    def __str__(self):
        return self.name


class DataContractor(models.Model):
    """
    Data processor or sub-processor.

    Represents third parties that process personal data
    on behalf of the controller.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Contractor name"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of processing services"
    )

    # Contractor type
    class ContractorType(models.TextChoices):
        PROCESSOR = 'processor', 'Data Processor'
        SUB_PROCESSOR = 'sub_processor', 'Sub-Processor'
        JOINT_CONTROLLER = 'joint_controller', 'Joint Controller'

    contractor_type = models.CharField(
        max_length=20,
        choices=ContractorType.choices,
        default=ContractorType.PROCESSOR
    )

    # Contact information
    contact_name = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )
    contact_email = models.EmailField(
        blank=True,
        default=""
    )
    contact_phone = models.CharField(
        max_length=50,
        blank=True,
        default=""
    )

    # Location
    country = models.CharField(
        max_length=100,
        blank=True,
        default=""
    )
    is_third_country = models.BooleanField(
        default=False,
        help_text="Whether located in a third country"
    )

    # Contract details
    contract_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Reference to DPA or contract"
    )
    contract_start_date = models.DateField(
        null=True,
        blank=True
    )
    contract_end_date = models.DateField(
        null=True,
        blank=True
    )

    # Security measures
    security_measures = models.TextField(
        blank=True,
        default="",
        help_text="Technical and organizational measures"
    )

    # Audit
    last_audit_date = models.DateField(
        null=True,
        blank=True
    )
    audit_notes = models.TextField(
        blank=True,
        default=""
    )

    # Status
    is_active = models.BooleanField(
        default=True
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Data Contractor"
        verbose_name_plural = "Data Contractors"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_contractor_type_display()})"


class Processing(models.Model):
    """
    A data processing activity (Record of Processing Activities).

    Implements GDPR Article 30 requirements for maintaining
    records of processing activities.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the processing activity"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Description of the processing activity"
    )

    # Controller information
    controller_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Data controller name"
    )
    controller_contact = models.TextField(
        blank=True,
        default="",
        help_text="Controller contact details"
    )
    dpo_contact = models.TextField(
        blank=True,
        default="",
        help_text="Data Protection Officer contact"
    )

    # Processing details
    processing_natures = models.ManyToManyField(
        ProcessingNature,
        blank=True,
        related_name='processings',
        help_text="Purposes/natures of processing"
    )

    # Data subjects and data categories
    data_subjects = models.ManyToManyField(
        DataSubject,
        blank=True,
        related_name='processings',
        help_text="Categories of data subjects"
    )
    personal_data = models.ManyToManyField(
        PersonalData,
        blank=True,
        related_name='processings',
        help_text="Categories of personal data processed"
    )

    # Recipients
    recipients = models.ManyToManyField(
        DataRecipient,
        blank=True,
        related_name='processings',
        help_text="Recipients of personal data"
    )

    # Processors
    contractors = models.ManyToManyField(
        DataContractor,
        blank=True,
        related_name='processings',
        help_text="Data processors involved"
    )

    # Security measures
    security_measures = models.TextField(
        blank=True,
        default="",
        help_text="Technical and organizational security measures"
    )

    # Status
    class ProcessingStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        UNDER_REVIEW = 'under_review', 'Under Review'
        SUSPENDED = 'suspended', 'Suspended'
        TERMINATED = 'terminated', 'Terminated'

    status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.DRAFT
    )

    # DPIA requirement
    requires_dpia = models.BooleanField(
        default=False,
        help_text="Whether a DPIA is required"
    )
    dpia_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Reference to DPIA document"
    )

    # Ownership
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_processings'
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Processing Activity"
        verbose_name_plural = "Processing Activities"
        ordering = ['name']

    def __str__(self):
        return self.name


class DataTransfer(models.Model):
    """
    Cross-border data transfer.

    Represents transfers of personal data to third countries
    or international organizations.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Transfer name/description"
    )
    description = models.TextField(
        blank=True,
        default=""
    )

    # Related processing
    processing = models.ForeignKey(
        Processing,
        on_delete=models.CASCADE,
        related_name='transfers',
        help_text="Related processing activity"
    )

    # Destination
    destination_country = models.CharField(
        max_length=100,
        help_text="Destination country"
    )
    destination_entity = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Receiving entity"
    )

    # Transfer mechanism
    class TransferMechanism(models.TextChoices):
        ADEQUACY = 'adequacy', 'Adequacy Decision'
        SCCS = 'sccs', 'Standard Contractual Clauses'
        BCRS = 'bcrs', 'Binding Corporate Rules'
        DEROGATION = 'derogation', 'Derogation (Art. 49)'
        CERTIFICATION = 'certification', 'Approved Certification'
        CODE_OF_CONDUCT = 'code_of_conduct', 'Code of Conduct'
        OTHER = 'other', 'Other Safeguard'

    transfer_mechanism = models.CharField(
        max_length=20,
        choices=TransferMechanism.choices,
        default=TransferMechanism.SCCS
    )
    mechanism_details = models.TextField(
        blank=True,
        default="",
        help_text="Details of the transfer mechanism"
    )

    # Supplementary measures (Schrems II)
    supplementary_measures = models.TextField(
        blank=True,
        default="",
        help_text="Supplementary measures applied"
    )

    # Transfer Impact Assessment
    tia_completed = models.BooleanField(
        default=False,
        help_text="Whether TIA has been completed"
    )
    tia_reference = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )

    # Status
    is_active = models.BooleanField(
        default=True
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Data Transfer"
        verbose_name_plural = "Data Transfers"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} -> {self.destination_country}"


class RightRequest(models.Model):
    """
    Data Subject Access Request (DSAR).

    Tracks requests from data subjects exercising their
    rights under GDPR Articles 15-22.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Request identification
    reference_number = models.CharField(
        max_length=100,
        unique=True,
        help_text="Request reference number"
    )

    # Data subject information
    subject_name = models.CharField(
        max_length=255,
        help_text="Name of the data subject"
    )
    subject_email = models.EmailField(
        blank=True,
        default=""
    )
    subject_phone = models.CharField(
        max_length=50,
        blank=True,
        default=""
    )
    identity_verified = models.BooleanField(
        default=False,
        help_text="Whether identity has been verified"
    )
    verification_method = models.CharField(
        max_length=255,
        blank=True,
        default=""
    )

    # Request type
    class RequestType(models.TextChoices):
        ACCESS = 'access', 'Right of Access (Art. 15)'
        RECTIFICATION = 'rectification', 'Right to Rectification (Art. 16)'
        ERASURE = 'erasure', 'Right to Erasure (Art. 17)'
        RESTRICTION = 'restriction', 'Right to Restriction (Art. 18)'
        PORTABILITY = 'portability', 'Right to Portability (Art. 20)'
        OBJECTION = 'objection', 'Right to Object (Art. 21)'
        AUTOMATED = 'automated', 'Automated Decision-Making (Art. 22)'
        WITHDRAW_CONSENT = 'withdraw_consent', 'Withdrawal of Consent'

    request_type = models.CharField(
        max_length=20,
        choices=RequestType.choices,
        default=RequestType.ACCESS
    )

    # Request details
    request_description = models.TextField(
        help_text="Description of the request"
    )
    request_date = models.DateField(
        help_text="Date request was received"
    )
    due_date = models.DateField(
        help_text="Response due date (usually 1 month)"
    )

    # Extension
    extension_applied = models.BooleanField(
        default=False,
        help_text="Whether an extension was applied"
    )
    extended_due_date = models.DateField(
        null=True,
        blank=True
    )
    extension_reason = models.TextField(
        blank=True,
        default=""
    )

    # Status
    class RequestStatus(models.TextChoices):
        RECEIVED = 'received', 'Received'
        VERIFYING = 'verifying', 'Verifying Identity'
        PROCESSING = 'processing', 'Processing'
        PENDING_INFO = 'pending_info', 'Pending Information'
        COMPLETED = 'completed', 'Completed'
        REFUSED = 'refused', 'Refused'
        PARTIALLY_FULFILLED = 'partially_fulfilled', 'Partially Fulfilled'

    status = models.CharField(
        max_length=25,
        choices=RequestStatus.choices,
        default=RequestStatus.RECEIVED
    )

    # Response
    response_date = models.DateField(
        null=True,
        blank=True
    )
    response_summary = models.TextField(
        blank=True,
        default="",
        help_text="Summary of response provided"
    )
    refusal_reason = models.TextField(
        blank=True,
        default="",
        help_text="Reason if request was refused"
    )

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_right_requests'
    )

    # Notes
    internal_notes = models.TextField(
        blank=True,
        default=""
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Right Request"
        verbose_name_plural = "Right Requests"
        ordering = ['-request_date']

    def __str__(self):
        return f"{self.reference_number} - {self.get_request_type_display()}"

    @property
    def is_overdue(self):
        """Check if the request is overdue."""
        from django.utils import timezone
        due = self.extended_due_date if self.extension_applied else self.due_date
        if due and self.status not in ['completed', 'refused']:
            return timezone.now().date() > due
        return False


class DataBreach(models.Model):
    """
    Personal data breach.

    Tracks data breaches involving personal data,
    supporting GDPR Article 33/34 notification requirements.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(
        max_length=255,
        help_text="Breach title/name"
    )
    description = models.TextField(
        help_text="Description of the breach"
    )

    # Reference
    reference_number = models.CharField(
        max_length=100,
        unique=True,
        help_text="Breach reference number"
    )

    # Breach classification
    class BreachType(models.TextChoices):
        CONFIDENTIALITY = 'confidentiality', 'Confidentiality Breach'
        INTEGRITY = 'integrity', 'Integrity Breach'
        AVAILABILITY = 'availability', 'Availability Breach'
        COMBINED = 'combined', 'Combined Breach'

    breach_type = models.CharField(
        max_length=20,
        choices=BreachType.choices,
        default=BreachType.CONFIDENTIALITY
    )

    # Severity assessment
    class Severity(models.TextChoices):
        LOW = 'low', 'Low Risk'
        MEDIUM = 'medium', 'Medium Risk'
        HIGH = 'high', 'High Risk to Rights and Freedoms'
        CRITICAL = 'critical', 'Critical - Likely High Risk'

    severity = models.CharField(
        max_length=20,
        choices=Severity.choices,
        default=Severity.MEDIUM
    )

    # Timeline
    occurred_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the breach occurred"
    )
    discovered_at = models.DateTimeField(
        help_text="When the breach was discovered"
    )
    contained_at = models.DateTimeField(
        null=True,
        blank=True
    )
    resolved_at = models.DateTimeField(
        null=True,
        blank=True
    )

    # Impact assessment
    data_subjects_affected = models.PositiveIntegerField(
        default=0,
        help_text="Approximate number of data subjects affected"
    )
    records_affected = models.PositiveIntegerField(
        default=0,
        help_text="Approximate number of records affected"
    )
    data_categories_affected = models.ManyToManyField(
        PersonalData,
        blank=True,
        related_name='breaches',
        help_text="Categories of data affected"
    )
    consequences = models.TextField(
        blank=True,
        default="",
        help_text="Likely consequences of the breach"
    )

    # Root cause
    root_cause = models.TextField(
        blank=True,
        default="",
        help_text="Root cause of the breach"
    )

    # Containment and remediation
    containment_measures = models.TextField(
        blank=True,
        default="",
        help_text="Measures taken to contain the breach"
    )
    remediation_measures = models.TextField(
        blank=True,
        default="",
        help_text="Measures to remediate and prevent recurrence"
    )

    # Notification - Supervisory Authority (Art. 33)
    notify_authority = models.BooleanField(
        default=False,
        help_text="Whether SA notification is required"
    )
    authority_notified = models.BooleanField(
        default=False
    )
    authority_notification_date = models.DateTimeField(
        null=True,
        blank=True
    )
    authority_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="SA notification reference"
    )

    # Notification - Data Subjects (Art. 34)
    notify_subjects = models.BooleanField(
        default=False,
        help_text="Whether data subject notification is required"
    )
    subjects_notified = models.BooleanField(
        default=False
    )
    subjects_notification_date = models.DateTimeField(
        null=True,
        blank=True
    )
    notification_content = models.TextField(
        blank=True,
        default="",
        help_text="Content of notification to data subjects"
    )

    # Status
    class BreachStatus(models.TextChoices):
        DETECTED = 'detected', 'Detected'
        INVESTIGATING = 'investigating', 'Investigating'
        CONTAINED = 'contained', 'Contained'
        NOTIFYING = 'notifying', 'Notifying'
        REMEDIATING = 'remediating', 'Remediating'
        CLOSED = 'closed', 'Closed'

    status = models.CharField(
        max_length=20,
        choices=BreachStatus.choices,
        default=BreachStatus.DETECTED
    )

    # Assignment
    lead_handler = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='led_breaches'
    )

    # Related processing
    affected_processings = models.ManyToManyField(
        Processing,
        blank=True,
        related_name='breaches'
    )

    # Lessons learned
    lessons_learned = models.TextField(
        blank=True,
        default=""
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Data Breach"
        verbose_name_plural = "Data Breaches"
        ordering = ['-discovered_at']

    def __str__(self):
        return f"{self.reference_number} - {self.name}"

    @property
    def notification_deadline(self):
        """Calculate 72-hour notification deadline."""
        from datetime import timedelta
        if self.discovered_at:
            return self.discovered_at + timedelta(hours=72)
        return None

    @property
    def is_notification_overdue(self):
        """Check if SA notification is overdue."""
        from django.utils import timezone
        if self.notify_authority and not self.authority_notified:
            deadline = self.notification_deadline
            if deadline and timezone.now() > deadline:
                return True
        return False
