<script lang="ts">
	import { base } from '$app/paths';
	import { safeTranslate } from '$lib/utils/i18n';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const breadcrumbs = $derived([
		{ label: 'Analytics', href: `${base}/analytics` },
		{ label: 'Security Analytics', href: `${base}/analytics/security` }
	]);

	const getSeverityColor = (severity: string) => {
		const colors: Record<string, string> = {
			'critical': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
			'high': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
			'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
			'low': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
		};
		return colors[severity] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
	};

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			'open': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
			'in_progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
			'resolved': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
			'closed': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
		};
		return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
	};

	const getRateColor = (rate: number) => {
		if (rate >= 80) return 'text-green-600';
		if (rate >= 60) return 'text-yellow-600';
		return 'text-red-600';
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
			Security Analytics Dashboard
		</h1>
		<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
			Security incident tracking, severity distribution, and response metrics
		</p>
	</div>

	<!-- Key Metrics -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<!-- Total Incidents -->
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
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Incidents</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.totalIncidents}</p>
						<div class="flex items-center text-sm">
							<span class="text-blue-600 font-medium">All time</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Active Incidents -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Incidents</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.activeIncidents}</p>
						<div class="flex items-center text-sm">
							<span class="text-red-600 font-medium">Require attention</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Resolution Rate -->
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
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Resolution Rate</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.resolutionRate}%</p>
						<div class="flex items-center text-sm">
							<span class={`font-medium ${getRateColor(data.analytics.resolutionRate)}`}>
								{data.analytics.resolutionRate >= 80 ? 'Strong' :
								 data.analytics.resolutionRate >= 60 ? 'Moderate' : 'Needs Improvement'}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- SLA Compliance -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-purple-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">SLA Compliance</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.slaComplianceRate}%</p>
						<div class="flex items-center text-sm">
							<span class={`font-medium ${getRateColor(data.analytics.slaComplianceRate)}`}>
								{data.analytics.slaComplianceRate >= 80 ? 'On Track' :
								 data.analytics.slaComplianceRate >= 60 ? 'At Risk' : 'Breaching'}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Severity Distribution -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Severity Distribution</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Incident breakdown by severity level</p>
		</div>
		<div class="p-6">
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="text-center p-4 border border-red-200 dark:border-red-800 rounded-lg">
					<div class="text-3xl font-bold text-red-600 mb-2">{data.analytics.criticalIncidents}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Critical</div>
					<div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
						<div
							class="bg-red-600 h-2 rounded-full transition-all duration-300"
							style="width: {data.analytics.totalIncidents > 0 ? Math.round((data.analytics.criticalIncidents / data.analytics.totalIncidents) * 100) : 0}%"
						></div>
					</div>
				</div>
				<div class="text-center p-4 border border-orange-200 dark:border-orange-800 rounded-lg">
					<div class="text-3xl font-bold text-orange-600 mb-2">{data.analytics.highIncidents}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">High</div>
					<div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
						<div
							class="bg-orange-600 h-2 rounded-full transition-all duration-300"
							style="width: {data.analytics.totalIncidents > 0 ? Math.round((data.analytics.highIncidents / data.analytics.totalIncidents) * 100) : 0}%"
						></div>
					</div>
				</div>
				<div class="text-center p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg">
					<div class="text-3xl font-bold text-yellow-600 mb-2">{data.analytics.mediumIncidents}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Medium</div>
					<div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
						<div
							class="bg-yellow-600 h-2 rounded-full transition-all duration-300"
							style="width: {data.analytics.totalIncidents > 0 ? Math.round((data.analytics.mediumIncidents / data.analytics.totalIncidents) * 100) : 0}%"
						></div>
					</div>
				</div>
				<div class="text-center p-4 border border-green-200 dark:border-green-800 rounded-lg">
					<div class="text-3xl font-bold text-green-600 mb-2">{data.analytics.lowIncidents}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Low</div>
					<div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
						<div
							class="bg-green-600 h-2 rounded-full transition-all duration-300"
							style="width: {data.analytics.totalIncidents > 0 ? Math.round((data.analytics.lowIncidents / data.analytics.totalIncidents) * 100) : 0}%"
						></div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Active vs Resolved Status -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Incident Status Overview</h3>
		</div>
		<div class="p-6">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="text-center p-6 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="text-4xl font-bold text-red-600 mb-2">{data.analytics.activeIncidents}</div>
					<div class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Incidents</div>
					<div class="mt-1 text-xs text-red-600">Open or In Progress</div>
					<div class="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
						<div
							class="bg-red-500 h-3 rounded-full transition-all duration-300"
							style="width: {data.analytics.totalIncidents > 0 ? Math.round((data.analytics.activeIncidents / data.analytics.totalIncidents) * 100) : 0}%"
						></div>
					</div>
				</div>
				<div class="text-center p-6 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="text-4xl font-bold text-green-600 mb-2">{data.analytics.resolvedIncidents}</div>
					<div class="text-sm font-medium text-gray-500 dark:text-gray-400">Resolved Incidents</div>
					<div class="mt-1 text-xs text-green-600">Resolved or Closed</div>
					<div class="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
						<div
							class="bg-green-500 h-3 rounded-full transition-all duration-300"
							style="width: {data.analytics.totalIncidents > 0 ? Math.round((data.analytics.resolvedIncidents / data.analytics.totalIncidents) * 100) : 0}%"
						></div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Recent Incidents -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Recent Incidents</h3>
		</div>
		<div class="p-6">
			{#if data.analytics.recentIncidents.length > 0}
				<div class="space-y-4">
					{#each data.analytics.recentIncidents as incident}
						<div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<div class={`h-8 w-8 rounded-full flex items-center justify-center ${
										incident.status === 'open' ? 'bg-red-500' :
										incident.status === 'in_progress' ? 'bg-blue-500' :
										incident.status === 'resolved' ? 'bg-green-500' :
										'bg-gray-500'
									}`}>
										<svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"/>
										</svg>
									</div>
								</div>
								<div class="ml-3">
									<p class="text-sm font-medium text-gray-900 dark:text-white">
										{incident.name || incident.title || 'Incident'}
									</p>
									<p class="text-sm text-gray-500 dark:text-gray-400">
										Status: {incident.status || 'unknown'}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-2">
								{#if incident.severity}
									<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(
										typeof incident.severity === 'number' ?
											(incident.severity >= 4 ? 'critical' : incident.severity >= 3 ? 'high' : incident.severity >= 2 ? 'medium' : 'low') :
											incident.severity
									)}`}>
										{typeof incident.severity === 'number' ?
											(incident.severity >= 4 ? 'Critical' : incident.severity >= 3 ? 'High' : incident.severity >= 2 ? 'Medium' : 'Low') :
											incident.severity}
									</span>
								{/if}
								<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(incident.status)}`}>
									{incident.status}
								</span>
								{#if incident.id}
									<a
										href={`${base}/incidents/${incident.id}`}
										class="text-blue-600 hover:text-blue-500 text-sm font-medium"
									>
										View Details
									</a>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400">No incidents found.</p>
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
					href={`${base}/incidents`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">View All Incidents</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Browse and manage incidents</p>
					</div>
				</a>

				<a
					href={`${base}/incidents`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">Report Incident</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Create a new security incident</p>
					</div>
				</a>

				<a
					href={`${base}/analytics`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">Analytics Overview</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Return to analytics hub</p>
					</div>
				</a>
			</div>
		</div>
	</div>
</div>
