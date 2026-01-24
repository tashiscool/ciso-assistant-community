<script lang="ts">
	import { onMount } from 'svelte';
	import type * as echarts from 'echarts';

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

	const getChartOptions = () => {
		return {
			tooltip: {
				trigger: 'item',
				formatter: (params: any) => {
					if (params.dataType === 'node') {
						return `<strong>${params.data.name}</strong><br/>
							Type: ${params.data.value || 'Unknown'}<br/>
							${params.data.criticality ? `Criticality: ${params.data.criticality}` : ''}`;
					} else if (params.dataType === 'edge') {
						const sourceNode = data.nodes.find((n) => n.id === params.data.source);
						const targetNode = data.nodes.find((n) => n.id === params.data.target);
						return `${sourceNode?.name || 'Source'} → ${targetNode?.name || 'Target'}<br/>
							<em>${params.data.value || 'relates to'}</em>`;
					}
					return params.name;
				}
			},
			legend: {
				data: data.categories.map((c: any) => c.name),
				orient: 'vertical',
				left: 10,
				top: 'middle'
			},
			series: [
				{
					type: 'graph',
					layout: 'force',
					animation: true,
					animationDuration: 1000,
					data: data.nodes,
					links: data.links,
					categories: data.categories,
					roam: true,
					draggable: true,
					label: {
						show: false,
						position: 'right',
						formatter: '{b}'
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

		const normalizedQuery = query.toLowerCase().trim();
		const matchingNodes = data.nodes.filter((n) =>
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

<div class="flex flex-col h-full bg-white">
	<!-- Search bar -->
	<div class="p-3 border-b bg-gray-50">
		<div class="flex items-center space-x-2">
			<div class="relative flex-1">
				<input
					type="text"
					class="w-full rounded-md border-gray-300 shadow-sm pl-10 pr-4 py-2 text-sm"
					placeholder="Search nodes..."
					bind:value={searchQuery}
					onkeydown={handleKeyDown}
				/>
				<i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
			</div>
			<button
				class="px-3 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
				onclick={() => searchNodes(searchQuery)}
			>
				Search
			</button>
			<button
				class="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
				onclick={clearHighlight}
			>
				Clear
			</button>
		</div>
	</div>

	<!-- Graph container -->
	<div
		bind:this={chartContainer}
		class="{width} {height} flex-1"
		style="min-height: 500px;"
	></div>

	<!-- Legend explanation -->
	<div class="p-3 border-t bg-gray-50">
		<div class="flex flex-wrap items-center gap-4 text-xs text-gray-600">
			<span class="flex items-center">
				<span class="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
				Asset
			</span>
			<span class="flex items-center">
				<span class="w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
				Control
			</span>
			<span class="flex items-center">
				<span class="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
				Risk
			</span>
			<span class="flex items-center">
				<span class="w-3 h-3 rounded-full bg-orange-500 mr-1"></span>
				Threat
			</span>
			<span class="flex items-center">
				<span class="w-3 h-3 rounded-full bg-purple-500 mr-1"></span>
				Vulnerability
			</span>
			<span class="ml-auto text-gray-400">
				<i class="fa-solid fa-mouse-pointer mr-1"></i>
				Click to select • Double-click to navigate • Drag to move
			</span>
		</div>
	</div>
</div>
