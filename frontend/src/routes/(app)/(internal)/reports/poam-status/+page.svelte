<script lang="ts">
	export let data;

	$: items = data.items || [];
	$: overdueItems = data.overdueItems || [];
	$: totalItems = items.length;
	$: openCount = items.filter((i: any) => ['draft', 'submitted', 'approved', 'in_progress'].includes(i.status)).length;
	$: completedCount = items.filter((i: any) => i.status === 'completed').length;
	$: overdueCount = overdueItems.length;

	const riskColors: Record<string, string> = {
		very_high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
		high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
		moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
		low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
		very_low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
	};

	const statusColors: Record<string, string> = {
		draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
		submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
		approved: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
		in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
		completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
		rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
		cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
	};
</script>

<div class="p-6 space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">POA&M Status Report</h1>
		<a href="/reports" class="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
			&larr; Back to Reports
		</a>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-gray-900 dark:text-white">{totalItems}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Items</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{openCount}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Open</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-red-600 dark:text-red-400">{overdueCount}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Overdue</div>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
			<div class="text-3xl font-bold text-green-600 dark:text-green-400">{completedCount}</div>
			<div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Completed</div>
		</div>
	</div>

	{#if items.length > 0}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead class="bg-gray-50 dark:bg-gray-700">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">ID</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Title</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Risk Level</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Due Date</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Progress</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each items as item}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700" class:bg-red-50={item.is_overdue} class:dark:bg-red-900={item.is_overdue}>
							<td class="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-300">{item.weakness_id || '-'}</td>
							<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
								<a href="/poam/{item.id}" class="hover:text-indigo-600 dark:hover:text-indigo-400">{item.title || 'N/A'}</a>
							</td>
							<td class="px-6 py-4 text-sm">
								<span class="px-2 py-1 rounded-full text-xs font-medium {riskColors[item.risk_level] || 'bg-gray-100 text-gray-800'}">
									{(item.risk_level || 'N/A').replace('_', ' ')}
								</span>
							</td>
							<td class="px-6 py-4 text-sm">
								<span class="px-2 py-1 rounded-full text-xs font-medium {statusColors[item.status] || 'bg-gray-100 text-gray-800'}">
									{(item.status || 'N/A').replace('_', ' ')}
								</span>
							</td>
							<td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{item.estimated_completion_date || '-'}</td>
							<td class="px-6 py-4 text-sm">
								<div class="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
									<div class="bg-indigo-600 h-2 rounded-full" style="width: {item.completion_percentage || 0}%"></div>
								</div>
								<span class="text-xs text-gray-500">{item.completion_percentage || 0}%</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
			<p class="text-gray-500 dark:text-gray-400">No POA&M items found.</p>
		</div>
	{/if}
</div>
