<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { BASE_API_URL } from '$lib/utils/constants';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let assessment = $state(data.assessment);
	let actionLoading = $state<string | null>(null);
	let actionError = $state('');

	const statusColors: Record<string, string> = {
		draft: 'bg-gray-100 text-gray-800',
		in_progress: 'bg-blue-100 text-blue-800',
		paused: 'bg-yellow-100 text-yellow-800',
		completed: 'bg-green-100 text-green-800',
		archived: 'bg-gray-100 text-gray-500'
	};

	function progressColor(score: number): string {
		if (score >= 80) return 'bg-green-500';
		if (score >= 50) return 'bg-yellow-500';
		return 'bg-red-500';
	}

	function formatDate(d?: string | null): string {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
	}

	async function performAction(action: string) {
		actionLoading = action;
		actionError = '';
		try {
			const res = await fetch(
				`${BASE_API_URL}/assessments/lightning/${assessment.id}/${action}/`,
				{ method: 'POST' }
			);
			if (res.ok) {
				const updated = await res.json();
				assessment = { ...assessment, ...updated };
			} else {
				const err = await res.json();
				actionError = err.error || err.detail || `Failed to ${action} assessment.`;
			}
		} catch {
			actionError = 'Network error. Please try again.';
		} finally {
			actionLoading = null;
		}
	}

	async function deleteAssessment() {
		if (!confirm('Delete this assessment? This cannot be undone.')) return;
		try {
			const res = await fetch(
				`${BASE_API_URL}/assessments/lightning/${assessment.id}/`,
				{ method: 'DELETE' }
			);
			if (res.ok) {
				goto(`${base}/assessments/lightning`);
			}
		} catch {
			actionError = 'Failed to delete assessment.';
		}
	}
</script>

