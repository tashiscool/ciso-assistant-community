<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { WorkflowDefinition, WorkflowNodeData, WorkflowConnection, NodeType } from './index';
	import { getNodeDefinition } from './index';
	import WorkflowCanvas from './WorkflowCanvas.svelte';
	import NodePalette from './NodePalette.svelte';
	import PropertyPanel from './PropertyPanel.svelte';

	// Props
	export let workflow: WorkflowDefinition;
	export let readonly: boolean = false;

	const dispatch = createEventDispatcher();

	// State
	let nodes: WorkflowNodeData[] = workflow.nodes || [];
	let connections: WorkflowConnection[] = workflow.connections || [];
	let selectedNodeId: string | null = null;
	let zoom: number = 1;
	let panX: number = 50;
	let panY: number = 50;
	let showPalette: boolean = true;
	let showProperties: boolean = true;
	let hasChanges: boolean = false;

	$: selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

	// Generate unique ID
	function generateId(): string {
		return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// Add new node
	function addNode(nodeType: NodeType, x: number = 200, y: number = 200) {
		if (readonly) return;

		const definition = getNodeDefinition(nodeType);
		if (!definition) return;

		const newNode: WorkflowNodeData = {
			id: generateId(),
			type: nodeType,
			name: definition.name,
			position: { x, y },
			config: {},
			inputs: definition.inputs.map((p) => p.id),
			outputs: definition.outputs.map((p) => p.id)
		};

		// Set default config values
		definition.configSchema.forEach((field) => {
			if (field.defaultValue !== undefined) {
				newNode.config[field.name] = field.defaultValue;
			}
		});

		nodes = [...nodes, newNode];
		selectedNodeId = newNode.id;
		hasChanges = true;
	}

	// Move node
	function moveNode(nodeId: string, x: number, y: number) {
		if (readonly) return;

		nodes = nodes.map((n) => (n.id === nodeId ? { ...n, position: { x, y } } : n));
		hasChanges = true;
	}

	// Delete node
	function deleteNode(nodeId: string) {
		if (readonly) return;

		nodes = nodes.filter((n) => n.id !== nodeId);
		connections = connections.filter((c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId);

		if (selectedNodeId === nodeId) {
			selectedNodeId = null;
		}
		hasChanges = true;
	}

	// Update node config
	function updateNodeConfig(nodeId: string, field: string, value: unknown) {
		if (readonly) return;

		nodes = nodes.map((n) => {
			if (n.id === nodeId) {
				return { ...n, config: { ...n.config, [field]: value } };
			}
			return n;
		});
		hasChanges = true;
	}

	// Update node name
	function updateNodeName(nodeId: string, name: string) {
		if (readonly) return;

		nodes = nodes.map((n) => (n.id === nodeId ? { ...n, name } : n));
		hasChanges = true;
	}

	// Add connection
	function addConnection(sourceNodeId: string, sourcePort: string, targetNodeId: string, targetPort: string) {
		if (readonly) return;

		// Check for duplicate
		const exists = connections.some(
			(c) =>
				c.sourceNodeId === sourceNodeId &&
				c.sourcePort === sourcePort &&
				c.targetNodeId === targetNodeId &&
				c.targetPort === targetPort
		);
		if (exists) return;

		// Check for circular reference (simple check)
		if (sourceNodeId === targetNodeId) return;

		const newConnection: WorkflowConnection = {
			id: `conn_${Date.now()}`,
			sourceNodeId,
			sourcePort,
			targetNodeId,
			targetPort
		};

		connections = [...connections, newConnection];
		hasChanges = true;
	}

	// Delete connection
	function deleteConnection(connectionId: string) {
		if (readonly) return;

		connections = connections.filter((c) => c.id !== connectionId);
		hasChanges = true;
	}

	// Save workflow
	function saveWorkflow() {
		const updated: WorkflowDefinition = {
			...workflow,
			nodes,
			connections,
			version: workflow.version + 1
		};

		dispatch('save', updated);
		hasChanges = false;
	}

	// Validate workflow
	function validateWorkflow(): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Check for trigger
		const triggers = nodes.filter((n) => n.type.startsWith('trigger_'));
		if (triggers.length === 0) {
			errors.push('Workflow must have at least one trigger');
		}

		// Check for end nodes
		const endNodes = nodes.filter((n) => n.type.startsWith('end_'));
		if (endNodes.length === 0) {
			errors.push('Workflow should have at least one end node');
		}

		// Check for disconnected nodes
		nodes.forEach((node) => {
			const definition = getNodeDefinition(node.type);
			if (!definition) return;

			const hasIncoming = connections.some((c) => c.targetNodeId === node.id);
			const hasOutgoing = connections.some((c) => c.sourceNodeId === node.id);

			if (!node.type.startsWith('trigger_') && !hasIncoming) {
				errors.push(`Node "${node.name}" has no incoming connections`);
			}
			if (!node.type.startsWith('end_') && definition.outputs.length > 0 && !hasOutgoing) {
				errors.push(`Node "${node.name}" has no outgoing connections`);
			}
		});

		// Check required config
		nodes.forEach((node) => {
			const definition = getNodeDefinition(node.type);
			if (!definition) return;

			definition.configSchema.forEach((field) => {
				if (field.required && !node.config[field.name]) {
					errors.push(`Node "${node.name}" is missing required field: ${field.label}`);
				}
			});
		});

		return { valid: errors.length === 0, errors };
	}

	// Run validation
	$: validation = validateWorkflow();

	// Canvas event handlers
	function handleCanvasEvent(event: CustomEvent) {
		const { type, detail } = { type: event.type, detail: event.detail };

		switch (type) {
			case 'addNode':
				addNode(detail.nodeType, detail.x, detail.y);
				break;
			case 'selectNode':
				selectedNodeId = detail.nodeId;
				break;
			case 'deselect':
				selectedNodeId = null;
				break;
			case 'moveNode':
				moveNode(detail.nodeId, detail.x, detail.y);
				break;
			case 'deleteNode':
				deleteNode(detail.nodeId);
				break;
			case 'addConnection':
				addConnection(detail.sourceNodeId, detail.sourcePort, detail.targetNodeId, detail.targetPort);
				break;
			case 'deleteConnection':
				deleteConnection(detail.connectionId);
				break;
			case 'zoom':
				zoom = Math.max(0.25, Math.min(2, detail.zoom));
				break;
			case 'pan':
				panX = detail.panX;
				panY = detail.panY;
				break;
		}
	}

	function handlePropertyEvent(event: CustomEvent) {
		const { type, detail } = { type: event.type, detail: event.detail };

		switch (type) {
			case 'updateConfig':
				updateNodeConfig(detail.nodeId, detail.field, detail.value);
				break;
			case 'updateName':
				updateNodeName(detail.nodeId, detail.name);
				break;
			case 'delete':
				deleteNode(detail.nodeId);
				break;
		}
	}

	function handlePaletteAddNode(event: CustomEvent) {
		addNode(event.detail.nodeType);
	}
</script>

<div class="workflow-builder h-full flex flex-col">
	<!-- Toolbar -->
	<div class="toolbar flex items-center justify-between p-3 border-b border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800">
		<div class="flex items-center gap-3">
			<h2 class="font-semibold">{workflow.name}</h2>
			<span class="badge {workflow.status === 'active' ? 'variant-filled-success' : 'variant-soft-surface'}">
				{workflow.status}
			</span>
			{#if hasChanges}
				<span class="badge variant-filled-warning">Unsaved</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<!-- Toggle Panels -->
			<button
				class="btn btn-sm {showPalette ? 'variant-filled' : 'variant-ghost'}"
				onclick={() => (showPalette = !showPalette)}
				title="Toggle node palette"
			>
				<i class="fa-solid fa-cubes"></i>
			</button>
			<button
				class="btn btn-sm {showProperties ? 'variant-filled' : 'variant-ghost'}"
				onclick={() => (showProperties = !showProperties)}
				title="Toggle properties panel"
			>
				<i class="fa-solid fa-sliders"></i>
			</button>

			<div class="h-6 border-l border-surface-300 dark:border-surface-600 mx-2"></div>

			<!-- Validation -->
			{#if !validation.valid}
				<button
					class="btn btn-sm variant-soft-warning"
					title={validation.errors.join('\n')}
				>
					<i class="fa-solid fa-triangle-exclamation mr-1"></i>
					{validation.errors.length} issue{validation.errors.length !== 1 ? 's' : ''}
				</button>
			{/if}

			<!-- Actions -->
			{#if !readonly}
				<button
					class="btn btn-sm variant-ghost"
					onclick={() => dispatch('test', { workflow: { ...workflow, nodes, connections } })}
					title="Test workflow"
				>
					<i class="fa-solid fa-play mr-1"></i>
					Test
				</button>
				<button
					class="btn btn-sm variant-filled-primary"
					onclick={saveWorkflow}
					disabled={!hasChanges}
				>
					<i class="fa-solid fa-save mr-1"></i>
					Save
				</button>
			{/if}
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 flex overflow-hidden">
		<!-- Node Palette -->
		{#if showPalette && !readonly}
			<div class="w-64 border-r border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800">
				<NodePalette on:addNode={handlePaletteAddNode} />
			</div>
		{/if}

		<!-- Canvas -->
		<div class="flex-1 relative">
			<WorkflowCanvas
				{nodes}
				{connections}
				{selectedNodeId}
				{zoom}
				{panX}
				{panY}
				on:addNode={handleCanvasEvent}
				on:selectNode={handleCanvasEvent}
				on:deselect={handleCanvasEvent}
				on:moveNode={handleCanvasEvent}
				on:deleteNode={handleCanvasEvent}
				on:configureNode={handleCanvasEvent}
				on:addConnection={handleCanvasEvent}
				on:deleteConnection={handleCanvasEvent}
				on:selectConnection={handleCanvasEvent}
				on:zoom={handleCanvasEvent}
				on:pan={handleCanvasEvent}
			/>
		</div>

		<!-- Property Panel -->
		{#if showProperties}
			<div class="w-80 border-l border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800">
				<PropertyPanel
					node={selectedNode}
					on:updateConfig={handlePropertyEvent}
					on:updateName={handlePropertyEvent}
					on:delete={handlePropertyEvent}
					on:save={() => saveWorkflow()}
				/>
			</div>
		{/if}
	</div>

	<!-- Validation Errors Drawer -->
	{#if !validation.valid && validation.errors.length > 0}
		<div class="validation-errors border-t border-surface-300 dark:border-surface-600 bg-warning-50 dark:bg-warning-900/20 p-3">
			<div class="flex items-start gap-2">
				<i class="fa-solid fa-triangle-exclamation text-warning-500 mt-0.5"></i>
				<div class="flex-1">
					<div class="font-medium text-sm text-warning-700 dark:text-warning-300">Validation Issues</div>
					<ul class="text-xs text-warning-600 dark:text-warning-400 mt-1 space-y-0.5">
						{#each validation.errors.slice(0, 3) as error}
							<li>{error}</li>
						{/each}
						{#if validation.errors.length > 3}
							<li>...and {validation.errors.length - 3} more</li>
						{/if}
					</ul>
				</div>
				<button class="text-warning-500 hover:text-warning-700" onclick={() => dispatch('showErrors', { errors: validation.errors })}>
					<i class="fa-solid fa-chevron-right"></i>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.workflow-builder {
		min-height: 600px;
	}
</style>
