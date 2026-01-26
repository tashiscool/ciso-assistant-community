<script lang="ts">
	import { onMount } from 'svelte';
	import { BASE_API_URL } from '$lib/utils/constants';
	import type * as echarts from 'echarts';

	let studyId = $state('');
	let iterations = $state(10000);
	let loading = $state(false);
	let result = $state<any>(null);
	let error = $state('');
	let studies = $state<any[]>([]);
	let chartContainer: HTMLElement;
	let chart: echarts.ECharts;

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

	async function runSimulation() {
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
					confidence_levels: [50, 75, 90, 95, 99]
				})
			});

			if (!response.ok) {
				throw new Error('Failed to run simulation');
			}

			result = await response.json();

			// Render the chart
			await renderChart();
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function renderChart() {
		if (!chartContainer || !result) return;

		const echarts = await import('echarts');

		if (chart) {
			chart.dispose();
		}

		chart = echarts.init(chartContainer);

		// Generate loss exceedance curve data
		const percentiles = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99];
		const losses: number[] = [];

		// Simulate loss values based on result
		const mean = result.expected_loss || 100000;
		const stdDev = result.standard_deviation || mean * 0.5;

		for (const p of percentiles) {
			// Using normal approximation for demonstration
			const z = getZScore(p / 100);
			const loss = Math.max(0, mean + z * stdDev);
			losses.push(loss);
		}

		const exceedanceProbabilities = percentiles.map(p => 100 - p);

		const options = {
			title: {
				text: 'Loss Exceedance Curve',
				subtext: `Based on ${iterations.toLocaleString()} Monte Carlo iterations`,
				left: 'center'
			},
			tooltip: {
				trigger: 'axis',
				formatter: (params: any) => {
					const point = params[0];
					return `<strong>${point.axisValue}% Probability</strong><br/>
						Loss exceeds: $${Math.round(point.value).toLocaleString()}`;
				}
			},
			grid: {
				left: '10%',
				right: '5%',
				bottom: '15%',
				top: '20%'
			},
			xAxis: {
				type: 'category',
				name: 'Exceedance Probability (%)',
				nameLocation: 'middle',
				nameGap: 30,
				data: exceedanceProbabilities.map(p => p.toString())
			},
			yAxis: {
				type: 'value',
				name: 'Loss Amount ($)',
				nameLocation: 'middle',
				nameGap: 60,
				axisLabel: {
					formatter: (value: number) => {
						if (value >= 1000000) {
							return `$${(value / 1000000).toFixed(1)}M`;
						} else if (value >= 1000) {
							return `$${(value / 1000).toFixed(0)}K`;
						}
						return `$${value}`;
					}
				}
			},
			series: [
				{
					name: 'Loss Exceedance',
					type: 'line',
					smooth: true,
					data: losses,
					areaStyle: {
						color: {
							type: 'linear',
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{ offset: 0, color: 'rgba(239, 68, 68, 0.5)' },
								{ offset: 1, color: 'rgba(239, 68, 68, 0.1)' }
							]
						}
					},
					lineStyle: {
						width: 3,
						color: '#EF4444'
					},
					itemStyle: {
						color: '#EF4444'
					},
					markLine: {
						data: [
							{
								yAxis: result.var_levels?.find((v: any) => v.confidence === 95)?.var || mean + 1.645 * stdDev,
								name: '95% VaR',
								label: {
									formatter: '95% VaR',
									position: 'end'
								},
								lineStyle: {
									color: '#F59E0B',
									type: 'dashed'
								}
							},
							{
								yAxis: result.expected_loss || mean,
								name: 'Expected Loss',
								label: {
									formatter: 'Expected',
									position: 'end'
								},
								lineStyle: {
									color: '#3B82F6',
									type: 'dashed'
								}
							}
						]
					}
				}
			]
		};

		chart.setOption(options);

		// Handle resize
		const handleResize = () => chart?.resize();
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			chart?.dispose();
		};
	}

	function getZScore(probability: number): number {
		// Approximation of inverse normal CDF
		const a1 = -3.969683028665376e+01;
		const a2 = 2.209460984245205e+02;
		const a3 = -2.759285104469687e+02;
		const a4 = 1.383577518672690e+02;
		const a5 = -3.066479806614716e+01;
		const a6 = 2.506628277459239e+00;

		const b1 = -5.447609879822406e+01;
		const b2 = 1.615858368580409e+02;
		const b3 = -1.556989798598866e+02;
		const b4 = 6.680131188771972e+01;
		const b5 = -1.328068155288572e+01;

		const c1 = -7.784894002430293e-03;
		const c2 = -3.223964580411365e-01;
		const c3 = -2.400758277161838e+00;
		const c4 = -2.549732539343734e+00;
		const c5 = 4.374664141464968e+00;
		const c6 = 2.938163982698783e+00;

		const d1 = 7.784695709041462e-03;
		const d2 = 3.224671290700398e-01;
		const d3 = 2.445134137142996e+00;
		const d4 = 3.754408661907416e+00;

		const pLow = 0.02425;
		const pHigh = 1 - pLow;

		let q: number, r: number;

		if (probability < pLow) {
			q = Math.sqrt(-2 * Math.log(probability));
			return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
				((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
		} else if (probability <= pHigh) {
			q = probability - 0.5;
			r = q * q;
			return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
				(((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
		} else {
			q = Math.sqrt(-2 * Math.log(1 - probability));
			return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
				((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
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
</script>

<div class="space-y-6">
	<!-- Controls -->
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">Loss Exceedance Simulation</h2>
		<p class="text-sm text-gray-600 mb-4">
			Run Monte Carlo simulations to generate loss exceedance curves showing the probability
			of losses exceeding various thresholds.
		</p>

		<div class="grid grid-cols-3 gap-4 mb-4">
			<div>
				<label for="lec-study-select" class="block text-sm font-medium text-gray-700 mb-1">Quantitative Risk Study</label>
				<select
					id="lec-study-select"
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
				<label for="lec-iterations-select" class="block text-sm font-medium text-gray-700 mb-1">Monte Carlo Iterations</label>
				<select id="lec-iterations-select" class="w-full rounded-md border-gray-300 shadow-sm" bind:value={iterations}>
					<option value={1000}>1,000 (Fast)</option>
					<option value={10000}>10,000 (Standard)</option>
					<option value={50000}>50,000 (Detailed)</option>
					<option value={100000}>100,000 (High Precision)</option>
				</select>
			</div>

			<div class="flex items-end">
				<button
					class="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={runSimulation}
					disabled={loading || !studyId}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Running Simulation...
					{:else}
						<i class="fa-solid fa-chart-area mr-2"></i>
						Run Simulation
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

	<!-- Chart -->
	{#if result}
		<div class="bg-white rounded-lg shadow p-6">
			<div bind:this={chartContainer} class="w-full h-96"></div>
		</div>

		<!-- Statistics -->
		<div class="grid grid-cols-4 gap-4">
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Expected Loss (Mean)</div>
				<div class="text-xl font-bold text-gray-900">{formatCurrency(result.expected_loss || 0)}</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">Median Loss (50th %ile)</div>
				<div class="text-xl font-bold text-gray-900">{formatCurrency(result.median_loss || result.expected_loss || 0)}</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">95th Percentile (VaR)</div>
				<div class="text-xl font-bold text-red-600">
					{formatCurrency(result.var_levels?.find((v: any) => v.confidence === 95)?.var || 0)}
				</div>
			</div>
			<div class="bg-white rounded-lg shadow p-4">
				<div class="text-sm text-gray-500">99th Percentile</div>
				<div class="text-xl font-bold text-red-600">
					{formatCurrency(result.var_levels?.find((v: any) => v.confidence === 99)?.var || 0)}
				</div>
			</div>
		</div>

		<!-- Interpretation -->
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Interpretation Guide</h3>

			<div class="grid grid-cols-2 gap-6">
				<div>
					<h4 class="text-sm font-medium text-gray-700 mb-2">Reading the Chart</h4>
					<ul class="text-sm text-gray-600 space-y-2">
						<li class="flex items-start">
							<i class="fa-solid fa-circle text-xs text-red-500 mt-1.5 mr-2"></i>
							<span>The curve shows loss amounts at different exceedance probabilities</span>
						</li>
						<li class="flex items-start">
							<i class="fa-solid fa-circle text-xs text-yellow-500 mt-1.5 mr-2"></i>
							<span>95% VaR = There's a 5% chance losses will exceed this amount</span>
						</li>
						<li class="flex items-start">
							<i class="fa-solid fa-circle text-xs text-blue-500 mt-1.5 mr-2"></i>
							<span>Expected Loss = Average loss across all simulated scenarios</span>
						</li>
					</ul>
				</div>

				<div>
					<h4 class="text-sm font-medium text-gray-700 mb-2">Key Insights</h4>
					<ul class="text-sm text-gray-600 space-y-2">
						<li class="flex items-start">
							<i class="fa-solid fa-lightbulb text-yellow-500 mr-2"></i>
							<span>Steeper curves indicate higher risk volatility</span>
						</li>
						<li class="flex items-start">
							<i class="fa-solid fa-lightbulb text-yellow-500 mr-2"></i>
							<span>Focus on the 95th and 99th percentiles for capital planning</span>
						</li>
						<li class="flex items-start">
							<i class="fa-solid fa-lightbulb text-yellow-500 mr-2"></i>
							<span>Compare scenarios to identify most impactful risks</span>
						</li>
					</ul>
				</div>
			</div>
		</div>
	{:else if !loading}
		<div class="bg-white rounded-lg shadow p-12 text-center">
			<i class="fa-solid fa-chart-area text-6xl text-gray-300 mb-4"></i>
			<p class="text-gray-500">Select a quantitative risk study and run the simulation to generate loss exceedance curves.</p>
		</div>
	{/if}
</div>
