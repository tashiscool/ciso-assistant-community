<script lang="ts">
	import { onMount } from 'svelte';
	import { BASE_API_URL } from '$lib/utils/constants';

	let controlId = $state('');
	let scenarioId = $state('');
	let timeHorizonYears = $state(3);
	let discountRate = $state(0.08);
	let loading = $state(false);
	let result = $state<any>(null);
	let error = $state('');
	let controls = $state<any[]>([]);
	let scenarios = $state<any[]>([]);

	onMount(async () => {
		// Load controls and scenarios
		try {
			const [controlsRes, scenariosRes] = await Promise.all([
				fetch(`${BASE_API_URL}/applied-controls/`),
				fetch(`${BASE_API_URL}/quantitative-risk-scenarios/`)
			]);

			if (controlsRes.ok) {
				const data = await controlsRes.json();
				controls = data.results || data || [];
			}
			if (scenariosRes.ok) {
				const data = await scenariosRes.json();
				scenarios = data.results || data || [];
			}
		} catch (e) {
			console.error('Failed to load data:', e);
		}
	});

	async function calculateROI() {
		if (!controlId || !scenarioId) {
			error = 'Please select both a control and a scenario';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/crq/analytics/roi/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					control_id: controlId,
					scenario_id: scenarioId,
					time_horizon_years: timeHorizonYears,
					discount_rate: discountRate
				})
			});

			if (!response.ok) {
				throw new Error('Failed to calculate ROI');
			}

			result = await response.json();
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value);
	}

	function formatPercent(value: number): string {
		return `${(value * 100).toFixed(1)}%`;
	}

	function getROIColor(rosi: number): string {
		if (rosi >= 200) return 'text-green-600';
		if (rosi >= 100) return 'text-blue-600';
		if (rosi >= 0) return 'text-yellow-600';
		return 'text-red-600';
	}

	function getPaybackColor(months: number): string {
		if (months <= 12) return 'text-green-600';
		if (months <= 24) return 'text-blue-600';
		if (months <= 36) return 'text-yellow-600';
		return 'text-red-600';
	}
</script>

