<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$paraglide/messages';
	import { BASE_API_URL } from '$lib/utils/constants';
	import KanbanBoard from '$lib/components/Kanban/KanbanBoard.svelte';
	import { transformToKanbanColumns } from '$lib/components/Kanban';
	import WayfinderWorkflow from '$lib/components/Wayfinder/WayfinderWorkflow.svelte';
	import type { WorkflowConfig } from '$lib/components/Wayfinder';
	import DonutChart from '$lib/components/Chart/DonutChart.svelte';
	import type { PageData } from './$types';

	// Types
	interface ChangeRequest {
		id: string;
		change_number: string;
		title: string;
		description: string;
		change_type: string;
		status: string;
		scn_required: boolean;
		scn_category: string | null;
		scn_reference_number: string | null;
		impact_level: string;
		planned_date: string | null;
		actual_date: string | null;
		affected_ksi_count: number;
		affected_control_count: number;
		security_reviewed: boolean;
		verified: boolean;
	}

	interface DashboardData {
		total_changes: number;
		by_status: Record<string, number>;
		by_type: Record<string, number>;
		scn_required_count: number;
		scn_submitted_count: number;
		pending_review: number;
		pending_scn_submission: number;
		pending_approval: number;
	}

	// Server data
	let { data }: { data: PageData } = $props();

	// State - initialize from server data
	let dashboardData: DashboardData | null = $state(data.dashboard);
	let changeRequests: ChangeRequest[] = $state(data.changeRequests || []);
	let loading = $state(false);
	let error = $state<string | null>(data.error || null);
	let activeTab = $state<'overview' | 'list' | 'kanban' | 'workflow'>('overview');
	let csoId = $state<string | null>(data.csoId);

	// Status mapping for Kanban
	const CHANGE_STATUS_MAPPING = {
		draft: { title: 'Draft', color: 'bg-gray-100', order: 1 },
		submitted: { title: 'Submitted', color: 'bg-blue-100', order: 2 },
		impact_analysis: { title: 'Impact Analysis', color: 'bg-yellow-100', order: 3 },
		impact_assessed: { title: 'Assessed', color: 'bg-orange-100', order: 4 },
		scn_required: { title: 'SCN Required', color: 'bg-red-100', order: 5 },
		scn_not_required: { title: 'SCN Not Required', color: 'bg-green-100', order: 6 },
		scn_submitted: { title: 'SCN Submitted', color: 'bg-purple-100', order: 7 },
		scn_acknowledged: { title: 'SCN Acknowledged', color: 'bg-purple-200', order: 8 },
		approved: { title: 'Approved', color: 'bg-green-200', order: 9 },
		implemented: { title: 'Implemented', color: 'bg-green-300', order: 10 },
		rejected: { title: 'Rejected', color: 'bg-red-200', order: 11 },
		withdrawn: { title: 'Withdrawn', color: 'bg-gray-200', order: 12 }
	};

	// Change type labels
	const CHANGE_TYPE_LABELS: Record<string, string> = {
		boundary: 'Authorization Boundary',
		technology: 'Technology/Architecture',
		personnel: 'Key Personnel',
		process: 'Process/Procedure',
		vendor: 'Third-Party Vendor',
		data_flow: 'Data Flow',
		encryption: 'Encryption',
		authentication: 'Authentication/Access',
		network: 'Network Architecture',
		storage: 'Data Storage',
		interconnection: 'Interconnection',
		physical: 'Physical Security',
		incident_response: 'Incident Response',
		contingency: 'Contingency Planning',
		other: 'Other'
	};

	// Derived state
	const kanbanColumns = $derived.by(() => {
		if (!changeRequests.length) return [];
		return transformToKanbanColumns(
			changeRequests,
			CHANGE_STATUS_MAPPING,
			(change: ChangeRequest) => ({
				id: change.id,
				title: change.change_number,
				subtitle: change.title,
				status: change.status,
				priority: change.scn_required ? 'high' : 'medium',
				metadata: {
					type: CHANGE_TYPE_LABELS[change.change_type] || change.change_type,
					scn: change.scn_required ? 'SCN Required' : null
				}
			})
		);
	});

	const statusChartData = $derived.by(() => {
		if (!dashboardData) return [];
		const statusGroups = {
			'In Progress': (dashboardData.by_status['draft'] || 0) +
				(dashboardData.by_status['submitted'] || 0) +
				(dashboardData.by_status['impact_analysis'] || 0) +
				(dashboardData.by_status['impact_assessed'] || 0),
			'Awaiting SCN': (dashboardData.by_status['scn_required'] || 0),
			'Approved': (dashboardData.by_status['approved'] || 0) +
				(dashboardData.by_status['scn_not_required'] || 0) +
				(dashboardData.by_status['scn_acknowledged'] || 0),
			'Implemented': (dashboardData.by_status['implemented'] || 0),
			'Closed': (dashboardData.by_status['rejected'] || 0) +
				(dashboardData.by_status['withdrawn'] || 0)
		};
		return Object.entries(statusGroups)
			.filter(([_, value]) => value > 0)
			.map(([name, value]) => ({ name, value }));
	});

	const typeChartData = $derived.by(() => {
		if (!dashboardData) return [];
		return Object.entries(dashboardData.by_type)
			.filter(([_, value]) => value > 0)
			.map(([key, value]) => ({
				name: CHANGE_TYPE_LABELS[key] || key,
				value
			}));
	});

	// Workflow configuration
	function createChangeControlWorkflow(): WorkflowConfig {
		return {
			id: 'change-control-workflow',
			title: 'Significant Change Request Process',
			description: 'FedRAMP change control workflow with SCN determination',
			steps: [
				{
					id: 'draft',
					title: 'Draft Change Request',
					description: 'Document the proposed change with full details',
					status: 'completed',
					substeps: [
						{ id: 'title', title: 'Change title and description', completed: true },
						{ id: 'type', title: 'Change type classification', completed: true },
						{ id: 'requestor', title: 'Requestor information', completed: true },
						{ id: 'planned-date', title: 'Planned implementation date', completed: true }
					]
				},
				{
					id: 'impact-analysis',
					title: 'Impact Analysis',
					description: 'Assess the impact on security controls and KSIs',
					status: 'active',
					substeps: [
						{ id: 'components', title: 'Identify affected components', completed: false },
						{ id: 'ksis', title: 'Identify affected KSIs', completed: false },
						{ id: 'controls', title: 'Identify affected controls', completed: false },
						{ id: 'risk', title: 'Risk delta assessment', completed: false }
					]
				},
				{
					id: 'scn-determination',
					title: 'SCN Determination',
					description: 'Determine if FedRAMP Significant Change Notification is required',
					status: 'pending',
					substeps: [
						{ id: 'category', title: 'Determine SCN category', completed: false },
						{ id: 'rationale', title: 'Document rationale', completed: false }
					]
				},
				{
					id: 'scn-submission',
					title: 'SCN Submission (if required)',
					description: 'Submit SCN to FedRAMP PMO',
					status: 'pending',
					substeps: [
						{ id: 'prepare', title: 'Prepare SCN documentation', completed: false },
						{ id: 'submit', title: 'Submit to FedRAMP', completed: false },
						{ id: 'track', title: 'Track acknowledgment', completed: false }
					]
				},
				{
					id: 'security-review',
					title: 'Security Review',
					description: 'Security team reviews and approves the change',
					status: 'pending',
					substeps: [
						{ id: 'review', title: 'Security team review', completed: false },
						{ id: 'approve', title: 'Approval decision', completed: false }
					]
				},
				{
					id: 'implementation',
					title: 'Implementation',
					description: 'Implement the approved change',
					status: 'pending',
					substeps: [
						{ id: 'execute', title: 'Execute change', completed: false },
						{ id: 'verify', title: 'Post-implementation verification', completed: false },
						{ id: 'oar', title: 'Report in next OAR', completed: false }
					]
				}
			]
		};
	}

	// Data loading
	async function loadDashboard() {
		loading = true;
		error = null;
		try {
			const params = new URLSearchParams();
			if (csoId) params.set('cso_id', csoId);

			const [dashboardRes, listRes] = await Promise.all([
				fetch(`${BASE_API_URL}/rmf/change-control/dashboard/?${params}`),
				fetch(`${BASE_API_URL}/rmf/change-requests/?${params}`)
			]);

			if (!dashboardRes.ok || !listRes.ok) {
				throw new Error('Failed to load data');
			}

			const dashboardJson = await dashboardRes.json();
			const listJson = await listRes.json();

			if (dashboardJson.success) {
				dashboardData = dashboardJson.data;
			}
			if (listJson.success) {
				changeRequests = listJson.data;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	// Handlers
	function handleKanbanCardClick(item: { id: string }) {
		window.location.href = `/rmf/change-control/${item.id}`;
	}

	function handleNewChange() {
		// TODO: Open create modal
		alert('Create change request modal - TODO');
	}

	// Lifecycle - data is loaded server-side, onMount only needed for URL params
	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('cso_id') !== csoId) {
			csoId = urlParams.get('cso_id');
			loadDashboard();
		}
	});

	// Tab configuration
	const tabs = [
		{ id: 'overview', label: 'Overview', icon: 'fa-solid fa-chart-pie' },
		{ id: 'list', label: 'Changes', icon: 'fa-solid fa-list' },
		{ id: 'kanban', label: 'Kanban', icon: 'fa-solid fa-columns' },
		{ id: 'workflow', label: 'Workflow', icon: 'fa-solid fa-diagram-project' }
	];

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			draft: 'bg-gray-100 text-gray-800',
			submitted: 'bg-blue-100 text-blue-800',
			impact_analysis: 'bg-yellow-100 text-yellow-800',
			impact_assessed: 'bg-orange-100 text-orange-800',
			scn_required: 'bg-red-100 text-red-800',
			scn_not_required: 'bg-green-100 text-green-800',
			scn_submitted: 'bg-purple-100 text-purple-800',
			scn_acknowledged: 'bg-purple-200 text-purple-800',
			approved: 'bg-green-200 text-green-800',
			implemented: 'bg-green-300 text-green-800',
			rejected: 'bg-red-200 text-red-800',
			withdrawn: 'bg-gray-200 text-gray-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Change Control</h1>
			<p class="text-sm text-gray-500">
				Managed change control with FedRAMP Significant Change Notifications
			</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => loadDashboard()}
				class="btn variant-ghost-surface"
				disabled={loading}
			>
				<i class="fa-solid fa-refresh" class:fa-spin={loading}></i>
				Refresh
			</button>
			<button onclick={handleNewChange} class="btn variant-filled-primary">
				<i class="fa-solid fa-plus"></i>
				New Change Request
			</button>
		</div>
	</div>

	<!-- Error display -->
	{#if error}
		<div class="alert variant-filled-error">
			<i class="fa-solid fa-exclamation-triangle"></i>
			<span>{error}</span>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="flex gap-1 border-b border-gray-200">
		{#each tabs as tab}
			<button
				class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
					   {activeTab === tab.id
					? 'bg-white text-primary-600 border-b-2 border-primary-500'
					: 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
				onclick={() => (activeTab = tab.id as typeof activeTab)}
			>
				<i class="{tab.icon} mr-2"></i>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Loading state -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<i class="fa-solid fa-spinner fa-spin text-3xl text-gray-400"></i>
		</div>
	{:else if dashboardData}
		<!-- Overview Tab -->
		{#if activeTab === 'overview'}
			<!-- Summary Cards -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Total Changes</div>
					<div class="text-3xl font-bold text-gray-900">{dashboardData.total_changes}</div>
				</div>
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Pending Review</div>
					<div class="text-3xl font-bold text-yellow-600">{dashboardData.pending_review}</div>
				</div>
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Awaiting SCN</div>
					<div class="text-3xl font-bold text-red-600">{dashboardData.pending_scn_submission}</div>
				</div>
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Pending Approval</div>
					<div class="text-3xl font-bold text-blue-600">{dashboardData.pending_approval}</div>
				</div>
			</div>

			<!-- SCN Summary -->
			<div class="card p-4 bg-white shadow-sm">
				<h3 class="text-lg font-semibold mb-4">SCN Tracking</h3>
				<div class="grid grid-cols-2 gap-4">
					<div class="flex items-center gap-3">
						<div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
							<i class="fa-solid fa-file-signature text-red-600"></i>
						</div>
						<div>
							<div class="text-2xl font-bold">{dashboardData.scn_required_count}</div>
							<div class="text-sm text-gray-500">SCN Required</div>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
							<i class="fa-solid fa-check-circle text-green-600"></i>
						</div>
						<div>
							<div class="text-2xl font-bold">{dashboardData.scn_submitted_count}</div>
							<div class="text-sm text-gray-500">SCN Submitted</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Charts -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				{#if statusChartData.length > 0}
					<div class="card p-6 bg-white shadow-sm">
						<h3 class="text-lg font-semibold mb-4">Changes by Status</h3>
						<DonutChart data={statusChartData} />
					</div>
				{/if}
				{#if typeChartData.length > 0}
					<div class="card p-6 bg-white shadow-sm">
						<h3 class="text-lg font-semibold mb-4">Changes by Type</h3>
						<DonutChart data={typeChartData} />
					</div>
				{/if}
			</div>

			<!-- List Tab -->
		{:else if activeTab === 'list'}
			<div class="card bg-white shadow-sm overflow-hidden">
				<table class="w-full">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Change #
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Title
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Status
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SCN</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Impact
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each changeRequests as change}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-3 text-sm font-mono text-gray-900">{change.change_number}</td>
								<td class="px-4 py-3 text-sm text-gray-900">{change.title}</td>
								<td class="px-4 py-3 text-sm text-gray-500">
									{CHANGE_TYPE_LABELS[change.change_type] || change.change_type}
								</td>
								<td class="px-4 py-3">
									<span class="px-2 py-1 text-xs rounded-full {getStatusColor(change.status)}">
										{CHANGE_STATUS_MAPPING[change.status]?.title || change.status}
									</span>
								</td>
								<td class="px-4 py-3">
									{#if change.scn_required}
										<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
											Required
										</span>
									{:else}
										<span class="text-gray-400">-</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm">
									<span
										class="px-2 py-1 text-xs rounded-full
										{change.impact_level === 'critical'
											? 'bg-red-100 text-red-800'
											: change.impact_level === 'high'
												? 'bg-orange-100 text-orange-800'
												: change.impact_level === 'moderate'
													? 'bg-yellow-100 text-yellow-800'
													: 'bg-gray-100 text-gray-800'}"
									>
										{change.impact_level}
									</span>
								</td>
								<td class="px-4 py-3">
									<a
										href="/rmf/change-control/{change.id}"
										class="text-primary-600 hover:text-primary-800"
									>
										<i class="fa-solid fa-eye"></i>
									</a>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="7" class="px-4 py-8 text-center text-gray-500">
									No change requests found
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Kanban Tab -->
		{:else if activeTab === 'kanban'}
			<KanbanBoard
				columns={kanbanColumns}
				onCardClick={handleKanbanCardClick}
				enableDragDrop={false}
			/>

			<!-- Workflow Tab -->
		{:else if activeTab === 'workflow'}
			<WayfinderWorkflow config={createChangeControlWorkflow()} />
		{/if}
	{/if}
</div>
