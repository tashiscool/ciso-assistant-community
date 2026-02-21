<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import {
		Plus,
		Play,
		Pause,
		Pencil,
		Trash2,
		CheckCircle,
		XCircle,
		RefreshCw,
		Settings,
		Clock,
		AlertTriangle,
		Loader2
	} from 'lucide-svelte';
	import { evidenceRuleApi } from '$lib/services/evidence-automation/api';
	import type { EvidenceCollectionRule, RunStatus } from '$lib/services/evidence-automation/api';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let rules = $state<EvidenceCollectionRule[]>(data.rules ?? []);
	let runningIds = $state<Set<string>>(new Set());
	let errorMap = $state<Record<string, string>>({});
	let successMap = $state<Record<string, string>>({});

	const total = $derived(rules.length);
	const enabledCount = $derived(rules.filter((r) => r.enabled).length);
	const disabledCount = $derived(rules.filter((r) => !r.enabled).length);

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

	async function runNow(rule: EvidenceCollectionRule) {
		runningIds = new Set([...runningIds, rule.id]);
		delete errorMap[rule.id];
		delete successMap[rule.id];
		try {
			const res = await evidenceRuleApi.run(rule.id);
			if (res.success) {
				successMap = { ...successMap, [rule.id]: 'Run triggered successfully' };
			} else {
				errorMap = { ...errorMap, [rule.id]: 'Run failed to start' };
			}
		} catch (e) {
			errorMap = { ...errorMap, [rule.id]: 'Error triggering run' };
		} finally {
			runningIds = new Set([...runningIds].filter((id) => id !== rule.id));
		}
	}

	async function toggleEnabled(rule: EvidenceCollectionRule) {
		try {
			const res = rule.enabled
				? await evidenceRuleApi.disable(rule.id)
				: await evidenceRuleApi.enable(rule.id);
			if (res.success && res.data) {
				rules = rules.map((r) => (r.id === rule.id ? { ...r, enabled: res.data!.enabled } : r));
			}
		} catch (e) {
			console.error('Error toggling rule:', e);
		}
	}

	async function deleteRule(rule: EvidenceCollectionRule) {
		if (!confirm(`Delete rule "${rule.name}"? This cannot be undone.`)) return;
		try {
			const res = await evidenceRuleApi.delete(rule.id);
			if (res.success) {
				rules = rules.filter((r) => r.id !== rule.id);
			}
		} catch (e) {
			console.error('Error deleting rule:', e);
		}
	}
</script>

<svelte:head>
	<title>Collection Rules - Evidence Automation</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
				<Settings class="text-amber-500" size={24} />
				Collection Rules
			</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Define and manage automated evidence collection rules
			</p>
		</div>
		<a
			href="{base}/evidence-automation/rules/new"
			class="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors"
		>
			<Plus size={16} />
			Add Rule
		</a>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-3 gap-4 mb-6">
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
			<p class="text-sm text-gray-500 dark:text-gray-400">Total Rules</p>
			<p class="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
			<p class="text-sm text-gray-500 dark:text-gray-400">Enabled</p>
			<p class="text-2xl font-bold text-green-600">{enabledCount}</p>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
			<p class="text-sm text-gray-500 dark:text-gray-400">Disabled</p>
			<p class="text-2xl font-bold text-gray-400">{disabledCount}</p>
		</div>
	</div>

	<!-- Table -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
		{#if rules.length === 0}
			<div class="py-20 text-center">
				<Settings size={48} class="mx-auto text-gray-300 mb-4" />
				<p class="text-lg font-medium text-gray-500 dark:text-gray-400">No collection rules yet</p>
				<p class="text-sm text-gray-400 mt-1">Create a rule to start automating evidence collection</p>
				<a
					href="{base}/evidence-automation/rules/new"
					class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md"
				>
					<Plus size={16} />
					Add Your First Rule
				</a>
			</div>
		{:else}
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-700/50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Rule Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Source
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Type
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Status
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Last Run
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Last Run Status
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each rules as rule (rule.id)}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
							<td class="px-6 py-4">
								<a
									href="{base}/evidence-automation/rules/{rule.id}"
									class="font-medium text-gray-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400"
								>
									{rule.name}
								</a>
								{#if rule.description}
									<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
										{rule.description}
									</p>
								{/if}
							</td>
							<td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
								{rule.source_name}
							</td>
							<td class="px-6 py-4">
								<span class="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
									{rule.collection_type_display}
								</span>
							</td>
							<td class="px-6 py-4">
								{#if rule.enabled}
									<span class="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
										<CheckCircle size={14} />
										Enabled
									</span>
								{:else}
									<span class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
										<XCircle size={14} />
										Disabled
									</span>
								{/if}
							</td>
							<td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
								<span class="inline-flex items-center gap-1">
									<Clock size={13} />
									{formatDate(rule.last_run?.started_at)}
								</span>
							</td>
							<td class="px-6 py-4">
								{#if rule.last_run}
									<span class="px-2 py-1 text-xs font-medium rounded {runStatusColors[rule.last_run.status]}">
										{rule.last_run.status}
									</span>
								{:else}
									<span class="text-xs text-gray-400">—</span>
								{/if}
							</td>
							<td class="px-6 py-4 text-right">
								<div class="flex items-center justify-end gap-2">
									{#if successMap[rule.id]}
										<span class="text-xs text-green-600">{successMap[rule.id]}</span>
									{/if}
									{#if errorMap[rule.id]}
										<span class="text-xs text-red-600 flex items-center gap-1">
											<AlertTriangle size={12} />
											{errorMap[rule.id]}
										</span>
									{/if}

									<!-- Run Now -->
									<button
										onclick={() => runNow(rule)}
										disabled={runningIds.has(rule.id)}
										title="Run now"
										class="p-1.5 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
									>
										{#if runningIds.has(rule.id)}
											<Loader2 size={16} class="animate-spin" />
										{:else}
											<Play size={16} />
										{/if}
									</button>

									<!-- Enable / Disable toggle -->
									<button
										onclick={() => toggleEnabled(rule)}
										title={rule.enabled ? 'Disable rule' : 'Enable rule'}
										class="p-1.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
									>
										{#if rule.enabled}
											<Pause size={16} />
										{:else}
											<RefreshCw size={16} />
										{/if}
									</button>

									<!-- Edit -->
									<a
										href="{base}/evidence-automation/rules/{rule.id}"
										title="Edit rule"
										class="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
									>
										<Pencil size={16} />
									</a>

									<!-- Delete -->
									<button
										onclick={() => deleteRule(rule)}
										title="Delete rule"
										class="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
									>
										<Trash2 size={16} />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
