<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		Play,
		Loader2,
		CheckCircle,
		XCircle,
		AlertTriangle,
		Save,
		Trash2,
		FlaskConical,
		Clock,
		FileCheck
	} from 'lucide-svelte';
	import {
		evidenceRuleApi,
		evidenceRunApi
	} from '$lib/services/evidence-automation/api';
	import type {
		EvidenceCollectionRule,
		EvidenceCollectionRun,
		RunStatus
	} from '$lib/services/evidence-automation/api';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let rule = $state<EvidenceCollectionRule | null>(data.rule);
	let recentRuns = $state<EvidenceCollectionRun[]>([]);
	let loadingRuns = $state(true);

	// Edit form state (initialised from SSR data)
	let editName = $state(data.rule?.name ?? '');
	let editDescription = $state(data.rule?.description ?? '');
	let editSchedule = $state(data.rule?.schedule ?? '');
	let editQuery = $state(data.rule?.query ?? '');
	let editRetentionDays = $state(data.rule?.retention_days ?? 90);
	let editEnabled = $state(data.rule?.enabled ?? true);

	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);

	let running = $state(false);
	let dryRunning = $state(false);
	let runError = $state<string | null>(null);
	let runSuccess = $state<string | null>(null);

	const runStatusColors: Record<RunStatus, string> = {
		pending: 'bg-gray-100 text-gray-700',
		running: 'bg-blue-100 text-blue-700',
		success: 'bg-green-100 text-green-700',
		partial: 'bg-yellow-100 text-yellow-700',
		failed: 'bg-red-100 text-red-700'
	};

	function formatDate(dateStr: string | undefined): string {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleString();
	}

	onMount(async () => {
		if (!rule) return;
		try {
			const res = await evidenceRunApi.list({ rule: rule.id, limit: 5 });
			if (res.success) {
				recentRuns = res.data?.results ?? [];
			}
		} catch (e) {
			console.error('Error loading runs:', e);
		} finally {
			loadingRuns = false;
		}
	});

	async function handleSave(event: Event) {
		event.preventDefault();
		if (!rule) return;
		saving = true;
		saveError = null;
		saveSuccess = false;
		try {
			const res = await evidenceRuleApi.update(rule.id, {
				name: editName.trim(),
				description: editDescription.trim() || undefined,
				schedule: editSchedule.trim() || undefined,
				query: editQuery.trim() || undefined,
				retention_days: editRetentionDays,
				enabled: editEnabled
			});
			if (res.success && res.data) {
				rule = res.data;
				saveSuccess = true;
				setTimeout(() => (saveSuccess = false), 3000);
			} else {
				saveError = 'Failed to save changes. Please try again.';
			}
		} catch (e) {
			saveError = 'An unexpected error occurred.';
		} finally {
			saving = false;
		}
	}

	async function triggerRun(dryRun: boolean) {
		if (!rule) return;
		runError = null;
		runSuccess = null;
		if (dryRun) {
			dryRunning = true;
		} else {
			running = true;
		}
		try {
			const res = await evidenceRuleApi.run(rule.id, dryRun);
			if (res.success) {
				runSuccess = dryRun
					? 'Dry run triggered — no evidence will be created'
					: 'Run triggered successfully';
				// Refresh recent runs
				const runsRes = await evidenceRunApi.list({ rule: rule.id, limit: 5 });
				if (runsRes.success) {
					recentRuns = runsRes.data?.results ?? [];
				}
			} else {
				runError = 'Failed to trigger run.';
			}
		} catch (e) {
			runError = 'Error triggering run.';
		} finally {
			running = false;
			dryRunning = false;
		}
	}

	async function handleDelete() {
		if (!rule) return;
		if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
		try {
			const res = await evidenceRuleApi.delete(rule.id);
			if (res.success) {
				goto(`${base}/evidence-automation/rules`);
			}
		} catch (e) {
			console.error('Error deleting rule:', e);
		}
	}
</script>

