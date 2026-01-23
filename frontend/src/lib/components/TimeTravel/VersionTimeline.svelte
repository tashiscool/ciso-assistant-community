<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TimelineEntry } from './index';
	import { CHANGE_TYPE_COLORS, CHANGE_TYPE_ICONS, formatVersionDate } from './index';

	// Props
	export let timeline: TimelineEntry[] = [];
	export let currentVersion: number = 0;
	export let loading: boolean = false;

	const dispatch = createEventDispatcher();

	function selectVersion(entry: TimelineEntry) {
		dispatch('select', { entry });
	}
</script>

<div class="version-timeline">
	{#if loading}
		<div class="flex justify-center py-8">
			<i class="fa-solid fa-spinner fa-spin text-2xl"></i>
		</div>
	{:else if timeline.length === 0}
		<div class="text-center py-8 text-surface-500">
			<i class="fa-solid fa-timeline text-4xl mb-2"></i>
			<p>No history available</p>
		</div>
	{:else}
		<div class="timeline-container relative pl-8">
			<!-- Timeline line -->
			<div class="timeline-line absolute left-3 top-0 bottom-0 w-0.5 bg-surface-300 dark:bg-surface-600"></div>

			{#each timeline as entry, index (entry.version)}
				<div class="timeline-entry relative pb-6">
					<!-- Timeline dot -->
					<div
						class="timeline-dot absolute left-0 w-6 h-6 rounded-full flex items-center justify-center -translate-x-1/2
              {entry.version === currentVersion
							? 'bg-primary-500 ring-4 ring-primary-200 dark:ring-primary-800'
							: 'bg-surface-200 dark:bg-surface-700'}"
					>
						<i
							class="fa-solid {CHANGE_TYPE_ICONS[entry.changeType] || 'fa-circle'} text-xs
                {entry.version === currentVersion ? 'text-white' : 'text-surface-500'}"
						></i>
					</div>

					<!-- Content -->
					<button
						class="timeline-content ml-4 card p-3 w-full text-left hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
						onclick={() => selectVersion(entry)}
					>
						<div class="flex items-start justify-between gap-4">
							<div class="flex items-center gap-2">
								<span
									class="badge {CHANGE_TYPE_COLORS[entry.changeType] || 'variant-soft'} text-xs"
								>
									v{entry.version}
								</span>
								<span class="font-medium text-sm">{entry.changeSummary}</span>
							</div>
							<span class="text-xs text-surface-500 whitespace-nowrap">
								{formatVersionDate(entry.createdAt)}
							</span>
						</div>

						{#if entry.changedFields.length > 0}
							<div class="mt-2 flex flex-wrap gap-1">
								{#each entry.changedFields.slice(0, 5) as field}
									<span class="badge variant-soft-surface text-xs">{field}</span>
								{/each}
								{#if entry.changedFields.length > 5}
									<span class="badge variant-soft-surface text-xs">
										+{entry.changedFields.length - 5} more
									</span>
								{/if}
							</div>
						{/if}

						{#if entry.createdBy}
							<div class="mt-2 text-xs text-surface-500">
								<i class="fa-solid fa-user mr-1"></i>
								{entry.createdBy}
							</div>
						{/if}

						{#if entry.diff && (Object.keys(entry.diff.added).length > 0 || Object.keys(entry.diff.removed).length > 0 || Object.keys(entry.diff.changed).length > 0)}
							<div class="mt-2 flex gap-3 text-xs">
								{#if Object.keys(entry.diff.added).length > 0}
									<span class="text-success-500">
										+{Object.keys(entry.diff.added).length}
									</span>
								{/if}
								{#if Object.keys(entry.diff.removed).length > 0}
									<span class="text-error-500">
										-{Object.keys(entry.diff.removed).length}
									</span>
								{/if}
								{#if Object.keys(entry.diff.changed).length > 0}
									<span class="text-warning-500">
										~{Object.keys(entry.diff.changed).length}
									</span>
								{/if}
							</div>
						{/if}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.timeline-dot {
		z-index: 1;
	}

	.timeline-line {
		z-index: 0;
	}
</style>