<svelte:head>
	<title>{assessment.name} — Lightning Assessment</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Breadcrumb -->
	<nav class="text-sm text-gray-500 mb-6">
		<a href="{base}/assessments/lightning" class="hover:text-primary-600">Lightning Assessments</a>
		<span class="mx-2">/</span>
		<span class="text-gray-900 dark:text-white">{assessment.name}</span>
	</nav>

	<!-- Header -->
	<div class="flex items-start justify-between mb-8">
		<div>
			<div class="flex items-center gap-3 mb-2">
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{assessment.name}</h1>
				<span class="px-2 py-0.5 text-xs font-medium rounded-full {statusColors[assessment.status] || 'bg-gray-100 text-gray-700'}">
					{assessment.status.replace('_', ' ')}
				</span>
			</div>
			{#if assessment.description}
				<p class="text-gray-600 dark:text-gray-400">{assessment.description}</p>
			{/if}
		</div>

		<!-- Action buttons -->
		<div class="flex gap-2 ml-4">
			{#if assessment.status === 'draft'}
				<button
					class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
					onclick={() => performAction('start')}
					disabled={actionLoading === 'start'}
				>
					{#if actionLoading === 'start'}<i class="fa-solid fa-spinner fa-spin mr-1"></i>{/if}
					<i class="fa-solid fa-play mr-1"></i>Start
				</button>
			{:else if assessment.status === 'in_progress'}
				<button
					class="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
					onclick={() => performAction('pause')}
					disabled={actionLoading === 'pause'}
				>
					{#if actionLoading === 'pause'}<i class="fa-solid fa-spinner fa-spin mr-1"></i>{/if}
					<i class="fa-solid fa-pause mr-1"></i>Pause
				</button>
				<button
					class="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
					onclick={() => performAction('complete')}
					disabled={actionLoading === 'complete'}
				>
					{#if actionLoading === 'complete'}<i class="fa-solid fa-spinner fa-spin mr-1"></i>{/if}
					<i class="fa-solid fa-check mr-1"></i>Complete
				</button>
			{:else if assessment.status === 'paused'}
				<button
					class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
					onclick={() => performAction('resume')}
					disabled={actionLoading === 'resume'}
				>
					{#if actionLoading === 'resume'}<i class="fa-solid fa-spinner fa-spin mr-1"></i>{/if}
					<i class="fa-solid fa-play mr-1"></i>Resume
				</button>
			{/if}
			<button
				class="px-3 py-1.5 text-sm border border-red-200 text-red-700 rounded hover:bg-red-50"
				onclick={deleteAssessment}
			>
				<i class="fa-solid fa-trash mr-1"></i>Delete
			</button>
		</div>
	</div>

	{#if actionError}
		<div class="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
			<p class="text-sm text-red-700">{actionError}</p>
		</div>
	{/if}

	<!-- Stats grid -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
			<p class="text-xs text-gray-500 uppercase mb-1">Compliance Score</p>
			<p class="text-3xl font-bold {(assessment.compliance_score ?? 0) >= 80 ? 'text-green-600' : (assessment.compliance_score ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}">
				{assessment.compliance_score?.toFixed(0) ?? '—'}%
			</p>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
			<p class="text-xs text-gray-500 uppercase mb-1">Progress</p>
			<p class="text-3xl font-bold text-gray-900 dark:text-white">
				{assessment.progress_percentage?.toFixed(0) ?? 0}%
			</p>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
			<p class="text-xs text-gray-500 uppercase mb-1">Tested</p>
			<p class="text-3xl font-bold text-gray-900 dark:text-white">
				{assessment.tested_controls ?? 0}<span class="text-sm text-gray-500"> / {assessment.total_controls ?? 0}</span>
			</p>
		</div>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
			<p class="text-xs text-gray-500 uppercase mb-1">Passed</p>
			<p class="text-3xl font-bold text-green-600">{assessment.passed_controls ?? 0}</p>
		</div>
	</div>

	<!-- Progress bar -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
		<div class="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
			<span>Overall Progress</span>
			<span>{assessment.progress_percentage?.toFixed(0) ?? 0}%</span>
		</div>
		<div class="w-full h-3 bg-gray-200 rounded-full">
			<div
				class="h-3 rounded-full transition-all {progressColor(assessment.compliance_score ?? 0)}"
				style="width:{Math.min(100, assessment.progress_percentage ?? 0)}%"
			></div>
		</div>
	</div>

	<!-- Details -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
		<h2 class="text-base font-semibold text-gray-900 dark:text-white mb-4">Assessment Details</h2>
		<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
			<div>
				<dt class="text-gray-500">Scoring Method</dt>
				<dd class="font-medium text-gray-900 dark:text-white capitalize">{assessment.scoring_method?.replace('_', ' ') ?? '—'}</dd>
			</div>
			<div>
				<dt class="text-gray-500">Started</dt>
				<dd class="font-medium text-gray-900 dark:text-white">{formatDate(assessment.started_at)}</dd>
			</div>
			<div>
				<dt class="text-gray-500">Completed</dt>
				<dd class="font-medium text-gray-900 dark:text-white">{formatDate(assessment.completed_at)}</dd>
			</div>
			<div>
				<dt class="text-gray-500">Target Completion</dt>
				<dd class="font-medium text-gray-900 dark:text-white">{formatDate(assessment.target_completion)}</dd>
			</div>
			<div>
				<dt class="text-gray-500">Failed Controls</dt>
				<dd class="font-medium text-red-600">{assessment.failed_controls ?? 0}</dd>
			</div>
			<div>
				<dt class="text-gray-500">Not Applicable</dt>
				<dd class="font-medium text-gray-900 dark:text-white">{assessment.not_applicable ?? 0}</dd>
			</div>
		</dl>
	</div>

	<!-- Results summary -->
	{#if assessment.results_summary}
		<div class="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h2 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Results Summary</h2>
			<div class="bg-gray-900 rounded p-3 overflow-auto max-h-48">
				<pre class="text-green-400 text-xs"><code>{JSON.stringify(assessment.results_summary, null, 2)}</code></pre>
			</div>
		</div>
	{/if}
</div>
