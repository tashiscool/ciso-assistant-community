<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Version, Snapshot, TimelineEntry } from './index';
	import { CHANGE_TYPE_COLORS, CHANGE_TYPE_ICONS, formatVersionDate } from './index';

	// Props
	export let versions: Version[] = [];
	export let snapshots: Snapshot[] = [];
	export let currentVersion: number = 0;
	export let loading: boolean = false;
	export let objectType: string = '';
	export let objectId: string = '';

	const dispatch = createEventDispatcher();

	// State
	let activeTab: 'history' | 'snapshots' | 'compare' = 'history';
	let selectedVersions: string[] = [];
	let compareMode: boolean = false;
	let showCreateSnapshot: boolean = false;
	let newSnapshotName: string = '';
	let newSnapshotDescription: string = '';

	function selectVersion(version: Version) {
		if (compareMode) {
			if (selectedVersions.includes(version.id)) {
				selectedVersions = selectedVersions.filter((id) => id !== version.id);
			} else if (selectedVersions.length < 2) {
				selectedVersions = [...selectedVersions, version.id];
			}
		} else {
			dispatch('viewVersion', { version });
		}
	}

	function toggleCompareMode() {
		compareMode = !compareMode;
		if (!compareMode) {
			selectedVersions = [];
		}
	}

	function compareSelected() {
		if (selectedVersions.length === 2) {
			const v1 = versions.find((v) => v.id === selectedVersions[0]);
			const v2 = versions.find((v) => v.id === selectedVersions[1]);
			dispatch('compare', { from: v1, to: v2 });
		}
	}

	function restoreVersion(version: Version) {
		if (confirm(`Are you sure you want to restore to version ${version.versionNumber}?`)) {
			dispatch('restore', { version });
		}
	}

	function createSnapshot() {
		if (newSnapshotName.trim()) {
			dispatch('createSnapshot', {
				name: newSnapshotName,
				description: newSnapshotDescription
			});
			showCreateSnapshot = false;
			newSnapshotName = '';
			newSnapshotDescription = '';
		}
	}

	function restoreSnapshot(snapshot: Snapshot) {
		if (confirm(`Are you sure you want to restore from snapshot "${snapshot.name}"?`)) {
			dispatch('restoreSnapshot', { snapshot });
		}
	}

	function deleteSnapshot(snapshot: Snapshot) {
		if (!snapshot.isProtected && confirm(`Delete snapshot "${snapshot.name}"?`)) {
			dispatch('deleteSnapshot', { snapshot });
		}
	}
</script>

