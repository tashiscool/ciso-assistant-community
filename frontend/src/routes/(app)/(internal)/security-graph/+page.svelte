<script lang="ts">
	import type { PageData } from './$types';
	import { pageTitle } from '$lib/utils/stores';
	import { BASE_API_URL } from '$lib/utils/constants';
	import GraphViewer from '$lib/components/SecurityGraph/GraphViewer.svelte';
	import BlastRadiusPanel from '$lib/components/SecurityGraph/BlastRadiusPanel.svelte';
	import CriticalNodesPanel from '$lib/components/SecurityGraph/CriticalNodesPanel.svelte';
	import { BRAND_NAME } from '$lib/brand';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
	pageTitle.set('Security Graph');

	let selectedNode: any = $state(null);
	let graphData = $state(data.graphData || { nodes: [], edges: [] });
	let activeTab = $state<'graph' | 'blast-radius' | 'critical-nodes' | 'attack-paths'>('graph');

	let attackPathEntryPoint = $state('');
	let attackPathTarget = $state('');
	let attackPaths = $state<any[]>([]);
	let attackPathsLoading = $state(false);
	let attackPathsError = $state('');

	const apiBaseUrl = typeof window === 'undefined' ? BASE_API_URL : '/api';

	const attackPathEntryCandidates = $derived.by(() => {
		const nodes = graphData.nodes || [];
		const preferred = nodes.filter((n: any) => {
			const nodeType = (n.group || n.node_type || '').toLowerCase();
			return nodeType === 'threat' || nodeType === 'third_party';
		});
		if (preferred.length === 0) {
			return nodes;
		}
		const preferredIds = new Set(preferred.map((node: any) => String(node.id)));
		const nonPreferred = nodes.filter((node: any) => !preferredIds.has(String(node.id)));
		return [...preferred, ...nonPreferred];
	});

	const attackPathTargetCandidates = $derived.by(() => {
		const nodes = graphData.nodes || [];
		const criticalAssets = nodes.filter((n: any) => {
			const nodeType = (n.group || n.node_type || '').toLowerCase();
			return nodeType === 'asset' && n.criticality === 'critical';
		});
		if (criticalAssets.length > 0) {
			return criticalAssets;
		}
		const assets = nodes.filter((n: any) => (n.group || n.node_type || '').toLowerCase() === 'asset');
		return assets.length > 0 ? assets : nodes;
	});

	const graphStats = $derived.by(() => {
		const nodes = graphData.nodes || [];
		const edges = graphData.edges || [];
		return {
			nodeCount: nodes.length,
			relationshipCount: edges.length,
			criticalCount: nodes.filter((node: any) => String(node.criticality || '').toLowerCase() === 'critical')
				.length,
			threatCount: nodes.filter((node: any) => ['threat', 'vulnerability'].includes(String(node.group || node.node_type || '').toLowerCase()))
				.length
		};
	});

	const transformedData = $derived(() => {
		if (!graphData || !graphData.nodes) {
			return { nodes: [], links: [], categories: [] };
		}

		const nodeTypes = [...new Set(graphData.nodes.map((n: any) => n.group || n.node_type || 'unknown'))];
		const categories = nodeTypes.map((type: string) => ({
			name: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
		}));

		const categoryIndex: Record<string, number> = {};
		categories.forEach((cat, idx) => {
			categoryIndex[cat.name.toLowerCase().replace(/ /g, '_')] = idx;
		});

		const nodes = graphData.nodes.map((node: any, idx: number) => ({
			id: idx,
			pk: node.id,
			name: node.label || node.name || node.id,
			value: node.group || node.node_type,
			category: categoryIndex[node.group || node.node_type] || 0,
			symbolSize: node.size || 20,
			itemStyle: {
				color: node.color || getNodeColor(node.group || node.node_type)
			},
			criticality: node.criticality,
			riskScore: node.risk_score || node.risk?.blast_radius_score || 0
		}));

		const nodeIdToIndex: Record<string, number> = {};
		graphData.nodes.forEach((node: any, idx: number) => {
			nodeIdToIndex[String(node.id)] = idx;
		});

		const links = (graphData.edges || []).map((edge: any) => ({
			source: nodeIdToIndex[String(edge.from || edge.source || edge.source_id)] ?? 0,
			target: nodeIdToIndex[String(edge.to || edge.target || edge.target_id)] ?? 0,
			value: edge.label || edge.edge_type,
			lineStyle: {
				color: edge.color || '#6b8797',
				width: edge.width || 1,
				type: edge.dashes ? 'dashed' : 'solid'
			}
		}));

		return { nodes, links, categories };
	});

	function getNodeColor(nodeType: string): string {
		const colors: Record<string, string> = {
			asset: '#14C8B5',
			control: '#58B5FF',
			risk: '#F7B54A',
			threat: '#F97316',
			vulnerability: '#DC2626',
			user: '#2DD4BF',
			system: '#64748B',
			data: '#3B82F6',
			network: '#0891B2',
			application: '#2563EB',
			process: '#8B5CF6',
			third_party: '#FB7185'
		};
		return colors[nodeType?.toLowerCase()] || '#687784';
	}

	function getCookieValue(name: string): string {
		if (typeof document === 'undefined') return '';
		const prefix = `${name}=`;
		const item = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
		return item ? decodeURIComponent(item.slice(prefix.length)) : '';
	}

	function getAuthHeaders(includeJson = false, includeCsrf = false): Record<string, string> {
		const headers: Record<string, string> = {};
		const token = getCookieValue('token');
		if (token) {
			headers.Authorization = `Token ${token}`;
		}
		if (includeJson) {
			headers['Content-Type'] = 'application/json';
		}
		if (includeCsrf) {
			const csrfToken = getCookieValue('csrftoken');
			if (csrfToken) {
				headers['X-CSRFToken'] = csrfToken;
			}
		}
		return headers;
	}

	async function findAttackPaths() {
		if (!attackPathEntryPoint || !attackPathTarget) {
			attackPathsError = 'Please select both an entry point and a target.';
			return;
		}
		attackPathsLoading = true;
		attackPathsError = '';
		attackPaths = [];
		try {
			const res = await fetch(`${apiBaseUrl}/security-graph/attack-paths/`, {
				method: 'POST',
				headers: getAuthHeaders(true, true),
				credentials: 'include',
				body: JSON.stringify({
					entry_point_id: attackPathEntryPoint,
					target_id: attackPathTarget,
					max_paths: 5
				})
			});
			if (res.ok) {
				const response = await res.json();
				attackPaths = response.paths || [];
				if (attackPaths.length === 0) {
					attackPathsError = 'No attack paths found between the selected nodes.';
				}
			} else {
				attackPathsError = 'Failed to find attack paths. Please try again.';
			}
		} catch {
			attackPathsError = 'Error connecting to the server.';
		} finally {
			attackPathsLoading = false;
		}
	}

	function getNodeLink(node: any): string | null {
		const entityId = node?.pk || node?.id;
		const nodeType = String(node?.value || node?.group || node?.node_type || '').toLowerCase();
		if (!entityId) {
			return null;
		}
		if (nodeType === 'asset') return `/assets/${entityId}`;
		if (nodeType === 'control') return `/applied-controls/${entityId}`;
		if (nodeType === 'risk') return `/risk-scenarios/${entityId}`;
		if (nodeType === 'threat') return `/threats/${entityId}`;
		if (nodeType === 'vulnerability') return `/vulnerabilities/${entityId}`;
		return null;
	}

	function handleNodeClick(node: any) {
		selectedNode = node;
	}

	function handleNodeDoubleClick(params: any) {
		if (params.dataType !== 'node') {
			return;
		}
		const destination = getNodeLink(params.data);
		if (destination) {
			window.location.href = destination;
		}
	}

	function tabButtonClasses(tab: typeof activeTab): string {
		return activeTab === tab
			? 'btn bg-[var(--rv-midnight)] text-white shadow-[0_16px_28px_rgb(11_31_42_/_0.18)]'
			: 'btn border border-slate-200 bg-white/90 text-slate-600 hover:border-[rgb(88_181_255_/_0.24)] hover:bg-white';
	}

	function getCriticalityTone(criticality: string): string {
		switch (criticality?.toLowerCase()) {
			case 'critical':
				return 'bg-red-100 text-red-800';
			case 'high':
				return 'bg-orange-100 text-orange-800';
			case 'medium':
				return 'bg-amber-100 text-amber-800';
			case 'low':
				return 'bg-emerald-100 text-emerald-800';
			default:
				return 'bg-slate-100 text-slate-700';
		}
	}
