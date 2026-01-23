<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { WorkflowNodeData, NodeDefinition } from './index';
	import { getNodeDefinition, CATEGORY_COLORS } from './index';

	export let node: WorkflowNodeData;
	export let selected: boolean = false;
	export let connecting: boolean = false;

	const dispatch = createEventDispatcher();

	$: definition = getNodeDefinition(node.type) as NodeDefinition;
	$: colorClass = definition ? CATEGORY_COLORS[definition.category] : 'surface';

	let isDragging = false;
	let startX = 0;
	let startY = 0;

	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		isDragging = true;
		startX = e.clientX - node.position.x;
		startY = e.clientY - node.position.y;
		dispatch('dragStart', { nodeId: node.id });
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		const newX = e.clientX - startX;
		const newY = e.clientY - startY;
		dispatch('drag', { nodeId: node.id, x: newX, y: newY });
	}

	function handleMouseUp() {
		if (isDragging) {
			isDragging = false;
			dispatch('dragEnd', { nodeId: node.id });
		}
	}

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		dispatch('select', { nodeId: node.id });
	}

	function handleDoubleClick(e: MouseEvent) {
		e.stopPropagation();
		dispatch('configure', { nodeId: node.id });
	}

	function handlePortClick(portId: string, isOutput: boolean, e: MouseEvent) {
		e.stopPropagation();
		dispatch('portClick', { nodeId: node.id, portId, isOutput });
	}

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		dispatch('delete', { nodeId: node.id });
	}
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div
	class="workflow-node absolute select-none"
	style="left: {node.position.x}px; top: {node.position.y}px;"
	role="button"
	tabindex="0"
	onclick={handleClick}
	ondblclick={handleDoubleClick}
	onkeydown={(e) => e.key === 'Enter' && handleClick(e as unknown as MouseEvent)}
>
	<div
		class="node-container rounded-lg shadow-lg border-2 transition-all duration-150 min-w-[160px]
			{selected ? 'border-primary-500 ring-2 ring-primary-300' : 'border-surface-300 dark:border-surface-600'}
			{isDragging ? 'cursor-grabbing shadow-xl scale-105' : 'cursor-grab hover:shadow-xl'}"
	>
		<!-- Header -->
		<div
			class="node-header px-3 py-2 rounded-t-md flex items-center gap-2 variant-filled-{colorClass}"
			role="button"
			tabindex="0"
			onmousedown={handleMouseDown}
		>
			{#if definition}
				<i class="fa-solid {definition.icon} text-sm"></i>
			{/if}
			<span class="font-medium text-sm truncate flex-1">{node.name || definition?.name || 'Node'}</span>
			{#if selected}
				<button
					class="text-xs opacity-70 hover:opacity-100"
					onclick={handleDelete}
					title="Delete node"
				>
					<i class="fa-solid fa-times"></i>
				</button>
			{/if}
		</div>

		<!-- Body -->
		<div class="node-body bg-white dark:bg-surface-800 px-3 py-2 rounded-b-md">
			{#if definition}
				<p class="text-xs text-surface-500 mb-2">{definition.description}</p>
			{/if}

			<!-- Input Ports -->
			{#if definition?.inputs && definition.inputs.length > 0}
				<div class="input-ports mb-2">
					{#each definition.inputs as port}
						<div class="port-row flex items-center gap-2 -ml-5">
							<button
								class="port w-3 h-3 rounded-full border-2 border-surface-400 bg-white dark:bg-surface-700
									hover:border-primary-500 hover:bg-primary-100 transition-colors
									{connecting ? 'ring-2 ring-primary-300' : ''}"
								onclick={(e) => handlePortClick(port.id, false, e)}
								title={port.name}
							></button>
							<span class="text-xs text-surface-500">{port.name}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Config Preview -->
			{#if node.config && Object.keys(node.config).length > 0}
				<div class="config-preview text-xs bg-surface-100 dark:bg-surface-700 rounded p-1 mb-2">
					{#each Object.entries(node.config).slice(0, 2) as [key, value]}
						<div class="truncate">
							<span class="text-surface-500">{key}:</span>
							<span class="text-surface-700 dark:text-surface-300">{String(value).slice(0, 20)}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Output Ports -->
			{#if definition?.outputs && definition.outputs.length > 0}
				<div class="output-ports">
					{#each definition.outputs as port}
						<div class="port-row flex items-center justify-end gap-2 -mr-5">
							<span class="text-xs text-surface-500">{port.name}</span>
							<button
								class="port w-3 h-3 rounded-full border-2 border-surface-400 bg-white dark:bg-surface-700
									hover:border-primary-500 hover:bg-primary-100 transition-colors
									{port.type === 'data' ? 'border-secondary-400' : ''}"
								onclick={(e) => handlePortClick(port.id, true, e)}
								title={port.name}
							></button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.workflow-node {
		z-index: 10;
	}
	.workflow-node:hover {
		z-index: 20;
	}
	.port {
		flex-shrink: 0;
	}
</style>
