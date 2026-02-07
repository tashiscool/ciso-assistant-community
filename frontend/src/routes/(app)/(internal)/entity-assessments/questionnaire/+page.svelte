<script lang="ts">
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let selectedTemplate: string | null = $state(null);
	let selectedEntity: string | null = $state(null);
	let activeTab: 'templates' | 'pending' | 'completed' = $state('templates');
	let sendingQuestionnaire = $state(false);
	let sendResult: { success: boolean; message: string } | null = $state(null);

	const templates = $derived(data.templates || []);
	const entities = $derived(data.entities || []);
	const pendingRuns = $derived(data.pendingRuns || []);
	const completedRuns = $derived(data.completedRuns || []);

	function getFrameworkColor(framework: string): string {
		const colors: Record<string, string> = {
			soc2: 'bg-blue-100 text-blue-800 border-blue-200',
			iso27001: 'bg-green-100 text-green-800 border-green-200',
			nist_csf: 'bg-purple-100 text-purple-800 border-purple-200',
			sig_lite: 'bg-amber-100 text-amber-800 border-amber-200'
		};
		return colors[framework] || 'bg-gray-100 text-gray-800 border-gray-200';
	}

	function getFrameworkIcon(framework: string): string {
		const icons: Record<string, string> = {
			soc2: 'fa-shield-halved',
			iso27001: 'fa-certificate',
			nist_csf: 'fa-landmark',
			sig_lite: 'fa-clipboard-list'
		};
		return icons[framework] || 'fa-file-lines';
	}

	function getStatusBadge(status: string): string {
		const badges: Record<string, string> = {
			in_progress: 'bg-yellow-100 text-yellow-800',
			completed: 'bg-green-100 text-green-800',
			abandoned: 'bg-red-100 text-red-800',
			expired: 'bg-gray-100 text-gray-800'
		};
		return badges[status] || 'bg-gray-100 text-gray-800';
	}

	async function sendQuestionnaire() {
		if (!selectedTemplate || !selectedEntity) return;

		sendingQuestionnaire = true;
		sendResult = null;

		try {
			const response = await fetch('/fe-api/vendor-portal/tokens/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					entity_id: selectedEntity,
					template_id: selectedTemplate
				})
			});

			if (response.ok) {
				const result = await response.json();
				sendResult = {
					success: true,
					message: `Questionnaire sent successfully. Portal link: ${result.portal_url || 'Generated'}`
				};
				selectedTemplate = null;
				selectedEntity = null;
			} else {
				sendResult = {
					success: false,
					message: 'Failed to send questionnaire. Please try again.'
				};
			}
		} catch {
			sendResult = {
				success: false,
				message: 'Network error. Please check your connection.'
			};
		} finally {
			sendingQuestionnaire = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Vendor Questionnaire Management</h1>
			<p class="text-sm text-gray-500 mt-1">
				Send security assessment questionnaires to vendors and track their responses.
			</p>
		</div>
		<div class="flex items-center gap-3 text-sm text-gray-500">
			<span class="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full font-medium">
				{pendingRuns.length} Pending
			</span>
			<span class="px-3 py-1 bg-green-50 text-green-700 rounded-full font-medium">
				{completedRuns.length} Completed
			</span>
		</div>
	</div>

	<!-- Result banner -->
	{#if sendResult}
		<div
			class="p-4 rounded-lg border {sendResult.success
				? 'bg-green-50 border-green-200 text-green-800'
				: 'bg-red-50 border-red-200 text-red-800'}"
		>
			<div class="flex items-center gap-2">
				<i
					class="fa-solid {sendResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'}"
				></i>
				<span>{sendResult.message}</span>
				<button
					class="ml-auto text-sm underline"
					onclick={() => (sendResult = null)}
				>
					Dismiss
				</button>
			</div>
		</div>
	{/if}

	<!-- Tab navigation -->
	<div class="border-b border-gray-200">
		<nav class="flex gap-6">
			<button
				class="pb-3 px-1 text-sm font-medium border-b-2 transition-colors {activeTab ===
				'templates'
					? 'border-violet-500 text-violet-600'
					: 'border-transparent text-gray-500 hover:text-gray-700'}"
				onclick={() => (activeTab = 'templates')}
			>
				<i class="fa-solid fa-file-circle-plus mr-1.5"></i>
				Send Questionnaire
			</button>
			<button
				class="pb-3 px-1 text-sm font-medium border-b-2 transition-colors {activeTab ===
				'pending'
					? 'border-violet-500 text-violet-600'
					: 'border-transparent text-gray-500 hover:text-gray-700'}"
				onclick={() => (activeTab = 'pending')}
			>
				<i class="fa-solid fa-clock mr-1.5"></i>
				Pending ({pendingRuns.length})
			</button>
			<button
				class="pb-3 px-1 text-sm font-medium border-b-2 transition-colors {activeTab ===
				'completed'
					? 'border-violet-500 text-violet-600'
					: 'border-transparent text-gray-500 hover:text-gray-700'}"
				onclick={() => (activeTab = 'completed')}
			>
				<i class="fa-solid fa-check-circle mr-1.5"></i>
				Completed ({completedRuns.length})
			</button>
		</nav>
	</div>

	<!-- Templates Tab -->
	{#if activeTab === 'templates'}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Template Selection -->
			<div class="lg:col-span-2 space-y-4">
				<h2 class="text-lg font-semibold text-gray-800">Select Assessment Template</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					{#each templates as template}
						<button
							class="text-left p-5 rounded-xl border-2 transition-all hover:shadow-md {selectedTemplate ===
							template.id
								? 'border-violet-500 bg-violet-50 shadow-md'
								: 'border-gray-200 bg-white hover:border-gray-300'}"
							onclick={() => (selectedTemplate = template.id)}
						>
							<div class="flex items-start gap-3">
								<div
									class="w-10 h-10 rounded-lg flex items-center justify-center {getFrameworkColor(
										template.framework
									)}"
								>
									<i class="fa-solid {getFrameworkIcon(template.framework)}"></i>
								</div>
								<div class="flex-1 min-w-0">
									<h3 class="font-semibold text-gray-900 text-sm">
										{template.name}
									</h3>
									<p class="text-xs text-gray-500 mt-1 line-clamp-2">
										{template.description}
									</p>
									<div class="flex items-center gap-3 mt-3 text-xs text-gray-400">
										<span>
											<i class="fa-solid fa-list-check mr-1"></i>
											{template.total_questions} questions
										</span>
										<span>
											<i class="fa-solid fa-layer-group mr-1"></i>
											{template.categories} categories
										</span>
										<span>
											<i class="fa-solid fa-clock mr-1"></i>
											~{template.estimated_duration_minutes} min
										</span>
									</div>
								</div>
							</div>
							{#if selectedTemplate === template.id}
								<div class="mt-3 flex items-center text-violet-600 text-xs font-medium">
									<i class="fa-solid fa-circle-check mr-1"></i>
									Selected
								</div>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<!-- Send Panel -->
			<div class="space-y-4">
				<h2 class="text-lg font-semibold text-gray-800">Send to Vendor</h2>
				<div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
					<!-- Entity selector -->
					<div>
						<label for="entity-select" class="block text-sm font-medium text-gray-700 mb-1">
							Select Vendor Entity
						</label>
						<select
							id="entity-select"
							class="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:border-violet-500 focus:ring-violet-500"
							bind:value={selectedEntity}
						>
							<option value={null}>-- Choose a vendor --</option>
							{#each entities as entity}
								<option value={entity.id}>{entity.name || entity.str}</option>
							{/each}
						</select>
					</div>

					<!-- Selected template display -->
					{#if selectedTemplate}
						{@const tmpl = templates.find((t: any) => t.id === selectedTemplate)}
						{#if tmpl}
							<div class="p-3 bg-violet-50 rounded-lg border border-violet-200">
								<div class="text-sm font-medium text-violet-800">{tmpl.name}</div>
								<div class="text-xs text-violet-600 mt-1">
									{tmpl.total_questions} questions across {tmpl.categories} categories
								</div>
							</div>
						{/if}
					{:else}
						<div class="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
							Select a template from the left panel.
						</div>
					{/if}

					<!-- Send button -->
					<button
						class="w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors
							{selectedTemplate && selectedEntity
							? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
							: 'bg-gray-100 text-gray-400 cursor-not-allowed'}"
						disabled={!selectedTemplate || !selectedEntity || sendingQuestionnaire}
						onclick={sendQuestionnaire}
					>
						{#if sendingQuestionnaire}
							<i class="fa-solid fa-spinner fa-spin mr-2"></i>
							Sending...
						{:else}
							<i class="fa-solid fa-paper-plane mr-2"></i>
							Generate & Send Questionnaire
						{/if}
					</button>

					<p class="text-xs text-gray-400">
						A unique portal link will be generated for the vendor to complete the assessment.
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Pending Tab -->
	{#if activeTab === 'pending'}
		<div class="space-y-4">
			{#if pendingRuns.length === 0}
				<div class="text-center py-12 bg-white rounded-xl border border-gray-200">
					<i class="fa-solid fa-inbox text-4xl text-gray-300 mb-3"></i>
					<p class="text-gray-500">No pending questionnaires.</p>
					<p class="text-sm text-gray-400 mt-1">
						Send a questionnaire from the templates tab to get started.
					</p>
				</div>
			{:else}
				<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 border-b border-gray-200">
							<tr>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Questionnaire</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Status</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Progress</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Started</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each pendingRuns as run}
								<tr class="hover:bg-gray-50">
									<td class="px-4 py-3">
										<div class="font-medium text-gray-900">
											{run.questionnaire_id?.substring(0, 8) || 'N/A'}...
										</div>
										<div class="text-xs text-gray-500">
											Session: {run.session_token || 'N/A'}
										</div>
									</td>
									<td class="px-4 py-3">
										<span
											class="px-2 py-1 rounded-full text-xs font-medium {getStatusBadge(
												run.status
											)}"
										>
											{run.status}
										</span>
									</td>
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
												<div
													class="h-full bg-violet-500 rounded-full transition-all"
													style="width: {run.total_questions > 0
														? (run.questions_answered / run.total_questions) * 100
														: 0}%"
												></div>
											</div>
											<span class="text-xs text-gray-500 whitespace-nowrap">
												{run.questions_answered}/{run.total_questions}
											</span>
										</div>
									</td>
									<td class="px-4 py-3 text-xs text-gray-500">
										{run.started_at
											? new Date(run.started_at).toLocaleDateString()
											: 'N/A'}
									</td>
									<td class="px-4 py-3">
										<button
											class="text-violet-600 hover:text-violet-800 text-xs font-medium"
										>
											<i class="fa-solid fa-envelope mr-1"></i>
											Remind
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Completed Tab -->
	{#if activeTab === 'completed'}
		<div class="space-y-4">
			{#if completedRuns.length === 0}
				<div class="text-center py-12 bg-white rounded-xl border border-gray-200">
					<i class="fa-solid fa-clipboard-check text-4xl text-gray-300 mb-3"></i>
					<p class="text-gray-500">No completed questionnaires yet.</p>
				</div>
			{:else}
				<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 border-b border-gray-200">
							<tr>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Questionnaire</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Score</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Questions</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Completed</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Duration</th>
								<th class="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100">
							{#each completedRuns as run}
								<tr class="hover:bg-gray-50">
									<td class="px-4 py-3">
										<div class="font-medium text-gray-900">
											{run.questionnaire_id?.substring(0, 8) || 'N/A'}...
										</div>
									</td>
									<td class="px-4 py-3">
										{#if run.final_score_percentage !== null && run.final_score_percentage !== undefined}
											<span
												class="font-semibold {run.final_score_percentage >= 80
													? 'text-green-600'
													: run.final_score_percentage >= 60
														? 'text-yellow-600'
														: 'text-red-600'}"
											>
												{Math.round(run.final_score_percentage)}%
											</span>
										{:else}
											<span class="text-gray-400">N/A</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-gray-600">
										{run.questions_answered}/{run.total_questions}
									</td>
									<td class="px-4 py-3 text-xs text-gray-500">
										{run.completed_at
											? new Date(run.completed_at).toLocaleDateString()
											: 'N/A'}
									</td>
									<td class="px-4 py-3 text-xs text-gray-500">
										{#if run.time_spent_seconds}
											{Math.round(run.time_spent_seconds / 60)} min
										{:else}
											N/A
										{/if}
									</td>
									<td class="px-4 py-3">
										<button
											class="text-violet-600 hover:text-violet-800 text-xs font-medium"
										>
											<i class="fa-solid fa-eye mr-1"></i>
											View Results
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>
