<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';

	interface DocumentType {
		type: string;
		name: string;
		description: string;
		icon: string;
		supported_formats: string[];
	}

	interface FormatOption {
		value: string;
		label: string;
		icon: string;
	}

	interface Assessment {
		id: string;
		name: string;
		framework?: { name: string };
	}

	interface RecentExport {
		id: string;
		document_type: string;
		format: string;
		filename: string;
		generated_at: string;
		url?: string;
	}

	interface Props {
		data: {
			documentTypes: DocumentType[];
			formatOptions: FormatOption[];
			complianceAssessments: Assessment[];
			frameworks: any[];
			riskAssessments: any[];
		};
	}

	let { data }: Props = $props();

	// Generation modal state
	let showGenerateModal = $state(false);
	let selectedDocType = $state<DocumentType | null>(null);
	let selectedAssessmentId = $state('');
	let selectedFormat = $state('docx');
	let includeAppendices = $state(true);
	let includeEvidence = $state(false);
	let generating = $state(false);
	let generateError = $state('');
	let generateSuccess = $state('');
	let downloadUrl = $state('');
	let downloadFilename = $state('');

	// Recent exports (tracked client-side for this session)
	let recentExports = $state<RecentExport[]>([]);

	// ConMon report options
	let periodStart = $state('');
	let periodEnd = $state('');

	// Derived: available formats for selected doc type
	let availableFormats = $derived(
		selectedDocType
			? (data.formatOptions || []).filter((f: FormatOption) =>
					selectedDocType!.supported_formats.includes(f.value)
				)
			: []
	);

	// Derived: whether this doc type needs an assessment selector
	let needsAssessment = $derived(
		selectedDocType
			? ['ssp', 'sar', 'sap', 'poam'].includes(selectedDocType.type)
			: false
	);

	// Derived: whether this is a ConMon report
	let isConmon = $derived(selectedDocType?.type === 'conmon_report');

	function openGenerateModal(docType: DocumentType) {
		selectedDocType = docType;
		selectedAssessmentId = '';
		selectedFormat = docType.supported_formats[0] || 'docx';
		includeAppendices = true;
		includeEvidence = false;
		generating = false;
		generateError = '';
		generateSuccess = '';
		downloadUrl = '';
		downloadFilename = '';
		periodStart = '';
		periodEnd = '';
		showGenerateModal = true;
	}

	function closeModal() {
		showGenerateModal = false;
		selectedDocType = null;
		// Clean up any object URLs
		if (downloadUrl) {
			window.URL.revokeObjectURL(downloadUrl);
			downloadUrl = '';
		}
	}

	async function handleGenerate() {
		if (!selectedDocType) return;

		if (needsAssessment && !selectedAssessmentId) {
			generateError = 'Please select an assessment.';
			return;
		}

		generating = true;
		generateError = '';
		generateSuccess = '';
		downloadUrl = '';
		downloadFilename = '';

		try {
			const requestBody: Record<string, any> = {
				document_type: selectedDocType.type,
				format: selectedFormat,
				options: {
					include_appendices: includeAppendices,
					include_evidence: includeEvidence
				}
			};

			if (needsAssessment) {
				requestBody.assessment_id = selectedAssessmentId;
			}

			if (isConmon) {
				if (periodStart) requestBody.options.period_start = periodStart;
				if (periodEnd) requestBody.options.period_end = periodEnd;
			}

			const response = await fetch(`${BASE_API_URL}/oscal/documents/export/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error || errorData.errors?.join(', ') || `Generation failed (${response.status})`
				);
			}

			// Get the file from response
			const blob = await response.blob();
			const contentDisposition = response.headers.get('Content-Disposition') || '';
			const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
			const filename = filenameMatch ? filenameMatch[1] : `${selectedDocType.type}_export.${selectedFormat}`;

			downloadUrl = window.URL.createObjectURL(blob);
			downloadFilename = filename;
			generateSuccess = `Document generated successfully: ${filename}`;

			// Add to recent exports
			recentExports = [
				{
					id: crypto.randomUUID(),
					document_type: selectedDocType.name,
					format: selectedFormat.toUpperCase(),
					filename: filename,
					generated_at: new Date().toISOString(),
					url: downloadUrl
				},
				...recentExports
			].slice(0, 20);
		} catch (e: any) {
			generateError = e.message || 'An error occurred during document generation.';
		} finally {
			generating = false;
		}
	}

	function triggerDownload() {
		if (!downloadUrl || !downloadFilename) return;
		const a = document.createElement('a');
		a.href = downloadUrl;
		a.download = downloadFilename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function downloadRecent(exp: RecentExport) {
		if (!exp.url) return;
		const a = document.createElement('a');
		a.href = exp.url;
		a.download = exp.filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function getDocTypeIcon(icon: string): string {
		return icon || 'fa-file';
	}

	function getFormatBadgeColor(format: string): string {
		const colors: Record<string, string> = {
			docx: 'bg-blue-100 text-blue-800',
			xlsx: 'bg-green-100 text-green-800',
			pdf: 'bg-red-100 text-red-800',
			oscal_json: 'bg-purple-100 text-purple-800',
			oscal_yaml: 'bg-indigo-100 text-indigo-800',
			csv: 'bg-yellow-100 text-yellow-800'
		};
		return colors[format.toLowerCase()] || 'bg-gray-100 text-gray-800';
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString();
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="bg-white rounded-lg shadow p-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900 mb-2">
					<i class="fa-solid fa-file-lines text-primary-600 mr-3"></i>
					Document Hub
				</h1>
				<p class="text-gray-600">
					Generate compliance documents including System Security Plans, Assessment Reports,
					Risk Registers, and more. Export in Word, Excel, PDF, OSCAL, or CSV formats.
				</p>
			</div>
		</div>
	</div>

	<!-- Quick Generate Cards -->
	<div>
		<h2 class="text-lg font-semibold text-gray-900 mb-4">Generate Documents</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each data.documentTypes as docType}
				<div
					class="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 p-5"
				>
					<div class="flex items-start space-x-4">
						<div
							class="flex-shrink-0 w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center"
						>
							<i class="fa-solid {getDocTypeIcon(docType.icon)} text-primary-600 text-xl"></i>
						</div>
						<div class="flex-1 min-w-0">
							<h3 class="text-base font-semibold text-gray-900">{docType.name}</h3>
							<p class="text-sm text-gray-500 mt-1">{docType.description}</p>
							<div class="mt-2 flex flex-wrap gap-1">
								{#each docType.supported_formats as fmt}
									<span
										class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getFormatBadgeColor(fmt)}"
									>
										{fmt.toUpperCase()}
									</span>
								{/each}
							</div>
						</div>
					</div>
					<div class="mt-4">
						<button
							class="w-full px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
							onclick={() => openGenerateModal(docType)}
						>
							<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
							Generate
						</button>
					</div>
				</div>
			{/each}

			{#if data.documentTypes.length === 0}
				<!-- Fallback cards when API is not yet connected -->
				{@const fallbackTypes = [
					{ type: 'ssp', name: 'System Security Plan', description: 'Comprehensive security plan documenting control implementations', icon: 'fa-file-shield', supported_formats: ['docx', 'oscal_json', 'oscal_yaml', 'pdf'] },
					{ type: 'sar', name: 'Security Assessment Report', description: 'Assessment findings, risk analysis, and recommendations', icon: 'fa-clipboard-check', supported_formats: ['docx', 'oscal_json', 'pdf'] },
					{ type: 'sap', name: 'Security Assessment Plan', description: 'Assessment scope, methodology, schedule, and team composition', icon: 'fa-clipboard-list', supported_formats: ['docx', 'oscal_json', 'pdf'] },
					{ type: 'poam', name: 'Plan of Action & Milestones', description: 'Tracking of remediation activities and milestones', icon: 'fa-list-check', supported_formats: ['xlsx', 'csv', 'oscal_json'] },
					{ type: 'risk_register', name: 'Risk Register', description: 'Comprehensive register of identified risks and treatments', icon: 'fa-triangle-exclamation', supported_formats: ['xlsx', 'csv', 'pdf'] },
					{ type: 'conmon_report', name: 'Continuous Monitoring Report', description: 'Periodic monitoring status, metrics, and trend analysis', icon: 'fa-chart-line', supported_formats: ['docx', 'pdf', 'xlsx'] },
				]}
				{#each fallbackTypes as docType}
					<div
						class="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 p-5"
					>
						<div class="flex items-start space-x-4">
							<div
								class="flex-shrink-0 w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center"
							>
								<i class="fa-solid {docType.icon} text-primary-600 text-xl"></i>
							</div>
							<div class="flex-1 min-w-0">
								<h3 class="text-base font-semibold text-gray-900">{docType.name}</h3>
								<p class="text-sm text-gray-500 mt-1">{docType.description}</p>
								<div class="mt-2 flex flex-wrap gap-1">
									{#each docType.supported_formats as fmt}
										<span
											class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getFormatBadgeColor(fmt)}"
										>
											{fmt.toUpperCase()}
										</span>
									{/each}
								</div>
							</div>
						</div>
						<div class="mt-4">
							<button
								class="w-full px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
								onclick={() => openGenerateModal(docType)}
							>
								<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
								Generate
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Recent Documents -->
	{#if recentExports.length > 0}
		<div class="bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">
				<i class="fa-solid fa-clock-rotate-left mr-2 text-gray-400"></i>
				Recent Documents
			</h2>
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Document
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Type
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Format
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Generated
							</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
								Action
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each recentExports as exp}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-3 text-sm text-gray-900">
									<i class="fa-solid fa-file mr-2 text-gray-400"></i>
									{exp.filename}
								</td>
								<td class="px-4 py-3 text-sm text-gray-500">{exp.document_type}</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getFormatBadgeColor(exp.format)}"
									>
										{exp.format}
									</span>
								</td>
								<td class="px-4 py-3 text-sm text-gray-500">{formatDate(exp.generated_at)}</td>
								<td class="px-4 py-3 text-right">
									<button
										class="text-primary-600 hover:text-primary-800 text-sm font-medium"
										onclick={() => downloadRecent(exp)}
									>
										<i class="fa-solid fa-download mr-1"></i>
										Download
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Info Section -->
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">About Document Generation</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div>
				<h3 class="font-medium text-gray-700 mb-2">Document Types</h3>
				<ul class="text-sm text-gray-600 space-y-2">
					<li>
						<i class="fa-solid fa-file-shield text-blue-500 w-5"></i>
						<strong>SSP:</strong> System Security Plan with control implementations
					</li>
					<li>
						<i class="fa-solid fa-clipboard-check text-blue-500 w-5"></i>
						<strong>SAR:</strong> Security Assessment Report with findings and recommendations
					</li>
					<li>
						<i class="fa-solid fa-clipboard-list text-blue-500 w-5"></i>
						<strong>SAP:</strong> Security Assessment Plan with scope and methodology
					</li>
					<li>
						<i class="fa-solid fa-list-check text-blue-500 w-5"></i>
						<strong>POA&M:</strong> Plan of Action & Milestones for remediation tracking
					</li>
					<li>
						<i class="fa-solid fa-triangle-exclamation text-blue-500 w-5"></i>
						<strong>Risk Register:</strong> Comprehensive risk inventory with treatments
					</li>
					<li>
						<i class="fa-solid fa-chart-line text-blue-500 w-5"></i>
						<strong>ConMon:</strong> Continuous Monitoring reports with trend analysis
					</li>
				</ul>
			</div>
			<div>
				<h3 class="font-medium text-gray-700 mb-2">Output Formats</h3>
				<ul class="text-sm text-gray-600 space-y-2">
					<li>
						<i class="fa-solid fa-file-word text-blue-600 w-5"></i>
						<strong>Word (.docx):</strong> Formatted documents for review and submission
					</li>
					<li>
						<i class="fa-solid fa-file-excel text-green-600 w-5"></i>
						<strong>Excel (.xlsx):</strong> Structured data with formatting and filters
					</li>
					<li>
						<i class="fa-solid fa-file-pdf text-red-600 w-5"></i>
						<strong>PDF (.html):</strong> Print-ready HTML for PDF conversion
					</li>
					<li>
						<i class="fa-solid fa-code text-purple-600 w-5"></i>
						<strong>OSCAL JSON:</strong> Machine-readable NIST OSCAL format
					</li>
					<li>
						<i class="fa-solid fa-code text-indigo-600 w-5"></i>
						<strong>OSCAL YAML:</strong> Human-readable OSCAL format
					</li>
					<li>
						<i class="fa-solid fa-file-csv text-yellow-600 w-5"></i>
						<strong>CSV:</strong> Flat data for spreadsheet import
					</li>
				</ul>
			</div>
		</div>
	</div>
</div>

<!-- Generate Modal -->
{#if showGenerateModal && selectedDocType}
	<div class="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
		<!-- Backdrop -->
		<div
			class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
			onclick={closeModal}
			onkeydown={(e) => { if (e.key === 'Escape') closeModal(); }}
			role="button"
			tabindex="-1"
		></div>

		<!-- Modal Panel -->
		<div class="flex min-h-full items-center justify-center p-4">
			<div
				class="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 transform transition-all"
			>
				<!-- Header -->
				<div class="flex items-center justify-between mb-6">
					<div class="flex items-center space-x-3">
						<div
							class="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center"
						>
							<i
								class="fa-solid {getDocTypeIcon(selectedDocType.icon)} text-primary-600 text-lg"
							></i>
						</div>
						<div>
							<h3 class="text-lg font-semibold text-gray-900">
								Generate {selectedDocType.name}
							</h3>
							<p class="text-sm text-gray-500">{selectedDocType.description}</p>
						</div>
					</div>
					<button
						class="text-gray-400 hover:text-gray-600"
						onclick={closeModal}
					>
						<i class="fa-solid fa-xmark text-xl"></i>
					</button>
				</div>

				<!-- Form -->
				<div class="space-y-4">
					<!-- Assessment Selector -->
					{#if needsAssessment}
						<div>
							<label
								for="assessment-select"
								class="block text-sm font-medium text-gray-700 mb-1"
							>
								Compliance Assessment
							</label>
							<select
								id="assessment-select"
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
								bind:value={selectedAssessmentId}
							>
								<option value="">Select an assessment...</option>
								{#each data.complianceAssessments as assessment}
									<option value={assessment.id}>
										{assessment.name || assessment.str}
									</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- ConMon Period -->
					{#if isConmon}
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label
									for="period-start"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									Period Start
								</label>
								<input
									id="period-start"
									type="date"
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
									bind:value={periodStart}
								/>
							</div>
							<div>
								<label
									for="period-end"
									class="block text-sm font-medium text-gray-700 mb-1"
								>
									Period End
								</label>
								<input
									id="period-end"
									type="date"
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
									bind:value={periodEnd}
								/>
							</div>
						</div>
					{/if}

					<!-- Format Selector -->
					<div>
						<label
							for="format-select"
							class="block text-sm font-medium text-gray-700 mb-1"
						>
							Output Format
						</label>
						<select
							id="format-select"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
							bind:value={selectedFormat}
						>
							{#each availableFormats as fmt}
								<option value={fmt.value}>
									{fmt.label}
								</option>
							{/each}
							{#if availableFormats.length === 0}
								{#each selectedDocType.supported_formats as fmt}
									<option value={fmt}>{fmt.toUpperCase()}</option>
								{/each}
							{/if}
						</select>
					</div>

					<!-- Options -->
					<div class="space-y-2">
						<p class="text-sm font-medium text-gray-700">Options</p>
						<label class="flex items-center space-x-2">
							<input
								type="checkbox"
								class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
								bind:checked={includeAppendices}
							/>
							<span class="text-sm text-gray-600">Include appendices</span>
						</label>
						<label class="flex items-center space-x-2">
							<input
								type="checkbox"
								class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
								bind:checked={includeEvidence}
							/>
							<span class="text-sm text-gray-600">Include evidence references</span>
						</label>
					</div>
				</div>

				<!-- Error -->
				{#if generateError}
					<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
						<i class="fa-solid fa-circle-exclamation mr-2"></i>
						{generateError}
					</div>
				{/if}

				<!-- Success + Download -->
				{#if generateSuccess}
					<div class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
						<p class="text-sm text-green-800 font-medium">
							<i class="fa-solid fa-check-circle mr-2"></i>
							{generateSuccess}
						</p>
						{#if downloadUrl}
							<button
								class="mt-2 inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
								onclick={triggerDownload}
							>
								<i class="fa-solid fa-download mr-2"></i>
								Download {downloadFilename}
							</button>
						{/if}
					</div>
				{/if}

				<!-- Actions -->
				<div class="mt-6 flex justify-end space-x-3">
					<button
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
						onclick={closeModal}
					>
						{generateSuccess ? 'Close' : 'Cancel'}
					</button>
					{#if !generateSuccess}
						<button
							class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
							onclick={handleGenerate}
							disabled={generating || (needsAssessment && !selectedAssessmentId)}
						>
							{#if generating}
								<i class="fa-solid fa-spinner fa-spin mr-2"></i>
								Generating...
							{:else}
								<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
								Generate Document
							{/if}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
