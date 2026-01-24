"""
EBIOS RM Models - MIT Licensed

Clean-room implementation of EBIOS Risk Management models.
Copyright (c) 2026 Tash
"""

import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class EbiosRMStudy(models.Model):
    """
    An EBIOS RM risk study.

    The main container for an EBIOS risk assessment following
    the 5-workshop methodology.
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

    # Study status
    class StudyStatus(models.TextChoices):
        PLANNED = 'planned', 'Planned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        IN_REVIEW = 'in_review', 'In Review'
        DONE = 'done', 'Done'
        DEPRECATED = 'deprecated', 'Deprecated'

    status = models.CharField(
        max_length=20,
        choices=StudyStatus.choices,
        default=StudyStatus.PLANNED
    )

    # Quotation method
    class QuotationMethod(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        EXPRESS = 'express', 'Express'

    quotation_method = models.CharField(
        max_length=20,
        choices=QuotationMethod.choices,
        default=QuotationMethod.MANUAL
    )

    # Risk matrix reference (UUID to allow cross-module reference)
    risk_matrix_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Reference to risk matrix for scoring"
    )

    # Workshop metadata - tracks progress through 5 workshops
    workshop_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Workshop step statuses and metadata"
    )

    # Version tracking
    version = models.CharField(
        max_length=50,
        blank=True,
        default="1.0"
    )

    # Observations
    observation = models.TextField(
        blank=True,
        default="",
        help_text="General observations about the study"
    )

    # Ownership
    authors = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='authored_ebios_studies'
    )
    reviewers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='reviewed_ebios_studies'
    )

    # Dates
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "EBIOS RM Study"
        verbose_name_plural = "EBIOS RM Studies"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ref_id}: {self.name}" if self.ref_id else self.name

    def get_workshop_step_status(self, workshop: int, step: int) -> str:
        """Get status of a specific workshop step."""
        key = f"workshop_{workshop}_step_{step}"
        return self.workshop_metadata.get(key, 'not_started')

    def set_workshop_step_status(self, workshop: int, step: int, status: str):
        """Set status of a specific workshop step."""
        key = f"workshop_{workshop}_step_{step}"
        self.workshop_metadata[key] = status
        self.save(update_fields=['workshop_metadata'])


class FearedEvent(models.Model):
    """
    A feared event in the EBIOS study.

    Feared events represent potential security incidents
    that the organization wants to prevent.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    study = models.ForeignKey(
        EbiosRMStudy,
        on_delete=models.CASCADE,
        related_name='feared_events'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Gravity/Impact rating (1-5 scale)
    gravity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Impact severity (1-5)"
    )

    # Selection for further analysis
    is_selected = models.BooleanField(
        default=False,
        help_text="Whether this event is selected for detailed analysis"
    )
    selection_justification = models.TextField(
        blank=True,
        default="",
        help_text="Justification for selection/deselection"
    )

    # Related assets (UUIDs for cross-module reference)
    asset_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="List of asset UUIDs affected by this event"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Feared Event"
        verbose_name_plural = "Feared Events"
        ordering = ['-gravity', 'name']

    def __str__(self):
        return f"{self.ref_id}: {self.name}" if self.ref_id else self.name


