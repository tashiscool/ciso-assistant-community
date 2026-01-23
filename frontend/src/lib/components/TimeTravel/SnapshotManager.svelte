<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Snapshot } from './index';
	import { formatVersionDate } from './index';

	// Props
	export let snapshots: Snapshot[] = [];
	export let loading: boolean = false;
	export let canCreate: boolean = true;

	const dispatch = createEventDispatcher();

	// State
	let showCreateModal: boolean = false;
	let createForm = {
		name: '',
		description: '',
		snapshotType: 'manual' as Snapshot['snapshotType'],
		externalReference: '',
		isProtected: false
	};

	const SNAPSHOT_TYPES = [
		{ value: 'manual', label: 'Manual Snapshot', icon: 'fa-camera' },
		{ value: 'milestone', label: 'Milestone', icon: 'fa-flag' },
		{ value: 'release', label: 'Release', icon: 'fa-tag' },
		{ value: 'audit', label: 'Audit Point', icon: 'fa-clipboard-check' },
		{ value: 'backup', label: 'Backup', icon: 'fa-database' }
	];

	function openCreateModal() {
		createForm = {
			name: '',
			description: '',
			snapshotType: 'manual',
			externalReference: '',
			isProtected: false
		};
		showCreateModal = true;
	}

	function createSnapshot() {
		if (!createForm.name.trim()) return;

		dispatch('create', {
			...createForm
		});

		showCreateModal = false;
	}

	function restoreSnapshot(snapshot: Snapshot) {
		if (confirm(`Are you sure you want to restore from snapshot "${snapshot.name}"?`)) {
			dispatch('restore', { snapshot });
		}
	}

	function deleteSnapshot(snapshot: Snapshot) {
		if (snapshot.isProtected) {
			alert('This snapshot is protected and cannot be deleted.');
			return;
		}

		if (confirm(`Delete snapshot "${snapshot.name}"? This cannot be undone.`)) {
			dispatch('delete', { snapshot });
		}
	}

	function toggleProtection(snapshot: Snapshot) {
		dispatch('toggleProtection', { snapshot, protected: !snapshot.isProtected });
	}

	function getTypeIcon(type: string): string {
		return SNAPSHOT_TYPES.find((t) => t.value === type)?.icon || 'fa-camera';
	}

	function getTypeLabel(type: string): string {
		return SNAPSHOT_TYPES.find((t) => t.value === type)?.label || 'Snapshot';
	}

	// Group snapshots by type
	$: groupedSnapshots = snapshots.reduce(
		(acc, snapshot) => {
			const type = snapshot.snapshotType;
			if (!acc[type]) acc[type] = [];
			acc[type].push(snapshot);
			return acc;
		},
		{} as Record<string, Snapshot[]>
	);
</script>

