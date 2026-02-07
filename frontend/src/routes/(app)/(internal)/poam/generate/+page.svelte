<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';
	import { goto } from '$app/navigation';

	interface Props {
		data: {
			title: string;
			findings: any[];
			assessments: any[];
			systemGroups: any[];
		};
	}

	let { data }: Props = $props();

	// Wizard state
	let currentStep = $state(1);
	let loading = $state(false);
	let error = $state('');

	// Step 1: Source selection
	let sourceType = $state<'vulnerability' | 'compliance'>('vulnerability');
	let selectedAssessmentId = $state('');

	// Step 2: Finding selection
	let selectedFindings = $state<Set<string>>(new Set());
	let selectAll = $state(false);

	// Step 3: Generated items (AI-generated POA&M entries)
	let generatedItems = $state<any[]>([]);
	let generating = $state(false);

	// Step 4: Review and confirmation
	let itemsToCreate = $state<any[]>([]);
	let systemGroupId = $state('');
	let creating = $state(false);
	let createdCount = $state(0);

	// Available findings based on source type
	const availableFindings = $derived.by(() => {
		if (sourceType === 'vulnerability') {
			return data.findings;
		}
		// For compliance, we could filter by assessment - for now show all
		return data.findings;
	});

	function toggleFinding(id: string) {
		const newSet = new Set(selectedFindings);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedFindings = newSet;
	}

	function toggleSelectAll() {
		if (selectAll) {
			selectedFindings = new Set();
			selectAll = false;
		} else {
			selectedFindings = new Set(availableFindings.map((f: any) => f.id));
			selectAll = true;
		}
	}

	function getRiskLevelFromSeverity(severity: string): string {
		const map: Record<string, string> = {
			critical: 'very_high',
			high: 'high',
			medium: 'moderate',
			moderate: 'moderate',
			low: 'low',
			info: 'very_low',
			informational: 'very_low'
		};
		return map[severity?.toLowerCase()] || 'moderate';
	}

	function getRiskColor(level: string): string {
		const colors: Record<string, string> = {
			very_high: 'bg-red-100 text-red-800',
			high: 'bg-orange-100 text-orange-800',
			moderate: 'bg-yellow-100 text-yellow-800',
			low: 'bg-green-100 text-green-800',
			very_low: 'bg-blue-100 text-blue-800'
		};
		return colors[level] || 'bg-gray-100 text-gray-800';
	}

	function formatLabel(value: string): string {
		return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	async function generatePOAMItems() {
		if (selectedFindings.size === 0) {
			error = 'Please select at least one finding';
			return;
		}

		generating = true;
		error = '';

		try {
			// Generate POA&M entries from selected findings
			const selected = availableFindings.filter((f: any) => selectedFindings.has(f.id));
			const generated = selected.map((finding: any, index: number) => {
				const severity = finding.severity || finding.risk_level || 'moderate';
				const riskLevel = getRiskLevelFromSeverity(severity);

				// Generate a weakness ID
				const prefix = sourceType === 'vulnerability' ? 'VULN' : 'COMP';
				const weaknessId = `${prefix}-${String(index + 1).padStart(4, '0')}`;

				// Generate estimated completion based on risk
				const daysMap: Record<string, number> = {
					very_high: 30,
					high: 60,
					moderate: 90,
					low: 120,
					very_low: 180
				};
				const days = daysMap[riskLevel] || 90;
				const completionDate = new Date();
				completionDate.setDate(completionDate.getDate() + days);

				return {
					weakness_id: weaknessId,
					title: finding.title || finding.name || `Finding: ${finding.id}`,
					description: finding.description || finding.detail || `Weakness identified from ${sourceType === 'vulnerability' ? 'vulnerability scan' : 'compliance assessment'}`,
					source_type: sourceType === 'vulnerability' ? 'scan' : 'assessment',
					risk_level: riskLevel,
					likelihood: riskLevel,
					control_id: finding.control_id || finding.control || '',
					remediation_plan: finding.remediation || finding.recommendation || finding.fix ||
						`Remediate ${finding.title || finding.name || 'finding'} by implementing appropriate controls and verifying effectiveness.`,
					estimated_completion_date: completionDate.toISOString().split('T')[0],
					vulnerability_finding_id: sourceType === 'vulnerability' ? finding.id : null,
					assessment_id: selectedAssessmentId || null,
					selected: true,
					originalFinding: finding
				};
			});

			generatedItems = generated;
			itemsToCreate = generated.filter((i: any) => i.selected);
			currentStep = 3;
		} catch (e: any) {
			error = e.message || 'Failed to generate POA&M items';
		} finally {
			generating = false;
		}
	}

	function toggleGeneratedItem(index: number) {
		generatedItems[index].selected = !generatedItems[index].selected;
		itemsToCreate = generatedItems.filter((i: any) => i.selected);
	}

	function updateGeneratedItem(index: number, field: string, value: string) {
		generatedItems[index][field] = value;
		// Re-derive items to create
		itemsToCreate = generatedItems.filter((i: any) => i.selected);
	}

	async function createPOAMItems() {
		if (!systemGroupId) {
			error = 'Please select a system group';
			return;
		}

		if (itemsToCreate.length === 0) {
			error = 'No items selected for creation';
			return;
		}

		creating = true;
		error = '';
		createdCount = 0;

		try {
			for (const item of itemsToCreate) {
				const body: Record<string, any> = {
					weakness_id: item.weakness_id,
					title: item.title,
					description: item.description,
					source_type: item.source_type,
					risk_level: item.risk_level,
					likelihood: item.likelihood,
					system_group_id: systemGroupId,
					remediation_plan: item.remediation_plan,
					estimated_completion_date: item.estimated_completion_date
				};

				if (item.control_id) body.control_id = item.control_id;
				if (item.vulnerability_finding_id) body.vulnerability_finding_id = item.vulnerability_finding_id;
				if (item.assessment_id) body.assessment_id = item.assessment_id;

				const response = await fetch(`${BASE_API_URL}/poam-items/`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});

				if (response.ok) {
					createdCount++;
				}
			}

			currentStep = 4;
		} catch (e: any) {
			error = e.message || 'Failed to create POA&M items';
		} finally {
			creating = false;
		}
	}
