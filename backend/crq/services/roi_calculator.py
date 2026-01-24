"""
ROI Calculator Service

Provides control investment ROI calculations including:
- Return on Security Investment (ROSI)
- Control effectiveness analysis
- Treatment option comparison
- Optimal control selection
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
import logging
import numpy as np

from ..utils import run_combined_simulation

logger = logging.getLogger(__name__)


class ROIRating(str, Enum):
    """ROI rating categories."""
    EXCELLENT = 'excellent'  # > 200%
    VERY_GOOD = 'very_good'  # 100-200%
    GOOD = 'good'  # 50-100%
    ACCEPTABLE = 'acceptable'  # 0-50%
    MARGINAL = 'marginal'  # -25% to 0%
    POOR = 'poor'  # < -25%


@dataclass
class ControlROI:
    """ROI analysis for a security control."""
    control_id: str
    control_name: str
    annual_cost: float
    implementation_cost: float
    expected_risk_reduction: float
    risk_reduction_percentage: float
    net_annual_benefit: float
    roi_percentage: float
    roi_rating: str
    payback_period_years: float
    npv_5_year: float
    effectiveness_score: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            'control_id': self.control_id,
            'control_name': self.control_name,
            'annual_cost': self.annual_cost,
            'implementation_cost': self.implementation_cost,
            'expected_risk_reduction': self.expected_risk_reduction,
            'risk_reduction_percentage': self.risk_reduction_percentage,
            'net_annual_benefit': self.net_annual_benefit,
            'roi_percentage': self.roi_percentage,
            'roi_rating': self.roi_rating,
            'payback_period_years': self.payback_period_years,
            'npv_5_year': self.npv_5_year,
            'effectiveness_score': self.effectiveness_score,
        }


@dataclass
class TreatmentComparison:
    """Comparison of treatment options."""
    treatment_name: str
    controls: List[str]
    total_annual_cost: float
    total_implementation_cost: float
    risk_reduction: float
    risk_reduction_percentage: float
    residual_risk: float
    roi_percentage: float
    payback_period: float
    cost_per_risk_unit_reduced: float
    ranking: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            'treatment_name': self.treatment_name,
            'controls': self.controls,
            'total_annual_cost': self.total_annual_cost,
            'total_implementation_cost': self.total_implementation_cost,
            'risk_reduction': self.risk_reduction,
            'risk_reduction_percentage': self.risk_reduction_percentage,
            'residual_risk': self.residual_risk,
            'roi_percentage': self.roi_percentage,
            'payback_period': self.payback_period,
            'cost_per_risk_unit_reduced': self.cost_per_risk_unit_reduced,
            'ranking': self.ranking,
        }


@dataclass
class OptimalControlSet:
    """Optimal set of controls within a budget."""
    budget: float
    selected_controls: List[ControlROI]
    total_cost: float
    total_risk_reduction: float
    remaining_budget: float
    portfolio_roi: float
    controls_not_selected: List[str]
    optimization_method: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'budget': self.budget,
            'selected_controls': [c.to_dict() for c in self.selected_controls],
            'total_cost': self.total_cost,
            'total_risk_reduction': self.total_risk_reduction,
            'remaining_budget': self.remaining_budget,
            'portfolio_roi': self.portfolio_roi,
            'controls_not_selected': self.controls_not_selected,
            'optimization_method': self.optimization_method,
        }


@dataclass
class BreakevenAnalysis:
    """Break-even analysis for a control investment."""
    control_name: str
    annual_cost: float
    implementation_cost: float
    required_risk_reduction_for_breakeven: float
    required_probability_reduction: float
    current_probability: float
    breakeven_probability: float
    is_viable: bool
    viability_explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'control_name': self.control_name,
            'annual_cost': self.annual_cost,
            'implementation_cost': self.implementation_cost,
            'required_risk_reduction_for_breakeven': self.required_risk_reduction_for_breakeven,
            'required_probability_reduction': self.required_probability_reduction,
            'current_probability': self.current_probability,
            'breakeven_probability': self.breakeven_probability,
            'is_viable': self.is_viable,
            'viability_explanation': self.viability_explanation,
        }


class ROICalculator:
    """
    Control investment ROI calculation service.

    Provides comprehensive ROI analysis for security controls including:
    - ROSI (Return on Security Investment) calculations
    - NPV and payback period analysis
    - Treatment option comparison
    - Budget optimization
    """

    def __init__(
        self,
        discount_rate: float = 0.08,
        analysis_horizon_years: int = 5,
        n_simulations: int = 50_000,
    ):
        """
        Initialize the ROI Calculator.

        Args:
            discount_rate: Annual discount rate for NPV calculations
            analysis_horizon_years: Years to consider for NPV
            n_simulations: Monte Carlo simulation iterations
        """
        self.discount_rate = discount_rate
        self.analysis_horizon_years = analysis_horizon_years
        self.n_simulations = n_simulations

    def calculate_control_roi(
        self,
        control_id: str,
        control_name: str,
        annual_cost: float,
        implementation_cost: float,
        current_risk: Dict[str, float],
        residual_risk: Dict[str, float],
    ) -> ControlROI:
        """
        Calculate ROI for a single control.

        Args:
            control_id: Control identifier
            control_name: Control name
            annual_cost: Annual operating cost
            implementation_cost: One-time implementation cost
            current_risk: Current risk parameters (probability, lower_bound, upper_bound)
            residual_risk: Residual risk parameters after control

        Returns:
            ControlROI with comprehensive analysis
        """
        # Calculate current and residual ALE using simulation
        current_ale = self._calculate_ale(current_risk)
        residual_ale = self._calculate_ale(residual_risk)

        risk_reduction = current_ale - residual_ale
        risk_reduction_pct = (risk_reduction / current_ale * 100) if current_ale > 0 else 0

        # Net annual benefit = risk reduction - annual cost
        net_annual_benefit = risk_reduction - annual_cost

        # Total cost (annualized implementation over horizon)
        annualized_impl = implementation_cost / self.analysis_horizon_years
        total_annual_cost = annual_cost + annualized_impl

        # ROI = Net Benefit / Total Cost
        roi_pct = (net_annual_benefit / total_annual_cost * 100) if total_annual_cost > 0 else 0

        # Payback period
        if net_annual_benefit > 0:
            payback = (implementation_cost + annual_cost) / net_annual_benefit
        else:
            payback = float('inf')

        # NPV calculation
        npv = self._calculate_npv(
            implementation_cost=implementation_cost,
            annual_cost=annual_cost,
            annual_benefit=risk_reduction,
        )

        # Effectiveness score (0-1)
        effectiveness = min(1.0, risk_reduction_pct / 100) if risk_reduction_pct > 0 else 0

        # ROI rating
        roi_rating = self._get_roi_rating(roi_pct)

        return ControlROI(
            control_id=control_id,
            control_name=control_name,
            annual_cost=annual_cost,
            implementation_cost=implementation_cost,
            expected_risk_reduction=risk_reduction,
            risk_reduction_percentage=risk_reduction_pct,
            net_annual_benefit=net_annual_benefit,
            roi_percentage=roi_pct,
            roi_rating=roi_rating.value,
            payback_period_years=payback,
            npv_5_year=npv,
            effectiveness_score=effectiveness,
        )

    def compare_treatment_options(
        self,
        current_risk: Dict[str, float],
        treatment_options: List[Dict[str, Any]],
    ) -> List[TreatmentComparison]:
        """
        Compare multiple treatment options.

        Args:
            current_risk: Current risk parameters
            treatment_options: List of treatment options, each with:
                - 'name': Treatment name
                - 'controls': List of control names
                - 'annual_cost': Total annual cost
                - 'implementation_cost': Total implementation cost
                - 'residual_risk': Residual risk parameters

        Returns:
            List of treatment comparisons, ranked by cost-effectiveness
        """
        current_ale = self._calculate_ale(current_risk)
        comparisons = []

        for option in treatment_options:
            residual_ale = self._calculate_ale(option['residual_risk'])
            risk_reduction = current_ale - residual_ale
            risk_reduction_pct = (risk_reduction / current_ale * 100) if current_ale > 0 else 0

            annual_cost = option['annual_cost']
            impl_cost = option['implementation_cost']
            total_cost = annual_cost + (impl_cost / self.analysis_horizon_years)

            net_benefit = risk_reduction - annual_cost
            roi_pct = (net_benefit / total_cost * 100) if total_cost > 0 else 0

            payback = (impl_cost + annual_cost) / net_benefit if net_benefit > 0 else float('inf')

            cost_per_unit = total_cost / risk_reduction if risk_reduction > 0 else float('inf')

            comparisons.append(TreatmentComparison(
                treatment_name=option['name'],
                controls=option.get('controls', []),
                total_annual_cost=annual_cost,
                total_implementation_cost=impl_cost,
                risk_reduction=risk_reduction,
                risk_reduction_percentage=risk_reduction_pct,
                residual_risk=residual_ale,
                roi_percentage=roi_pct,
                payback_period=payback,
                cost_per_risk_unit_reduced=cost_per_unit,
                ranking=0,  # Set after sorting
            ))

        # Rank by ROI (higher is better)
        comparisons.sort(key=lambda c: c.roi_percentage, reverse=True)
        for i, comp in enumerate(comparisons):
            comp.ranking = i + 1

        return comparisons

    def optimize_control_selection(
        self,
        budget: float,
        available_controls: List[Dict[str, Any]],
        current_risk: Dict[str, float],
    ) -> OptimalControlSet:
        """
        Select optimal set of controls within a budget.

        Uses a greedy algorithm based on ROI.

        Args:
            budget: Available budget
            available_controls: List of controls, each with:
                - 'id': Control ID
                - 'name': Control name
                - 'annual_cost': Annual cost
                - 'implementation_cost': Implementation cost
                - 'risk_reduction_estimate': Expected risk reduction (0-1)
            current_risk: Current risk parameters

        Returns:
            OptimalControlSet with selected controls
        """
        current_ale = self._calculate_ale(current_risk)

        # Calculate ROI for each control
        control_rois = []
        for ctrl in available_controls:
            # Estimate residual risk based on reduction estimate
            reduction_factor = 1 - ctrl.get('risk_reduction_estimate', 0)
            residual_risk = {
                'probability': current_risk['probability'] * reduction_factor,
                'lower_bound': current_risk['lower_bound'],
                'upper_bound': current_risk['upper_bound'],
            }

            roi = self.calculate_control_roi(
                control_id=ctrl['id'],
                control_name=ctrl['name'],
                annual_cost=ctrl['annual_cost'],
                implementation_cost=ctrl['implementation_cost'],
                current_risk=current_risk,
                residual_risk=residual_risk,
            )
            control_rois.append((ctrl, roi))

        # Sort by ROI (highest first)
        control_rois.sort(key=lambda x: x[1].roi_percentage, reverse=True)

        # Greedy selection within budget
        selected = []
        total_cost = 0
        total_reduction = 0
        not_selected = []

        for ctrl, roi in control_rois:
            ctrl_cost = ctrl['annual_cost'] + ctrl['implementation_cost']
            if total_cost + ctrl_cost <= budget:
                selected.append(roi)
                total_cost += ctrl_cost
                total_reduction += roi.expected_risk_reduction
            else:
                not_selected.append(ctrl['name'])

        remaining = budget - total_cost
        portfolio_roi = (total_reduction / total_cost * 100) if total_cost > 0 else 0

        return OptimalControlSet(
            budget=budget,
            selected_controls=selected,
            total_cost=total_cost,
            total_risk_reduction=total_reduction,
            remaining_budget=remaining,
            portfolio_roi=portfolio_roi,
            controls_not_selected=not_selected,
            optimization_method='greedy_roi',
        )

    def calculate_breakeven(
        self,
        control_name: str,
        annual_cost: float,
        implementation_cost: float,
        current_risk: Dict[str, float],
    ) -> BreakevenAnalysis:
        """
        Calculate break-even point for a control investment.

        Args:
            control_name: Control name
            annual_cost: Annual operating cost
            implementation_cost: Implementation cost
            current_risk: Current risk parameters

        Returns:
            BreakevenAnalysis with break-even metrics
        """
        current_ale = self._calculate_ale(current_risk)
        current_prob = current_risk['probability']

        # Required risk reduction for break-even
        # Net benefit = risk_reduction - annual_cost >= 0
        # So required_reduction >= annual_cost
        required_reduction = annual_cost + (implementation_cost / self.analysis_horizon_years)

        # Required probability reduction (assuming linear relationship)
        if current_ale > 0:
            reduction_ratio = required_reduction / current_ale
            required_prob_reduction = current_prob * reduction_ratio
            breakeven_prob = max(0, current_prob - required_prob_reduction)
        else:
            required_prob_reduction = current_prob
            breakeven_prob = 0

        # Viability check
        is_viable = required_reduction <= current_ale
        if is_viable:
            viability = f"Control is viable. Requires reducing ALE by {required_reduction:,.0f} " \
                       f"({required_prob_reduction / current_prob * 100:.1f}% reduction needed)."
        else:
            viability = f"Control may not be cost-effective. Annual cost ({annual_cost:,.0f}) " \
                       f"exceeds current ALE ({current_ale:,.0f})."

        return BreakevenAnalysis(
            control_name=control_name,
            annual_cost=annual_cost,
            implementation_cost=implementation_cost,
            required_risk_reduction_for_breakeven=required_reduction,
            required_probability_reduction=required_prob_reduction,
            current_probability=current_prob,
            breakeven_probability=breakeven_prob,
            is_viable=is_viable,
            viability_explanation=viability,
        )

    def sensitivity_analysis(
        self,
        control_id: str,
        control_name: str,
        annual_cost: float,
        implementation_cost: float,
        current_risk: Dict[str, float],
        residual_risk: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        Perform sensitivity analysis on ROI.

        Analyzes how ROI changes with variations in:
        - Cost (+/- 20%)
        - Risk reduction (+/- 20%)
        - Probability estimates (+/- 20%)

        Args:
            control_id: Control ID
            control_name: Control name
            annual_cost: Base annual cost
            implementation_cost: Base implementation cost
            current_risk: Base current risk
            residual_risk: Base residual risk

        Returns:
            Sensitivity analysis results
        """
        base_roi = self.calculate_control_roi(
            control_id, control_name, annual_cost, implementation_cost,
            current_risk, residual_risk
        )

        variations = [-0.2, -0.1, 0, 0.1, 0.2]
        results = {
            'base_case': base_roi.to_dict(),
            'cost_sensitivity': [],
            'risk_reduction_sensitivity': [],
            'probability_sensitivity': [],
        }

        # Cost sensitivity
        for var in variations:
            varied_annual = annual_cost * (1 + var)
            varied_impl = implementation_cost * (1 + var)
            roi = self.calculate_control_roi(
                control_id, control_name, varied_annual, varied_impl,
                current_risk, residual_risk
            )
            results['cost_sensitivity'].append({
                'variation': var * 100,
                'roi_percentage': roi.roi_percentage,
            })

        # Risk reduction sensitivity (vary residual risk)
        for var in variations:
            varied_residual = {
                'probability': residual_risk['probability'] * (1 - var),
                'lower_bound': residual_risk['lower_bound'],
                'upper_bound': residual_risk['upper_bound'],
            }
            roi = self.calculate_control_roi(
                control_id, control_name, annual_cost, implementation_cost,
                current_risk, varied_residual
            )
            results['risk_reduction_sensitivity'].append({
                'variation': var * 100,
                'roi_percentage': roi.roi_percentage,
            })

        # Probability sensitivity (vary current risk)
        for var in variations:
            varied_current = {
                'probability': current_risk['probability'] * (1 + var),
                'lower_bound': current_risk['lower_bound'],
                'upper_bound': current_risk['upper_bound'],
            }
            roi = self.calculate_control_roi(
                control_id, control_name, annual_cost, implementation_cost,
                varied_current, residual_risk
            )
            results['probability_sensitivity'].append({
                'variation': var * 100,
                'roi_percentage': roi.roi_percentage,
            })

        return results

    def _calculate_ale(self, risk_params: Dict[str, float]) -> float:
        """Calculate ALE using Monte Carlo simulation."""
        if not risk_params:
            return 0.0

        prob = risk_params.get('probability', 0)
        lb = risk_params.get('lower_bound', 0)
        ub = risk_params.get('upper_bound', 0)

        if prob <= 0 or lb <= 0 or ub <= lb:
            return 0.0

        # Run simulation
        scenarios_params = {
            'scenario': {
                'probability': prob,
                'lower_bound': lb,
                'upper_bound': ub,
            }
        }

        try:
            results = run_combined_simulation(
                scenarios_params=scenarios_params,
                n_simulations=self.n_simulations,
                random_seed=42,
            )

            losses = results.get('scenario', {}).get('raw_losses', np.array([]))
            return float(np.mean(losses)) if len(losses) > 0 else 0.0

        except Exception as e:
            logger.error(f"Error calculating ALE: {e}")
            # Fallback to simple calculation
            from ..utils import mu_sigma_from_lognorm_90pct
            mu, sigma = mu_sigma_from_lognorm_90pct(lb, ub)
            expected_loss = np.exp(mu + (sigma ** 2) / 2)
            return prob * expected_loss

    def _calculate_npv(
        self,
        implementation_cost: float,
        annual_cost: float,
        annual_benefit: float,
    ) -> float:
        """Calculate Net Present Value."""
        npv = -implementation_cost  # Initial investment

        for year in range(1, self.analysis_horizon_years + 1):
            net_cash_flow = annual_benefit - annual_cost
            discounted = net_cash_flow / ((1 + self.discount_rate) ** year)
            npv += discounted

        return npv

    def _get_roi_rating(self, roi_percentage: float) -> ROIRating:
        """Get ROI rating category."""
        if roi_percentage > 200:
            return ROIRating.EXCELLENT
        elif roi_percentage > 100:
            return ROIRating.VERY_GOOD
        elif roi_percentage > 50:
            return ROIRating.GOOD
        elif roi_percentage > 0:
            return ROIRating.ACCEPTABLE
        elif roi_percentage > -25:
            return ROIRating.MARGINAL
        else:
            return ROIRating.POOR


# Singleton instance
_roi_calculator: Optional[ROICalculator] = None


def get_roi_calculator() -> ROICalculator:
    """Get or create the ROI Calculator instance."""
    global _roi_calculator
    if _roi_calculator is None:
        _roi_calculator = ROICalculator()
    return _roi_calculator
