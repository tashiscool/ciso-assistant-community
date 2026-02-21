<script lang="ts">
	import { base } from '$app/paths';
	import {
		ArrowLeft,
		CheckCircle,
		XCircle,
		Loader2,
		AlertTriangle,
		Clock,
		FileCheck,
		ChevronDown,
		ChevronRight,
		Calendar,
		List
	} from 'lucide-svelte';
	import type { EvidenceCollectionRun, RunStatus } from '$lib/services/evidence-automation/api';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let run = $state<EvidenceCollectionRun | null>(data.run);
	let logExpanded = $state(false);

	const runStatusConfig: Record<
		RunStatus,
		{ classes: string; icon: typeof CheckCircle; label: string }
	> = {
		pending: {
			classes: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
			icon: Clock,
			label: 'Pending'
		},
		running: {
			classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
			icon: Loader2,
			label: 'Running'
		},
		success: {
			classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
			icon: CheckCircle,
			label: 'Success'
		},
		partial: {
			classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
			icon: AlertTriangle,
			label: 'Partial'
		},
		failed: {
			classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
			icon: XCircle,
			label: 'Failed'
		}
	};

	function formatDate(dateStr: string | undefined): string {
		if (!dateStr) return '—';
		return new Date(dateStr).toLocaleString();
	}

	function duration(startStr: string | undefined, endStr: string | undefined): string {
		if (!startStr || !endStr) return '—';
		const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
		return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
	}

	const statusConfig = $derived(run ? runStatusConfig[run.status] : null);
	const isRunning = $derived(run?.status === 'running');
</script>

<svelte:head>
	<title>Run Detail - Evidence Automation</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<!-- Back link -->
	<a
		href="{base}/evidence-automation/runs"
		class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
	>
		<ArrowLeft size={16} />
		Back to Collection Runs
	</a>

	{#if !run}
		<div class="py-20 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
			<AlertTriangle size={48} class="mx-auto text-gray-300 mb-4" />
			<p class="text-lg font-medium text-gray-500">Run not found</p>
			<a href="{base}/evidence-automation/runs" class="mt-4 text-sm text-amber-600 hover:underline">
				Return to list
			</a>
		</div>
	{:else}
		<!-- Run Header -->
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
			<div class="flex items-start justify-between gap-4 flex-wrap">
				<div>
					<h1 class="text-xl font-bold text-gray-900 dark:text-white">{run.rule_name}</h1>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">Run #{run.id}</p>
				</div>
				{#if statusConfig}
					{@const Icon = statusConfig.icon}
					<span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium {statusConfig.classes}">
						<Icon size={16} class={isRunning ? 'animate-spin' : ''} />
						{run.status_display}
					</span>
				{/if}
			</div>

			<!-- Timing info -->
			<div class="mt-5 flex flex-wrap gap-6 text-sm text-gray-500 dark:text-gray-400">
				<div class="flex items-center gap-2">
					<Calendar size={14} class="text-gray-400" />
					<span class="font-medium text-gray-700 dark:text-gray-300">Started:</span>
					{formatDate(run.started_at)}
				</div>
				<div class="flex items-center gap-2">
					<Calendar size={14} class="text-gray-400" />
					<span class="font-medium text-gray-700 dark:text-gray-300">Completed:</span>
					{formatDate(run.completed_at)}
				</div>
				<div class="flex items-center gap-2">
					<Clock size={14} class="text-gray-400" />
					<span class="font-medium text-gray-700 dark:text-gray-300">Duration:</span>
					{duration(run.started_at, run.completed_at)}
				</div>
			</div>
		</div>

		<!-- Stats Cards -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Items Collected</p>
				<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{run.items_collected}</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Started At</p>
				<p class="text-sm font-medium text-gray-900 dark:text-white mt-1">{formatDate(run.started_at)}</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Completed At</p>
				<p class="text-sm font-medium text-gray-900 dark:text-white mt-1">{formatDate(run.completed_at)}</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Evidence Created</p>
				<p class="text-sm font-medium text-gray-900 dark:text-white mt-1">
					{run.evidence_created ? formatDate(run.evidence_created) : '—'}
				</p>
			</div>
		</div>

		<!-- Error Message -->
		{#if run.error_message}
			<div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
				<AlertTriangle size={20} class="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
				<div>
					<p class="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Error</p>
					<p class="text-sm text-red-600 dark:text-red-300">{run.error_message}</p>
				</div>
			</div>
		{/if}

		<!-- Run Log Table -->
		{#if run.run_log && run.run_log.length > 0}
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
					<List size={16} class="text-gray-400" />
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Run Log</h2>
					<span class="ml-auto text-xs text-gray-400">{run.run_log.length} entries</span>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead class="bg-gray-50 dark:bg-gray-700/50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
									Timestamp
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Message / Error
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each run.run_log as entry, idx (idx)}
								<tr class="{entry.error ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/20'}">
									<td class="px-6 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
										{new Date(entry.timestamp).toLocaleTimeString()}
									</td>
									<td class="px-6 py-3 text-sm">
										{#if entry.error}
											<span class="flex items-start gap-2 text-red-600 dark:text-red-400">
												<XCircle size={14} class="mt-0.5 shrink-0" />
												{entry.error}
											</span>
										{:else if entry.message}
											<span class="text-gray-700 dark:text-gray-300">{entry.message}</span>
										{:else}
											<span class="text-gray-400 italic">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Collapsible JSON -->
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
				<button
					type="button"
					onclick={() => (logExpanded = !logExpanded)}
					class="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded-lg"
				>
					<span class="flex items-center gap-2">
						<FileCheck size={16} class="text-gray-400" />
						Raw Log JSON
					</span>
					{#if logExpanded}
						<ChevronDown size={16} class="text-gray-400" />
					{:else}
						<ChevronRight size={16} class="text-gray-400" />
					{/if}
				</button>
				{#if logExpanded}
					<div class="px-6 pb-6">
						<pre class="text-xs font-mono bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 p-4 rounded-md overflow-x-auto border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto whitespace-pre-wrap break-all">{JSON.stringify(
								run.run_log,
								null,
								2
							)}</pre>
					</div>
				{/if}
			</div>
		{:else}
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 py-12 text-center">
				<List size={32} class="mx-auto text-gray-300 mb-2" />
				<p class="text-sm text-gray-400">No log entries for this run</p>
			</div>
		{/if}
	{/if}
</div>
