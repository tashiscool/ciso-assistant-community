<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TestCase, TestResult } from './index';
	import { RESULT_COLORS, RESULT_ICONS, PRIORITY_COLORS } from './index';

	// Props
	export let testCases: TestCase[] = [];
	export let results: Map<string, TestResult> = new Map();
	export let loading: boolean = false;

	const dispatch = createEventDispatcher();

	// Selection state
	let selectedIds: Set<string> = new Set();
	let filterPriority: string = 'all';
	let filterStatus: string = 'all';
	let searchQuery: string = '';

	// Bulk action form
	let bulkResult: TestResult['result'] = 'pass';
	let bulkNotes: string = '';
	let showBulkForm: boolean = false;

	// Filtered test cases
	$: filteredCases = testCases
		.filter((tc) => {
			// Priority filter
			if (filterPriority !== 'all' && tc.priority !== filterPriority) return false;

			// Status filter
			const result = results.get(tc.id);
			if (filterStatus === 'not_tested' && result && result.result !== 'not_tested') return false;
			if (filterStatus !== 'all' && filterStatus !== 'not_tested' && result?.result !== filterStatus) return false;

			// Search
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					tc.controlId.toLowerCase().includes(query) ||
					tc.controlName.toLowerCase().includes(query) ||
					tc.testProcedure.toLowerCase().includes(query)
				);
			}

			return true;
		})
		.sort((a, b) => a.sequence - b.sequence);

	// Selection helpers
	$: allSelected = filteredCases.length > 0 && filteredCases.every((tc) => selectedIds.has(tc.id));
	$: someSelected = filteredCases.some((tc) => selectedIds.has(tc.id));
	$: selectedCount = selectedIds.size;

	function toggleSelectAll() {
		if (allSelected) {
			filteredCases.forEach((tc) => selectedIds.delete(tc.id));
		} else {
			filteredCases.forEach((tc) => selectedIds.add(tc.id));
		}
		selectedIds = selectedIds;
	}

	function toggleSelect(id: string) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
		selectedIds = selectedIds;
	}

	function selectByStatus(status: string) {
		testCases.forEach((tc) => {
			const result = results.get(tc.id);
			const currentStatus = result?.result || 'not_tested';
			if (currentStatus === status) {
				selectedIds.add(tc.id);
			}
		});
		selectedIds = selectedIds;
	}

	function selectByPriority(priority: string) {
		testCases.forEach((tc) => {
			if (tc.priority === priority) {
				selectedIds.add(tc.id);
			}
		});
		selectedIds = selectedIds;
	}

	function clearSelection() {
		selectedIds.clear();
		selectedIds = selectedIds;
	}

	function applyBulkResult() {
		if (selectedIds.size === 0) return;

		dispatch('bulkRecord', {
			testCaseIds: Array.from(selectedIds),
			result: bulkResult,
			notes: bulkNotes
		});

		// Reset
		selectedIds.clear();
		selectedIds = selectedIds;
		bulkNotes = '';
		showBulkForm = false;
	}

	function quickBulkResult(result: TestResult['result']) {
		if (selectedIds.size === 0) return;

		dispatch('bulkRecord', {
			testCaseIds: Array.from(selectedIds),
			result,
			notes: ''
		});

		selectedIds.clear();
		selectedIds = selectedIds;
	}
</script>

