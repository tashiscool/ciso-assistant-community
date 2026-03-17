<script lang="ts">
	import { onMount } from 'svelte';
	import { BASE_API_URL } from '$lib/utils/constants';

	let folderId = $state('');
	let topN = $state(10);
	let loading = $state(false);
	let result = $state<any>(null);
	let error = $state('');
	let folders = $state<any[]>([]);

	const apiBaseUrl = typeof window === 'undefined' ? BASE_API_URL : '/api';

	onMount(async () => {
		try {
			const response = await fetch(`${apiBaseUrl}/folders/`);
			if (response.ok) {
				const data = await response.json();
				folders = data.results || data || [];
			}
		} catch (e) {
			console.error('Failed to load folders:', e);
		}
	});

	async function loadCriticalNodes() {
		if (!folderId) {
			error = 'Please select a folder';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(
				`${apiBaseUrl}/security-graph/folder/${folderId}/critical-nodes/?top_n=${topN}&include_blast_radius=true`
			);

			if (!response.ok) {
				throw new Error('Failed to load critical nodes');
			}

			result = await response.json();
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function getCriticalityColor(criticality: string): string {
		switch (criticality?.toLowerCase()) {
			case 'critical':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'high':
				return 'bg-orange-100 text-orange-800 border-orange-200';
			case 'medium':
				return 'bg-amber-100 text-amber-800 border-amber-200';
			case 'low':
				return 'bg-emerald-100 text-emerald-800 border-emerald-200';
			default:
				return 'bg-slate-100 text-slate-700 border-slate-200';
		}
	}

	function getTypeIcon(nodeType: string): string {
		switch (nodeType?.toLowerCase()) {
			case 'asset':
				return 'fa-server';
			case 'control':
				return 'fa-shield-halved';
			case 'risk':
				return 'fa-triangle-exclamation';
			case 'threat':
				return 'fa-skull-crossbones';
			case 'vulnerability':
				return 'fa-bug';
			case 'user':
				return 'fa-user';
			case 'system':
				return 'fa-computer';
			case 'data':
				return 'fa-database';
			case 'network':
				return 'fa-network-wired';
			case 'application':
				return 'fa-window-maximize';
			default:
				return 'fa-circle-dot';
		}
	}
</script>

<div class="flex-1 overflow-y-auto p-4 lg:p-6">
	<div class="brand-card-dark mb-5 overflow-hidden px-5 py-5 lg:px-6">
		<div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-2xl space-y-3">
				<span class="brand-overline !text-white/70">Critical Nodes</span>
				<div>
					<h2 class="text-2xl font-semibold text-white">Prioritize the nodes that move the graph</h2>
					<p class="mt-2 text-sm leading-6 text-slate-300">
						Surface the highest-leverage assets, controls, threats, and scenarios based on
						centrality, connectivity, and downstream blast radius.
					</p>
				</div>
			</div>
			<span class="brand-chip !border-white/15 !bg-white/10 !text-white">
				<i class="fa-solid fa-chart-network"></i>
				Folder-scoped ranking
			</span>
		</div>
	</div>

	<div class="brand-card mb-5 p-5 lg:p-6">
		<div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] xl:items-end">
			<div>
				<label for="critical-nodes-folder" class="mb-1 block text-sm font-medium text-slate-700"
					>Folder or domain</label
				>
				<select
					id="critical-nodes-folder"
					class="w-full rounded-2xl border-slate-200 bg-white/80 shadow-sm"
					bind:value={folderId}
				>
					<option value="">Select a folder...</option>
					{#each folders as folder}
						<option value={folder.id}>{folder.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="critical-nodes-top-n" class="mb-1 block text-sm font-medium text-slate-700"
					>Nodes to rank</label
				>
				<input
					id="critical-nodes-top-n"
					type="number"
					min="1"
					max="50"
					class="w-full rounded-2xl border-slate-200 bg-white/80 shadow-sm"
					bind:value={topN}
				/>
			</div>

			<button
				class="btn px-5 py-3 font-semibold text-white shadow-[0_20px_36px_rgb(11_31_42_/_0.18)] disabled:cursor-not-allowed disabled:opacity-50"
				style="background: var(--rv-gradient-accent);"
				onclick={loadCriticalNodes}
				disabled={loading || !folderId}
			>
				{#if loading}
					<i class="fa-solid fa-spinner fa-spin mr-2"></i>
					Analyzing...
				{:else}
					<i class="fa-solid fa-magnifying-glass-chart mr-2"></i>
					Rank Nodes
				{/if}
			</button>
		</div>
	</div>

	{#if error}
		<div class="brand-card mb-5 border-red-200 px-5 py-4 text-red-700">
			<i class="fa-solid fa-circle-exclamation mr-2"></i>
			{error}
		</div>
	{:else if result}
		<div class="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<div class="brand-card p-5">
				<div class="text-3xl font-semibold text-[var(--rv-midnight)]">
					{result.critical_nodes?.length || 0}
				</div>
				<div class="mt-2 text-sm text-slate-500">Priority nodes surfaced</div>
			</div>
			<div class="brand-card p-5">
				<div class="text-3xl font-semibold text-[var(--rv-blue)]">{result.total_nodes || 0}</div>
				<div class="mt-2 text-sm text-slate-500">Nodes in selected graph</div>
			</div>
			<div class="brand-card p-5">
				<div class="text-3xl font-semibold text-[#F97316]">
					{(result.critical_nodes || []).filter((node: any) => node.is_hub).length}
				</div>
				<div class="mt-2 text-sm text-slate-500">Hub nodes in top set</div>
			</div>
			<div class="brand-card p-5">
				<div class="text-3xl font-semibold text-[#DC2626]">
					{Math.max(
						0,
						...(result.critical_nodes || []).map((node: any) => Number(node.risk?.blast_radius_score || 0))
					).toFixed(1)}
				</div>
				<div class="mt-2 text-sm text-slate-500">Peak blast-radius score</div>
			</div>
		</div>

		<div class="space-y-4">
			{#each result.critical_nodes || [] as node, index}
				<div class="brand-card overflow-hidden p-5 lg:p-6">
					<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div class="flex items-start gap-4">
							<div class="brand-icon-badge h-12 w-12 rounded-[18px] text-base">
								<span class="font-semibold">#{index + 1}</span>
							</div>
							<div class="space-y-2">
								<div class="flex flex-wrap items-center gap-2">
									<i class="fa-solid {getTypeIcon(node.node_type)} text-slate-400"></i>
									<h3 class="text-lg font-semibold text-[var(--rv-midnight)]">{node.name}</h3>
									<span
										class="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold {getCriticalityColor(node.criticality)}"
									>
										{node.criticality}
									</span>
									{#if node.is_hub}
										<span class="brand-chip !bg-[rgba(88,181,255,0.14)] !text-[var(--rv-midnight)]">
											<i class="fa-solid fa-arrows-to-dot"></i>
											Hub node
										</span>
									{/if}
								</div>
								<div class="text-sm text-slate-500 capitalize">
									{node.node_type?.replace(/_/g, ' ')}
								</div>
								{#if node.description}
									<p class="max-w-3xl text-sm leading-6 text-slate-600">{node.description}</p>
								{/if}
							</div>
						</div>

						{#if node.source_type && node.source_id}
							<a
								href="/{node.source_type.toLowerCase().replace('_', '-')}s/{node.source_id}"
								class="brand-chip !bg-[rgba(20,200,181,0.12)] !text-[var(--rv-midnight)]"
							>
								<i class="fa-solid fa-arrow-up-right-from-square"></i>
								View source record
							</a>
						{/if}
					</div>

					<div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div class="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4 text-center">
							<div class="text-2xl font-semibold text-[var(--rv-midnight)]">{node.metrics?.degree || 0}</div>
							<div class="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
								Connections
							</div>
						</div>
						<div class="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4 text-center">
							<div class="text-2xl font-semibold text-[var(--rv-midnight)]">
								{(node.metrics?.pagerank * 100 || 0).toFixed(1)}%
							</div>
							<div class="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
								PageRank
							</div>
						</div>
						<div class="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4 text-center">
							<div class="text-2xl font-semibold text-[var(--rv-midnight)]">
								{(node.metrics?.betweenness_centrality * 100 || 0).toFixed(1)}%
							</div>
							<div class="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
								Betweenness
							</div>
						</div>
						<div class="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4 text-center">
							<div class="text-2xl font-semibold text-[#DC2626]">
								{node.risk?.blast_radius_score?.toFixed(1) || 0}
							</div>
							<div class="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
								Blast Radius
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if !result.critical_nodes || result.critical_nodes.length === 0}
			<div class="brand-card px-6 py-16 text-center">
				<div class="brand-icon-badge mx-auto h-16 w-16 rounded-[20px] text-2xl">
					<i class="fa-solid fa-circle-check"></i>
				</div>
				<h3 class="mt-5 text-xl font-semibold text-[var(--rv-midnight)]">No elevated nodes found</h3>
				<p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
					The selected folder currently has no nodes meeting the critical ranking threshold.
				</p>
			</div>
		{/if}
	{:else}
		<div class="brand-card px-6 py-16 text-center">
			<div class="brand-icon-badge mx-auto h-16 w-16 rounded-[20px] text-2xl">
				<i class="fa-solid fa-chart-network"></i>
			</div>
			<h3 class="mt-5 text-xl font-semibold text-[var(--rv-midnight)]">Rank the highest-leverage nodes</h3>
			<p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
				Choose a folder and Regovise will highlight the nodes with the greatest governance and
				propagation influence in that topology.
			</p>
		</div>
	{/if}
</div>
