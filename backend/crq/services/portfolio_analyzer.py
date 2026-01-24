"""
Portfolio Analyzer Service

Provides advanced portfolio-level risk analysis including:
- Portfolio-wide risk aggregation
- Scenario contribution analysis
- Risk concentration metrics
- Diversification analysis
- Stress testing
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
import logging
import numpy as np

from ..utils import (
    run_combined_simulation,
    create_loss_exceedance_curve,
    calculate_risk_insights,
    mu_sigma_from_lognorm_90pct,
)

logger = logging.getLogger(__name__)


class RiskMeasure(str, Enum):
    """Risk measures for analysis."""
    VAR_95 = 'var_95'
    VAR_99 = 'var_99'
    VAR_999 = 'var_999'
    CVAR_99 = 'cvar_99'
    MEAN = 'mean'


@dataclass
class ScenarioContribution:
    """Contribution of a scenario to portfolio risk."""
    scenario_name: str
    scenario_id: Optional[str]
    standalone_ale: float
    contribution_to_portfolio_ale: float
    contribution_percentage: float
    marginal_ale: float
    diversification_benefit: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            'scenario_name': self.scenario_name,
            'scenario_id': self.scenario_id,
            'standalone_ale': self.standalone_ale,
            'contribution_to_portfolio_ale': self.contribution_to_portfolio_ale,
            'contribution_percentage': self.contribution_percentage,
            'marginal_ale': self.marginal_ale,
            'diversification_benefit': self.diversification_benefit,
        }


@dataclass
class RiskConcentration:
    """Risk concentration analysis results."""
    herfindahl_index: float
    top_3_concentration: float
    top_5_concentration: float
    gini_coefficient: float
    concentration_risk_level: str  # 'low', 'moderate', 'high', 'very_high'

    def to_dict(self) -> Dict[str, Any]:
        return {
            'herfindahl_index': self.herfindahl_index,
            'top_3_concentration': self.top_3_concentration,
            'top_5_concentration': self.top_5_concentration,
            'gini_coefficient': self.gini_coefficient,
            'concentration_risk_level': self.concentration_risk_level,
        }


@dataclass
class PortfolioMetrics:
    """Comprehensive portfolio risk metrics."""
    total_ale: float
    var_90: float
    var_95: float
    var_99: float
    var_999: float
    expected_shortfall_95: float
    expected_shortfall_99: float
    maximum_loss: float
    probability_of_loss: float
    diversification_ratio: float
    scenario_count: int
    loss_exceedance_curve: Dict[str, List[float]] = field(default_factory=dict)
    scenario_contributions: List[ScenarioContribution] = field(default_factory=list)
    concentration: Optional[RiskConcentration] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'total_ale': self.total_ale,
            'var_90': self.var_90,
            'var_95': self.var_95,
            'var_99': self.var_99,
            'var_999': self.var_999,
            'expected_shortfall_95': self.expected_shortfall_95,
            'expected_shortfall_99': self.expected_shortfall_99,
            'maximum_loss': self.maximum_loss,
            'probability_of_loss': self.probability_of_loss,
            'diversification_ratio': self.diversification_ratio,
            'scenario_count': self.scenario_count,
            'loss_exceedance_curve': self.loss_exceedance_curve,
            'scenario_contributions': [c.to_dict() for c in self.scenario_contributions],
            'concentration': self.concentration.to_dict() if self.concentration else None,
        }


@dataclass
class StressTestResult:
    """Result of a stress test scenario."""
    stress_scenario_name: str
    description: str
    base_portfolio_ale: float
    stressed_portfolio_ale: float
    ale_increase: float
    ale_increase_percentage: float
    base_var_99: float
    stressed_var_99: float
    var_99_increase: float
    affected_scenarios: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'stress_scenario_name': self.stress_scenario_name,
            'description': self.description,
            'base_portfolio_ale': self.base_portfolio_ale,
            'stressed_portfolio_ale': self.stressed_portfolio_ale,
            'ale_increase': self.ale_increase,
            'ale_increase_percentage': self.ale_increase_percentage,
            'base_var_99': self.base_var_99,
            'stressed_var_99': self.stressed_var_99,
            'var_99_increase': self.var_99_increase,
            'affected_scenarios': self.affected_scenarios,
        }


class PortfolioAnalyzer:
    """
    Advanced portfolio-level risk analysis service.

    Provides comprehensive analysis of cyber risk portfolios including:
    - Aggregate risk metrics
    - Scenario contribution analysis
    - Diversification analysis
    - Concentration risk
    - Stress testing
    """

    def __init__(
        self,
        n_simulations: int = 100_000,
        random_seed: Optional[int] = 42,
    ):
        """
        Initialize the Portfolio Analyzer.

        Args:
            n_simulations: Number of Monte Carlo simulations
            random_seed: Random seed for reproducibility
        """
        self.n_simulations = n_simulations
        self.random_seed = random_seed

    def analyze_portfolio(
        self,
        scenarios: List[Dict[str, Any]],
        include_contributions: bool = True,
        include_concentration: bool = True,
    ) -> PortfolioMetrics:
        """
        Perform comprehensive portfolio risk analysis.

        Args:
            scenarios: List of scenario dictionaries with:
                - 'name': Scenario name
                - 'probability': Annual probability (0-1)
                - 'lower_bound': 5th percentile loss
                - 'upper_bound': 95th percentile loss
                - 'id' (optional): Scenario ID
            include_contributions: Include scenario contribution analysis
            include_concentration: Include concentration risk analysis

        Returns:
            PortfolioMetrics with comprehensive analysis
        """
        if not scenarios:
            return PortfolioMetrics(
                total_ale=0, var_90=0, var_95=0, var_99=0, var_999=0,
                expected_shortfall_95=0, expected_shortfall_99=0,
                maximum_loss=0, probability_of_loss=0,
                diversification_ratio=1.0, scenario_count=0,
            )

        # Prepare scenario parameters
        scenarios_params = {}
        for scenario in scenarios:
            scenarios_params[scenario['name']] = {
                'probability': scenario['probability'],
                'lower_bound': scenario['lower_bound'],
                'upper_bound': scenario['upper_bound'],
            }

        # Run combined simulation
        results = run_combined_simulation(
            scenarios_params=scenarios_params,
            n_simulations=self.n_simulations,
            random_seed=self.random_seed,
        )

        if 'Portfolio_Total' not in results:
            raise ValueError("Portfolio simulation failed")

        portfolio_result = results['Portfolio_Total']
        portfolio_losses = portfolio_result.get('raw_losses', np.array([]))

        if len(portfolio_losses) == 0:
            raise ValueError("No simulation results generated")

        # Calculate core metrics
        total_ale = float(np.mean(portfolio_losses))
        var_90 = float(np.percentile(portfolio_losses, 90))
        var_95 = float(np.percentile(portfolio_losses, 95))
        var_99 = float(np.percentile(portfolio_losses, 99))
        var_999 = float(np.percentile(portfolio_losses, 99.9))

        # Expected Shortfall (Conditional VaR)
        es_95_mask = portfolio_losses >= var_95
        es_99_mask = portfolio_losses >= var_99
        expected_shortfall_95 = float(np.mean(portfolio_losses[es_95_mask])) if np.any(es_95_mask) else var_95
        expected_shortfall_99 = float(np.mean(portfolio_losses[es_99_mask])) if np.any(es_99_mask) else var_99

        maximum_loss = float(np.max(portfolio_losses))
        probability_of_loss = float(np.mean(portfolio_losses > 0))

        # Calculate diversification ratio
        sum_of_standalone_ales = sum(
            float(np.mean(results[name].get('raw_losses', np.array([0]))))
            for name in results if name != 'Portfolio_Total'
        )
        diversification_ratio = total_ale / sum_of_standalone_ales if sum_of_standalone_ales > 0 else 1.0

        # Create loss exceedance curve
        loss_values, exceedance_probs = create_loss_exceedance_curve(portfolio_losses)
        downsample_factor = max(1, len(loss_values) // 500)
        lec = {
            'loss_values': loss_values[::downsample_factor].tolist(),
            'exceedance_probabilities': exceedance_probs[::downsample_factor].tolist(),
        }

        # Scenario contributions
        contributions = []
        if include_contributions:
            contributions = self._calculate_scenario_contributions(
                scenarios, results, total_ale
            )

        # Concentration risk
        concentration = None
        if include_concentration and contributions:
            concentration = self._calculate_concentration(contributions)

        return PortfolioMetrics(
            total_ale=total_ale,
            var_90=var_90,
            var_95=var_95,
            var_99=var_99,
            var_999=var_999,
            expected_shortfall_95=expected_shortfall_95,
            expected_shortfall_99=expected_shortfall_99,
            maximum_loss=maximum_loss,
            probability_of_loss=probability_of_loss,
            diversification_ratio=diversification_ratio,
            scenario_count=len(scenarios),
            loss_exceedance_curve=lec,
            scenario_contributions=contributions,
            concentration=concentration,
        )

    def run_stress_test(
        self,
        scenarios: List[Dict[str, Any]],
        stress_scenarios: List[Dict[str, Any]],
    ) -> List[StressTestResult]:
        """
        Run stress tests on the portfolio.

        Args:
            scenarios: Base portfolio scenarios
            stress_scenarios: List of stress test definitions with:
                - 'name': Stress test name
                - 'description': Description
                - 'probability_multiplier': Multiply probabilities by this
                - 'impact_multiplier': Multiply impacts by this
                - 'affected_scenarios': List of scenario names to stress (None for all)

        Returns:
            List of stress test results
        """
        if not scenarios:
            return []

        # Get base portfolio metrics
        base_metrics = self.analyze_portfolio(
            scenarios, include_contributions=False, include_concentration=False
        )

        results = []

        for stress in stress_scenarios:
            # Apply stress to scenarios
            stressed_scenarios = []
            affected = stress.get('affected_scenarios')
            prob_mult = stress.get('probability_multiplier', 1.0)
            impact_mult = stress.get('impact_multiplier', 1.0)

            affected_list = []

            for scenario in scenarios:
                new_scenario = scenario.copy()

                if affected is None or scenario['name'] in affected:
                    # Apply stress
                    new_scenario['probability'] = min(1.0, scenario['probability'] * prob_mult)
                    new_scenario['lower_bound'] = scenario['lower_bound'] * impact_mult
                    new_scenario['upper_bound'] = scenario['upper_bound'] * impact_mult
                    affected_list.append(scenario['name'])

                stressed_scenarios.append(new_scenario)

            # Run stressed simulation
            stressed_metrics = self.analyze_portfolio(
                stressed_scenarios,
                include_contributions=False,
                include_concentration=False,
            )

            results.append(StressTestResult(
                stress_scenario_name=stress['name'],
                description=stress.get('description', ''),
                base_portfolio_ale=base_metrics.total_ale,
                stressed_portfolio_ale=stressed_metrics.total_ale,
                ale_increase=stressed_metrics.total_ale - base_metrics.total_ale,
                ale_increase_percentage=(
                    (stressed_metrics.total_ale - base_metrics.total_ale) /
                    base_metrics.total_ale * 100
                ) if base_metrics.total_ale > 0 else 0,
                base_var_99=base_metrics.var_99,
                stressed_var_99=stressed_metrics.var_99,
                var_99_increase=stressed_metrics.var_99 - base_metrics.var_99,
                affected_scenarios=affected_list,
            ))

        return results

    def calculate_loss_probability(
        self,
        scenarios: List[Dict[str, Any]],
        loss_threshold: float,
    ) -> Dict[str, float]:
        """
        Calculate probability of exceeding a loss threshold.

        Args:
            scenarios: Portfolio scenarios
            loss_threshold: Loss threshold to analyze

        Returns:
            Dictionary with probability metrics
        """
        if not scenarios:
            return {'probability': 0.0}

        scenarios_params = {}
        for scenario in scenarios:
            scenarios_params[scenario['name']] = {
                'probability': scenario['probability'],
                'lower_bound': scenario['lower_bound'],
                'upper_bound': scenario['upper_bound'],
            }

        results = run_combined_simulation(
            scenarios_params=scenarios_params,
            n_simulations=self.n_simulations,
            random_seed=self.random_seed,
            loss_threshold=loss_threshold,
        )

        portfolio_losses = results.get('Portfolio_Total', {}).get('raw_losses', np.array([]))

        if len(portfolio_losses) == 0:
            return {'probability': 0.0}

        prob_exceed = float(np.mean(portfolio_losses > loss_threshold))
        expected_excess = float(np.mean(np.maximum(portfolio_losses - loss_threshold, 0)))

        return {
            'probability_of_exceeding': prob_exceed,
            'expected_excess_loss': expected_excess,
            'loss_threshold': loss_threshold,
            'return_period_years': 1 / prob_exceed if prob_exceed > 0 else float('inf'),
        }

    def compare_portfolios(
        self,
        portfolio_a: List[Dict[str, Any]],
        portfolio_b: List[Dict[str, Any]],
        portfolio_a_name: str = 'Current',
        portfolio_b_name: str = 'Alternative',
    ) -> Dict[str, Any]:
        """
        Compare two portfolio configurations.

        Args:
            portfolio_a: First portfolio scenarios
            portfolio_b: Second portfolio scenarios
            portfolio_a_name: Name for first portfolio
            portfolio_b_name: Name for second portfolio

        Returns:
            Comparison analysis
        """
        metrics_a = self.analyze_portfolio(portfolio_a)
        metrics_b = self.analyze_portfolio(portfolio_b)

        return {
            portfolio_a_name: metrics_a.to_dict(),
            portfolio_b_name: metrics_b.to_dict(),
            'comparison': {
                'ale_difference': metrics_b.total_ale - metrics_a.total_ale,
                'ale_change_percentage': (
                    (metrics_b.total_ale - metrics_a.total_ale) /
                    metrics_a.total_ale * 100
                ) if metrics_a.total_ale > 0 else 0,
                'var_99_difference': metrics_b.var_99 - metrics_a.var_99,
                'var_99_change_percentage': (
                    (metrics_b.var_99 - metrics_a.var_99) /
                    metrics_a.var_99 * 100
                ) if metrics_a.var_99 > 0 else 0,
                'diversification_improvement': (
                    metrics_b.diversification_ratio - metrics_a.diversification_ratio
                ),
                'better_portfolio': (
                    portfolio_b_name if metrics_b.total_ale < metrics_a.total_ale
                    else portfolio_a_name
                ),
            },
        }

    def _calculate_scenario_contributions(
        self,
        scenarios: List[Dict[str, Any]],
        results: Dict[str, Dict],
        total_ale: float,
    ) -> List[ScenarioContribution]:
        """Calculate how each scenario contributes to portfolio risk."""
        contributions = []

        for scenario in scenarios:
            name = scenario['name']
            if name not in results or name == 'Portfolio_Total':
                continue

            scenario_losses = results[name].get('raw_losses', np.array([]))
            if len(scenario_losses) == 0:
                continue

            standalone_ale = float(np.mean(scenario_losses))

            # Marginal contribution: run portfolio without this scenario
            other_scenarios = [s for s in scenarios if s['name'] != name]
            if other_scenarios:
                other_params = {
                    s['name']: {
                        'probability': s['probability'],
                        'lower_bound': s['lower_bound'],
                        'upper_bound': s['upper_bound'],
                    }
                    for s in other_scenarios
                }
                other_results = run_combined_simulation(
                    scenarios_params=other_params,
                    n_simulations=self.n_simulations,
                    random_seed=self.random_seed + 1,  # Different seed
                )
                other_portfolio = other_results.get('Portfolio_Total', {})
                other_losses = other_portfolio.get('raw_losses', np.array([]))
                other_ale = float(np.mean(other_losses)) if len(other_losses) > 0 else 0
                marginal_ale = total_ale - other_ale
            else:
                marginal_ale = standalone_ale

            # Diversification benefit
            diversification_benefit = standalone_ale - marginal_ale

            contribution_percentage = (standalone_ale / total_ale * 100) if total_ale > 0 else 0

            contributions.append(ScenarioContribution(
                scenario_name=name,
                scenario_id=scenario.get('id'),
                standalone_ale=standalone_ale,
                contribution_to_portfolio_ale=marginal_ale,
                contribution_percentage=contribution_percentage,
                marginal_ale=marginal_ale,
                diversification_benefit=diversification_benefit,
            ))

        # Sort by contribution
        contributions.sort(key=lambda c: c.standalone_ale, reverse=True)
        return contributions

    def _calculate_concentration(
        self,
        contributions: List[ScenarioContribution],
    ) -> RiskConcentration:
        """Calculate concentration risk metrics."""
        if not contributions:
            return RiskConcentration(
                herfindahl_index=0,
                top_3_concentration=0,
                top_5_concentration=0,
                gini_coefficient=0,
                concentration_risk_level='low',
            )

        # Get ALE values
        ales = [c.standalone_ale for c in contributions]
        total = sum(ales)

        if total == 0:
            return RiskConcentration(
                herfindahl_index=0,
                top_3_concentration=0,
                top_5_concentration=0,
                gini_coefficient=0,
                concentration_risk_level='low',
            )

        # Market shares (proportions)
        shares = [ale / total for ale in ales]

        # Herfindahl Index (sum of squared shares)
        hhi = sum(s ** 2 for s in shares)

        # Top N concentration
        sorted_shares = sorted(shares, reverse=True)
        top_3 = sum(sorted_shares[:3]) if len(sorted_shares) >= 3 else sum(sorted_shares)
        top_5 = sum(sorted_shares[:5]) if len(sorted_shares) >= 5 else sum(sorted_shares)

        # Gini coefficient
        n = len(shares)
        if n > 1:
            sorted_ales = sorted(ales)
            cumulative = np.cumsum(sorted_ales)
            gini = (n + 1 - 2 * np.sum(cumulative) / cumulative[-1]) / n
        else:
            gini = 0

        # Concentration risk level
        if hhi > 0.25 or top_3 > 0.8:
            level = 'very_high'
        elif hhi > 0.15 or top_3 > 0.6:
            level = 'high'
        elif hhi > 0.1 or top_3 > 0.4:
            level = 'moderate'
        else:
            level = 'low'

        return RiskConcentration(
            herfindahl_index=hhi,
            top_3_concentration=top_3,
            top_5_concentration=top_5,
            gini_coefficient=max(0, gini),
            concentration_risk_level=level,
        )


# Singleton instance
_portfolio_analyzer: Optional[PortfolioAnalyzer] = None


def get_portfolio_analyzer() -> PortfolioAnalyzer:
    """Get or create the Portfolio Analyzer instance."""
    global _portfolio_analyzer
    if _portfolio_analyzer is None:
        _portfolio_analyzer = PortfolioAnalyzer()
    return _portfolio_analyzer
