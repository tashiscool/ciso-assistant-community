<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import * as m from '$paraglide/messages';

	interface KanbanItem {
		id: string;
		title: string;
		description?: string;
		assignee?: string;
		priority?: 'low' | 'medium' | 'high' | 'critical';
		dueDate?: string;
		labels?: string[];
		metadata?: Record<string, any>;
	}

	interface KanbanColumn {
		id: string;
		title: string;
		items: KanbanItem[];
		color?: string;
		limit?: number;
	}

	interface Props {
		columns?: KanbanColumn[];
		onItemMove?: (itemId: string, fromColumn: string, toColumn: string) => void;
		onItemClick?: (item: KanbanItem) => void;
		showWipLimits?: boolean;
		allowDragDrop?: boolean;
		compact?: boolean;
	}

	let {
		columns = [],
		onItemMove = () => {},
		onItemClick = () => {},
		showWipLimits = true,
		allowDragDrop = true,
		compact = false
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let draggedItem: KanbanItem | null = $state(null);
	let draggedFromColumn: string | null = $state(null);
	let dropTargetColumn: string | null = $state(null);

	function handleDragStart(event: DragEvent, item: KanbanItem, columnId: string) {
		if (!allowDragDrop) return;
		draggedItem = item;
		draggedFromColumn = columnId;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', item.id);
		}
	}

	function handleDragOver(event: DragEvent, columnId: string) {
		if (!allowDragDrop || !draggedItem) return;
		event.preventDefault();
		dropTargetColumn = columnId;
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragLeave(event: DragEvent) {
		dropTargetColumn = null;
	}

	function handleDrop(event: DragEvent, columnId: string) {
		if (!allowDragDrop || !draggedItem || !draggedFromColumn) return;
		event.preventDefault();

		if (draggedFromColumn !== columnId) {
			onItemMove(draggedItem.id, draggedFromColumn, columnId);
			dispatch('itemMove', {
				itemId: draggedItem.id,
				fromColumn: draggedFromColumn,
				toColumn: columnId
			});
		}

		// Reset drag state
		draggedItem = null;
		draggedFromColumn = null;
		dropTargetColumn = null;
	}

	function handleDragEnd() {
		draggedItem = null;
		draggedFromColumn = null;
		dropTargetColumn = null;
	}

	function handleItemClick(item: KanbanItem) {
		onItemClick(item);
		dispatch('itemClick', item);
	}

	function getPriorityColor(priority: string | undefined): string {
		switch (priority) {
			case 'critical':
				return 'bg-error-500';
			case 'high':
				return 'bg-warning-500';
			case 'medium':
				return 'bg-primary-500';
			case 'low':
				return 'bg-surface-400';
			default:
				return 'bg-surface-300';
		}
	}

	function getColumnHeaderColor(color: string | undefined): string {
		if (!color) return 'bg-surface-200 dark:bg-surface-700';
		return color;
	}

	function isOverWipLimit(column: KanbanColumn): boolean {
		return showWipLimits && column.limit !== undefined && column.items.length > column.limit;
	}
</script>

<div class="kanban-board flex gap-4 overflow-x-auto p-4 min-h-[500px]">
	{#each columns as column (column.id)}
		<div
			class="kanban-column flex flex-col min-w-[280px] max-w-[320px] bg-surface-100 dark:bg-surface-800 rounded-lg shadow-sm"
			class:drop-target={dropTargetColumn === column.id}
			class:over-limit={isOverWipLimit(column)}
			ondragover={(e) => handleDragOver(e, column.id)}
			ondragleave={handleDragLeave}
			ondrop={(e) => handleDrop(e, column.id)}
		>
			<!-- Column Header -->
			<div
				class="column-header p-3 rounded-t-lg flex items-center justify-between {getColumnHeaderColor(column.color)}"
			>
				<div class="flex items-center gap-2">
					<h3 class="font-semibold text-sm">{column.title}</h3>
					<span class="badge variant-filled-surface text-xs">{column.items.length}</span>
				</div>
				{#if showWipLimits && column.limit !== undefined}
					<span
						class="text-xs px-2 py-0.5 rounded"
						class:bg-error-200={isOverWipLimit(column)}
						class:text-error-800={isOverWipLimit(column)}
						class:bg-surface-200={!isOverWipLimit(column)}
					>
						WIP: {column.items.length}/{column.limit}
					</span>
				{/if}
			</div>

			<!-- Column Items -->
			<div class="column-items flex-1 p-2 space-y-2 overflow-y-auto max-h-[600px]">
				{#each column.items as item (item.id)}
					<div
						class="kanban-card bg-white dark:bg-surface-700 rounded-md shadow-sm border border-surface-200 dark:border-surface-600 cursor-pointer transition-all hover:shadow-md"
						class:dragging={draggedItem?.id === item.id}
						class:compact
						draggable={allowDragDrop}
						ondragstart={(e) => handleDragStart(e, item, column.id)}
						ondragend={handleDragEnd}
						onclick={() => handleItemClick(item)}
						onkeydown={(e) => e.key === 'Enter' && handleItemClick(item)}
						role="button"
						tabindex="0"
					>
						<!-- Priority Indicator -->
						{#if item.priority}
							<div class="h-1 rounded-t-md {getPriorityColor(item.priority)}"></div>
						{/if}

						<div class="p-3">
							<!-- Title -->
							<h4 class="font-medium text-sm line-clamp-2">{item.title}</h4>

							<!-- Description (if not compact) -->
							{#if !compact && item.description}
								<p class="text-xs text-surface-500 mt-1 line-clamp-2">{item.description}</p>
							{/if}

							<!-- Labels -->
							{#if item.labels && item.labels.length > 0}
								<div class="flex flex-wrap gap-1 mt-2">
									{#each item.labels.slice(0, 3) as label}
										<span class="text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
											{label}
										</span>
									{/each}
									{#if item.labels.length > 3}
										<span class="text-xs text-surface-400">+{item.labels.length - 3}</span>
									{/if}
								</div>
							{/if}

							<!-- Footer -->
							<div class="flex items-center justify-between mt-2 text-xs text-surface-500">
								{#if item.assignee}
									<div class="flex items-center gap-1">
										<i class="fa-solid fa-user text-xs"></i>
										<span class="truncate max-w-[100px]">{item.assignee}</span>
									</div>
								{:else}
									<div></div>
								{/if}

								{#if item.dueDate}
									<div class="flex items-center gap-1" class:text-error-500={new Date(item.dueDate) < new Date()}>
										<i class="fa-solid fa-calendar text-xs"></i>
										<span>{new Date(item.dueDate).toLocaleDateString()}</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}

				{#if column.items.length === 0}
					<div class="empty-state p-4 text-center text-surface-400 text-sm italic">
						No items
					</div>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.kanban-board {
		scrollbar-width: thin;
	}

	.kanban-column {
		transition: background-color 0.2s, box-shadow 0.2s;
	}

	.kanban-column.drop-target {
		box-shadow: inset 0 0 0 2px rgb(var(--color-primary-500));
		background-color: rgb(var(--color-primary-50));
	}

	:global(.dark) .kanban-column.drop-target {
		background-color: rgb(var(--color-primary-900) / 0.2);
	}

	.kanban-column.over-limit .column-header {
		background-color: rgb(var(--color-error-100));
	}

	:global(.dark) .kanban-column.over-limit .column-header {
		background-color: rgb(var(--color-error-900));
	}

	.kanban-card {
		user-select: none;
	}

	.kanban-card.dragging {
		opacity: 0.5;
		transform: rotate(2deg);
	}

	.kanban-card.compact {
		padding: 0.5rem;
	}

	.kanban-card.compact h4 {
		font-size: 0.75rem;
	}

	.column-items {
		scrollbar-width: thin;
	}

	.column-items::-webkit-scrollbar {
		width: 6px;
	}

	.column-items::-webkit-scrollbar-track {
		background: transparent;
	}

	.column-items::-webkit-scrollbar-thumb {
		background-color: rgb(var(--color-surface-400));
		border-radius: 3px;
	}
</style>
