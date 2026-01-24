<script lang="ts">
	import { onMount } from 'svelte';
	import { BASE_API_URL } from '$lib/utils/constants';

	interface Framework {
		id: string;
		name: string;
		urn: string;
	}

	interface DraftResult {
		draft: string;
		confidence: number;
		suggestions?: string[];
		references?: string[];
	}

	let activeMode = $state<'control' | 'policy' | 'procedure' | 'ssp' | 'improve'>('control');
	let loading = $state(false);
	let result = $state<DraftResult | null>(null);
	let error = $state('');
	let frameworks = $state<Framework[]>([]);

	// Control drafting fields
	let controlId = $state('');
	let requirementText = $state('');
	let selectedFramework = $state('nist_800_53');
	let existingImplementation = $state('');

	// Policy drafting fields
	let policyTopic = $state('');
	let relatedControls = $state('');

	// Procedure drafting fields
	let procedureName = $state('');
	let procedurePurpose = $state('');

	// SSP drafting fields
	let sspControlId = $state('');
	let sspRequirement = $state('');
	let systemDescription = $state('');

	// Text improvement fields
	let textToImprove = $state('');
	let documentType = $state('control_implementation');
	let improvementFocus = $state<string[]>(['clarity', 'completeness']);

	onMount(async () => {
		try {
			const response = await fetch(`${BASE_API_URL}/loaded-libraries/`);
			if (response.ok) {
				const data = await response.json();
				frameworks = (data.results || data || []).filter(
					(lib: any) => lib.library_type === 'framework'
				);
			}
		} catch (e) {
			console.error('Failed to load frameworks:', e);
		}
	});

	async function draftControl() {
		if (!controlId || !requirementText) {
			error = 'Please provide control ID and requirement text';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/author/draft-control/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					control_id: controlId,
					requirement_text: requirementText,
					framework: selectedFramework,
					existing_implementation: existingImplementation || undefined
				})
			});

			const data = await response.json();
			if (data.success) {
				result = data.data;
			} else {
				error = data.error || 'Failed to generate draft';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function draftPolicy() {
		if (!policyTopic) {
			error = 'Please provide a policy topic';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/author/draft-policy/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic: policyTopic,
					framework: selectedFramework,
					related_controls: relatedControls
						? relatedControls.split(',').map((c) => c.trim())
						: []
				})
			});

			const data = await response.json();
			if (data.success) {
				result = data.data;
			} else {
				error = data.error || 'Failed to generate draft';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function draftProcedure() {
		if (!procedureName || !procedurePurpose) {
			error = 'Please provide procedure name and purpose';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/author/draft-procedure/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					procedure_name: procedureName,
					purpose: procedurePurpose,
					related_controls: relatedControls
						? relatedControls.split(',').map((c) => c.trim())
						: []
				})
			});

			const data = await response.json();
			if (data.success) {
				result = data.data;
			} else {
				error = data.error || 'Failed to generate draft';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function draftSSP() {
		if (!sspControlId || !sspRequirement || !systemDescription) {
			error = 'Please provide all SSP fields';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/author/draft-ssp/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					control_id: sspControlId,
					requirement_text: sspRequirement,
					system_description: systemDescription
				})
			});

			const data = await response.json();
			if (data.success) {
				result = {
					draft: data.data.narrative,
					confidence: 0.85
				};
			} else {
				error = data.error || 'Failed to generate draft';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function improveText() {
		if (!textToImprove) {
			error = 'Please provide text to improve';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/author/improve-text/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: textToImprove,
					document_type: documentType,
					improvement_focus: improvementFocus
				})
			});

			const data = await response.json();
			if (data.success) {
				result = {
					draft: data.data.improved,
					confidence: 0.9
				};
			} else {
				error = data.error || 'Failed to improve text';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function handleSubmit() {
		switch (activeMode) {
			case 'control':
				draftControl();
				break;
			case 'policy':
				draftPolicy();
				break;
			case 'procedure':
				draftProcedure();
				break;
			case 'ssp':
				draftSSP();
				break;
			case 'improve':
				improveText();
				break;
		}
	}

	function copyToClipboard() {
		if (result?.draft) {
			navigator.clipboard.writeText(result.draft);
		}
	}

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'text-green-600';
		if (confidence >= 0.6) return 'text-yellow-600';
		return 'text-red-600';
	}
</script>

