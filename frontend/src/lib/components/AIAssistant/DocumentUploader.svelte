<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';

	interface ExtractedControl {
		id: string;
		title: string;
		description: string;
		framework_mapping?: string;
		confidence: number;
	}

	interface ExtractionResult {
		filename: string;
		extraction_types: string[];
		controls: ExtractedControl[];
		policies: any[];
		requirements: any[];
		coverage_analysis?: any;
	}

	let activeTab = $state<'upload' | 'text' | 'map' | 'coverage'>('upload');
	let loading = $state(false);
	let result = $state<ExtractionResult | null>(null);
	let error = $state('');

	// Upload fields
	let selectedFile = $state<File | null>(null);
	let extractionTypes = $state<string[]>(['controls']);
	let targetFramework = $state('nist_800_53');

	// Text extraction fields
	let textContent = $state('');

	// Mapping fields
	let controlDescriptions = $state('');

	// Coverage analysis fields
	let policyText = $state('');
	let coverageFramework = $state('nist_800_53');
	let coverageResult = $state<any>(null);

	let dragOver = $state(false);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			selectedFile = files[0];
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			selectedFile = input.files[0];
		}
	}

	async function uploadDocument() {
		if (!selectedFile) {
			error = 'Please select a file to upload';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);
			formData.append('extraction_types', extractionTypes.join(','));
			if (targetFramework) {
				formData.append('target_framework', targetFramework);
			}

			const response = await fetch(`${BASE_API_URL}/ai/extractor/upload/`, {
				method: 'POST',
				body: formData
			});

			const data = await response.json();
			if (data.success) {
				result = data.data;
			} else {
				error = data.error || 'Failed to extract content';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function extractFromText() {
		if (!textContent.trim()) {
			error = 'Please enter text content';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/extractor/text/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					text: textContent,
					target_framework: targetFramework
				})
			});

			const data = await response.json();
			if (data.success) {
				result = {
					filename: 'text-input',
					extraction_types: ['controls'],
					controls: data.data.controls,
					policies: [],
					requirements: []
				};
			} else {
				error = data.error || 'Failed to extract controls';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function mapControls() {
		if (!controlDescriptions.trim()) {
			error = 'Please enter control descriptions';
			return;
		}

		loading = true;
		error = '';
		result = null;

		try {
			const descriptions = controlDescriptions
				.split('\n')
				.map((d) => d.trim())
				.filter((d) => d);

			const response = await fetch(`${BASE_API_URL}/ai/extractor/map-controls/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					control_descriptions: descriptions,
					target_framework: targetFramework
				})
			});

			const data = await response.json();
			if (data.success) {
				result = {
					filename: 'mapping-result',
					extraction_types: ['mapping'],
					controls: data.data.mappings.map((m: any, idx: number) => ({
						id: m.framework_control_id || `mapped-${idx}`,
						title: descriptions[idx],
						description: m.reasoning || '',
						framework_mapping: m.framework_control_id,
						confidence: m.confidence || 0.8
					})),
					policies: [],
					requirements: []
				};
			} else {
				error = data.error || 'Failed to map controls';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function analyzeCoverage() {
		if (!policyText.trim()) {
			error = 'Please enter policy text';
			return;
		}

		loading = true;
		error = '';
		coverageResult = null;

		try {
			const response = await fetch(`${BASE_API_URL}/ai/extractor/coverage-analysis/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					policy_text: policyText,
					framework: coverageFramework
				})
			});

			const data = await response.json();
			if (data.success) {
				coverageResult = data.data;
			} else {
				error = data.error || 'Failed to analyze coverage';
			}
		} catch (e: any) {
			error = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'text-green-600';
		if (confidence >= 0.6) return 'text-yellow-600';
		return 'text-red-600';
	}

	function getConfidenceBadge(confidence: number): string {
		if (confidence >= 0.8) return 'bg-green-100 text-green-800';
		if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
		return 'bg-red-100 text-red-800';
	}
</script>