</script>

<div class="flex h-full min-h-0 flex-col gap-5">
	<div class="brand-card-dark overflow-hidden px-6 py-7 lg:px-8">
		<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-3xl space-y-4">
				<span class="brand-overline !text-white/70">{BRAND_NAME} topology</span>
				<div>
					<h1 class="text-3xl font-semibold tracking-tight text-white lg:text-4xl">
						See governance relationships as an operational graph
					</h1>
					<p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300 lg:text-base">
						Map assets, controls, risks, and threat vectors in one live topology so teams can
						move from compliance evidence to operational decision-making faster.
					</p>
				</div>
			</div>

			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div class="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur">
					<div class="text-3xl font-semibold text-white">{graphStats.nodeCount}</div>
					<div class="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-300">
						Nodes
					</div>
				</div>
				<div class="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur">
					<div class="text-3xl font-semibold text-white">{graphStats.relationshipCount}</div>
					<div class="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-300">
						Relationships
					</div>
				</div>
				<div class="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur">
					<div class="text-3xl font-semibold text-white">{graphStats.criticalCount}</div>
					<div class="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-300">
						Critical Nodes
					</div>
				</div>
				<div class="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur">
					<div class="text-3xl font-semibold text-white">{graphStats.threatCount}</div>
					<div class="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-300">
						Threat Vectors
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="flex flex-wrap gap-2">
		<button class="{tabButtonClasses('graph')} px-4 py-2.5 text-sm font-semibold" onclick={() => (activeTab = 'graph')}>
			<i class="fa-solid fa-diagram-project mr-2"></i>
			Graph View
		</button>
		<button
			class="{tabButtonClasses('blast-radius')} px-4 py-2.5 text-sm font-semibold"
			onclick={() => (activeTab = 'blast-radius')}
		>
			<i class="fa-solid fa-burst mr-2"></i>
			Blast Radius
		</button>
		<button
			class="{tabButtonClasses('critical-nodes')} px-4 py-2.5 text-sm font-semibold"
			onclick={() => (activeTab = 'critical-nodes')}
		>
			<i class="fa-solid fa-triangle-exclamation mr-2"></i>
			Critical Nodes
		</button>
		<button
			class="{tabButtonClasses('attack-paths')} px-4 py-2.5 text-sm font-semibold"
			onclick={() => (activeTab = 'attack-paths')}
		>
			<i class="fa-solid fa-route mr-2"></i>
			Attack Paths
		</button>
	</div>

	<div class="min-h-0 flex-1">
		{#if activeTab === 'graph'}
			<div class="grid h-full min-h-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div class="min-h-[620px]">
					<GraphViewer
						data={transformedData}
						onNodeClick={handleNodeClick}
						onNodeDoubleClick={handleNodeDoubleClick}
					/>
				</div>

				<div class="brand-card flex min-h-[620px] flex-col overflow-hidden">
					<div class="border-b border-slate-100 px-5 py-4">
						<span class="brand-overline">Selected Node</span>
						<h2 class="mt-3 text-xl font-semibold text-[var(--rv-midnight)]">Inspection Panel</h2>
						<p class="mt-2 text-sm leading-6 text-slate-600">
							Select a node in the graph to review its role, criticality, and next-step actions.
						</p>
					</div>

					{#if selectedNode}
						<div class="flex-1 space-y-5 px-5 py-5">
							<div>
								<div class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
									Name
								</div>
								<p class="mt-2 text-xl font-semibold text-[var(--rv-midnight)]">
									{selectedNode.name}
								</p>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								<div class="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4">
									<div class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
										Type
									</div>
									<p class="mt-2 text-sm font-medium capitalize text-[var(--rv-midnight)]">
										{selectedNode.value?.replace(/_/g, ' ')}
									</p>
								</div>
								<div class="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4">
									<div class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
										Criticality
									</div>
									<div class="mt-2">
										<span
											class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold {getCriticalityTone(selectedNode.criticality)}"
										>
											{selectedNode.criticality || 'unknown'}
										</span>
									</div>
								</div>
							</div>

							<div class="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4">
								<div class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
									Graph Risk Signal
								</div>
								<p class="mt-2 text-3xl font-semibold text-[var(--rv-midnight)]">
									{Number(selectedNode.riskScore || 0).toFixed(2)}
								</p>
							</div>

							<div class="space-y-3 pt-2">
								<button
									class="btn w-full px-4 py-3 font-semibold text-white shadow-[0_20px_36px_rgb(11_31_42_/_0.18)]"
									style="background: var(--rv-gradient-accent);"
									onclick={() => {
										activeTab = 'blast-radius';
									}}
								>
									<i class="fa-solid fa-burst mr-2"></i>
									Analyze Blast Radius
								</button>
								{#if getNodeLink(selectedNode)}
									<a
										class="btn flex w-full items-center justify-center border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 hover:border-[rgb(88_181_255_/_0.24)] hover:bg-slate-50"
										href={getNodeLink(selectedNode) || '#'}
									>
										<i class="fa-solid fa-arrow-up-right-from-square mr-2"></i>
										Open Source Record
									</a>
								{/if}
							</div>
						</div>
					{:else}
						<div class="flex flex-1 flex-col items-center justify-center px-6 text-center">
							<div class="brand-icon-badge h-16 w-16 rounded-[20px] text-2xl">
								<i class="fa-solid fa-crosshairs"></i>
							</div>
							<h3 class="mt-5 text-xl font-semibold text-[var(--rv-midnight)]">
								No node selected
							</h3>
							<p class="mt-3 max-w-sm text-sm leading-6 text-slate-600">
								Click any node in the graph to inspect its role and pivot into propagation
								or source-record workflows.
							</p>
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'blast-radius'}
			<BlastRadiusPanel nodes={graphData.nodes || []} selectedNodeId={selectedNode?.pk || ''} />
		{:else if activeTab === 'critical-nodes'}
			<CriticalNodesPanel />
		{:else if activeTab === 'attack-paths'}
			<div class="space-y-5">
				<div class="brand-card-dark overflow-hidden px-5 py-5 lg:px-6">
					<span class="brand-overline !text-white/70">Attack Paths</span>
					<h2 class="mt-4 text-2xl font-semibold text-white">
						Trace likely routes from ingress to critical assets
					</h2>
					<p class="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
						Select an entry point and a protected target to see the most relevant attack paths
						discovered by the worker-backed topology analysis.
					</p>
				</div>

				<div class="brand-card p-5 lg:p-6">
					<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
						<div>
							<label for="entry-point-select" class="mb-1 block text-sm font-medium text-slate-700"
								>Entry Point</label
							>
							<select
								id="entry-point-select"
								data-testid="attack-path-entry-select"
								bind:value={attackPathEntryPoint}
								class="w-full rounded-2xl border-slate-200 bg-white/80 shadow-sm"
							>
								<option value="">Select entry point...</option>
								{#each attackPathEntryCandidates as node}
									<option value={node.id}>{node.label || node.name}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="target-select" class="mb-1 block text-sm font-medium text-slate-700"
								>Target</label
							>
							<select
								id="target-select"
								data-testid="attack-path-target-select"
								bind:value={attackPathTarget}
								class="w-full rounded-2xl border-slate-200 bg-white/80 shadow-sm"
							>
								<option value="">Select target...</option>
								{#each attackPathTargetCandidates as node}
									<option value={node.id}>{node.label || node.name}</option>
								{/each}
							</select>
						</div>

						<button
							data-testid="attack-path-find-button"
							class="btn px-5 py-3 font-semibold text-white shadow-[0_20px_36px_rgb(11_31_42_/_0.18)] disabled:cursor-not-allowed disabled:opacity-50"
							style="background: var(--rv-gradient-accent);"
							onclick={findAttackPaths}
							disabled={attackPathsLoading || !attackPathEntryPoint || !attackPathTarget}
						>
							{#if attackPathsLoading}
								<i class="fa-solid fa-spinner fa-spin mr-2"></i>
								Searching...
							{:else}
								<i class="fa-solid fa-route mr-2"></i>
								Find Paths
							{/if}
						</button>
					</div>
				</div>

				{#if attackPathsError}
					<div class="brand-card border-amber-200 px-5 py-4 text-amber-800">
						<i class="fa-solid fa-triangle-exclamation mr-2"></i>
						{attackPathsError}
					</div>
				{/if}

				{#if attackPaths.length > 0}
					<div class="space-y-4">
						{#each attackPaths as path, i}
							<div data-testid="attack-path-card" class="brand-card overflow-hidden p-5 lg:p-6">
								<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
									<div>
										<span class="brand-overline">Path {i + 1}</span>
										<h3 class="mt-3 text-xl font-semibold text-[var(--rv-midnight)]">
											{path.description || 'Potential attack path'}
										</h3>
									</div>
									{#if path.risk_score !== undefined}
										<span class="brand-chip !bg-[rgba(220,38,38,0.1)] !text-[#991B1B]">
											Risk {typeof path.risk_score === 'number' ? path.risk_score.toFixed(2) : path.risk_score}
										</span>
									{/if}
								</div>

								<div class="mt-5 flex flex-wrap items-center gap-2 text-sm text-slate-600">
									{#each (path.nodes || path.path_nodes || []) as step, j}
										<span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-[var(--rv-midnight)]">
											{typeof step === 'string' ? step : step.name || step.label || step.id}
										</span>
										{#if j < (path.nodes || path.path_nodes || []).length - 1}
											<i class="fa-solid fa-arrow-right text-slate-300"></i>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else if !attackPathsLoading && !attackPathsError}
					<div class="brand-card px-6 py-16 text-center">
						<div class="brand-icon-badge mx-auto h-16 w-16 rounded-[20px] text-2xl">
							<i class="fa-solid fa-route"></i>
						</div>
						<h3 class="mt-5 text-xl font-semibold text-[var(--rv-midnight)]">
							Select an entry point and target
						</h3>
						<p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
							Regovise will evaluate the topology and surface the most relevant paths between
							the selected nodes.
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
