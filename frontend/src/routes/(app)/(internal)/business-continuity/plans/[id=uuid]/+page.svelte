<script lang="ts">
	import { base } from '$app/paths';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const breadcrumbs = $derived([
		{ label: 'Business Continuity', href: `${base}/business-continuity` },
		{ label: 'Plans', href: `${base}/business-continuity/plans` },
		{ label: data.plan.plan_name || data.plan.name || 'Plan Detail', href: '' }
	]);

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			active: 'bg-green-100 text-green-800',
			approved: 'bg-green-100 text-green-800',
			draft: 'bg-yellow-100 text-yellow-800',
			expired: 'bg-red-100 text-red-800',
			retired: 'bg-gray-100 text-gray-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	};

	const getTaskStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			open: 'bg-gray-100 text-gray-800',
			in_progress: 'bg-blue-100 text-blue-800',
			done: 'bg-green-100 text-green-800',
			blocked: 'bg-red-100 text-red-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	};
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
	<!-- Plan Header -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				{data.plan.plan_name || data.plan.name}
			</h1>
			<span class={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(data.plan.status || data.plan.lifecycle_state)}`}>
				{data.plan.status || data.plan.lifecycle_state}
			</span>
		</div>
		{#if data.plan.description}
			<p class="text-gray-600 dark:text-gray-400 mb-4">{data.plan.description}</p>
		{/if}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
			<div>
				<span class="text-gray-500 dark:text-gray-400">Business Impact</span>
				<p class="font-medium text-gray-900 dark:text-white">{data.plan.business_impact || 'N/A'}</p>
			</div>
			<div>
				<span class="text-gray-500 dark:text-gray-400">Last Tested</span>
				<p class="font-medium text-gray-900 dark:text-white">
					{data.plan.last_test_date ? new Date(data.plan.last_test_date).toLocaleDateString() : 'Never'}
				</p>
			</div>
			<div>
				<span class="text-gray-500 dark:text-gray-400">Created</span>
				<p class="font-medium text-gray-900 dark:text-white">{new Date(data.plan.created_at).toLocaleDateString()}</p>
			</div>
			<div>
				<span class="text-gray-500 dark:text-gray-400">Updated</span>
				<p class="font-medium text-gray-900 dark:text-white">{new Date(data.plan.updated_at).toLocaleDateString()}</p>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Tasks -->
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">Tasks ({data.tasks.length})</h3>
			</div>
			<div class="p-6">
				{#if data.tasks.length > 0}
					<div class="space-y-3">
						{#each data.tasks as task}
							<div class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
								<div>
									<p class="text-sm font-medium text-gray-900 dark:text-white">{task.title}</p>
									{#if task.due_date}
										<p class="text-xs text-gray-500 dark:text-gray-400">Due: {new Date(task.due_date).toLocaleDateString()}</p>
									{/if}
								</div>
								<span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTaskStatusColor(task.lifecycle_state)}`}>
									{task.lifecycle_state}
								</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-gray-500 dark:text-gray-400">No tasks assigned to this plan.</p>
				{/if}
			</div>
		</div>

		<!-- Audits / Tests -->
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">Audits & Tests ({data.audits.length})</h3>
			</div>
			<div class="p-6">
				{#if data.audits.length > 0}
					<div class="space-y-3">
						{#each data.audits as audit}
							<div class="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
								<div>
									<p class="text-sm font-medium text-gray-900 dark:text-white">{audit.name}</p>
									{#if audit.performed_at}
										<p class="text-xs text-gray-500 dark:text-gray-400">Performed: {new Date(audit.performed_at).toLocaleDateString()}</p>
									{/if}
								</div>
								<div class="flex items-center gap-2">
									{#if audit.outcome}
										<span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
											audit.outcome === 'pass' ? 'bg-green-100 text-green-800' :
											audit.outcome === 'partial' ? 'bg-yellow-100 text-yellow-800' :
											'bg-red-100 text-red-800'
										}`}>
											{audit.outcome}
										</span>
									{/if}
									<span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(audit.lifecycle_state)}`}>
										{audit.lifecycle_state}
									</span>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-gray-500 dark:text-gray-400">No audits recorded for this plan.</p>
				{/if}
			</div>
		</div>
	</div>
</div>
