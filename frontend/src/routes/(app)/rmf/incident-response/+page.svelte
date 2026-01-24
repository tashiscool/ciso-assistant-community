<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$paraglide/messages';
	import KanbanBoard from '$lib/components/Kanban/KanbanBoard.svelte';
	import { transformToKanbanColumns } from '$lib/components/Kanban';
	import WayfinderWorkflow from '$lib/components/Wayfinder/WayfinderWorkflow.svelte';
	import type { WorkflowConfig } from '$lib/components/Wayfinder';
	import DonutChart from '$lib/components/Chart/DonutChart.svelte';
	import type { PageData } from './$types';

	// Types
	interface Incident {
		incident_number: string;
		title: string;
		status: string;
		severity: string;
		category: string;
		detected_at: string | null;
		time_open_hours: number | null;
		time_to_contain_hours: number | null;
		uscert_status: string;
		uscert_case_number: string | null;
		reporting_overdue: boolean;
		affected_users: number;
		affected_records: number;
		data_exfiltrated: boolean;
		has_poam: boolean;
	}

	interface DashboardData {
		total_incidents: number;
		open_incidents: number;
		by_severity: Record<string, number>;
		by_status: Record<string, number>;
		overdue_uscert_reporting: Array<{
			incident_number: string;
			title: string;
			severity: string;
			deadline: string | null;
		}>;
		overdue_count: number;
		avg_time_to_contain_hours: number | null;
		avg_time_to_resolve_hours: number | null;
	}

	// Server data
	let { data }: { data: PageData } = $props();

	// State - initialize from server data
	let dashboardData: DashboardData | null = $state(data.dashboard);
	let incidents: Incident[] = $state(data.incidents || []);
	let loading = $state(false);
	let error = $state<string | null>(data.error || null);
	let activeTab = $state<'overview' | 'list' | 'kanban' | 'workflow' | 'overdue'>('overview');
	let csoId = $state<string | null>(data.csoId);
	let showOpenOnly = $state(data.openOnly !== false);

	// Status mapping
	const INCIDENT_STATUS_MAPPING = {
		detected: { title: 'Detected', color: 'bg-red-100', order: 1 },
		reported: { title: 'Reported', color: 'bg-red-200', order: 2 },
		analyzing: { title: 'Analyzing', color: 'bg-orange-100', order: 3 },
		contained: { title: 'Contained', color: 'bg-yellow-100', order: 4 },
		eradicating: { title: 'Eradicating', color: 'bg-yellow-200', order: 5 },
		eradicated: { title: 'Eradicated', color: 'bg-blue-100', order: 6 },
		recovering: { title: 'Recovering', color: 'bg-blue-200', order: 7 },
		recovered: { title: 'Recovered', color: 'bg-green-100', order: 8 },
		lessons_learned: { title: 'Lessons Learned', color: 'bg-green-200', order: 9 },
		closed: { title: 'Closed', color: 'bg-gray-200', order: 10 }
	};

	// Severity labels with colors
	const SEVERITY_CONFIG: Record<string, { label: string; color: string; deadline: string }> = {
		critical: { label: 'Critical', color: 'bg-red-600 text-white', deadline: '1 hour' },
		high: { label: 'High', color: 'bg-orange-500 text-white', deadline: '24 hours' },
		moderate: { label: 'Moderate', color: 'bg-yellow-500 text-white', deadline: '72 hours' },
		low: { label: 'Low', color: 'bg-blue-500 text-white', deadline: '7 days' },
		informational: { label: 'Info', color: 'bg-gray-400 text-white', deadline: 'N/A' }
	};

	// Category labels
	const CATEGORY_LABELS: Record<string, string> = {
		unauthorized_access: 'Unauthorized Access',
		denial_of_service: 'Denial of Service',
		malicious_code: 'Malicious Code',
		improper_usage: 'Improper Usage',
		scans_probes: 'Scans/Probes',
		data_breach: 'Data Breach',
		data_loss: 'Data Loss',
		phishing: 'Phishing',
		ransomware: 'Ransomware',
		supply_chain: 'Supply Chain',
		insider_threat: 'Insider Threat',
		configuration_error: 'Config Error',
		physical: 'Physical',
		other: 'Other'
	};

	// US-CERT reporting status labels
	const USCERT_STATUS_LABELS: Record<string, string> = {
		not_required: 'Not Required',
		pending: 'Pending',
		submitted: 'Submitted',
		update_required: 'Update Required',
		update_submitted: 'Update Submitted',
		final_submitted: 'Final Submitted',
		closed: 'Closed'
	};

	// Derived state
	const kanbanColumns = $derived.by(() => {
		if (!incidents.length) return [];
		return transformToKanbanColumns(
			incidents,
			INCIDENT_STATUS_MAPPING,
			(incident: Incident) => ({
				id: incident.incident_number,
				title: incident.incident_number,
				subtitle: incident.title,
				status: incident.status,
				priority: incident.severity === 'critical' || incident.severity === 'high' ? 'high' :
						  incident.severity === 'moderate' ? 'medium' : 'low',
				metadata: {
					severity: SEVERITY_CONFIG[incident.severity]?.label || incident.severity,
					category: CATEGORY_LABELS[incident.category] || incident.category,
					overdue: incident.reporting_overdue ? 'OVERDUE' : null
				}
			})
		);
	});

	const severityChartData = $derived.by(() => {
		if (!dashboardData) return [];
		return Object.entries(dashboardData.by_severity)
			.filter(([_, value]) => value > 0)
			.map(([key, value]) => ({
				name: SEVERITY_CONFIG[key]?.label || key,
				value
			}));
	});

	const statusChartData = $derived.by(() => {
		if (!dashboardData) return [];
		const statusGroups = {
			'Active': (dashboardData.by_status['detected'] || 0) +
				(dashboardData.by_status['reported'] || 0) +
				(dashboardData.by_status['analyzing'] || 0),
			'Contained': (dashboardData.by_status['contained'] || 0) +
				(dashboardData.by_status['eradicating'] || 0) +
				(dashboardData.by_status['eradicated'] || 0),
			'Recovering': (dashboardData.by_status['recovering'] || 0) +
				(dashboardData.by_status['recovered'] || 0),
			'Closed': (dashboardData.by_status['lessons_learned'] || 0) +
				(dashboardData.by_status['closed'] || 0)
		};
		return Object.entries(statusGroups)
			.filter(([_, value]) => value > 0)
			.map(([name, value]) => ({ name, value }));
	});

	// Workflow configuration
	function createIncidentResponseWorkflow(): WorkflowConfig {
		return {
			id: 'incident-response-workflow',
			title: 'Incident Response Lifecycle',
			description: 'NIST SP 800-61 compliant incident handling process',
			steps: [
				{
					id: 'detection',
					title: 'Detection & Reporting',
					description: 'Incident detected and reported to security team',
					status: 'completed',
					substeps: [
						{ id: 'detect', title: 'Detect incident', completed: true },
						{ id: 'classify', title: 'Initial classification (severity/category)', completed: true },
						{ id: 'report-internal', title: 'Report to internal security team', completed: true },
						{ id: 'uscert-deadline', title: 'Calculate US-CERT deadline', completed: true }
					]
				},
				{
					id: 'analysis',
					title: 'Analysis',
					description: 'Investigate and understand the incident',
					status: 'active',
					substeps: [
						{ id: 'commander', title: 'Assign incident commander', completed: false },
						{ id: 'team', title: 'Assemble response team', completed: false },
						{ id: 'scope', title: 'Determine scope and impact', completed: false },
						{ id: 'iocs', title: 'Identify indicators of compromise', completed: false },
						{ id: 'uscert', title: 'Submit US-CERT initial report (if required)', completed: false }
					]
				},
				{
					id: 'containment',
					title: 'Containment',
					description: 'Contain the incident to prevent further damage',
					status: 'pending',
					substeps: [
						{ id: 'strategy', title: 'Develop containment strategy', completed: false },
						{ id: 'execute', title: 'Execute containment actions', completed: false },
						{ id: 'verify', title: 'Verify containment effectiveness', completed: false },
						{ id: 'evidence', title: 'Preserve evidence', completed: false }
					]
				},
				{
					id: 'eradication',
					title: 'Eradication',
					description: 'Remove the threat from the environment',
					status: 'pending',
					substeps: [
						{ id: 'root-cause', title: 'Identify root cause', completed: false },
						{ id: 'remove', title: 'Remove threat artifacts', completed: false },
						{ id: 'patch', title: 'Apply patches/fixes', completed: false },
						{ id: 'verify', title: 'Verify eradication', completed: false }
					]
				},
				{
					id: 'recovery',
					title: 'Recovery',
					description: 'Restore systems to normal operations',
					status: 'pending',
					substeps: [
						{ id: 'restore', title: 'Restore from clean backups', completed: false },
						{ id: 'rebuild', title: 'Rebuild affected systems', completed: false },
						{ id: 'test', title: 'Test restored functionality', completed: false },
						{ id: 'monitor', title: 'Enhanced monitoring period', completed: false }
					]
				},
				{
					id: 'lessons-learned',
					title: 'Lessons Learned',
					description: 'Review incident and improve processes',
					status: 'pending',
					substeps: [
						{ id: 'review', title: 'Conduct post-incident review', completed: false },
						{ id: 'document', title: 'Document lessons learned', completed: false },
						{ id: 'recommendations', title: 'Develop recommendations', completed: false },
						{ id: 'uscert-final', title: 'Submit US-CERT final report', completed: false },
						{ id: 'poam', title: 'Create POA&M items if needed', completed: false }
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
			if (showOpenOnly) params.set('open_only', 'true');

			const [dashboardRes, listRes] = await Promise.all([
				fetch(`/api/rmf/incident-response/dashboard/?${csoId ? `cso_id=${csoId}` : ''}`),
				fetch(`/api/rmf/incidents/?${params}`)
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
				incidents = listJson.data;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	// Handlers
	function handleKanbanCardClick(item: { id: string }) {
		// Find the incident by incident_number
		const incident = incidents.find(i => i.incident_number === item.id);
		if (incident) {
			window.location.href = `/rmf/incident-response/${incident.incident_number}`;
		}
	}

	function handleNewIncident() {
		// TODO: Open create modal
		alert('Create incident modal - TODO');
	}

	function formatDuration(hours: number | null): string {
		if (hours === null) return '-';
		if (hours < 1) return `${Math.round(hours * 60)} min`;
		if (hours < 24) return `${hours.toFixed(1)} hrs`;
		return `${(hours / 24).toFixed(1)} days`;
	}

	function getTimeAgo(isoDate: string | null): string {
		if (!isoDate) return '-';
		const date = new Date(isoDate);
		const now = new Date();
		const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
		return formatDuration(diffHours) + ' ago';
	}

	// Lifecycle - data is loaded server-side, onMount only needed for URL param changes
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
		{ id: 'list', label: 'Incidents', icon: 'fa-solid fa-list' },
		{ id: 'kanban', label: 'Kanban', icon: 'fa-solid fa-columns' },
		{ id: 'workflow', label: 'Workflow', icon: 'fa-solid fa-diagram-project' },
		{ id: 'overdue', label: 'Overdue', icon: 'fa-solid fa-exclamation-triangle' }
	];

	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			detected: 'bg-red-100 text-red-800',
			reported: 'bg-red-200 text-red-800',
			analyzing: 'bg-orange-100 text-orange-800',
			contained: 'bg-yellow-100 text-yellow-800',
			eradicating: 'bg-yellow-200 text-yellow-800',
			eradicated: 'bg-blue-100 text-blue-800',
			recovering: 'bg-blue-200 text-blue-800',
			recovered: 'bg-green-100 text-green-800',
			lessons_learned: 'bg-green-200 text-green-800',
			closed: 'bg-gray-200 text-gray-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Incident Response</h1>
			<p class="text-sm text-gray-500">
				Security incident management with US-CERT/CISA reporting
			</p>
		</div>
		<div class="flex gap-2">
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={showOpenOnly} onchange={() => loadDashboard()} />
				Open incidents only
			</label>
			<button
				onclick={() => loadDashboard()}
				class="btn variant-ghost-surface"
				disabled={loading}
			>
				<i class="fa-solid fa-refresh" class:fa-spin={loading}></i>
				Refresh
			</button>
			<button onclick={handleNewIncident} class="btn variant-filled-error">
				<i class="fa-solid fa-plus"></i>
				Report Incident
			</button>
		</div>
	</div>

	<!-- Overdue Alert Banner -->
	{#if dashboardData && dashboardData.overdue_count > 0}
		<div class="alert variant-filled-error">
			<i class="fa-solid fa-exclamation-triangle"></i>
			<span>
				<strong>{dashboardData.overdue_count} incident(s)</strong> have overdue US-CERT reporting deadlines!
				<button
					class="underline ml-2"
					onclick={() => (activeTab = 'overdue')}
				>
					View details
				</button>
			</span>
		</div>
	{/if}

	<!-- Error display -->
	{#if error}
		<div class="alert variant-filled-warning">
			<i class="fa-solid fa-exclamation-triangle"></i>
			<span>{error}</span>
		</div>
	{/if}

	<!-- Tabs -->
	<div class="flex gap-1 border-b border-gray-200">
		{#each tabs as tab}
			<button
				class="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative
					   {activeTab === tab.id
					? 'bg-white text-primary-600 border-b-2 border-primary-500'
					: 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}"
				onclick={() => (activeTab = tab.id as typeof activeTab)}
			>
				<i class="{tab.icon} mr-2"></i>
				{tab.label}
				{#if tab.id === 'overdue' && dashboardData?.overdue_count}
					<span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
						{dashboardData.overdue_count}
					</span>
				{/if}
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
			<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Total Incidents</div>
					<div class="text-3xl font-bold text-gray-900">{dashboardData.total_incidents}</div>
				</div>
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Open Incidents</div>
					<div class="text-3xl font-bold text-red-600">{dashboardData.open_incidents}</div>
				</div>
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Overdue Reports</div>
					<div class="text-3xl font-bold {dashboardData.overdue_count > 0 ? 'text-red-600' : 'text-green-600'}">
						{dashboardData.overdue_count}
					</div>
				</div>
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Avg Time to Contain</div>
					<div class="text-3xl font-bold text-blue-600">
						{formatDuration(dashboardData.avg_time_to_contain_hours)}
					</div>
				</div>
				<div class="card p-4 bg-white shadow-sm">
					<div class="text-sm text-gray-500">Avg Time to Resolve</div>
					<div class="text-3xl font-bold text-green-600">
						{formatDuration(dashboardData.avg_time_to_resolve_hours)}
					</div>
				</div>
			</div>

			<!-- US-CERT Reporting Deadlines Reference -->
			<div class="card p-4 bg-white shadow-sm">
				<h3 class="text-lg font-semibold mb-4">US-CERT Reporting Deadlines</h3>
				<div class="grid grid-cols-5 gap-4">
					{#each Object.entries(SEVERITY_CONFIG) as [key, config]}
						<div class="text-center p-3 rounded-lg {config.color}">
							<div class="font-semibold">{config.label}</div>
							<div class="text-sm opacity-90">{config.deadline}</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Charts -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				{#if severityChartData.length > 0}
					<div class="card p-6 bg-white shadow-sm">
						<h3 class="text-lg font-semibold mb-4">Incidents by Severity</h3>
						<DonutChart data={severityChartData} />
					</div>
				{/if}
				{#if statusChartData.length > 0}
					<div class="card p-6 bg-white shadow-sm">
						<h3 class="text-lg font-semibold mb-4">Incidents by Status</h3>
						<DonutChart data={statusChartData} />
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
								Incident #
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Title
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Severity
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Category
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Status
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								US-CERT
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Detected
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each incidents as incident}
							<tr class="hover:bg-gray-50 {incident.reporting_overdue ? 'bg-red-50' : ''}">
								<td class="px-4 py-3 text-sm font-mono text-gray-900">
									{incident.incident_number}
									{#if incident.reporting_overdue}
										<i class="fa-solid fa-exclamation-triangle text-red-500 ml-1" title="Overdue"></i>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm text-gray-900">{incident.title}</td>
								<td class="px-4 py-3">
									<span class="px-2 py-1 text-xs rounded-full {SEVERITY_CONFIG[incident.severity]?.color || 'bg-gray-100'}">
										{SEVERITY_CONFIG[incident.severity]?.label || incident.severity}
									</span>
								</td>
								<td class="px-4 py-3 text-sm text-gray-500">
									{CATEGORY_LABELS[incident.category] || incident.category}
								</td>
								<td class="px-4 py-3">
									<span class="px-2 py-1 text-xs rounded-full {getStatusColor(incident.status)}">
										{INCIDENT_STATUS_MAPPING[incident.status]?.title || incident.status}
									</span>
								</td>
								<td class="px-4 py-3 text-sm">
									<span class="px-2 py-1 text-xs rounded-full
										{incident.uscert_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
										 incident.uscert_status === 'submitted' || incident.uscert_status === 'final_submitted' ? 'bg-green-100 text-green-800' :
										 incident.uscert_status === 'not_required' ? 'bg-gray-100 text-gray-800' :
										 'bg-blue-100 text-blue-800'}">
										{USCERT_STATUS_LABELS[incident.uscert_status] || incident.uscert_status}
									</span>
								</td>
								<td class="px-4 py-3 text-sm text-gray-500">
									{getTimeAgo(incident.detected_at)}
								</td>
								<td class="px-4 py-3">
									<a
										href="/rmf/incident-response/{incident.incident_number}"
										class="text-primary-600 hover:text-primary-800"
									>
										<i class="fa-solid fa-eye"></i>
									</a>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="8" class="px-4 py-8 text-center text-gray-500">
									No incidents found
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
			<WayfinderWorkflow config={createIncidentResponseWorkflow()} />

			<!-- Overdue Tab -->
		{:else if activeTab === 'overdue'}
			<div class="card bg-white shadow-sm">
				<div class="p-4 border-b border-gray-200">
					<h3 class="text-lg font-semibold text-red-600">
						<i class="fa-solid fa-exclamation-triangle mr-2"></i>
						Overdue US-CERT Reports
					</h3>
					<p class="text-sm text-gray-500 mt-1">
						These incidents have passed their US-CERT reporting deadline and require immediate action.
					</p>
				</div>
				{#if dashboardData.overdue_uscert_reporting.length > 0}
					<table class="w-full">
						<thead class="bg-red-50">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">
									Incident #
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">
									Title
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">
									Severity
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">
									Deadline
								</th>
								<th class="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">
									Action
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-red-100">
							{#each dashboardData.overdue_uscert_reporting as item}
								<tr class="bg-red-50 hover:bg-red-100">
									<td class="px-4 py-3 text-sm font-mono font-semibold text-red-900">
										{item.incident_number}
									</td>
									<td class="px-4 py-3 text-sm text-red-900">{item.title}</td>
									<td class="px-4 py-3">
										<span class="px-2 py-1 text-xs rounded-full {SEVERITY_CONFIG[item.severity]?.color || 'bg-gray-100'}">
											{SEVERITY_CONFIG[item.severity]?.label || item.severity}
										</span>
									</td>
									<td class="px-4 py-3 text-sm text-red-700 font-semibold">
										{item.deadline ? new Date(item.deadline).toLocaleString() : '-'}
									</td>
									<td class="px-4 py-3">
										<a
											href="/rmf/incident-response/{item.incident_number}"
											class="btn btn-sm variant-filled-error"
										>
											Submit Report
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<div class="p-8 text-center">
						<i class="fa-solid fa-check-circle text-4xl text-green-500 mb-4"></i>
						<p class="text-gray-600">No overdue US-CERT reports. All reporting is current.</p>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
