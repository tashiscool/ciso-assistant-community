<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';
	import type {
		ArtifactPackageDetail,
		ArtifactRequestItem,
		EvidenceSchedule,
		PeriodicityBreakdown
	} from '$lib/services/assessment-artifacts/api';
	import { CONTROL_FAMILY_DOMAINS } from '$lib/services/assessment-artifacts/builder';

	let { data } = $props();
	let pkg = $state<ArtifactPackageDetail | null>(data.package);

	// Tab state
	let activeTab = $state<'items' | 'schedules' | 'playbooks' | 'quality'>('items');

	// Filter state for items tab
	let filterFamily = $state('');
	let filterPeriodicity = $state('');
	let filterPlatform = $state('');
	let filterQuery = $state('');

	// Periodicity breakdown (lazy-loaded)
	let periodicityData = $state<PeriodicityBreakdown | null>(null);
	let loadingBreakdown = $state(false);

	// Schedule generation
	let generatingSchedules = $state(false);

	let filteredItems = $derived.by(() => {
		if (!pkg?.request_items) return [];
		let items = pkg.request_items;
		if (filterFamily) {
			items = items.filter((i) => i.control_families.includes(filterFamily));
		}
		if (filterPeriodicity) {
			items = items.filter((i) => i.periodicity === filterPeriodicity);
		}
		if (filterPlatform) {
			items = items.filter((i) => i.platform_tags.includes(filterPlatform));
		}
		const query = filterQuery.trim().toLowerCase();
		if (query) {
			items = items.filter((i) => {
				if (i.request_id.toLowerCase().includes(query)) return true;
				if (i.artifact_request.toLowerCase().includes(query)) return true;
				if (i.controls.some((control) => control.toLowerCase().includes(query))) return true;
				if (i.control_families.some((family) => family.toLowerCase().includes(query))) return true;
				if (i.platform_tags.some((tag) => tag.toLowerCase().includes(query))) return true;
				return false;
			});
		}
		return items;
	});

	let allFamilies = $derived(
		pkg?.request_items
			? [...new Set(pkg.request_items.flatMap((i) => i.control_families))].sort()
			: []
	);

	let allPeriodicities = $derived(
		pkg?.request_items
			? [...new Set(pkg.request_items.map((i) => i.periodicity))].sort()
			: []
	);

	let allPlatforms = $derived(
		pkg?.request_items
			? [...new Set(pkg.request_items.flatMap((i) => i.platform_tags))].sort()
			: []
	);

	const frequencyOrder = ['weekly', 'monthly', 'quarterly', 'semi_annual', 'annual'];
	let schedulesByFrequency = $derived.by(() => {
		const groups: Record<string, EvidenceSchedule[]> = {};
		for (const key of frequencyOrder) {
			groups[key] = [];
		}
		if (!pkg?.evidence_schedules) return groups;
		for (const schedule of pkg.evidence_schedules) {
			const key = schedule.frequency;
			if (!(key in groups)) groups[key] = [];
			groups[key].push(schedule);
		}
		for (const key of Object.keys(groups)) {
			groups[key].sort((a, b) => a.name.localeCompare(b.name));
		}
		return groups;
	});

	async function loadPeriodicityBreakdown() {
		if (!pkg || periodicityData) return;
		loadingBreakdown = true;
		try {
			const res = await fetch(
				`${BASE_API_URL}/assessment-artifacts/packages/${pkg.id}/periodicity_breakdown/`
			);
			if (res.ok) {
				periodicityData = await res.json();
			}
		} finally {
			loadingBreakdown = false;
		}
	}

	async function generateSchedules() {
		if (!pkg) return;
		generatingSchedules = true;
		try {
			const res = await fetch(
				`${BASE_API_URL}/assessment-artifacts/packages/${pkg.id}/generate_schedules/`,
				{ method: 'POST' }
			);
			if (res.ok) {
				const schedules = await res.json();
				pkg.evidence_schedules = Array.isArray(schedules) ? schedules : schedules?.results ?? [];
				activeTab = 'schedules';
			}
		} finally {
			generatingSchedules = false;
		}
	}

	async function pauseSchedule(scheduleId: string) {
		const res = await fetch(
			`${BASE_API_URL}/assessment-artifacts/schedules/${scheduleId}/pause/`,
			{ method: 'POST' }
		);
		if (res.ok && pkg) {
			const updated = await res.json();
			pkg.evidence_schedules = pkg.evidence_schedules.map((s) =>
				s.id === scheduleId ? { ...s, ...updated } : s
			);
		}
	}

	async function resumeSchedule(scheduleId: string) {
		const res = await fetch(
			`${BASE_API_URL}/assessment-artifacts/schedules/${scheduleId}/resume/`,
			{ method: 'POST' }
		);
		if (res.ok && pkg) {
			const updated = await res.json();
			pkg.evidence_schedules = pkg.evidence_schedules.map((s) =>
				s.id === scheduleId ? { ...s, ...updated } : s
			);
		}
	}

	function exportJson() {
		if (!pkg) return;
		window.open(`${BASE_API_URL}/assessment-artifacts/packages/${pkg.id}/export_json/`, '_blank');
	}

	const statusColors: Record<string, string> = {
		draft: 'bg-yellow-100 text-yellow-800',
		active: 'bg-green-100 text-green-800',
		archived: 'bg-gray-100 text-gray-800',
		paused: 'bg-orange-100 text-orange-800'
	};

	const periodicityColors: Record<string, string> = {
		weekly: 'bg-blue-100 text-blue-800',
		monthly: 'bg-purple-100 text-purple-800',
		quarterly: 'bg-teal-100 text-teal-800',
		semi_annual: 'bg-indigo-100 text-indigo-800',
		annual: 'bg-pink-100 text-pink-800',
		on_demand: 'bg-gray-100 text-gray-700',
		event_driven: 'bg-yellow-100 text-yellow-800',
		continuous: 'bg-green-100 text-green-800'
	};

	const periodicityLabels: Record<string, string> = {
		weekly: 'Weekly',
		monthly: 'Monthly',
		quarterly: 'Quarterly',
		semi_annual: 'Semi-Annual',
		annual: 'Annual',
		on_demand: 'On Demand',
		event_driven: 'Event-Driven',
		continuous: 'Continuous'
	};
