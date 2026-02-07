<script lang="ts">
	import { base } from '$app/paths';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const breadcrumbs = $derived([
		{ label: 'Business Continuity', href: `${base}/business-continuity` },
		{ label: 'Tests & Exercises', href: `${base}/business-continuity/tests` }
	]);

	const getOutcomeColor = (outcome: string) => {
		const colors: Record<string, string> = {
			pass: 'bg-green-100 text-green-800',
			partial: 'bg-yellow-100 text-yellow-800',
			fail: 'bg-red-100 text-red-800'
		};
		return colors[outcome] || 'bg-gray-100 text-gray-800';
	};

	const getStateColor = (state: string) => {
		const colors: Record<string, string> = {
			planned: 'bg-gray-100 text-gray-800',
			in_progress: 'bg-blue-100 text-blue-800',
			completed: 'bg-green-100 text-green-800'
		};
		return colors[state] || 'bg-gray-100 text-gray-800';
	};
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">BCP Tests & Exercises</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{data.count} tests total</p>
		</div>
		<a
			href={`${base}/business-continuity/tests/new`}
			class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
		>
			<svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
			</svg>
			Schedule Test
		</a>
	</div>

	{#if data.audits.length > 0}
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-700">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Test Name</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Outcome</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each data.audits as audit}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-6 py-4">
								<p class="text-sm font-medium text-gray-900 dark:text-white">{audit.name}</p>
								{#if audit.description}
									<p class="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{audit.description}</p>
								{/if}
							</td>
							<td class="px-6 py-4">
								<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(audit.lifecycle_state)}`}>
									{audit.lifecycle_state}
								</span>
							</td>
							<td class="px-6 py-4">
								{#if audit.outcome}
									<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOutcomeColor(audit.outcome)}`}>
										{audit.outcome}
									</span>
								{:else}
									<span class="text-sm text-gray-400">Pending</span>
								{/if}
							</td>
							<td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
								{audit.performed_at ? new Date(audit.performed_at).toLocaleDateString() : 'Not yet'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center">
			<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No BCP Tests</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Schedule your first business continuity test or exercise.</p>
			<div class="mt-6">
				<a href={`${base}/business-continuity/tests/new`}
					class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
					Schedule Test
				</a>
			</div>
		</div>
	{/if}
</div>
