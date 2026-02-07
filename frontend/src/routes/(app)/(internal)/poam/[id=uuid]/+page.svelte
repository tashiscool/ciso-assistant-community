<script lang="ts">
	import { BASE_API_URL } from '$lib/utils/constants';
	import { goto } from '$app/navigation';

	interface Props {
		data: {
			title: string;
			item: any;
		};
	}

	let { data }: Props = $props();

	let item = $state(data.item);
	let loading = $state(false);
	let actionError = $state('');
	let actionSuccess = $state('');

	// Modal states
	let showMilestoneForm = $state(false);
	let showEvidenceForm = $state(false);
	let showDeviationForm = $state(false);
	let showRejectForm = $state(false);
	let showReviewForm = $state(false);

	// Form data
	let milestoneDescription = $state('');
	let milestoneTargetDate = $state('');
	let evidenceType = $state<'before_remediation' | 'after_remediation' | 'supporting'>('before_remediation');
	let evidenceDescription = $state('');
	let evidenceUrl = $state('');
	let deviationJustification = $state('');
	let rejectReason = $state('');
	let reviewDate = $state('');

	// Active detail tab
	let activeTab = $state<'overview' | 'remediation' | 'milestones' | 'evidence' | 'deviation' | 'timeline'>('overview');

	function getRiskLevelColor(level: string): string {
		const colors: Record<string, string> = {
			very_high: 'bg-red-100 text-red-800 border-red-200',
			high: 'bg-orange-100 text-orange-800 border-orange-200',
			moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
			low: 'bg-green-100 text-green-800 border-green-200',
			very_low: 'bg-blue-100 text-blue-800 border-blue-200'
		};
		return colors[level] || 'bg-gray-100 text-gray-800 border-gray-200';
	}

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			draft: 'bg-gray-100 text-gray-800',
			submitted: 'bg-blue-100 text-blue-800',
			approved: 'bg-green-100 text-green-800',
			rejected: 'bg-red-100 text-red-800',
			in_progress: 'bg-yellow-100 text-yellow-800',
			completed: 'bg-emerald-100 text-emerald-800',
			cancelled: 'bg-slate-100 text-slate-800',
			deferred: 'bg-purple-100 text-purple-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	}

	function getMilestoneStatusColor(status: string): string {
		const colors: Record<string, string> = {
			pending: 'bg-gray-100 text-gray-700',
			in_progress: 'bg-blue-100 text-blue-700',
			completed: 'bg-green-100 text-green-700',
			overdue: 'bg-red-100 text-red-700'
		};
		return colors[status] || 'bg-gray-100 text-gray-700';
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

	function formatDateTime(dateStr: string | null): string {
		if (!dateStr) return '-';
		try {
			return new Date(dateStr).toLocaleString();
		} catch {
			return dateStr;
		}
	}

	async function performAction(actionUrl: string, body: any = {}) {
		loading = true;
		actionError = '';
		actionSuccess = '';

		try {
			const response = await fetch(actionUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || errorData.detail || `Action failed: ${response.statusText}`);
			}

			const updatedItem = await response.json();
			item = updatedItem;
			actionSuccess = 'Action completed successfully';
			setTimeout(() => (actionSuccess = ''), 3000);
		} catch (e: any) {
			actionError = e.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/submit/`);
	}

	async function handleApprove() {
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/approve/`);
	}

	async function handleReject() {
		if (!rejectReason.trim()) {
			actionError = 'Please provide a reason for rejection';
			return;
		}
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/reject/`, { reason: rejectReason });
		showRejectForm = false;
		rejectReason = '';
	}

	async function handleStartRemediation() {
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/start_remediation/`);
	}

	async function handleCompleteRemediation() {
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/complete_remediation/`);
	}

	async function handleAddMilestone() {
		if (!milestoneDescription.trim() || !milestoneTargetDate) {
			actionError = 'Milestone description and target date are required';
			return;
		}
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/add_milestone/`, {
			description: milestoneDescription,
			target_date: milestoneTargetDate,
			status: 'pending'
		});
		milestoneDescription = '';
		milestoneTargetDate = '';
		showMilestoneForm = false;
	}

	async function handleUpdateMilestone(milestoneId: string, newStatus: string) {
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/update_milestone/`, {
			milestone_id: milestoneId,
			status: newStatus,
			actual_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : null
		});
	}

	async function handleAddEvidence() {
		if (!evidenceDescription.trim()) {
			actionError = 'Evidence description is required';
			return;
		}
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/add_evidence/`, {
			evidence_type: evidenceType,
			evidence_data: {
				description: evidenceDescription,
				url: evidenceUrl || null,
				added_at: new Date().toISOString()
			}
		});
		evidenceDescription = '';
		evidenceUrl = '';
		showEvidenceForm = false;
	}

	async function handleRequestDeviation() {
		if (!deviationJustification.trim()) {
			actionError = 'Deviation justification is required';
			return;
		}
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/request_deviation/`, {
			justification: deviationJustification
		});
		deviationJustification = '';
		showDeviationForm = false;
	}

	async function handleApproveDeviation() {
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/approve_deviation/`);
	}

	async function handleScheduleReview() {
		if (!reviewDate) {
			actionError = 'Review date is required';
			return;
		}
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/schedule_review/`, {
			review_date: reviewDate
		});
		reviewDate = '';
		showReviewForm = false;
	}

	async function handleMarkReviewed() {
		await performAction(`${BASE_API_URL}/poam-items/${item.id}/mark_reviewed/`);
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this POA&M item? This action cannot be undone.')) return;

		loading = true;
		try {
			const response = await fetch(`${BASE_API_URL}/poam-items/${item.id}/`, {
				method: 'DELETE'
			});
			if (response.ok) {
				goto('/poam');
			} else {
				actionError = 'Failed to delete item';
			}
		} catch (e: any) {
			actionError = e.message || 'Delete failed';
		} finally {
			loading = false;
		}
	}

	// Available actions based on current status
	const availableActions = $derived.by(() => {
		if (!item) return [];
		const actions: { label: string; icon: string; handler: () => void; color: string }[] = [];

		switch (item.status) {
			case 'draft':
				actions.push(
					{ label: 'Submit for Approval', icon: 'fa-paper-plane', handler: handleSubmit, color: 'bg-blue-600 hover:bg-blue-700 text-white' },
					{ label: 'Start Remediation', icon: 'fa-play', handler: handleStartRemediation, color: 'bg-yellow-600 hover:bg-yellow-700 text-white' }
				);
				break;
			case 'submitted':
				actions.push(
					{ label: 'Approve', icon: 'fa-check', handler: handleApprove, color: 'bg-green-600 hover:bg-green-700 text-white' },
					{ label: 'Reject', icon: 'fa-times', handler: () => (showRejectForm = true), color: 'bg-red-600 hover:bg-red-700 text-white' }
				);
				break;
			case 'approved':
				actions.push(
					{ label: 'Start Remediation', icon: 'fa-play', handler: handleStartRemediation, color: 'bg-yellow-600 hover:bg-yellow-700 text-white' }
				);
				break;
			case 'in_progress':
				actions.push(
					{ label: 'Complete Remediation', icon: 'fa-check-double', handler: handleCompleteRemediation, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' }
				);
				break;
		}

		if (!item.has_deviation && !['completed', 'cancelled'].includes(item.status)) {
			actions.push(
				{ label: 'Request Deviation', icon: 'fa-code-branch', handler: () => (showDeviationForm = true), color: 'bg-purple-600 hover:bg-purple-700 text-white' }
			);
		}

		return actions;
	});
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

{#if !item}
	<div class="max-w-4xl mx-auto px-4 py-16 text-center">
		<i class="fa-solid fa-circle-exclamation text-6xl text-gray-300 mb-4"></i>
		<h2 class="text-2xl font-bold text-gray-900 dark:text-white">POA&M Item Not Found</h2>
		<p class="mt-2 text-gray-500">The requested item could not be loaded.</p>
		<a
			href="/poam"
			class="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
		>
			<i class="fa-solid fa-arrow-left mr-2"></i>
			Back to POA&M List
		</a>
	</div>
{:else}
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
		<!-- Breadcrumb -->
		<nav class="flex items-center text-sm text-gray-500 dark:text-gray-400">
			<a href="/poam" class="hover:text-indigo-600 dark:hover:text-indigo-400">POA&M</a>
			<i class="fa-solid fa-chevron-right mx-2 text-xs"></i>
			<span class="text-gray-900 dark:text-white font-medium">{item.weakness_id}</span>
		</nav>

		<!-- Header -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
				<div class="flex-1">
					<div class="flex flex-wrap items-center gap-3 mb-2">
						<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{item.weakness_id}</h1>
						<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border {getRiskLevelColor(item.risk_level)}">
							{formatLabel(item.risk_level)} Risk
						</span>
						<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium {getStatusColor(item.status)}">
							{formatLabel(item.status)}
						</span>
						{#if item.is_overdue}
							<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
								<i class="fa-solid fa-clock mr-1.5"></i>
								{item.days_overdue} {item.days_overdue === 1 ? 'day' : 'days'} overdue
							</span>
						{/if}
						{#if item.has_deviation}
							<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
								<i class="fa-solid fa-code-branch mr-1.5"></i>
								Deviation {item.deviation_approved ? 'Approved' : 'Pending'}
							</span>
						{/if}
					</div>
					<h2 class="text-lg text-gray-700 dark:text-gray-300">{item.title}</h2>

					{#if item.completion_percentage !== undefined && item.completion_percentage !== null}
						<div class="mt-3 flex items-center gap-3">
							<div class="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
								<div
									class="bg-indigo-600 h-2.5 rounded-full transition-all"
									style="width: {item.completion_percentage}%"
								></div>
							</div>
							<span class="text-sm text-gray-600 dark:text-gray-400">{item.completion_percentage}% complete</span>
						</div>
					{/if}
				</div>

				<div class="flex flex-wrap gap-2">
					{#each availableActions as action}
						<button
							class="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium {action.color} disabled:opacity-50"
							onclick={action.handler}
							disabled={loading}
						>
							<i class="fa-solid {action.icon} mr-2"></i>
							{action.label}
						</button>
					{/each}

					<button
						class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
						onclick={() => (showReviewForm = true)}
					>
						<i class="fa-solid fa-calendar-check mr-2"></i>
						Schedule Review
					</button>

					{#if item.next_review_date}
						<button
							class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
							onclick={handleMarkReviewed}
							disabled={loading}
						>
							<i class="fa-solid fa-check mr-2"></i>
							Mark Reviewed
						</button>
					{/if}

					<button
						class="inline-flex items-center px-3 py-2 border border-red-300 rounded-md text-sm text-red-700 bg-white hover:bg-red-50 dark:bg-gray-700 dark:text-red-400 dark:border-red-600"
						onclick={handleDelete}
						disabled={loading}
					>
						<i class="fa-solid fa-trash mr-2"></i>
						Delete
					</button>
				</div>
			</div>
		</div>

		<!-- Alerts -->
		{#if actionError}
			<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
				<i class="fa-solid fa-circle-exclamation mr-2"></i>
				{actionError}
				<button class="ml-4 underline text-sm" onclick={() => (actionError = '')}>Dismiss</button>
			</div>
		{/if}

		{#if actionSuccess}
			<div class="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
				<i class="fa-solid fa-check-circle mr-2"></i>
				{actionSuccess}
			</div>
		{/if}

		<!-- Tabs -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="border-b border-gray-200 dark:border-gray-700">
				<nav class="flex -mb-px overflow-x-auto">
					{#each [
						{ id: 'overview', label: 'Overview', icon: 'fa-info-circle' },
						{ id: 'remediation', label: 'Remediation', icon: 'fa-wrench' },
						{ id: 'milestones', label: 'Milestones', icon: 'fa-flag', count: item.milestones?.length || 0 },
						{ id: 'evidence', label: 'Evidence', icon: 'fa-file-lines', count: (item.evidence_before?.length || 0) + (item.evidence_after?.length || 0) + (item.supporting_documents?.length || 0) },
						{ id: 'deviation', label: 'Deviation', icon: 'fa-code-branch' },
						{ id: 'timeline', label: 'Timeline', icon: 'fa-clock-rotate-left' }
					] as tab}
						<button
							class="px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors {activeTab === tab.id
								? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
								: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'}"
							onclick={() => (activeTab = tab.id as any)}
						>
							<i class="fa-solid {tab.icon} mr-2"></i>
							{tab.label}
							{#if tab.count !== undefined && tab.count > 0}
								<span class="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
									{tab.count}
								</span>
							{/if}
						</button>
					{/each}
				</nav>
			</div>

			<div class="p-6">
				<!-- Overview Tab -->
				{#if activeTab === 'overview'}
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<div class="space-y-4">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Description</h3>
							<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
								{item.description || 'No description provided.'}
							</p>

							{#if item.impact_description}
								<div>
									<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Impact Description</h4>
									<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.impact_description}</p>
								</div>
							{/if}

							{#if item.comments}
								<div>
									<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Comments</h4>
									<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.comments}</p>
								</div>
							{/if}
						</div>

						<div class="space-y-4">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Details</h3>
							<dl class="grid grid-cols-2 gap-x-4 gap-y-3">
								<div>
									<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Source Type</dt>
									<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatLabel(item.source_type)}</dd>
								</div>
								{#if item.source_reference}
									<div>
										<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Source Reference</dt>
										<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{item.source_reference}</dd>
									</div>
								{/if}
								{#if item.control_id}
									<div>
										<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Control ID</dt>
										<dd class="mt-0.5 text-sm font-mono text-gray-900 dark:text-white">{item.control_id}</dd>
									</div>
								{/if}
								{#if item.cci_ids && item.cci_ids.length > 0}
									<div>
										<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">CCI IDs</dt>
										<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{item.cci_ids.join(', ')}</dd>
									</div>
								{/if}
								<div>
									<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Likelihood</dt>
									<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatLabel(item.likelihood)}</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Identified Date</dt>
									<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDate(item.identified_date)}</dd>
								</div>
								{#if item.submitted_date}
									<div>
										<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Submitted Date</dt>
										<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDate(item.submitted_date)}</dd>
									</div>
								{/if}
								{#if item.approved_date}
									<div>
										<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Approved Date</dt>
										<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDate(item.approved_date)}</dd>
									</div>
								{/if}
								<div>
									<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Recurring</dt>
									<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{item.is_recurring ? 'Yes' : 'No'}</dd>
								</div>
								{#if item.last_reviewed_date}
									<div>
										<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Reviewed</dt>
										<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDate(item.last_reviewed_date)}</dd>
									</div>
								{/if}
								{#if item.next_review_date}
									<div>
										<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Next Review</dt>
										<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDate(item.next_review_date)}</dd>
									</div>
								{/if}
								<div>
									<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
									<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDateTime(item.created_at)}</dd>
								</div>
								<div>
									<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
									<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDateTime(item.updated_at)}</dd>
								</div>
							</dl>

							{#if item.tags && item.tags.length > 0}
								<div>
									<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</h4>
									<div class="flex flex-wrap gap-2">
										{#each item.tags as tag}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
												{tag}
											</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>

				<!-- Remediation Tab -->
				{:else if activeTab === 'remediation'}
					<div class="space-y-6">
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<div class="space-y-4">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Remediation Plan</h3>
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
									<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
										{item.remediation_plan || 'No remediation plan defined yet.'}
									</p>
								</div>

								{#if item.resources_required}
									<div>
										<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Resources Required</h4>
										<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{item.resources_required}</p>
									</div>
								{/if}

								{#if item.estimated_cost !== null && item.estimated_cost !== undefined}
									<div>
										<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Estimated Cost</h4>
										<p class="text-sm text-gray-900 dark:text-white font-semibold">
											${Number(item.estimated_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}
										</p>
									</div>
								{/if}
							</div>

							<div class="space-y-4">
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Schedule & Contact</h3>
								<dl class="space-y-3">
									<div>
										<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Completion</dt>
										<dd class="mt-0.5 text-sm {item.is_overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-900 dark:text-white'}">
											{formatDate(item.estimated_completion_date)}
											{#if item.is_overdue}
												<span class="ml-2 text-xs">({item.days_overdue} days overdue)</span>
											{/if}
										</dd>
									</div>
									{#if item.actual_completion_date}
										<div>
											<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Actual Completion</dt>
											<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{formatDate(item.actual_completion_date)}</dd>
										</div>
									{/if}
									{#if item.responsible_organization}
										<div>
											<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Responsible Organization</dt>
											<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{item.responsible_organization}</dd>
										</div>
									{/if}
									{#if item.point_of_contact}
										<div>
											<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Point of Contact</dt>
											<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{item.point_of_contact}</dd>
										</div>
									{/if}
									{#if item.contact_email}
										<div>
											<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Email</dt>
											<dd class="mt-0.5 text-sm text-indigo-600 dark:text-indigo-400">
												<a href="mailto:{item.contact_email}">{item.contact_email}</a>
											</dd>
										</div>
									{/if}
									{#if item.contact_phone}
										<div>
											<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Contact Phone</dt>
											<dd class="mt-0.5 text-sm text-gray-900 dark:text-white">{item.contact_phone}</dd>
										</div>
									{/if}
								</dl>
							</div>
						</div>
					</div>

				<!-- Milestones Tab -->
				{:else if activeTab === 'milestones'}
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
								Milestones ({item.milestones?.length || 0})
							</h3>
							<button
								class="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
								onclick={() => (showMilestoneForm = true)}
							>
								<i class="fa-solid fa-plus mr-2"></i>
								Add Milestone
							</button>
						</div>

						{#if showMilestoneForm}
							<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
								<h4 class="font-medium text-gray-900 dark:text-white">New Milestone</h4>
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<label for="milestone-desc" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
										<input
											id="milestone-desc"
											type="text"
											bind:value={milestoneDescription}
											placeholder="Milestone description..."
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										/>
									</div>
									<div>
										<label for="milestone-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
										<input
											id="milestone-date"
											type="date"
											bind:value={milestoneTargetDate}
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										/>
									</div>
								</div>
								<div class="flex gap-3">
									<button
										class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
										onclick={handleAddMilestone}
										disabled={loading}
									>
										{#if loading}
											<i class="fa-solid fa-spinner fa-spin mr-2"></i>
										{/if}
										Add Milestone
									</button>
									<button
										class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200"
										onclick={() => (showMilestoneForm = false)}
									>
										Cancel
									</button>
								</div>
							</div>
						{/if}

						{#if !item.milestones || item.milestones.length === 0}
							<div class="text-center py-10">
								<i class="fa-solid fa-flag text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
								<p class="text-gray-500 dark:text-gray-400">No milestones defined yet</p>
								<p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Add milestones to track remediation progress</p>
							</div>
						{:else}
							<div class="space-y-3">
								{#each item.milestones as milestone, index}
									{@const milestoneOverdue = milestone.status !== 'completed' && milestone.target_date && new Date(milestone.target_date) < new Date()}
									<div class="bg-white dark:bg-gray-800 border {milestoneOverdue ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'} rounded-lg p-4">
										<div class="flex items-start justify-between">
											<div class="flex-1">
												<div class="flex items-center gap-3 mb-1">
													<span class="text-sm font-medium text-gray-400 dark:text-gray-500">#{index + 1}</span>
													<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getMilestoneStatusColor(milestone.status)}">
														{formatLabel(milestone.status)}
													</span>
													{#if milestoneOverdue}
														<span class="text-xs text-red-600 dark:text-red-400 font-medium">
															<i class="fa-solid fa-clock mr-1"></i> Overdue
														</span>
													{/if}
												</div>
												<p class="text-sm text-gray-900 dark:text-white">{milestone.description}</p>
												<div class="mt-1 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
													<span>Target: {formatDate(milestone.target_date)}</span>
													{#if milestone.actual_date}
														<span>Completed: {formatDate(milestone.actual_date)}</span>
													{/if}
													{#if milestone.updated_at}
														<span>Updated: {formatDateTime(milestone.updated_at)}</span>
													{/if}
												</div>
											</div>
											{#if milestone.status !== 'completed'}
												<div class="flex gap-2 ml-4">
													{#if milestone.status === 'pending'}
														<button
															class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
															onclick={() => handleUpdateMilestone(milestone.id, 'in_progress')}
														>
															Start
														</button>
													{/if}
													<button
														class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
														onclick={() => handleUpdateMilestone(milestone.id, 'completed')}
													>
														Complete
													</button>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

				<!-- Evidence Tab -->
				{:else if activeTab === 'evidence'}
					<div class="space-y-6">
						<div class="flex items-center justify-between">
							<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Evidence</h3>
							<button
								class="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
								onclick={() => (showEvidenceForm = true)}
							>
								<i class="fa-solid fa-plus mr-2"></i>
								Add Evidence
							</button>
						</div>

						{#if showEvidenceForm}
							<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
								<h4 class="font-medium text-gray-900 dark:text-white">New Evidence</h4>
								<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
									<div>
										<label for="evidence-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
										<select
											id="evidence-type"
											bind:value={evidenceType}
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										>
											<option value="before_remediation">Before Remediation</option>
											<option value="after_remediation">After Remediation</option>
											<option value="supporting">Supporting Document</option>
										</select>
									</div>
									<div>
										<label for="evidence-desc" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
										<input
											id="evidence-desc"
											type="text"
											bind:value={evidenceDescription}
											placeholder="Evidence description..."
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										/>
									</div>
									<div>
										<label for="evidence-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL (optional)</label>
										<input
											id="evidence-url"
											type="url"
											bind:value={evidenceUrl}
											placeholder="https://..."
											class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										/>
									</div>
								</div>
								<div class="flex gap-3">
									<button
										class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
										onclick={handleAddEvidence}
										disabled={loading}
									>
										{#if loading}
											<i class="fa-solid fa-spinner fa-spin mr-2"></i>
										{/if}
										Add Evidence
									</button>
									<button
										class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200"
										onclick={() => (showEvidenceForm = false)}
									>
										Cancel
									</button>
								</div>
							</div>
						{/if}

						<!-- Before Remediation -->
						<div>
							<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center">
								<i class="fa-solid fa-circle-xmark mr-2 text-red-500"></i>
								Before Remediation ({item.evidence_before?.length || 0})
							</h4>
							{#if item.evidence_before && item.evidence_before.length > 0}
								<div class="space-y-2">
									{#each item.evidence_before as evidence}
										<div class="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg p-3">
											<div class="flex items-start justify-between">
												<div>
													<p class="text-sm text-gray-900 dark:text-white">{evidence.data?.description || 'Evidence'}</p>
													{#if evidence.data?.url}
														<a href={evidence.data.url} target="_blank" rel="noopener noreferrer" class="text-xs text-indigo-600 hover:underline">
															<i class="fa-solid fa-external-link mr-1"></i>{evidence.data.url}
														</a>
													{/if}
												</div>
												<span class="text-xs text-gray-500">{formatDateTime(evidence.added_at)}</span>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-gray-400 dark:text-gray-500 italic">No evidence added</p>
							{/if}
						</div>

						<!-- After Remediation -->
						<div>
							<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center">
								<i class="fa-solid fa-circle-check mr-2 text-green-500"></i>
								After Remediation ({item.evidence_after?.length || 0})
							</h4>
							{#if item.evidence_after && item.evidence_after.length > 0}
								<div class="space-y-2">
									{#each item.evidence_after as evidence}
										<div class="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20 rounded-lg p-3">
											<div class="flex items-start justify-between">
												<div>
													<p class="text-sm text-gray-900 dark:text-white">{evidence.data?.description || 'Evidence'}</p>
													{#if evidence.data?.url}
														<a href={evidence.data.url} target="_blank" rel="noopener noreferrer" class="text-xs text-indigo-600 hover:underline">
															<i class="fa-solid fa-external-link mr-1"></i>{evidence.data.url}
														</a>
													{/if}
												</div>
												<span class="text-xs text-gray-500">{formatDateTime(evidence.added_at)}</span>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-gray-400 dark:text-gray-500 italic">No evidence added</p>
							{/if}
						</div>

						<!-- Supporting Documents -->
						<div>
							<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center">
								<i class="fa-solid fa-paperclip mr-2 text-blue-500"></i>
								Supporting Documents ({item.supporting_documents?.length || 0})
							</h4>
							{#if item.supporting_documents && item.supporting_documents.length > 0}
								<div class="space-y-2">
									{#each item.supporting_documents as doc}
										<div class="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-lg p-3">
											<div class="flex items-start justify-between">
												<div>
													<p class="text-sm text-gray-900 dark:text-white">{doc.data?.description || 'Document'}</p>
													{#if doc.data?.url}
														<a href={doc.data.url} target="_blank" rel="noopener noreferrer" class="text-xs text-indigo-600 hover:underline">
															<i class="fa-solid fa-external-link mr-1"></i>{doc.data.url}
														</a>
													{/if}
												</div>
												<span class="text-xs text-gray-500">{formatDateTime(doc.added_at)}</span>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-gray-400 dark:text-gray-500 italic">No supporting documents</p>
							{/if}
						</div>
					</div>

				<!-- Deviation Tab -->
				{:else if activeTab === 'deviation'}
					<div class="space-y-6">
						{#if item.has_deviation}
							<div class="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/20 rounded-lg p-6">
								<div class="flex items-center gap-3 mb-4">
									<i class="fa-solid fa-code-branch text-purple-600 text-xl"></i>
									<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Deviation Request</h3>
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {item.deviation_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
										{item.deviation_approved ? 'Approved' : 'Pending Approval'}
									</span>
								</div>

								<div class="space-y-4">
									<div>
										<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Justification</h4>
										<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
											{item.deviation_justification}
										</p>
									</div>

									{#if item.deviation_approval_date}
										<div>
											<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Approval Date</h4>
											<p class="text-sm text-gray-900 dark:text-white">{formatDate(item.deviation_approval_date)}</p>
										</div>
									{/if}

									{#if !item.deviation_approved}
										<button
											class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
											onclick={handleApproveDeviation}
											disabled={loading}
										>
											<i class="fa-solid fa-check mr-2"></i>
											Approve Deviation
										</button>
									{/if}
								</div>
							</div>
						{:else}
							<div class="text-center py-10">
								<i class="fa-solid fa-code-branch text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
								<p class="text-gray-500 dark:text-gray-400">No deviation request</p>
								<p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
									Request a deviation if remediation cannot be completed as planned
								</p>
								{#if !['completed', 'cancelled'].includes(item.status)}
									<button
										class="mt-4 inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700"
										onclick={() => (showDeviationForm = true)}
									>
										<i class="fa-solid fa-plus mr-2"></i>
										Request Deviation
									</button>
								{/if}
							</div>
						{/if}

						{#if showDeviationForm}
							<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
								<h4 class="font-medium text-gray-900 dark:text-white">Deviation Request</h4>
								<div>
									<label for="deviation-justification" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										Justification
									</label>
									<textarea
										id="deviation-justification"
										bind:value={deviationJustification}
										rows="4"
										placeholder="Explain why remediation cannot be completed as planned and any compensating controls in place..."
										class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
									></textarea>
								</div>
								<div class="flex gap-3">
									<button
										class="px-4 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700 disabled:opacity-50"
										onclick={handleRequestDeviation}
										disabled={loading}
									>
										{#if loading}
											<i class="fa-solid fa-spinner fa-spin mr-2"></i>
										{/if}
										Submit Deviation Request
									</button>
									<button
										class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200"
										onclick={() => (showDeviationForm = false)}
									>
										Cancel
									</button>
								</div>
							</div>
						{/if}
					</div>

				<!-- Timeline Tab -->
				{:else if activeTab === 'timeline'}
					<div class="space-y-4">
						<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Audit Timeline</h3>
						<div class="relative border-l-2 border-indigo-200 dark:border-indigo-800 ml-4">
							<!-- Created -->
							<div class="mb-6 ml-6 relative">
								<div class="absolute -left-[33px] w-4 h-4 bg-indigo-600 rounded-full border-2 border-white dark:border-gray-800"></div>
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-xs font-medium text-indigo-600 dark:text-indigo-400">Created</span>
										<span class="text-xs text-gray-500">{formatDateTime(item.created_at)}</span>
									</div>
									<p class="text-sm text-gray-700 dark:text-gray-300">
										POA&M item <strong>{item.weakness_id}</strong> created with risk level <strong>{formatLabel(item.risk_level)}</strong>
									</p>
								</div>
							</div>

							{#if item.submitted_date}
								<div class="mb-6 ml-6 relative">
									<div class="absolute -left-[33px] w-4 h-4 bg-blue-600 rounded-full border-2 border-white dark:border-gray-800"></div>
									<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-xs font-medium text-blue-600 dark:text-blue-400">Submitted</span>
											<span class="text-xs text-gray-500">{formatDate(item.submitted_date)}</span>
										</div>
										<p class="text-sm text-gray-700 dark:text-gray-300">Item submitted for approval</p>
									</div>
								</div>
							{/if}

							{#if item.approved_date}
								<div class="mb-6 ml-6 relative">
									<div class="absolute -left-[33px] w-4 h-4 bg-green-600 rounded-full border-2 border-white dark:border-gray-800"></div>
									<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-xs font-medium text-green-600 dark:text-green-400">Approved</span>
											<span class="text-xs text-gray-500">{formatDate(item.approved_date)}</span>
										</div>
										<p class="text-sm text-gray-700 dark:text-gray-300">POA&M item approved</p>
									</div>
								</div>
							{/if}

							{#if item.status === 'in_progress'}
								<div class="mb-6 ml-6 relative">
									<div class="absolute -left-[33px] w-4 h-4 bg-yellow-500 rounded-full border-2 border-white dark:border-gray-800"></div>
									<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-xs font-medium text-yellow-600 dark:text-yellow-400">In Progress</span>
										</div>
										<p class="text-sm text-gray-700 dark:text-gray-300">Remediation in progress</p>
									</div>
								</div>
							{/if}

							{#if item.actual_completion_date}
								<div class="mb-6 ml-6 relative">
									<div class="absolute -left-[33px] w-4 h-4 bg-emerald-600 rounded-full border-2 border-white dark:border-gray-800"></div>
									<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">Completed</span>
											<span class="text-xs text-gray-500">{formatDate(item.actual_completion_date)}</span>
										</div>
										<p class="text-sm text-gray-700 dark:text-gray-300">Remediation completed</p>
									</div>
								</div>
							{/if}

							{#if item.has_deviation}
								<div class="mb-6 ml-6 relative">
									<div class="absolute -left-[33px] w-4 h-4 bg-purple-600 rounded-full border-2 border-white dark:border-gray-800"></div>
									<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-xs font-medium text-purple-600 dark:text-purple-400">Deviation Requested</span>
											{#if item.deviation_approval_date}
												<span class="text-xs text-gray-500">{formatDate(item.deviation_approval_date)}</span>
											{/if}
										</div>
										<p class="text-sm text-gray-700 dark:text-gray-300">
											{item.deviation_approved ? 'Deviation approved' : 'Deviation pending approval'}
										</p>
									</div>
								</div>
							{/if}

							{#if item.milestones && item.milestones.length > 0}
								{#each item.milestones.filter((m: any) => m.updated_at) as milestone}
									<div class="mb-6 ml-6 relative">
										<div class="absolute -left-[33px] w-4 h-4 bg-gray-400 rounded-full border-2 border-white dark:border-gray-800"></div>
										<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
											<div class="flex items-center gap-2 mb-1">
												<span class="text-xs font-medium text-gray-600 dark:text-gray-400">Milestone Updated</span>
												<span class="text-xs text-gray-500">{formatDateTime(milestone.updated_at)}</span>
											</div>
											<p class="text-sm text-gray-700 dark:text-gray-300">
												"{milestone.description}" marked as <strong>{formatLabel(milestone.status)}</strong>
											</p>
										</div>
									</div>
								{/each}
							{/if}

							{#if item.last_reviewed_date}
								<div class="mb-6 ml-6 relative">
									<div class="absolute -left-[33px] w-4 h-4 bg-gray-400 rounded-full border-2 border-white dark:border-gray-800"></div>
									<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
										<div class="flex items-center gap-2 mb-1">
											<span class="text-xs font-medium text-gray-600 dark:text-gray-400">Reviewed</span>
											<span class="text-xs text-gray-500">{formatDate(item.last_reviewed_date)}</span>
										</div>
										<p class="text-sm text-gray-700 dark:text-gray-300">Status review completed</p>
									</div>
								</div>
							{/if}

							<!-- Last Updated -->
							<div class="ml-6 relative">
								<div class="absolute -left-[33px] w-4 h-4 bg-gray-300 rounded-full border-2 border-white dark:border-gray-800"></div>
								<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-xs font-medium text-gray-500">Last Updated</span>
										<span class="text-xs text-gray-500">{formatDateTime(item.updated_at)}</span>
									</div>
									<p class="text-sm text-gray-700 dark:text-gray-300">Current version: {item.version || 1}</p>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Reject Modal -->
	{#if showRejectForm}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Reject POA&M Item</h3>
				</div>
				<div class="p-6">
					<label for="reject-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Reason for Rejection
					</label>
					<textarea
						id="reject-reason"
						bind:value={rejectReason}
						rows="4"
						placeholder="Provide a reason for rejecting this POA&M item..."
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					></textarea>
				</div>
				<div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
					<button
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500"
						onclick={() => (showRejectForm = false)}
					>
						Cancel
					</button>
					<button
						class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
						onclick={handleReject}
						disabled={loading || !rejectReason.trim()}
					>
						{#if loading}
							<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						{/if}
						Reject
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Schedule Review Modal -->
	{#if showReviewForm}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Schedule Review</h3>
				</div>
				<div class="p-6">
					<label for="review-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Review Date
					</label>
					<input
						id="review-date"
						type="date"
						bind:value={reviewDate}
						class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
					/>
				</div>
				<div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
					<button
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500"
						onclick={() => (showReviewForm = false)}
					>
						Cancel
					</button>
					<button
						class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
						onclick={handleScheduleReview}
						disabled={loading || !reviewDate}
					>
						{#if loading}
							<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						{/if}
						Schedule
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
