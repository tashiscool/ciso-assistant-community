<script lang="ts">
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData, ActionData } from './$types';
	import { m } from '$paraglide/messages';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedFramework = $state('');
	let selectedProfileType = $state('custom');
	let profileName = $state('');
	let generateTasks = $state(true);
	let selectedGroups = $state<string[]>([]);

	const breadcrumbs = $derived([
		{ label: m.continuousMonitoring?.() || 'Continuous Monitoring', href: `${base}/continuous-monitoring` },
		{ label: m.setupConmon?.() || 'Setup', href: `${base}/continuous-monitoring/setup` }
	]);

	// Implementation groups based on framework selection
	const implementationGroups = $derived(getImplementationGroups(selectedFramework));

	function getImplementationGroups(frameworkUrn: string): { ref_id: string; name: string; description: string }[] {
		if (!frameworkUrn || data.frameworks.length === 0) return [];

		const framework = data.frameworks.find((f: any) => f.urn === frameworkUrn);
		if (!framework || !framework.implementation_groups_definition) return [];

		return framework.implementation_groups_definition;
	}

	// Profile types
	const profileTypes = [
		{ value: 'fedramp_low', label: 'FedRAMP Low' },
		{ value: 'fedramp_moderate', label: 'FedRAMP Moderate' },
		{ value: 'fedramp_high', label: 'FedRAMP High' },
		{ value: 'iso_27001', label: 'ISO 27001' },
		{ value: 'soc_2', label: 'SOC 2' },
		{ value: 'nist_csf', label: 'NIST CSF' },
		{ value: 'cmmc_l1', label: 'CMMC Level 1' },
		{ value: 'cmmc_l2', label: 'CMMC Level 2' },
		{ value: 'cmmc_l3', label: 'CMMC Level 3' },
		{ value: 'custom', label: 'Custom' }
	];

	// Auto-select profile type based on framework
	$effect(() => {
		if (selectedFramework.includes('fedramp')) {
			if (selectedGroups.includes('L')) selectedProfileType = 'fedramp_low';
			else if (selectedGroups.includes('M')) selectedProfileType = 'fedramp_moderate';
			else if (selectedGroups.includes('H')) selectedProfileType = 'fedramp_high';
		}
	});

	function toggleGroup(refId: string) {
		if (selectedGroups.includes(refId)) {
			selectedGroups = selectedGroups.filter(g => g !== refId);
		} else {
			selectedGroups = [...selectedGroups, refId];
		}
	}
</script>

