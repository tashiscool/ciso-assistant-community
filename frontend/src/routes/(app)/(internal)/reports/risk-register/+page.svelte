<script lang="ts">
	export let data;

	$: scenarios = data.scenarios || [];
	$: openCount = scenarios.filter((s: any) => s.treatment === 'open').length;
	$: mitigatedCount = scenarios.filter((s: any) => s.treatment === 'mitigate').length;
	$: acceptedCount = scenarios.filter((s: any) => s.treatment === 'accept').length;

	const treatmentColors: Record<string, string> = {
		open: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
		mitigate: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
		accept: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
		avoid: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
		transfer: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
	};
</script>

<div class="p-6 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Risk Register Report</h1>
		<a href="/reports" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
			&larr; Back to Reports
		</a>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-gray-900 dark:text-white">{scenarios.length}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Scenarios</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-red-600 dark:text-red-400">{openCount}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Open</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-blue-600 dark:text-blue-400">{mitigatedCount}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Mitigated</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-green-600 dark:text-green-400">{acceptedCount}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Accepted</div>
		</div>
	</div>

	{#if scenarios.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-700">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ref ID</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Scenario</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Treatment</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Current Level</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Residual Level</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each scenarios as scenario}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-300">{scenario.ref_id || '-'}</td>
							<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{scenario.name || scenario.str || 'N/A'}</td>
							<td class="px-6 py-4 text-sm">
								<span class="px-2 py-1 rounded-full text-xs font-medium {treatmentColors[scenario.treatment] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
									{scenario.treatment || 'N/A'}
								</span>
							</td>
							<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{scenario.current_level ?? '-'}</td>
							<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">{scenario.residual_level ?? '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
			<p class="text-gray-500 dark:text-gray-400">No risk scenarios found.</p>
		</div>
	{/if}
</div>
