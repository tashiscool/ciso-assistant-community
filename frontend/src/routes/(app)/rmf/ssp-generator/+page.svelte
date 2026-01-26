<script lang="ts">
	import { page } from '$app/stores';
	import * as m from '$paraglide/messages';
	import { BASE_API_URL } from '$lib/utils/constants';
	import { goto } from '$app/navigation';

	// Wizard state
	let currentStep = $state(0);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let previewData = $state<any>(null);
	let validationResult = $state<any>(null);
	let generatedDocumentUrl = $state<string | null>(null);

	// Form data
	let selectedAssessment = $state<string>('');
	let selectedBaseline = $state<string>('moderate');
	let complianceAssessments = $state<any[]>([]);

	// Baseline options
	const baselines = [
		{ id: 'low', name: 'FedRAMP Low', description: 'Basic security controls for low-impact systems', pages: '25-35 pages' },
		{ id: 'moderate', name: 'FedRAMP Moderate', description: 'Enhanced security controls for moderate-impact systems', pages: '45-65 pages' },
		{ id: 'high', name: 'FedRAMP High', description: 'Comprehensive security controls for high-impact systems', pages: '65-85 pages' },
		{ id: 'li-saas', name: 'FedRAMP LI-SaaS', description: 'Tailored controls for low-impact SaaS', pages: '20-30 pages' }
	];

	const steps = [
		{ title: 'Select Assessment', description: 'Choose a compliance assessment' },
		{ title: 'Choose Baseline', description: 'Select FedRAMP baseline' },
		{ title: 'Preview & Validate', description: 'Review SSP content' },
		{ title: 'Generate Document', description: 'Download SSP Appendix A' }
	];

	// Load compliance assessments on mount
	async function loadAssessments() {
		try {
			const response = await fetch(`${BASE_API_URL}/compliance-assessments/`, {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				complianceAssessments = data.results || [];
			}
		} catch (e) {
			console.error('Failed to load assessments:', e);
		}
	}

	// Validate SSP for baseline
	async function validateSSP() {
		if (!selectedAssessment || !selectedBaseline) return;

		isLoading = true;
		error = null;

		try {
			const response = await fetch(
				`${BASE_API_URL}/oscal/fedramp/generate-ssp/${selectedAssessment}/validate_for_generation/?baseline=${selectedBaseline}`,
				{ credentials: 'include' }
			);

			if (response.ok) {
				validationResult = await response.json();
			} else {
				error = 'Validation failed. Please check your assessment.';
			}
		} catch (e) {
			error = 'Failed to validate SSP. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	// Preview SSP content
	async function previewSSP() {
		if (!selectedAssessment || !selectedBaseline) return;

		isLoading = true;
		error = null;

		try {
			const response = await fetch(
				`${BASE_API_URL}/oscal/fedramp/generate-ssp/${selectedAssessment}/preview_content/?baseline=${selectedBaseline}`,
				{ credentials: 'include' }
			);

			if (response.ok) {
				previewData = await response.json();
			} else {
				error = 'Failed to preview SSP content.';
			}
		} catch (e) {
			error = 'Failed to preview SSP. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	// Generate SSP document
	async function generateSSP() {
		if (!selectedAssessment || !selectedBaseline) return;

		isLoading = true;
		error = null;

		try {
			const response = await fetch(
				`${BASE_API_URL}/oscal/fedramp/generate-ssp/${selectedAssessment}/generate_appendix_a/`,
				{
					credentials: 'include',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ baseline: selectedBaseline })
				}
			);

			if (response.ok) {
				// Get the document as a blob
				const blob = await response.blob();
				generatedDocumentUrl = URL.createObjectURL(blob);
			} else {
				error = 'Failed to generate SSP document.';
			}
		} catch (e) {
			error = 'Failed to generate SSP. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	// Navigate between steps
	function nextStep() {
		if (currentStep < steps.length - 1) {
			currentStep++;

			// Load data for the current step
			if (currentStep === 2) {
				previewSSP();
				validateSSP();
			}
		}
	}

	function prevStep() {
		if (currentStep > 0) {
			currentStep--;
		}
	}

	// Download document
	function downloadDocument() {
		if (generatedDocumentUrl) {
			const link = document.createElement('a');
			link.href = generatedDocumentUrl;
			link.download = `ssp_appendix_a_${selectedBaseline}.docx`;
			link.click();
		}
	}

	$effect(() => {
		loadAssessments();
	});
</script>

<div class="container mx-auto p-6 max-w-4xl">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">SSP Generation Wizard</h1>
		<p class="text-gray-600 dark:text-gray-400 mt-2">
			Generate FedRAMP System Security Plan (SSP) Appendix A documents
		</p>
	</div>

	<!-- Progress Steps -->
	<div class="mb-8">
		<div class="flex items-center justify-between">
			{#each steps as step, index}
				<div class="flex items-center">
					<div
						class="flex items-center justify-center w-10 h-10 rounded-full {index <= currentStep
							? 'bg-primary-500 text-white'
							: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}"
					>
						{index + 1}
					</div>
					<div class="ml-3 {index === currentStep ? 'font-semibold' : ''}">
						<p class="text-sm text-gray-900 dark:text-white">{step.title}</p>
						<p class="text-xs text-gray-500">{step.description}</p>
					</div>
				</div>
				{#if index < steps.length - 1}
					<div class="flex-1 h-0.5 mx-4 {index < currentStep ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}"></div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- Error Alert -->
	{#if error}
		<div class="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
			<p class="text-red-700 dark:text-red-400">{error}</p>
		</div>
	{/if}

	<!-- Step Content -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
		{#if currentStep === 0}
			<!-- Step 1: Select Assessment -->
			<h2 class="text-xl font-semibold mb-4">Select Compliance Assessment</h2>
			<p class="text-gray-600 dark:text-gray-400 mb-6">
				Choose a compliance assessment to generate the SSP document from.
			</p>

			<div class="space-y-4">
				{#if complianceAssessments.length === 0}
					<p class="text-gray-500">Loading assessments...</p>
				{:else}
					<select
						bind:value={selectedAssessment}
						class="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
					>
						<option value="">-- Select an assessment --</option>
						{#each complianceAssessments as assessment}
							<option value={assessment.id}>
								{assessment.name} ({assessment.framework?.name || 'Unknown Framework'})
							</option>
						{/each}
					</select>
				{/if}

				{#if selectedAssessment}
					<div class="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
						<p class="text-green-700 dark:text-green-400">Assessment selected</p>
					</div>
				{/if}
			</div>

		{:else if currentStep === 1}
			<!-- Step 2: Choose Baseline -->
			<h2 class="text-xl font-semibold mb-4">Choose FedRAMP Baseline</h2>
			<p class="text-gray-600 dark:text-gray-400 mb-6">
				Select the FedRAMP baseline that matches your system's impact level.
			</p>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#each baselines as baseline}
					<button
						onclick={() => (selectedBaseline = baseline.id)}
						class="p-4 border rounded-lg text-left transition-all {selectedBaseline === baseline.id
							? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
							: 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}"
					>
						<h3 class="font-semibold text-gray-900 dark:text-white">{baseline.name}</h3>
						<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{baseline.description}</p>
						<p class="text-xs text-gray-500 mt-2">Estimated: {baseline.pages}</p>
					</button>
				{/each}
			</div>

		{:else if currentStep === 2}
			<!-- Step 3: Preview & Validate -->
			<h2 class="text-xl font-semibold mb-4">Preview & Validate</h2>

			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
					<p class="ml-4">Analyzing SSP content...</p>
				</div>
			{:else}
				<!-- Validation Results -->
				{#if validationResult}
					<div class="mb-6 p-4 rounded-lg {validationResult.validation_passed
						? 'bg-green-50 dark:bg-green-900/30 border border-green-200'
						: 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200'}">
						<h3 class="font-semibold {validationResult.validation_passed ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}">
							{validationResult.validation_passed ? 'Validation Passed' : 'Validation Warnings'}
						</h3>
						<p class="text-sm mt-1">Compliance: {validationResult.compliance_percentage || 0}%</p>

						{#if validationResult.validation_warnings?.length}
							<ul class="mt-2 text-sm list-disc list-inside">
								{#each validationResult.validation_warnings as warning}
									<li>{warning}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}

				<!-- Preview Data -->
				{#if previewData}
					<div class="space-y-4">
						<div class="grid grid-cols-2 gap-4">
							<div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p class="text-sm text-gray-500">System Name</p>
								<p class="font-semibold">{previewData.system_name || 'Unknown'}</p>
							</div>
							<div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p class="text-sm text-gray-500">Baseline</p>
								<p class="font-semibold">{baselines.find(b => b.id === selectedBaseline)?.name}</p>
							</div>
							<div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p class="text-sm text-gray-500">Total Controls</p>
								<p class="font-semibold">{previewData.total_controls || 0}</p>
							</div>
							<div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p class="text-sm text-gray-500">Estimated Length</p>
								<p class="font-semibold">{previewData.estimated_document_length || 'Unknown'}</p>
							</div>
						</div>

						{#if previewData.control_families?.length}
							<div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
								<p class="text-sm text-gray-500 mb-2">Control Families</p>
								<div class="flex flex-wrap gap-2">
									{#each previewData.control_families as family}
										<span class="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded text-sm">
											{family}
										</span>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{/if}

		{:else if currentStep === 3}
			<!-- Step 4: Generate Document -->
			<h2 class="text-xl font-semibold mb-4">Generate SSP Document</h2>

			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
					<p class="ml-4">Generating SSP Appendix A document...</p>
				</div>
			{:else if generatedDocumentUrl}
				<div class="text-center py-8">
					<div class="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
						<svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
						</svg>
					</div>
					<h3 class="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
						SSP Document Generated Successfully!
					</h3>
					<p class="text-gray-600 dark:text-gray-400 mb-6">
						Your FedRAMP SSP Appendix A document is ready for download.
					</p>
					<button
						onclick={downloadDocument}
						class="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-colors"
					>
						Download SSP Document
					</button>
				</div>
			{:else}
				<div class="text-center py-8">
					<p class="text-gray-600 dark:text-gray-400 mb-6">
						Ready to generate the SSP Appendix A document for {baselines.find(b => b.id === selectedBaseline)?.name}?
					</p>
					<button
						onclick={generateSSP}
						class="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-semibold transition-colors"
					>
						Generate SSP Document
					</button>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Navigation Buttons -->
	<div class="flex justify-between">
		<button
			onclick={prevStep}
			disabled={currentStep === 0}
			class="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
		>
			Previous
		</button>

		{#if currentStep < steps.length - 1}
			<button
				onclick={nextStep}
				disabled={(currentStep === 0 && !selectedAssessment) || (currentStep === 1 && !selectedBaseline)}
				class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Next
			</button>
		{/if}
	</div>
</div>