<svelte:head>
	<title>{m.setupConmon?.() || 'Set Up Continuous Monitoring'}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
			{m.setupConmon?.() || 'Set Up Continuous Monitoring'}
		</h1>
		<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
			{m.setupConmonDescription?.() || 'Configure a new ConMon profile from a framework library'}
		</p>
	</div>

	{#if form?.error}
		<div class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
			<div class="flex">
				<i class="fa-solid fa-exclamation-circle text-red-400 mr-3 mt-0.5"></i>
				<div>
					<h3 class="text-sm font-medium text-red-800">Error</h3>
					<p class="mt-1 text-sm text-red-700">{form.error}</p>
				</div>
			</div>
		</div>
	{/if}

	<form method="POST" use:enhance class="space-y-8 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
		<!-- Step 1: Select Framework -->
		<div class="border-b border-gray-200 dark:border-gray-700 pb-6">
			<h2 class="text-lg font-medium text-gray-900 dark:text-white flex items-center">
				<span class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold mr-3">1</span>
				{m.selectFramework?.() || 'Select Framework'}
			</h2>
			<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
				Choose the continuous monitoring framework that best fits your compliance requirements.
			</p>

			<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each data.frameworks as framework}
					<label
						class="relative flex cursor-pointer rounded-lg border p-4 focus:outline-none
						       {selectedFramework === framework.urn
							? 'border-indigo-600 ring-2 ring-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
							: 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'}"
					>
						<input
							type="radio"
							name="framework_urn"
							value={framework.urn}
							bind:group={selectedFramework}
							class="sr-only"
						/>
						<span class="flex flex-1">
							<span class="flex flex-col">
								<span class="block text-sm font-medium text-gray-900 dark:text-white">
									{framework.name}
								</span>
								<span class="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
									{framework.description?.substring(0, 100)}...
								</span>
								{#if framework.implementation_groups_definition}
									<span class="mt-2 flex flex-wrap gap-1">
										{#each framework.implementation_groups_definition as group}
											<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
												{group.ref_id}
											</span>
										{/each}
									</span>
								{/if}
							</span>
						</span>
						{#if selectedFramework === framework.urn}
							<i class="fa-solid fa-check-circle text-indigo-600 ml-3"></i>
						{/if}
					</label>
				{/each}
			</div>

			{#if data.frameworks.length === 0}
				<div class="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
					<div class="flex">
						<i class="fa-solid fa-exclamation-triangle text-yellow-400 mr-3"></i>
						<div>
							<p class="text-sm text-yellow-700 dark:text-yellow-300">
								No ConMon frameworks found. Please ensure the ConMon Schedule or FedRAMP ConMon Checklist libraries are loaded.
							</p>
							<a href="{base}/libraries" class="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-500">
								Go to Libraries <i class="fa-solid fa-arrow-right ml-1"></i>
							</a>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Step 2: Select Implementation Groups -->
		{#if implementationGroups.length > 0}
			<div class="border-b border-gray-200 dark:border-gray-700 pb-6">
				<h2 class="text-lg font-medium text-gray-900 dark:text-white flex items-center">
					<span class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold mr-3">2</span>
					{m.implementationGroups?.() || 'Select Implementation Groups'}
				</h2>
				<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
					Choose which implementation levels apply to your organization.
				</p>

				<div class="mt-4 space-y-3">
					{#each implementationGroups as group}
						<label
							class="relative flex items-start p-4 rounded-lg border cursor-pointer
							       {selectedGroups.includes(group.ref_id)
								? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
								: 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'}"
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center">
									<input
										type="checkbox"
										name="implementation_groups"
										value={group.ref_id}
										checked={selectedGroups.includes(group.ref_id)}
										on:change={() => toggleGroup(group.ref_id)}
										class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
									/>
									<span class="ml-3 text-sm font-medium text-gray-900 dark:text-white">
										{group.ref_id} - {group.name}
									</span>
								</div>
								<p class="ml-7 mt-1 text-sm text-gray-500 dark:text-gray-400">
									{group.description}
								</p>
							</div>
						</label>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Step 3: Profile Details -->
		<div class="border-b border-gray-200 dark:border-gray-700 pb-6">
			<h2 class="text-lg font-medium text-gray-900 dark:text-white flex items-center">
				<span class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold mr-3">{implementationGroups.length > 0 ? '3' : '2'}</span>
				{m.profile?.() || 'Profile Details'}
			</h2>

			<div class="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div>
					<label for="profile_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{m.name?.() || 'Profile Name'} *
					</label>
					<input
						type="text"
						id="profile_name"
						name="profile_name"
						required
						bind:value={profileName}
						placeholder="e.g., Production System ConMon"
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
					/>
				</div>

				<div>
					<label for="profile_type" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{m.profileType?.() || 'Profile Type'}
					</label>
					<select
						id="profile_type"
						name="profile_type"
						bind:value={selectedProfileType}
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
					>
						{#each profileTypes as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<!-- Step 4: Task Generation -->
		<div class="pb-6">
			<h2 class="text-lg font-medium text-gray-900 dark:text-white flex items-center">
				<span class="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold mr-3">{implementationGroups.length > 0 ? '4' : '3'}</span>
				{m.generateTasks?.() || 'Task Generation'}
			</h2>
			<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
				{m.generateTasksDescription?.() || 'Automatically create task templates and scheduled tasks for each activity.'}
			</p>

			<div class="mt-4">
				<label class="relative flex items-start">
					<div class="flex items-center h-5">
						<input
							type="checkbox"
							name="generate_tasks"
							bind:checked={generateTasks}
							class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
						/>
					</div>
					<div class="ml-3">
						<span class="text-sm font-medium text-gray-900 dark:text-white">
							{m.generateTasks?.() || 'Generate Task Templates'}
						</span>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							Creates TaskTemplates with recurring schedules and initial TaskNodes for tracking.
						</p>
					</div>
				</label>
			</div>
		</div>

		<!-- Summary -->
		{#if selectedFramework && profileName}
			<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
				<h3 class="text-sm font-medium text-gray-900 dark:text-white">Summary</h3>
				<dl class="mt-2 text-sm text-gray-600 dark:text-gray-300 space-y-1">
					<div class="flex justify-between">
						<dt>Framework:</dt>
						<dd class="font-medium">{data.frameworks.find((f: any) => f.urn === selectedFramework)?.name}</dd>
					</div>
					<div class="flex justify-between">
						<dt>Profile Name:</dt>
						<dd class="font-medium">{profileName}</dd>
					</div>
					<div class="flex justify-between">
						<dt>Profile Type:</dt>
						<dd class="font-medium">{profileTypes.find(t => t.value === selectedProfileType)?.label}</dd>
					</div>
					{#if selectedGroups.length > 0}
						<div class="flex justify-between">
							<dt>Implementation Groups:</dt>
							<dd class="font-medium">{selectedGroups.join(', ')}</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt>Generate Tasks:</dt>
						<dd class="font-medium">{generateTasks ? 'Yes' : 'No'}</dd>
					</div>
				</dl>
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex justify-end gap-4">
			<a
				href="{base}/continuous-monitoring"
				class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
			>
				{m.cancel?.() || 'Cancel'}
			</a>
			<button
				type="submit"
				disabled={!selectedFramework || !profileName}
				class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<i class="fa-solid fa-check mr-2"></i>
				{m.create?.() || 'Create Profile'}
			</button>
		</div>
	</form>
</div>
