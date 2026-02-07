<script lang="ts">
	export let data;

	$: assessments = data.assessments || [];
	$: totalAssessments = assessments.length;
	$: completedCount = assessments.filter((a: any) => a.status === 'done').length;
	$: inProgressCount = assessments.filter((a: any) => a.status === 'in_progress').length;
</script>

<div class="p-6 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Compliance Summary Report</h1>
		<a href="/reports" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
			&larr; Back to Reports
		</a>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{totalAssessments}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Assessments</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-green-600 dark:text-green-400">{completedCount}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Completed</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{inProgressCount}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">In Progress</div>
		</div>
	</div>

	{#if assessments.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-700">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Assessment</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Framework</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Score</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each assessments as assessment}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{assessment.name || assessment.str || 'N/A'}</td>
							<td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{assessment.framework?.str || 'N/A'}</td>
							<td class="px-6 py-4 text-sm">
								<span class="px-2 py-1 rounded-full text-xs font-medium
									{assessment.status === 'done' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
									 assessment.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
									 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
									{assessment.status || 'N/A'}
								</span>
							</td>
							<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{assessment.global_score ?? 'N/A'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
			<p class="text-gray-500 dark:text-gray-400">No compliance assessments found.</p>
		</div>
	{/if}
</div>
