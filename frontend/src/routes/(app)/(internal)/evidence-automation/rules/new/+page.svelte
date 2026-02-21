<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Loader2, Save, AlertTriangle } from 'lucide-svelte';
	import {
		evidenceRuleApi,
		evidenceSourceApi
	} from '$lib/services/evidence-automation/api';
	import type {
		EvidenceSource,
		CollectionType
	} from '$lib/services/evidence-automation/api';

	const COLLECTION_TYPES: Array<{ value: CollectionType; label: string }> = [
		{ value: 'screenshot', label: 'Screenshot' },
		{ value: 'configuration', label: 'Configuration' },
		{ value: 'log', label: 'Log' },
		{ value: 'report', label: 'Report' },
		{ value: 'policy', label: 'Policy' },
		{ value: 'inventory', label: 'Inventory' },
		{ value: 'scan_result', label: 'Scan Result' },
		{ value: 'audit_log', label: 'Audit Log' },
		{ value: 'user_list', label: 'User List' },
		{ value: 'certificate', label: 'Certificate' }
	];

	let sources = $state<EvidenceSource[]>([]);
	let loadingSources = $state(true);
	let submitting = $state(false);
	let error = $state<string | null>(null);

	// Form fields
	let sourceId = $state('');
	let name = $state('');
	let description = $state('');
	let collectionType = $state<CollectionType>('configuration');
	let query = $state('');
	let schedule = $state('');
	let retentionDays = $state(90);
	let enabled = $state(true);

	const canSubmit = $derived(sourceId !== '' && name.trim() !== '' && !submitting);

	onMount(async () => {
		try {
			const res = await evidenceSourceApi.list();
			if (res.success) {
				sources = res.data?.results ?? [];
			}
		} catch (e) {
			console.error('Failed to load sources:', e);
		} finally {
			loadingSources = false;
		}
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!canSubmit) return;

		submitting = true;
		error = null;
		try {
			const res = await evidenceRuleApi.create({
				source: sourceId,
				name: name.trim(),
				description: description.trim() || undefined,
				collection_type: collectionType,
				query: query.trim() || undefined,
				schedule: schedule.trim() || undefined,
				retention_days: retentionDays,
				enabled
			});

			if (res.success) {
				goto(`${base}/evidence-automation/rules`);
			} else {
				error = 'Failed to create rule. Please check the form and try again.';
			}
		} catch (e) {
			error = 'An unexpected error occurred. Please try again.';
			console.error('Error creating rule:', e);
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>New Collection Rule - Evidence Automation</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Back link -->
	<a
		href="{base}/evidence-automation/rules"
		class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6"
	>
		<ArrowLeft size={16} />
		Back to Collection Rules
	</a>

	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h1 class="text-lg font-semibold text-gray-900 dark:text-white">New Collection Rule</h1>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Define a rule to automate evidence collection from a source
			</p>
		</div>

		<form onsubmit={handleSubmit} class="px-6 py-6 space-y-5">
			{#if error}
				<div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
					<AlertTriangle size={18} class="text-red-600 mt-0.5 shrink-0" />
					<p class="text-sm text-red-700 dark:text-red-400">{error}</p>
				</div>
			{/if}

			<!-- Source -->
			<div>
				<label for="source" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Evidence Source <span class="text-red-500">*</span>
				</label>
				{#if loadingSources}
					<div class="flex items-center gap-2 text-sm text-gray-500 py-2">
						<Loader2 size={16} class="animate-spin" />
						Loading sources...
					</div>
				{:else}
					<select
						id="source"
						bind:value={sourceId}
						required
						class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
					>
						<option value="">Select a source...</option>
						{#each sources as source}
							<option value={source.id}>{source.name} ({source.source_type_display})</option>
						{/each}
					</select>
					{#if sources.length === 0}
						<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
							No sources available.
							<a href="{base}/evidence-automation/sources/new" class="underline">Add a source first.</a>
						</p>
					{/if}
				{/if}
			</div>

			<!-- Name -->
			<div>
				<label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Rule Name <span class="text-red-500">*</span>
				</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					required
					placeholder="e.g. AWS IAM Users Weekly Snapshot"
					class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Description
				</label>
				<textarea
					id="description"
					bind:value={description}
					rows={3}
					placeholder="Describe what this rule collects and why..."
					class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
				></textarea>
			</div>

			<!-- Collection Type -->
			<div>
				<label for="collectionType" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Collection Type <span class="text-red-500">*</span>
				</label>
				<select
					id="collectionType"
					bind:value={collectionType}
					required
					class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
				>
					{#each COLLECTION_TYPES as ct}
						<option value={ct.value}>{ct.label}</option>
					{/each}
				</select>
			</div>

			<!-- Query -->
			<div>
				<label for="query" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Query <span class="text-xs text-gray-400 font-normal">(optional)</span>
				</label>
				<input
					id="query"
					type="text"
					bind:value={query}
					placeholder="e.g. SELECT * FROM users WHERE active = true"
					class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
				/>
				<p class="mt-1 text-xs text-gray-400">Filter query or expression passed to the source adapter</p>
			</div>

			<!-- Schedule -->
			<div>
				<label for="schedule" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Schedule <span class="text-xs text-gray-400 font-normal">(optional, cron expression)</span>
				</label>
				<input
					id="schedule"
					type="text"
					bind:value={schedule}
					placeholder="e.g. 0 0 * * 1 (every Monday at midnight)"
					class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
				/>
			</div>

			<!-- Retention Days -->
			<div>
				<label for="retentionDays" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Retention Days
				</label>
				<input
					id="retentionDays"
					type="number"
					bind:value={retentionDays}
					min={1}
					max={3650}
					class="block w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-amber-500 focus:border-amber-500"
				/>
				<p class="mt-1 text-xs text-gray-400">How long to retain collected evidence (days)</p>
			</div>

			<!-- Enabled toggle -->
			<div class="flex items-center gap-3">
				<button
					type="button"
					role="switch"
					aria-checked={enabled}
					onclick={() => (enabled = !enabled)}
					class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors {enabled
						? 'bg-amber-500'
						: 'bg-gray-300 dark:bg-gray-600'} focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
				>
					<span
						class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {enabled
							? 'translate-x-5'
							: 'translate-x-0'}"
					></span>
				</button>
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
					{enabled ? 'Enabled — rule will run on schedule' : 'Disabled — rule will not run automatically'}
				</span>
			</div>

			<!-- Form actions -->
			<div class="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
				<button
					type="submit"
					disabled={!canSubmit}
					class="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if submitting}
						<Loader2 size={16} class="animate-spin" />
						Creating...
					{:else}
						<Save size={16} />
						Create Rule
					{/if}
				</button>
				<a
					href="{base}/evidence-automation/rules"
					class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					Cancel
				</a>
			</div>
		</form>
	</div>
</div>
