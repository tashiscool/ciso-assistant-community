<script lang="ts">
	export let data;

	$: assessments = data.assessments || [];
	$: risks = data.risks || [];
	$: poamItems = data.poamItems || [];
	$: openRisks = risks.filter((r: any) => r.treatment === 'open').length;
	$: mitigatedRisks = risks.filter((r: any) => r.treatment === 'mitigate').length;
	$: openPoam = poamItems.filter((i: any) => !['completed', 'cancelled'].includes(i.status)).length;
	$: overduePoam = poamItems.filter((i: any) => i.is_overdue).length;

	const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
</script>

<div class="p-6 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Continuous Monitoring Monthly Report</h1>
		<a href="/reports" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
			&larr; Back to Reports
		</a>
	</div>

	<p class="text-sm text-gray-500 dark:text-gray-400">Generated: {today}</p>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{assessments.length}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Active Assessments</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-red-600 dark:text-red-400">{openRisks}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Open Risk Scenarios</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{openPoam}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Open POA&M Items</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-orange-600 dark:text-orange-400">{overduePoam}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Overdue POA&M Items</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk Treatment Summary</h2>
			<div class="space-y-3">
				<div class="flex justify-between items-center">
					<span class="text-sm text-gray-600 dark:text-gray-300">Open</span>
					<span class="text-sm font-medium text-red-600 dark:text-red-400">{openRisks}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-sm text-gray-600 dark:text-gray-300">Mitigated</span>
					<span class="text-sm font-medium text-blue-600 dark:text-blue-400">{mitigatedRisks}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-sm text-gray-600 dark:text-gray-300">Total</span>
					<span class="text-sm font-medium text-gray-900 dark:text-white">{risks.length}</span>
				</div>
			</div>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">POA&M Summary</h2>
			<div class="space-y-3">
				<div class="flex justify-between items-center">
					<span class="text-sm text-gray-600 dark:text-gray-300">Open Items</span>
					<span class="text-sm font-medium text-yellow-600 dark:text-yellow-400">{openPoam}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-sm text-gray-600 dark:text-gray-300">Overdue</span>
					<span class="text-sm font-medium text-red-600 dark:text-red-400">{overduePoam}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-sm text-gray-600 dark:text-gray-300">Total</span>
					<span class="text-sm font-medium text-gray-900 dark:text-white">{poamItems.length}</span>
				</div>
			</div>
		</div>
	</div>

	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compliance Assessments</h2>
		{#if assessments.length > 0}
			<div class="space-y-3">
				{#each assessments as assessment}
					<div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
						<div>
							<span class="text-sm text-gray-900 dark:text-white">{assessment.name || assessment.str || 'N/A'}</span>
							<span class="text-xs text-gray-500 dark:text-gray-400 ml-2">{assessment.framework?.str || ''}</span>
						</div>
						<span class="px-2 py-1 rounded-full text-xs font-medium
							{assessment.status === 'done' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
							 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}">
							{assessment.status || 'N/A'}
						</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-gray-500 dark:text-gray-400 text-sm">No assessments found.</p>
		{/if}
	</div>
</div>
