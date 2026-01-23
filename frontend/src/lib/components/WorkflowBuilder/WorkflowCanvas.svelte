<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { WorkflowNodeData, WorkflowConnection, NodeType } from './index';
	import { getNodeDefinition } from './index';
	import WorkflowNode from './WorkflowNode.svelte';

	export let nodes: WorkflowNodeData[] = [];
	export let connections: WorkflowConnection[] = [];
	export let selectedNodeId: string | null = null;
	export let zoom: number = 1;
	export let panX: number = 0;
	export let panY: number = 0;

	const dispatch = createEventDispatcher();

	let canvasEl: HTMLElement;
	let isPanning = false;
	let panStartX = 0;
	let panStartY = 0;

	// Connection drawing state
	let isConnecting = false;
	let connectingFrom: { nodeId: string; portId: string; isOutput: boolean } | null = null;
	let mouseX = 0;
	let mouseY = 0;

	// Get port position for drawing connections
	function getPortPosition(nodeId: string, portId: string, isOutput: boolean): { x: number; y: number } | null {
		const node = nodes.find((n) => n.id === nodeId);
		if (!node) return null;

		const definition = getNodeDefinition(node.type);
		if (!definition) return null;

		const ports = isOutput ? definition.outputs : definition.inputs;
		const portIndex = ports.findIndex((p) => p.id === portId);
		if (portIndex < 0) return null;

		// Approximate port position based on node position
		const nodeWidth = 160;
		const headerHeight = 40;
		const portSpacing = 24;
		const basePortY = headerHeight + 20 + portIndex * portSpacing;

		return {
			x: node.position.x + (isOutput ? nodeWidth + 6 : -6),
			y: node.position.y + basePortY
		};
	}

	// Generate SVG path for connection
	function getConnectionPath(conn: WorkflowConnection): string {
		const start = getPortPosition(conn.sourceNodeId, conn.sourcePort, true);
		const end = getPortPosition(conn.targetNodeId, conn.targetPort, false);

		if (!start || !end) return '';

		const dx = end.x - start.x;
		const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);

		return `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`;
	}

	// Drawing connection preview
	function getPreviewPath(): string {
		if (!connectingFrom || !isConnecting) return '';

		const start = getPortPosition(connectingFrom.nodeId, connectingFrom.portId, connectingFrom.isOutput);
		if (!start) return '';

		const canvasRect = canvasEl?.getBoundingClientRect();
		if (!canvasRect) return '';

		const endX = (mouseX - canvasRect.left - panX) / zoom;
		const endY = (mouseY - canvasRect.top - panY) / zoom;

		const dx = endX - start.x;
		const controlOffset = Math.min(Math.abs(dx) * 0.5, 100);

		if (connectingFrom.isOutput) {
			return `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
		} else {
			return `M ${endX} ${endY} C ${endX + controlOffset} ${endY}, ${start.x - controlOffset} ${start.y}, ${start.x} ${start.y}`;
		}
	}

	// Event handlers
	function handleCanvasClick(e: MouseEvent) {
		if (e.target === canvasEl || (e.target as HTMLElement).classList.contains('canvas-background')) {
			dispatch('deselect');
			if (isConnecting) {
				isConnecting = false;
				connectingFrom = null;
			}
		}
	}

	function handleCanvasMouseDown(e: MouseEvent) {
		if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
			isPanning = true;
			panStartX = e.clientX - panX;
			panStartY = e.clientY - panY;
		}
	}

	function handleCanvasMouseMove(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;

		if (isPanning) {
			panX = e.clientX - panStartX;
			panY = e.clientY - panStartY;
			dispatch('pan', { panX, panY });
		}
	}

	function handleCanvasMouseUp() {
		isPanning = false;
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -0.1 : 0.1;
		const newZoom = Math.max(0.25, Math.min(2, zoom + delta));
		dispatch('zoom', { zoom: newZoom });
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const nodeType = e.dataTransfer?.getData('nodeType') as NodeType;
		if (!nodeType) return;

		const canvasRect = canvasEl.getBoundingClientRect();
		const x = (e.clientX - canvasRect.left - panX) / zoom;
		const y = (e.clientY - canvasRect.top - panY) / zoom;

		dispatch('addNode', { nodeType, x, y });
	}

	// Node events
	function handleNodeSelect(e: CustomEvent) {
		dispatch('selectNode', e.detail);
	}

	function handleNodeDrag(e: CustomEvent) {
		dispatch('moveNode', e.detail);
	}

	function handleNodeDelete(e: CustomEvent) {
		dispatch('deleteNode', e.detail);
	}

	function handleNodeConfigure(e: CustomEvent) {
		dispatch('configureNode', e.detail);
	}

	function handlePortClick(e: CustomEvent) {
		const { nodeId, portId, isOutput } = e.detail;

		if (!isConnecting) {
			isConnecting = true;
			connectingFrom = { nodeId, portId, isOutput };
		} else if (connectingFrom) {
			// Complete connection
			if (connectingFrom.isOutput && !isOutput && connectingFrom.nodeId !== nodeId) {
				dispatch('addConnection', {
					sourceNodeId: connectingFrom.nodeId,
					sourcePort: connectingFrom.portId,
					targetNodeId: nodeId,
					targetPort: portId
				});
			} else if (!connectingFrom.isOutput && isOutput && connectingFrom.nodeId !== nodeId) {
				dispatch('addConnection', {
					sourceNodeId: nodeId,
					sourcePort: portId,
					targetNodeId: connectingFrom.nodeId,
					targetPort: connectingFrom.portId
				});
			}
			isConnecting = false;
			connectingFrom = null;
		}
	}

	function handleConnectionClick(connId: string, e: MouseEvent) {
		e.stopPropagation();
		dispatch('selectConnection', { connectionId: connId });
	}

	function handleConnectionDelete(connId: string) {
		dispatch('deleteConnection', { connectionId: connId });
	}
</script>

<div
	class="workflow-canvas relative w-full h-full overflow-hidden bg-surface-100 dark:bg-surface-900"
	bind:this={canvasEl}
	onclick={handleCanvasClick}
	onmousedown={handleCanvasMouseDown}
	onmousemove={handleCanvasMouseMove}
	onmouseup={handleCanvasMouseUp}
	onmouseleave={handleCanvasMouseUp}
	onwheel={handleWheel}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	role="application"
	aria-label="Workflow canvas"
>
	<!-- Grid Background -->
	<svg class="canvas-background absolute inset-0 w-full h-full pointer-events-none">
		<defs>
			<pattern
				id="grid"
				width={20 * zoom}
				height={20 * zoom}
				patternUnits="userSpaceOnUse"
				x={panX % (20 * zoom)}
				y={panY % (20 * zoom)}
			>
				<circle cx="1" cy="1" r="1" fill="currentColor" class="text-surface-300 dark:text-surface-700" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#grid)" class="pointer-events-auto" />
	</svg>

	<!-- Connections SVG -->
	<svg
		class="connections-layer absolute inset-0 w-full h-full pointer-events-none"
		style="transform: translate({panX}px, {panY}px) scale({zoom});"
	>
		{#each connections as conn (conn.id)}
			<g class="connection-group pointer-events-auto">
				<!-- Hit area for clicking -->
				<path
					d={getConnectionPath(conn)}
					fill="none"
					stroke="transparent"
					stroke-width="20"
					class="cursor-pointer"
					onclick={(e) => handleConnectionClick(conn.id, e)}
				/>
				<!-- Visible path -->
				<path
					d={getConnectionPath(conn)}
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					class="text-primary-500 transition-colors"
				/>
			</g>
		{/each}

		<!-- Connection Preview -->
		{#if isConnecting}
			<path
				d={getPreviewPath()}
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-dasharray="5,5"
				class="text-primary-400"
			/>
		{/if}
	</svg>

	<!-- Nodes Container -->
	<div
		class="nodes-layer absolute"
		style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0;"
	>
		{#each nodes as node (node.id)}
			<WorkflowNode
				{node}
				selected={selectedNodeId === node.id}
				connecting={isConnecting}
				on:select={handleNodeSelect}
				on:drag={handleNodeDrag}
				on:dragEnd={handleNodeDrag}
				on:delete={handleNodeDelete}
				on:configure={handleNodeConfigure}
				on:portClick={handlePortClick}
			/>
		{/each}
	</div>

	<!-- Zoom Controls -->
	<div class="absolute bottom-4 right-4 flex items-center gap-2 bg-white dark:bg-surface-800 rounded-lg shadow-lg p-2">
		<button class="btn btn-sm variant-ghost" onclick={() => dispatch('zoom', { zoom: zoom - 0.1 })} disabled={zoom <= 0.25}>
			<i class="fa-solid fa-minus"></i>
		</button>
		<span class="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
		<button class="btn btn-sm variant-ghost" onclick={() => dispatch('zoom', { zoom: zoom + 0.1 })} disabled={zoom >= 2}>
			<i class="fa-solid fa-plus"></i>
		</button>
		<button class="btn btn-sm variant-ghost" onclick={() => dispatch('zoom', { zoom: 1 })} title="Reset zoom">
			<i class="fa-solid fa-expand"></i>
		</button>
	</div>

	<!-- Connection Mode Indicator -->
	{#if isConnecting}
		<div class="absolute top-4 left-1/2 -translate-x-1/2 bg-primary-500 text-white px-4 py-2 rounded-full text-sm shadow-lg">
			<i class="fa-solid fa-link mr-2"></i>
			Click a port to connect or click canvas to cancel
		</div>
	{/if}
</div>

<style>
	.workflow-canvas {
		cursor: default;
	}
	.workflow-canvas:active {
		cursor: grabbing;
	}
</style>
