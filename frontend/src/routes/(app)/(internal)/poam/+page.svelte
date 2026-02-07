<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	interface Props {
		data: {
			title: string;
			items: any[];
			totalCount: number;
			overdueCount: number;
			filters: {
				status: string;
				riskLevel: string;
				search: string;
				ordering: string;
			};
		};
	}

	let { data }: Props = $props();

	let items = $state(data.items);
	let totalCount = $state(data.totalCount);
	let overdueCount = $state(data.overdueCount);

	// Filter state
	let statusFilter = $state(data.filters.status);
	let riskLevelFilter = $state(data.filters.riskLevel);
	let searchQuery = $state(data.filters.search);
	let ordering = $state(data.filters.ordering);

	// Export dropdown state
	let showExportDropdown = $state(false);

	// Loading / error state
	let loading = $state(false);
	let actionError = $state('');

	// Derived counts
	const openCount = $derived(
		items.filter((i: any) => ['draft', 'submitted', 'approved', 'in_progress'].includes(i.status)).length
	);
	const completedCount = $derived(
		items.filter((i: any) => i.status === 'completed').length
	);

	// Status options
	const statusOptions = [
		{ value: '', label: 'All Statuses' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'submitted', label: 'Submitted' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'rejected', label: 'Rejected' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'cancelled', label: 'Cancelled' },
		{ value: 'deferred', label: 'Deferred' }
	];

	// Risk level options
	const riskLevelOptions = [
		{ value: '', label: 'All Risk Levels' },
		{ value: 'very_high', label: 'Very High' },
		{ value: 'high', label: 'High' },
		{ value: 'moderate', label: 'Moderate' },
		{ value: 'low', label: 'Low' },
		{ value: 'very_low', label: 'Very Low' }
	];

	function getRiskLevelColor(level: string): string {
		const colors: Record<string, string> = {
			very_high: 'bg-red-100 text-red-800 border-red-200',
			high: 'bg-orange-100 text-orange-800 border-orange-200',
			moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
			low: 'bg-green-100 text-green-800 border-green-200',
			very_low: 'bg-blue-100 text-blue-800 border-blue-200'
		};
		return colors[level] || 'bg-gray-100 text-gray-800 border-gray-200';
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			draft: 'bg-gray-100 text-gray-800',
			submitted: 'bg-blue-100 text-blue-800',
			approved: 'bg-green-100 text-green-800',
			rejected: 'bg-red-100 text-red-800',
			in_progress: 'bg-yellow-100 text-yellow-800',
			completed: 'bg-emerald-100 text-emerald-800',
			cancelled: 'bg-slate-100 text-slate-800',
			deferred: 'bg-purple-100 text-purple-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	}

	function formatLabel(value: string): string {
		return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		try {
			return new Date(dateStr).toLocaleDateString();
		} catch {
			return dateStr;
		}
	}

	function isOverdue(item: any): boolean {
		if (!item.estimated_completion_date) return false;
		if (['completed', 'cancelled'].includes(item.status)) return false;
		return new Date(item.estimated_completion_date) < new Date();
	}

	async function applyFilters() {
		const params = new URLSearchParams();
		if (statusFilter) params.set('status', statusFilter);
		if (riskLevelFilter) params.set('risk_level', riskLevelFilter);
		if (searchQuery) params.set('search', searchQuery);
		if (ordering) params.set('ordering', ordering);
		goto(`/poam?${params.toString()}`);
	}

	async function handleExport(format: string) {
		showExportDropdown = false;
		loading = true;
		actionError = '';

		try {
			let url = '';
			let filename = '';
			let fetchOptions: RequestInit = {};

			if (format === 'fedramp') {
				url = `${BASE_API_URL}/poam-items/export_fedramp/`;
				filename = `poam_fedramp_${new Date().toISOString().split('T')[0]}.xlsx`;
			} else if (format === 'csv') {
				url = `${BASE_API_URL}/poam-items/export_csv/`;
				filename = `poam_export_${new Date().toISOString().split('T')[0]}.csv`;
			} else if (format === 'oscal') {
				url = `${BASE_API_URL}/poam-items/export_oscal/`;
				filename = `poam_oscal_${new Date().toISOString().split('T')[0]}.json`;
			}

			const response = await fetch(url, fetchOptions);
			if (!response.ok) {
				throw new Error(`Export failed: ${response.statusText}`);
			}

			const blob = await response.blob();
			const downloadUrl = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(downloadUrl);
			document.body.removeChild(a);
		} catch (e: any) {
			actionError = e.message || 'Export failed';
		} finally {
			loading = false;
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			applyFilters();
		}, 400);
	}
