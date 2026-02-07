<script lang="ts">
	import { base } from '$app/paths';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const breadcrumbs = $derived([
		{ label: 'Analytics', href: `${base}/analytics` },
		{ label: 'Risk Analytics', href: `${base}/analytics/risks` }
	]);

	const getSeverityColor = (level: string) => {
		const colors: Record<string, string> = {
			critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
			high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
			medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
			low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
		};
		return colors[level] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
	};

	const getTreatmentColor = (treatment: string) => {
		const colors: Record<string, string> = {
			mitigate: 'text-blue-600 dark:text-blue-400',
			accept: 'text-green-600 dark:text-green-400',
			open: 'text-red-600 dark:text-red-400'
		};
		return colors[treatment] || 'text-gray-600 dark:text-gray-400';
	};
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
			Risk Analytics Dashboard
		</h1>
		<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
			Comprehensive risk scenario analysis and treatment metrics
		</p>
	</div>

	<!-- Key Risk Metrics -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<!-- Total Scenarios -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Scenarios</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.totalScenarios}</p>
						<div class="flex items-center text-sm">
							<span class="text-blue-600 dark:text-blue-400 font-medium">Risk scenarios tracked</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Critical/High -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Critical / High</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.criticalScenarios + data.analytics.highScenarios}</p>
						<div class="flex items-center text-sm">
							<span class="text-red-600 dark:text-red-400 font-medium">{data.analytics.criticalScenarios} critical</span>
							<span class="text-gray-400 mx-2">&#8226;</span>
							<span class="text-orange-600 dark:text-orange-400 font-medium">{data.analytics.highScenarios} high</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Treatment Rate -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Treatment Rate</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.riskReductionRate}%</p>
						<div class="flex items-center text-sm">
							<span class="{data.analytics.riskReductionRate >= 70 ? 'text-green-600 dark:text-green-400' : data.analytics.riskReductionRate >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'} font-medium">
								{data.analytics.treatedScenarios} of {data.analytics.totalScenarios} treated
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Total Assessments -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-purple-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assessments</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.totalAssessments}</p>
						<div class="flex items-center text-sm">
							<span class="text-purple-600 dark:text-purple-400 font-medium">Risk assessments conducted</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Severity Distribution -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Risk Severity Distribution</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Breakdown of risk scenarios by current severity level</p>
		</div>
		<div class="p-6">
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="text-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">{data.analytics.criticalScenarios}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Critical</div>
					<span class="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium {getSeverityColor('critical')}">
						Level 3-4
					</span>
				</div>
				<div class="text-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">{data.analytics.highScenarios}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">High</div>
					<span class="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium {getSeverityColor('high')}">
						Level 2
					</span>
				</div>
				<div class="text-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">{data.analytics.mediumScenarios}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Medium</div>
					<span class="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium {getSeverityColor('medium')}">
						Level 1
					</span>
				</div>
				<div class="text-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">{data.analytics.lowScenarios}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Low</div>
					<span class="inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium {getSeverityColor('low')}">
						Level 0
					</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Treatment Status -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Treatment Status</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Risk scenario treatment progress overview</p>
		</div>
		<div class="p-6">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="text-center p-6 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">{data.analytics.treatedScenarios}</div>
					<div class="text-sm font-medium text-gray-500 dark:text-gray-400">Treated Scenarios</div>
					<div class="mt-2 text-xs text-green-600 dark:text-green-400">Mitigated or accepted</div>
					{#if data.analytics.totalScenarios > 0}
						<div class="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
							<div
								class="bg-green-500 h-2 rounded-full transition-all duration-300"
								style="width: {data.analytics.riskReductionRate}%"
							></div>
						</div>
					{/if}
				</div>
				<div class="text-center p-6 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">{data.analytics.untreatedScenarios}</div>
					<div class="text-sm font-medium text-gray-500 dark:text-gray-400">Untreated Scenarios</div>
					<div class="mt-2 text-xs text-red-600 dark:text-red-400">Open or no treatment assigned</div>
					{#if data.analytics.totalScenarios > 0}
						<div class="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
							<div
								class="bg-red-500 h-2 rounded-full transition-all duration-300"
								style="width: {Math.round((data.analytics.untreatedScenarios / data.analytics.totalScenarios) * 100)}%"
							></div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Recent Scenarios -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Recent Risk Scenarios</h3>
		</div>
		<div class="p-6">
			{#if data.analytics.recentScenarios.length > 0}
				<div class="space-y-4">
					{#each data.analytics.recentScenarios as scenario}
						<div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<div class={`h-8 w-8 rounded-full flex items-center justify-center ${
										scenario.current_level >= 3 ? 'bg-red-500' :
										scenario.current_level === 2 ? 'bg-orange-500' :
										scenario.current_level === 1 ? 'bg-yellow-500' :
										'bg-green-500'
									}`}>
										<svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"/>
										</svg>
									</div>
								</div>
								<div class="ml-3">
									<p class="text-sm font-medium text-gray-900 dark:text-white">
										{scenario.name || scenario.rid || 'Unnamed Scenario'}
									</p>
									<p class="text-sm text-gray-500 dark:text-gray-400">
										Treatment: <span class="{getTreatmentColor(scenario.treatment || 'open')}">{scenario.treatment || 'open'}</span>
									</p>
								</div>
							</div>
							<div class="flex items-center">
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-3 {
									scenario.current_level >= 3 ? getSeverityColor('critical') :
									scenario.current_level === 2 ? getSeverityColor('high') :
									scenario.current_level === 1 ? getSeverityColor('medium') :
									getSeverityColor('low')
								}">
									{scenario.current_level >= 3 ? 'Critical' :
									 scenario.current_level === 2 ? 'High' :
									 scenario.current_level === 1 ? 'Medium' : 'Low'}
								</span>
								{#if scenario.id}
									<a
										href={`${base}/risk-scenarios/${scenario.id}`}
										class="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
									>
										View Details &rarr;
									</a>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400">No risk scenarios found.</p>
			{/if}
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Quick Actions</h3>
		</div>
		<div class="p-6">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<a
					href={`${base}/risk-scenarios`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">Risk Scenarios</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">View and manage risk scenarios</p>
					</div>
				</a>

				<a
					href={`${base}/risk-assessments`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">Risk Assessments</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Browse risk assessment reports</p>
					</div>
				</a>

				<a
					href={`${base}/risk-matrices`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">Risk Matrices</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Configure risk assessment matrices</p>
					</div>
				</a>
			</div>
		</div>
	</div>
</div>