<div class="space-y-6">
	<!-- Mode Selection -->
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">
			<i class="fa-solid fa-pen-fancy mr-2 text-primary-600"></i>
			AI Author
		</h2>
		<p class="text-sm text-gray-600 mb-4">
			Use AI to draft control implementations, policies, procedures, and SSP narratives.
		</p>

		<div class="flex gap-2 mb-6">
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'control'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'control')}
			>
				Control Implementation
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'policy'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'policy')}
			>
				Policy Section
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode ===
				'procedure'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'procedure')}
			>
				Procedure
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'ssp'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'ssp')}
			>
				SSP Narrative
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeMode === 'improve'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeMode = 'improve')}
			>
				Improve Text
			</button>
		</div>

		<!-- Control Implementation Form -->
		{#if activeMode === 'control'}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Control ID</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm focus:ring-primary-500 focus:border-primary-500"
							placeholder="e.g., AC-2, SC-7"
							bind:value={controlId}
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Framework</label>
						<select
							class="w-full rounded-md border-gray-300 shadow-sm"
							bind:value={selectedFramework}
						>
							<option value="nist_800_53">NIST 800-53</option>
							<option value="nist_csf">NIST CSF</option>
							<option value="iso_27001">ISO 27001</option>
							<option value="soc2">SOC 2</option>
							<option value="fedramp">FedRAMP</option>
						</select>
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Requirement Text</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-24"
						placeholder="Enter the control requirement text..."
						bind:value={requirementText}
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1"
						>Existing Implementation (Optional)</label
					>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-20"
						placeholder="Enter existing implementation to enhance..."
						bind:value={existingImplementation}
					></textarea>
				</div>
			</div>

			<!-- Policy Form -->
		{:else if activeMode === 'policy'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Policy Topic</label>
					<input
						type="text"
						class="w-full rounded-md border-gray-300 shadow-sm"
						placeholder="e.g., Access Control, Incident Response"
						bind:value={policyTopic}
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Framework</label>
						<select
							class="w-full rounded-md border-gray-300 shadow-sm"
							bind:value={selectedFramework}
						>
							<option value="nist_800_53">NIST 800-53</option>
							<option value="nist_csf">NIST CSF</option>
							<option value="iso_27001">ISO 27001</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1"
							>Related Controls (comma-separated)</label
						>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., AC-1, AC-2, AC-3"
							bind:value={relatedControls}
						/>
					</div>
				</div>
			</div>

			<!-- Procedure Form -->
		{:else if activeMode === 'procedure'}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Procedure Name</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., User Access Review Procedure"
							bind:value={procedureName}
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1"
							>Related Controls (comma-separated)</label
						>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., AC-2, AC-6"
							bind:value={relatedControls}
						/>
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-24"
						placeholder="Describe the purpose of this procedure..."
						bind:value={procedurePurpose}
					></textarea>
				</div>
			</div>

			<!-- SSP Form -->
		{:else if activeMode === 'ssp'}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Control ID</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., AC-2"
							bind:value={sspControlId}
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">System Description</label>
						<input
							type="text"
							class="w-full rounded-md border-gray-300 shadow-sm"
							placeholder="e.g., Cloud-based SaaS application"
							bind:value={systemDescription}
						/>
					</div>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Requirement Text</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-24"
						placeholder="Enter the control requirement..."
						bind:value={sspRequirement}
					></textarea>
				</div>
			</div>

			<!-- Improve Text Form -->
		{:else if activeMode === 'improve'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Text to Improve</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-32"
						placeholder="Paste the text you want to improve..."
						bind:value={textToImprove}
					></textarea>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
						<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={documentType}>
							<option value="control_implementation">Control Implementation</option>
							<option value="policy">Policy</option>
							<option value="procedure">Procedure</option>
							<option value="evidence">Evidence Description</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Improvement Focus</label>
						<div class="flex flex-wrap gap-2 mt-2">
							{#each ['clarity', 'completeness', 'specificity', 'compliance'] as focus}
								<label class="inline-flex items-center">
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary-600"
										checked={improvementFocus.includes(focus)}
										onchange={() => {
											if (improvementFocus.includes(focus)) {
												improvementFocus = improvementFocus.filter((f) => f !== focus);
											} else {
												improvementFocus = [...improvementFocus, focus];
											}
										}}
									/>
									<span class="ml-2 text-sm text-gray-700 capitalize">{focus}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<div class="mt-6">
			<button
				class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
				onclick={handleSubmit}
				disabled={loading}
			>
				{#if loading}
					<i class="fa-solid fa-spinner fa-spin mr-2"></i>
					Generating...
				{:else}
					<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
					Generate Draft
				{/if}
			</button>
		</div>

		{#if error}
			<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
				<i class="fa-solid fa-circle-exclamation mr-2"></i>
				{error}
			</div>
		{/if}
	</div>

	<!-- Result -->
	{#if result}
		<div class="bg-white rounded-lg shadow p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-medium text-gray-900">Generated Draft</h3>
				<div class="flex items-center gap-4">
					<span class="text-sm {getConfidenceColor(result.confidence)}">
						<i class="fa-solid fa-chart-line mr-1"></i>
						{(result.confidence * 100).toFixed(0)}% confidence
					</span>
					<button
						class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
						onclick={copyToClipboard}
					>
						<i class="fa-solid fa-copy mr-1"></i>
						Copy
					</button>
				</div>
			</div>

			<div class="bg-gray-50 rounded-lg p-4 mb-4">
				<pre class="whitespace-pre-wrap text-sm text-gray-700">{result.draft}</pre>
			</div>

			{#if result.suggestions && result.suggestions.length > 0}
				<div class="mt-4">
					<h4 class="text-sm font-medium text-gray-700 mb-2">Suggestions</h4>
					<ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
						{#each result.suggestions as suggestion}
							<li>{suggestion}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if result.references && result.references.length > 0}
				<div class="mt-4">
					<h4 class="text-sm font-medium text-gray-700 mb-2">References</h4>
					<ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
						{#each result.references as reference}
							<li>{reference}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>
