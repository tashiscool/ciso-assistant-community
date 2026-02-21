<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { BASE_API_URL } from '$lib/utils/constants';
	import type { PageData } from './$types';
	import type { LightningAssessmentData } from '$lib/components/Assessment';

	let { data }: { data: PageData } = $props();

	let assessments = $state<LightningAssessmentData[]>(data.assessments || []);
	let creating = $state(false);
	let newName = $state('');
	let showCreateModal = $state(false);
	let createError = $state('');

	const statusColors: Record<string, string> = {
		draft: 'bg-gray-100 text-gray-800',
		in_progress: 'bg-blue-100 text-blue-800',
		paused: 'bg-yellow-100 text-yellow-800',
		completed: 'bg-green-100 text-green-800',
		archived: 'bg-gray-100 text-gray-500'
	};

	const statusIcons: Record<string, string> = {
		draft: 'fa-file',
		in_progress: 'fa-bolt',
		paused: 'fa-pause',
		completed: 'fa-check-circle',
		archived: 'fa-archive'
	};

	async function createAssessment() {
		if (!newName.trim()) {
			createError = 'Assessment name is required.';
			return;
		}
		creating = true;
		createError = '';
		try {
			const res = await fetch(`${BASE_API_URL}/assessments/lightning/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName.trim() })
			});
			if (res.ok) {
				const created = await res.json();
				showCreateModal = false;
				newName = '';
				await goto(`${base}/assessments/lightning/${created.id}`);
			} else {
				const err = await res.json();
				createError = err.detail || err.error || 'Failed to create assessment.';
			}
		} catch {
			createError = 'Network error. Please try again.';
		} finally {
			creating = false;
		}
	}

	async function startAssessment(id: string) {
		try {
			const res = await fetch(`${BASE_API_URL}/assessments/lightning/${id}/start/`, {
				method: 'POST'
			});
			if (res.ok) {
				const updated = await res.json();
				assessments = assessments.map((a) => (a.id === id ? { ...a, ...updated } : a));
			}
		} catch {
			console.error('Failed to start assessment');
		}
	}

	function formatDate(dateStr?: string): string {
		if (!dateStr) return '—';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function progressColor(score: number): string {
		if (score >= 80) return 'bg-green-500';
		if (score >= 50) return 'bg-yellow-500';
		return 'bg-red-500';
	}
</script>

<svelte:head>
	<title>Lightning Assessments</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8 flex justify-between items-start">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
				<i class="fa-solid fa-bolt text-yellow-500 mr-3"></i>
				Lightning Assessments
			</h1>
			<p class="mt-2 text-gray-600 dark:text-gray-400">
				Rapid control testing with automated test case generation and bulk result recording.
			</p>
		</div>
		<button
			class="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 shadow-sm"
			onclick={() => (showCreateModal = true)}
		>
			<i class="fa-solid fa-plus mr-2"></i>
			New Assessment
		</button>
	</div>

	<!-- Stats -->
	{#if assessments.length > 0}
		{@const active = assessments.filter((a) => a.status === 'in_progress').length}
		{@const done = assessments.filter((a) => a.status === 'completed').length}
		<div class="grid grid-cols-3 gap-6 mb-8">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center gap-4">
				<div class="p-3 rounded-full bg-blue-100"><i class="fa-solid fa-list text-blue-600 text-xl"></i></div>
				<div>
					<p class="text-sm text-gray-500">Total</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{assessments.length}</p>
				</div>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center gap-4">
				<div class="p-3 rounded-full bg-yellow-100"><i class="fa-solid fa-bolt text-yellow-600 text-xl"></i></div>
				<div>
					<p class="text-sm text-gray-500">In Progress</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{active}</p>
				</div>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center gap-4">
				<div class="p-3 rounded-full bg-green-100"><i class="fa-solid fa-check-circle text-green-600 text-xl"></i></div>
				<div>
					<p class="text-sm text-gray-500">Completed</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{done}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Assessment List -->
	{#if assessments.length === 0}
		<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow">
			<i class="fa-solid fa-bolt text-6xl text-gray-300 mb-4"></i>
			<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No assessments yet</h3>
			<p class="text-gray-500 mb-6">Create a lightning assessment to rapidly evaluate control effectiveness.</p>
			<button
				class="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
				onclick={() => (showCreateModal = true)}
			>
				<i class="fa-solid fa-plus mr-2"></i>
				Create First Assessment
			</button>
		</div>
	{:else}
		<div class="space-y-4">
			{#each assessments as assessment}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
					<div class="p-6">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-3 mb-1">
									<a
										href="{base}/assessments/lightning/{assessment.id}"
										class="text-lg font-semibold text-gray-900 dark:text-white hover:text-primary-600"
									>
										{assessment.name}
									</a>
									<span class="px-2 py-0.5 text-xs font-medium rounded-full {statusColors[assessment.status] || 'bg-gray-100 text-gray-700'}">
										<i class="fa-solid {statusIcons[assessment.status] || 'fa-file'} mr-1"></i>
										{assessment.status.replace('_', ' ')}
									</span>
								</div>
								{#if assessment.description}
									<p class="text-sm text-gray-500 mb-3">{assessment.description}</p>
								{/if}
								<div class="flex items-center gap-6 text-sm text-gray-500">
									<span><i class="fa-solid fa-shield-halved mr-1"></i>{assessment.totalControls} controls</span>
									<span><i class="fa-solid fa-check mr-1"></i>{assessment.testedControls} tested</span>
									{#if assessment.startedAt}
										<span><i class="fa-solid fa-calendar mr-1"></i>Started {formatDate(assessment.startedAt)}</span>
									{/if}
								</div>
							</div>

							<div class="ml-6 text-right">
								<div class="text-sm text-gray-500 mb-1">Compliance Score</div>
								<div class="text-2xl font-bold {assessment.complianceScore >= 80 ? 'text-green-600' : assessment.complianceScore >= 50 ? 'text-yellow-600' : 'text-red-600'}">
									{assessment.complianceScore?.toFixed(0) ?? '—'}%
								</div>
								<div class="w-24 h-2 bg-gray-200 rounded-full mt-2 ml-auto">
									<div class="h-2 rounded-full {progressColor(assessment.complianceScore)}" style="width:{Math.min(100,assessment.complianceScore||0)}%"></div>
								</div>
							</div>
						</div>

						<div class="mt-4 flex gap-3">
							{#if assessment.status === 'draft'}
								<button
									class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
									onclick={() => startAssessment(assessment.id)}
								>
									<i class="fa-solid fa-play mr-1"></i>Start
								</button>
							{/if}
							<a
								href="{base}/assessments/lightning/{assessment.id}"
								class="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
							>
								<i class="fa-solid fa-arrow-right mr-1"></i>Open
							</a>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">New Lightning Assessment</h3>
				<button onclick={() => (showCreateModal = false)} class="text-gray-400 hover:text-gray-600">
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="p-6 space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
					<input
						type="text"
						bind:value={newName}
						placeholder="e.g. FedRAMP Moderate Q1 Assessment"
						class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
				{#if createError}
					<p class="text-sm text-red-600">{createError}</p>
				{/if}
			</div>
			<div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3 rounded-b-lg">
				<button
					class="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:border-gray-600"
					onclick={() => (showCreateModal = false)}
				>Cancel</button>
				<button
					class="px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={createAssessment}
					disabled={creating}
				>
					{#if creating}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
					{/if}
					Create Assessment
				</button>
			</div>
		</div>
	</div>
{/if}
