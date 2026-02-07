<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getToastStore } from '$lib/components/Toast/stores';

	const toastStore = getToastStore();
	import { KanbanBoard, KSI_STATUS_MAPPING, transformToKanbanColumns } from '$lib/components/Kanban';
	import { WayfinderWorkflow, createFedRAMP20xWorkflow } from '$lib/components/Wayfinder';
	import DonutChart from '$lib/components/Chart/DonutChart.svelte';
	import {
		Shield,
		Download,
		RefreshCw,
		CheckCircle,
		AlertTriangle,
		Activity,
		FileJson,
		BarChart3,
		Settings
	} from 'lucide-svelte';

	// Types
	interface KSIEntry {
		id: string;
		ksi_ref_id: string;
		ksi_name: string;
		category: string;
		implementation_status: string;
		compliance_status: string;
		validation_type: string;
		automation_percentage: number;
		last_validation_date: string | null;
	}

	interface DashboardData {
		cso_name: string;
		impact_level: string;
		authorization_status: string;
		ksi_total: number;
		ksi_compliant: number;
		ksi_non_compliant: number;
		ksi_compliance_percentage: number;
		persistent_validation_coverage: number;
		ksi_entries: KSIEntry[];
		ksi_by_category: Record<string, { total: number; compliant: number; automated: number }>;
	}

	let dashboardData: DashboardData | null = $state(null);
	let loading = $state(true);
	let activeTab = $state<'overview' | 'kanban' | 'workflow' | 'export'>('overview');
	let selectedImpactLevel = $state<'low' | 'moderate'>('moderate');

	// KSI detail modal state
	let showKSIDetailModal = $state(false);
	let selectedKSI = $state<KSIEntry | null>(null);
	let ksiEditStatus = $state('');
	let ksiEditComplianceStatus = $state('');
	let ksiDetailSubmitting = $state(false);
	let ksiDetailError = $state<string | null>(null);

	// Workflow state
	let workflowProgress = $state<Record<string, boolean>>({});
	const workflow = $derived(createFedRAMP20xWorkflow(workflowProgress));

	// Transform KSI entries to Kanban columns
	const kanbanColumns = $derived.by(() => {
		if (!dashboardData?.ksi_entries) return [];

		return transformToKanbanColumns(
			dashboardData.ksi_entries.map(ksi => ({
				id: ksi.ksi_ref_id,
				status: ksi.implementation_status
			})),
			KSI_STATUS_MAPPING,
			(ksi) => {
				const entry = dashboardData!.ksi_entries.find(e => e.ksi_ref_id === ksi.id);
				return {
					title: entry?.ksi_ref_id || ksi.id,
					description: entry?.ksi_name,
					labels: entry ? [entry.category, entry.compliance_status] : [],
					priority: entry?.compliance_status === 'non_compliant' ? 'high' : undefined
				};
			}
		);
	});

	// Chart data
	const complianceChartData = $derived.by(() => {
		if (!dashboardData) return [];
		return [
			{ name: 'Compliant', value: dashboardData.ksi_compliant, color: '#22c55e' },
			{ name: 'Non-Compliant', value: dashboardData.ksi_non_compliant, color: '#ef4444' },
			{ name: 'Pending', value: dashboardData.ksi_total - dashboardData.ksi_compliant - dashboardData.ksi_non_compliant, color: '#94a3b8' }
		];
	});

	const validationChartData = $derived.by(() => {
		if (!dashboardData) return [];
		const automated = Math.round(dashboardData.persistent_validation_coverage);
		return [
			{ name: 'Automated', value: automated, color: '#3b82f6' },
			{ name: 'Manual', value: 100 - automated, color: '#94a3b8' }
		];
	});

	async function loadDashboard() {
		loading = true;
		try {
			const csoId = new URLSearchParams(window.location.search).get('cso_id');
			const url = csoId
				? `/api/rmf/fedramp-20x/ksi/?cso_id=${csoId}`
				: '/api/rmf/fedramp-20x/ksi/';

			const response = await fetch(url);
			const data = await response.json();

			if (data.success) {
				dashboardData = data.data;
			}
		} catch (error) {
			console.error('Error loading dashboard:', error);
		} finally {
			loading = false;
		}
	}

	async function downloadPackage(type: string) {
		const csoId = new URLSearchParams(window.location.search).get('cso_id');
		if (!csoId) {
			toastStore.trigger({ message: 'Please select a Cloud Service Offering first' });
			return;
		}

		const url = `/api/rmf/fedramp-20x/download/?cso_id=${csoId}&type=${type}`;
		window.open(url, '_blank');
	}

	async function handleKSIMove(itemId: string, fromColumn: string, toColumn: string) {
		try {
			const res = await fetch(`/api/rmf/fedramp-20x/ksi/${itemId}/`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ implementation_status: toColumn })
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => null);
				console.error('Failed to update KSI status:', errData?.message || res.status);
			}
			await loadDashboard();
		} catch (e) {
			console.error('Error updating KSI status:', e);
			await loadDashboard();
		}
	}

	function handleKSIClick(item: any) {
		const entry = dashboardData?.ksi_entries.find(
			(e) => e.ksi_ref_id === item.id || e.id === item.id
		);
		if (entry) {
			selectedKSI = entry;
			ksiEditStatus = entry.implementation_status;
			ksiEditComplianceStatus = entry.compliance_status;
			ksiDetailError = null;
			showKSIDetailModal = true;
		}
	}

	function handleKSIDetailClose() {
		showKSIDetailModal = false;
		selectedKSI = null;
	}

	async function handleKSIDetailSave() {
		if (!selectedKSI) return;
		ksiDetailSubmitting = true;
		ksiDetailError = null;
		try {
			const res = await fetch(`/api/rmf/fedramp-20x/ksi/${selectedKSI.ksi_ref_id}/`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					implementation_status: ksiEditStatus,
					compliance_status: ksiEditComplianceStatus
				})
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => null);
				throw new Error(errData?.message || `Request failed (${res.status})`);
			}
			showKSIDetailModal = false;
			selectedKSI = null;
			await loadDashboard();
		} catch (e) {
			ksiDetailError = e instanceof Error ? e.message : 'Failed to update KSI';
		} finally {
			ksiDetailSubmitting = false;
		}
	}

	function handleWorkflowStepComplete(stepId: string) {
		workflowProgress[stepId] = true;
		workflowProgress = { ...workflowProgress };
	}

	onMount(() => {
		loadDashboard();
	});