class RiskOrigin(models.Model):
    """
    A risk origin (threat source).

    Risk origins represent the sources of threats
    that could trigger feared events.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    study = models.ForeignKey(
        EbiosRMStudy,
        on_delete=models.CASCADE,
        related_name='risk_origins'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Origin characteristics
    class OriginCategory(models.TextChoices):
        STATE_SPONSORED = 'state_sponsored', 'State-Sponsored'
        ORGANIZED_CRIME = 'organized_crime', 'Organized Crime'
        TERRORIST = 'terrorist', 'Terrorist'
        ACTIVIST = 'activist', 'Activist/Hacktivist'
        COMPETITOR = 'competitor', 'Competitor'
        INSIDER = 'insider', 'Insider'
        OPPORTUNIST = 'opportunist', 'Opportunist'
        OTHER = 'other', 'Other'

    category = models.CharField(
        max_length=20,
        choices=OriginCategory.choices,
        default=OriginCategory.OTHER
    )

    # Motivation level
    class MotivationLevel(models.TextChoices):
        UNDEFINED = 'undefined', 'Undefined'
        VERY_LOW = 'very_low', 'Very Low'
        LOW = 'low', 'Low'
        SIGNIFICANT = 'significant', 'Significant'
        STRONG = 'strong', 'Strong'

    motivation = models.CharField(
        max_length=20,
        choices=MotivationLevel.choices,
        default=MotivationLevel.UNDEFINED
    )

    # Resources available to the threat actor
    class ResourceLevel(models.TextChoices):
        UNDEFINED = 'undefined', 'Undefined'
        LIMITED = 'limited', 'Limited'
        SIGNIFICANT = 'significant', 'Significant'
        IMPORTANT = 'important', 'Important'
        UNLIMITED = 'unlimited', 'Unlimited'

    resources = models.CharField(
        max_length=20,
        choices=ResourceLevel.choices,
        default=ResourceLevel.UNDEFINED
    )

    # Activity level
    activity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        help_text="Activity level (1-4)"
    )

    is_selected = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Risk Origin"
        verbose_name_plural = "Risk Origins"
        ordering = ['name']

    def __str__(self):
        return self.name


class TargetObjective(models.Model):
    """
    A target objective for risk origins.

    Target objectives represent what attackers want to achieve.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    study = models.ForeignKey(
        EbiosRMStudy,
        on_delete=models.CASCADE,
        related_name='target_objectives'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    is_selected = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Target Objective"
        verbose_name_plural = "Target Objectives"
        ordering = ['name']

    def __str__(self):
        return self.name


class RoTo(models.Model):
    """
    Risk Origin / Target Objective couple.

    RoTo represents the combination of who (risk origin)
    wants what (target objective).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    study = models.ForeignKey(
        EbiosRMStudy,
        on_delete=models.CASCADE,
        related_name='rotos'
    )
    risk_origin = models.ForeignKey(
        RiskOrigin,
        on_delete=models.CASCADE,
        related_name='rotos'
    )
    target_objective = models.ForeignKey(
        TargetObjective,
        on_delete=models.CASCADE,
        related_name='rotos'
    )

    # Related feared events
    feared_events = models.ManyToManyField(
        FearedEvent,
        blank=True,
        related_name='rotos'
    )

    # Pertinence/relevance score
    pertinence = models.PositiveSmallIntegerField(
        default=0,
        validators=[MaxValueValidator(16)],
        help_text="Calculated pertinence score"
    )

    # Activity level override
    activity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)]
    )

    is_selected = models.BooleanField(default=False)
    justification = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "RoTo"
        verbose_name_plural = "RoTos"
        unique_together = [['study', 'risk_origin', 'target_objective']]

    def __str__(self):
        return f"{self.risk_origin.name} → {self.target_objective.name}"

    def calculate_pertinence(self) -> int:
        """
        Calculate pertinence based on motivation, resources, and activity.

        Pertinence matrix based on EBIOS RM methodology.
        """
        # Get motivation and resource scores
        motivation_scores = {
            'undefined': 0, 'very_low': 1, 'low': 2,
            'significant': 3, 'strong': 4
        }
        resource_scores = {
            'undefined': 0, 'limited': 1, 'significant': 2,
            'important': 3, 'unlimited': 4
        }

        m_score = motivation_scores.get(self.risk_origin.motivation, 0)
        r_score = resource_scores.get(self.risk_origin.resources, 0)

        # Base pertinence from motivation × resources
        base = m_score * r_score

        # Adjust by activity level
        self.pertinence = min(base * self.activity // 4, 16)
        return self.pertinence


class Stakeholder(models.Model):
    """
    A stakeholder in the ecosystem.

    Stakeholders can be used as attack vectors or be
    affected by security incidents.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    study = models.ForeignKey(
        EbiosRMStudy,
        on_delete=models.CASCADE,
        related_name='stakeholders'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Stakeholder category
    class StakeholderCategory(models.TextChoices):
        PARTNER = 'partner', 'Partner'
        SUPPLIER = 'supplier', 'Supplier'
        CLIENT = 'client', 'Client'
        SUBCONTRACTOR = 'subcontractor', 'Subcontractor'
        SERVICE_PROVIDER = 'service_provider', 'Service Provider'
        INTERNAL = 'internal', 'Internal'
        OTHER = 'other', 'Other'

    category = models.CharField(
        max_length=20,
        choices=StakeholderCategory.choices,
        default=StakeholderCategory.OTHER
    )

    # Entity reference (UUID for third-party entity)
    entity_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Reference to entity in TPRM"
    )

    # Current state metrics (1-4 scale)
    current_dependency = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        help_text="How dependent the organization is on this stakeholder"
    )
    current_penetration = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        help_text="Level of system/data access"
    )
    current_maturity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        help_text="Security maturity level"
    )
    current_trust = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(4)],
        help_text="Trust level"
    )

    # Residual state metrics (after controls)
    residual_dependency = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(4)])
    residual_penetration = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(4)])
    residual_maturity = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(4)])
    residual_trust = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(4)])

    # Applied controls (UUIDs)
    applied_control_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Applied controls for this stakeholder"
    )

    is_selected = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Stakeholder"
        verbose_name_plural = "Stakeholders"
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def current_criticality(self) -> float:
        """
        Calculate current criticality.

        Formula: (dependency × penetration) / (maturity × trust)
        """
        denominator = self.current_maturity * self.current_trust
        if denominator == 0:
            return float('inf')
        return (self.current_dependency * self.current_penetration) / denominator

    @property
    def residual_criticality(self) -> float:
        """Calculate residual criticality after controls."""
        denominator = self.residual_maturity * self.residual_trust
        if denominator == 0:
            return float('inf')
        return (self.residual_dependency * self.residual_penetration) / denominator


