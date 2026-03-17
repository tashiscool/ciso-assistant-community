<script lang="ts">
	import { onMount } from 'svelte';
	import type * as echarts from 'echarts';
	import { BRAND_COLORS } from '$lib/brand';

	interface Props {
		data: {
			nodes: any[];
			links: any[];
			categories: any[];
		};
		width?: string;
		height?: string;
		onNodeClick?: (node: any) => void;
		onNodeDoubleClick?: (params: any) => void;
	}

	let {
		data,
		width = 'w-full',
		height = 'h-full',
		onNodeClick = () => {},
		onNodeDoubleClick = () => {}
	}: Props = $props();

	let chart: echarts.ECharts;
	let chartContainer: HTMLElement;
	let searchQuery = $state('');

	const getNormalizedData = () => ({
		nodes: Array.isArray(data?.nodes) ? data.nodes : [],
		links: Array.isArray(data?.links) ? data.links : [],
		categories: Array.isArray(data?.categories) ? data.categories : []
	});

	const getChartOptions = () => {
		const normalizedData = getNormalizedData();

		return {
			backgroundColor: 'transparent',
			tooltip: {
				trigger: 'item',
				backgroundColor: 'rgba(11, 31, 42, 0.94)',
				borderColor: 'rgba(88, 181, 255, 0.3)',
				borderWidth: 1,
				textStyle: {
					color: '#EAF3F7'
				},
				formatter: (params: any) => {
					if (params.dataType === 'node') {
						return `<strong>${params.data.name}</strong><br/>
							Type: ${params.data.value || 'Unknown'}<br/>
							${params.data.criticality ? `Criticality: ${params.data.criticality}` : ''}`;
					} else if (params.dataType === 'edge') {
						const sourceNode = normalizedData.nodes.find((n) => n.id === params.data.source);
						const targetNode = normalizedData.nodes.find((n) => n.id === params.data.target);
						return `${sourceNode?.name || 'Source'} → ${targetNode?.name || 'Target'}<br/>
							<em>${params.data.value || 'relates to'}</em>`;
					}
					return params.name;
				}
			},
			legend: {
				data: normalizedData.categories.map((c: any) => c.name),
				orient: 'vertical',
				left: 10,
				top: 'middle',
				textStyle: {
					color: '#C9D9E3'
				}
			},
			series: [
				{
					type: 'graph',
					layout: 'force',
					animation: true,
					animationDuration: 1000,
					data: normalizedData.nodes,
					links: normalizedData.links,
					categories: normalizedData.categories,
					roam: true,
					draggable: true,
					label: {
						show: false,
						position: 'right',
						formatter: '{b}',
						color: '#EAF3F7'
					},
					emphasis: {
						focus: 'adjacency',
						label: {
							show: true
						}
					},
					force: {
						repulsion: 200,
						gravity: 0.1,
						edgeLength: [50, 200],
						layoutAnimation: true
					},
					lineStyle: {
						color: 'source',
						curveness: 0.3,
						opacity: 0.7
					},
					edgeSymbol: ['circle', 'arrow'],
					edgeSymbolSize: [4, 10]
				}
			]
		};
	};

	const searchNodes = (query: string) => {
		if (!query.trim() || !chart) return;
		const normalizedData = getNormalizedData();

		const normalizedQuery = query.toLowerCase().trim();
		const matchingNodes = normalizedData.nodes.filter((n) =>
			n.name.toLowerCase().includes(normalizedQuery)
		);

		if (matchingNodes.length > 0) {
			const nodeIds = matchingNodes.map((n) => n.id);
			chart.dispatchAction({
				type: 'highlight',
				dataIndex: nodeIds
			});
		}
	};

	const clearHighlight = () => {
		if (chart) {
			chart.dispatchAction({
				type: 'downplay'
			});
		}
	};

	onMount(async () => {
		const echarts = await import('echarts');

		if (!chartContainer) return;

		chart = echarts.init(chartContainer);
		chart.setOption(getChartOptions());

		chart.on('click', (params: any) => {
			if (params.dataType === 'node') {
				onNodeClick(params.data);
			}
		});

		chart.on('dblclick', onNodeDoubleClick);

		const handleResize = () => {
			chart?.resize();
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			chart?.dispose();
		};
	});

	// Update chart when data changes
	$effect(() => {
		if (chart && data) {
			chart.setOption(getChartOptions());
		}
	});

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			searchNodes(searchQuery);
		} else if (event.key === 'Escape') {
			clearHighlight();
			searchQuery = '';
		}
	};
</script>

<div class="flex h-full flex-col overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,rgba(6,17,24,0.96),rgba(11,31,42,0.94))] text-white shadow-[0_30px_80px_rgba(11,31,42,0.28)]">
	<div class="border-b border-white/10 px-4 py-4 lg:px-5">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-center">
			<span class="brand-chip w-fit !border-white/12 !bg-white/8 !text-white">
				<i class="fa-solid fa-wave-square"></i>
				Live topology
			</span>
			<div class="relative flex-1">
				<label for="graph-search-nodes" class="sr-only">Search nodes</label>
				<input
					id="graph-search-nodes"
					type="text"
					class="w-full rounded-full border border-white/12 bg-white/8 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 focus:border-[rgba(20,200,181,0.55)] focus:ring-0"
					placeholder="Search nodes, controls, threats, or scenarios"
					bind:value={searchQuery}
					onkeydown={handleKeyDown}
				/>
				<i
					class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
					aria-hidden="true"
				></i>
			</div>
			<div class="flex items-center gap-2">
				<button
					class="btn px-4 py-2 text-sm font-semibold text-white"
					style="background: var(--rv-gradient-accent);"
					onclick={() => searchNodes(searchQuery)}
					aria-label="Search nodes in graph"
				>
					Search
				</button>
				<button
					class="btn border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/12"
					onclick={clearHighlight}
					aria-label="Clear search highlights"
				>
					Clear
				</button>
			</div>
		</div>
	</div>

	<div
		bind:this={chartContainer}
		class="{width} {height} flex-1"
		style="min-height: 540px;"
	></div>

	<div class="border-t border-white/10 px-4 py-4 lg:px-5">
		<div class="flex flex-wrap items-center gap-4 text-xs text-slate-300">
			<span class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full" style="background-color: {BRAND_COLORS.teal};"></span>
				Assets
			</span>
			<span class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full" style="background-color: {BRAND_COLORS.blue};"></span>
				Controls
			</span>
			<span class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full" style="background-color: #F7B54A;"></span>
				Risks
			</span>
			<span class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full" style="background-color: #F97316;"></span>
				Threats
			</span>
			<span class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full" style="background-color: #DC2626;"></span>
				Vulnerabilities
			</span>
			<span class="ml-auto text-slate-400">
				<i class="fa-solid fa-mouse-pointer mr-1"></i>
				Click to inspect, double-click to navigate, drag to reposition
			</span>
		</div>
	</div>
</div>
