<script lang="ts">
	// Progress visualization for assessments
	export let total: number = 0;
	export let tested: number = 0;
	export let passed: number = 0;
	export let failed: number = 0;
	export let notApplicable: number = 0;
	export let showDetails: boolean = true;

	// Calculated values
	$: remaining = total - tested;
	$: partial = tested - passed - failed - notApplicable;
	$: progressPercent = total > 0 ? Math.round((tested / total) * 100) : 0;
	$: compliancePercent = tested - notApplicable > 0
		? Math.round((passed / (tested - notApplicable)) * 100)
		: 0;

	// Segment widths for progress bar
	$: passedWidth = total > 0 ? (passed / total) * 100 : 0;
	$: failedWidth = total > 0 ? (failed / total) * 100 : 0;
	$: partialWidth = total > 0 ? (partial / total) * 100 : 0;
	$: naWidth = total > 0 ? (notApplicable / total) * 100 : 0;
</script>

<div class="assessment-progress">
	<!-- Main Progress Bar -->
	<div class="mb-4">
		<div class="flex justify-between text-sm mb-1">
			<span class="font-medium">Progress</span>
			<span class="text-surface-500">{tested} / {total} ({progressPercent}%)</span>
		</div>
		<div class="progress-bar h-4 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden flex">
			{#if passedWidth > 0}
				<div
					class="bg-success-500 h-full transition-all duration-300"
					style="width: {passedWidth}%"
					title="Passed: {passed}"
				></div>
			{/if}
			{#if failedWidth > 0}
				<div
					class="bg-error-500 h-full transition-all duration-300"
					style="width: {failedWidth}%"
					title="Failed: {failed}"
				></div>
			{/if}
			{#if partialWidth > 0}
				<div
					class="bg-warning-500 h-full transition-all duration-300"
					style="width: {partialWidth}%"
					title="Partial: {partial}"
				></div>
			{/if}
			{#if naWidth > 0}
				<div
					class="bg-surface-400 h-full transition-all duration-300"
					style="width: {naWidth}%"
					title="N/A: {notApplicable}"
				></div>
			{/if}
		</div>
	</div>

	{#if showDetails}
		<!-- Stats Grid -->
		<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
			<div class="stat-card bg-surface-100 dark:bg-surface-800 rounded-lg p-3 text-center">
				<div class="text-2xl font-bold text-surface-700 dark:text-surface-200">{total}</div>
				<div class="text-xs text-surface-500">Total Controls</div>
			</div>

			<div class="stat-card bg-success-100 dark:bg-success-900/30 rounded-lg p-3 text-center">
				<div class="text-2xl font-bold text-success-700 dark:text-success-400">{passed}</div>
				<div class="text-xs text-success-600 dark:text-success-500">Passed</div>
			</div>

			<div class="stat-card bg-error-100 dark:bg-error-900/30 rounded-lg p-3 text-center">
				<div class="text-2xl font-bold text-error-700 dark:text-error-400">{failed}</div>
				<div class="text-xs text-error-600 dark:text-error-500">Failed</div>
			</div>

			<div class="stat-card bg-warning-100 dark:bg-warning-900/30 rounded-lg p-3 text-center">
				<div class="text-2xl font-bold text-warning-700 dark:text-warning-400">{partial}</div>
				<div class="text-xs text-warning-600 dark:text-warning-500">Partial</div>
			</div>

			<div class="stat-card bg-surface-100 dark:bg-surface-800 rounded-lg p-3 text-center">
				<div class="text-2xl font-bold text-surface-500">{remaining}</div>
				<div class="text-xs text-surface-500">Remaining</div>
			</div>
		</div>

		<!-- Compliance Score -->
		<div class="mt-4 flex items-center justify-between p-3 bg-surface-100 dark:bg-surface-800 rounded-lg">
			<div>
				<div class="text-sm font-medium">Compliance Score</div>
				<div class="text-xs text-surface-500">Based on tested controls (excluding N/A)</div>
			</div>
			<div class="text-right">
				<div class="text-3xl font-bold {compliancePercent >= 80 ? 'text-success-500' : compliancePercent >= 60 ? 'text-warning-500' : 'text-error-500'}">
					{compliancePercent}%
				</div>
			</div>
		</div>

		<!-- Legend -->
		<div class="mt-4 flex flex-wrap gap-4 text-xs">
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-success-500"></div>
				<span>Pass</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-error-500"></div>
				<span>Fail</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-warning-500"></div>
				<span>Partial</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-surface-400"></div>
				<span>N/A</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="w-3 h-3 rounded bg-surface-200 dark:bg-surface-700"></div>
				<span>Not Tested</span>
			</div>
		</div>
	{/if}
</div>