class StrategicScenario(models.Model):
    """
    A strategic attack scenario.

    Strategic scenarios describe high-level attack strategies
    combining risk origins, objectives, and feared events.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    study = models.ForeignKey(
        EbiosRMStudy,
        on_delete=models.CASCADE,
        related_name='strategic_scenarios'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Associated RoTo
    roto = models.ForeignKey(
        RoTo,
        on_delete=models.CASCADE,
        related_name='strategic_scenarios'
    )

    # Focused feared events
    feared_events = models.ManyToManyField(
        FearedEvent,
        blank=True,
        related_name='strategic_scenarios'
    )

    # Gravity (max gravity of associated feared events)
    gravity = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    is_selected = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Strategic Scenario"
        verbose_name_plural = "Strategic Scenarios"
        ordering = ['-gravity', 'name']

    def __str__(self):
        return f"{self.ref_id}: {self.name}" if self.ref_id else self.name

    def calculate_gravity(self):
        """Calculate gravity from associated feared events."""
        max_gravity = self.feared_events.aggregate(
            max_g=models.Max('gravity')
        )['max_g']
        self.gravity = max_gravity or 1
        return self.gravity


class AttackPath(models.Model):
    """
    An attack path through stakeholders.

    Attack paths describe how an attacker might traverse
    through stakeholders to reach their objective.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    strategic_scenario = models.ForeignKey(
        StrategicScenario,
        on_delete=models.CASCADE,
        related_name='attack_paths'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Stakeholders involved in this attack path
    stakeholders = models.ManyToManyField(
        Stakeholder,
        blank=True,
        related_name='attack_paths'
    )

    is_selected = models.BooleanField(default=False)
    justification = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Attack Path"
        verbose_name_plural = "Attack Paths"
        ordering = ['ref_id', 'name']

    def __str__(self):
        return f"{self.ref_id}: {self.name}" if self.ref_id else self.name


class ElementaryAction(models.Model):
    """
    An elementary action in the attack kill chain.

    Elementary actions represent specific steps an attacker
    would take during an attack.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    study = models.ForeignKey(
        EbiosRMStudy,
        on_delete=models.CASCADE,
        related_name='elementary_actions'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Attack stage (kill chain phase)
    class AttackStage(models.TextChoices):
        KNOW = 'know', 'Know (Reconnaissance)'
        ENTER = 'enter', 'Enter (Initial Access)'
        DISCOVER = 'discover', 'Discover (Discovery)'
        EXPLOIT = 'exploit', 'Exploit (Impact)'

    stage = models.CharField(
        max_length=20,
        choices=AttackStage.choices,
        default=AttackStage.KNOW
    )

    # Icon type for visualization
    class IconType(models.TextChoices):
        PHISHING = 'phishing', 'Phishing'
        MALWARE = 'malware', 'Malware'
        EXPLOIT = 'exploit', 'Exploit'
        SOCIAL = 'social', 'Social Engineering'
        PHYSICAL = 'physical', 'Physical Access'
        NETWORK = 'network', 'Network Attack'
        SUPPLY_CHAIN = 'supply_chain', 'Supply Chain'
        INSIDER = 'insider', 'Insider Threat'
        CREDENTIAL = 'credential', 'Credential Theft'
        LATERAL = 'lateral', 'Lateral Movement'
        EXFILTRATION = 'exfiltration', 'Data Exfiltration'
        DESTRUCTION = 'destruction', 'Data Destruction'
        RANSOMWARE = 'ransomware', 'Ransomware'
        DDOS = 'ddos', 'DDoS'
        DEFAULT = 'default', 'Default'

    icon_type = models.CharField(
        max_length=20,
        choices=IconType.choices,
        default=IconType.DEFAULT
    )

    # Threat reference (UUID)
    threat_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Reference to threat"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Elementary Action"
        verbose_name_plural = "Elementary Actions"
        ordering = ['stage', 'name']

    def __str__(self):
        return f"[{self.stage}] {self.name}"


class OperationalScenario(models.Model):
    """
    An operational attack scenario.

    Operational scenarios are concrete instantiations of
    attack paths with specific actions and likelihood.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    attack_path = models.ForeignKey(
        AttackPath,
        on_delete=models.CASCADE,
        related_name='operational_scenarios'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Likelihood rating (1-5)
    likelihood = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Likelihood of this scenario (1-5)"
    )

    # Threats leveraged (UUIDs)
    threat_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Threats leveraged in this scenario"
    )

    is_selected = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Operational Scenario"
        verbose_name_plural = "Operational Scenarios"
        ordering = ['-likelihood', 'name']

    def __str__(self):
        return f"{self.ref_id}: {self.name}" if self.ref_id else self.name

    @property
    def gravity(self):
        """Get gravity from strategic scenario."""
        return self.attack_path.strategic_scenario.gravity

    @property
    def risk_level(self) -> int:
        """Calculate risk level (likelihood × gravity)."""
        return self.likelihood * self.gravity


