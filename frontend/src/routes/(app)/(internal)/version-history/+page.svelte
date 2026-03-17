<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { BASE_API_URL } from '$lib/utils/constants';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import { VersionTimeline, VersionDiff } from '$lib/components/TimeTravel';
	import {
		type Version,
		type VersionDiffData,
		type TimelineEntry,
		CHANGE_TYPE_COLORS,
		CHANGE_TYPE_ICONS,
		formatVersionDate,
		formatFieldName
	} from '$lib/components/TimeTravel';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Reactive state
	let versions = $state<Version[]>(data.versions || []);
	let count = $state(data.count || 0);
	let expandedId = $state<string | null>(null);
	let restoring = $state<string | null>(null);
	let restoreError = $state('');
	let restoreSuccess = $state('');
	let loadingDiff = $state<string | null>(null);
	let diffCache = $state<Record<string, VersionDiffData>>({});

	// Filters
	let filterChangeType = $state($page.url.searchParams.get('change_type') || '');
	let filterContentType = $state($page.url.searchParams.get('content_type') || '');
	let filterFromDate = $state($page.url.searchParams.get('from_date') || '');
	let filterToDate = $state($page.url.searchParams.get('to_date') || '');
	let showFilters = $state(false);

	const changeTypeOptions = [
		{ value: '', label: 'All Types' },
		{ value: 'create', label: 'Created' },
		{ value: 'update', label: 'Updated' },
		{ value: 'delete', label: 'Deleted' },
		{ value: 'restore', label: 'Restored' },
		{ value: 'import', label: 'Imported' },
		{ value: 'bulk', label: 'Bulk Update' }
	];

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

	const breadcrumbItems = $derived([
		{ label: 'Version History', href: `${base}/version-history` }
	]);

	const hasActiveFilters = $derived(
		filterChangeType !== '' ||
			filterContentType !== '' ||
			filterFromDate !== '' ||
			filterToDate !== ''
	);

	// Build timeline entries for the VersionTimeline component
	const timelineEntries: TimelineEntry[] = $derived(
		versions.map((v) => ({
			version: v.versionNumber,
			changeType: v.changeType,
			changeSummary: v.changeSummary,
			changedFields: v.changedFields,
			createdAt: v.createdAt,
			createdBy: v.createdByName,
			diff: diffCache[v.id]
		}))
	);

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	async function fetchDiff(version: Version) {
		if (diffCache[version.id] || version.changeType === 'create') return;
		loadingDiff = version.id;
		try {
			const res = await fetch(`${BASE_API_URL}/version-history/${version.id}/diff/`);
			if (res.ok) {
				const data = await res.json();
				diffCache = { ...diffCache, [version.id]: data };
			}
		} catch {
			// Diff fetch failed silently; the user can still view the snapshot
		} finally {
			loadingDiff = null;
		}
	}

	async function restoreVersion(id: string) {
		if (!confirm('Restore to this version? The current state will be overwritten.')) return;
		restoring = id;
		restoreError = '';
		restoreSuccess = '';
		try {
			const res = await fetch(`${BASE_API_URL}/version-history/${id}/restore/`, {
				method: 'POST'
			});
			if (res.ok) {
				restoreSuccess = 'Version restored successfully.';
				// Reload data after restore
				goto($page.url.pathname + $page.url.search, { invalidateAll: true });
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

	function applyFilters() {
		const params = new URLSearchParams();
		if (filterChangeType) params.set('change_type', filterChangeType);
		if (filterContentType) params.set('content_type', filterContentType);
		if (filterFromDate) params.set('from_date', filterFromDate);
		if (filterToDate) params.set('to_date', filterToDate);
		const query = params.toString();
		goto(`${base}/version-history${query ? '?' + query : ''}`);
	}

	function clearFilters() {
		filterChangeType = '';
		filterContentType = '';
		filterFromDate = '';
		filterToDate = '';
		goto(`${base}/version-history`);
	}

	function navigatePage(direction: 'next' | 'previous') {
		const currentPage = parseInt($page.url.searchParams.get('page') || '1');
		const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(newPage));
		goto(`${base}/version-history?${params.toString()}`);
	}
</script>

<svelte:head>
	<title>Version History</title>
</svelte:head>

<Breadcrumbs items={breadcrumbItems} />

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8 flex justify-between items-start">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
				<i class="fa-solid fa-clock-rotate-left text-primary-600 mr-3"></i>
				Version History
			</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				Browse the complete audit trail of changes across the platform. Restore any prior state.
			</p>
			{#if count > 0}
				<p class="mt-1 text-sm text-gray-500">
					{count} total change{count !== 1 ? 's' : ''} recorded
				</p>
			{/if}
		</div>

		<button
			class="inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md transition-colors
				{showFilters
				? 'border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
				: 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'}"
			onclick={() => (showFilters = !showFilters)}
		>
			<i class="fa-solid fa-filter mr-2"></i>
			Filters
			{#if hasActiveFilters}
				<span
					class="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-primary-500 text-white rounded-full"
				>
					!
				</span>
			{/if}
		</button>
	</div>

	<!-- Filters Panel -->
	{#if showFilters}
		<div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Change Type
					</label>
					<select
						bind:value={filterChangeType}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
					>
						{#each changeTypeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Content Type
					</label>
					<input
						type="text"
						bind:value={filterContentType}
						placeholder="e.g. core.riskscenario"
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						From Date
					</label>
					<input
						type="date"
						bind:value={filterFromDate}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						To Date
					</label>
					<input
						type="date"
						bind:value={filterToDate}
						class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
					/>
				</div>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				{#if hasActiveFilters}
					<button
						class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
						onclick={clearFilters}
					>
						Clear
					</button>
				{/if}
				<button
					class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
					onclick={applyFilters}
				>
					Apply Filters
				</button>
			</div>
		</div>
	{/if}

	<!-- Status Messages -->
	{#if restoreError}
		<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
			<i class="fa-solid fa-circle-exclamation text-red-500"></i>
			<p class="text-sm text-red-700">{restoreError}</p>
			<button class="ml-auto text-red-400 hover:text-red-600" onclick={() => (restoreError = '')}>
				<i class="fa-solid fa-times"></i>
			</button>
		</div>
	{/if}

	{#if restoreSuccess}
		<div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
			<i class="fa-solid fa-check-circle text-green-500"></i>
			<p class="text-sm text-green-700">{restoreSuccess}</p>
			<button
				class="ml-auto text-green-400 hover:text-green-600"
				onclick={() => (restoreSuccess = '')}
			>
				<i class="fa-solid fa-times"></i>
			</button>
		</div>
	{/if}

	{#if versions.length === 0}
		<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
			<i class="fa-solid fa-clock-rotate-left text-6xl text-gray-300 mb-4"></i>
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
				No version history yet
			</h3>
			<p class="text-gray-500">
				Changes will appear here as objects are created, updated, or deleted.
			</p>
		</div>
	{:else}
		<!-- Timeline -->
		<div class="relative">
			<!-- Vertical line -->
			<div class="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>

			<div class="space-y-4">
				{#each versions as version (version.id)}
					<div class="relative flex gap-4">
						<!-- Icon bubble on timeline -->
						<div
							class="relative z-10 flex-shrink-0 w-12 h-12 rounded-full border-2 border-white dark:border-gray-900 shadow flex items-center justify-center
							{version.changeType === 'create'
								? 'bg-green-100'
								: version.changeType === 'update'
									? 'bg-blue-100'
									: version.changeType === 'delete'
										? 'bg-red-100'
										: version.changeType === 'restore'
											? 'bg-yellow-100'
											: version.changeType === 'import'
												? 'bg-purple-100'
												: 'bg-gray-100'}"
						>
							<i
								class="fa-solid {changeTypeIcons[version.changeType] || 'fa-circle'} text-sm
								{version.changeType === 'create'
									? 'text-green-600'
									: version.changeType === 'update'
										? 'text-blue-600'
										: version.changeType === 'delete'
											? 'text-red-600'
											: version.changeType === 'restore'
												? 'text-yellow-600'
												: version.changeType === 'import'
													? 'text-purple-600'
													: 'text-gray-600'}"
							></i>
						</div>

						<!-- Card -->
						<div
							class="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
						>
							<div class="p-4">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="flex items-center gap-2 flex-wrap mb-1">
											<span
												class="px-2 py-0.5 text-xs font-medium rounded-full {changeTypeColors[
													version.changeType
												] || 'bg-gray-100 text-gray-700'}"
											>
												{version.changeType}
											</span>
											{#if version.versionLabel}
												<span class="text-xs text-gray-500 font-mono"
													>v{version.versionNumber} &middot; {version.versionLabel}</span
												>
											{:else}
												<span class="text-xs text-gray-500 font-mono"
													>v{version.versionNumber}</span
												>
											{/if}
											{#if version.contentTypeName}
												<span
													class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded font-mono"
												>
													{version.contentTypeName}
												</span>
											{/if}
										</div>
										<p class="text-sm font-medium text-gray-900 dark:text-white">
											{version.changeSummary}
										</p>
										{#if version.changedFields?.length > 0}
											<p class="text-xs text-gray-500 mt-0.5">
												Fields: {version.changedFields
													.map(formatFieldName)
													.join(', ')}
											</p>
										{/if}
									</div>
									<div class="ml-4 text-right flex-shrink-0">
										<p class="text-xs text-gray-500">
											{formatVersionDate(version.createdAt)}
										</p>
										{#if version.createdByName}
											<p class="text-xs text-gray-400 mt-0.5">
												{version.createdByName}
											</p>
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
									{#if version.changeType !== 'create'}
										<button
											class="text-xs px-2 py-1 border border-indigo-200 rounded hover:bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:hover:bg-indigo-900/30 dark:text-indigo-400"
											onclick={() => fetchDiff(version)}
											disabled={loadingDiff === version.id}
										>
											{#if loadingDiff === version.id}
												<i class="fa-solid fa-spinner fa-spin mr-1"></i>
											{:else}
												<i class="fa-solid fa-code-compare mr-1"></i>
											{/if}
											Diff
										</button>
									{/if}
									{#if version.changeType !== 'delete'}
										<button
											class="text-xs px-2 py-1 border border-amber-200 rounded hover:bg-amber-50 text-amber-700 dark:border-amber-700 dark:hover:bg-amber-900/30 dark:text-amber-400 disabled:opacity-50"
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

								<!-- Diff viewer -->
								{#if diffCache[version.id]}
									<div class="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
										<VersionDiff
											diff={diffCache[version.id]}
											fromVersion={version.versionNumber - 1}
											toVersion={version.versionNumber}
										/>
									</div>
								{/if}

								<!-- Snapshot viewer -->
								{#if expandedId === version.id && version.snapshotData}
									<div class="mt-3 bg-gray-900 rounded p-3 overflow-auto max-h-64">
										<pre
											class="text-green-400 text-xs"><code>{JSON.stringify(version.snapshotData, null, 2)}</code></pre>
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
					class="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 text-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
					disabled={!data.previous}
					onclick={() => navigatePage('previous')}
				>
					<i class="fa-solid fa-arrow-left mr-2"></i>Previous
				</button>
				<span class="text-sm text-gray-500 self-center">
					Page {$page.url.searchParams.get('page') || '1'}
				</span>
				<button
					class="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 text-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
					disabled={!data.next}
					onclick={() => navigatePage('next')}
				>
					Next<i class="fa-solid fa-arrow-right ml-2"></i>
				</button>
			</div>
		{/if}
	{/if}
</div>