<div class="space-y-6">
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">
			<i class="fa-solid fa-file-import mr-2 text-primary-600"></i>
			AI Extractor
		</h2>
		<p class="text-sm text-gray-600 mb-4">
			Extract controls, requirements, and policies from documents using AI-powered analysis.
		</p>

		<!-- Tabs -->
		<div class="flex gap-2 mb-6">
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'upload'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeTab = 'upload')}
			>
				<i class="fa-solid fa-upload mr-2"></i>
				Upload Document
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'text'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeTab = 'text')}
			>
				<i class="fa-solid fa-align-left mr-2"></i>
				Text Input
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'map'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeTab = 'map')}
			>
				<i class="fa-solid fa-link mr-2"></i>
				Map to Framework
			</button>
			<button
				class="px-4 py-2 rounded-md text-sm font-medium transition-colors {activeTab === 'coverage'
					? 'bg-primary-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				onclick={() => (activeTab = 'coverage')}
			>
				<i class="fa-solid fa-chart-pie mr-2"></i>
				Coverage Analysis
			</button>
		</div>

		<!-- Upload Document -->
		{#if activeTab === 'upload'}
			<div class="space-y-4">
				<div
					class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {dragOver
						? 'border-primary-500 bg-primary-50'
						: 'border-gray-300 hover:border-gray-400'}"
					ondragover={handleDragOver}
					ondragleave={handleDragLeave}
					ondrop={handleDrop}
				>
					{#if selectedFile}
						<div class="flex items-center justify-center gap-3">
							<i class="fa-solid fa-file-pdf text-3xl text-red-500"></i>
							<div class="text-left">
								<p class="font-medium text-gray-900">{selectedFile.name}</p>
								<p class="text-sm text-gray-500">
									{(selectedFile.size / 1024).toFixed(1)} KB
								</p>
							</div>
							<button
								class="ml-4 text-gray-400 hover:text-red-500"
								onclick={() => (selectedFile = null)}
							>
								<i class="fa-solid fa-times"></i>
							</button>
						</div>
					{:else}
						<i class="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-4"></i>
						<p class="text-gray-600 mb-2">Drag and drop your document here, or</p>
						<label
							class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 cursor-pointer"
						>
							Browse Files
							<input
								type="file"
								class="hidden"
								accept=".pdf,.docx,.doc,.txt"
								onchange={handleFileSelect}
							/>
						</label>
						<p class="text-xs text-gray-400 mt-2">Supports PDF, Word, and text files</p>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Target Framework</label>
						<select
							class="w-full rounded-md border-gray-300 shadow-sm"
							bind:value={targetFramework}
						>
							<option value="nist_800_53">NIST 800-53</option>
							<option value="nist_csf">NIST CSF</option>
							<option value="iso_27001">ISO 27001</option>
							<option value="soc2">SOC 2</option>
							<option value="fedramp">FedRAMP</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Extract</label>
						<div class="flex flex-wrap gap-3 mt-2">
							{#each ['controls', 'policies', 'requirements'] as type}
								<label class="inline-flex items-center">
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary-600"
										checked={extractionTypes.includes(type)}
										onchange={() => {
											if (extractionTypes.includes(type)) {
												extractionTypes = extractionTypes.filter((t) => t !== type);
											} else {
												extractionTypes = [...extractionTypes, type];
											}
										}}
									/>
									<span class="ml-2 text-sm text-gray-700 capitalize">{type}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={uploadDocument}
					disabled={loading || !selectedFile}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Extracting...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Extract Content
					{/if}
				</button>
			</div>

			<!-- Text Input -->
		{:else if activeTab === 'text'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Policy/Document Text</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-48"
						placeholder="Paste your policy or document text here..."
						bind:value={textContent}
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Target Framework</label>
					<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={targetFramework}>
						<option value="nist_800_53">NIST 800-53</option>
						<option value="nist_csf">NIST CSF</option>
						<option value="iso_27001">ISO 27001</option>
						<option value="soc2">SOC 2</option>
					</select>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={extractFromText}
					disabled={loading || !textContent.trim()}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Extracting...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Extract Controls
					{/if}
				</button>
			</div>

			<!-- Map to Framework -->
		{:else if activeTab === 'map'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1"
						>Control Descriptions (one per line)</label
					>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-48"
						placeholder="Enter control descriptions, one per line...&#10;&#10;Example:&#10;Implement multi-factor authentication for all users&#10;Encrypt data at rest using AES-256&#10;Conduct annual security awareness training"
						bind:value={controlDescriptions}
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Target Framework</label>
					<select class="w-full rounded-md border-gray-300 shadow-sm" bind:value={targetFramework}>
						<option value="nist_800_53">NIST 800-53</option>
						<option value="nist_csf">NIST CSF</option>
						<option value="iso_27001">ISO 27001</option>
						<option value="soc2">SOC 2</option>
					</select>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={mapControls}
					disabled={loading || !controlDescriptions.trim()}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Mapping...
					{:else}
						<i class="fa-solid fa-link mr-2"></i>
						Map to Framework
					{/if}
				</button>
			</div>

			<!-- Coverage Analysis -->
		{:else if activeTab === 'coverage'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Policy Document Text</label>
					<textarea
						class="w-full rounded-md border-gray-300 shadow-sm h-48"
						placeholder="Paste your policy document text to analyze coverage against a framework..."
						bind:value={policyText}
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Framework</label>
					<select
						class="w-full rounded-md border-gray-300 shadow-sm"
						bind:value={coverageFramework}
					>
						<option value="nist_800_53">NIST 800-53</option>
						<option value="nist_csf">NIST CSF</option>
						<option value="iso_27001">ISO 27001</option>
						<option value="soc2">SOC 2</option>
					</select>
				</div>

				<button
					class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
					onclick={analyzeCoverage}
					disabled={loading || !policyText.trim()}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Analyzing...
					{:else}
						<i class="fa-solid fa-chart-pie mr-2"></i>
						Analyze Coverage
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

	<!-- Extraction Results -->
	{#if result && result.controls.length > 0}
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">
				Extracted Controls
				<span class="text-sm text-gray-500 font-normal ml-2">
					({result.controls.length} found)
				</span>
			</h3>

			<div class="space-y-3">
				{#each result.controls as control, idx}
					<div class="border rounded-lg p-4 hover:bg-gray-50">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-2 mb-1">
									<span class="font-medium text-gray-900">{control.id || `Control ${idx + 1}`}</span>
									{#if control.framework_mapping}
										<span class="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
											{control.framework_mapping}
										</span>
									{/if}
									<span
										class="px-2 py-0.5 text-xs rounded {getConfidenceBadge(control.confidence)}"
									>
										{(control.confidence * 100).toFixed(0)}%
									</span>
								</div>
								{#if control.title}
									<p class="text-sm text-gray-700 mb-1">{control.title}</p>
								{/if}
								{#if control.description}
									<p class="text-sm text-gray-500">{control.description}</p>
								{/if}
							</div>
							<button class="text-primary-600 hover:text-primary-700 text-sm">
								<i class="fa-solid fa-plus mr-1"></i>
								Import
							</button>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-4 flex gap-3">
				<button class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700">
					<i class="fa-solid fa-download mr-2"></i>
					Import All
				</button>
				<button class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
					<i class="fa-solid fa-file-export mr-2"></i>
					Export CSV
				</button>
			</div>
		</div>
	{/if}

	<!-- Coverage Analysis Results -->
	{#if coverageResult}
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Coverage Analysis</h3>

			<div class="grid grid-cols-3 gap-4 mb-6">
				<div class="bg-green-50 rounded-lg p-4">
					<div class="text-sm text-green-600">Covered</div>
					<div class="text-2xl font-bold text-green-700">
						{coverageResult.covered_controls || 0}
					</div>
				</div>
				<div class="bg-yellow-50 rounded-lg p-4">
					<div class="text-sm text-yellow-600">Partially Covered</div>
					<div class="text-2xl font-bold text-yellow-700">
						{coverageResult.partial_controls || 0}
					</div>
				</div>
				<div class="bg-red-50 rounded-lg p-4">
					<div class="text-sm text-red-600">Not Covered</div>
					<div class="text-2xl font-bold text-red-700">
						{coverageResult.uncovered_controls || 0}
					</div>
				</div>
			</div>

			{#if coverageResult.coverage_rate}
				<div class="mb-4">
					<div class="flex justify-between text-sm mb-1">
						<span class="text-gray-600">Overall Coverage</span>
						<span class="font-medium">{(coverageResult.coverage_rate * 100).toFixed(1)}%</span>
					</div>
					<div class="w-full h-3 bg-gray-200 rounded-full">
						<div
							class="h-3 rounded-full bg-green-500"
							style="width: {coverageResult.coverage_rate * 100}%"
						></div>
					</div>
				</div>
			{/if}

			{#if coverageResult.gaps && coverageResult.gaps.length > 0}
				<div>
					<h4 class="text-sm font-medium text-gray-700 mb-2">Coverage Gaps</h4>
					<ul class="list-disc list-inside text-sm text-gray-600 space-y-1">
						{#each coverageResult.gaps.slice(0, 10) as gap}
							<li>{gap}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>
