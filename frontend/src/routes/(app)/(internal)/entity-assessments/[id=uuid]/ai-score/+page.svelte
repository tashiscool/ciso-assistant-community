<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let loading = $state(false);

	// Derive score data from form action result
	let scoreData = $derived(form?.success ? form.scoreData : null);
	let errorMessage = $derived(form?.success === false ? form.error : null);

	// Risk rating color and label mappings
	const riskRatingColors: Record<string, { bg: string; text: string; border: string }> = {
		critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
		high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
		medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
		low: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' }
	};

	function getRatingStyle(rating: string) {
		return riskRatingColors[rating] || riskRatingColors['medium'];
	}

	function getScoreColor(score: number): string {
		if (score >= 75) return 'bg-green-500';
		if (score >= 50) return 'bg-yellow-500';
		if (score >= 25) return 'bg-orange-500';
		return 'bg-red-500';
	}

	function getScoreTextColor(score: number): string {
		if (score >= 75) return 'text-green-700';
		if (score >= 50) return 'text-yellow-700';
		if (score >= 25) return 'text-orange-700';
		return 'text-red-700';
	}

	// Find the maximum category score for bar chart scaling
	let maxCategoryScore = $derived(
		scoreData?.category_scores
			? Math.max(...Object.values(scoreData.category_scores as Record<string, number>), 100)
			: 100
	);

	let assessmentName = $derived(
		data.assessment?.name || data.assessment?.entity?.name || 'Vendor Assessment'
	);
</script>

