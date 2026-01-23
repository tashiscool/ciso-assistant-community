<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { MasterAssessmentData, ControlGroup, TestCase, TestResult } from './index';
	import { RESULT_COLORS, RESULT_ICONS } from './index';
	import AssessmentProgress from './AssessmentProgress.svelte';
	import BulkTestPanel from './BulkTestPanel.svelte';

	// Props
	export let assessment: MasterAssessmentData;
	export let testCases: TestCase[] = [];
	export let results: Map<string, TestResult> = new Map();
	export let loading: boolean = false;

	const dispatch = createEventDispatcher();

	// State
	let activeGroupId: string | null = null;
	let viewMode: 'groups' | 'all' = 'groups';
	let showInheritance: boolean = true;

	// Active group
	$: activeGroup = assessment.groups.find((g) => g.id === activeGroupId);
	$: groupTestCases = activeGroup
		? testCases.filter((tc) => tc.controlId.startsWith(activeGroup.id) || activeGroup.id === tc.controlId)
		: [];

	// Calculate group stats
	function getGroupStats(group: ControlGroup) {
		const groupCases = testCases.filter(
			(tc) => tc.controlId.startsWith(group.id) || group.id === tc.controlId
		);
		const tested = groupCases.filter((tc) => {
			const r = results.get(tc.id);
			return r && r.result !== 'not_tested';
		}).length;
		const passed = groupCases.filter((tc) => results.get(tc.id)?.result === 'pass').length;

		return {
			total: groupCases.length,
			tested,
			passed,
			progress: groupCases.length > 0 ? Math.round((tested / groupCases.length) * 100) : 0
		};
	}

	// Status colors
	const STATUS_COLORS: Record<string, string> = {
		pending: 'variant-soft-surface',
		in_progress: 'variant-filled-primary',
		completed: 'variant-filled-success',
		blocked: 'variant-filled-error'
	};

	function selectGroup(groupId: string) {
		activeGroupId = groupId;
	}

	function startGroup(groupId: string) {
		dispatch('startGroup', { groupId });
	}

	function completeGroup(groupId: string) {
		dispatch('completeGroup', { groupId });
	}

	function handleRecordResult(event: CustomEvent) {
		dispatch('recordResult', event.detail);
	}

	function handleBulkRecord(event: CustomEvent) {
		dispatch('bulkRecord', event.detail);
	}

	function handleViewDetails(event: CustomEvent) {
		dispatch('viewDetails', event.detail);
	}

	function applyInheritance() {
		dispatch('applyInheritance');
	}
</script>

