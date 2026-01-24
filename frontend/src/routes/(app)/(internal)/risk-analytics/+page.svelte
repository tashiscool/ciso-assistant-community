<script lang="ts">
	import type { PageData } from './$types';
	import { pageTitle } from '$lib/utils/stores';
	import PortfolioSimulator from '$lib/components/QuantitativeRisk/PortfolioSimulator.svelte';
	import ROICalculator from '$lib/components/QuantitativeRisk/ROICalculator.svelte';
	import LossExceedanceChart from '$lib/components/QuantitativeRisk/LossExceedanceChart.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	pageTitle.set('Risk Analytics');

	let activeTab = $state<'portfolio' | 'roi' | 'simulation'>('portfolio');
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="bg-white shadow-sm border-b">
		<div class="px-6 py-4">
			<h1 class="text-2xl font-semibold text-gray-900">Risk Analytics</h1>
			<p class="text-sm text-gray-600 mt-1">
				Quantitative risk analysis with Monte Carlo simulations and ROI calculations.
			</p>
		</div>

		<!-- Tabs -->
		<div class="px-6 flex space-x-1">
			<button
				class="px-4 py-2 text-sm font-medium rounded-t-lg {activeTab === 'portfolio'
					? 'bg-primary-100 text-primary-700 border-b-2 border-primary-600'
					: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
				onclick={() => (activeTab = 'portfolio')}
			>
				<i class="fa-solid fa-briefcase mr-2"></i>
				Portfolio Analysis
			</button>
			<button
				class="px-4 py-2 text-sm font-medium rounded-t-lg {activeTab === 'roi'
					? 'bg-primary-100 text-primary-700 border-b-2 border-primary-600'
					: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
				onclick={() => (activeTab = 'roi')}
			>
				<i class="fa-solid fa-calculator mr-2"></i>
				ROI Calculator
			</button>
			<button
				class="px-4 py-2 text-sm font-medium rounded-t-lg {activeTab === 'simulation'
					? 'bg-primary-100 text-primary-700 border-b-2 border-primary-600'
					: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
				onclick={() => (activeTab = 'simulation')}
			>
				<i class="fa-solid fa-chart-area mr-2"></i>
				Loss Simulation
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto bg-gray-50 p-6">
		{#if activeTab === 'portfolio'}
			<PortfolioSimulator />
		{:else if activeTab === 'roi'}
			<ROICalculator />
		{:else if activeTab === 'simulation'}
			<LossExceedanceChart />
		{/if}
	</div>
</div>
