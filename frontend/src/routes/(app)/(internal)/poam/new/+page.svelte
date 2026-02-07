<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';
	import { goto } from '$app/navigation';

	interface Props {
		data: {
			title: string;
			systemGroups: any[];
			assessments: any[];
		};
	}

	let { data }: Props = $props();

	let loading = $state(false);
	let error = $state('');

	// Form fields
	let weaknessId = $state('');
	let title = $state('');
	let description = $state('');
	let sourceType = $state('assessment');
	let sourceReference = $state('');
	let systemGroupId = $state('');
	let assessmentId = $state('');
	let controlId = $state('');
	let riskLevel = $state('moderate');
	let likelihood = $state('moderate');
	let impactDescription = $state('');
	let estimatedCompletionDate = $state('');
	let responsibleOrganization = $state('');
	let pointOfContact = $state('');
	let contactEmail = $state('');
	let contactPhone = $state('');
	let remediationPlan = $state('');
	let resourcesRequired = $state('');
	let estimatedCost = $state('');
	let comments = $state('');
	let tagsInput = $state('');
	let isRecurring = $state(false);

	const sourceTypeOptions = [
		{ value: 'assessment', label: 'Security Assessment' },
		{ value: 'audit', label: 'Security Audit' },
		{ value: 'inspection', label: 'Security Inspection' },
		{ value: 'scan', label: 'Vulnerability Scan' },
		{ value: 'incident', label: 'Security Incident' },
		{ value: 'manual', label: 'Manual Entry' },
		{ value: 'other', label: 'Other' }
	];

	const riskLevelOptions = [
		{ value: 'very_low', label: 'Very Low' },
		{ value: 'low', label: 'Low' },
		{ value: 'moderate', label: 'Moderate' },
		{ value: 'high', label: 'High' },
		{ value: 'very_high', label: 'Very High' }
	];

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!weaknessId.trim() || !title.trim() || !description.trim() || !systemGroupId) {
			error = 'Please fill in all required fields: Weakness ID, Title, Description, and System Group.';
			return;
		}

		loading = true;
		error = '';

		try {
			const body: Record<string, any> = {
				weakness_id: weaknessId.trim(),
				title: title.trim(),
				description: description.trim(),
				source_type: sourceType,
				system_group_id: systemGroupId,
				risk_level: riskLevel,
				likelihood: likelihood
			};

			if (sourceReference.trim()) body.source_reference = sourceReference.trim();
			if (assessmentId) body.assessment_id = assessmentId;
			if (controlId.trim()) body.control_id = controlId.trim();
			if (impactDescription.trim()) body.impact_description = impactDescription.trim();
			if (estimatedCompletionDate) body.estimated_completion_date = estimatedCompletionDate;
			if (responsibleOrganization.trim()) body.responsible_organization = responsibleOrganization.trim();
			if (pointOfContact.trim()) body.point_of_contact = pointOfContact.trim();
			if (contactEmail.trim()) body.contact_email = contactEmail.trim();
			if (contactPhone.trim()) body.contact_phone = contactPhone.trim();
			if (remediationPlan.trim()) body.remediation_plan = remediationPlan.trim();
			if (resourcesRequired.trim()) body.resources_required = resourcesRequired.trim();
			if (estimatedCost) body.estimated_cost = parseFloat(estimatedCost);
			if (comments.trim()) body.comments = comments.trim();
			if (tagsInput.trim()) body.tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
			body.is_recurring = isRecurring;

			const response = await fetch(`${BASE_API_URL}/poam-items/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessages = Object.entries(errorData)
					.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
					.join('; ');
				throw new Error(errorMessages || `Creation failed: ${response.statusText}`);
			}

			const created = await response.json();
			goto(`/poam/${created.id}`);
		} catch (e: any) {
			error = e.message || 'Failed to create POA&M item';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>New POA&M Item</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
	<!-- Breadcrumb -->
	<nav class="flex items-center text-sm text-gray-500 dark:text-gray-400">
		<a href="/poam" class="hover:text-indigo-600 dark:hover:text-indigo-400">POA&M</a>
		<i class="fa-solid fa-chevron-right mx-2 text-xs"></i>
		<span class="text-gray-900 dark:text-white font-medium">New Item</span>
	</nav>

	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create New POA&M Item</h1>
		<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
			Document a security weakness and plan for remediation
		</p>
	</div>

	{#if error}
		<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
			<i class="fa-solid fa-circle-exclamation mr-2"></i>
			{error}
		</div>
	{/if}

	<form onsubmit={handleSubmit} class="space-y-8">
		<!-- Identification Section -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-5">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">
				<i class="fa-solid fa-fingerprint mr-2 text-indigo-600"></i>
				Identification
			</h2>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label for="weakness-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Weakness ID <span class="text-red-500">*</span>
					</label>
					<input
						id="weakness-id"
						type="text"
						bind:value={weaknessId}
						placeholder="e.g., V-12345, APP-001"
						required
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
				<div>
					<label for="source-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Source Type <span class="text-red-500">*</span>
					</label>
					<select
						id="source-type"
						bind:value={sourceType}
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					>
						{#each sourceTypeOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<div>
				<label for="title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Title <span class="text-red-500">*</span>
				</label>
				<input
					id="title"
					type="text"
					bind:value={title}
					placeholder="Short title describing the weakness"
					required
					class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				/>
			</div>

			<div>
				<label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Description <span class="text-red-500">*</span>
				</label>
				<textarea
					id="description"
					bind:value={description}
					rows="4"
					placeholder="Detailed description of the weakness, its context, and potential impact..."
					required
					class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				></textarea>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label for="source-reference" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Source Reference
					</label>
					<input
						id="source-reference"
						type="text"
						bind:value={sourceReference}
						placeholder="e.g., Scan Report #42"
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
				<div>
					<label for="control-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Control ID
					</label>
					<input
						id="control-id"
						type="text"
						bind:value={controlId}
						placeholder="e.g., AC-2, IA-5"
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
			</div>
		</div>

		<!-- Associations Section -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-5">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">
				<i class="fa-solid fa-link mr-2 text-indigo-600"></i>
				Associations
			</h2>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label for="system-group" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						System Group <span class="text-red-500">*</span>
					</label>
					<select
						id="system-group"
						bind:value={systemGroupId}
						required
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					>
						<option value="">Select a system group...</option>
						{#each data.systemGroups as group}
							<option value={group.id}>{group.name || group.str || group.id}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="assessment" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Compliance Assessment
					</label>
					<select
						id="assessment"
						bind:value={assessmentId}
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					>
						<option value="">None</option>
						{#each data.assessments as assessment}
							<option value={assessment.id}>{assessment.name || assessment.str || assessment.id}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<!-- Risk Assessment Section -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-5">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">
				<i class="fa-solid fa-gauge-high mr-2 text-indigo-600"></i>
				Risk Assessment
			</h2>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label for="risk-level" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Risk Level <span class="text-red-500">*</span>
					</label>
					<select
						id="risk-level"
						bind:value={riskLevel}
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					>
						{#each riskLevelOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="likelihood" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Likelihood
					</label>
					<select
						id="likelihood"
						bind:value={likelihood}
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					>
						{#each riskLevelOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<div>
				<label for="impact-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Impact Description
				</label>
				<textarea
					id="impact-description"
					bind:value={impactDescription}
					rows="3"
					placeholder="Describe the potential impact if this weakness is exploited..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				></textarea>
			</div>

			<div class="flex items-center gap-3">
				<input
					id="is-recurring"
					type="checkbox"
					bind:checked={isRecurring}
					class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
				/>
				<label for="is-recurring" class="text-sm text-gray-700 dark:text-gray-300">
					This is a recurring weakness
				</label>
			</div>
		</div>

		<!-- Remediation Plan Section -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-5">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">
				<i class="fa-solid fa-wrench mr-2 text-indigo-600"></i>
				Remediation Plan
			</h2>

			<div>
				<label for="remediation-plan" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Remediation Plan
				</label>
				<textarea
					id="remediation-plan"
					bind:value={remediationPlan}
					rows="4"
					placeholder="Describe the steps to remediate this weakness..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				></textarea>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label for="estimated-completion" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Estimated Completion Date
					</label>
					<input
						id="estimated-completion"
						type="date"
						bind:value={estimatedCompletionDate}
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
				<div>
					<label for="estimated-cost" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Estimated Cost ($)
					</label>
					<input
						id="estimated-cost"
						type="number"
						step="0.01"
						min="0"
						bind:value={estimatedCost}
						placeholder="0.00"
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
			</div>

			<div>
				<label for="resources-required" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Resources Required
				</label>
				<textarea
					id="resources-required"
					bind:value={resourcesRequired}
					rows="2"
					placeholder="Personnel, tools, budget, or other resources needed..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				></textarea>
			</div>
		</div>

		<!-- Point of Contact Section -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-5">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">
				<i class="fa-solid fa-user mr-2 text-indigo-600"></i>
				Point of Contact
			</h2>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div>
					<label for="responsible-org" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Responsible Organization
					</label>
					<input
						id="responsible-org"
						type="text"
						bind:value={responsibleOrganization}
						placeholder="e.g., IT Security Division"
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
				<div>
					<label for="poc-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Contact Name
					</label>
					<input
						id="poc-name"
						type="text"
						bind:value={pointOfContact}
						placeholder="Full name"
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
				<div>
					<label for="poc-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Email
					</label>
					<input
						id="poc-email"
						type="email"
						bind:value={contactEmail}
						placeholder="email@example.com"
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
				<div>
					<label for="poc-phone" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Phone
					</label>
					<input
						id="poc-phone"
						type="tel"
						bind:value={contactPhone}
						placeholder="+1 (555) 123-4567"
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
			</div>
		</div>

		<!-- Additional Info Section -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-5">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-3">
				<i class="fa-solid fa-tags mr-2 text-indigo-600"></i>
				Additional Information
			</h2>

			<div>
				<label for="comments" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Comments
				</label>
				<textarea
					id="comments"
					bind:value={comments}
					rows="3"
					placeholder="Any additional notes or comments..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				></textarea>
			</div>

			<div>
				<label for="tags" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Tags
				</label>
				<input
					id="tags"
					type="text"
					bind:value={tagsInput}
					placeholder="Comma-separated tags, e.g., fedramp, stig, high-priority"
					class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
				/>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Separate tags with commas</p>
			</div>
		</div>

		<!-- Form Actions -->
		<div class="flex items-center justify-end gap-4">
			<a
				href="/poam"
				class="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
			>
				Cancel
			</a>
			<button
				type="submit"
				class="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
				disabled={loading}
			>
				{#if loading}
					<i class="fa-solid fa-spinner fa-spin mr-2"></i>
				{/if}
				Create POA&M Item
			</button>
		</div>
	</form>
</div>