<div class="snapshot-manager">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<h3 class="h4 flex items-center gap-2">
			<i class="fa-solid fa-camera text-primary-500"></i>
			Snapshots
		</h3>

		{#if canCreate}
			<button class="btn btn-sm variant-filled-primary" onclick={openCreateModal}>
				<i class="fa-solid fa-plus mr-1"></i>
				New Snapshot
			</button>
		{/if}
	</div>

	<!-- Snapshot List -->
	{#if loading}
		<div class="flex justify-center py-8">
			<i class="fa-solid fa-spinner fa-spin text-2xl"></i>
		</div>
	{:else if snapshots.length === 0}
		<div class="text-center py-8 text-surface-500 card variant-soft">
			<i class="fa-solid fa-camera-retro text-4xl mb-3"></i>
			<p class="mb-2">No snapshots yet</p>
			<p class="text-sm">Create snapshots to save important versions</p>
			{#if canCreate}
				<button class="btn btn-sm variant-ghost-primary mt-3" onclick={openCreateModal}>
					Create First Snapshot
				</button>
			{/if}
		</div>
	{:else}
		<div class="space-y-6">
			{#each Object.entries(groupedSnapshots) as [type, typeSnapshots]}
				<div class="snapshot-group">
					<h4 class="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-2 flex items-center gap-2">
						<i class="fa-solid {getTypeIcon(type)}"></i>
						{getTypeLabel(type)}
						<span class="badge variant-soft text-xs">{typeSnapshots.length}</span>
					</h4>

					<div class="space-y-2">
						{#each typeSnapshots as snapshot (snapshot.id)}
							<div class="snapshot-card card p-3 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
								<div class="flex items-start justify-between gap-4">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<span class="font-medium truncate">{snapshot.name}</span>
											{#if snapshot.isProtected}
												<i class="fa-solid fa-lock text-warning-500 text-sm" title="Protected"></i>
											{/if}
											<span class="badge variant-soft-secondary text-xs">v{snapshot.versionNumber}</span>
										</div>

										{#if snapshot.description}
											<p class="text-sm text-surface-500 mt-1 line-clamp-2">
												{snapshot.description}
											</p>
										{/if}

										<div class="flex items-center gap-4 mt-2 text-xs text-surface-500">
											<span>
												<i class="fa-solid fa-clock mr-1"></i>
												{formatVersionDate(snapshot.createdAt)}
											</span>
											{#if snapshot.createdByName}
												<span>
													<i class="fa-solid fa-user mr-1"></i>
													{snapshot.createdByName}
												</span>
											{/if}
											{#if snapshot.externalReference}
												<span>
													<i class="fa-solid fa-link mr-1"></i>
													{snapshot.externalReference}
												</span>
											{/if}
											{#if snapshot.expiresAt}
												<span class="text-warning-500">
													<i class="fa-solid fa-hourglass mr-1"></i>
													Expires: {formatVersionDate(snapshot.expiresAt)}
												</span>
											{/if}
										</div>
									</div>

									<div class="flex items-center gap-1">
										<button
											class="btn btn-sm variant-ghost-warning"
											title="Restore from snapshot"
											onclick={() => restoreSnapshot(snapshot)}
										>
											<i class="fa-solid fa-undo"></i>
										</button>
										<button
											class="btn btn-sm variant-ghost"
											title={snapshot.isProtected ? 'Unprotect' : 'Protect'}
											onclick={() => toggleProtection(snapshot)}
										>
											<i class="fa-solid {snapshot.isProtected ? 'fa-unlock' : 'fa-lock'}"></i>
										</button>
										<button
											class="btn btn-sm variant-ghost-error"
											title="Delete snapshot"
											disabled={snapshot.isProtected}
											onclick={() => deleteSnapshot(snapshot)}
										>
											<i class="fa-solid fa-trash"></i>
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Snapshot Modal -->
{#if showCreateModal}
	<div class="modal-backdrop" onclick={() => (showCreateModal = false)}>
		<div class="card p-6 w-full max-w-lg" onclick={(e) => e.stopPropagation()}>
			<h3 class="h4 mb-4">Create Snapshot</h3>

			<div class="space-y-4">
				<label class="label">
					<span>Name *</span>
					<input
						type="text"
						class="input"
						placeholder="e.g., Pre-audit snapshot"
						bind:value={createForm.name}
					/>
				</label>

				<label class="label">
					<span>Description</span>
					<textarea
						class="textarea"
						rows="2"
						placeholder="Optional description..."
						bind:value={createForm.description}
					></textarea>
				</label>

				<label class="label">
					<span>Type</span>
					<select class="select" bind:value={createForm.snapshotType}>
						{#each SNAPSHOT_TYPES as type}
							<option value={type.value}>
								{type.label}
							</option>
						{/each}
					</select>
				</label>

				<label class="label">
					<span>External Reference</span>
					<input
						type="text"
						class="input"
						placeholder="e.g., JIRA-123, Release v2.0"
						bind:value={createForm.externalReference}
					/>
				</label>

				<label class="flex items-center gap-2">
					<input type="checkbox" class="checkbox" bind:checked={createForm.isProtected} />
					<span>Protect snapshot from deletion</span>
				</label>
			</div>

			<div class="flex justify-end gap-2 mt-6">
				<button class="btn variant-ghost" onclick={() => (showCreateModal = false)}>
					Cancel
				</button>
				<button
					class="btn variant-filled-primary"
					disabled={!createForm.name.trim()}
					onclick={createSnapshot}
				>
					<i class="fa-solid fa-camera mr-1"></i>
					Create Snapshot
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 1rem;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
