<script lang="ts">
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const breadcrumbs = $derived([
		{ label: 'Business Continuity', href: `${base}/business-continuity` },
		{ label: 'Tests', href: `${base}/business-continuity/tests` },
		{ label: 'Schedule Test', href: '' }
	]);
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
	<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Schedule BCP Test</h1>

	{#if form?.error}
		<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
			{form.error}
		</div>
	{/if}

	<form method="POST" use:enhance class="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
		<div>
			<label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Name</label>
			<input
				id="name"
				name="name"
				type="text"
				required
				class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="e.g., Q1 2026 Disaster Recovery Exercise"
			/>
		</div>

		<div>
			<label for="bcp_id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Related BCP Plan</label>
			<select
				id="bcp_id"
				name="bcp_id"
				class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
			>
				<option value="">Select a plan...</option>
				{#each data.plans as plan}
					<option value={plan.id}>{plan.plan_name || plan.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
			<textarea
				id="description"
				name="description"
				rows="4"
				class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
				placeholder="Describe the test objectives and scope..."
			></textarea>
		</div>

		<div class="flex justify-end gap-3">
			<a href={`${base}/business-continuity/tests`}
				class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600">
				Cancel
			</a>
			<button type="submit"
				class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
				Schedule Test
			</button>
		</div>
	</form>
</div>
