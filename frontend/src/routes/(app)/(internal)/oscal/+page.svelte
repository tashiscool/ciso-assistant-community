<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';
	import * as m from '$lib/paraglide/messages';
	import OscalEditor from '$lib/components/OscalEditor/OscalEditor.svelte';

	interface Props {
		data: {
			complianceAssessments: any[];
			frameworks: any[];
			riskAssessments: any[];
		};
	}

	let { data }: Props = $props();

	let activeTab = $state<'import' | 'export' | 'validate' | 'editor'>('import');

	// Import state
	let importFile: File | null = $state(null);
	let importLoading = $state(false);
	let importResult = $state<any>(null);
	let importError = $state('');

	// Export state
	let exportType = $state<'ssp' | 'catalog' | 'assessment_plan' | 'assessment_results' | 'poam'>('ssp');
	let exportFormat = $state<'json' | 'yaml'>('json');
	let selectedExportId = $state('');
	let exportLoading = $state(false);
	let exportError = $state('');

	// Validate state
	let validateFile: File | null = $state(null);
	let validateLoading = $state(false);
	let validateResult = $state<any>(null);
	let validateError = $state('');
	let fedrampBaseline = $state<'low' | 'moderate' | 'high' | 'li-saas'>('moderate');

	// Editor state
	let editorDocument = $state<any>(null);
	let editorDocumentType = $state<string>('ssp');

	function handleImportFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			importFile = target.files[0];
			importError = '';
			importResult = null;
		}
	}

	async function handleImport() {
		if (!importFile) {
			importError = 'Please select a file to import';
			return;
		}

		importLoading = true;
		importError = '';
		importResult = null;

		try {
			const formData = new FormData();
			formData.append('file', importFile);

			const response = await fetch(`${BASE_API_URL}/oscal/import/import_file/`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Import failed');
			}

			importResult = await response.json();
		} catch (e: any) {
			importError = e.message || 'An error occurred during import';
		} finally {
			importLoading = false;
		}
	}

	async function handleValidateFile() {
		if (!importFile) {
			importError = 'Please select a file to validate';
			return;
		}

		importLoading = true;
		importError = '';

		try {
			const formData = new FormData();
			formData.append('file', importFile);

			const response = await fetch(`${BASE_API_URL}/oscal/import/validate/`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error('Validation failed');
			}

			const result = await response.json();
			importResult = { validated: true, ...result };
		} catch (e: any) {
			importError = e.message || 'Validation failed';
		} finally {
			importLoading = false;
		}
	}

	async function handleExport() {
		if (!selectedExportId) {
			exportError = 'Please select a document to export';
			return;
		}

		exportLoading = true;
		exportError = '';

		try {
			const response = await fetch(
				`${BASE_API_URL}/oscal/export/${selectedExportId}/${exportType}/?format=${exportFormat}`
			);

			if (!response.ok) {
				throw new Error('Export failed');
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `oscal-${exportType}-${selectedExportId}.${exportFormat}`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (e: any) {
			exportError = e.message || 'Export failed';
		} finally {
			exportLoading = false;
		}
	}

	function handleValidateFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			validateFile = target.files[0];
			validateError = '';
			validateResult = null;
		}
	}

	async function handleFedRAMPValidation() {
		if (!validateFile) {
			validateError = 'Please select a file to validate';
			return;
		}

		validateLoading = true;
		validateError = '';
		validateResult = null;

		try {
			const formData = new FormData();
			formData.append('file', validateFile);
			formData.append('baseline', fedrampBaseline);

			const response = await fetch(`${BASE_API_URL}/fedramp/validate/validate_ssp/`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Validation failed');
			}

			validateResult = await response.json();
		} catch (e: any) {
			validateError = e.message || 'An error occurred during validation';
		} finally {
			validateLoading = false;
		}
	}

	function getExportOptions() {
		switch (exportType) {
			case 'ssp':
			case 'assessment_plan':
			case 'assessment_results':
				return data.complianceAssessments;
			case 'catalog':
				return data.frameworks;
			case 'poam':
				return data.riskAssessments;
			default:
				return [];
		}
	}

	$effect(() => {
		// Reset selection when export type changes
		selectedExportId = '';
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="bg-white rounded-lg shadow p-6">
		<h1 class="text-2xl font-bold text-gray-900 mb-2">{m.oscalImportExport()}</h1>
		<p class="text-gray-600">{m.oscalImportExportDescription()}</p>
	</div>

	<!-- Tabs -->
	<div class="bg-white rounded-lg shadow">
		<div class="border-b border-gray-200">
			<nav class="flex -mb-px">
				<button
					class="px-6 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'import'
						? 'border-primary-500 text-primary-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					onclick={() => (activeTab = 'import')}
				>
					<i class="fa-solid fa-file-import mr-2"></i>
					{m.oscalImport()}
				</button>
				<button
					class="px-6 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'export'
						? 'border-primary-500 text-primary-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					onclick={() => (activeTab = 'export')}
				>
					<i class="fa-solid fa-file-export mr-2"></i>
					{m.oscalExport()}
				</button>
				<button
					class="px-6 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'validate'
						? 'border-primary-500 text-primary-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					onclick={() => (activeTab = 'validate')}
				>
					<i class="fa-solid fa-check-circle mr-2"></i>
					{m.fedrampValidation()}
				</button>
				<button
					class="px-6 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'editor'
						? 'border-primary-500 text-primary-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					onclick={() => (activeTab = 'editor')}
				>
					<i class="fa-solid fa-edit mr-2"></i>
					{m.oscalEditor()}
				</button>
			</nav>
		</div>

		<div class="p-6">
			<!-- Import Tab -->
			{#if activeTab === 'import'}
				<div class="space-y-6">
					<div>
						<h2 class="text-lg font-semibold text-gray-900 mb-4">{m.oscalImport()}</h2>
						<p class="text-sm text-gray-600 mb-4">
							Import OSCAL-compliant documents into CISO Assistant. Supported formats: SSP, Catalog, Profile,
							Assessment Plan, Assessment Results, and POA&M.
						</p>
					</div>

					<div class="grid grid-cols-2 gap-6">
						<div>
							<label for="import-file" class="block text-sm font-medium text-gray-700 mb-2"
								>{m.selectOscalFile()}</label
							>
							<input
								id="import-file"
								type="file"
								accept=".json,.yaml,.yml,.xml"
								class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
								onchange={handleImportFileChange}
							/>
							{#if importFile}
								<p class="mt-2 text-sm text-gray-500">
									Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
								</p>
							{/if}
						</div>

						<div class="flex items-end space-x-4">
							<button
								class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
								onclick={handleValidateFile}
								disabled={importLoading || !importFile}
							>
								{#if importLoading}
									<i class="fa-solid fa-spinner fa-spin mr-2"></i>
								{:else}
									<i class="fa-solid fa-check mr-2"></i>
								{/if}
								{m.oscalValidate()}
							</button>
							<button
								class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
								onclick={handleImport}
								disabled={importLoading || !importFile}
							>
								{#if importLoading}
									<i class="fa-solid fa-spinner fa-spin mr-2"></i>
								{:else}
									<i class="fa-solid fa-file-import mr-2"></i>
								{/if}
								{m.oscalImport()}
							</button>
						</div>
					</div>

					{#if importError}
						<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
							<i class="fa-solid fa-circle-exclamation mr-2"></i>
							{importError}
						</div>
					{/if}

					{#if importResult}
						<div class="p-4 bg-green-50 border border-green-200 rounded-lg">
							<h3 class="font-medium text-green-800 mb-2">
								<i class="fa-solid fa-check-circle mr-2"></i>
								{importResult.validated ? m.oscalValidationSuccess() : m.oscalImportSuccess()}
							</h3>
							{#if importResult.document_type}
								<p class="text-sm text-green-700">Document Type: {importResult.document_type}</p>
							{/if}
							{#if importResult.created_objects}
								<div class="mt-2">
									<p class="text-sm font-medium text-green-800">Created Objects:</p>
									<ul class="list-disc list-inside text-sm text-green-700 mt-1">
										{#each Object.entries(importResult.created_objects) as [type, count]}
											<li>{type}: {count}</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/if}
				</div>

			<!-- Export Tab -->
			{:else if activeTab === 'export'}
				<div class="space-y-6">
					<div>
						<h2 class="text-lg font-semibold text-gray-900 mb-4">{m.oscalExport()}</h2>
						<p class="text-sm text-gray-600 mb-4">
							Export CISO Assistant data as OSCAL-compliant documents for interoperability with other GRC tools.
						</p>
					</div>

					<div class="grid grid-cols-3 gap-6">
						<div>
							<label for="export-type" class="block text-sm font-medium text-gray-700 mb-2"
								>{m.oscalDocumentType()}</label
							>
							<select
								id="export-type"
								class="w-full rounded-md border-gray-300 shadow-sm"
								bind:value={exportType}
							>
								<option value="ssp">{m.oscalSsp()}</option>
								<option value="catalog">{m.oscalCatalog()}</option>
								<option value="assessment_plan">{m.oscalAssessmentPlan()}</option>
								<option value="assessment_results">{m.oscalAssessmentResults()}</option>
								<option value="poam">{m.oscalPoam()}</option>
							</select>
						</div>

						<div>
							<label for="export-document" class="block text-sm font-medium text-gray-700 mb-2"
								>{m.selectDocumentToExport()}</label
							>
							<select
								id="export-document"
								class="w-full rounded-md border-gray-300 shadow-sm"
								bind:value={selectedExportId}
							>
								<option value="">Select...</option>
								{#each getExportOptions() as item}
									<option value={item.id}>{item.name}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="export-format" class="block text-sm font-medium text-gray-700 mb-2"
								>{m.selectExportFormat()}</label
							>
							<select
								id="export-format"
								class="w-full rounded-md border-gray-300 shadow-sm"
								bind:value={exportFormat}
							>
								<option value="json">JSON</option>
								<option value="yaml">YAML</option>
							</select>
						</div>
					</div>

					<div>
						<button
							class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
							onclick={handleExport}
							disabled={exportLoading || !selectedExportId}
						>
							{#if exportLoading}
								<i class="fa-solid fa-spinner fa-spin mr-2"></i>
							{:else}
								<i class="fa-solid fa-download mr-2"></i>
							{/if}
							{m.oscalExport()}
						</button>
					</div>

					{#if exportError}
						<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
							<i class="fa-solid fa-circle-exclamation mr-2"></i>
							{exportError}
						</div>
					{/if}
				</div>

			<!-- Validate Tab -->
			{:else if activeTab === 'validate'}
				<div class="space-y-6">
					<div>
						<h2 class="text-lg font-semibold text-gray-900 mb-4">{m.fedrampValidation()}</h2>
						<p class="text-sm text-gray-600 mb-4">
							Validate OSCAL System Security Plans against FedRAMP baselines to ensure compliance.
						</p>
					</div>

					<div class="grid grid-cols-2 gap-6">
						<div>
							<label for="validate-file" class="block text-sm font-medium text-gray-700 mb-2"
								>{m.selectOscalFile()}</label
							>
							<input
								id="validate-file"
								type="file"
								accept=".json,.yaml,.yml,.xml"
								class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
								onchange={handleValidateFileChange}
							/>
							{#if validateFile}
								<p class="mt-2 text-sm text-gray-500">
									Selected: {validateFile.name} ({(validateFile.size / 1024).toFixed(1)} KB)
								</p>
							{/if}
						</div>

						<div>
							<label for="fedramp-baseline" class="block text-sm font-medium text-gray-700 mb-2"
								>{m.fedrampBaseline()}</label
							>
							<select
								id="fedramp-baseline"
								class="w-full rounded-md border-gray-300 shadow-sm"
								bind:value={fedrampBaseline}
							>
								<option value="low">{m.baselineLow()}</option>
								<option value="moderate">{m.baselineModerate()}</option>
								<option value="high">{m.baselineHigh()}</option>
								<option value="li-saas">{m.baselineLiSaas()}</option>
							</select>
						</div>
					</div>

					<div>
						<button
							class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
							onclick={handleFedRAMPValidation}
							disabled={validateLoading || !validateFile}
						>
							{#if validateLoading}
								<i class="fa-solid fa-spinner fa-spin mr-2"></i>
								Validating...
							{:else}
								<i class="fa-solid fa-shield-halved mr-2"></i>
								Validate Against FedRAMP
							{/if}
						</button>
					</div>

					{#if validateError}
						<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
							<i class="fa-solid fa-circle-exclamation mr-2"></i>
							{validateError}
						</div>
					{/if}

					{#if validateResult}
						<div
							class="p-4 rounded-lg border {validateResult.valid
								? 'bg-green-50 border-green-200'
								: 'bg-yellow-50 border-yellow-200'}"
						>
							<h3
								class="font-medium mb-3 {validateResult.valid ? 'text-green-800' : 'text-yellow-800'}"
							>
								<i
									class="fa-solid {validateResult.valid
										? 'fa-check-circle'
										: 'fa-triangle-exclamation'} mr-2"
								></i>
								{validateResult.valid ? 'Validation Passed' : 'Validation Issues Found'}
							</h3>

							{#if validateResult.summary}
								<div class="grid grid-cols-4 gap-4 mb-4">
									<div class="bg-white rounded p-3 shadow-sm">
										<div class="text-2xl font-bold text-gray-900">
											{validateResult.summary.total_controls || 0}
										</div>
										<div class="text-sm text-gray-500">Total Controls</div>
									</div>
									<div class="bg-white rounded p-3 shadow-sm">
										<div class="text-2xl font-bold text-green-600">
											{validateResult.summary.implemented || 0}
										</div>
										<div class="text-sm text-gray-500">Implemented</div>
									</div>
									<div class="bg-white rounded p-3 shadow-sm">
										<div class="text-2xl font-bold text-yellow-600">
											{validateResult.summary.partial || 0}
										</div>
										<div class="text-sm text-gray-500">Partial</div>
									</div>
									<div class="bg-white rounded p-3 shadow-sm">
										<div class="text-2xl font-bold text-red-600">
											{validateResult.summary.not_implemented || 0}
										</div>
										<div class="text-sm text-gray-500">Not Implemented</div>
									</div>
								</div>
							{/if}

							{#if validateResult.issues && validateResult.issues.length > 0}
								<div class="mt-4">
									<h4 class="font-medium text-gray-700 mb-2">Issues ({validateResult.issues.length})</h4>
									<div class="max-h-64 overflow-y-auto">
										<ul class="space-y-2">
											{#each validateResult.issues.slice(0, 20) as issue}
												<li
													class="text-sm p-2 rounded {issue.severity === 'error'
														? 'bg-red-100 text-red-700'
														: 'bg-yellow-100 text-yellow-700'}"
												>
													<span class="font-medium">{issue.control_id || 'General'}:</span>
													{issue.message}
												</li>
											{/each}
										</ul>
										{#if validateResult.issues.length > 20}
											<p class="text-sm text-gray-500 mt-2">
												Showing 20 of {validateResult.issues.length} issues
											</p>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

			<!-- Editor Tab -->
			{:else if activeTab === 'editor'}
				<div class="space-y-6">
					<div>
						<h2 class="text-lg font-semibold text-gray-900 mb-4">{m.oscalEditor()}</h2>
						<p class="text-sm text-gray-600 mb-4">
							Create and edit OSCAL documents using the zone-based editor. Load an existing document or start
							from scratch.
						</p>
					</div>

					<div class="mb-4 flex items-center space-x-4">
						<div>
							<label for="editor-doc-type" class="block text-sm font-medium text-gray-700 mb-1"
								>{m.oscalDocumentType()}</label
							>
							<select
								id="editor-doc-type"
								class="rounded-md border-gray-300 shadow-sm"
								bind:value={editorDocumentType}
							>
								<option value="ssp">{m.oscalSsp()}</option>
								<option value="catalog">{m.oscalCatalog()}</option>
								<option value="profile">{m.oscalProfile()}</option>
								<option value="component-definition">{m.oscalComponentDefinition()}</option>
								<option value="assessment-plan">{m.oscalAssessmentPlan()}</option>
								<option value="assessment-results">{m.oscalAssessmentResults()}</option>
								<option value="poam">{m.oscalPoam()}</option>
							</select>
						</div>

						<div>
							<label for="load-editor-file" class="block text-sm font-medium text-gray-700 mb-1"
								>Load Document</label
							>
							<input
								id="load-editor-file"
								type="file"
								accept=".json,.yaml,.yml"
								class="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
								onchange={(e) => {
									const target = e.target as HTMLInputElement;
									if (target.files && target.files[0]) {
										const reader = new FileReader();
										reader.onload = (event) => {
											try {
												const content = event.target?.result as string;
												editorDocument = JSON.parse(content);
											} catch {
												alert('Invalid JSON file');
											}
										};
										reader.readAsText(target.files[0]);
									}
								}}
							/>
						</div>
					</div>

					<div class="border rounded-lg" style="height: 600px;">
						<OscalEditor
							document={editorDocument || {
								type: editorDocumentType,
								metadata: {
									title: 'New OSCAL Document',
									'last-modified': new Date().toISOString(),
									version: '1.0.0',
									'oscal-version': '1.1.2'
								}
							}}
							onsave={(doc) => {
								editorDocument = doc;
								const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
								const url = window.URL.createObjectURL(blob);
								const a = window.document.createElement('a');
								a.href = url;
								a.download = `oscal-${editorDocumentType}-${Date.now()}.json`;
								window.document.body.appendChild(a);
								a.click();
								window.URL.revokeObjectURL(url);
								window.document.body.removeChild(a);
							}}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- OSCAL Format Information -->
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">About OSCAL</h2>
		<div class="grid grid-cols-2 gap-6">
			<div>
				<h3 class="font-medium text-gray-700 mb-2">Supported Document Types</h3>
				<ul class="text-sm text-gray-600 space-y-1">
					<li>
						<i class="fa-solid fa-book text-blue-500 w-5"></i>
						<strong>Catalog:</strong> Security control definitions and baselines
					</li>
					<li>
						<i class="fa-solid fa-sliders text-blue-500 w-5"></i>
						<strong>Profile:</strong> Selection and tailoring of controls
					</li>
					<li>
						<i class="fa-solid fa-file-lines text-blue-500 w-5"></i>
						<strong>SSP:</strong> System Security Plan with implementation details
					</li>
					<li>
						<i class="fa-solid fa-cube text-blue-500 w-5"></i>
						<strong>Component Definition:</strong> Reusable component definitions
					</li>
					<li>
						<i class="fa-solid fa-clipboard-list text-blue-500 w-5"></i>
						<strong>Assessment Plan:</strong> Plan for assessing system controls
					</li>
					<li>
						<i class="fa-solid fa-chart-bar text-blue-500 w-5"></i>
						<strong>Assessment Results:</strong> Results of control assessments
					</li>
					<li>
						<i class="fa-solid fa-tasks text-blue-500 w-5"></i>
						<strong>POA&M:</strong> Plan of Action and Milestones
					</li>
				</ul>
			</div>
			<div>
				<h3 class="font-medium text-gray-700 mb-2">FedRAMP Baselines</h3>
				<ul class="text-sm text-gray-600 space-y-1">
					<li>
						<i class="fa-solid fa-shield text-green-500 w-5"></i>
						<strong>Low:</strong> For low-impact systems (125+ controls)
					</li>
					<li>
						<i class="fa-solid fa-shield-halved text-yellow-500 w-5"></i>
						<strong>Moderate:</strong> For moderate-impact systems (325+ controls)
					</li>
					<li>
						<i class="fa-solid fa-shield-virus text-red-500 w-5"></i>
						<strong>High:</strong> For high-impact systems (421+ controls)
					</li>
					<li>
						<i class="fa-solid fa-cloud text-blue-500 w-5"></i>
						<strong>LI-SaaS:</strong> Low Impact SaaS baseline
					</li>
				</ul>
				<p class="mt-3 text-xs text-gray-500">
					Learn more at
					<a
						href="https://pages.nist.gov/OSCAL/"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary-600 hover:underline"
					>
						NIST OSCAL Documentation
					</a>
				</p>
			</div>
		</div>
	</div>
</div>