</script>

<svelte:head>
	<title>FedRAMP 20x Authorization - CISO Assistant</title>
</svelte:head>

<div class="fedramp-20x-page">
	<!-- Header -->
	<div class="bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold flex items-center gap-2">
						<Shield class="w-7 h-7" />
						FedRAMP 20x Authorization
					</h1>
					<p class="mt-1 text-blue-100">
						Machine-readable authorization with Key Security Indicators
					</p>
				</div>
				<div class="flex items-center gap-4">
					{#if dashboardData}
						<div class="text-right">
							<div class="text-sm text-blue-200">Impact Level</div>
							<div class="font-semibold">{dashboardData.impact_level || 'Moderate'}</div>
						</div>
						<div class="h-8 w-px bg-blue-500"></div>
						<div class="text-right">
							<div class="text-sm text-blue-200">Status</div>
							<div class="font-semibold">{dashboardData.authorization_status || 'In Progress'}</div>
						</div>
					{/if}
					<button
						class="btn variant-filled-surface"
						onclick={() => loadDashboard()}
						disabled={loading}
					>
						<span class:animate-spin={loading}>
							<RefreshCw class="w-4 h-4" />
						</span>
						Refresh
					</button>
				</div>
			</div>

			<!-- Tabs -->
			<div class="flex gap-1 mt-6">
				{#each [
					{ id: 'overview', label: 'Overview', icon: BarChart3 },
					{ id: 'kanban', label: 'KSI Board', icon: Activity },
					{ id: 'workflow', label: 'Workflow Guide', icon: CheckCircle },
					{ id: 'export', label: 'Export', icon: Download }
				] as tab}
					<button
						class="px-4 py-2 rounded-t-lg flex items-center gap-2 transition-colors"
						class:bg-white={activeTab === tab.id}
						class:text-blue-800={activeTab === tab.id}
						class:bg-blue-600={activeTab !== tab.id}
						class:text-white={activeTab !== tab.id}
						onclick={() => activeTab = tab.id}
					>
						<svelte:component this={tab.icon} class="w-4 h-4" />
						{tab.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
		{#if loading}
			<div class="flex items-center justify-center h-64">
				<RefreshCw class="w-8 h-8 animate-spin text-primary-500" />
			</div>
		{:else if activeTab === 'overview'}
			<!-- Overview Tab -->
			<div class="space-y-6">
				<!-- Summary Cards -->
				<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div class="card p-4">
						<div class="text-sm text-surface-500">Total KSIs</div>
						<div class="text-3xl font-bold mt-1">{dashboardData?.ksi_total || 0}</div>
					</div>
					<div class="card p-4">
						<div class="text-sm text-surface-500">Compliant</div>
						<div class="text-3xl font-bold text-success-500 mt-1">{dashboardData?.ksi_compliant || 0}</div>
					</div>
					<div class="card p-4">
						<div class="text-sm text-surface-500">Compliance Rate</div>
						<div class="text-3xl font-bold mt-1">{dashboardData?.ksi_compliance_percentage?.toFixed(1) || 0}%</div>
					</div>
					<div class="card p-4">
						<div class="text-sm text-surface-500">Validation Coverage</div>
						<div class="text-3xl font-bold mt-1" class:text-success-500={dashboardData && dashboardData.persistent_validation_coverage >= 70}>
							{dashboardData?.persistent_validation_coverage?.toFixed(1) || 0}%
						</div>
						{#if dashboardData && dashboardData.persistent_validation_coverage < 70}
							<div class="text-xs text-warning-500 mt-1">Target: 70%+</div>
						{/if}
					</div>
				</div>

				<!-- Charts -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div class="card p-6">
						<h3 class="text-lg font-semibold mb-4">KSI Compliance Status</h3>
						<div class="h-64">
							<DonutChart data={complianceChartData} />
						</div>
					</div>
					<div class="card p-6">
						<h3 class="text-lg font-semibold mb-4">Persistent Validation Coverage</h3>
						<div class="h-64">
							<DonutChart data={validationChartData} />
						</div>
						<div class="mt-4 p-3 rounded-lg" class:bg-success-100={dashboardData && dashboardData.persistent_validation_coverage >= 70} class:bg-warning-100={dashboardData && dashboardData.persistent_validation_coverage < 70}>
							{#if dashboardData && dashboardData.persistent_validation_coverage >= 70}
								<div class="flex items-center gap-2 text-success-700">
									<CheckCircle class="w-5 h-5" />
									Meets FedRAMP 20x 70% automation target
								</div>
							{:else}
								<div class="flex items-center gap-2 text-warning-700">
									<AlertTriangle class="w-5 h-5" />
									Below FedRAMP 20x 70% automation target
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- KSI by Category -->
				{#if dashboardData?.ksi_by_category}
					<div class="card p-6">
						<h3 class="text-lg font-semibold mb-4">KSI Status by Category</h3>
						<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
							{#each Object.entries(dashboardData.ksi_by_category) as [category, stats]}
								<div class="p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
									<div class="font-medium">{category}</div>
									<div class="text-2xl font-bold mt-1">{stats.compliant}/{stats.total}</div>
									<div class="text-xs text-surface-500">{Math.round((stats.compliant / stats.total) * 100)}% compliant</div>
									<div class="text-xs text-primary-500">{stats.automated} automated</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

		{:else if activeTab === 'kanban'}
			<!-- Kanban Tab -->
			<div class="card p-4">
				<h3 class="text-lg font-semibold mb-4">KSI Implementation Board</h3>
				<p class="text-sm text-surface-500 mb-4">
					Drag and drop KSIs between columns to update their implementation status.
				</p>
				<KanbanBoard
					columns={kanbanColumns}
					onItemMove={handleKSIMove}
					onItemClick={handleKSIClick}
					showWipLimits={true}
					allowDragDrop={true}
				/>
			</div>

		{:else if activeTab === 'workflow'}
			<!-- Workflow Tab -->
			<div class="card p-6">
				<WayfinderWorkflow
					title={workflow.title}
					description={workflow.description}
					steps={workflow.steps}
					showProgress={true}
					allowSkip={false}
					onStepComplete={handleWorkflowStepComplete}
				/>
			</div>

		{:else if activeTab === 'export'}
			<!-- Export Tab -->
			<div class="space-y-6">
				<div class="card p-6">
					<h3 class="text-lg font-semibold mb-4">Machine-Readable Export</h3>
					<p class="text-surface-500 mb-6">
						Export your FedRAMP 20x authorization data in machine-readable JSON format
						per RFC-0024 requirements.
					</p>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="p-4 border rounded-lg dark:border-surface-700">
							<div class="flex items-center gap-3 mb-3">
								<FileJson class="w-8 h-8 text-primary-500" />
								<div>
									<h4 class="font-medium">KSI Compliance Package</h4>
									<p class="text-sm text-surface-500">Complete KSI status and evidence</p>
								</div>
							</div>
							<button
								class="btn variant-filled-primary w-full"
								onclick={() => downloadPackage('ksi')}
							>
								<Download class="w-4 h-4" />
								Download KSI Package
							</button>
						</div>

						<div class="p-4 border rounded-lg dark:border-surface-700">
							<div class="flex items-center gap-3 mb-3">
								<FileJson class="w-8 h-8 text-primary-500" />
								<div>
									<h4 class="font-medium">Validation Report</h4>
									<p class="text-sm text-surface-500">Persistent validation results</p>
								</div>
							</div>
							<button
								class="btn variant-filled-primary w-full"
								onclick={() => downloadPackage('validation')}
							>
								<Download class="w-4 h-4" />
								Download Validation Report
							</button>
						</div>

						<div class="p-4 border rounded-lg dark:border-surface-700">
							<div class="flex items-center gap-3 mb-3">
								<FileJson class="w-8 h-8 text-warning-500" />
								<div>
									<h4 class="font-medium">OAR Package</h4>
									<p class="text-sm text-surface-500">Ongoing Authorization Report</p>
								</div>
							</div>
							<button
								class="btn variant-filled-warning w-full"
								onclick={() => downloadPackage('oar')}
							>
								<Download class="w-4 h-4" />
								Download OAR Package
							</button>
						</div>

						<div class="p-4 border rounded-lg dark:border-surface-700">
							<div class="flex items-center gap-3 mb-3">
								<FileJson class="w-8 h-8 text-success-500" />
								<div>
									<h4 class="font-medium">Complete Package</h4>
									<p class="text-sm text-surface-500">Full authorization package</p>
								</div>
							</div>
							<button
								class="btn variant-filled-success w-full"
								onclick={() => downloadPackage('complete')}
							>
								<Download class="w-4 h-4" />
								Download Complete Package
							</button>
						</div>
					</div>
				</div>

				<div class="card p-6">
					<h3 class="text-lg font-semibold mb-4">Package Schema</h3>
					<p class="text-surface-500 mb-4">
						All exports conform to the FedRAMP 20x machine-readable package schema.
					</p>
					<pre class="bg-surface-100 dark:bg-surface-800 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "package_type": "fedramp_20x_complete",
  "schema_version": "fedramp-20x-complete-v1",
  "cso_info": { ... },
  "ksi_compliance": {
    "total": 61,
    "compliant": 58,
    "compliance_percentage": 95.1,
    "validation_coverage": 72.3,
    "entries": [ ... ]
  },
  "persistent_validation": { ... },
  "vulnerability_summary": { ... },
  "poam_summary": { ... }
}`}
					</pre>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- KSI Detail Modal -->
{#if showKSIDetailModal && selectedKSI}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="dialog"
		aria-modal="true"
		aria-label="KSI Details"
	>
		<div class="bg-white dark:bg-surface-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-surface-700">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white">KSI Details</h2>
			</div>

			<div class="px-6 py-4 space-y-4">
				{#if ksiDetailError}
					<div class="p-3 rounded bg-red-50 text-red-700 text-sm">{ksiDetailError}</div>
				{/if}

				<!-- Read-only details -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<div class="text-xs font-medium text-gray-500 uppercase">Ref ID</div>
						<div class="text-sm font-mono font-semibold">{selectedKSI.ksi_ref_id}</div>
					</div>
					<div>
						<div class="text-xs font-medium text-gray-500 uppercase">Category</div>
						<div class="text-sm">{selectedKSI.category}</div>
					</div>
				</div>

				<div>
					<div class="text-xs font-medium text-gray-500 uppercase">Name</div>
					<div class="text-sm">{selectedKSI.ksi_name}</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<div class="text-xs font-medium text-gray-500 uppercase">Validation Type</div>
						<div class="text-sm">{selectedKSI.validation_type}</div>
					</div>
					<div>
						<div class="text-xs font-medium text-gray-500 uppercase">Automation</div>
						<div class="text-sm">{selectedKSI.automation_percentage}%</div>
					</div>
				</div>

				<div>
					<div class="text-xs font-medium text-gray-500 uppercase">Last Validation Date</div>
					<div class="text-sm">
						{selectedKSI.last_validation_date
							? new Date(selectedKSI.last_validation_date).toLocaleString()
							: 'Not yet validated'}
					</div>
				</div>

				<hr class="border-gray-200 dark:border-surface-700" />

				<!-- Editable fields -->
				<div>
					<label for="ksi-impl-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Implementation Status</label>
					<select
						id="ksi-impl-status"
						bind:value={ksiEditStatus}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
					>
						<option value="not_started">Not Started</option>
						<option value="in_progress">In Progress</option>
						<option value="implemented">Implemented</option>
						<option value="validated">Validated</option>
						<option value="not_applicable">Not Applicable</option>
					</select>
				</div>

				<div>
					<label for="ksi-comp-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compliance Status</label>
					<select
						id="ksi-comp-status"
						bind:value={ksiEditComplianceStatus}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
					>
						<option value="compliant">Compliant</option>
						<option value="non_compliant">Non-Compliant</option>
						<option value="pending">Pending</option>
					</select>
				</div>
			</div>

			<div class="px-6 py-4 border-t border-gray-200 dark:border-surface-700 flex justify-end gap-3">
				<button
					type="button"
					onclick={handleKSIDetailClose}
					class="btn variant-ghost-surface"
					disabled={ksiDetailSubmitting}
				>
					Close
				</button>
				<button
					type="button"
					onclick={handleKSIDetailSave}
					class="btn variant-filled-primary"
					disabled={ksiDetailSubmitting}
				>
					{#if ksiDetailSubmitting}
						<span class="animate-spin mr-1"><RefreshCw class="w-4 h-4" /></span>
					{/if}
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.fedramp-20x-page {
		min-height: 100vh;
		background-color: rgb(var(--color-surface-50));
	}

	:global(.dark) .fedramp-20x-page {
		background-color: rgb(var(--color-surface-900));
	}
</style>
