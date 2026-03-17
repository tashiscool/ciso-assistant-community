<script lang="ts">
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

	const apiBaseUrl = typeof window === 'undefined' ? BASE_API_URL : '/api';

	$effect(() => {
		if (selectedNodeId && selectedNodeId !== sourceNodeId) {
			sourceNodeId = selectedNodeId;
		}
	});

	async function analyzeBlastRadius() {
		if (!sourceNodeId) {
			error = 'Please select a source node';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${apiBaseUrl}/security-graph/blast-radius/`, {
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
				return 'bg-amber-100 text-amber-800';
			case 'low':
				return 'bg-emerald-100 text-emerald-800';
			default:
				return 'bg-slate-100 text-slate-700';
		}
	}

	function getRiskMeterColor(score: number): string {
		if (score >= 75) return '#dc2626';
		if (score >= 50) return '#f97316';
		if (score >= 25) return '#f7b54a';
		return '#14c8b5';
	}
</script>

<div class="flex-1 overflow-y-auto p-4 lg:p-6">
	<div class="brand-card-dark mb-5 overflow-hidden px-5 py-5 lg:px-6">
		<div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-2xl space-y-3">
				<span class="brand-overline !text-white/70">Blast Radius</span>
				<div>
					<h2 class="text-2xl font-semibold text-white">Trace propagation before it becomes impact</h2>
					<p class="mt-2 text-sm leading-6 text-slate-300">
						Model how compromise spreads through assets, risks, controls, and dependencies so
						teams can prioritize containment with governance context.
					</p>
				</div>
			</div>
			<span class="brand-chip !border-white/15 !bg-white/10 !text-white">
				<i class="fa-solid fa-burst"></i>
				Topology-aware analysis
			</span>
		</div>
	</div>

	<div class="brand-card mb-5 p-5 lg:p-6">
		<div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
			<div>
				<label for="blast-source-node" class="mb-1 block text-sm font-medium text-slate-700"
					>Source Node</label
				>
				<select
					id="blast-source-node"
					class="w-full rounded-2xl border-slate-200 bg-white/80 shadow-sm"
					bind:value={sourceNodeId}
				>
					<option value="">Select a node...</option>
					{#each nodes as node}
						<option value={node.id}>{node.label || node.name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="blast-max-hops" class="mb-1 block text-sm font-medium text-slate-700"
					>Max Hops</label
				>
				<input
					id="blast-max-hops"
					type="number"
					min="1"
					max="10"
					class="w-full rounded-2xl border-slate-200 bg-white/80 shadow-sm"
					bind:value={maxHops}
				/>
			</div>

			<div>
				<label for="blast-threshold" class="mb-1 block text-sm font-medium text-slate-700"
					>Propagation Threshold</label
				>
				<input
					id="blast-threshold"
					type="number"
					min="0"
					max="1"
					step="0.1"
					class="w-full rounded-2xl border-slate-200 bg-white/80 shadow-sm"
					bind:value={propagationThreshold}
				/>
			</div>

			<button
				class="btn px-5 py-3 font-semibold text-white shadow-[0_20px_36px_rgb(11_31_42_/_0.18)] disabled:cursor-not-allowed disabled:opacity-50"
				style="background: var(--rv-gradient-accent);"
				onclick={analyzeBlastRadius}
				disabled={loading || !sourceNodeId}
			>
				{#if loading}
					<i class="fa-solid fa-spinner fa-spin mr-2"></i>
					Analyzing...
				{:else}
					<i class="fa-solid fa-burst mr-2"></i>
					Run Analysis
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
				<div class="text-3xl font-semibold text-[var(--rv-midnight)]">{result.total_affected}</div>
				<div class="mt-2 text-sm text-slate-500">Total impacted nodes</div>
			</div>
			<div class="brand-card p-5">
				<div class="text-3xl font-semibold text-[var(--rv-blue)]">{result.direct_impact}</div>
				<div class="mt-2 text-sm text-slate-500">Direct dependencies</div>
			</div>
			<div class="brand-card p-5">
				<div class="text-3xl font-semibold text-[#F97316]">{result.indirect_impact}</div>
				<div class="mt-2 text-sm text-slate-500">Indirect exposures</div>
			</div>
			<div class="brand-card p-5">
				<div class="text-3xl font-semibold text-[#DC2626]">{result.critical_assets_affected}</div>
				<div class="mt-2 text-sm text-slate-500">Critical assets touched</div>
			</div>
		</div>

		<div class="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
			<div class="brand-card p-5 lg:p-6">
				<div class="mb-4 flex items-center justify-between">
					<div>
						<div class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
							Overall Risk Score
						</div>
						<p class="mt-1 text-sm text-slate-600">
							Higher scores indicate broader propagation and more severe downstream impact.
						</p>
					</div>
					<div class="text-2xl font-semibold text-[var(--rv-midnight)]">
						{result.risk_score?.toFixed(2)}
					</div>
				</div>
				<div class="h-3 rounded-full bg-slate-200">
					<div
						class="h-3 rounded-full transition-all duration-500"
						style="width: {Math.min(100, Number(result.risk_score || 0))}%; background-color: {getRiskMeterColor(Number(result.risk_score || 0))};"
					></div>
				</div>
			</div>

			<div class="brand-card p-5 lg:p-6">
				<h3 class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
					Impact By Node Type
				</h3>
				<div class="mt-4 space-y-3">
					{#each Object.entries(result.impact_by_type || {}) as [type, count]}
						<div class="flex items-center justify-between text-sm">
							<span class="capitalize text-slate-600">{type.replace(/_/g, ' ')}</span>
							<span class="font-semibold text-[var(--rv-midnight)]">{count}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
			<div class="brand-card overflow-hidden">
				<div class="border-b border-slate-100 px-5 py-4 lg:px-6">
					<h3 class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
						Affected Nodes
					</h3>
					<p class="mt-1 text-sm text-slate-600">Highest-impact nodes across the propagated path.</p>
				</div>
				<div class="overflow-x-auto px-3 pb-3 pt-1 lg:px-4">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-slate-100 text-slate-500">
								<th class="px-2 py-3 text-left font-medium">Node</th>
								<th class="px-2 py-3 text-left font-medium">Type</th>
								<th class="px-2 py-3 text-left font-medium">Criticality</th>
								<th class="px-2 py-3 text-center font-medium">Hops</th>
								<th class="px-2 py-3 text-right font-medium">Impact</th>
							</tr>
						</thead>
						<tbody>
							{#each (result.affected_nodes || []).slice(0, 20) as node}
								<tr class="border-b border-slate-100/80 last:border-b-0">
									<td class="px-2 py-3 font-medium text-[var(--rv-midnight)]">{node.name}</td>
									<td class="px-2 py-3 text-slate-600 capitalize">{node.type?.replace(/_/g, ' ')}</td>
									<td class="px-2 py-3">
										<span
											class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold {getCriticalityColor(node.criticality)}"
										>
											{node.criticality}
										</span>
									</td>
									<td class="px-2 py-3 text-center text-slate-600">{node.hops}</td>
									<td class="px-2 py-3 text-right font-semibold text-[var(--rv-midnight)]">
										{node.impact_score?.toFixed(2)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if (result.affected_nodes || []).length > 20}
						<p class="px-2 pb-2 pt-4 text-center text-sm text-slate-500">
							Showing top 20 of {result.affected_nodes.length} affected nodes
						</p>
					{/if}
				</div>
			</div>

			<div class="space-y-5">
				<div class="brand-card p-5 lg:p-6">
					<h3 class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
						Impact By Distance
					</h3>
					<div class="mt-4 space-y-3">
						{#each Object.entries(result.impact_by_hop || {}).sort((a, b) => Number(a[0]) - Number(b[0])) as [hop, count]}
							<div>
								<div class="mb-1 flex items-center justify-between text-sm">
									<span class="text-slate-600">{hop} hop{Number(hop) > 1 ? 's' : ''}</span>
									<span class="font-semibold text-[var(--rv-midnight)]">{count}</span>
								</div>
								<div class="h-2 rounded-full bg-slate-200">
									<div
										class="h-2 rounded-full bg-[var(--rv-blue)] transition-all duration-300"
										style="width: {result.total_affected ? (Number(count) / result.total_affected) * 100 : 0}%"
									></div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				{#if result.recommendations && result.recommendations.length > 0}
					<div class="brand-card p-5 lg:p-6">
						<h3 class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
							Recommended Actions
						</h3>
						<ul class="mt-4 space-y-3">
							{#each result.recommendations as recommendation}
								<li class="flex items-start gap-3 text-sm text-slate-600">
									<i class="fa-solid fa-lightbulb mt-0.5 text-[var(--rv-teal)]"></i>
									<span>{recommendation}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="brand-card px-6 py-16 text-center">
			<div class="brand-icon-badge mx-auto h-16 w-16 rounded-[20px] text-2xl">
				<i class="fa-solid fa-burst"></i>
			</div>
			<h3 class="mt-5 text-xl font-semibold text-[var(--rv-midnight)]">Run a propagation scenario</h3>
			<p class="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
				Select a node from the graph and model how compromise could move across connected controls,
				assets, and risk scenarios.
			</p>
		</div>
	{/if}
</div>
