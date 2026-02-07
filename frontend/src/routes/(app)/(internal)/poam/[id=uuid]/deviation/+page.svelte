<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';

	interface Props {
		data: {
			title: string;
			item: any;
			deviationRequests: any[];
		};
		form: {
			error?: string;
			deviationType?: string;
			justification?: string;
			compensatingControls?: string;
			riskAssessment?: string;
			expirationDate?: string;
		} | null;
	}

	let { data, form }: Props = $props();

	let deviationType = $state(form?.deviationType || '');
	let justification = $state(form?.justification || '');
	let compensatingControls = $state(form?.compensatingControls || '');
	let riskAssessment = $state(form?.riskAssessment || '');
	let expirationDate = $state(form?.expirationDate || '');

	let submitting = $state(false);

	const deviationTypes = [
		{
			value: 'false_positive',
			label: 'False Positive',
			description: 'The finding does not actually represent a real vulnerability or weakness.'
		},
		{
			value: 'vendor_dependency',
			label: 'Vendor Dependency',
			description: 'Remediation requires a vendor patch or update that is not yet available.'
		},
		{
			value: 'risk_adjustment',
			label: 'Risk Adjustment',
			description:
				'The risk level has been reassessed and does not warrant the standard remediation timeline.'
		},
		{
			value: 'compensating_control',
			label: 'Compensating Control',
			description:
				'An alternative control is in place that mitigates the risk to an acceptable level.'
		},
		{
			value: 'operational_requirement',
			label: 'Operational Requirement',
			description:
				'Operational constraints prevent standard remediation without unacceptable mission impact.'
		}
	];

	const showCompensatingControls = $derived(deviationType === 'compensating_control');

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			draft: 'bg-gray-100 text-gray-800',
			submitted: 'bg-blue-100 text-blue-800',
			under_review: 'bg-yellow-100 text-yellow-800',
			approved: 'bg-green-100 text-green-800',
			denied: 'bg-red-100 text-red-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	}

	function formatLabel(value: string): string {
		return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		try {
			return new Date(dateStr).toLocaleDateString();
		} catch {
			return dateStr;
		}
	}
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
	<!-- Back link -->
	<div>
		<a
			href="/poam/{page.params.id}"
			class="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
		>
			<i class="fa-solid fa-arrow-left mr-2"></i>
			Back to POA&M Item
		</a>
	</div>

	{#if !data.item}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
			<i class="fa-solid fa-circle-exclamation text-red-600 dark:text-red-400 text-3xl mb-3"></i>
			<h2 class="text-lg font-semibold text-red-800 dark:text-red-300">POA&M Item Not Found</h2>
			<p class="mt-2 text-red-600 dark:text-red-400">
				The requested POA&M item could not be loaded. It may have been deleted or you may not have
				access.
			</p>
			<a
				href="/poam"
				class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
			>
				Return to POA&M List
			</a>
		</div>
	{:else}
		<!-- Header -->
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Request Deviation</h1>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Submit a deviation request for POA&M item
				<span class="font-mono font-semibold text-indigo-600 dark:text-indigo-400"
					>{data.item.weakness_id}</span
				>
				&mdash; {data.item.title}
			</p>
		</div>

		<!-- Error display -->
		{#if form?.error}
			<div
				class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400"
			>
				<i class="fa-solid fa-circle-exclamation mr-2"></i>
				{form.error}
			</div>
		{/if}

		<!-- POA&M Item Context Card -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border-l-4 border-indigo-500">
			<h2 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
				POA&M Item Details
			</h2>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<div>
					<span class="text-xs text-gray-500 dark:text-gray-400">Weakness ID</span>
					<p class="font-mono font-medium text-gray-900 dark:text-white">
						{data.item.weakness_id}
					</p>
				</div>
				<div>
					<span class="text-xs text-gray-500 dark:text-gray-400">Risk Level</span>
					<p class="font-medium text-gray-900 dark:text-white">
						{formatLabel(data.item.risk_level)}
					</p>
				</div>
				<div>
					<span class="text-xs text-gray-500 dark:text-gray-400">Status</span>
					<p class="font-medium text-gray-900 dark:text-white">
						{formatLabel(data.item.status)}
					</p>
				</div>
			</div>
			{#if data.item.control_id}
				<div class="mt-3">
					<span class="text-xs text-gray-500 dark:text-gray-400">Associated Control</span>
					<p class="font-mono text-gray-900 dark:text-white">{data.item.control_id}</p>
				</div>
			{/if}
		</div>

		<!-- Existing Deviation Requests -->
		{#if data.deviationRequests && data.deviationRequests.length > 0}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
				<h2 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
					Previous Deviation Requests
				</h2>
				<div class="space-y-3">
					{#each data.deviationRequests as devReq}
						<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<span class="text-sm font-medium text-gray-900 dark:text-white">
										{formatLabel(devReq.deviation_type)}
									</span>
									<span
										class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(
											devReq.status
										)}"
									>
										{formatLabel(devReq.status)}
									</span>
								</div>
								<span class="text-xs text-gray-500 dark:text-gray-400">
									{formatDate(devReq.requested_at)}
								</span>
							</div>
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
								{devReq.justification}
							</p>
							{#if devReq.review_notes}
								<p class="mt-1 text-sm text-amber-700 dark:text-amber-400">
									<strong>Review:</strong>
									{devReq.review_notes}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Deviation Request Form -->
		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
			class="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700"
		>
			<div class="p-6">
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
					New Deviation Request
				</h2>
				<p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
					Provide details about why this POA&M item requires a deviation from the standard
					remediation process.
				</p>

				<div class="space-y-6">
					<!-- Deviation Type -->
					<div>
						<label
							for="deviation_type"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
						>
							Deviation Type <span class="text-red-500">*</span>
						</label>
						<div class="space-y-3">
							{#each deviationTypes as dt}
								<label
									class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors {deviationType ===
									dt.value
										? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400'
										: 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}"
								>
									<input
										type="radio"
										name="deviation_type"
										value={dt.value}
										bind:group={deviationType}
										class="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
									/>
									<div>
										<span
											class="text-sm font-medium text-gray-900 dark:text-white"
											>{dt.label}</span
										>
										<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
											{dt.description}
										</p>
									</div>
								</label>
							{/each}
						</div>
					</div>

					<!-- Justification -->
					<div>
						<label
							for="justification"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Justification <span class="text-red-500">*</span>
						</label>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
							Provide a detailed explanation for why this deviation is necessary.
						</p>
						<textarea
							id="justification"
							name="justification"
							rows="4"
							bind:value={justification}
							required
							placeholder="Explain why the standard remediation approach is not feasible or appropriate..."
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
						></textarea>
					</div>

					<!-- Compensating Controls (conditional) -->
					{#if showCompensatingControls}
						<div
							class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4"
						>
							<label
								for="compensating_controls"
								class="block text-sm font-medium text-amber-800 dark:text-amber-300 mb-1"
							>
								Compensating Controls <span class="text-red-500">*</span>
							</label>
							<p class="text-xs text-amber-700 dark:text-amber-400 mb-2">
								Describe the compensating controls that are in place to mitigate the risk.
							</p>
							<textarea
								id="compensating_controls"
								name="compensating_controls"
								rows="3"
								bind:value={compensatingControls}
								required
								placeholder="Describe the alternative or compensating controls that address the underlying risk..."
								class="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 dark:bg-gray-700 dark:text-white text-sm"
							></textarea>
						</div>
					{:else}
						<input type="hidden" name="compensating_controls" value={compensatingControls} />
					{/if}

					<!-- Risk Assessment -->
					<div>
						<label
							for="risk_assessment"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Risk Assessment
						</label>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
							Describe the residual risk with this deviation in place (optional but recommended).
						</p>
						<textarea
							id="risk_assessment"
							name="risk_assessment"
							rows="3"
							bind:value={riskAssessment}
							placeholder="Describe the residual risk level and potential impact if this deviation is approved..."
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
						></textarea>
					</div>

					<!-- Expiration Date -->
					<div>
						<label
							for="expiration_date"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Expiration Date
						</label>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
							When should this deviation be re-evaluated? Leave blank if no expiration is needed.
						</p>
						<input
							type="date"
							id="expiration_date"
							name="expiration_date"
							bind:value={expirationDate}
							class="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
						/>
					</div>
				</div>
			</div>

			<!-- Form Actions -->
			<div class="px-6 py-4 bg-gray-50 dark:bg-gray-750 flex items-center justify-between rounded-b-lg">
				<a
					href="/poam/{page.params.id}"
					class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
				>
					Cancel
				</a>
				<button
					type="submit"
					disabled={submitting || !deviationType || !justification.trim()}
					class="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if submitting}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						Submitting...
					{:else}
						<i class="fa-solid fa-paper-plane mr-2"></i>
						Submit Deviation Request
					{/if}
				</button>
			</div>
		</form>
	{/if}
</div>