</script>

{#if !pkg}
	<div class="p-6">
		<p class="text-gray-500">Package not found.</p>
		<a href="/assessment-artifacts" class="text-indigo-600 hover:underline">Back to packages</a>
	</div>
{:else}
	<div class="space-y-6 p-6">
		<!-- Header -->
		<div class="flex items-start justify-between">
			<div>
				<a href="/assessment-artifacts" class="text-sm text-gray-500 hover:text-gray-700">
					&larr; Back to packages
				</a>
				<h1 class="mt-1 text-2xl font-bold">{pkg.name}</h1>
				<div class="mt-1 flex items-center gap-3 text-sm text-gray-500">
					<span class="rounded px-2 py-0.5 text-xs font-medium {statusColors[pkg.status]}">
						{pkg.status_display ?? pkg.status}
					</span>
					<span>{pkg.package_type_display ?? pkg.package_type}</span>
					{#if pkg.system_name}
						<span>| {pkg.system_name}</span>
					{/if}
				</div>
			</div>
			<div class="flex gap-2">
				<button
					class="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
					onclick={exportJson}
				>
					Export JSON
				</button>
				<button
					class="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
					onclick={generateSchedules}
					disabled={generatingSchedules}
				>
					{generatingSchedules ? 'Generating...' : 'Regenerate Schedules'}
				</button>
			</div>
		</div>

		<!-- Stats cards -->
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
			<div class="rounded-lg border bg-white p-4 text-center">
				<div class="text-2xl font-bold">{pkg.stats?.total_requests ?? pkg.request_items?.length ?? 0}</div>
				<div class="text-xs text-gray-500">Total Requests</div>
			</div>
			<div class="rounded-lg border bg-white p-4 text-center">
				<div class="text-2xl font-bold">{pkg.stats?.unique_controls ?? 0}</div>
				<div class="text-xs text-gray-500">Unique Controls</div>
			</div>
			<div class="rounded-lg border bg-white p-4 text-center">
				<div class="text-2xl font-bold">{pkg.evidence_schedules?.length ?? 0}</div>
				<div class="text-xs text-gray-500">Schedules</div>
			</div>
			<div class="rounded-lg border bg-white p-4 text-center">
				<div class="text-2xl font-bold">{pkg.stats?.unique_platform_tags ?? 0}</div>
				<div class="text-xs text-gray-500">Platforms</div>
			</div>
			<div class="rounded-lg border bg-white p-4 text-center">
				<div class="text-2xl font-bold {pkg.quality_report?.quality_gate === 'pass' ? 'text-green-600' : 'text-yellow-600'}">
					{pkg.quality_report?.quality_gate ?? 'N/A'}
				</div>
				<div class="text-xs text-gray-500">Quality Gate</div>
			</div>
			<div class="rounded-lg border bg-white p-4 text-center">
				<div class="text-2xl font-bold">{Object.keys(pkg.stats?.periodicity_breakdown ?? {}).length}</div>
				<div class="text-xs text-gray-500">Frequencies</div>
			</div>
		</div>

		<!-- Periodicity summary chips -->
		{#if pkg.stats?.periodicity_breakdown}
			<div class="flex flex-wrap gap-2">
				{#each Object.entries(pkg.stats.periodicity_breakdown) as [period, count]}
					<span class="rounded-full px-3 py-1 text-sm font-medium {periodicityColors[period] ?? 'bg-gray-100'}">
						{periodicityLabels[period] ?? period}: {count} items
					</span>
				{/each}
			</div>
		{/if}

		<!-- Tab navigation -->
		<div class="border-b">
			<nav class="flex gap-6">
				{#each [
					{ key: 'items', label: `Request Items (${pkg.request_items?.length ?? 0})` },
					{ key: 'schedules', label: `Schedules (${pkg.evidence_schedules?.length ?? 0})` },
					{ key: 'playbooks', label: 'Collection Playbooks' },
					{ key: 'quality', label: `Quality (${pkg.quality_report?.issues?.length ?? 0} issues)` }
				] as tab}
					<button
						class="border-b-2 px-1 pb-2 text-sm font-medium transition-colors
							{activeTab === tab.key
							? 'border-indigo-600 text-indigo-600'
							: 'border-transparent text-gray-500 hover:text-gray-700'}"
						onclick={() => {
							activeTab = tab.key as typeof activeTab;
							if (tab.key === 'items') loadPeriodicityBreakdown();
						}}
					>
						{tab.label}
					</button>
				{/each}
			</nav>
		</div>

		<!-- Tab content -->
		{#if activeTab === 'items'}
			<!-- Filters -->
			<div class="flex flex-wrap gap-3">
				<input
					type="text"
					placeholder="Search request text, control, family, platform..."
					class="min-w-[280px] flex-1 rounded border px-3 py-1.5 text-sm"
					bind:value={filterQuery}
				/>
				<select class="rounded border px-3 py-1.5 text-sm" bind:value={filterFamily}>
					<option value="">All Families</option>
					{#each allFamilies as fam}
						<option value={fam}>{fam} — {CONTROL_FAMILY_DOMAINS[fam] ?? fam}</option>
					{/each}
				</select>
				<select class="rounded border px-3 py-1.5 text-sm" bind:value={filterPeriodicity}>
					<option value="">All Frequencies</option>
					{#each allPeriodicities as p}
						<option value={p}>{periodicityLabels[p] ?? p}</option>
					{/each}
				</select>
				<select class="rounded border px-3 py-1.5 text-sm" bind:value={filterPlatform}>
					<option value="">All Platforms</option>
					{#each allPlatforms as p}
						<option value={p}>{p}</option>
					{/each}
				</select>
				<span class="self-center text-sm text-gray-500">
					{filteredItems.length} of {pkg.request_items?.length ?? 0} items
				</span>
			</div>

			<!-- Items table -->
			<div class="overflow-x-auto rounded-lg border">
				<table class="min-w-full text-sm">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-3 py-2 text-left font-medium">ID</th>
							<th class="px-3 py-2 text-left font-medium">Controls</th>
							<th class="px-3 py-2 text-left font-medium">Request</th>
							<th class="px-3 py-2 text-left font-medium">Type</th>
							<th class="px-3 py-2 text-left font-medium">Frequency</th>
							<th class="px-3 py-2 text-left font-medium">Platform</th>
							<th class="px-3 py-2 text-left font-medium">Channel</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredItems as item}
							<tr class="border-t hover:bg-gray-50">
								<td class="px-3 py-2 font-mono text-xs">{item.request_id}</td>
								<td class="max-w-[200px] px-3 py-2">
									<div class="flex flex-wrap gap-1">
										{#each item.controls.slice(0, 5) as ctrl}
											<span class="rounded bg-blue-50 px-1.5 py-0.5 text-xs">{ctrl}</span>
										{/each}
										{#if item.controls.length > 5}
											<span class="text-xs text-gray-400">+{item.controls.length - 5}</span>
										{/if}
									</div>
								</td>
								<td class="max-w-[300px] truncate px-3 py-2" title={item.artifact_request}>
									{item.artifact_request.slice(0, 100)}{item.artifact_request.length > 100 ? '...' : ''}
								</td>
								<td class="px-3 py-2 text-xs">{item.primary_artifact_type.replace(/_/g, ' ')}</td>
								<td class="px-3 py-2">
									<span class="rounded px-2 py-0.5 text-xs {periodicityColors[item.periodicity] ?? 'bg-gray-100'}">
										{periodicityLabels[item.periodicity] ?? item.periodicity}
									</span>
								</td>
								<td class="px-3 py-2">
									<div class="flex flex-wrap gap-1">
										{#each item.platform_tags.slice(0, 3) as tag}
											<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{tag}</span>
										{/each}
									</div>
								</td>
								<td class="px-3 py-2 text-xs">{item.collection_channel.replace(/_/g, ' ')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

		{:else if activeTab === 'schedules'}
			{#if !pkg.evidence_schedules?.length}
				<div class="rounded-lg border bg-white p-8 text-center">
					<p class="text-gray-500">No schedules generated yet.</p>
					<button
						class="mt-3 rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
						onclick={generateSchedules}
					>
						Generate Schedules
					</button>
				</div>
				{:else}
					<div class="space-y-6">
						{#each Object.entries(schedulesByFrequency) as [frequencyKey, schedules]}
							{#if schedules.length}
								<section class="space-y-3">
									<div class="flex items-center gap-2">
										<span class="rounded px-2 py-0.5 text-xs font-medium {periodicityColors[frequencyKey] ?? 'bg-gray-100'}">
											{periodicityLabels[frequencyKey] ?? frequencyKey}
										</span>
										<h3 class="text-sm font-semibold text-gray-700">
											{schedules.length} schedule{schedules.length === 1 ? '' : 's'}
										</h3>
									</div>
									<div class="grid gap-4">
										{#each schedules as schedule}
											<div class="rounded-lg border bg-white p-5 shadow-sm">
												<div class="flex items-start justify-between">
													<div>
														<h4 class="font-semibold">{schedule.name}</h4>
														<p class="mt-1 text-sm text-gray-500">{schedule.description}</p>
													</div>
													<div class="flex items-center gap-2">
														<span class="rounded px-2 py-0.5 text-xs font-medium {statusColors[schedule.status]}">
															{schedule.status_display ?? schedule.status}
														</span>
														{#if schedule.status === 'active'}
															<button
																class="rounded border px-2 py-1 text-xs hover:bg-gray-50"
																onclick={() => pauseSchedule(schedule.id)}
															>
																Pause
															</button>
														{:else if schedule.status === 'paused'}
															<button
																class="rounded border border-green-200 px-2 py-1 text-xs text-green-600 hover:bg-green-50"
																onclick={() => resumeSchedule(schedule.id)}
															>
																Resume
															</button>
														{/if}
													</div>
												</div>

												<div class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
													<div>
														<span class="text-gray-500">Frequency:</span>
														<span class="ml-1 font-medium">{schedule.frequency_display ?? schedule.frequency}</span>
													</div>
													<div>
														<span class="text-gray-500">Cron:</span>
														<span class="ml-1 font-mono text-xs">{schedule.cron_expression}</span>
													</div>
													<div>
														<span class="text-gray-500">Items:</span>
														<span class="ml-1 font-medium">{schedule.items_count}</span>
													</div>
													<div>
														<span class="text-gray-500">Controls:</span>
														<span class="ml-1 font-medium">{schedule.controls?.length ?? 0}</span>
													</div>
												</div>

												{#if schedule.control_families?.length}
													<div class="mt-2 flex flex-wrap gap-1">
														{#each schedule.control_families as fam}
															<span class="rounded bg-blue-50 px-2 py-0.5 text-xs" title={CONTROL_FAMILY_DOMAINS[fam] ?? ''}>
																{fam}
															</span>
														{/each}
													</div>
												{/if}

												{#if schedule.collection_actions?.length}
													<div class="mt-3 rounded bg-gray-50 p-3 text-xs">
														<strong>Collection actions:</strong>
														{#each schedule.collection_actions as action}
															<div class="mt-1">
																{#if action.channel === 'cli_commands' && action.commands}
																	<span class="font-medium">CLI Commands:</span>
																	{#each action.commands.slice(0, 3) as cmd}
																		<code class="ml-2 block rounded bg-gray-200 px-2 py-0.5 font-mono">{cmd}</code>
																	{/each}
																	{#if action.commands.length > 3}
																		<span class="ml-2 text-gray-400">+{action.commands.length - 3} more</span>
																	{/if}
																{:else}
																	<span class="font-medium">{action.channel?.replace(/_/g, ' ')}:</span>
																	{action.request_count ?? 0} items
																{/if}
															</div>
														{/each}
													</div>
												{/if}
											</div>
										{/each}
									</div>
								</section>
							{/if}
						{/each}
					</div>
				{/if}

		{:else if activeTab === 'playbooks'}
			{#if !pkg.collection_playbooks?.length}
				<p class="text-gray-500">No collection playbooks generated.</p>
			{:else}
				<div class="grid gap-4">
					{#each pkg.collection_playbooks as playbook}
						<div class="rounded-lg border bg-white p-5 shadow-sm">
							<h3 class="font-semibold">{playbook.name}</h3>
							<div class="mt-1 text-sm text-gray-500">
								Platforms: {playbook.applies_to_platform_tags?.join(', ')}
								| Channels: {playbook.required_channels?.join(', ')}
							</div>
							{#if playbook.example_commands?.length}
								<div class="mt-3">
									<strong class="text-sm">Example commands ({playbook.example_commands.length}):</strong>
									<div class="mt-1 max-h-48 overflow-y-auto rounded bg-gray-900 p-3 text-xs text-green-400">
										{#each playbook.example_commands as cmd}
											<div class="font-mono">$ {cmd}</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

		{:else if activeTab === 'quality'}
			{#if !pkg.quality_report?.issues?.length}
				<div class="rounded-lg border bg-green-50 p-6 text-center">
					<div class="text-2xl font-bold text-green-600">PASS</div>
					<p class="mt-1 text-sm text-green-700">No quality issues detected.</p>
				</div>
			{:else}
				<div class="rounded-lg border bg-yellow-50 p-4">
					<div class="font-semibold text-yellow-800">
						{pkg.quality_report.issues.length} quality issues found
					</div>
				</div>
				<div class="mt-4 overflow-x-auto rounded-lg border">
					<table class="min-w-full text-sm">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-3 py-2 text-left font-medium">Request ID</th>
								<th class="px-3 py-2 text-left font-medium">Line</th>
								<th class="px-3 py-2 text-left font-medium">Issue</th>
							</tr>
						</thead>
						<tbody>
							{#each pkg.quality_report.issues as issue}
								<tr class="border-t">
									<td class="px-3 py-2 font-mono text-xs">{issue.request_id}</td>
									<td class="px-3 py-2">{issue.source_line}</td>
									<td class="px-3 py-2">{issue.issue}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</div>
{/if}