<div class="time-travel-panel card p-4">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2">
			<i class="fa-solid fa-clock-rotate-left text-primary-500"></i>
			<h3 class="h4">Version History</h3>
			{#if currentVersion > 0}
				<span class="badge variant-soft-primary">v{currentVersion}</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<button
				class="btn btn-sm {compareMode ? 'variant-filled-primary' : 'variant-ghost-primary'}"
				onclick={() => toggleCompareMode()}
			>
				<i class="fa-solid fa-code-compare"></i>
				Compare
			</button>
			<button class="btn btn-sm variant-ghost-success" onclick={() => (showCreateSnapshot = true)}>
				<i class="fa-solid fa-camera"></i>
				Snapshot
			</button>
		</div>
	</div>

	<!-- Tabs -->
	<div class="tab-group mb-4">
		<button
			class="tab {activeTab === 'history' ? 'tab-active' : ''}"
			onclick={() => (activeTab = 'history')}
		>
			History ({versions.length})
		</button>
		<button
			class="tab {activeTab === 'snapshots' ? 'tab-active' : ''}"
			onclick={() => (activeTab = 'snapshots')}
		>
			Snapshots ({snapshots.length})
		</button>
	</div>

	<!-- Compare Mode Banner -->
	{#if compareMode}
		<div class="alert variant-soft-primary mb-4">
			<i class="fa-solid fa-info-circle"></i>
			<span>Select two versions to compare ({selectedVersions.length}/2 selected)</span>
			{#if selectedVersions.length === 2}
				<button class="btn btn-sm variant-filled-primary ml-auto" onclick={compareSelected}>
					Compare Now
				</button>
			{/if}
		</div>
	{/if}

	<!-- Content -->
	{#if loading}
		<div class="flex justify-center py-8">
			<i class="fa-solid fa-spinner fa-spin text-2xl"></i>
		</div>
	{:else if activeTab === 'history'}
		<div class="version-list space-y-2 max-h-[500px] overflow-y-auto">
			{#each versions as version (version.id)}
				<button
					class="version-item card p-3 w-full text-left hover:bg-surface-100-800-token transition-colors
            {selectedVersions.includes(version.id) ? 'ring-2 ring-primary-500' : ''}
            {version.versionNumber === currentVersion ? 'bg-primary-50 dark:bg-primary-900/20' : ''}"
					onclick={() => selectVersion(version)}
				>
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-center gap-3">
							{#if compareMode}
								<input
									type="checkbox"
									class="checkbox"
									checked={selectedVersions.includes(version.id)}
									onclick={(e) => e.stopPropagation()}
								/>
							{/if}
							<div
								class="badge {CHANGE_TYPE_COLORS[version.changeType] || 'variant-soft'} text-xs"
							>
								<i class="fa-solid {CHANGE_TYPE_ICONS[version.changeType]} mr-1"></i>
								v{version.versionNumber}
							</div>
						</div>
						<span class="text-xs text-surface-500">{formatVersionDate(version.createdAt)}</span>
					</div>

					<div class="mt-2">
						<p class="font-medium">{version.changeSummary}</p>
						{#if version.changedFields.length > 0}
							<p class="text-xs text-surface-500 mt-1">
								Changed: {version.changedFields.slice(0, 3).join(', ')}
								{#if version.changedFields.length > 3}
									+{version.changedFields.length - 3} more
								{/if}
							</p>
						{/if}
						{#if version.createdByName}
							<p class="text-xs text-surface-500 mt-1">
								<i class="fa-solid fa-user mr-1"></i>
								{version.createdByName}
							</p>
						{/if}
					</div>

					{#if !compareMode && version.versionNumber !== currentVersion}
						<div class="mt-3 flex gap-2">
							<button
								class="btn btn-sm variant-ghost-primary"
								onclick={(e) => {
									e.stopPropagation();
									dispatch('viewVersion', { version });
								}}
							>
								<i class="fa-solid fa-eye"></i>
								View
							</button>
							<button
								class="btn btn-sm variant-ghost-warning"
								onclick={(e) => {
									e.stopPropagation();
									restoreVersion(version);
								}}
							>
								<i class="fa-solid fa-undo"></i>
								Restore
							</button>
						</div>
					{/if}
				</button>
			{/each}

			{#if versions.length === 0}
				<div class="text-center py-8 text-surface-500">
					<i class="fa-solid fa-history text-4xl mb-2"></i>
					<p>No version history yet</p>
				</div>
			{/if}
		</div>
	{:else if activeTab === 'snapshots'}
		<div class="snapshot-list space-y-2 max-h-[500px] overflow-y-auto">
			{#each snapshots as snapshot (snapshot.id)}
				<div class="snapshot-item card p-3">
					<div class="flex items-start justify-between">
						<div>
							<div class="flex items-center gap-2">
								<span class="font-medium">{snapshot.name}</span>
								{#if snapshot.isProtected}
									<i class="fa-solid fa-lock text-warning-500" title="Protected"></i>
								{/if}
								<span class="badge variant-soft text-xs">v{snapshot.versionNumber}</span>
							</div>
							{#if snapshot.description}
								<p class="text-sm text-surface-500 mt-1">{snapshot.description}</p>
							{/if}
							<p class="text-xs text-surface-500 mt-2">
								{formatVersionDate(snapshot.createdAt)}
								{#if snapshot.createdByName}
									by {snapshot.createdByName}
								{/if}
							</p>
						</div>
						<div class="flex gap-2">
							<button
								class="btn btn-sm variant-ghost-warning"
								onclick={() => restoreSnapshot(snapshot)}
							>
								<i class="fa-solid fa-undo"></i>
							</button>
							{#if !snapshot.isProtected}
								<button
									class="btn btn-sm variant-ghost-error"
									onclick={() => deleteSnapshot(snapshot)}
								>
									<i class="fa-solid fa-trash"></i>
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/each}

			{#if snapshots.length === 0}
				<div class="text-center py-8 text-surface-500">
					<i class="fa-solid fa-camera text-4xl mb-2"></i>
					<p>No snapshots created yet</p>
					<button
						class="btn btn-sm variant-ghost-primary mt-2"
						onclick={() => (showCreateSnapshot = true)}
					>
						Create First Snapshot
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Create Snapshot Modal -->
{#if showCreateSnapshot}
	<div class="modal-backdrop" onclick={() => (showCreateSnapshot = false)}>
		<div class="card p-6 w-full max-w-md" onclick={(e) => e.stopPropagation()}>
			<h3 class="h4 mb-4">Create Snapshot</h3>

			<label class="label mb-3">
				<span>Name</span>
				<input type="text" class="input" placeholder="e.g., Before major update" bind:value={newSnapshotName} />
			</label>

			<label class="label mb-4">
				<span>Description (optional)</span>
				<textarea class="textarea" rows="2" placeholder="Describe this snapshot..." bind:value={newSnapshotDescription}></textarea>
			</label>

			<div class="flex justify-end gap-2">
				<button class="btn variant-ghost" onclick={() => (showCreateSnapshot = false)}>
					Cancel
				</button>
				<button
					class="btn variant-filled-primary"
					disabled={!newSnapshotName.trim()}
					onclick={createSnapshot}
				>
					Create Snapshot
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.tab-group {
		display: flex;
		border-bottom: 1px solid var(--color-surface-300);
	}

	.tab {
		padding: 0.5rem 1rem;
		border-bottom: 2px solid transparent;
		font-weight: 500;
		color: var(--color-surface-600);
		transition: all 0.2s;
	}

	.tab:hover {
		color: var(--color-primary-500);
	}

	.tab-active {
		color: var(--color-primary-500);
		border-bottom-color: var(--color-primary-500);
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}
</style>
