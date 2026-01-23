<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$paraglide/messages';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import WorkflowBuilder from '$lib/components/WorkflowBuilder/WorkflowBuilder.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	interface Workflow {
		id: string;
		name: string;
		description: string;
		version: number;
		status: 'draft' | 'active' | 'inactive' | 'archived';
		trigger: { type: string; config: Record<string, any> };
		category: string;
		tags: string[];
		total_executions: number;
		successful_executions: number;
		failed_executions: number;
		last_executed_at: string | null;
		created_at: string;
		updated_at: string;
	}

	let workflows: Workflow[] = $state(data.workflows || []);
	let loading = $state(false);
	let activeTab = $state<'list' | 'builder'>('list');
	let selectedWorkflow = $state<Workflow | null>(null);
	let searchQuery = $state('');
	let statusFilter = $state<string>('all');
	let showCreateModal = $state(false);
	let newWorkflowName = $state('');
	let newWorkflowDescription = $state('');

	$: breadcrumbs = [
		{ label: m.workflows?.() || 'Workflows', href: `${base}/workflows` }
	];

	// Derived: filtered workflows
	const filteredWorkflows = $derived.by(() => {
		return workflows.filter(w => {
			const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
			const matchesSearch = !searchQuery ||
				w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				w.description.toLowerCase().includes(searchQuery.toLowerCase());
			return matchesStatus && matchesSearch;
		});
	});

	// Status colors
	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			draft: 'bg-gray-100 text-gray-800',
			active: 'bg-green-100 text-green-800',
			inactive: 'bg-yellow-100 text-yellow-800',
			archived: 'bg-red-100 text-red-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	}

	// Trigger type icons
	function getTriggerIcon(type: string): string {
		const icons: Record<string, string> = {
			manual: 'fa-hand-pointer',
			schedule: 'fa-clock',
			event: 'fa-bolt',
			webhook: 'fa-globe',
			connector: 'fa-plug'
		};
		return icons[type] || 'fa-play';
	}

	// Actions
	async function createWorkflow() {
		if (!newWorkflowName.trim()) return;

		loading = true;
		try {
			const res = await fetch('/api/workflows/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newWorkflowName,
					description: newWorkflowDescription,
					trigger: { type: 'manual', config: {} }
				})
			});

			if (res.ok) {
				const workflow = await res.json();
				workflows = [workflow, ...workflows];
				showCreateModal = false;
				newWorkflowName = '';
				newWorkflowDescription = '';
				// Open in builder
				selectedWorkflow = workflow;
				activeTab = 'builder';
			}
		} catch (e) {
			console.error('Failed to create workflow:', e);
		} finally {
			loading = false;
		}
	}

	async function deleteWorkflow(id: string) {
		if (!confirm('Are you sure you want to delete this workflow?')) return;

		try {
			const res = await fetch(`/api/workflows/${id}/`, { method: 'DELETE' });
			if (res.ok) {
				workflows = workflows.filter(w => w.id !== id);
			}
		} catch (e) {
			console.error('Failed to delete workflow:', e);
		}
	}

	async function activateWorkflow(id: string) {
		try {
			const res = await fetch(`/api/workflows/${id}/activate/`, { method: 'POST' });
			if (res.ok) {
				const updated = await res.json();
				workflows = workflows.map(w => w.id === id ? { ...w, status: 'active' } : w);
			}
		} catch (e) {
			console.error('Failed to activate workflow:', e);
		}
	}

	async function deactivateWorkflow(id: string) {
		try {
			const res = await fetch(`/api/workflows/${id}/deactivate/`, { method: 'POST' });
			if (res.ok) {
				workflows = workflows.map(w => w.id === id ? { ...w, status: 'inactive' } : w);
			}
		} catch (e) {
			console.error('Failed to deactivate workflow:', e);
		}
	}

	async function executeWorkflow(id: string) {
		try {
			const res = await fetch(`/api/workflows/${id}/execute/`, { method: 'POST' });
			if (res.ok) {
				const result = await res.json();
				alert(`Workflow started. Execution ID: ${result.execution_id}`);
			}
		} catch (e) {
			console.error('Failed to execute workflow:', e);
		}
	}

	function openBuilder(workflow: Workflow) {
		selectedWorkflow = workflow;
		activeTab = 'builder';
	}

	function closeBuilder() {
		selectedWorkflow = null;
		activeTab = 'list';
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleString();
	}
</script>