</script>

<svelte:head>
	<title>POA&M Management</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">POA&M Management</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Plan of Action and Milestones - Track and manage security weaknesses and remediation
			</p>
		</div>
		<div class="flex items-center gap-3">
			<a
				href="/poam/generate"
				class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
			>
				<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
				Generate from Findings
			</a>

			<!-- Export Dropdown -->
			<div class="relative">
				<button
					class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
					onclick={() => (showExportDropdown = !showExportDropdown)}
				>
					<i class="fa-solid fa-download mr-2"></i>
					Export
					<i class="fa-solid fa-chevron-down ml-2 text-xs"></i>
				</button>
				{#if showExportDropdown}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50"
						role="menu"
					>
						<div class="py-1">
							<button
								class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
								onclick={() => handleExport('fedramp')}
								role="menuitem"
							>
								<i class="fa-solid fa-file-excel mr-2 text-green-600"></i>
								FedRAMP Excel (.xlsx)
							</button>
							<button
								class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
								onclick={() => handleExport('csv')}
								role="menuitem"
							>
								<i class="fa-solid fa-file-csv mr-2 text-blue-600"></i>
								CSV Export (.csv)
							</button>
							<button
								class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
								onclick={() => handleExport('oscal')}
								role="menuitem"
							>
								<i class="fa-solid fa-file-code mr-2 text-purple-600"></i>
								OSCAL POA&M (.json)
							</button>
						</div>
					</div>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0 z-40"
						onclick={() => (showExportDropdown = false)}
					></div>
				{/if}
			</div>

			<a
				href="/poam/new"
				class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
			>
				<i class="fa-solid fa-plus mr-2"></i>
				New POA&M Item
			</a>
		</div>
	</div>

	<!-- Error display -->
	{#if actionError}
		<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
			<i class="fa-solid fa-circle-exclamation mr-2"></i>
			{actionError}
			<button class="ml-4 underline text-sm" onclick={() => (actionError = '')}>Dismiss</button>
		</div>
	{/if}

	<!-- Summary Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border-l-4 border-indigo-500">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Items</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
				</div>
				<div class="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
					<i class="fa-solid fa-list-check text-indigo-600 dark:text-indigo-400 text-xl"></i>
				</div>
			</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border-l-4 border-blue-500">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Open</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{openCount}</p>
				</div>
				<div class="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
					<i class="fa-solid fa-folder-open text-blue-600 dark:text-blue-400 text-xl"></i>
				</div>
			</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border-l-4 border-red-500">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Overdue</p>
					<p class="text-2xl font-bold text-red-600 dark:text-red-400">{overdueCount}</p>
				</div>
				<div class="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
					<i class="fa-solid fa-clock text-red-600 dark:text-red-400 text-xl"></i>
				</div>
			</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border-l-4 border-emerald-500">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{completedCount}</p>
				</div>
				<div class="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
					<i class="fa-solid fa-check-circle text-emerald-600 dark:text-emerald-400 text-xl"></i>
				</div>
			</div>
		</div>
	</div>

	<!-- Filter Bar -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
		<div class="flex flex-col sm:flex-row gap-4">
			<div class="flex-1">
				<div class="relative">
					<i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
					<input
						type="text"
						bind:value={searchQuery}
						oninput={handleSearchInput}
						placeholder="Search by weakness ID, title, description, or control..."
						class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
					/>
				</div>
			</div>
			<div class="flex gap-3">
				<select
					bind:value={statusFilter}
					onchange={applyFilters}
					class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				>
					{#each statusOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<select
					bind:value={riskLevelFilter}
					onchange={applyFilters}
					class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				>
					{#each riskLevelOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Table -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
		{#if items.length === 0}
			<div class="text-center py-16">
				<i class="fa-solid fa-clipboard-list text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">No POA&M items found</h3>
				<p class="mt-2 text-gray-500 dark:text-gray-400">
					{#if statusFilter || riskLevelFilter || searchQuery}
						No items match your current filters. Try adjusting your search criteria.
					{:else}
						Get started by creating a new POA&M item or generating from existing findings.
					{/if}
				</p>
				<div class="mt-6 flex items-center justify-center gap-3">
					{#if statusFilter || riskLevelFilter || searchQuery}
						<button
							class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
							onclick={() => {
								statusFilter = '';
								riskLevelFilter = '';
								searchQuery = '';
								applyFilters();
							}}
						>
							<i class="fa-solid fa-times mr-2"></i>
							Clear Filters
						</button>
					{/if}
					<a
						href="/poam/new"
						class="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
					>
						<i class="fa-solid fa-plus mr-2"></i>
						Create New Item
					</a>
				</div>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-700">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Weakness ID
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Title
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Control
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Risk Level
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Status
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Due Date
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								POC
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Progress
							</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
						{#each items as item}
							<tr
								class="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
								onclick={() => goto(`/poam/${item.id}`)}
							>
								<td class="px-4 py-3 whitespace-nowrap">
									<span class="text-sm font-mono font-medium text-indigo-600 dark:text-indigo-400">
										{item.weakness_id}
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="text-sm font-medium text-gray-900 dark:text-white max-w-xs truncate">
										{item.title}
									</div>
									{#if item.source_type}
										<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
											{formatLabel(item.source_type)}
										</div>
									{/if}
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									{#if item.control_id}
										<span class="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
											{item.control_id}
										</span>
									{:else}
										<span class="text-sm text-gray-400">-</span>
									{/if}
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border {getRiskLevelColor(item.risk_level)}">
										{formatLabel(item.risk_level)}
									</span>
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(item.status)}">
										{formatLabel(item.status)}
									</span>
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									<span class="text-sm {isOverdue(item) ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-700 dark:text-gray-300'}">
										{formatDate(item.estimated_completion_date)}
									</span>
									{#if isOverdue(item)}
										<div class="text-xs text-red-500 dark:text-red-400 mt-0.5">
											{item.days_overdue || ''} {item.days_overdue === 1 ? 'day' : 'days'} overdue
										</div>
									{/if}
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									{#if item.point_of_contact}
										<div class="text-sm text-gray-900 dark:text-white">{item.point_of_contact}</div>
										{#if item.contact_email}
											<div class="text-xs text-gray-500 dark:text-gray-400">{item.contact_email}</div>
										{/if}
									{:else}
										<span class="text-sm text-gray-400">-</span>
									{/if}
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									{#if item.completion_percentage !== undefined && item.completion_percentage !== null}
										<div class="flex items-center gap-2">
											<div class="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
												<div
													class="bg-indigo-600 h-2 rounded-full transition-all"
													style="width: {item.completion_percentage}%"
												></div>
											</div>
											<span class="text-xs text-gray-500 dark:text-gray-400">{item.completion_percentage}%</span>
										</div>
									{:else}
										<span class="text-sm text-gray-400">-</span>
									{/if}
								</td>
								<td class="px-4 py-3 whitespace-nowrap text-right">
									<a
										href="/poam/{item.id}"
										class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
										onclick|stopPropagation
									>
										View
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
