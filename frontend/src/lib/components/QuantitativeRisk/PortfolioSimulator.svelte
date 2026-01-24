<script lang="ts">
	import { onMount } from 'svelte';
	import { BASE_API_URL } from '$lib/utils/constants';

	let studyId = $state('');
	let iterations = $state(10000);
	let confidenceLevels = $state([90, 95, 99]);
	let loading = $state(false);
	let result = $state<any>(null);
	let error = $state('');
	let studies = $state<any[]>([]);

	onMount(async () => {
		// Load available quantitative risk studies
		try {
			const response = await fetch(`${BASE_API_URL}/quantitative-risk-studies/`);
			if (response.ok) {
				const data = await response.json();
				studies = data.results || data || [];
			}
		} catch (e) {
			console.error('Failed to load studies:', e);
		}
	});

	async function runAnalysis() {
		if (!studyId) {
			error = 'Please select a risk study';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/crq/analytics/portfolio/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					study_id: studyId,
					iterations: iterations,
					confidence_levels: confidenceLevels
				})
			});

			if (!response.ok) {
				throw new Error('Failed to run portfolio analysis');
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
		return `${value.toFixed(1)}%`;
	}
</script>

<div class="space-y-6">
	<!-- Controls -->
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">Portfolio Risk Analysis</h2>
		<p class="text-sm text-gray-600 mb-4">
			Run Monte Carlo simulations to analyze aggregate portfolio risk with Value at Risk (VaR),
			Expected Shortfall (CVaR), and diversification metrics.
		</p>

		<div class="grid grid-cols-3 gap-4 mb-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Quantitative Risk Study</label>
				<select
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={studyId}
				>
					<option value="">Select a study...</option>
					{#each studies as study}
						<option value={study.id}>{study.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Monte Carlo Iterations</label>
				<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={iterations}>
					<option value={1000}>1,000 (Fast)</option>
					<option value={10000}>10,000 (Standard)</option>
					<option value={50000}>50,000 (Detailed)</option>
					<option value={100000}>100,000 (High Precision)</option>
				</select>
			</div>

			<div class="flex items-end">
				<button
					class="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={runAnalysis}
					disabled={loading || !studyId}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Running Simulation...
					{:else}
						<i class="fa-solid fa-play mr-2"></i>
						Run Analysis
					{/if}
				</button>
			</div>
		</div>

		{#if error}
			<div class="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
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
				<div class="text-sm text-gray-500">Expected Annual Loss</div>
				<div class="text-2xl font-bold text-gray-900">{formatCurrency(result.expected_loss || 0)}</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Standard Deviation</div>
				<div class="text-2xl font-bold text-gray-900">{formatCurrency(result.standard_deviation || 0)}</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Diversification Ratio</div>
				<div class="text-2xl font-bold text-blue-600">{formatPercent((result.diversification_ratio || 1) * 100)}</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Scenarios Analyzed</div>
				<div class="text-2xl font-bold text-gray-900">{result.scenario_count || 0}</div>
			</div>
		</div>

		<!-- VaR and CVaR -->
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Value at Risk Analysis</h3>

			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b bg-gray-50">
							<th class="text-left py-3 px-4">Confidence Level</th>
							<th class="text-right py-3 px-4">Value at Risk (VaR)</th>
							<th class="text-right py-3 px-4">Expected Shortfall (CVaR)</th>
							<th class="text-right py-3 px-4">Probability of Loss</th>
						</tr>
					</thead>
					<tbody>
						{#each (result.var_levels || []) as level}
							<tr class="border-b hover:bg-gray-50">
								<td class="py-3 px-4 font-medium">{level.confidence}%</td>
								<td class="py-3 px-4 text-right font-medium text-red-600">
									{formatCurrency(level.var)}
								</td>
								<td class="py-3 px-4 text-right text-red-600">
									{formatCurrency(level.cvar)}
								</td>
								<td class="py-3 px-4 text-right">
									{formatPercent(100 - level.confidence)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
				<i class="fa-solid fa-info-circle mr-2"></i>
				VaR represents the maximum loss at the given confidence level.
				CVaR (Expected Shortfall) represents the average loss in the worst cases beyond VaR.
			</div>
		</div>

		<!-- Scenario Contributions -->
		{#if result.scenario_contributions && result.scenario_contributions.length > 0}
			<div class="bg-white rounded-lg shadow p-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Risk Contribution by Scenario</h3>

				<div class="space-y-3">
					{#each result.scenario_contributions.slice(0, 10) as contribution}
						<div class="flex items-center">
							<div class="w-48 text-sm text-gray-700 truncate" title={contribution.scenario_name}>
								{contribution.scenario_name}
							</div>
							<div class="flex-1 mx-4">
								<div class="w-full bg-gray-200 rounded-full h-4">
									<div
										class="h-4 rounded-full bg-red-500 transition-all duration-300"
										style="width: {Math.min(100, contribution.contribution_percent)}%"
									></div>
								</div>
							</div>
							<div class="w-24 text-right">
								<span class="text-sm font-medium">{formatPercent(contribution.contribution_percent)}</span>
							</div>
							<div class="w-32 text-right text-sm text-gray-600">
								{formatCurrency(contribution.expected_loss)}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Concentration Risk -->
		{#if result.concentration}
			<div class="bg-white rounded-lg shadow p-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Concentration Risk</h3>

				<div class="grid grid-cols-3 gap-6">
					<div>
						<div class="text-sm text-gray-500 mb-1">Herfindahl Index</div>
						<div class="text-xl font-bold text-gray-900">{(result.concentration.herfindahl_index || 0).toFixed(4)}</div>
						<div class="text-xs text-gray-500">Higher = More Concentrated</div>
					</div>
					<div>
						<div class="text-sm text-gray-500 mb-1">Top 3 Scenarios</div>
						<div class="text-xl font-bold text-gray-900">{formatPercent(result.concentration.top_3_concentration || 0)}</div>
						<div class="text-xs text-gray-500">Percentage of Total Risk</div>
					</div>
					<div>
						<div class="text-sm text-gray-500 mb-1">Gini Coefficient</div>
						<div class="text-xl font-bold text-gray-900">{(result.concentration.gini_coefficient || 0).toFixed(3)}</div>
						<div class="text-xs text-gray-500">0 = Equal, 1 = Concentrated</div>
					</div>
				</div>

				{#if result.concentration.herfindahl_index > 0.25}
					<div class="mt-4 p-3 bg-yellow-50 rounded text-sm text-yellow-800">
						<i class="fa-solid fa-triangle-exclamation mr-2"></i>
						<strong>High Concentration Warning:</strong> Your risk portfolio is highly concentrated.
						Consider diversifying controls to reduce single-scenario dependency.
					</div>
				{/if}
			</div>
		{/if}
	{:else if !loading}
		<div class="bg-white rounded-lg shadow p-12 text-center">
			<i class="fa-solid fa-chart-pie text-6xl text-gray-300 mb-4"></i>
			<p class="text-gray-500">Select a quantitative risk study and run the analysis to see portfolio metrics.</p>
		</div>
	{/if}
</div>