</script>

<svelte:head>
	<title>Generate POA&M from Findings</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
	<!-- Breadcrumb -->
	<nav class="flex items-center text-sm text-gray-500 dark:text-gray-400">
		<a href="/poam" class="hover:text-indigo-600 dark:hover:text-indigo-400">POA&M</a>
		<i class="fa-solid fa-chevron-right mx-2 text-xs"></i>
		<span class="text-gray-900 dark:text-white font-medium">Generate from Findings</span>
	</nav>

	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Generate POA&M from Findings</h1>
		<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
			Automatically create POA&M items from vulnerability scans and compliance assessment findings
		</p>
	</div>

	<!-- Progress Steps -->
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
		<div class="flex items-center justify-between">
			{#each [
				{ step: 1, label: 'Select Source' },
				{ step: 2, label: 'Choose Findings' },
				{ step: 3, label: 'Review & Edit' },
				{ step: 4, label: 'Complete' }
			] as stepInfo}
				<div class="flex items-center {stepInfo.step < 4 ? 'flex-1' : ''}">
					<div class="flex items-center">
						<div
							class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {currentStep > stepInfo.step
								? 'bg-green-600 text-white'
								: currentStep === stepInfo.step
									? 'bg-indigo-600 text-white'
									: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}"
						>
							{#if currentStep > stepInfo.step}
								<i class="fa-solid fa-check"></i>
							{:else}
								{stepInfo.step}
							{/if}
						</div>
						<span class="ml-2 text-sm font-medium {currentStep >= stepInfo.step ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}">
							{stepInfo.label}
						</span>
					</div>
					{#if stepInfo.step < 4}
						<div class="flex-1 mx-4 h-0.5 {currentStep > stepInfo.step ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}"></div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	{#if error}
		<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
			<i class="fa-solid fa-circle-exclamation mr-2"></i>
			{error}
			<button class="ml-4 underline text-sm" onclick={() => (error = '')}>Dismiss</button>
		</div>
	{/if}

	<!-- Step 1: Select Source -->
	{#if currentStep === 1}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Step 1: Select Source Type</h2>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Choose the source of findings to generate POA&M items from.
			</p>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<button
					class="p-6 rounded-lg border-2 text-left transition-colors {sourceType === 'vulnerability'
						? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
						: 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'}"
					onclick={() => (sourceType = 'vulnerability')}
				>
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
							<i class="fa-solid fa-shield-halved text-red-600 dark:text-red-400"></i>
						</div>
						<h3 class="font-semibold text-gray-900 dark:text-white">Vulnerability Findings</h3>
					</div>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Generate from vulnerability scan results, penetration tests, and security assessments
					</p>
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{data.findings.length} finding{data.findings.length !== 1 ? 's' : ''} available
					</p>
				</button>

				<button
					class="p-6 rounded-lg border-2 text-left transition-colors {sourceType === 'compliance'
						? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
						: 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'}"
					onclick={() => (sourceType = 'compliance')}
				>
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
							<i class="fa-solid fa-clipboard-check text-blue-600 dark:text-blue-400"></i>
						</div>
						<h3 class="font-semibold text-gray-900 dark:text-white">Compliance Findings</h3>
					</div>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Generate from compliance assessment gaps, audit findings, and non-conformities
					</p>
					<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{data.assessments.length} assessment{data.assessments.length !== 1 ? 's' : ''} available
					</p>
				</button>
			</div>

			{#if sourceType === 'compliance' && data.assessments.length > 0}
				<div>
					<label for="assessment-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Filter by Assessment (optional)
					</label>
					<select
						id="assessment-filter"
						bind:value={selectedAssessmentId}
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					>
						<option value="">All assessments</option>
						{#each data.assessments as assessment}
							<option value={assessment.id}>{assessment.name || assessment.str || assessment.id}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="flex justify-end">
				<button
					class="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
					onclick={() => (currentStep = 2)}
				>
					Next: Select Findings
					<i class="fa-solid fa-arrow-right ml-2"></i>
				</button>
			</div>
		</div>
	{/if}

	<!-- Step 2: Choose Findings -->
	{#if currentStep === 2}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Step 2: Select Findings</h2>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Choose which findings to convert into POA&M items. Selected: {selectedFindings.size} of {availableFindings.length}
					</p>
				</div>
			</div>

			{#if availableFindings.length === 0}
				<div class="text-center py-12">
					<i class="fa-solid fa-inbox text-5xl text-gray-300 dark:text-gray-600 mb-4"></i>
					<h3 class="text-lg font-medium text-gray-900 dark:text-white">No findings available</h3>
					<p class="mt-2 text-gray-500 dark:text-gray-400">
						No {sourceType === 'vulnerability' ? 'vulnerability findings' : 'compliance findings'} were found.
						Import findings first or select a different source type.
					</p>
					<button
						class="mt-4 px-4 py-2 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
						onclick={() => (currentStep = 1)}
					>
						<i class="fa-solid fa-arrow-left mr-2"></i>
						Back to Source Selection
					</button>
				</div>
			{:else}
				<div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th class="px-4 py-3 text-left w-10">
									<input
										type="checkbox"
										checked={selectAll}
										onchange={toggleSelectAll}
										class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
									/>
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Title</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Severity</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Control</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each availableFindings as finding}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-750">
									<td class="px-4 py-3">
										<input
											type="checkbox"
											checked={selectedFindings.has(finding.id)}
											onchange={() => toggleFinding(finding.id)}
											class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
										/>
									</td>
									<td class="px-4 py-3">
										<span class="text-sm font-medium text-gray-900 dark:text-white">
											{finding.title || finding.name || finding.id}
										</span>
									</td>
									<td class="px-4 py-3">
										{@const riskLevel = getRiskLevelFromSeverity(finding.severity || finding.risk_level || 'moderate')}
										<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getRiskColor(riskLevel)}">
											{formatLabel(riskLevel)}
										</span>
									</td>
									<td class="px-4 py-3">
										<span class="text-sm text-gray-700 dark:text-gray-300 font-mono">
											{finding.control_id || finding.control || '-'}
										</span>
									</td>
									<td class="px-4 py-3">
										<span class="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate block">
											{finding.description || '-'}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<div class="flex items-center justify-between pt-4">
				<button
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
					onclick={() => (currentStep = 1)}
				>
					<i class="fa-solid fa-arrow-left mr-2"></i>
					Back
				</button>
				<button
					class="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
					onclick={generatePOAMItems}
					disabled={generating || selectedFindings.size === 0}
				>
					{#if generating}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Generating...
					{:else}
						<i class="fa-solid fa-wand-magic-sparkles mr-2"></i>
						Generate POA&M Items ({selectedFindings.size})
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<!-- Step 3: Review & Edit -->
	{#if currentStep === 3}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Step 3: Review & Edit Generated Items</h2>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Review the generated POA&M items. You can edit details, change risk levels, or deselect items before creating them.
						{itemsToCreate.length} of {generatedItems.length} selected for creation.
					</p>
				</div>
			</div>

			<!-- System Group Selection -->
			<div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/20 rounded-lg p-4">
				<label for="system-group-gen" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					<i class="fa-solid fa-server mr-1"></i>
					Target System Group <span class="text-red-500">*</span>
				</label>
				<select
					id="system-group-gen"
					bind:value={systemGroupId}
					required
					class="w-full sm:w-1/2 px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				>
					<option value="">Select a system group...</option>
					{#each data.systemGroups as group}
						<option value={group.id}>{group.name || group.str || group.id}</option>
					{/each}
				</select>
			</div>

			<div class="space-y-4">
				{#each generatedItems as item, index}
					<div class="border {item.selected ? 'border-indigo-200 dark:border-indigo-800' : 'border-gray-200 dark:border-gray-700 opacity-60'} rounded-lg p-4 transition-opacity">
						<div class="flex items-start gap-4">
							<div class="pt-1">
								<input
									type="checkbox"
									checked={item.selected}
									onchange={() => toggleGeneratedItem(index)}
									class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
								/>
							</div>
							<div class="flex-1 space-y-3">
								<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
									<div>
										<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Weakness ID</label>
										<input
											type="text"
											value={item.weakness_id}
											onchange={(e) => updateGeneratedItem(index, 'weakness_id', (e.target as HTMLInputElement).value)}
											class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										/>
									</div>
									<div>
										<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Risk Level</label>
										<select
											value={item.risk_level}
											onchange={(e) => updateGeneratedItem(index, 'risk_level', (e.target as HTMLSelectElement).value)}
											class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										>
											<option value="very_low">Very Low</option>
											<option value="low">Low</option>
											<option value="moderate">Moderate</option>
											<option value="high">High</option>
											<option value="very_high">Very High</option>
										</select>
									</div>
									<div>
										<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estimated Completion</label>
										<input
											type="date"
											value={item.estimated_completion_date}
											onchange={(e) => updateGeneratedItem(index, 'estimated_completion_date', (e.target as HTMLInputElement).value)}
											class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										/>
									</div>
								</div>
								<div>
									<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title</label>
									<input
										type="text"
										value={item.title}
										onchange={(e) => updateGeneratedItem(index, 'title', (e.target as HTMLInputElement).value)}
										class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
									/>
								</div>
								<div>
									<label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Remediation Plan</label>
									<textarea
										value={item.remediation_plan}
										onchange={(e) => updateGeneratedItem(index, 'remediation_plan', (e.target as HTMLTextAreaElement).value)}
										rows="2"
										class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
									></textarea>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="flex items-center justify-between pt-4">
				<button
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
					onclick={() => (currentStep = 2)}
				>
					<i class="fa-solid fa-arrow-left mr-2"></i>
					Back
				</button>
				<button
					class="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
					onclick={createPOAMItems}
					disabled={creating || itemsToCreate.length === 0 || !systemGroupId}
				>
					{#if creating}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Creating ({createdCount}/{itemsToCreate.length})...
					{:else}
						<i class="fa-solid fa-check mr-2"></i>
						Create {itemsToCreate.length} POA&M Item{itemsToCreate.length !== 1 ? 's' : ''}
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<!-- Step 4: Complete -->
	{#if currentStep === 4}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<div class="text-center py-8">
				<div class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
					<i class="fa-solid fa-check text-3xl text-green-600 dark:text-green-400"></i>
				</div>
				<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">POA&M Items Created</h2>
				<p class="text-gray-600 dark:text-gray-400 mb-6">
					Successfully created {createdCount} of {itemsToCreate.length} POA&M item{itemsToCreate.length !== 1 ? 's' : ''} from {sourceType === 'vulnerability' ? 'vulnerability findings' : 'compliance findings'}.
				</p>

				{#if createdCount < itemsToCreate.length}
					<div class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400 max-w-md mx-auto">
						<i class="fa-solid fa-triangle-exclamation mr-2"></i>
						{itemsToCreate.length - createdCount} item{itemsToCreate.length - createdCount !== 1 ? 's' : ''} could not be created. This may be due to duplicate weakness IDs.
					</div>
				{/if}

				<div class="flex items-center justify-center gap-4">
					<a
						href="/poam"
						class="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
					>
						<i class="fa-solid fa-list mr-2"></i>
						View All POA&M Items
					</a>
					<button
						class="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
						onclick={() => {
							currentStep = 1;
							selectedFindings = new Set();
							generatedItems = [];
							itemsToCreate = [];
							createdCount = 0;
							selectAll = false;
						}}
					>
						<i class="fa-solid fa-rotate mr-2"></i>
						Generate More
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
