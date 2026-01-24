<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';

	interface Explanation {
		summary: string;
		detailed_explanation: string;
		business_impact?: string;
		key_points?: string[];
		action_items?: string[];
		audience: string;
	}

	let activeMode = $state<'control' | 'risk' | 'concept' | 'summary' | 'translate'>('control');
	let loading = $state(false);
	let error = $state('');
	let explanation = $state<Explanation | null>(null);
	let translatedText = $state('');
	let executiveSummary = $state('');

	// Common fields
	let audience = $state('executive');

	// Control explanation fields
	let controlId = $state('');
	let controlName = $state('');
	let controlDescription = $state('');

	// Risk explanation fields
	let riskId = $state('');
	let riskTitle = $state('');
	let riskDescription = $state('');
	let riskScore = $state<number | null>(null);

	// Concept explanation fields
	let concept = $state('');
	let formatType = $state('detailed');

	// Executive summary fields
	let summaryType = $state('compliance');
	let summaryData = $state('');

	// Translation fields
	let technicalContent = $state('');
	let contentType = $state('finding');

	const audienceOptions = [
		{ value: 'executive', label: 'Executive / Board', icon: 'fa-briefcase' },
		{ value: 'auditor', label: 'Auditor', icon: 'fa-clipboard-check' },
		{ value: 'engineer', label: 'Engineer / Technical', icon: 'fa-code' },
		{ value: 'end_user', label: 'End User', icon: 'fa-user' }
	];

	async function explainControl() {
		if (!controlId || !controlName || !controlDescription) {
			error = 'Please fill in all required fields';
			return;
		}

		loading = true;
		error = '';
		explanation = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/explainer/control/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					control_id: controlId,
					control_name: controlName,
					control_description: controlDescription,
					audience: audience
				})
			});

			const data = await response.json();
			if (data.success) {
				explanation = data.data;
			} else {
				error = data.error || 'Failed to generate explanation';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function explainRisk() {
		if (!riskId || !riskTitle || !riskDescription) {
			error = 'Please fill in all required fields';
			return;
		}

		loading = true;
		error = '';
		explanation = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/explainer/risk/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					risk_id: riskId,
					risk_title: riskTitle,
					risk_description: riskDescription,
					risk_score: riskScore || undefined,
					audience: audience
				})
			});

			const data = await response.json();
			if (data.success) {
				explanation = data.data;
			} else {
				error = data.error || 'Failed to generate explanation';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function explainConcept() {
		if (!concept) {
			error = 'Please enter a concept';
			return;
		}

		loading = true;
		error = '';
		explanation = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/explainer/concept/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					concept: concept,
					audience: audience,
					format: formatType
				})
			});

			const data = await response.json();
			if (data.success) {
				explanation = data.data;
			} else {
				error = data.error || 'Failed to generate explanation';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function generateSummary() {
		if (!summaryData.trim()) {
			error = 'Please enter data for the summary';
			return;
		}

		let dataObj = {};
		try {
			dataObj = JSON.parse(summaryData);
		} catch {
			error = 'Invalid JSON format';
			return;
		}

		loading = true;
		error = '';
		executiveSummary = '';

		try {
			const response = await fetch(`${BASE_API_URL}/ai/explainer/executive-summary/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					data: dataObj,
					summary_type: summaryType
				})
			});

			const data = await response.json();
			if (data.success) {
				executiveSummary = data.data.summary;
			} else {
				error = data.error || 'Failed to generate summary';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function translateToBusiness() {
		if (!technicalContent.trim()) {
			error = 'Please enter content to translate';
			return;
		}

		loading = true;
		error = '';
		translatedText = '';

		try {
			const response = await fetch(`${BASE_API_URL}/ai/explainer/translate/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					technical_content: technicalContent,
					content_type: contentType
				})
			});

			const data = await response.json();
			if (data.success) {
				translatedText = data.data.translated;
			} else {
				error = data.error || 'Failed to translate content';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}
</script>

