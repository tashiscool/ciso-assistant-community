<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import {
		Play,
		Loader2,
		Clock,
		CheckCircle,
		XCircle,
		AlertTriangle,
		RefreshCw
	} from 'lucide-svelte';
	import { evidenceRunApi } from '$lib/services/evidence-automation/api';
	import type { EvidenceCollectionRun, RunStatus } from '$lib/services/evidence-automation/api';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let runs = $state<EvidenceCollectionRun[]>(data.runs ?? []);
	let statusFilter = $state<'all' | RunStatus>('all');
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let loading = $state(false);

	const ALL_STATUSES: Array<{ value: 'all' | RunStatus; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'pending', label: 'Pending' },
		{ value: 'running', label: 'Running' },
		{ value: 'success', label: 'Success' },
		{ value: 'partial', label: 'Partial' },
		{ value: 'failed', label: 'Failed' }
	];

	const runStatusColors: Record<RunStatus, string> = {
		pending: 'bg-gray-100 text-gray-700',
		running: 'bg-blue-100 text-blue-700',
		success: 'bg-green-100 text-green-700',
		partial: 'bg-yellow-100 text-yellow-700',
		failed: 'bg-red-100 text-red-700'
	};

	const filteredRuns = $derived.by(() => {
		if (statusFilter === 'all') return runs;
		return runs.filter((r) => r.status === statusFilter);
	});

	const hasActiveRuns = $derived(runs.some((r) => r.status === 'pending' || r.status === 'running'));

	function formatDate(dateStr: string | undefined): string {
		if (!dateStr) return '—';
		return new Date(dateStr).toLocaleString();
	}

	async function refreshRuns() {
		loading = true;
		try {
			const res = await evidenceRunApi.list();
			if (res.success) {
				runs = res.data?.results ?? [];
			}
		} catch (e) {
			console.error('Error refreshing runs:', e);
		} finally {
			loading = false;
		}
	}

	function startAutoRefresh() {
		if (refreshInterval) return;
		refreshInterval = setInterval(async () => {
			if (hasActiveRuns) {
				await refreshRuns();
			} else {
				stopAutoRefresh();
			}
		}, 10_000);
	}

	function stopAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	// Reactively start/stop auto-refresh based on whether there are active runs
	$effect(() => {
		if (hasActiveRuns) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
	});

	onDestroy(() => {
		stopAutoRefresh();
	});
</script>

<svelte:head>
	<title>Collection Runs - Evidence Automation</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
				<Clock class="text-amber-500" size={24} />
				Collection Runs
			</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				History of all automated evidence collection runs
				{#if hasActiveRuns}
					<span class="ml-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
						<Loader2 size={12} class="animate-spin" />
						Auto-refreshing
					</span>
				{/if}
			</p>
		</div>
		<button
			onclick={refreshRuns}
			disabled={loading}
			class="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
		>
			<RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
			Refresh
		</button>
	</div>

	<!-- Status filter tabs -->
	<div class="flex gap-2 mb-5 flex-wrap">
		{#each ALL_STATUSES as { value, label }}
			<button
				onclick={() => (statusFilter = value)}
				class="px-3 py-1.5 text-sm font-medium rounded-full transition-colors {statusFilter === value
					? 'bg-amber-600 text-white'
					: 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}"
			>
				{label}
				{#if value !== 'all'}
					<span class="ml-1 text-xs opacity-70">
						({runs.filter((r) => r.status === value).length})
					</span>
				{:else}
					<span class="ml-1 text-xs opacity-70">({runs.length})</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Table -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
		{#if filteredRuns.length === 0}
			<div class="py-20 text-center">
				<Play size={48} class="mx-auto text-gray-300 mb-4" />
				<p class="text-lg font-medium text-gray-500 dark:text-gray-400">
					{statusFilter === 'all' ? 'No collection runs yet' : `No ${statusFilter} runs`}
				</p>
				<p class="text-sm text-gray-400 mt-1">
					Trigger a rule to see runs appear here
				</p>
			</div>
		{:else}
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-700/50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Rule Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Status
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Started At
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Completed At
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Items
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Error
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each filteredRuns as run (run.id)}
						<tr
							class="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
							onclick={() => goto(`${base}/evidence-automation/runs/${run.id}`)}
						>
							<td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
								{run.rule_name}
							</td>
							<td class="px-6 py-4">
								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded {runStatusColors[run.status]}">
									{#if run.status === 'running'}
										<Loader2 size={12} class="animate-spin" />
									{:else if run.status === 'success'}
										<CheckCircle size={12} />
									{:else if run.status === 'failed'}
										<XCircle size={12} />
									{/if}
									{run.status_display}
								</span>
							</td>
							<td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
								{formatDate(run.started_at)}
							</td>
							<td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
								{formatDate(run.completed_at)}
							</td>
							<td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
								{run.items_collected}
							</td>
							<td class="px-6 py-4 text-sm text-red-600 dark:text-red-400 max-w-xs">
								{#if run.error_message}
									<span class="flex items-start gap-1">
										<AlertTriangle size={14} class="mt-0.5 shrink-0" />
										<span class="line-clamp-2">{run.error_message}</span>
									</span>
								{:else}
									<span class="text-gray-300 dark:text-gray-600">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
