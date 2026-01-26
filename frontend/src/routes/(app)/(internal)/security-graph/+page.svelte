<script lang="ts">
	import type { PageData } from './$types';
	import { pageTitle } from '$lib/utils/stores';
	import { onMount } from 'svelte';
	import GraphViewer from '$lib/components/SecurityGraph/GraphViewer.svelte';
	import BlastRadiusPanel from '$lib/components/SecurityGraph/BlastRadiusPanel.svelte';
	import CriticalNodesPanel from '$lib/components/SecurityGraph/CriticalNodesPanel.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	pageTitle.set('Security Graph');

	let selectedNode: any = $state(null);
	let showBlastRadius = $state(false);
	let showCriticalNodes = $state(false);
	let graphData = $state(data.graphData || { nodes: [], edges: [] });
	let activeTab = $state<'graph' | 'blast-radius' | 'critical-nodes' | 'attack-paths'>('graph');

	// Transform data for the graph viewer
	const transformedData = $derived(() => {
		if (!graphData || !graphData.nodes) {
			return { nodes: [], links: [], categories: [] };
		}

		// Create categories from node types
		const nodeTypes = [...new Set(graphData.nodes.map((n: any) => n.group || n.node_type || 'unknown'))];
		const categories = nodeTypes.map((type: string) => ({
			name: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
		}));

		// Create category index map
		const categoryIndex: Record<string, number> = {};
		categories.forEach((cat, idx) => {
			categoryIndex[cat.name.toLowerCase().replace(/ /g, '_')] = idx;
		});

		// Transform nodes
		const nodes = graphData.nodes.map((node: any, idx: number) => ({
			id: idx,
			pk: node.id,
			name: node.label || node.name,
			value: node.group || node.node_type,
			category: categoryIndex[node.group || node.node_type] || 0,
			symbolSize: node.size || 20,
			itemStyle: {
				color: node.color || getNodeColor(node.group || node.node_type)
			},
			criticality: node.criticality,
			riskScore: node.risk_score || 0
		}));

		// Create node ID to index mapping
		const nodeIdToIndex: Record<string, number> = {};
		graphData.nodes.forEach((node: any, idx: number) => {
			nodeIdToIndex[node.id] = idx;
		});

		// Transform edges
		const links = (graphData.edges || []).map((edge: any) => ({
			source: nodeIdToIndex[edge.from] ?? 0,
			target: nodeIdToIndex[edge.to] ?? 0,
			value: edge.label || edge.edge_type,
			lineStyle: {
				color: edge.color || '#999',
				width: edge.width || 1,
				type: edge.dashes ? 'dashed' : 'solid'
			}
		}));

		return { nodes, links, categories };
	});

	function getNodeColor(nodeType: string): string {
		const colors: Record<string, string> = {
			asset: '#4CAF50',
			control: '#2196F3',
			risk: '#F44336',
			threat: '#FF9800',
			vulnerability: '#9C27B0',
			user: '#00BCD4',
			system: '#607D8B',
			data: '#3F51B5',
			network: '#009688',
			application: '#673AB7',
			process: '#795548',
			third_party: '#FF5722'
		};
		return colors[nodeType?.toLowerCase()] || '#9E9E9E';
	}

	function handleNodeClick(node: any) {
		selectedNode = node;
	}

	function handleNodeDoubleClick(params: any) {
		if (params.dataType === 'node' && params.data?.pk) {
			// Navigate to the source entity if available
			const nodeType = params.data.value?.toLowerCase();
			if (nodeType === 'asset') {
				window.location.href = `/assets/${params.data.pk}`;
			} else if (nodeType === 'control') {
				window.location.href = `/applied-controls/${params.data.pk}`;
			} else if (nodeType === 'risk') {
				window.location.href = `/risk-scenarios/${params.data.pk}`;
			} else if (nodeType === 'threat') {
				window.location.href = `/threats/${params.data.pk}`;
			}
		}
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header with tabs -->
	<div class="bg-white shadow-sm border-b">
		<div class="flex items-center justify-between px-4 py-3">
			<h1 class="text-xl font-semibold text-gray-900">Security Relationship Graph</h1>
			<div class="flex items-center space-x-2">
				<button
					class="px-3 py-1.5 text-sm rounded-md {activeTab === 'graph'
						? 'bg-primary-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					onclick={() => (activeTab = 'graph')}
				>
					<i class="fa-solid fa-diagram-project mr-1"></i>
					Graph View
				</button>
				<button
					class="px-3 py-1.5 text-sm rounded-md {activeTab === 'blast-radius'
						? 'bg-primary-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					onclick={() => (activeTab = 'blast-radius')}
				>
					<i class="fa-solid fa-burst mr-1"></i>
					Blast Radius
				</button>
				<button
					class="px-3 py-1.5 text-sm rounded-md {activeTab === 'critical-nodes'
						? 'bg-primary-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					onclick={() => (activeTab = 'critical-nodes')}
				>
					<i class="fa-solid fa-triangle-exclamation mr-1"></i>
					Critical Nodes
				</button>
				<button
					class="px-3 py-1.5 text-sm rounded-md {activeTab === 'attack-paths'
						? 'bg-primary-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					onclick={() => (activeTab = 'attack-paths')}
				>
					<i class="fa-solid fa-route mr-1"></i>
					Attack Paths
				</button>
			</div>
		</div>
	</div>

	<!-- Main content area -->
	<div class="flex-1 flex overflow-hidden">
		{#if activeTab === 'graph'}
			<div class="flex-1">
				<GraphViewer
					data={transformedData()}
					onNodeClick={handleNodeClick}
					onNodeDoubleClick={handleNodeDoubleClick}
				/>
			</div>

			<!-- Node details sidebar -->
			{#if selectedNode}
				<div class="w-80 bg-white border-l shadow-sm overflow-y-auto">
					<div class="p-4">
						<div class="flex items-center justify-between mb-4">
							<h3 class="text-lg font-medium text-gray-900">Node Details</h3>
							<button
								class="text-gray-400 hover:text-gray-600"
								onclick={() => (selectedNode = null)}
								aria-label="Close details panel"
							>
								<i class="fa-solid fa-times"></i>
							</button>
						</div>

						<div class="space-y-4">
							<div>
								<span class="text-xs font-medium text-gray-500 uppercase block">Name</span>
								<p class="text-sm text-gray-900">{selectedNode.name}</p>
							</div>

							<div>
								<span class="text-xs font-medium text-gray-500 uppercase block">Type</span>
								<p class="text-sm text-gray-900 capitalize">{selectedNode.value?.replace(/_/g, ' ')}</p>
							</div>

							{#if selectedNode.criticality}
								<div>
									<span class="text-xs font-medium text-gray-500 uppercase block">Criticality</span>
									<p class="text-sm">
										<span
											class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
												{selectedNode.criticality === 'critical'
												? 'bg-red-100 text-red-800'
												: selectedNode.criticality === 'high'
													? 'bg-orange-100 text-orange-800'
													: selectedNode.criticality === 'medium'
														? 'bg-yellow-100 text-yellow-800'
														: 'bg-green-100 text-green-800'}"
										>
											{selectedNode.criticality}
										</span>
									</p>
								</div>
							{/if}

							{#if selectedNode.riskScore}
								<div>
									<span class="text-xs font-medium text-gray-500 uppercase block">Risk Score</span>
									<p class="text-sm text-gray-900">{selectedNode.riskScore.toFixed(2)}</p>
								</div>
							{/if}

							<div class="pt-4 border-t">
								<button
									class="w-full px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
									onclick={() => {
										activeTab = 'blast-radius';
									}}
								>
									<i class="fa-solid fa-burst mr-2"></i>
									Analyze Blast Radius
								</button>
							</div>
						</div>
					</div>
				</div>
			{/if}
		{:else if activeTab === 'blast-radius'}
			<BlastRadiusPanel nodes={graphData.nodes || []} />
		{:else if activeTab === 'critical-nodes'}
			<CriticalNodesPanel />
		{:else if activeTab === 'attack-paths'}
			<div class="flex-1 p-6">
				<div class="bg-white rounded-lg shadow p-6">
					<h2 class="text-lg font-semibold mb-4">Attack Path Analysis</h2>
					<p class="text-gray-600 mb-4">
						Analyze potential attack paths from threat actors to critical assets.
					</p>

					<div class="grid grid-cols-2 gap-4 mb-6">
						<div>
							<label for="entry-point-select" class="block text-sm font-medium text-gray-700 mb-1">Entry Point (Threat)</label>
							<select id="entry-point-select" class="w-full rounded-md border-gray-300 shadow-sm">
								<option value="">Select entry point...</option>
								{#each (graphData.nodes || []).filter((n: any) => n.group === 'threat' || n.group === 'third_party') as node}
									<option value={node.id}>{node.label || node.name}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="target-select" class="block text-sm font-medium text-gray-700 mb-1">Target (Critical Asset)</label>
							<select id="target-select" class="w-full rounded-md border-gray-300 shadow-sm">
								<option value="">Select target...</option>
								{#each (graphData.nodes || []).filter((n: any) => n.group === 'asset' && n.criticality === 'critical') as node}
									<option value={node.id}>{node.label || node.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<button class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
						<i class="fa-solid fa-search mr-2"></i>
						Find Attack Paths
					</button>

					<div class="mt-6 p-4 bg-gray-50 rounded-lg">
						<p class="text-sm text-gray-500 text-center">
							Select an entry point and target to discover potential attack paths.
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		overflow: hidden;
	}
</style>
