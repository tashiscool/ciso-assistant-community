<script lang="ts">
	import type { VersionDiffData } from './index';
	import { formatFieldName } from './index';

	// Props
	export let diff: VersionDiffData;
	export let fromVersion: number = 0;
	export let toVersion: number = 0;
	export let showUnchanged: boolean = false;

	// Calculate summary
	$: summary = {
		added: Object.keys(diff?.added || {}).length,
		removed: Object.keys(diff?.removed || {}).length,
		changed: Object.keys(diff?.changed || {}).length
	};

	$: hasChanges = summary.added > 0 || summary.removed > 0 || summary.changed > 0;

	function formatValue(value: any): string {
		if (value === null || value === undefined) return '(empty)';
		if (typeof value === 'object') return JSON.stringify(value, null, 2);
		if (typeof value === 'boolean') return value ? 'Yes' : 'No';
		return String(value);
	}

	function isLongValue(value: any): boolean {
		const str = formatValue(value);
		return str.length > 100 || str.includes('\n');
	}
</script>

<div class="version-diff">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2">
			<span class="badge variant-soft-secondary">v{fromVersion}</span>
			<i class="fa-solid fa-arrow-right text-surface-500"></i>
			<span class="badge variant-soft-primary">v{toVersion}</span>
		</div>

		<div class="flex gap-2 text-sm">
			{#if summary.added > 0}
				<span class="text-success-500">
					<i class="fa-solid fa-plus"></i>
					{summary.added} added
				</span>
			{/if}
			{#if summary.removed > 0}
				<span class="text-error-500">
					<i class="fa-solid fa-minus"></i>
					{summary.removed} removed
				</span>
			{/if}
			{#if summary.changed > 0}
				<span class="text-warning-500">
					<i class="fa-solid fa-pen"></i>
					{summary.changed} changed
				</span>
			{/if}
		</div>
	</div>

	{#if !hasChanges}
		<div class="text-center py-8 text-surface-500">
			<i class="fa-solid fa-equals text-4xl mb-2"></i>
			<p>No differences between versions</p>
		</div>
	{:else}
		<div class="diff-content space-y-3">
			<!-- Added Fields -->
			{#if Object.keys(diff?.added || {}).length > 0}
				<div class="diff-section">
					<h4 class="text-sm font-semibold text-success-600 dark:text-success-400 mb-2">
						<i class="fa-solid fa-plus-circle mr-1"></i>
						Added Fields
					</h4>
					{#each Object.entries(diff.added) as [field, value]}
						<div class="diff-item bg-success-50 dark:bg-success-900/20 p-3 rounded-lg mb-2">
							<div class="font-medium text-sm mb-1">{formatFieldName(field)}</div>
							<div class="diff-value text-success-700 dark:text-success-300">
								{#if isLongValue(value)}
									<pre class="text-xs whitespace-pre-wrap">{formatValue(value)}</pre>
								{:else}
									{formatValue(value)}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Removed Fields -->
			{#if Object.keys(diff?.removed || {}).length > 0}
				<div class="diff-section">
					<h4 class="text-sm font-semibold text-error-600 dark:text-error-400 mb-2">
						<i class="fa-solid fa-minus-circle mr-1"></i>
						Removed Fields
					</h4>
					{#each Object.entries(diff.removed) as [field, value]}
						<div class="diff-item bg-error-50 dark:bg-error-900/20 p-3 rounded-lg mb-2">
							<div class="font-medium text-sm mb-1">{formatFieldName(field)}</div>
							<div class="diff-value text-error-700 dark:text-error-300 line-through">
								{#if isLongValue(value)}
									<pre class="text-xs whitespace-pre-wrap">{formatValue(value)}</pre>
								{:else}
									{formatValue(value)}
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Changed Fields -->
			{#if Object.keys(diff?.changed || {}).length > 0}
				<div class="diff-section">
					<h4 class="text-sm font-semibold text-warning-600 dark:text-warning-400 mb-2">
						<i class="fa-solid fa-pen-to-square mr-1"></i>
						Changed Fields
					</h4>
					{#each Object.entries(diff.changed) as [field, change]}
						<div class="diff-item bg-surface-100 dark:bg-surface-800 p-3 rounded-lg mb-2">
							<div class="font-medium text-sm mb-2">{formatFieldName(field)}</div>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<div class="text-xs text-surface-500 mb-1">Before</div>
									<div
										class="diff-value bg-error-50 dark:bg-error-900/30 p-2 rounded text-error-700 dark:text-error-300"
									>
										{#if isLongValue(change.old)}
											<pre class="text-xs whitespace-pre-wrap">{formatValue(change.old)}</pre>
										{:else}
											{formatValue(change.old)}
										{/if}
									</div>
								</div>
								<div>
									<div class="text-xs text-surface-500 mb-1">After</div>
									<div
										class="diff-value bg-success-50 dark:bg-success-900/30 p-2 rounded text-success-700 dark:text-success-300"
									>
										{#if isLongValue(change.new)}
											<pre class="text-xs whitespace-pre-wrap">{formatValue(change.new)}</pre>
										{:else}
											{formatValue(change.new)}
										{/if}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.diff-value {
		font-family: monospace;
		font-size: 0.875rem;
		word-break: break-word;
	}

	pre {
		margin: 0;
		font-family: inherit;
	}
</style>
