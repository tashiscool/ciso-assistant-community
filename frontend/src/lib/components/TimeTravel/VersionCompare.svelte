<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Version, VersionDiffData } from './index';
	import { formatVersionDate, formatFieldName } from './index';
	import VersionDiff from './VersionDiff.svelte';

	// Props
	export let versions: Version[] = [];
	export let initialFromVersion: Version | null = null;
	export let initialToVersion: Version | null = null;

	const dispatch = createEventDispatcher();

	// State
	let fromVersion: Version | null = initialFromVersion;
	let toVersion: Version | null = initialToVersion;
	let diff: VersionDiffData | null = null;
	let loading: boolean = false;
	let viewMode: 'diff' | 'side-by-side' = 'diff';

	$: canCompare = fromVersion && toVersion && fromVersion.id !== toVersion.id;

	async function loadDiff() {
		if (!canCompare) return;

		loading = true;
		dispatch('loadDiff', {
			from: fromVersion,
			to: toVersion,
			callback: (result: VersionDiffData) => {
				diff = result;
				loading = false;
			}
		});
	}

	function swapVersions() {
		const temp = fromVersion;
		fromVersion = toVersion;
		toVersion = temp;
		if (diff) {
			loadDiff();
		}
	}

	function formatValue(value: any): string {
		if (value === null || value === undefined) return '(empty)';
		if (typeof value === 'object') return JSON.stringify(value, null, 2);
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		return String(value);
	}

	// Get all unique fields from both versions
	$: allFields =
		fromVersion && toVersion
			? [
					...new Set([
						...Object.keys(fromVersion.snapshotData || {}),
						...Object.keys(toVersion.snapshotData || {})
					])
				].sort()
			: [];
</script>

<div class="version-compare">
	<!-- Version Selectors -->
	<div class="grid grid-cols-2 gap-4 mb-4">
		<div>
			<label class="label">
				<span class="text-sm font-medium">From Version</span>
				<select class="select" bind:value={fromVersion}>
					<option value={null}>Select version...</option>
					{#each versions as version}
						<option value={version} disabled={version.id === toVersion?.id}>
							v{version.versionNumber} - {version.changeSummary}
						</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="relative">
			<button
				class="swap-btn absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 btn btn-sm variant-ghost-primary rounded-full z-10"
				onclick={swapVersions}
				title="Swap versions"
			>
				<i class="fa-solid fa-right-left"></i>
			</button>
			<label class="label">
				<span class="text-sm font-medium">To Version</span>
				<select class="select" bind:value={toVersion}>
					<option value={null}>Select version...</option>
					{#each versions as version}
						<option value={version} disabled={version.id === fromVersion?.id}>
							v{version.versionNumber} - {version.changeSummary}
						</option>
					{/each}
				</select>
			</label>
		</div>
	</div>

	<!-- Compare Button -->
	{#if canCompare && !diff}
		<button class="btn variant-filled-primary w-full mb-4" onclick={loadDiff} disabled={loading}>
			{#if loading}
				<i class="fa-solid fa-spinner fa-spin mr-2"></i>
			{:else}
				<i class="fa-solid fa-code-compare mr-2"></i>
			{/if}
			Compare Versions
		</button>
	{/if}

	<!-- View Mode Toggle -->
	{#if diff}
		<div class="flex items-center justify-between mb-4">
			<div class="text-sm text-surface-500">
				Comparing v{fromVersion?.versionNumber} → v{toVersion?.versionNumber}
			</div>
			<div class="btn-group variant-ghost">
				<button
					class="btn btn-sm {viewMode === 'diff' ? 'variant-filled-primary' : ''}"
					onclick={() => (viewMode = 'diff')}
				>
					<i class="fa-solid fa-code-compare"></i>
					Diff
				</button>
				<button
					class="btn btn-sm {viewMode === 'side-by-side' ? 'variant-filled-primary' : ''}"
					onclick={() => (viewMode = 'side-by-side')}
				>
					<i class="fa-solid fa-columns"></i>
					Side by Side
				</button>
			</div>
		</div>
	{/if}

	<!-- Comparison Results -->
	{#if loading}
		<div class="flex justify-center py-8">
			<i class="fa-solid fa-spinner fa-spin text-2xl"></i>
		</div>
	{:else if diff && viewMode === 'diff'}
		<VersionDiff
			{diff}
			fromVersion={fromVersion?.versionNumber || 0}
			toVersion={toVersion?.versionNumber || 0}
		/>
	{:else if diff && viewMode === 'side-by-side' && fromVersion && toVersion}
		<div class="side-by-side overflow-x-auto">
			<table class="table table-compact w-full">
				<thead>
					<tr>
						<th class="w-1/4">Field</th>
						<th class="w-1/4">
							v{fromVersion.versionNumber}
							<span class="text-xs text-surface-500 ml-2">
								{formatVersionDate(fromVersion.createdAt)}
							</span>
						</th>
						<th class="w-1/4">
							v{toVersion.versionNumber}
							<span class="text-xs text-surface-500 ml-2">
								{formatVersionDate(toVersion.createdAt)}
							</span>
						</th>
						<th class="w-auto">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each allFields as field}
						{@const fromValue = fromVersion.snapshotData?.[field]}
						{@const toValue = toVersion.snapshotData?.[field]}
						{@const hasChanged = JSON.stringify(fromValue) !== JSON.stringify(toValue)}
						<tr class={hasChanged ? 'bg-warning-50 dark:bg-warning-900/20' : ''}>
							<td class="font-medium">{formatFieldName(field)}</td>
							<td class="font-mono text-sm">
								{#if fromValue !== undefined}
									<span class={hasChanged ? 'text-error-600' : ''}>
										{formatValue(fromValue)}
									</span>
								{:else}
									<span class="text-surface-400">-</span>
								{/if}
							</td>
							<td class="font-mono text-sm">
								{#if toValue !== undefined}
									<span class={hasChanged ? 'text-success-600' : ''}>
										{formatValue(toValue)}
									</span>
								{:else}
									<span class="text-surface-400">-</span>
								{/if}
							</td>
							<td>
								{#if fromValue === undefined && toValue !== undefined}
									<span class="badge variant-soft-success text-xs">Added</span>
								{:else if fromValue !== undefined && toValue === undefined}
									<span class="badge variant-soft-error text-xs">Removed</span>
								{:else if hasChanged}
									<span class="badge variant-soft-warning text-xs">Changed</span>
								{:else}
									<span class="badge variant-soft text-xs">Unchanged</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if !canCompare}
		<div class="text-center py-8 text-surface-500">
			<i class="fa-solid fa-code-compare text-4xl mb-2"></i>
			<p>Select two different versions to compare</p>
		</div>
	{/if}
</div>

<style>
	.swap-btn {
		margin-left: -2rem;
	}

	.side-by-side td {
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.side-by-side td:hover {
		white-space: normal;
		word-break: break-word;
	}
</style>
