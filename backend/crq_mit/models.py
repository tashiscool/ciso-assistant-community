"""
CRQ Models - MIT Licensed

Clean-room implementation of Cyber Risk Quantification models.
Copyright (c) 2026 Tash
"""

import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class QuantitativeRiskStudy(models.Model):
    """
    A quantitative risk assessment study.

    Uses Monte Carlo simulation to model financial risk
    from cyber security scenarios.
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

    # Distribution model
    class DistributionModel(models.TextChoices):
        LOGNORMAL_CI90 = 'lognormal_ci90', 'Lognormal (90% CI)'
        LOGNORMAL_CI95 = 'lognormal_ci95', 'Lognormal (95% CI)'
        PERT = 'pert', 'PERT Distribution'

    distribution_model = models.CharField(
        max_length=20,
        choices=DistributionModel.choices,
        default=DistributionModel.LOGNORMAL_CI90
    )

    # Risk tolerance settings
    risk_tolerance = models.JSONField(
        default=dict,
        blank=True,
        help_text="Risk tolerance curve definition"
    )

    # Loss threshold for reporting
    loss_threshold = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Loss threshold for risk alerts"
    )

    # Currency
    currency = models.CharField(
        max_length=3,
        default="USD"
    )

    # Cached portfolio simulation results
    portfolio_simulation = models.JSONField(
        default=dict,
        blank=True,
        help_text="Cached portfolio simulation results"
    )
    simulation_timestamp = models.DateTimeField(
        null=True,
        blank=True
    )

    # Ownership
    authors = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='authored_crq_studies'
    )
    reviewers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='reviewed_crq_studies'
    )

    # Observations
    observation = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quantitative Risk Study"
        verbose_name_plural = "Quantitative Risk Studies"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ref_id}: {self.name}" if self.ref_id else self.name

    def invalidate_simulation(self):
        """Mark cached simulation as stale."""
        self.portfolio_simulation = {}
        self.simulation_timestamp = None
        self.save(update_fields=['portfolio_simulation', 'simulation_timestamp'])


class QuantitativeRiskScenario(models.Model):
    """
    A quantitative risk scenario within a study.

    Represents a specific risk scenario with financial
    impact estimates and probability distributions.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    study = models.ForeignKey(
        QuantitativeRiskStudy,
        on_delete=models.CASCADE,
        related_name='scenarios'
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    ref_id = models.CharField(max_length=100, blank=True, default="")

    # Priority
    class Priority(models.TextChoices):
        P1 = 'p1', 'P1 - Critical'
        P2 = 'p2', 'P2 - High'
        P3 = 'p3', 'P3 - Medium'
        P4 = 'p4', 'P4 - Low'

    priority = models.CharField(
        max_length=5,
        choices=Priority.choices,
        default=Priority.P3
    )

    # Status
    class ScenarioStatus(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        OPEN = 'open', 'Open'
        MITIGATE = 'mitigate', 'Mitigate'
        ACCEPT = 'accept', 'Accept'
        TRANSFER = 'transfer', 'Transfer'

    status = models.CharField(
        max_length=10,
        choices=ScenarioStatus.choices,
        default=ScenarioStatus.DRAFT
    )

    # Related entities (UUIDs)
    asset_ids = models.JSONField(default=list, blank=True)
    threat_ids = models.JSONField(default=list, blank=True)
    vulnerability_ids = models.JSONField(default=list, blank=True)
    owner_ids = models.JSONField(default=list, blank=True)

    # Selection for analysis
    is_selected = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quantitative Risk Scenario"
        verbose_name_plural = "Quantitative Risk Scenarios"
        ordering = ['priority', 'name']

    def __str__(self):
        return f"{self.ref_id}: {self.name}" if self.ref_id else self.name

    @property
    def current_ale(self):
        """Get current Annual Loss Expectancy."""
        try:
            current = self.hypotheses.get(stage='current')
            return current.get_ale()
        except QuantitativeRiskHypothesis.DoesNotExist:
            return None

    @property
    def residual_ale(self):
        """Get residual Annual Loss Expectancy."""
        try:
            residual = self.hypotheses.get(stage='residual')
            return residual.get_ale()
        except QuantitativeRiskHypothesis.DoesNotExist:
            return None


class QuantitativeRiskHypothesis(models.Model):
    """
    A risk hypothesis for a scenario.

    Represents the risk parameters at different stages:
    inherent (before any controls), current (with existing controls),
    or residual (with planned controls).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    scenario = models.ForeignKey(
        QuantitativeRiskScenario,
        on_delete=models.CASCADE,
        related_name='hypotheses'
    )

    # Risk stage
    class RiskStage(models.TextChoices):
        INHERENT = 'inherent', 'Inherent'
        CURRENT = 'current', 'Current'
        RESIDUAL = 'residual', 'Residual'

    stage = models.CharField(
        max_length=10,
        choices=RiskStage.choices,
        default=RiskStage.CURRENT
    )

    # Applied controls (UUIDs)
    # For current: existing controls
    # For residual: existing + added - removed
    existing_control_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Existing applied controls"
    )
    added_control_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Controls to be added (for residual)"
    )
    removed_control_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Controls to be removed (for residual)"
    )

    # Risk parameters
    parameters = models.JSONField(
        default=dict,
        help_text="Risk parameters: probability, impact bounds"
    )
    # Expected structure:
    # {
    #   "probability": 0.15,  # Annual probability of occurrence
    #   "impact": {
    #     "lower_bound": 10000,
    #     "upper_bound": 500000,
    #     "distribution": "lognormal_ci90"
    #   }
    # }

    # Cached simulation data
    simulation_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Cached simulation results"
    )
    simulation_timestamp = models.DateTimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quantitative Risk Hypothesis"
        verbose_name_plural = "Quantitative Risk Hypotheses"
        unique_together = [['scenario', 'stage']]
        ordering = ['stage']

    def __str__(self):
        return f"{self.scenario.name} - {self.stage}"

    def get_probability(self) -> float:
        """Get event probability from parameters."""
        return self.parameters.get('probability', 0)

    def get_impact_bounds(self) -> tuple:
        """Get impact lower and upper bounds."""
        impact = self.parameters.get('impact', {})
        return (
            impact.get('lower_bound', 0),
            impact.get('upper_bound', 0)
        )

    def get_ale(self) -> float:
        """
        Get Annual Loss Expectancy.

        ALE = Probability × Expected Loss (geometric mean of bounds)
        """
        prob = self.get_probability()
        lb, ub = self.get_impact_bounds()
        if lb <= 0 or ub <= 0:
            return 0
        # Geometric mean for lognormal
        expected_loss = (lb * ub) ** 0.5
        return prob * expected_loss

    def is_simulation_fresh(self, max_age_hours: int = 24) -> bool:
        """Check if cached simulation is still fresh."""
        if not self.simulation_timestamp:
            return False
        age = timezone.now() - self.simulation_timestamp
        return age.total_seconds() < max_age_hours * 3600

    def invalidate_simulation(self):
        """Mark cached simulation as stale."""
        self.simulation_data = {}
        self.simulation_timestamp = None
        self.save(update_fields=['simulation_data', 'simulation_timestamp'])

    def run_simulation(self, num_iterations: int = 50000) -> dict:
        """
        Run Monte Carlo simulation.

        Returns simulation results including loss distribution
        and risk metrics.
        """
        from .utils import (
            simulate_scenario_annual_loss,
            create_loss_exceedance_curve,
            calculate_risk_metrics,
        )

        prob = self.get_probability()
        lb, ub = self.get_impact_bounds()

        if prob <= 0 or lb <= 0 or ub <= 0:
            return {'error': 'Invalid parameters'}

        # Run simulation
        losses = simulate_scenario_annual_loss(
            probability=prob,
            lower_bound=lb,
            upper_bound=ub,
            num_iterations=num_iterations
        )

        # Generate loss exceedance curve
        lec = create_loss_exceedance_curve(losses)

        # Calculate risk metrics
        metrics = calculate_risk_metrics(losses, self.scenario.study.loss_threshold)

        # Cache results
        self.simulation_data = {
            'losses': lec,  # Downsampled for storage
            'metrics': metrics,
            'parameters_used': {
                'probability': prob,
                'lower_bound': lb,
                'upper_bound': ub,
                'num_iterations': num_iterations,
            },
        }
        self.simulation_timestamp = timezone.now()
        self.save(update_fields=['simulation_data', 'simulation_timestamp'])

        return self.simulation_data

    def get_treatment_cost(self) -> float:
        """
        Calculate cost of treatment (added controls).

        This would typically sum the costs of added controls.
        Returns 0 if no cost data available.
        """
        # In practice, this would look up control costs
        # For now, return placeholder
        return 0

    def calculate_roc(self, current_hypothesis) -> float:
        """
        Calculate Return on Controls.

        ROC = (Current ALE - Residual ALE - Treatment Cost) / Treatment Cost

        Returns the ROC ratio, or None if not calculable.
        """
        if self.stage != 'residual':
            return None

        current_ale = current_hypothesis.get_ale()
        residual_ale = self.get_ale()
        treatment_cost = self.get_treatment_cost()

        if treatment_cost <= 0:
            return None

        return (current_ale - residual_ale - treatment_cost) / treatment_cost
