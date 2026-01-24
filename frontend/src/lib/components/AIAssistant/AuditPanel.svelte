<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';

	interface ControlEvaluation {
		control_id: string;
		effectiveness_score: number;
		compliance_status: string;
		strengths: string[];
		weaknesses: string[];
		recommendations: string[];
		evidence_gaps: string[];
	}

	interface Gap {
		control_id: string;
		gap_description: string;
		severity: string;
		remediation: string;
	}

	interface GapAnalysisResult {
		gaps: Gap[];
		summary: {
			critical: number;
			high: number;
			medium: number;
			low: number;
		};
	}

	interface EvidenceReview {
		adequacy_score: number;
		relevance_score: number;
		timeliness_score: number;
		findings: string[];
		recommendations: string[];
	}

	let activeMode = $state<'evaluate' | 'gap' | 'evidence'>('evaluate');
	let loading = $state(false);
	let error = $state('');

	// Control evaluation fields
	let controlId = $state('');
	let controlDescription = $state('');
	let requirementText = $state('');
	let implementationStatement = $state('');
	let evidenceSummary = $state('');
	let evaluationResult = $state<ControlEvaluation | null>(null);

	// Gap analysis fields
	let targetFramework = $state('nist_800_53');
	let currentStateJson = $state('');
	let gapResult = $state<GapAnalysisResult | null>(null);

	// Evidence review fields
	let evidenceDescription = $state('');
	let evidenceType = $state('screenshot');
	let controlRequirement = $state('');
	let evidenceDate = $state('');
	let evidenceReviewResult = $state<EvidenceReview | null>(null);

	async function evaluateControl() {
		if (!controlId || !controlDescription || !requirementText) {
			error = 'Please fill in all required fields';
			return;
		}

		loading = true;
		error = '';
		evaluationResult = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/auditor/evaluate-control/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					control_id: controlId,
					control_description: controlDescription,
					requirement_text: requirementText,
					implementation_statement: implementationStatement || undefined,
					evidence_summary: evidenceSummary || undefined
				})
			});

			const data = await response.json();
			if (data.success) {
				evaluationResult = data.data;
			} else {
				error = data.error || 'Failed to evaluate control';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function performGapAnalysis() {
		let currentState = {};
		try {
			if (currentStateJson.trim()) {
				currentState = JSON.parse(currentStateJson);
			}
		} catch {
			error = 'Invalid JSON format for current state';
			return;
		}

		loading = true;
		error = '';
		gapResult = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/auditor/gap-analysis/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					current_state: currentState,
					target_framework: targetFramework
				})
			});

			const data = await response.json();
			if (data.success) {
				gapResult = data.data;
			} else {
				error = data.error || 'Failed to perform gap analysis';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function reviewEvidence() {
		if (!evidenceDescription || !evidenceType || !controlRequirement) {
			error = 'Please fill in all required fields';
			return;
		}

		loading = true;
		error = '';
		evidenceReviewResult = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/auditor/evidence-review/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					evidence_description: evidenceDescription,
					evidence_type: evidenceType,
					control_requirement: controlRequirement,
					evidence_date: evidenceDate || undefined
				})
			});

			const data = await response.json();
			if (data.success) {
				evidenceReviewResult = data.data;
			} else {
				error = data.error || 'Failed to review evidence';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function getScoreColor(score: number): string {
		if (score >= 80) return 'text-green-600';
		if (score >= 60) return 'text-yellow-600';
		return 'text-red-600';
	}

	function getScoreBgColor(score: number): string {
		if (score >= 80) return 'bg-green-500';
		if (score >= 60) return 'bg-yellow-500';
		return 'bg-red-500';
	}

	function getSeverityColor(severity: string): string {
		switch (severity?.toLowerCase()) {
			case 'critical':
				return 'bg-red-100 text-red-800';
			case 'high':
				return 'bg-orange-100 text-orange-800';
			case 'medium':
				return 'bg-yellow-100 text-yellow-800';
			case 'low':
				return 'bg-green-100 text-green-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getComplianceStatusColor(status: string): string {
		switch (status?.toLowerCase()) {
			case 'compliant':
				return 'bg-green-100 text-green-800';
			case 'partially_compliant':
				return 'bg-yellow-100 text-yellow-800';
			case 'non_compliant':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<div class="space-y-6">
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">
			<i class="fa-solid fa-clipboard-check mr-2 text-primary-600"></i>
			AI Auditor
		</h2>
		<p class="text-sm text-gray-600 mb-4">
			Evaluate control effectiveness, perform gap analysis, and review evidence using AI.
		</p>

		<!-- Mode Selection -->
		<div class="flex gap-2 mb-6">
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode ===
				'evaluate'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'evaluate')}
			>
				<i class="fa-solid fa-gauge mr-2"></i>
				Evaluate Control
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'gap'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'gap')}
			>
				<i class="fa-solid fa-search mr-2"></i>
				Gap Analysis
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'evidence'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'evidence')}
			>
				<i class="fa-solid fa-file-shield mr-2"></i>
				Evidence Review
			</button>
		</div>

		<!-- Control Evaluation Form -->
		{#if activeMode === 'evaluate'}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Control ID *</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., AC-2, SC-7"
							bind:value={controlId}
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Control Description *</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., Account Management"
							bind:value={controlDescription}
						/>
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Requirement Text *</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-24"
						placeholder="Enter the control requirement text..."
						bind:value={requirementText}
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Implementation Statement</label
					>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-24"
						placeholder="Describe how the control is implemented..."
						bind:value={implementationStatement}
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Evidence Summary</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-20"
						placeholder="Summarize the evidence supporting this control..."
						bind:value={evidenceSummary}
					></textarea>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={evaluateControl}
					disabled={loading}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Evaluating...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Evaluate Control
					{/if}
				</button>
			</div>

			<!-- Gap Analysis Form -->
		{:else if activeMode === 'gap'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Target Framework</label>
					<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={targetFramework}>
						<option value="nist_800_53">NIST 800-53</option>
						<option value="nist_csf">NIST CSF</option>
						<option value="iso_27001">ISO 27001</option>
						<option value="soc2">SOC 2</option>
						<option value="fedramp">FedRAMP</option>
					</select>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">
						Current State (JSON format)
					</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-48 font-mono text-sm"
						placeholder={'{"controls_implemented": ["AC-1", "AC-2"], "policies": ["access_control"], ...}'}
						bind:value={currentStateJson}
					></textarea>
					<p class="text-xs text-gray-500 mt-1">
						Provide current security posture in JSON format
					</p>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={performGapAnalysis}
					disabled={loading}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Analyzing...
					{:else}
						<i class="fa-solid fa-search mr-2"></i>
						Perform Gap Analysis
					{/if}
				</button>
			</div>

			<!-- Evidence Review Form -->
		{:else if activeMode === 'evidence'}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Evidence Type *</label>
						<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={evidenceType}>
							<option value="screenshot">Screenshot</option>
							<option value="log_file">Log File</option>
							<option value="configuration">Configuration</option>
							<option value="policy_document">Policy Document</option>
							<option value="scan_report">Scan Report</option>
							<option value="interview_notes">Interview Notes</option>
							<option value="attestation">Attestation</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Evidence Date</label>
						<input
							type="date"
							class="w-full rounded-md border-gray-300 shadow-sm"
							bind:value={evidenceDate}
						/>
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Evidence Description *</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-24"
						placeholder="Describe the evidence being reviewed..."
						bind:value={evidenceDescription}
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Control Requirement *</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-20"
						placeholder="Enter the control requirement this evidence supports..."
						bind:value={controlRequirement}
					></textarea>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={reviewEvidence}
					disabled={loading}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Reviewing...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Review Evidence
					{/if}
				</button>
			</div>
		{/if}

		{#if error}
			<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
				<i class="fa-solid fa-circle-exclamation mr-2"></i>
				{error}
			</div>
		{/if}
	</div>

	<!-- Control Evaluation Result -->
	{#if evaluationResult}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="flex items-center justify-between mb-6">
				<h3 class="text-lg font-medium text-gray-900">
					Control Evaluation: {evaluationResult.control_id}
				</h3>
				<span
					class="px-3 py-1 text-sm font-medium rounded-full {getComplianceStatusColor(
						evaluationResult.compliance_status
					)}"
				>
					{evaluationResult.compliance_status?.replace('_', ' ') || 'Unknown'}
				</span>
			</div>

			<div class="mb-6">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-gray-600">Effectiveness Score</span>
					<span class="text-xl font-bold {getScoreColor(evaluationResult.effectiveness_score)}">
						{evaluationResult.effectiveness_score}%
					</span>
				</div>
				<div class="w-full h-3 bg-gray-200 rounded-full">
					<div
						class="h-3 rounded-full {getScoreBgColor(evaluationResult.effectiveness_score)}"
						style="width: {evaluationResult.effectiveness_score}%"
					></div>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-6">
				{#if evaluationResult.strengths && evaluationResult.strengths.length > 0}
					<div>
						<h4 class="text-sm font-medium text-green-700 mb-2">
							<i class="fa-solid fa-check-circle mr-1"></i>
							Strengths
						</h4>
						<ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
							{#each evaluationResult.strengths as strength}
								<li>{strength}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if evaluationResult.weaknesses && evaluationResult.weaknesses.length > 0}
					<div>
						<h4 class="text-sm font-medium text-red-700 mb-2">
							<i class="fa-solid fa-exclamation-triangle mr-1"></i>
							Weaknesses
						</h4>
						<ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
							{#each evaluationResult.weaknesses as weakness}
								<li>{weakness}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			{#if evaluationResult.recommendations && evaluationResult.recommendations.length > 0}
				<div class="mt-6 pt-4 border-t">
					<h4 class="text-sm font-medium text-gray-700 mb-2">
						<i class="fa-solid fa-lightbulb mr-1 text-yellow-500"></i>
						Recommendations
					</h4>
					<ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
						{#each evaluationResult.recommendations as rec}
							<li>{rec}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if evaluationResult.evidence_gaps && evaluationResult.evidence_gaps.length > 0}
				<div class="mt-4 p-3 bg-yellow-50 rounded">
					<h4 class="text-sm font-medium text-yellow-700 mb-2">
						<i class="fa-solid fa-file-circle-question mr-1"></i>
						Evidence Gaps
					</h4>
					<ul class="list-disc list-inside text-sm text-yellow-600 space-y-1">
						{#each evaluationResult.evidence_gaps as gap}
							<li>{gap}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Gap Analysis Result -->
	{#if gapResult}
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Gap Analysis Results</h3>

			<div class="grid grid-cols-4 gap-4 mb-6">
				<div class="bg-red-50 rounded-lg p-4 text-center">
					<div class="text-3xl font-bold text-red-700">{gapResult.summary.critical}</div>
					<div class="text-sm text-red-600">Critical</div>
				</div>
				<div class="bg-orange-50 rounded-lg p-4 text-center">
					<div class="text-3xl font-bold text-orange-700">{gapResult.summary.high}</div>
					<div class="text-sm text-orange-600">High</div>
				</div>
				<div class="bg-yellow-50 rounded-lg p-4 text-center">
					<div class="text-3xl font-bold text-yellow-700">{gapResult.summary.medium}</div>
					<div class="text-sm text-yellow-600">Medium</div>
				</div>
				<div class="bg-green-50 rounded-lg p-4 text-center">
					<div class="text-3xl font-bold text-green-700">{gapResult.summary.low}</div>
					<div class="text-sm text-green-600">Low</div>
				</div>
			</div>

			{#if gapResult.gaps.length > 0}
				<div class="space-y-3">
					{#each gapResult.gaps as gap}
						<div class="border rounded-lg p-4">
							<div class="flex items-start justify-between mb-2">
								<span class="font-medium text-gray-900">{gap.control_id}</span>
								<span class="px-2 py-1 text-xs rounded-full {getSeverityColor(gap.severity)}">
									{gap.severity}
								</span>
							</div>
							<p class="text-sm text-gray-600 mb-2">{gap.gap_description}</p>
							{#if gap.remediation}
								<div class="text-sm text-blue-600">
									<i class="fa-solid fa-wrench mr-1"></i>
									{gap.remediation}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8 text-gray-500">
					<i class="fa-solid fa-check-circle text-4xl text-green-500 mb-4"></i>
					<p>No significant gaps identified</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Evidence Review Result -->
	{#if evidenceReviewResult}
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Evidence Review Results</h3>

			<div class="grid grid-cols-3 gap-4 mb-6">
				<div class="text-center">
					<div class="text-sm text-gray-500 mb-1">Adequacy</div>
					<div class="text-2xl font-bold {getScoreColor(evidenceReviewResult.adequacy_score)}">
						{evidenceReviewResult.adequacy_score}%
					</div>
					<div class="w-full h-2 bg-gray-200 rounded-full mt-1">
						<div
							class="h-2 rounded-full {getScoreBgColor(evidenceReviewResult.adequacy_score)}"
							style="width: {evidenceReviewResult.adequacy_score}%"
						></div>
					</div>
				</div>
				<div class="text-center">
					<div class="text-sm text-gray-500 mb-1">Relevance</div>
					<div class="text-2xl font-bold {getScoreColor(evidenceReviewResult.relevance_score)}">
						{evidenceReviewResult.relevance_score}%
					</div>
					<div class="w-full h-2 bg-gray-200 rounded-full mt-1">
						<div
							class="h-2 rounded-full {getScoreBgColor(evidenceReviewResult.relevance_score)}"
							style="width: {evidenceReviewResult.relevance_score}%"
						></div>
					</div>
				</div>
				<div class="text-center">
					<div class="text-sm text-gray-500 mb-1">Timeliness</div>
					<div class="text-2xl font-bold {getScoreColor(evidenceReviewResult.timeliness_score)}">
						{evidenceReviewResult.timeliness_score}%
					</div>
					<div class="w-full h-2 bg-gray-200 rounded-full mt-1">
						<div
							class="h-2 rounded-full {getScoreBgColor(evidenceReviewResult.timeliness_score)}"
							style="width: {evidenceReviewResult.timeliness_score}%"
						></div>
					</div>
				</div>
			</div>

			{#if evidenceReviewResult.findings && evidenceReviewResult.findings.length > 0}
				<div class="mb-4">
					<h4 class="text-sm font-medium text-gray-700 mb-2">Findings</h4>
					<ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
						{#each evidenceReviewResult.findings as finding}
							<li>{finding}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if evidenceReviewResult.recommendations && evidenceReviewResult.recommendations.length > 0}
				<div class="p-3 bg-blue-50 rounded">
					<h4 class="text-sm font-medium text-blue-700 mb-2">
						<i class="fa-solid fa-lightbulb mr-1"></i>
						Recommendations
					</h4>
					<ul class="list-disc list-inside text-sm text-blue-600 space-y-1">
						{#each evidenceReviewResult.recommendations as rec}
							<li>{rec}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>
