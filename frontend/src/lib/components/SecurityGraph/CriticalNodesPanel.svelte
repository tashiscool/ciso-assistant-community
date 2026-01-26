<script lang="ts">
	import { onMount } from 'svelte';
	import { BASE_API_URL } from '$lib/utils/constants';

	let folderId = $state('');
	let topN = $state(10);
	let loading = $state(false);
	let result = $state<any>(null);
	let error = $state('');
	let folders = $state<any[]>([]);

	onMount(async () => {
		// Load available folders
		try {
			const response = await fetch(`${BASE_API_URL}/folders/`);
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
				`${BASE_API_URL}/security-graph/folder/${folderId}/critical-nodes/?top_n=${topN}&include_blast_radius=true`
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
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'low':
				return 'bg-green-100 text-green-800 border-green-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
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

<div class="flex-1 flex flex-col overflow-hidden">
	<!-- Controls -->
	<div class="p-6 bg-white border-b">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">Critical Nodes Analysis</h2>
		<p class="text-sm text-gray-600 mb-4">
			Identify the most critical nodes based on connectivity, centrality, and risk metrics.
		</p>

		<div class="grid grid-cols-3 gap-4 mb-4">
			<div>
				<label for="critical-nodes-folder" class="block text-sm font-medium text-gray-700 mb-1">Folder/Domain</label>
				<select
					id="critical-nodes-folder"
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={folderId}
				>
					<option value="">Select a folder...</option>
					{#each folders as folder}
						<option value={folder.id}>{folder.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="critical-nodes-top-n" class="block text-sm font-medium text-gray-700 mb-1">Number of Nodes</label>
				<input
					id="critical-nodes-top-n"
					type="number"
					min="1"
					max="50"
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={topN}
				/>
			</div>

			<div class="flex items-end">
				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={loadCriticalNodes}
					disabled={loading || !folderId}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Loading...
					{:else}
						<i class="fa-solid fa-magnifying-glass-chart mr-2"></i>
						Analyze
					{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- Results -->
	<div class="flex-1 overflow-y-auto p-6 bg-gray-50">
		{#if error}
			<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
				<i class="fa-solid fa-circle-exclamation mr-2"></i>
				{error}
			</div>
		{:else if result}
			<!-- Summary -->
			<div class="bg-white rounded-lg shadow p-4 mb-6">
				<div class="flex items-center justify-between">
					<span class="text-sm text-gray-600">
						Showing top {result.critical_nodes?.length || 0} critical nodes
						out of {result.total_nodes || 0} total nodes
					</span>
				</div>
			</div>

			<!-- Critical Nodes List -->
			<div class="space-y-4">
				{#each result.critical_nodes || [] as node, index}
					<div class="bg-white rounded-lg shadow p-4 border-l-4 {getCriticalityColor(node.criticality)}">
						<div class="flex items-start justify-between">
							<div class="flex items-start space-x-3">
								<div class="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
									<span class="text-sm font-bold text-gray-600">#{index + 1}</span>
								</div>
								<div>
									<div class="flex items-center space-x-2">
										<i class="fa-solid {getTypeIcon(node.node_type)} text-gray-400"></i>
										<h3 class="font-medium text-gray-900">{node.name}</h3>
									</div>
									<div class="flex items-center space-x-3 mt-1 text-xs text-gray-500">
										<span class="capitalize">{node.node_type?.replace(/_/g, ' ')}</span>
										<span>•</span>
										<span class="inline-flex px-2 py-0.5 rounded {getCriticalityColor(node.criticality)}">
											{node.criticality}
										</span>
										{#if node.is_hub}
											<span>•</span>
											<span class="text-orange-600">
												<i class="fa-solid fa-hub mr-1"></i>Hub Node
											</span>
										{/if}
									</div>
								</div>
							</div>
						</div>

						<!-- Metrics -->
						<div class="mt-4 grid grid-cols-4 gap-4">
							<div class="text-center">
								<div class="text-lg font-semibold text-gray-900">{node.metrics?.degree || 0}</div>
								<div class="text-xs text-gray-500">Connections</div>
							</div>
							<div class="text-center">
								<div class="text-lg font-semibold text-gray-900">
									{(node.metrics?.pagerank * 100 || 0).toFixed(1)}%
								</div>
								<div class="text-xs text-gray-500">PageRank</div>
							</div>
							<div class="text-center">
								<div class="text-lg font-semibold text-gray-900">
									{(node.metrics?.betweenness_centrality * 100 || 0).toFixed(1)}%
								</div>
								<div class="text-xs text-gray-500">Betweenness</div>
							</div>
							<div class="text-center">
								<div class="text-lg font-semibold text-red-600">
									{node.risk?.blast_radius_score?.toFixed(1) || 0}
								</div>
								<div class="text-xs text-gray-500">Blast Radius</div>
							</div>
						</div>

						{#if node.description}
							<p class="mt-3 text-sm text-gray-600">{node.description}</p>
						{/if}

						<!-- Actions -->
						<div class="mt-4 pt-3 border-t flex items-center space-x-4">
							{#if node.source_type && node.source_id}
								<a
									href="/{node.source_type.toLowerCase().replace('_', '-')}s/{node.source_id}"
									class="text-sm text-primary-600 hover:text-primary-800"
								>
									<i class="fa-solid fa-external-link mr-1"></i>
									View Details
								</a>
							{/if}
							<button class="text-sm text-gray-500 hover:text-gray-700" aria-label="Analyze blast radius for this node">
								<i class="fa-solid fa-burst mr-1"></i>
								Analyze Blast Radius
							</button>
						</div>
					</div>
				{/each}
			</div>

			{#if !result.critical_nodes || result.critical_nodes.length === 0}
				<div class="flex flex-col items-center justify-center h-64 text-gray-500">
					<i class="fa-solid fa-circle-check text-4xl mb-4 text-green-300"></i>
					<p class="text-sm">No critical nodes found in this folder</p>
				</div>
			{/if}
		{:else}
			<div class="flex flex-col items-center justify-center h-64 text-gray-500">
				<i class="fa-solid fa-chart-network text-4xl mb-4 text-gray-300"></i>
				<p class="text-sm">Select a folder and click "Analyze" to identify critical nodes</p>
			</div>
		{/if}
	</div>
</div>
