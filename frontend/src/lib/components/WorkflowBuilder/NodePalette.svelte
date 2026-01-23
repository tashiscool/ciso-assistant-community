<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { NODE_DEFINITIONS, CATEGORY_COLORS, CATEGORY_ICONS, getNodesByCategory } from './index';
	import type { NodeType } from './index';

	const dispatch = createEventDispatcher();

	let searchQuery = '';
	let expandedCategories: Set<string> = new Set(['trigger', 'action', 'logic']);

	const categories = ['trigger', 'action', 'logic', 'data', 'integration', 'end'];
	const categoryLabels: Record<string, string> = {
		trigger: 'Triggers',
		action: 'Actions',
		logic: 'Logic',
		data: 'Data',
		integration: 'Integrations',
		end: 'End'
	};

	$: filteredNodes = searchQuery
		? NODE_DEFINITIONS.filter(
				(n) =>
					n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					n.description.toLowerCase().includes(searchQuery.toLowerCase())
			)
		: NODE_DEFINITIONS;

	function toggleCategory(category: string) {
		if (expandedCategories.has(category)) {
			expandedCategories.delete(category);
		} else {
			expandedCategories.add(category);
		}
		expandedCategories = expandedCategories;
	}

	function handleDragStart(e: DragEvent, nodeType: NodeType) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData('nodeType', nodeType);
		e.dataTransfer.effectAllowed = 'copy';
		dispatch('dragStart', { nodeType });
	}

	function handleNodeClick(nodeType: NodeType) {
		dispatch('addNode', { nodeType });
	}
</script>

<div class="node-palette h-full flex flex-col">
	<!-- Search -->
	<div class="p-3 border-b border-surface-300 dark:border-surface-600">
		<input
			type="text"
			class="input input-sm w-full"
			placeholder="Search nodes..."
			bind:value={searchQuery}
		/>
	</div>

	<!-- Categories -->
	<div class="flex-1 overflow-y-auto">
		{#if searchQuery}
			<!-- Search Results -->
			<div class="p-2">
				<div class="text-xs text-surface-500 mb-2">{filteredNodes.length} results</div>
				<div class="space-y-1">
					{#each filteredNodes as nodeDef}
						<button
							class="node-item w-full text-left p-2 rounded-lg flex items-center gap-2
								hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-grab"
							draggable="true"
							ondragstart={(e) => handleDragStart(e, nodeDef.type)}
							onclick={() => handleNodeClick(nodeDef.type)}
						>
							<div
								class="w-8 h-8 rounded flex items-center justify-center variant-soft-{CATEGORY_COLORS[nodeDef.category]}"
							>
								<i class="fa-solid {nodeDef.icon} text-sm"></i>
							</div>
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm truncate">{nodeDef.name}</div>
								<div class="text-xs text-surface-500 truncate">{nodeDef.description}</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Category Groups -->
			{#each categories as category}
				{@const nodes = getNodesByCategory(category)}
				{#if nodes.length > 0}
					<div class="category-group">
						<button
							class="category-header w-full p-3 flex items-center gap-2 text-left
								hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors
								border-b border-surface-200 dark:border-surface-700"
							onclick={() => toggleCategory(category)}
						>
							<i
								class="fa-solid fa-chevron-right text-xs transition-transform
									{expandedCategories.has(category) ? 'rotate-90' : ''}"
							></i>
							<i class="fa-solid {CATEGORY_ICONS[category]} text-{CATEGORY_COLORS[category]}-500"></i>
							<span class="font-medium text-sm">{categoryLabels[category]}</span>
							<span class="text-xs text-surface-500 ml-auto">{nodes.length}</span>
						</button>

						{#if expandedCategories.has(category)}
							<div class="category-nodes p-2 space-y-1 bg-surface-50 dark:bg-surface-900/50">
								{#each nodes as nodeDef}
									<button
										class="node-item w-full text-left p-2 rounded-lg flex items-center gap-2
											hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-grab
											border border-transparent hover:border-surface-300 dark:hover:border-surface-600"
										draggable="true"
										ondragstart={(e) => handleDragStart(e, nodeDef.type)}
										onclick={() => handleNodeClick(nodeDef.type)}
									>
										<div
											class="w-7 h-7 rounded flex items-center justify-center variant-soft-{CATEGORY_COLORS[category]}"
										>
											<i class="fa-solid {nodeDef.icon} text-xs"></i>
										</div>
										<div class="flex-1 min-w-0">
											<div class="font-medium text-sm truncate">{nodeDef.name}</div>
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		{/if}
	</div>

	<!-- Help -->
	<div class="p-3 border-t border-surface-300 dark:border-surface-600 bg-surface-100 dark:bg-surface-800">
		<div class="text-xs text-surface-500">
			<i class="fa-solid fa-info-circle mr-1"></i>
			Drag nodes onto the canvas or click to add
		</div>
	</div>
</div>