<div class="flex flex-col space-y-6 max-w-6xl mx-auto">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">AI Vendor Risk Scoring</h1>
			<p class="text-sm text-gray-500 mt-1">
				Assessment: {assessmentName}
			</p>
		</div>
		<a
			href="/entity-assessments/{data.assessmentId}"
			class="text-sm text-blue-600 hover:text-blue-800 underline"
		>
			Back to Assessment
		</a>
	</div>

	<!-- Score Action -->
	{#if !scoreData}
		<div class="card bg-white shadow-lg p-6">
			<h2 class="text-lg font-semibold mb-4">Run AI Scoring</h2>
			<p class="text-gray-600 mb-4">
				Click the button below to analyze the vendor questionnaire responses using AI. The
				system will evaluate each answer, compute category scores, and provide strengths,
				weaknesses, and recommendations.
			</p>

			{#if errorMessage}
				<div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
					<p class="text-red-700 text-sm font-medium">Error: {errorMessage}</p>
				</div>
			{/if}

			<form
				method="POST"
				action="?/score"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
			>
				<button
					type="submit"
					disabled={loading}
					class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700
						   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{#if loading}
						<span class="inline-flex items-center gap-2">
							<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
									fill="none"
								/>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
								/>
							</svg>
							Analyzing responses...
						</span>
					{:else}
						Run AI Scoring Analysis
					{/if}
				</button>
			</form>
		</div>
	{/if}

	<!-- Score Results -->
	{#if scoreData}
		<!-- Overall Score and Risk Rating -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Overall Score Gauge -->
			<div class="card bg-white shadow-lg p-6">
				<h2 class="text-lg font-semibold mb-4">Overall Score</h2>
				<div class="flex flex-col items-center">
					<!-- Circular gauge visualization -->
					<div class="relative w-48 h-48">
						<svg class="w-48 h-48 transform -rotate-90" viewBox="0 0 200 200">
							<!-- Background circle -->
							<circle
								cx="100"
								cy="100"
								r="80"
								fill="none"
								stroke="#e5e7eb"
								stroke-width="16"
							/>
							<!-- Score arc -->
							<circle
								cx="100"
								cy="100"
								r="80"
								fill="none"
								stroke={scoreData.overall_score >= 75
									? '#22c55e'
									: scoreData.overall_score >= 50
										? '#eab308'
										: scoreData.overall_score >= 25
											? '#f97316'
											: '#ef4444'}
								stroke-width="16"
								stroke-linecap="round"
								stroke-dasharray={`${(scoreData.overall_score / 100) * 502.65} 502.65`}
							/>
						</svg>
						<div class="absolute inset-0 flex flex-col items-center justify-center">
							<span class="text-4xl font-bold {getScoreTextColor(scoreData.overall_score)}">
								{scoreData.overall_score}
							</span>
							<span class="text-sm text-gray-500">/100</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Risk Rating Badge -->
			<div class="card bg-white shadow-lg p-6">
				<h2 class="text-lg font-semibold mb-4">Risk Rating</h2>
				<div class="flex flex-col items-center justify-center h-48">
					{@const style = getRatingStyle(scoreData.risk_rating)}
					<span
						class="inline-flex items-center px-8 py-4 rounded-full text-2xl font-bold
							   {style.bg} {style.text} border-2 {style.border}"
					>
						{scoreData.risk_rating.toUpperCase()}
					</span>
					<p class="mt-4 text-sm text-gray-500">
						{#if scoreData.risk_rating === 'critical'}
							Immediate action required. Vendor poses significant risk.
						{:else if scoreData.risk_rating === 'high'}
							Significant concerns identified. Remediation needed before engagement.
						{:else if scoreData.risk_rating === 'medium'}
							Some areas need improvement. Conditional approval with monitoring.
						{:else}
							Vendor meets security requirements. Standard monitoring recommended.
						{/if}
					</p>
				</div>
			</div>
		</div>

		<!-- Category Scores Bar Chart -->
		{#if scoreData.category_scores && Object.keys(scoreData.category_scores).length > 0}
			<div class="card bg-white shadow-lg p-6">
				<h2 class="text-lg font-semibold mb-4">Category Scores</h2>
				<div class="space-y-3">
					{#each Object.entries(scoreData.category_scores) as [category, score]}
						{@const numScore = Number(score)}
						<div class="flex items-center gap-4">
							<div class="w-48 text-sm font-medium text-gray-700 text-right truncate">
								{category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
							</div>
							<div class="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
								<div
									class="h-full rounded-full transition-all duration-500 {getScoreColor(numScore)}"
									style="width: {(numScore / maxCategoryScore) * 100}%"
								></div>
							</div>
							<div class="w-16 text-sm font-semibold {getScoreTextColor(numScore)} text-right">
								{numScore.toFixed(1)}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Strengths and Weaknesses -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Strengths -->
			<div class="card bg-white shadow-lg p-6">
				<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
					<span class="inline-block w-3 h-3 rounded-full bg-green-500"></span>
					Strengths
				</h2>
				{#if scoreData.strengths && scoreData.strengths.length > 0}
					<ul class="space-y-2">
						{#each scoreData.strengths as strength}
							<li
								class="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg"
							>
								<svg
									class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
								<span class="text-sm text-green-800">{strength}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-gray-500 italic">No strengths identified.</p>
				{/if}
			</div>

			<!-- Weaknesses -->
			<div class="card bg-white shadow-lg p-6">
				<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
					<span class="inline-block w-3 h-3 rounded-full bg-red-500"></span>
					Weaknesses
				</h2>
				{#if scoreData.weaknesses && scoreData.weaknesses.length > 0}
					<ul class="space-y-2">
						{#each scoreData.weaknesses as weakness}
							<li
								class="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
							>
								<svg
									class="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
									/>
								</svg>
								<span class="text-sm text-red-800">{weakness}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-gray-500 italic">No weaknesses identified.</p>
				{/if}
			</div>
		</div>

		<!-- Recommendations -->
		{#if scoreData.recommendations && scoreData.recommendations.length > 0}
			<div class="card bg-white shadow-lg p-6">
				<h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
					<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
						/>
					</svg>
					Recommendations
				</h2>
				<ol class="space-y-2">
					{#each scoreData.recommendations as recommendation, idx}
						<li class="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
							<span
								class="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-xs font-bold
									   rounded-full flex items-center justify-center mt-0.5"
							>
								{idx + 1}
							</span>
							<span class="text-sm text-blue-900">{recommendation}</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}

		<!-- Per-Answer Evaluation Table -->
		{#if scoreData.answer_evaluations && scoreData.answer_evaluations.length > 0}
			<div class="card bg-white shadow-lg p-6">
				<h2 class="text-lg font-semibold mb-4">Detailed Answer Evaluations</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b-2 border-gray-200">
								<th class="text-left py-3 px-4 font-semibold text-gray-700">Question</th>
								<th class="text-left py-3 px-4 font-semibold text-gray-700">Answer</th>
								<th class="text-center py-3 px-4 font-semibold text-gray-700 w-20">Score</th>
								<th class="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
								<th class="text-left py-3 px-4 font-semibold text-gray-700">Justification</th>
							</tr>
						</thead>
						<tbody>
							{#each scoreData.answer_evaluations as evaluation}
								<tr class="border-b border-gray-100 hover:bg-gray-50">
									<td class="py-3 px-4 max-w-xs">
										<p class="truncate text-gray-900" title={evaluation.question}>
											{evaluation.question}
										</p>
									</td>
									<td class="py-3 px-4 max-w-xs">
										<p class="truncate text-gray-600" title={evaluation.answer}>
											{evaluation.answer || 'No answer'}
										</p>
									</td>
									<td class="py-3 px-4 text-center">
										<span
											class="inline-flex items-center justify-center w-12 h-8 rounded-md
												   text-xs font-bold text-white {getScoreColor(evaluation.score)}"
										>
											{evaluation.score}
										</span>
									</td>
									<td class="py-3 px-4">
										<span
											class="inline-block px-2 py-1 text-xs font-medium bg-gray-100
												   text-gray-700 rounded-full"
										>
											{(evaluation.category || 'general')
												.replace(/_/g, ' ')
												.replace(/\b\w/g, (c: string) => c.toUpperCase())}
										</span>
									</td>
									<td class="py-3 px-4 max-w-sm">
										<p class="text-gray-600 text-xs">{evaluation.justification}</p>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Re-run scoring -->
		<div class="flex justify-center">
			<form
				method="POST"
				action="?/score"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
			>
				<button
					type="submit"
					disabled={loading}
					class="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg
						   hover:bg-gray-50 disabled:opacity-50 transition-colors"
				>
					{loading ? 'Re-scoring...' : 'Re-run AI Scoring'}
				</button>
			</form>
		</div>
	{/if}
</div>