<div class="space-y-6">
	<!-- Calculator Controls -->
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">Control ROI Calculator</h2>
		<p class="text-sm text-gray-600 mb-4">
			Calculate Return on Security Investment (ROSI), NPV, and payback period for security controls.
		</p>

		<div class="grid grid-cols-2 gap-4 mb-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Security Control</label>
				<select
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={controlId}
				>
					<option value="">Select a control...</option>
					{#each controls as control}
						<option value={control.id}>{control.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Risk Scenario</label>
				<select
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={scenarioId}
				>
					<option value="">Select a scenario...</option>
					{#each scenarios as scenario}
						<option value={scenario.id}>{scenario.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Time Horizon (Years)</label>
				<input
					type="number"
					min="1"
					max="10"
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={timeHorizonYears}
				/>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Discount Rate</label>
				<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={discountRate}>
					<option value={0.05}>5%</option>
					<option value={0.08}>8%</option>
					<option value={0.10}>10%</option>
					<option value={0.12}>12%</option>
					<option value={0.15}>15%</option>
				</select>
			</div>
		</div>

		<button
			class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
			onclick={calculateROI}
			disabled={loading || !controlId || !scenarioId}
		>
			{#if loading}
				<i class="fa-solid fa-spinner fa-spin mr-2"></i>
				Calculating...
			{:else}
				<i class="fa-solid fa-calculator mr-2"></i>
				Calculate ROI
			{/if}
		</button>

		{#if error}
			<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
				<i class="fa-solid fa-circle-exclamation mr-2"></i>
				{error}
			</div>
		{/if}
	</div>

	<!-- Results -->
	{#if result}
		<!-- Key Metrics -->
		<div class="grid grid-cols-4 gap-4">
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Return on Security Investment</div>
				<div class="text-2xl font-bold {getROIColor(result.rosi || 0)}">
					{formatPercent((result.rosi || 0) / 100)}
				</div>
				<div class="text-xs text-gray-500 mt-1">
					{result.rosi >= 100 ? 'Strong investment' : result.rosi >= 0 ? 'Marginal benefit' : 'Negative return'}
				</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Net Present Value</div>
				<div class="text-2xl font-bold {result.npv >= 0 ? 'text-green-600' : 'text-red-600'}">
					{formatCurrency(result.npv || 0)}
				</div>
				<div class="text-xs text-gray-500 mt-1">
					{result.npv >= 0 ? 'Positive NPV - Good investment' : 'Negative NPV - Review'}
				</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Payback Period</div>
				<div class="text-2xl font-bold {getPaybackColor(result.payback_months || 999)}">
					{#if result.payback_months}
						{result.payback_months} months
					{:else}
						N/A
					{/if}
				</div>
				<div class="text-xs text-gray-500 mt-1">Time to recover investment</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Risk Reduction</div>
				<div class="text-2xl font-bold text-blue-600">
					{formatPercent(result.risk_reduction || 0)}
				</div>
				<div class="text-xs text-gray-500 mt-1">Expected loss reduction</div>
			</div>
		</div>

		<!-- Cost/Benefit Breakdown -->
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Cost/Benefit Analysis</h3>

			<div class="grid grid-cols-2 gap-8">
				<!-- Costs -->
				<div>
					<h4 class="text-sm font-medium text-red-600 mb-3">
						<i class="fa-solid fa-arrow-down mr-2"></i>
						Costs
					</h4>
					<div class="space-y-2">
						<div class="flex justify-between py-2 border-b">
							<span class="text-gray-600">Implementation Cost</span>
							<span class="font-medium">{formatCurrency(result.implementation_cost || 0)}</span>
						</div>
						<div class="flex justify-between py-2 border-b">
							<span class="text-gray-600">Annual Operating Cost</span>
							<span class="font-medium">{formatCurrency(result.annual_operating_cost || 0)}</span>
						</div>
						<div class="flex justify-between py-2 border-b">
							<span class="text-gray-600">Total Cost ({timeHorizonYears} years)</span>
							<span class="font-bold text-red-600">{formatCurrency(result.total_cost || 0)}</span>
						</div>
					</div>
				</div>

				<!-- Benefits -->
				<div>
					<h4 class="text-sm font-medium text-green-600 mb-3">
						<i class="fa-solid fa-arrow-up mr-2"></i>
						Benefits
					</h4>
					<div class="space-y-2">
						<div class="flex justify-between py-2 border-b">
							<span class="text-gray-600">Annual Loss Without Control</span>
							<span class="font-medium">{formatCurrency(result.annual_loss_without || 0)}</span>
						</div>
						<div class="flex justify-between py-2 border-b">
							<span class="text-gray-600">Annual Loss With Control</span>
							<span class="font-medium">{formatCurrency(result.annual_loss_with || 0)}</span>
						</div>
						<div class="flex justify-between py-2 border-b">
							<span class="text-gray-600">Annual Risk Reduction</span>
							<span class="font-bold text-green-600">{formatCurrency(result.annual_benefit || 0)}</span>
						</div>
						<div class="flex justify-between py-2 border-b">
							<span class="text-gray-600">Total Benefit ({timeHorizonYears} years)</span>
							<span class="font-bold text-green-600">{formatCurrency(result.total_benefit || 0)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Recommendation -->
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Investment Recommendation</h3>

			{#if result.npv > 0 && result.rosi > 100}
				<div class="flex items-start p-4 bg-green-50 rounded-lg">
					<i class="fa-solid fa-circle-check text-2xl text-green-600 mr-4 mt-1"></i>
					<div>
						<h4 class="font-medium text-green-800">Strong Recommendation: Implement</h4>
						<p class="text-green-700 text-sm mt-1">
							This control provides a positive NPV of {formatCurrency(result.npv)} and an ROSI of {formatPercent((result.rosi || 0) / 100)}.
							The investment will pay for itself in {result.payback_months} months.
						</p>
					</div>
				</div>
			{:else if result.npv > 0}
				<div class="flex items-start p-4 bg-blue-50 rounded-lg">
					<i class="fa-solid fa-circle-info text-2xl text-blue-600 mr-4 mt-1"></i>
					<div>
						<h4 class="font-medium text-blue-800">Moderate Recommendation: Consider</h4>
						<p class="text-blue-700 text-sm mt-1">
							This control has a positive NPV but moderate returns.
							Consider implementation if budget allows and risk tolerance is low.
						</p>
					</div>
				</div>
			{:else}
				<div class="flex items-start p-4 bg-yellow-50 rounded-lg">
					<i class="fa-solid fa-triangle-exclamation text-2xl text-yellow-600 mr-4 mt-1"></i>
					<div>
						<h4 class="font-medium text-yellow-800">Caution: Review Alternatives</h4>
						<p class="text-yellow-700 text-sm mt-1">
							This control shows negative NPV or low returns.
							Consider alternative controls or negotiate better pricing before implementation.
						</p>
					</div>
				</div>
			{/if}
		</div>
	{:else if !loading}
		<div class="bg-white rounded-lg shadow p-12 text-center">
			<i class="fa-solid fa-calculator text-6xl text-gray-300 mb-4"></i>
			<p class="text-gray-500">Select a control and scenario to calculate ROI metrics.</p>
		</div>
	{/if}
</div>
