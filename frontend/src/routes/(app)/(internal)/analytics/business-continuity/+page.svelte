<script lang="ts">
	import { base } from '$app/paths';
	import { safeTranslate } from '$lib/utils/i18n';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const breadcrumbs = $derived([
		{ label: 'Analytics', href: `${base}/analytics` },
		{ label: 'Business Continuity Analytics', href: `${base}/analytics/business-continuity` }
	]);

	const getCoverageColor = (rate: number) => {
		if (rate >= 80) return 'text-green-600';
		if (rate >= 50) return 'text-yellow-600';
		return 'text-red-600';
	};

	const getCoverageLabel = (rate: number) => {
		if (rate >= 80) return 'Strong';
		if (rate >= 50) return 'Moderate';
		return 'Needs Attention';
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
			Business Continuity Analytics Dashboard
		</h1>
		<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
			Overview of business continuity plans, testing status, and readiness metrics
		</p>
	</div>

	<!-- Key Metrics -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<!-- Total Plans -->
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
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Plans</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.totalPlans}</p>
						<div class="flex items-center text-sm">
							<span class="text-blue-600 font-medium">All BCP plans</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Active Plans -->
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
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Plans</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.activePlans}</p>
						<div class="flex items-center text-sm">
							<span class="text-green-600 font-medium">Currently active</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Test Coverage Rate -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-yellow-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Test Coverage Rate</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.testCoverageRate}%</p>
						<div class="flex items-center text-sm">
							<span class={`font-medium ${getCoverageColor(data.analytics.testCoverageRate)}`}>
								{getCoverageLabel(data.analytics.testCoverageRate)}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Expired Plans -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-6">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<div class="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center">
							<svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Expired Plans</p>
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.expiredPlans}</p>
						<div class="flex items-center text-sm">
							<span class="text-red-600 font-medium">Require renewal</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Plan Status Distribution -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Plan Status Distribution</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Breakdown of plans by current status</p>
		</div>
		<div class="p-6">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div class="text-center">
					<div class="text-3xl font-bold text-green-600 mb-2">{data.analytics.activePlans}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Active</div>
					<div class="mt-1 text-xs text-green-600">Approved and operational</div>
				</div>
				<div class="text-center">
					<div class="text-3xl font-bold text-blue-600 mb-2">{data.analytics.draftPlans}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Draft</div>
					<div class="mt-1 text-xs text-blue-600">Under development</div>
				</div>
				<div class="text-center">
					<div class="text-3xl font-bold text-red-600 mb-2">{data.analytics.expiredPlans}</div>
					<div class="text-sm text-gray-500 dark:text-gray-400">Expired</div>
					<div class="mt-1 text-xs text-red-600">Retired or expired</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Testing Status -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Testing Status</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Plans tested vs untested</p>
		</div>
		<div class="p-6">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="flex-shrink-0">
						<div class="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
							<svg class="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.testedPlans}</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Tested Plans</p>
						<p class="text-xs text-green-600">Validated through exercises</p>
					</div>
				</div>
				<div class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
					<div class="flex-shrink-0">
						<div class="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
							<svg class="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"/>
							</svg>
						</div>
					</div>
					<div class="ml-4">
						<p class="text-2xl font-semibold text-gray-900 dark:text-white">{data.analytics.untestedPlans}</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Untested Plans</p>
						<p class="text-xs text-orange-600">Pending validation</p>
					</div>
				</div>
			</div>
			{#if data.analytics.totalPlans > 0}
				<div class="mt-4">
					<div class="flex items-center justify-between mb-1">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Test Coverage</span>
						<span class={`text-sm font-semibold ${getCoverageColor(data.analytics.testCoverageRate)}`}>
							{data.analytics.testCoverageRate}%
						</span>
					</div>
					<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
						<div
							class="bg-green-600 h-2.5 rounded-full transition-all duration-300"
							style="width: {data.analytics.testCoverageRate}%"
						></div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Recent Plans -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h3 class="text-lg font-medium text-gray-900 dark:text-white">Recent Plans</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Latest business continuity plans</p>
		</div>
		<div class="p-6">
			{#if data.analytics.recentPlans.length > 0}
				<div class="space-y-4">
					{#each data.analytics.recentPlans as plan}
						<div class="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<div class={`h-8 w-8 rounded-full flex items-center justify-center ${
										(plan.status === 'active' || plan.lifecycle_state === 'approved') ? 'bg-green-500' :
										(plan.status === 'draft' || plan.lifecycle_state === 'draft') ? 'bg-blue-500' :
										'bg-gray-500'
									}`}>
										<svg class="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
										</svg>
									</div>
								</div>
								<div class="ml-3">
									<p class="text-sm font-medium text-gray-900 dark:text-white">
										{plan.name || plan.ref_id || 'Unnamed Plan'}
									</p>
									<p class="text-sm text-gray-500 dark:text-gray-400">
										Status: {plan.status || plan.lifecycle_state || 'Unknown'}
										{#if plan.last_test_date}
											 | Last tested: {plan.last_test_date}
										{/if}
									</p>
								</div>
							</div>
							<div class="flex items-center">
								<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-3 ${
									(plan.status === 'active' || plan.lifecycle_state === 'approved') ? 'bg-green-100 text-green-800' :
									(plan.status === 'draft' || plan.lifecycle_state === 'draft') ? 'bg-blue-100 text-blue-800' :
									(plan.status === 'expired' || plan.lifecycle_state === 'retired') ? 'bg-red-100 text-red-800' :
									'bg-gray-100 text-gray-800'
								}`}>
									{plan.status || plan.lifecycle_state || 'Unknown'}
								</span>
								{#if plan.id}
									<a
										href={`${base}/business-continuity/bcp-plans/${plan.id}`}
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
				<p class="text-sm text-gray-500 dark:text-gray-400">No business continuity plans found.</p>
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
					href={`${base}/business-continuity`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">View All Plans</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Browse business continuity plans</p>
					</div>
				</a>

				<a
					href={`${base}/business-continuity/bcp-plans`}
					class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm font-medium text-gray-900 dark:text-white">Manage BCP Plans</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Create or edit continuity plans</p>
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
						<p class="text-sm font-medium text-gray-900 dark:text-white">All Analytics</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">Return to analytics overview</p>
					</div>
				</a>
			</div>
		</div>
	</div>
</div>
