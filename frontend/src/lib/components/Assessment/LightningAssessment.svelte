<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LightningAssessmentData, TestCase, TestResult } from './index';
	import { RESULT_COLORS, RESULT_ICONS, PRIORITY_COLORS } from './index';
	import AssessmentProgress from './AssessmentProgress.svelte';

	// Props
	export let assessment: LightningAssessmentData;
	export let testCases: TestCase[] = [];
	export let results: Map<string, TestResult> = new Map();
	export let loading: boolean = false;

	const dispatch = createEventDispatcher();

	// State
	let currentIndex: number = 0;
	let bulkMode: boolean = false;
	let selectedCases: Set<string> = new Set();
	let filterStatus: string = 'all';
	let sortBy: string = 'sequence';

	// Current test case
	$: currentCase = testCases[currentIndex];
	$: currentResult = currentCase ? results.get(currentCase.id) : undefined;

	// Filtered and sorted test cases
	$: filteredCases = testCases
		.filter((tc) => {
			if (filterStatus === 'all') return true;
			const result = results.get(tc.id);
			if (filterStatus === 'not_tested') return !result || result.result === 'not_tested';
			return result?.result === filterStatus;
		})
		.sort((a, b) => {
			if (sortBy === 'sequence') return a.sequence - b.sequence;
			if (sortBy === 'priority') {
				const priorities = ['critical', 'high', 'medium', 'low'];
				return priorities.indexOf(a.priority) - priorities.indexOf(b.priority);
			}
			return 0;
		});

	// Form state for current test
	let testForm = {
		result: 'not_tested' as TestResult['result'],
		actualResult: '',
		notes: '',
		findings: '',
		recommendations: ''
	};

	$: if (currentResult) {
		testForm = {
			result: currentResult.result,
			actualResult: currentResult.actualResult || '',
			notes: currentResult.notes || '',
			findings: currentResult.findings || '',
			recommendations: currentResult.recommendations || ''
		};
	}

	function recordResult() {
		if (!currentCase) return;

		dispatch('recordResult', {
			testCaseId: currentCase.id,
			...testForm
		});

		// Move to next untested
		const nextUntested = testCases.findIndex((tc, idx) => {
			if (idx <= currentIndex) return false;
			const r = results.get(tc.id);
			return !r || r.result === 'not_tested';
		});

		if (nextUntested >= 0) {
			currentIndex = nextUntested;
		}
	}

	function quickResult(result: TestResult['result']) {
		if (!currentCase) return;

		dispatch('recordResult', {
			testCaseId: currentCase.id,
			result,
			actualResult: '',
			notes: '',
			findings: '',
			recommendations: ''
		});

		// Auto-advance
		if (currentIndex < testCases.length - 1) {
			currentIndex++;
		}
	}

	function bulkRecord(result: TestResult['result']) {
		if (selectedCases.size === 0) return;

		dispatch('bulkRecord', {
			testCaseIds: Array.from(selectedCases),
			result
		});

		selectedCases.clear();
		selectedCases = selectedCases;
	}

	function toggleSelect(caseId: string) {
		if (selectedCases.has(caseId)) {
			selectedCases.delete(caseId);
		} else {
			selectedCases.add(caseId);
		}
		selectedCases = selectedCases;
	}

	function selectAll() {
		filteredCases.forEach((tc) => selectedCases.add(tc.id));
		selectedCases = selectedCases;
	}

	function selectNone() {
		selectedCases.clear();
		selectedCases = selectedCases;
	}

	function startAssessment() {
		dispatch('start');
	}

	function completeAssessment() {
		dispatch('complete');
	}
</script>