class KillChain(models.Model):
    """
    Attack kill chain definition.

    Kill chains provide a structured framework for categorizing
    attack stages (e.g., MITRE ATT&CK, Lockheed Martin Kill Chain).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Framework source
    class KillChainFramework(models.TextChoices):
        MITRE_ATTACK = 'mitre_attack', 'MITRE ATT&CK'
        LOCKHEED_MARTIN = 'lockheed_martin', 'Lockheed Martin'
        EBIOS_RM = 'ebios_rm', 'EBIOS RM (Know/Enter/Discover/Exploit)'
        CUSTOM = 'custom', 'Custom'

    framework = models.CharField(
        max_length=20,
        choices=KillChainFramework.choices,
        default=KillChainFramework.EBIOS_RM
    )

    # Stages defined in JSON format
    # e.g., [{"id": "recon", "name": "Reconnaissance", "order": 1}, ...]
    stages = models.JSONField(
        default=list,
        help_text="Kill chain stages in order"
    )

    # Organization scope (null = global/template)
    organization_id = models.UUIDField(
        null=True,
        blank=True,
        db_index=True
    )

    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is a default kill chain"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Kill Chain"
        verbose_name_plural = "Kill Chains"
        ordering = ['name']

    def __str__(self):
        return self.name

    @classmethod
    def get_ebios_default(cls):
        """Get the default EBIOS RM kill chain."""
        return {
            'name': 'EBIOS RM Kill Chain',
            'framework': 'ebios_rm',
            'stages': [
                {'id': 'know', 'name': 'Know (Reconnaissance)', 'order': 1},
                {'id': 'enter', 'name': 'Enter (Initial Access)', 'order': 2},
                {'id': 'discover', 'name': 'Discover (Discovery)', 'order': 3},
                {'id': 'exploit', 'name': 'Exploit (Impact)', 'order': 4},
            ]
        }

    @classmethod
    def get_mitre_attack_default(cls):
        """Get the default MITRE ATT&CK kill chain."""
        return {
            'name': 'MITRE ATT&CK',
            'framework': 'mitre_attack',
            'stages': [
                {'id': 'reconnaissance', 'name': 'Reconnaissance', 'order': 1},
                {'id': 'resource_development', 'name': 'Resource Development', 'order': 2},
                {'id': 'initial_access', 'name': 'Initial Access', 'order': 3},
                {'id': 'execution', 'name': 'Execution', 'order': 4},
                {'id': 'persistence', 'name': 'Persistence', 'order': 5},
                {'id': 'privilege_escalation', 'name': 'Privilege Escalation', 'order': 6},
                {'id': 'defense_evasion', 'name': 'Defense Evasion', 'order': 7},
                {'id': 'credential_access', 'name': 'Credential Access', 'order': 8},
                {'id': 'discovery', 'name': 'Discovery', 'order': 9},
                {'id': 'lateral_movement', 'name': 'Lateral Movement', 'order': 10},
                {'id': 'collection', 'name': 'Collection', 'order': 11},
                {'id': 'command_and_control', 'name': 'Command and Control', 'order': 12},
                {'id': 'exfiltration', 'name': 'Exfiltration', 'order': 13},
                {'id': 'impact', 'name': 'Impact', 'order': 14},
            ]
        }


class OperatingMode(models.Model):
    """
    An operating mode for an operational scenario.

    Operating modes describe specific ways an operational
    scenario could be executed.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    operational_scenario = models.ForeignKey(
        OperationalScenario,
        on_delete=models.CASCADE,
        related_name='operating_modes'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Elementary actions in this mode
    elementary_actions = models.ManyToManyField(
        ElementaryAction,
        blank=True,
        related_name='operating_modes'
    )

    # Likelihood for this specific mode
    likelihood = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Operating Mode"
        verbose_name_plural = "Operating Modes"
        ordering = ['-likelihood', 'name']

    def __str__(self):
        return f"{self.ref_id}: {self.name}" if self.ref_id else self.name

    def save(self, *args, **kwargs):
        """Update parent scenario likelihood if using express method."""
        super().save(*args, **kwargs)

        # Check if study uses express quotation
        study = self.operational_scenario.attack_path.strategic_scenario.roto.study
        if study.quotation_method == 'express':
            # Update operational scenario with max likelihood from modes
            max_likelihood = self.operational_scenario.operating_modes.aggregate(
                max_l=models.Max('likelihood')
            )['max_l']
            if max_likelihood:
                self.operational_scenario.likelihood = max_likelihood
                self.operational_scenario.save(update_fields=['likelihood'])
