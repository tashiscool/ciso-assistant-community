<script lang="ts">
	import { base } from '$app/paths';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const breadcrumbs = $derived([
		{ label: 'Business Continuity', href: `${base}/business-continuity` },
		{ label: 'Plans', href: `${base}/business-continuity/plans` }
	]);

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			active: 'bg-green-100 text-green-800',
			draft: 'bg-yellow-100 text-yellow-800',
			expired: 'bg-red-100 text-red-800',
			retired: 'bg-gray-100 text-gray-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	};

	const getImpactColor = (impact: string) => {
		const colors: Record<string, string> = {
			high: 'bg-red-100 text-red-800',
			medium: 'bg-yellow-100 text-yellow-800',
			low: 'bg-green-100 text-green-800'
		};
		return colors[impact] || 'bg-gray-100 text-gray-800';
	};
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Business Continuity Plans</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{data.count} plans total</p>
		</div>
		<a
			href={`${base}/business-continuity/plans/new`}
			class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
		>
			<svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
			</svg>
			New Plan
		</a>
	</div>

	<!-- Filter Bar -->
	<div class="mb-6 flex gap-2">
		<a href={`${base}/business-continuity/plans`}
			class="px-3 py-1 rounded-full text-sm font-medium {!data.filters.status && !data.filters.impact ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
		>All</a>
		<a href={`${base}/business-continuity/plans?status=active`}
			class="px-3 py-1 rounded-full text-sm font-medium {data.filters.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
		>Active</a>
		<a href={`${base}/business-continuity/plans?status=draft`}
			class="px-3 py-1 rounded-full text-sm font-medium {data.filters.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
		>Draft</a>
		<a href={`${base}/business-continuity/plans?impact=high`}
			class="px-3 py-1 rounded-full text-sm font-medium {data.filters.impact === 'high' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
		>High Impact</a>
	</div>

	<!-- Plans List -->
	{#if data.plans.length > 0}
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-700">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Plan Name</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Impact</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Tested</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each data.plans as plan}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-6 py-4">
								<div>
									<p class="text-sm font-medium text-gray-900 dark:text-white">{plan.plan_name || plan.name}</p>
									<p class="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{plan.description || ''}</p>
								</div>
							</td>
							<td class="px-6 py-4">
								<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(plan.status || plan.lifecycle_state)}`}>
									{plan.status || plan.lifecycle_state}
								</span>
							</td>
							<td class="px-6 py-4">
								<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getImpactColor(plan.business_impact || '')}`}>
									{plan.business_impact || 'N/A'}
								</span>
							</td>
							<td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
								{plan.last_test_date ? new Date(plan.last_test_date).toLocaleDateString() : 'Never'}
							</td>
							<td class="px-6 py-4">
								<a href={`${base}/business-continuity/plans/${plan.id}`}
									class="text-blue-600 hover:text-blue-500 text-sm font-medium">
									View
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
			<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No BCP Plans</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating your first business continuity plan.</p>
			<div class="mt-6">
				<a href={`${base}/business-continuity/plans/new`}
					class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
					Create Plan
				</a>
			</div>
		</div>
	{/if}
</div>