<div class="lightning-assessment">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h2 class="h3 flex items-center gap-2">
				<i class="fa-solid fa-bolt text-warning-500"></i>
				{assessment.name}
			</h2>
			<p class="text-surface-500">{assessment.description || 'Lightning Assessment'}</p>
		</div>

		<div class="flex items-center gap-2">
			{#if assessment.status === 'draft'}
				<button class="btn variant-filled-primary" onclick={startAssessment}>
					<i class="fa-solid fa-play mr-1"></i>
					Start Assessment
				</button>
			{:else if assessment.status === 'in_progress'}
				<button class="btn variant-filled-success" onclick={completeAssessment}>
					<i class="fa-solid fa-check mr-1"></i>
					Complete
				</button>
			{/if}
		</div>
	</div>

	<!-- Progress Overview -->
	<div class="mb-6">
		<AssessmentProgress
			total={assessment.totalControls}
			tested={assessment.testedControls}
			passed={assessment.passedControls}
			failed={assessment.failedControls}
			notApplicable={assessment.notApplicable}
		/>
	</div>

	{#if assessment.status !== 'draft'}
		<!-- Mode Toggle -->
		<div class="flex items-center justify-between mb-4">
			<div class="btn-group variant-ghost">
				<button class="btn btn-sm {!bulkMode ? 'variant-filled' : ''}" onclick={() => (bulkMode = false)}>
					<i class="fa-solid fa-list"></i>
					Sequential
				</button>
				<button class="btn btn-sm {bulkMode ? 'variant-filled' : ''}" onclick={() => (bulkMode = true)}>
					<i class="fa-solid fa-table-cells"></i>
					Bulk Mode
				</button>
			</div>

			<div class="flex items-center gap-2">
				<select class="select select-sm w-auto" bind:value={filterStatus}>
					<option value="all">All Status</option>
					<option value="not_tested">Not Tested</option>
					<option value="pass">Pass</option>
					<option value="fail">Fail</option>
					<option value="partial">Partial</option>
					<option value="na">N/A</option>
				</select>

				<select class="select select-sm w-auto" bind:value={sortBy}>
					<option value="sequence">Order</option>
					<option value="priority">Priority</option>
				</select>
			</div>
		</div>

		{#if bulkMode}
			<!-- Bulk Mode -->
			<div class="card p-4">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-2">
						<button class="btn btn-sm variant-ghost" onclick={selectAll}>Select All</button>
						<button class="btn btn-sm variant-ghost" onclick={selectNone}>Select None</button>
						<span class="text-sm text-surface-500">{selectedCases.size} selected</span>
					</div>

					{#if selectedCases.size > 0}
						<div class="flex items-center gap-2">
							<span class="text-sm">Set all to:</span>
							<button class="btn btn-sm variant-filled-success" onclick={() => bulkRecord('pass')}>
								Pass
							</button>
							<button class="btn btn-sm variant-filled-error" onclick={() => bulkRecord('fail')}>
								Fail
							</button>
							<button class="btn btn-sm variant-filled-warning" onclick={() => bulkRecord('partial')}>
								Partial
							</button>
							<button class="btn btn-sm variant-soft" onclick={() => bulkRecord('na')}>N/A</button>
						</div>
					{/if}
				</div>

				<div class="space-y-2 max-h-[500px] overflow-y-auto">
					{#each filteredCases as tc (tc.id)}
						{@const result = results.get(tc.id)}
						<button
							class="bulk-item card p-3 w-full text-left flex items-center gap-3
                {selectedCases.has(tc.id) ? 'ring-2 ring-primary-500' : ''}"
							onclick={() => toggleSelect(tc.id)}
						>
							<input
								type="checkbox"
								class="checkbox"
								checked={selectedCases.has(tc.id)}
								onclick={(e) => e.stopPropagation()}
							/>
							<span class="badge {PRIORITY_COLORS[tc.priority]} text-xs">{tc.priority}</span>
							<div class="flex-1 min-w-0">
								<div class="font-medium truncate">{tc.controlName}</div>
								<div class="text-xs text-surface-500 truncate">{tc.controlId}</div>
							</div>
							<span class="badge {RESULT_COLORS[result?.result || 'not_tested']}">
								<i class="fa-solid {RESULT_ICONS[result?.result || 'not_tested']} mr-1"></i>
								{result?.result || 'Not Tested'}
							</span>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Sequential Mode -->
			<div class="grid grid-cols-3 gap-6">
				<!-- Control List -->
				<div class="col-span-1 card p-4">
					<h4 class="font-semibold mb-3">Controls ({filteredCases.length})</h4>
					<div class="space-y-1 max-h-[400px] overflow-y-auto">
						{#each filteredCases as tc, idx (tc.id)}
							{@const result = results.get(tc.id)}
							<button
								class="control-item p-2 rounded w-full text-left text-sm flex items-center gap-2
                  {idx === currentIndex ? 'bg-primary-100 dark:bg-primary-900' : 'hover:bg-surface-100 dark:hover:bg-surface-800'}"
								onclick={() => (currentIndex = testCases.indexOf(tc))}
							>
								<i
									class="fa-solid {RESULT_ICONS[result?.result || 'not_tested']}
                    {result?.result === 'pass'
										? 'text-success-500'
										: result?.result === 'fail'
											? 'text-error-500'
											: 'text-surface-400'}"
								></i>
								<span class="truncate flex-1">{tc.controlId}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Test Panel -->
				<div class="col-span-2 card p-4">
					{#if currentCase}
						<div class="mb-4">
							<div class="flex items-center justify-between">
								<h3 class="h4">{currentCase.controlName}</h3>
								<span class="badge {PRIORITY_COLORS[currentCase.priority]}">{currentCase.priority}</span>
							</div>
							<p class="text-sm text-surface-500">{currentCase.controlId}</p>
						</div>

						<div class="mb-4 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
							<h5 class="font-medium mb-1">Test Procedure</h5>
							<p class="text-sm">{currentCase.testProcedure}</p>
							{#if currentCase.expectedResult}
								<h5 class="font-medium mt-3 mb-1">Expected Result</h5>
								<p class="text-sm">{currentCase.expectedResult}</p>
							{/if}
						</div>

						<!-- Quick Actions -->
						<div class="flex gap-2 mb-4">
							<button
								class="btn btn-sm variant-filled-success flex-1"
								onclick={() => quickResult('pass')}
							>
								<i class="fa-solid fa-check mr-1"></i>
								Pass
							</button>
							<button
								class="btn btn-sm variant-filled-error flex-1"
								onclick={() => quickResult('fail')}
							>
								<i class="fa-solid fa-times mr-1"></i>
								Fail
							</button>
							<button
								class="btn btn-sm variant-filled-warning flex-1"
								onclick={() => quickResult('partial')}
							>
								<i class="fa-solid fa-exclamation mr-1"></i>
								Partial
							</button>
							<button class="btn btn-sm variant-soft flex-1" onclick={() => quickResult('na')}>
								N/A
							</button>
						</div>

						<!-- Detailed Form -->
						<details class="mb-4">
							<summary class="cursor-pointer text-sm font-medium">Add Details</summary>
							<div class="mt-3 space-y-3">
								<label class="label">
									<span>Actual Result</span>
									<textarea class="textarea" rows="2" bind:value={testForm.actualResult}></textarea>
								</label>
								<label class="label">
									<span>Notes</span>
									<textarea class="textarea" rows="2" bind:value={testForm.notes}></textarea>
								</label>
								<label class="label">
									<span>Findings</span>
									<textarea class="textarea" rows="2" bind:value={testForm.findings}></textarea>
								</label>
								<label class="label">
									<span>Recommendations</span>
									<textarea class="textarea" rows="2" bind:value={testForm.recommendations}></textarea>
								</label>
								<button class="btn variant-filled-primary w-full" onclick={recordResult}>
									Save Result
								</button>
							</div>
						</details>

						<!-- Navigation -->
						<div class="flex justify-between">
							<button
								class="btn variant-ghost"
								disabled={currentIndex === 0}
								onclick={() => currentIndex--}
							>
								<i class="fa-solid fa-chevron-left mr-1"></i>
								Previous
							</button>
							<span class="text-sm text-surface-500">
								{currentIndex + 1} / {testCases.length}
							</span>
							<button
								class="btn variant-ghost"
								disabled={currentIndex === testCases.length - 1}
								onclick={() => currentIndex++}
							>
								Next
								<i class="fa-solid fa-chevron-right ml-1"></i>
							</button>
						</div>
					{:else}
						<div class="text-center py-8 text-surface-500">
							<i class="fa-solid fa-clipboard-list text-4xl mb-2"></i>
							<p>No test cases available</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{:else}
		<div class="text-center py-12 text-surface-500">
			<i class="fa-solid fa-bolt text-6xl mb-4 text-warning-300"></i>
			<h3 class="h4 mb-2">Ready to Start</h3>
			<p>Click "Start Assessment" to begin testing</p>
		</div>
	{/if}
</div>
