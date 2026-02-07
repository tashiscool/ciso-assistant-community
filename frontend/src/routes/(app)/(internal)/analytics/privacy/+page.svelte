<script lang="ts">
	import { base } from '$app/paths';
	import { safeTranslate } from '$lib/utils/i18n';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const breadcrumbs = $derived([
		{ label: 'Analytics', href: `${base}/analytics` },
		{ label: 'Privacy Analytics', href: `${base}/analytics/privacy` }
	]);

	const getComplianceColor = (rate: number) => {
		if (rate >= 80) return 'text-green-600';
		if (rate >= 60) return 'text-yellow-600';
		return 'text-red-600';
	};

	const getComplianceLabel = (rate: number) => {
		if (rate >= 80) return 'Strong';
		if (rate >= 60) return 'Moderate';
		return 'Needs Attention';
	};

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			'active': 'bg-green-500',
			'draft': 'bg-gray-500',
			'inactive': 'bg-red-500'
		};
		return colors[status] || 'bg-gray-500';
	};

	const getStatusBadge = (status: string) => {
		const colors: Record<string, string> = {
			'active': 'bg-green-100 text-green-800',
			'draft': 'bg-gray-100 text-gray-800',
			'inactive': 'bg-red-100 text-red-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
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
			Privacy Analytics Dashboard
		</h1>
		<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
			Overview of data processing activities, legal basis distribution, and privacy compliance
		</p>
	</div>

	<!-- Key Metrics -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<!-- Total Processings -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Processings</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.totalProcessings}</p>
						<div class="flex items-center text-sm">
							<span class="text-blue-600 font-medium">All recorded activities</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Active Processings -->
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
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Processings</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.activeProcessings}</p>
						<div class="flex items-center text-sm">
							<span class="text-green-600 font-medium">Currently active</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Draft Processings -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-yellow-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Draft Processings</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.draftProcessings}</p>
						<div class="flex items-center text-sm">
							<span class="text-yellow-600 font-medium">Pending review</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Compliance Rate -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-purple-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Compliance Rate</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.complianceRate}%</p>
						<div class="flex items-center text-sm">
							<span class={`font-medium ${getComplianceColor(data.analytics.complianceRate)}`}>
								{getComplianceLabel(data.analytics.complianceRate)}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Processing Status Distribution -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Processing Status Distribution</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Breakdown of data processing activities by current status</p>
		</div>
		<div class="p-6">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="text-center">
					<div class="text-3xl font-bold text-green-600 mb-2">{data.analytics.activeProcessings}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Active</div>
					<div class="mt-1 text-xs text-green-600">Currently in operation</div>
				</div>
				<div class="text-center">
					<div class="text-3xl font-bold text-yellow-600 mb-2">{data.analytics.draftProcessings}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Draft</div>
					<div class="mt-1 text-xs text-yellow-600">Awaiting finalization</div>
				</div>
				<div class="text-center">
					<div class="text-3xl font-bold text-gray-600 mb-2">{data.analytics.totalProcessings - data.analytics.activeProcessings - data.analytics.draftProcessings}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Other</div>
					<div class="mt-1 text-xs text-gray-600">Inactive or archived</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Legal Basis Breakdown -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Legal Basis Breakdown</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Distribution of processings by their legal basis for data processing</p>
		</div>
		<div class="p-6">
			{#if Object.keys(data.analytics.legalBasis).length > 0}
				<div class="space-y-4">
					{#each Object.entries(data.analytics.legalBasis) as [basis, count]}
						<div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
							<div class="flex-1">
								<div class="flex items-center justify-between mb-2">
									<h4 class="text-sm font-medium text-gray-900 dark:text-white">{safeTranslate(basis)}</h4>
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
										{count} {count === 1 ? 'processing' : 'processings'}
									</span>
								</div>
								<div class="flex items-center">
									<div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
										<div
											class="bg-blue-600 h-2 rounded-full transition-all duration-300"
											style="width: {data.analytics.totalProcessings > 0 ? Math.round((count / data.analytics.totalProcessings) * 100) : 0}%"
										></div>
									</div>
									<span class="ml-3 text-sm font-medium text-gray-500 dark:text-gray-400">
										{data.analytics.totalProcessings > 0 ? Math.round((count / data.analytics.totalProcessings) * 100) : 0}%
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400">No legal basis data available.</p>
			{/if}
		</div>
	</div>

	<!-- Recent Processings -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Recent Processings</h3>
		</div>
		<div class="p-6">
			{#if data.analytics.recentProcessings.length > 0}
				<div class="space-y-4">
					{#each data.analytics.recentProcessings as processing}
						<div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<div class={`h-8 w-8 rounded-full flex items-center justify-center ${getStatusColor(processing.status)}`}>
										<svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
										</svg>
									</div>
								</div>
								<div class="ml-3">
									<p class="text-sm font-medium text-gray-900 dark:text-white">
										{processing.name || 'Unnamed Processing'}
									</p>
									<p class="text-sm text-gray-500 dark:text-gray-400">
										Legal basis: {safeTranslate(processing.legal_basis || 'unknown')}
									</p>
								</div>
							</div>
							<div class="flex items-center">
								<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-3 ${getStatusBadge(processing.status)}`}>
									{processing.status || 'unknown'}
								</span>
								<a
									href={`${base}/processings/${processing.id}`}
									class="text-blue-600 hover:text-blue-500 text-sm font-medium"
								>
									View Details →
								</a>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400">No processings found.</p>
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
					href={`${base}/processings`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">View All Processings</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Browse all data processing activities</p>
					</div>
				</a>

				<a
					href={`${base}/processings?status=draft`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">Review Drafts</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Finalize draft processings</p>
					</div>
				</a>

				<a
					href={`${base}/processings`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">New Processing</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Register a new data processing activity</p>
					</div>
				</a>
			</div>
		</div>
	</div>
</div>
