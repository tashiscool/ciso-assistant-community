<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$paraglide/messages';
	import { base } from '$app/paths';
	import { BASE_API_URL } from '$lib/utils/constants';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
	let newConnectorName = $state('');
	let newConnectorAuthMethod = $state('');
	let newConnectorApiKey = $state('');
	let addingConnector = $state(false);
	let addConnectorError = $state('');
	const apiBaseUrl = typeof window === 'undefined' ? BASE_API_URL : '/api';

	const breadcrumbs = $derived([
		{ label: m.connectors?.() || 'Connectors', href: `${base}/connectors` }
	]);

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

	function getCookieValue(name: string): string {
		if (typeof document === 'undefined') return '';
		const prefix = `${name}=`;
		const item = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));
		return item ? decodeURIComponent(item.slice(prefix.length)) : '';
	}

	function getAuthHeaders(includeJson = false, includeCsrf = false): Record<string, string> {
		const headers: Record<string, string> = {};
		const token = getCookieValue('token');
		if (token) {
			headers.Authorization = `Token ${token}`;
		}
		if (includeJson) {
			headers['Content-Type'] = 'application/json';
		}
		if (includeCsrf) {
			const csrfToken = getCookieValue('csrftoken');
			if (csrfToken) {
				headers['X-CSRFToken'] = csrfToken;
			}
		}
		return headers;
	}

	// Connector actions
	async function syncConnector(id: string) {
		loading = true;
		try {
			const res = await fetch(`${apiBaseUrl}/connectors/instances/${id}/sync/`, {
				method: 'POST',
				headers: getAuthHeaders(false, true),
				credentials: 'include'
			});
			if (res.ok) {
				await loadConnectors();
			}
		} finally {
			loading = false;
		}
	}

	async function deleteConnector(id: string) {
		const confirmed = typeof window === 'undefined'
			? true
			: window.confirm('Are you sure you want to delete this connector?');
		if (!confirmed) return;
		try {
			const res = await fetch(`${apiBaseUrl}/connectors/instances/${id}/`, {
				method: 'DELETE',
				headers: getAuthHeaders(false, true),
				credentials: 'include'
			});
			if (!res.ok) {
				const errorBody = await res.text();
				throw new Error(errorBody || `Delete failed with status ${res.status}`);
			}
			await loadConnectors();
		} catch (e) {
			console.error('Failed to delete connector:', e);
		}
	}

	async function loadConnectors() {
		try {
			const res = await fetch(`${apiBaseUrl}/connectors/instances/`, {
				headers: getAuthHeaders(),
				credentials: 'include'
			});
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
		newConnectorName = '';
		newConnectorAuthMethod = connectorType.auth_methods[0] || '';
		newConnectorApiKey = '';
		addConnectorError = '';
		showAddModal = true;
	}

	async function saveConnector() {
		if (!selectedConnectorType) return;
		if (!newConnectorName.trim()) {
			addConnectorError = 'Connection name is required.';
			return;
		}
		if (!newConnectorApiKey.trim()) {
			addConnectorError = 'API key / token is required.';
			return;
		}
		addingConnector = true;
		addConnectorError = '';
		try {
			const res = await fetch(`${apiBaseUrl}/connectors/instances/`, {
				method: 'POST',
				headers: getAuthHeaders(true, true),
				credentials: 'include',
				body: JSON.stringify({
					name: newConnectorName.trim(),
					connector_type: selectedConnectorType.type,
					config: {
						auth_method: newConnectorAuthMethod,
						api_key: newConnectorApiKey.trim()
					}
				})
			});
			if (res.ok) {
				showAddModal = false;
				await loadConnectors();
				activeTab = 'configured';
			} else {
				const err = await res.json();
				addConnectorError = err.error || err.detail || 'Failed to save connector.';
			}
		} catch {
			addConnectorError = 'Network error. Please try again.';
		} finally {
			addingConnector = false;
		}
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
	<div class="brand-card-dark mb-8 flex items-start justify-between overflow-hidden px-6 py-7 lg:px-8">
		<div>
			<span class="brand-overline !text-white/70">Regovise Connectors</span>
			<h1 class="mt-3 text-3xl font-bold text-white">
				{m.connectorManagement?.() || 'Connector Management'}
			</h1>
			<p class="mt-2 max-w-2xl text-base text-white/72">
				{m.connectorDescription?.() || 'Connect to security tools and automate evidence collection'}
			</p>
		</div>
	</div>

	<!-- Tabs -->
	<div class="brand-card mb-6 p-2">
		<nav class="flex flex-wrap gap-2">
			<button
				class="brand-chip {activeTab === 'configured'
					? '!bg-[var(--rv-midnight)] !text-white !border-[rgba(88,181,255,0.24)]'
					: ''}"
				onclick={() => (activeTab = 'configured')}
			>
				<i class="fa-solid fa-plug mr-2"></i>
				{m.configuredConnectors?.() || 'Configured'} ({connectors.length})
			</button>
			<button
				class="brand-chip {activeTab === 'available'
					? '!bg-[var(--rv-midnight)] !text-white !border-[rgba(88,181,255,0.24)]'
					: ''}"
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
			<div class="brand-card px-6 py-14 text-center">
				<i class="fa-solid fa-plug text-6xl text-gray-300 mb-4"></i>
				<h3 class="text-lg font-medium text-[var(--rv-midnight)]">
					{m.noConnectorsConfigured?.() || 'No connectors configured'}
				</h3>
				<p class="mt-2 text-slate-500">
					{m.addConnectorPrompt?.() || 'Add a connector to start automating evidence collection'}
				</p>
				<button
					class="btn mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white"
					style="background: var(--rv-gradient-accent); box-shadow: var(--rv-shadow-glow);"
					onclick={() => (activeTab = 'available')}
				>
					<i class="fa-solid fa-plus mr-2"></i>
					{m.addConnector?.() || 'Add Connector'}
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each connectors as connector}
					<div class="brand-card overflow-hidden" data-testid="configured-connector-card">
						<div class="p-6">
							<div class="flex items-start justify-between">
								<div class="flex items-center">
									<div class="brand-icon-badge mr-4 h-12 w-12 rounded-[18px] text-xl">
										<i class="fa-solid {getCategoryIcon(connector.connector_type)} text-white"></i>
									</div>
									<div>
										<h3 class="font-semibold text-[var(--rv-midnight)]">{connector.name}</h3>
										<p class="text-sm text-slate-500">{connector.connector_type}</p>
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

						<div class="flex justify-between border-t border-slate-200/70 px-6 py-4">
							<button
								class="text-sm font-medium text-[var(--rv-blue)] hover:text-[var(--rv-midnight)]"
								onclick={() => syncConnector(connector.id)}
								disabled={loading || connector.status === 'syncing'}
								data-testid="connector-sync-button"
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
									data-testid="connector-delete-button"
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
		<div class="brand-card mb-6 flex flex-wrap gap-4 p-4">
			<div class="flex-1 min-w-[200px]">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="{m.searchConnectors?.() || 'Search connectors...'}"
					class="input w-full px-4 py-2"
				/>
			</div>
			<div class="flex gap-2 flex-wrap">
				{#each categories as category}
					<button
						class="brand-chip {selectedCategory === category
							? '!bg-[var(--rv-midnight)] !text-white !border-[rgba(88,181,255,0.24)]'
							: ''}"
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
				<div class="brand-card overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgb(11_31_42_/_0.12)]">
					<div class="p-6">
						<div class="flex items-start">
							<div class="brand-icon-badge mr-4 h-14 w-14 rounded-[20px] text-2xl">
								<i class="fa-solid {getCategoryIcon(connector.category)} text-white"></i>
							</div>
							<div class="flex-1">
								<h3 class="font-semibold text-[var(--rv-midnight)]">{connector.name}</h3>
								<span class="brand-chip mt-2">
									{connector.category.replace('_', ' ')}
								</span>
							</div>
						</div>
						<p class="mt-4 text-sm text-slate-600">{connector.description}</p>
						<div class="mt-4 flex flex-wrap gap-2">
							{#each connector.auth_methods as method}
								<span class="brand-chip !bg-[rgba(88,181,255,0.12)] !text-[var(--rv-midnight)]">
									<i class="fa-solid fa-key mr-1"></i>
									{method}
								</span>
							{/each}
						</div>
					</div>
					<div class="border-t border-slate-200/70 px-6 py-4">
						<button
							class="btn w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white"
							style="background: var(--rv-gradient-accent); box-shadow: var(--rv-shadow-glow);"
							onclick={() => openAddModal(connector)}
							data-testid="connector-configure-button"
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
		<div class="brand-card mx-4 w-full max-w-md" data-testid="connector-configure-modal">
			<div class="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
				<h3 class="text-lg font-semibold text-[var(--rv-midnight)]">
					Configure {selectedConnectorType.name}
				</h3>
				<button onclick={() => (showAddModal = false)} class="text-slate-400 hover:text-[var(--rv-midnight)]">
					<i class="fa-solid fa-times"></i>
				</button>
			</div>
			<div class="p-6">
				<p class="mb-4 text-sm text-slate-600">
					{selectedConnectorType.description}
				</p>
				<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); saveConnector(); }}>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Connection Name *
						</label>
						<input
							type="text"
							bind:value={newConnectorName}
							class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
							placeholder="My {selectedConnectorType.name} Integration"
							data-testid="connector-name-input"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Authentication Method
						</label>
						<select
							bind:value={newConnectorAuthMethod}
							class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
							data-testid="connector-auth-method-input"
						>
							{#each selectedConnectorType.auth_methods as method}
								<option value={method}>{method}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							API Key / Token *
						</label>
						<input
							type="password"
							bind:value={newConnectorApiKey}
							class="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
							placeholder="Enter your API key or token"
							data-testid="connector-api-key-input"
						/>
					</div>
					{#if addConnectorError}
						<p class="text-sm text-red-600">{addConnectorError}</p>
					{/if}
				</form>
			</div>
			<div class="flex justify-end gap-3 border-t border-slate-200/70 px-6 py-4">
				<button
					class="btn px-4 py-2 text-sm font-medium text-slate-700"
					onclick={() => (showAddModal = false)}
					data-testid="connector-cancel-button"
				>
					Cancel
				</button>
				<button
					class="btn px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
					style="background: var(--rv-gradient-accent); box-shadow: var(--rv-shadow-glow);"
					onclick={saveConnector}
					disabled={addingConnector}
					data-testid="connector-save-button"
				>
					{#if addingConnector}
						<i class="fa-solid fa-spinner fa-spin mr-1"></i>
					{/if}
					Test & Save
				</button>
			</div>
		</div>
	</div>
{/if}