<div class="bulk-test-panel">
	<!-- Toolbar -->
	<div class="flex flex-wrap items-center gap-3 mb-4 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
		<!-- Search -->
		<div class="flex-1 min-w-[200px]">
			<input
				type="text"
				class="input input-sm w-full"
				placeholder="Search controls..."
				bind:value={searchQuery}
			/>
		</div>

		<!-- Filters -->
		<select class="select select-sm w-auto" bind:value={filterPriority}>
			<option value="all">All Priorities</option>
			<option value="critical">Critical</option>
			<option value="high">High</option>
			<option value="medium">Medium</option>
			<option value="low">Low</option>
		</select>

		<select class="select select-sm w-auto" bind:value={filterStatus}>
			<option value="all">All Status</option>
			<option value="not_tested">Not Tested</option>
			<option value="pass">Pass</option>
			<option value="fail">Fail</option>
			<option value="partial">Partial</option>
			<option value="na">N/A</option>
		</select>

		<!-- Selection Actions -->
		<div class="btn-group variant-ghost">
			<button class="btn btn-sm" onclick={toggleSelectAll} title={allSelected ? 'Deselect all' : 'Select all'}>
				<i class="fa-solid {allSelected ? 'fa-square-check' : 'fa-square'}"></i>
			</button>
			<button class="btn btn-sm" onclick={clearSelection} title="Clear selection" disabled={selectedCount === 0}>
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
	</div>

	<!-- Quick Select Bar -->
	<div class="flex flex-wrap gap-2 mb-4 text-xs">
		<span class="text-surface-500">Quick select:</span>
		<button class="chip variant-soft hover:variant-filled" onclick={() => selectByStatus('not_tested')}>
			All Not Tested
		</button>
		<button class="chip variant-soft-error hover:variant-filled-error" onclick={() => selectByPriority('critical')}>
			All Critical
		</button>
		<button class="chip variant-soft-warning hover:variant-filled-warning" onclick={() => selectByPriority('high')}>
			All High
		</button>
		<button class="chip variant-soft-error hover:variant-filled-error" onclick={() => selectByStatus('fail')}>
			All Failed
		</button>
	</div>

	<!-- Selection Summary & Actions -->
	{#if selectedCount > 0}
		<div class="flex items-center justify-between p-3 mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-lg border border-primary-300 dark:border-primary-700">
			<span class="font-medium text-primary-700 dark:text-primary-300">
				{selectedCount} control{selectedCount !== 1 ? 's' : ''} selected
			</span>

			<div class="flex items-center gap-2">
				<span class="text-sm text-primary-600 dark:text-primary-400">Set all to:</span>
				<button
					class="btn btn-sm variant-filled-success"
					onclick={() => quickBulkResult('pass')}
					disabled={loading}
				>
					<i class="fa-solid fa-check mr-1"></i>Pass
				</button>
				<button
					class="btn btn-sm variant-filled-error"
					onclick={() => quickBulkResult('fail')}
					disabled={loading}
				>
					<i class="fa-solid fa-times mr-1"></i>Fail
				</button>
				<button
					class="btn btn-sm variant-filled-warning"
					onclick={() => quickBulkResult('partial')}
					disabled={loading}
				>
					<i class="fa-solid fa-exclamation mr-1"></i>Partial
				</button>
				<button
					class="btn btn-sm variant-soft"
					onclick={() => quickBulkResult('na')}
					disabled={loading}
				>
					N/A
				</button>
				<button
					class="btn btn-sm variant-ghost"
					onclick={() => (showBulkForm = !showBulkForm)}
					title="Add notes"
				>
					<i class="fa-solid fa-pen"></i>
				</button>
			</div>
		</div>

		<!-- Expanded Bulk Form -->
		{#if showBulkForm}
			<div class="card p-4 mb-4">
				<h4 class="font-semibold mb-3">Bulk Update with Notes</h4>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="label">
							<span>Result</span>
							<select class="select" bind:value={bulkResult}>
								<option value="pass">Pass</option>
								<option value="fail">Fail</option>
								<option value="partial">Partial</option>
								<option value="na">Not Applicable</option>
							</select>
						</label>
					</div>
					<div>
						<label class="label">
							<span>Notes (applied to all)</span>
							<textarea class="textarea" rows="3" bind:value={bulkNotes} placeholder="Enter notes..."></textarea>
						</label>
					</div>
				</div>
				<div class="flex justify-end gap-2 mt-4">
					<button class="btn variant-ghost" onclick={() => (showBulkForm = false)}>Cancel</button>
					<button class="btn variant-filled-primary" onclick={applyBulkResult} disabled={loading}>
						Apply to {selectedCount} Control{selectedCount !== 1 ? 's' : ''}
					</button>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Test Cases Table -->
	<div class="table-container rounded-lg border border-surface-300 dark:border-surface-600">
		<table class="table table-compact">
			<thead>
				<tr>
					<th class="w-10">
						<input
							type="checkbox"
							class="checkbox"
							checked={allSelected}
							indeterminate={someSelected && !allSelected}
							onchange={toggleSelectAll}
						/>
					</th>
					<th class="w-24">Priority</th>
					<th>Control</th>
					<th class="w-32">Status</th>
					<th class="w-20">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each filteredCases as tc (tc.id)}
					{@const result = results.get(tc.id)}
					{@const status = result?.result || 'not_tested'}
					<tr class="hover:bg-surface-100 dark:hover:bg-surface-800 {selectedIds.has(tc.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''}">
						<td>
							<input
								type="checkbox"
								class="checkbox"
								checked={selectedIds.has(tc.id)}
								onchange={() => toggleSelect(tc.id)}
							/>
						</td>
						<td>
							<span class="badge {PRIORITY_COLORS[tc.priority]} text-xs">{tc.priority}</span>
						</td>
						<td>
							<div class="font-medium">{tc.controlId}</div>
							<div class="text-xs text-surface-500 truncate max-w-[300px]">{tc.controlName}</div>
						</td>
						<td>
							<span class="badge {RESULT_COLORS[status]}">
								<i class="fa-solid {RESULT_ICONS[status]} mr-1"></i>
								{status === 'not_tested' ? 'Not Tested' : status === 'na' ? 'N/A' : status.charAt(0).toUpperCase() + status.slice(1)}
							</span>
						</td>
						<td>
							<button
								class="btn btn-sm variant-ghost"
								onclick={() => dispatch('viewDetails', { testCaseId: tc.id })}
								title="View details"
							>
								<i class="fa-solid fa-eye"></i>
							</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="5" class="text-center py-8 text-surface-500">
							No test cases match your filters
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Summary Footer -->
	<div class="flex justify-between items-center mt-4 text-sm text-surface-500">
		<span>Showing {filteredCases.length} of {testCases.length} controls</span>
		<span>
			{testCases.filter((tc) => results.get(tc.id)?.result && results.get(tc.id)?.result !== 'not_tested').length} tested
		</span>
	</div>
</div>