<svelte:head>
	<title>{m.workflows?.() || 'Workflows'}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8 flex justify-between items-start">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
				{m.workflowAutomation?.() || 'Workflow Automation'}
			</h1>
			<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
				{m.workflowDescription?.() || 'Build and manage automated GRC workflows'}
			</p>
		</div>
		{#if activeTab === 'list'}
			<button
				class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
				onclick={() => (showCreateModal = true)}
			>
				<i class="fa-solid fa-plus mr-2"></i>
				{m.createWorkflow?.() || 'Create Workflow'}
			</button>
		{:else}
			<button
				class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
				onclick={closeBuilder}
			>
				<i class="fa-solid fa-arrow-left mr-2"></i>
				{m.backToList?.() || 'Back to List'}
			</button>
		{/if}
	</div>

	<!-- List View -->
	{#if activeTab === 'list'}
		<!-- Filters -->
		<div class="mb-6 flex flex-wrap gap-4">
			<div class="flex-1 min-w-[200px]">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="{m.searchWorkflows?.() || 'Search workflows...'}"
					class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600"
				/>
			</div>
			<select
				bind:value={statusFilter}
				class="px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600"
			>
				<option value="all">{m.allStatuses?.() || 'All Statuses'}</option>
				<option value="draft">{m.draft?.() || 'Draft'}</option>
				<option value="active">{m.active?.() || 'Active'}</option>
				<option value="inactive">{m.inactive?.() || 'Inactive'}</option>
				<option value="archived">{m.archived?.() || 'Archived'}</option>
			</select>
		</div>

		<!-- Workflow Cards -->
		{#if filteredWorkflows.length === 0}
			<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
				<i class="fa-solid fa-diagram-project text-6xl text-gray-300 mb-4"></i>
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">
					{m.noWorkflows?.() || 'No workflows found'}
				</h3>
				<p class="mt-2 text-gray-500 dark:text-gray-400">
					{m.createWorkflowPrompt?.() || 'Create your first workflow to automate GRC processes'}
				</p>
				<button
					class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
					onclick={() => (showCreateModal = true)}
				>
					<i class="fa-solid fa-plus mr-2"></i>
					{m.createWorkflow?.() || 'Create Workflow'}
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each filteredWorkflows as workflow}
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow">
						<div class="p-6">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<h3 class="font-semibold text-gray-900 dark:text-white truncate">{workflow.name}</h3>
									<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
										{workflow.description || 'No description'}
									</p>
								</div>
								<span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(workflow.status)}">
									{workflow.status}
								</span>
							</div>

							<div class="mt-4 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
								<div class="flex items-center" title="Trigger type">
									<i class="fa-solid {getTriggerIcon(workflow.trigger.type)} mr-1"></i>
									<span class="capitalize">{workflow.trigger.type}</span>
								</div>
								<div class="flex items-center" title="Version">
									<i class="fa-solid fa-code-branch mr-1"></i>
									v{workflow.version}
								</div>
							</div>

							<div class="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
								<div class="bg-gray-50 dark:bg-gray-700 rounded p-2">
									<div class="font-semibold text-gray-900 dark:text-white">{workflow.total_executions}</div>
									<div class="text-xs text-gray-500">Total</div>
								</div>
								<div class="bg-green-50 dark:bg-green-900/20 rounded p-2">
									<div class="font-semibold text-green-600">{workflow.successful_executions}</div>
									<div class="text-xs text-gray-500">Success</div>
								</div>
								<div class="bg-red-50 dark:bg-red-900/20 rounded p-2">
									<div class="font-semibold text-red-600">{workflow.failed_executions}</div>
									<div class="text-xs text-gray-500">Failed</div>
								</div>
							</div>

							<div class="mt-4 text-xs text-gray-400">
								Last run: {formatDate(workflow.last_executed_at)}
							</div>
						</div>

						<div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
							<button
								class="text-sm text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
								onclick={() => openBuilder(workflow)}
							>
								<i class="fa-solid fa-edit mr-1"></i>
								Edit
							</button>
							<div class="flex gap-3">
								{#if workflow.status === 'active'}
									<button
										class="text-sm text-yellow-600 hover:text-yellow-900"
										onclick={() => deactivateWorkflow(workflow.id)}
										title="Deactivate"
									>
										<i class="fa-solid fa-pause"></i>
									</button>
								{:else if workflow.status !== 'archived'}
									<button
										class="text-sm text-green-600 hover:text-green-900"
										onclick={() => activateWorkflow(workflow.id)}
										title="Activate"
									>
										<i class="fa-solid fa-play"></i>
									</button>
								{/if}
								<button
									class="text-sm text-blue-600 hover:text-blue-900"
									onclick={() => executeWorkflow(workflow.id)}
									title="Run now"
								>
									<i class="fa-solid fa-rocket"></i>
								</button>
								<button
									class="text-sm text-red-600 hover:text-red-900"
									onclick={() => deleteWorkflow(workflow.id)}
									title="Delete"
								>
									<i class="fa-solid fa-trash"></i>
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Builder View -->
	{#if activeTab === 'builder' && selectedWorkflow}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden" style="height: calc(100vh - 250px);">
			<WorkflowBuilder
				workflowId={selectedWorkflow.id}
				initialName={selectedWorkflow.name}
				initialDescription={selectedWorkflow.description}
				onSave={() => {
					// Refresh workflow list
					closeBuilder();
				}}
			/>
		</div>
	{/if}
</div>

<!-- Create Workflow Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					{m.createWorkflow?.() || 'Create New Workflow'}
				</h3>
				<button onclick={() => (showCreateModal = false)} class="text-gray-400 hover:text-gray-600">
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="p-6">
				<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); createWorkflow(); }}>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Workflow Name *
						</label>
						<input
							type="text"
							bind:value={newWorkflowName}
							class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
							placeholder="e.g., Weekly Compliance Check"
							required
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Description
						</label>
						<textarea
							bind:value={newWorkflowDescription}
							rows="3"
							class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
							placeholder="Describe what this workflow does..."
						></textarea>
					</div>
				</form>
			</div>
			<div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
				<button
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500"
					onclick={() => (showCreateModal = false)}
				>
					Cancel
				</button>
				<button
					class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
					onclick={createWorkflow}
					disabled={loading || !newWorkflowName.trim()}
				>
					{#if loading}
						<i class="fa-solid fa-spinner fa-spin mr-2"></i>
					{/if}
					Create & Open Builder
				</button>
			</div>
		</div>
	</div>
{/if}
