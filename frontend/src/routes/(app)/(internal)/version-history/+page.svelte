<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { BASE_API_URL } from '$lib/utils/constants';
	import {
		type Version,
		CHANGE_TYPE_COLORS,
		CHANGE_TYPE_ICONS,
		formatVersionDate,
		formatFieldName
	} from '$lib/components/TimeTravel';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let versions = $state<Version[]>(data.versions || []);
	let count = $state(data.count || 0);
	let expandedId = $state<string | null>(null);
	let restoring = $state<string | null>(null);
	let restoreError = $state('');

	const changeTypeColors: Record<string, string> = {
		create: 'bg-green-100 text-green-800',
		update: 'bg-blue-100 text-blue-800',
		delete: 'bg-red-100 text-red-800',
		restore: 'bg-yellow-100 text-yellow-800',
		import: 'bg-purple-100 text-purple-800',
		bulk: 'bg-gray-100 text-gray-800'
	};

	const changeTypeIcons: Record<string, string> = {
		create: 'fa-plus-circle',
		update: 'fa-pen',
		delete: 'fa-trash',
		restore: 'fa-undo',
		import: 'fa-file-import',
		bulk: 'fa-layer-group'
	};

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	async function restoreVersion(id: string) {
		if (!confirm('Restore to this version? The current state will be overwritten.')) return;
		restoring = id;
		restoreError = '';
		try {
			const res = await fetch(`${BASE_API_URL}/version-history/${id}/restore/`, {
				method: 'POST'
			});
			if (res.ok) {
				alert('Version restored successfully.');
				goto($page.url.pathname);
			} else {
				const err = await res.json();
				restoreError = err.detail || err.error || 'Failed to restore version.';
			}
		} catch {
			restoreError = 'Network error. Please try again.';
		} finally {
			restoring = null;
		}
	}
</script>

<svelte:head>
	<title>Version History — Time Travel</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
			<i class="fa-solid fa-clock-rotate-left text-primary-600 mr-3"></i>
			Version History
		</h1>
		<p class="mt-2 text-gray-600 dark:text-gray-400">
			Browse the complete audit trail of changes across the platform. Restore any prior state.
		</p>
		{#if count > 0}
			<p class="mt-1 text-sm text-gray-500">{count} total change{count !== 1 ? 's' : ''} recorded</p>
		{/if}
	</div>

	{#if restoreError}
		<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
			<p class="text-sm text-red-700">{restoreError}</p>
		</div>
	{/if}

	{#if versions.length === 0}
		<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
			<i class="fa-solid fa-clock-rotate-left text-6xl text-gray-300 mb-4"></i>
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No version history yet</h3>
			<p class="text-gray-500">Changes will appear here as objects are created, updated, or deleted.</p>
		</div>
	{:else}
		<!-- Timeline -->
		<div class="relative">
			<!-- Vertical line -->
			<div class="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

			<div class="space-y-4">
				{#each versions as version}
					<div class="relative flex gap-4">
						<!-- Icon bubble on timeline -->
						<div class="relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-2 border-white dark:border-gray-900 shadow flex items-center justify-center
							{version.changeType === 'create' ? 'bg-green-100' :
							 version.changeType === 'update' ? 'bg-blue-100' :
							 version.changeType === 'delete' ? 'bg-red-100' :
							 version.changeType === 'restore' ? 'bg-yellow-100' :
							 'bg-gray-100'}">
							<i class="fa-solid {changeTypeIcons[version.changeType] || 'fa-circle'} text-sm
								{version.changeType === 'create' ? 'text-green-600' :
								 version.changeType === 'update' ? 'text-blue-600' :
								 version.changeType === 'delete' ? 'text-red-600' :
								 version.changeType === 'restore' ? 'text-yellow-600' :
								 'text-gray-600'}"></i>
						</div>

						<!-- Card -->
						<div class="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
							<div class="p-4">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="flex items-center gap-2 flex-wrap mb-1">
											<span class="px-2 py-0.5 text-xs font-medium rounded-full {changeTypeColors[version.changeType] || 'bg-gray-100 text-gray-700'}">
												{version.changeType}
											</span>
											{#if version.versionLabel}
												<span class="text-xs text-gray-500 font-mono">v{version.versionNumber} · {version.versionLabel}</span>
											{:else}
												<span class="text-xs text-gray-500 font-mono">v{version.versionNumber}</span>
											{/if}
										</div>
										<p class="text-sm font-medium text-gray-900 dark:text-white">{version.changeSummary}</p>
										{#if version.changedFields?.length > 0}
											<p class="text-xs text-gray-500 mt-0.5">
												Fields: {version.changedFields.map(formatFieldName).join(', ')}
											</p>
										{/if}
									</div>
									<div class="ml-4 text-right flex-shrink-0">
										<p class="text-xs text-gray-500">{formatVersionDate(version.createdAt)}</p>
										{#if version.createdByName}
											<p class="text-xs text-gray-400 mt-0.5">{version.createdByName}</p>
										{/if}
									</div>
								</div>

								<!-- Actions -->
								<div class="mt-3 flex gap-2">
									<button
										class="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
										onclick={() => toggleExpand(version.id)}
									>
										<i class="fa-solid fa-code mr-1"></i>
										{expandedId === version.id ? 'Hide' : 'View'} Snapshot
									</button>
									{#if version.changeType !== 'delete'}
										<button
											class="text-xs px-2 py-1 border border-amber-200 rounded hover:bg-amber-50 text-amber-700 disabled:opacity-50"
											onclick={() => restoreVersion(version.id)}
											disabled={restoring === version.id}
										>
											{#if restoring === version.id}
												<i class="fa-solid fa-spinner fa-spin mr-1"></i>
											{:else}
												<i class="fa-solid fa-undo mr-1"></i>
											{/if}
											Restore
										</button>
									{/if}
								</div>

								<!-- Snapshot viewer -->
								{#if expandedId === version.id && version.snapshotData}
									<div class="mt-3 bg-gray-900 rounded p-3 overflow-auto max-h-64">
										<pre class="text-green-400 text-xs"><code>{JSON.stringify(version.snapshotData, null, 2)}</code></pre>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Pagination -->
		{#if data.next || data.previous}
			<div class="mt-8 flex justify-between">
				<button
					class="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 text-gray-700"
					disabled={!data.previous}
					onclick={() => goto(`?page=${parseInt($page.url.searchParams.get('page') || '1') - 1}`)}
				>
					<i class="fa-solid fa-arrow-left mr-2"></i>Previous
				</button>
				<button
					class="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 text-gray-700"
					disabled={!data.next}
					onclick={() => goto(`?page=${parseInt($page.url.searchParams.get('page') || '1') + 1}`)}
				>
					Next<i class="fa-solid fa-arrow-right ml-2"></i>
				</button>
			</div>
		{/if}
	{/if}
</div>