<div class="space-y-6">
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">
			<i class="fa-solid fa-comment-dots mr-2 text-primary-600"></i>
			AI Explainer
		</h2>
		<p class="text-sm text-gray-600 mb-4">
			Generate role-appropriate explanations for controls, risks, and security concepts.
		</p>

		<!-- Mode Selection -->
		<div class="flex flex-wrap gap-2 mb-6">
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'control'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'control')}
			>
				<i class="fa-solid fa-shield mr-2"></i>
				Control
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'risk'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'risk')}
			>
				<i class="fa-solid fa-triangle-exclamation mr-2"></i>
				Risk
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'concept'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'concept')}
			>
				<i class="fa-solid fa-book mr-2"></i>
				Concept
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'summary'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'summary')}
			>
				<i class="fa-solid fa-file-lines mr-2"></i>
				Executive Summary
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode ===
				'translate'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'translate')}
			>
				<i class="fa-solid fa-language mr-2"></i>
				Translate
			</button>
		</div>

		<!-- Audience Selection (for control, risk, concept modes) -->
		{#if activeMode === 'control' || activeMode === 'risk' || activeMode === 'concept'}
			<div class="mb-6">
				<label class="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
				<div class="flex gap-2">
					{#each audienceOptions as opt}
						<button
							class="flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors border {audience ===
							opt.value
								? 'bg-primary-50 border-primary-500 text-primary-700'
								: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}"
							onclick={() => (audience = opt.value)}
						>
							<i class="fa-solid {opt.icon} mr-2"></i>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Control Explanation Form -->
		{#if activeMode === 'control'}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Control ID *</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., AC-2"
							bind:value={controlId}
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Control Name *</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., Account Management"
							bind:value={controlName}
						/>
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Control Description *</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-24"
						placeholder="Enter the control description..."
						bind:value={controlDescription}
					></textarea>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={explainControl}
					disabled={loading}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Generating...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Explain Control
					{/if}
				</button>
			</div>

			<!-- Risk Explanation Form -->
		{:else if activeMode === 'risk'}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Risk ID *</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., RISK-001"
							bind:value={riskId}
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Risk Score</label>
						<input
							type="number"
							min="0"
							max="100"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="0-100"
							bind:value={riskScore}
						/>
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Risk Title *</label>
					<input
						type="text"
						class="w-full rounded-md border-gray-300 shadow-sm"
						placeholder="e.g., Unauthorized Access to Sensitive Data"
						bind:value={riskTitle}
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Risk Description *</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-24"
						placeholder="Describe the risk scenario..."
						bind:value={riskDescription}
					></textarea>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={explainRisk}
					disabled={loading}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Generating...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Explain Risk
					{/if}
				</button>
			</div>

			<!-- Concept Explanation Form -->
		{:else if activeMode === 'concept'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Concept *</label>
					<input
						type="text"
						class="w-full rounded-md border-gray-300 shadow-sm"
						placeholder="e.g., Zero Trust Architecture, FedRAMP, POAM"
						bind:value={concept}
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Format</label>
					<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={formatType}>
						<option value="brief">Brief (1-2 sentences)</option>
						<option value="detailed">Detailed (full explanation)</option>
						<option value="bullet_points">Bullet Points</option>
						<option value="analogy">With Analogy</option>
					</select>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={explainConcept}
					disabled={loading}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Generating...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Explain Concept
					{/if}
				</button>
			</div>

			<!-- Executive Summary Form -->
		{:else if activeMode === 'summary'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Summary Type</label>
					<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={summaryType}>
						<option value="compliance">Compliance Status</option>
						<option value="risk_assessment">Risk Assessment</option>
						<option value="audit_findings">Audit Findings</option>
						<option value="security_posture">Security Posture</option>
					</select>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Data (JSON format)</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-48 font-mono text-sm"
						placeholder={'{"compliance_rate": 85, "critical_findings": 2, "total_controls": 100, ...}'}
						bind:value={summaryData}
					></textarea>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={generateSummary}
					disabled={loading}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Generating...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Generate Summary
					{/if}
				</button>
			</div>

			<!-- Translate Form -->
		{:else if activeMode === 'translate'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
					<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={contentType}>
						<option value="finding">Security Finding</option>
						<option value="vulnerability">Vulnerability</option>
						<option value="control">Control Description</option>
						<option value="risk">Risk Description</option>
						<option value="incident">Incident Report</option>
					</select>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Technical Content</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-32"
						placeholder="Enter technical content to translate to business language..."
						bind:value={technicalContent}
					></textarea>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={translateToBusiness}
					disabled={loading}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Translating...
					{:else}
						<i class="fa-solid fa-language mr-2"></i>
						Translate to Business Language
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

	<!-- Explanation Result -->
	{#if explanation}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-medium text-gray-900">
					Explanation for {explanation.audience?.replace('_', ' ')}
				</h3>
				<button
					class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
					onclick={() => copyToClipboard(explanation?.detailed_explanation || '')}
				>
					<i class="fa-solid fa-copy mr-1"></i>
					Copy
				</button>
			</div>

			<div class="space-y-4">
				{#if explanation.summary}
					<div class="bg-blue-50 rounded-lg p-4">
						<h4 class="text-sm font-medium text-blue-700 mb-2">
							<i class="fa-solid fa-bolt mr-1"></i>
							Summary
						</h4>
						<p class="text-blue-800">{explanation.summary}</p>
					</div>
				{/if}

				{#if explanation.detailed_explanation}
					<div>
						<h4 class="text-sm font-medium text-gray-700 mb-2">Detailed Explanation</h4>
						<div class="bg-gray-50 rounded-lg p-4">
							<p class="text-gray-700 whitespace-pre-wrap">{explanation.detailed_explanation}</p>
						</div>
					</div>
				{/if}

				{#if explanation.business_impact}
					<div class="bg-yellow-50 rounded-lg p-4">
						<h4 class="text-sm font-medium text-yellow-700 mb-2">
							<i class="fa-solid fa-building mr-1"></i>
							Business Impact
						</h4>
						<p class="text-yellow-800">{explanation.business_impact}</p>
					</div>
				{/if}

				{#if explanation.key_points && explanation.key_points.length > 0}
					<div>
						<h4 class="text-sm font-medium text-gray-700 mb-2">Key Points</h4>
						<ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
							{#each explanation.key_points as point}
								<li>{point}</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if explanation.action_items && explanation.action_items.length > 0}
					<div class="bg-green-50 rounded-lg p-4">
						<h4 class="text-sm font-medium text-green-700 mb-2">
							<i class="fa-solid fa-check-square mr-1"></i>
							Action Items
						</h4>
						<ul class="list-disc list-inside text-sm text-green-700 space-y-1">
							{#each explanation.action_items as item}
								<li>{item}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Executive Summary Result -->
	{#if executiveSummary}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-medium text-gray-900">Executive Summary</h3>
				<button
					class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
					onclick={() => copyToClipboard(executiveSummary)}
				>
					<i class="fa-solid fa-copy mr-1"></i>
					Copy
				</button>
			</div>
			<div class="bg-gray-50 rounded-lg p-4">
				<p class="text-gray-700 whitespace-pre-wrap">{executiveSummary}</p>
			</div>
		</div>
	{/if}

	<!-- Translation Result -->
	{#if translatedText}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-medium text-gray-900">Business-Friendly Translation</h3>
				<button
					class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
					onclick={() => copyToClipboard(translatedText)}
				>
					<i class="fa-solid fa-copy mr-1"></i>
					Copy
				</button>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<h4 class="text-sm font-medium text-gray-500 mb-2">Original (Technical)</h4>
					<div class="bg-gray-100 rounded-lg p-4 text-sm text-gray-700">
						{technicalContent}
					</div>
				</div>
				<div>
					<h4 class="text-sm font-medium text-green-600 mb-2">Translated (Business)</h4>
					<div class="bg-green-50 rounded-lg p-4 text-sm text-green-800">
						{translatedText}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