<div class="master-assessment">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<div>
			<h2 class="h3 flex items-center gap-2">
				<i class="fa-solid fa-layer-group text-primary-500"></i>
				{assessment.name}
			</h2>
			<p class="text-surface-500">{assessment.description || 'Master Assessment'}</p>
		</div>

		<div class="flex items-center gap-2">
			<span class="badge {STATUS_COLORS[assessment.status]}">{assessment.status.replace('_', ' ')}</span>

			{#if assessment.status === 'planning'}
				<button class="btn variant-filled-primary" onclick={() => dispatch('start')}>
					<i class="fa-solid fa-play mr-1"></i>
					Start Assessment
				</button>
			{:else if assessment.status === 'in_progress'}
				<button class="btn variant-filled-warning" onclick={() => dispatch('submitForReview')}>
					<i class="fa-solid fa-paper-plane mr-1"></i>
					Submit for Review
				</button>
			{:else if assessment.status === 'review'}
				<button class="btn variant-filled-success" onclick={() => dispatch('complete')}>
					<i class="fa-solid fa-check mr-1"></i>
					Complete
				</button>
			{/if}
		</div>
	</div>

	<!-- Overall Progress -->
	<div class="card p-4 mb-6">
		<div class="flex items-center justify-between mb-4">
			<h3 class="font-semibold">Overall Progress</h3>
			<div class="flex items-center gap-2">
				<span class="text-sm text-surface-500">
					{assessment.completedGroups} / {assessment.totalGroups} groups complete
				</span>
			</div>
		</div>

		<div class="mb-2">
			<div class="flex justify-between text-sm mb-1">
				<span>Groups</span>
				<span>{Math.round((assessment.completedGroups / Math.max(assessment.totalGroups, 1)) * 100)}%</span>
			</div>
			<div class="progress-bar h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
				<div
					class="bg-primary-500 h-full transition-all duration-300"
					style="width: {(assessment.completedGroups / Math.max(assessment.totalGroups, 1)) * 100}%"
				></div>
			</div>
		</div>

		<div>
			<div class="flex justify-between text-sm mb-1">
				<span>Controls</span>
				<span>{assessment.progressPercentage}%</span>
			</div>
			<div class="progress-bar h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
				<div
					class="bg-success-500 h-full transition-all duration-300"
					style="width: {assessment.progressPercentage}%"
				></div>
			</div>
		</div>
	</div>

	<!-- View Mode Toggle -->
	<div class="flex items-center justify-between mb-4">
		<div class="btn-group variant-ghost">
			<button
				class="btn btn-sm {viewMode === 'groups' ? 'variant-filled' : ''}"
				onclick={() => (viewMode = 'groups')}
			>
				<i class="fa-solid fa-folder-tree mr-1"></i>
				By Group
			</button>
			<button
				class="btn btn-sm {viewMode === 'all' ? 'variant-filled' : ''}"
				onclick={() => (viewMode = 'all')}
			>
				<i class="fa-solid fa-list mr-1"></i>
				All Controls
			</button>
		</div>

		{#if assessment.status !== 'planning'}
			<label class="flex items-center gap-2">
				<input type="checkbox" class="checkbox" bind:checked={showInheritance} />
				<span class="text-sm">Show Inheritance</span>
				{#if showInheritance}
					<button class="btn btn-sm variant-ghost-primary" onclick={applyInheritance}>
						<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>
						Apply Inheritance
					</button>
				{/if}
			</label>
		{/if}
	</div>

	{#if viewMode === 'groups'}
		<!-- Groups View -->
		<div class="grid grid-cols-3 gap-6">
			<!-- Groups List -->
			<div class="col-span-1">
				<div class="card p-4">
					<h4 class="font-semibold mb-3">Control Groups ({assessment.groups.length})</h4>
					<div class="space-y-2 max-h-[500px] overflow-y-auto">
						{#each assessment.groups as group (group.id)}
							{@const stats = getGroupStats(group)}
							<button
								class="w-full text-left p-3 rounded-lg border transition-all
									{activeGroupId === group.id
									? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
									: 'border-surface-300 dark:border-surface-600 hover:border-primary-300'}"
								onclick={() => selectGroup(group.id)}
							>
								<div class="flex items-center justify-between mb-1">
									<span class="font-medium truncate">{group.name}</span>
									<span class="badge {STATUS_COLORS[group.status]} text-xs">{group.status}</span>
								</div>
								<div class="text-xs text-surface-500 mb-2">
									{stats.tested}/{stats.total} tested
									{#if group.assignedTo}
										<span class="ml-2">
											<i class="fa-solid fa-user"></i>
											{group.assignedTo}
										</span>
									{/if}
								</div>
								<div class="progress-bar h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
									<div
										class="h-full transition-all duration-300 {stats.progress === 100
											? 'bg-success-500'
											: 'bg-primary-500'}"
										style="width: {stats.progress}%"
									></div>
								</div>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Group Details -->
			<div class="col-span-2">
				{#if activeGroup}
					<div class="card p-4">
						<div class="flex items-center justify-between mb-4">
							<div>
								<h3 class="h4">{activeGroup.name}</h3>
								<p class="text-sm text-surface-500">{activeGroup.description || ''}</p>
							</div>
							<div class="flex items-center gap-2">
								{#if activeGroup.status === 'pending'}
									<button
										class="btn btn-sm variant-filled-primary"
										onclick={() => startGroup(activeGroup.id)}
									>
										<i class="fa-solid fa-play mr-1"></i>
										Start
									</button>
								{:else if activeGroup.status === 'in_progress'}
									<button
										class="btn btn-sm variant-filled-success"
										onclick={() => completeGroup(activeGroup.id)}
									>
										<i class="fa-solid fa-check mr-1"></i>
										Complete
									</button>
								{/if}
							</div>
						</div>

						{@const stats = getGroupStats(activeGroup)}
						<AssessmentProgress
							total={stats.total}
							tested={stats.tested}
							passed={stats.passed}
							failed={groupTestCases.filter((tc) => results.get(tc.id)?.result === 'fail').length}
							notApplicable={groupTestCases.filter((tc) => results.get(tc.id)?.result === 'na').length}
							showDetails={false}
						/>

						<div class="mt-4">
							<BulkTestPanel
								testCases={groupTestCases}
								{results}
								{loading}
								on:bulkRecord={handleBulkRecord}
								on:viewDetails={handleViewDetails}
							/>
						</div>
					</div>
				{:else}
					<div class="card p-8 text-center text-surface-500">
						<i class="fa-solid fa-hand-pointer text-4xl mb-3"></i>
						<p>Select a control group to view details</p>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- All Controls View -->
		<div class="card p-4">
			<BulkTestPanel
				{testCases}
				{results}
				{loading}
				on:bulkRecord={handleBulkRecord}
				on:viewDetails={handleViewDetails}
			/>
		</div>
	{/if}

	<!-- Inheritance Panel -->
	{#if showInheritance && assessment.status !== 'planning'}
		<div class="mt-6 card p-4 border-2 border-dashed border-primary-300 dark:border-primary-700">
			<h4 class="font-semibold mb-3 flex items-center gap-2">
				<i class="fa-solid fa-diagram-project text-primary-500"></i>
				Control Inheritance
			</h4>
			<p class="text-sm text-surface-500 mb-4">
				Common controls across frameworks can inherit test results. This reduces duplicate testing effort.
			</p>

			<div class="grid grid-cols-3 gap-4">
				<div class="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
					<div class="text-2xl font-bold text-primary-500">
						{Object.keys(assessment.groups.reduce((acc, g) => {
							// Count potential inheritance mappings
							return acc;
						}, {})).length || 0}
					</div>
					<div class="text-xs text-surface-500">Mapped Controls</div>
				</div>
				<div class="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
					<div class="text-2xl font-bold text-success-500">0</div>
					<div class="text-xs text-surface-500">Auto-Inherited</div>
				</div>
				<div class="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
					<div class="text-2xl font-bold text-warning-500">0</div>
					<div class="text-xs text-surface-500">Pending Review</div>
				</div>
			</div>
		</div>
	{/if}
</div>