<svelte:head>
	<title>{rule?.name ?? 'Rule Detail'} - Evidence Automation</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
	<!-- Back link -->
	<a
		href="{base}/evidence-automation/rules"
		class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
	>
		<ArrowLeft size={16} />
		Back to Collection Rules
	</a>

	{#if !rule}
		<div class="py-20 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
			<AlertTriangle size={48} class="mx-auto text-gray-300 mb-4" />
			<p class="text-lg font-medium text-gray-500">Rule not found</p>
			<a href="{base}/evidence-automation/rules" class="mt-4 text-sm text-amber-600 hover:underline">
				Return to list
			</a>
		</div>
	{:else}
		<!-- Rule Header -->
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
			<div class="flex items-start justify-between flex-wrap gap-4">
				<div>
					<h1 class="text-xl font-bold text-gray-900 dark:text-white">{rule.name}</h1>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{rule.source_name}</p>
				</div>
				<div class="flex items-center gap-2 flex-wrap">
					<span class="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
						{rule.collection_type_display}
					</span>
					{#if rule.enabled}
						<span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
							<CheckCircle size={12} /> Enabled
						</span>
					{:else}
						<span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-full">
							<XCircle size={12} /> Disabled
						</span>
					{/if}
				</div>
			</div>

			<!-- Run actions -->
			<div class="mt-5 flex items-center gap-3 flex-wrap">
				<button
					onclick={() => triggerRun(false)}
					disabled={running || dryRunning}
					class="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md shadow-sm disabled:opacity-50 transition-colors"
				>
					{#if running}
						<Loader2 size={16} class="animate-spin" />
						Running...
					{:else}
						<Play size={16} />
						Run Now
					{/if}
				</button>

				<button
					onclick={() => triggerRun(true)}
					disabled={running || dryRunning}
					class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
				>
					{#if dryRunning}
						<Loader2 size={16} class="animate-spin" />
						Running dry run...
					{:else}
						<FlaskConical size={16} />
						Run Dry Run
					{/if}
				</button>

				<button
					onclick={handleDelete}
					class="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-md hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors ml-auto"
				>
					<Trash2 size={16} />
					Delete Rule
				</button>
			</div>

			{#if runSuccess}
				<div class="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
					<CheckCircle size={14} />
					{runSuccess}
				</div>
			{/if}
			{#if runError}
				<div class="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
					<AlertTriangle size={14} />
					{runError}
				</div>
			{/if}
		</div>

		<!-- Edit Form -->
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white">Edit Rule</h2>
			</div>
			<form onsubmit={handleSave} class="px-6 py-5 space-y-4">
				{#if saveError}
					<div class="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
						<AlertTriangle size={16} class="text-red-600 mt-0.5 shrink-0" />
						<p class="text-sm text-red-700 dark:text-red-400">{saveError}</p>
					</div>
				{/if}
				{#if saveSuccess}
					<div class="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
						<CheckCircle size={16} class="text-green-600" />
						<p class="text-sm text-green-700 dark:text-green-400">Changes saved successfully</p>
					</div>
				{/if}

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<!-- Name -->
					<div class="sm:col-span-2">
						<label for="editName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Rule Name
						</label>
						<input
							id="editName"
							type="text"
							bind:value={editName}
							required
							class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
						/>
					</div>

					<!-- Description -->
					<div class="sm:col-span-2">
						<label for="editDescription" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Description
						</label>
						<textarea
							id="editDescription"
							bind:value={editDescription}
							rows={2}
							class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
						></textarea>
					</div>

					<!-- Query -->
					<div class="sm:col-span-2">
						<label for="editQuery" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Query
						</label>
						<input
							id="editQuery"
							type="text"
							bind:value={editQuery}
							class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
						/>
					</div>

					<!-- Schedule -->
					<div>
						<label for="editSchedule" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Schedule (cron)
						</label>
						<input
							id="editSchedule"
							type="text"
							bind:value={editSchedule}
							placeholder="e.g. 0 0 * * 1"
							class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
						/>
					</div>

					<!-- Retention Days -->
					<div>
						<label for="editRetention" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Retention Days
						</label>
						<input
							id="editRetention"
							type="number"
							bind:value={editRetentionDays}
							min={1}
							max={3650}
							class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
						/>
					</div>
				</div>

				<!-- Enabled toggle -->
				<div class="flex items-center gap-3 pt-1">
					<button
						type="button"
						role="switch"
						aria-checked={editEnabled}
						onclick={() => (editEnabled = !editEnabled)}
						class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors {editEnabled
							? 'bg-amber-500'
							: 'bg-gray-300 dark:bg-gray-600'}"
					>
						<span
							class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out {editEnabled
								? 'translate-x-5'
								: 'translate-x-0'}"
						></span>
					</button>
					<span class="text-sm text-gray-700 dark:text-gray-300">
						{editEnabled ? 'Enabled' : 'Disabled'}
					</span>
				</div>

				<div class="pt-4 border-t border-gray-200 dark:border-gray-700">
					<button
						type="submit"
						disabled={saving}
						class="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md shadow-sm disabled:opacity-50 transition-colors"
					>
						{#if saving}
							<Loader2 size={16} class="animate-spin" />
							Saving...
						{:else}
							<Save size={16} />
							Save Changes
						{/if}
					</button>
				</div>
			</form>
		</div>

		<!-- Recent Runs -->
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
				<h2 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
					<Clock size={16} class="text-gray-400" />
					Recent Runs
				</h2>
				<a
					href="{base}/evidence-automation/runs"
					class="text-sm text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
				>
					View all runs
				</a>
			</div>

			{#if loadingRuns}
				<div class="flex items-center justify-center py-10">
					<Loader2 size={24} class="animate-spin text-gray-400" />
				</div>
			{:else if recentRuns.length === 0}
				<div class="py-10 text-center text-sm text-gray-400">
					<FileCheck size={32} class="mx-auto text-gray-300 mb-2" />
					No runs yet for this rule
				</div>
			{:else}
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-700/50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
						{#each recentRuns as run (run.id)}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
								<td class="px-6 py-3">
									<a
										href="{base}/evidence-automation/runs/{run.id}"
										class="inline-block px-2 py-1 text-xs font-medium rounded hover:opacity-80 {runStatusColors[run.status]}"
									>
										{run.status_display}
									</a>
								</td>
								<td class="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">
									{formatDate(run.started_at)}
								</td>
								<td class="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">
									{formatDate(run.completed_at)}
								</td>
								<td class="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
									{run.items_collected}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>
