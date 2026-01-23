<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$paraglide/messages';
	import { base } from '$app/paths';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	interface Connector {
		id: string;
		name: string;
		connector_type: string;
		status: 'idle' | 'syncing' | 'error' | 'connected';
		last_sync: string | null;
		next_sync: string | null;
		sync_frequency: string;
		error_message: string | null;
		total_syncs: number;
		successful_syncs: number;
		created_at: string;
	}

	interface AvailableConnector {
		type: string;
		name: string;
		category: string;
		description: string;
		auth_methods: string[];
		icon: string;
	}

	let connectors: Connector[] = $state(data.connectors || []);
	let availableConnectors: AvailableConnector[] = $state(data.availableConnectors || []);
	let loading = $state(false);
	let activeTab = $state<'configured' | 'available'>('configured');
	let selectedCategory = $state<string>('all');
	let searchQuery = $state('');
	let showAddModal = $state(false);
	let selectedConnectorType = $state<AvailableConnector | null>(null);

	$: breadcrumbs = [
		{ label: m.connectors?.() || 'Connectors', href: `${base}/connectors` }
	];

	// Derived: filter available connectors
	const filteredAvailable = $derived.by(() => {
		return availableConnectors.filter(c => {
			const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
			const matchesSearch = !searchQuery ||
				c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				c.description.toLowerCase().includes(searchQuery.toLowerCase());
			return matchesCategory && matchesSearch;
		});
	});

	// Get unique categories
	const categories = $derived.by(() => {
		const cats = new Set(availableConnectors.map(c => c.category));
		return ['all', ...Array.from(cats)];
	});

	// Status colors
	function getStatusColor(status: string): string {
		const colors: Record<string, string> = {
			idle: 'bg-gray-100 text-gray-800',
			syncing: 'bg-blue-100 text-blue-800',
			connected: 'bg-green-100 text-green-800',
			error: 'bg-red-100 text-red-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	}

	// Category icons
	function getCategoryIcon(category: string): string {
		const icons: Record<string, string> = {
			'cloud_security': 'fa-cloud-bolt',
			'sast_dast': 'fa-bug',
			'container': 'fa-cube',
			'vulnerability': 'fa-shield-halved',
			'cicd': 'fa-code-branch',
			'identity': 'fa-users',
			'endpoint': 'fa-laptop',
			'crm': 'fa-address-book'
		};
		return icons[category] || 'fa-plug';
	}

	// Connector actions
	async function syncConnector(id: string) {
		loading = true;
		try {
			const res = await fetch(`/api/connectors/${id}/sync/`, { method: 'POST' });
			if (res.ok) {
				await loadConnectors();
			}
		} finally {
			loading = false;
		}
	}

	async function deleteConnector(id: string) {
		if (!confirm('Are you sure you want to delete this connector?')) return;
		try {
			const res = await fetch(`/api/connectors/${id}/`, { method: 'DELETE' });
			if (res.ok) {
				connectors = connectors.filter(c => c.id !== id);
			}
		} catch (e) {
			console.error('Failed to delete connector:', e);
		}
	}

	async function loadConnectors() {
		try {
			const res = await fetch('/api/connectors/');
			if (res.ok) {
				const data = await res.json();
				connectors = data.results || data || [];
			}
		} catch (e) {
			console.error('Failed to load connectors:', e);
		}
	}

	function openAddModal(connectorType: AvailableConnector) {
		selectedConnectorType = connectorType;
		showAddModal = true;
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleString();
	}
</script>

<svelte:head>
	<title>{m.connectors?.() || 'Connectors'}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8 flex justify-between items-start">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
				{m.connectorManagement?.() || 'Connector Management'}
			</h1>
			<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
				{m.connectorDescription?.() || 'Connect to security tools and automate evidence collection'}
			</p>
		</div>
	</div>

	<!-- Tabs -->
	<div class="border-b border-gray-200 mb-6">
		<nav class="-mb-px flex space-x-8">
			<button
				class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'configured'
					? 'border-indigo-500 text-indigo-600'
					: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				onclick={() => (activeTab = 'configured')}
			>
				<i class="fa-solid fa-plug mr-2"></i>
				{m.configuredConnectors?.() || 'Configured'} ({connectors.length})
			</button>
			<button
				class="py-4 px-1 border-b-2 font-medium text-sm {activeTab === 'available'
					? 'border-indigo-500 text-indigo-600'
					: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				onclick={() => (activeTab = 'available')}
			>
				<i class="fa-solid fa-plus-circle mr-2"></i>
				{m.availableConnectors?.() || 'Available'} ({availableConnectors.length})
			</button>
		</nav>
	</div>

	<!-- Configured Connectors Tab -->
	{#if activeTab === 'configured'}
		{#if connectors.length === 0}
			<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
				<i class="fa-solid fa-plug text-6xl text-gray-300 mb-4"></i>
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">
					{m.noConnectorsConfigured?.() || 'No connectors configured'}
				</h3>
				<p class="mt-2 text-gray-500 dark:text-gray-400">
					{m.addConnectorPrompt?.() || 'Add a connector to start automating evidence collection'}
				</p>
				<button
					class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
					onclick={() => (activeTab = 'available')}
				>
					<i class="fa-solid fa-plus mr-2"></i>
					{m.addConnector?.() || 'Add Connector'}
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each connectors as connector}
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
						<div class="p-6">
							<div class="flex items-start justify-between">
								<div class="flex items-center">
									<div class="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mr-4">
										<i class="fa-solid {getCategoryIcon(connector.connector_type)} text-indigo-600 text-xl"></i>
									</div>
									<div>
										<h3 class="font-semibold text-gray-900 dark:text-white">{connector.name}</h3>
										<p class="text-sm text-gray-500">{connector.connector_type}</p>
									</div>
								</div>
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(connector.status)}">
									{connector.status}
								</span>
							</div>

							{#if connector.error_message}
								<div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
									<p class="text-sm text-red-700 dark:text-red-400">{connector.error_message}</p>
								</div>
							{/if}

							<div class="mt-4 space-y-2 text-sm text-gray-500 dark:text-gray-400">
								<div class="flex justify-between">
									<span>{m.lastSync?.() || 'Last sync'}:</span>
									<span class="font-medium">{formatDate(connector.last_sync)}</span>
								</div>
								<div class="flex justify-between">
									<span>{m.nextSync?.() || 'Next sync'}:</span>
									<span class="font-medium">{formatDate(connector.next_sync)}</span>
								</div>
								<div class="flex justify-between">
									<span>{m.successRate?.() || 'Success rate'}:</span>
									<span class="font-medium">
										{connector.total_syncs > 0
											? Math.round((connector.successful_syncs / connector.total_syncs) * 100)
											: 0}%
									</span>
								</div>
							</div>
						</div>

						<div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-between">
							<button
								class="text-sm text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
								onclick={() => syncConnector(connector.id)}
								disabled={loading || connector.status === 'syncing'}
							>
								<i class="fa-solid fa-sync mr-1" class:fa-spin={connector.status === 'syncing'}></i>
								{m.syncNow?.() || 'Sync Now'}
							</button>
							<div class="flex gap-3">
								<a
									href="{base}/connectors/{connector.id}"
									class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400"
								>
									<i class="fa-solid fa-cog"></i>
								</a>
								<button
									class="text-sm text-red-600 hover:text-red-900"
									onclick={() => deleteConnector(connector.id)}
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

	<!-- Available Connectors Tab -->
	{#if activeTab === 'available'}
		<!-- Filters -->
		<div class="mb-6 flex flex-wrap gap-4">
			<div class="flex-1 min-w-[200px]">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="{m.searchConnectors?.() || 'Search connectors...'}"
					class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600"
				/>
			</div>
			<div class="flex gap-2 flex-wrap">
				{#each categories as category}
					<button
						class="px-3 py-1 rounded-full text-sm font-medium {selectedCategory === category
							? 'bg-indigo-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}"
						onclick={() => (selectedCategory = category)}
					>
						{category === 'all' ? 'All' : category.replace('_', ' ')}
					</button>
				{/each}
			</div>
		</div>

		<!-- Connector Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each filteredAvailable as connector}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
					<div class="p-6">
						<div class="flex items-start">
							<div class="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-4">
								<i class="fa-solid {getCategoryIcon(connector.category)} text-white text-2xl"></i>
							</div>
							<div class="flex-1">
								<h3 class="font-semibold text-gray-900 dark:text-white">{connector.name}</h3>
								<span class="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
									{connector.category.replace('_', ' ')}
								</span>
							</div>
						</div>
						<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">{connector.description}</p>
						<div class="mt-4 flex flex-wrap gap-2">
							{#each connector.auth_methods as method}
								<span class="inline-flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded dark:bg-blue-900/20 dark:text-blue-400">
									<i class="fa-solid fa-key mr-1"></i>
									{method}
								</span>
							{/each}
						</div>
					</div>
					<div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50">
						<button
							class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
							onclick={() => openAddModal(connector)}
						>
							<i class="fa-solid fa-plus mr-2"></i>
							{m.configure?.() || 'Configure'}
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Add Connector Modal -->
{#if showAddModal && selectedConnectorType}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					Configure {selectedConnectorType.name}
				</h3>
				<button onclick={() => (showAddModal = false)} class="text-gray-400 hover:text-gray-600">
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="p-6">
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					{selectedConnectorType.description}
				</p>
				<form class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Connection Name
						</label>
						<input
							type="text"
							class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
							placeholder="My {selectedConnectorType.name} Integration"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Authentication Method
						</label>
						<select class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600">
							{#each selectedConnectorType.auth_methods as method}
								<option value={method}>{method}</option>
							{/each}
						</select>
					</div>
					<!-- Credential fields would be dynamically generated based on auth method -->
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							API Key / Token
						</label>
						<input
							type="password"
							class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
							placeholder="Enter your API key"
						/>
					</div>
				</form>
			</div>
			<div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
				<button
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500"
					onclick={() => (showAddModal = false)}
				>
					Cancel
				</button>
				<button
					class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
				>
					Test & Save
				</button>
			</div>
		</div>
	</div>
{/if}
