<script lang="ts">
	import { onMount } from 'svelte';
	import { BASE_API_URL } from '$lib/utils/constants';

	interface Props {
		nodes: any[];
		selectedNodeId?: string;
	}

	let { nodes = [], selectedNodeId = '' }: Props = $props();

	let sourceNodeId = $state(selectedNodeId);
	let maxHops = $state(5);
	let propagationThreshold = $state(0.1);
	let loading = $state(false);
	let result = $state<any>(null);
	let error = $state('');

	async function analyzeBlastRadius() {
		if (!sourceNodeId) {
			error = 'Please select a source node';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/security-graph/blast-radius/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					source_node_id: sourceNodeId,
					max_hops: maxHops,
					propagation_threshold: propagationThreshold
				})
			});

			if (!response.ok) {
				throw new Error('Failed to analyze blast radius');
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
				return 'bg-red-100 text-red-800';
			case 'high':
				return 'bg-orange-100 text-orange-800';
			case 'medium':
				return 'bg-yellow-100 text-yellow-800';
			case 'low':
				return 'bg-green-100 text-green-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getImpactWidth(impactScore: number, maxScore: number): number {
		return Math.max(10, (impactScore / maxScore) * 100);
	}
</script>

<div class="flex-1 flex flex-col overflow-hidden">
	<!-- Analysis controls -->
	<div class="p-6 bg-white border-b">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">Blast Radius Analysis</h2>
		<p class="text-sm text-gray-600 mb-4">
			Analyze the potential impact propagation if a node is compromised.
		</p>

		<div class="grid grid-cols-3 gap-4 mb-4">
			<div>
				<label for="blast-source-node" class="block text-sm font-medium text-gray-700 mb-1">Source Node</label>
				<select
					id="blast-source-node"
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={sourceNodeId}
				>
					<option value="">Select a node...</option>
					{#each nodes as node}
						<option value={node.id}>{node.label || node.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="blast-max-hops" class="block text-sm font-medium text-gray-700 mb-1">Max Hops</label>
				<input
					id="blast-max-hops"
					type="number"
					min="1"
					max="10"
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={maxHops}
				/>
			</div>

			<div>
				<label for="blast-threshold" class="block text-sm font-medium text-gray-700 mb-1">Propagation Threshold</label>
				<input
					id="blast-threshold"
					type="number"
					min="0"
					max="1"
					step="0.1"
					class="w-full rounded-md border-gray-300 shadow-sm"
					bind:value={propagationThreshold}
				/>
			</div>
		</div>

		<button
			class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
			onclick={analyzeBlastRadius}
			disabled={loading || !sourceNodeId}
		>
			{#if loading}
				<i class="fa-solid fa-spinner fa-spin mr-2"></i>
				Analyzing...
			{:else}
				<i class="fa-solid fa-burst mr-2"></i>
				Analyze Blast Radius
			{/if}
		</button>
	</div>

	<!-- Results -->
	<div class="flex-1 overflow-y-auto p-6 bg-gray-50">
		{#if error}
			<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
				<i class="fa-solid fa-circle-exclamation mr-2"></i>
				{error}
			</div>
		{:else if result}
			<!-- Summary cards -->
			<div class="grid grid-cols-4 gap-4 mb-6">
				<div class="bg-white rounded-lg shadow p-4">
					<div class="text-2xl font-bold text-gray-900">{result.total_affected}</div>
					<div class="text-sm text-gray-500">Total Affected</div>
				</div>
				<div class="bg-white rounded-lg shadow p-4">
					<div class="text-2xl font-bold text-blue-600">{result.direct_impact}</div>
					<div class="text-sm text-gray-500">Direct Impact</div>
				</div>
				<div class="bg-white rounded-lg shadow p-4">
					<div class="text-2xl font-bold text-orange-600">{result.indirect_impact}</div>
					<div class="text-sm text-gray-500">Indirect Impact</div>
				</div>
				<div class="bg-white rounded-lg shadow p-4">
					<div class="text-2xl font-bold text-red-600">{result.critical_assets_affected}</div>
					<div class="text-sm text-gray-500">Critical Assets</div>
				</div>
			</div>

			<!-- Risk Score -->
			<div class="bg-white rounded-lg shadow p-4 mb-6">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium text-gray-700">Overall Risk Score</span>
					<span class="text-lg font-bold text-gray-900">{result.risk_score?.toFixed(2)}</span>
				</div>
				<div class="w-full bg-gray-200 rounded-full h-3">
					<div
						class="h-3 rounded-full transition-all duration-500"
						class:bg-green-500={result.risk_score < 25}
						class:bg-yellow-500={result.risk_score >= 25 && result.risk_score < 50}
						class:bg-orange-500={result.risk_score >= 50 && result.risk_score < 75}
						class:bg-red-500={result.risk_score >= 75}
						style="width: {Math.min(100, result.risk_score)}%"
					></div>
				</div>
			</div>

			<!-- Impact by Type -->
			{#if result.impact_by_type && Object.keys(result.impact_by_type).length > 0}
				<div class="bg-white rounded-lg shadow p-4 mb-6">
					<h3 class="text-sm font-medium text-gray-700 mb-3">Impact by Node Type</h3>
					<div class="space-y-2">
						{#each Object.entries(result.impact_by_type) as [type, count]}
							<div class="flex items-center justify-between">
								<span class="text-sm text-gray-600 capitalize">{type.replace(/_/g, ' ')}</span>
								<span class="text-sm font-medium text-gray-900">{count}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Impact by Hop -->
			{#if result.impact_by_hop && Object.keys(result.impact_by_hop).length > 0}
				<div class="bg-white rounded-lg shadow p-4 mb-6">
					<h3 class="text-sm font-medium text-gray-700 mb-3">Impact by Distance (Hops)</h3>
					<div class="space-y-2">
						{#each Object.entries(result.impact_by_hop).sort((a, b) => Number(a[0]) - Number(b[0])) as [hop, count]}
							<div class="flex items-center">
								<span class="text-sm text-gray-600 w-20">{hop} hop{Number(hop) > 1 ? 's' : ''}</span>
								<div class="flex-1 bg-gray-200 rounded h-4 mx-2">
									<div
										class="h-4 rounded bg-blue-500 transition-all duration-300"
										style="width: {(Number(count) / result.total_affected) * 100}%"
									></div>
								</div>
								<span class="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Affected Nodes -->
			{#if result.affected_nodes && result.affected_nodes.length > 0}
				<div class="bg-white rounded-lg shadow p-4 mb-6">
					<h3 class="text-sm font-medium text-gray-700 mb-3">Affected Nodes (by Impact)</h3>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b">
									<th class="text-left py-2 px-2">Node</th>
									<th class="text-left py-2 px-2">Type</th>
									<th class="text-left py-2 px-2">Criticality</th>
									<th class="text-center py-2 px-2">Hops</th>
									<th class="text-right py-2 px-2">Impact</th>
								</tr>
							</thead>
							<tbody>
								{#each result.affected_nodes.slice(0, 20) as node}
									<tr class="border-b hover:bg-gray-50">
										<td class="py-2 px-2 font-medium">{node.name}</td>
										<td class="py-2 px-2 text-gray-600 capitalize">{node.type?.replace(/_/g, ' ')}</td>
										<td class="py-2 px-2">
											<span class="inline-flex px-2 py-0.5 rounded text-xs font-medium {getCriticalityColor(node.criticality)}">
												{node.criticality}
											</span>
										</td>
										<td class="py-2 px-2 text-center">{node.hops}</td>
										<td class="py-2 px-2 text-right font-medium">{node.impact_score?.toFixed(2)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
						{#if result.affected_nodes.length > 20}
							<p class="text-sm text-gray-500 mt-2 text-center">
								Showing top 20 of {result.affected_nodes.length} affected nodes
							</p>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Recommendations -->
			{#if result.recommendations && result.recommendations.length > 0}
				<div class="bg-white rounded-lg shadow p-4">
					<h3 class="text-sm font-medium text-gray-700 mb-3">Recommendations</h3>
					<ul class="space-y-2">
						{#each result.recommendations as recommendation}
							<li class="flex items-start">
								<i class="fa-solid fa-lightbulb text-yellow-500 mt-0.5 mr-2"></i>
								<span class="text-sm text-gray-600">{recommendation}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{:else}
			<div class="flex flex-col items-center justify-center h-64 text-gray-500">
				<i class="fa-solid fa-burst text-4xl mb-4 text-gray-300"></i>
				<p class="text-sm">Select a node and click "Analyze Blast Radius" to see results</p>
			</div>
		{/if}
	</div>
</div>
