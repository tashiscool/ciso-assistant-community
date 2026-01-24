<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { BASE_API_URL } from '$lib/utils/constants';

	interface CSODetail {
		id: string;
		name: string;
		description: string;
		impact_level: string;
		authorization_status: string;
		authorization_date: string | null;
		expiration_date: string | null;
		service_model: string;
		deployment_model: string;
		agency_sponsor: string | null;
		authorization_boundary: string | null;
		data_types: string[];
		published_at: string | null;
	}

	interface KSICompliance {
		total_ksis: number;
		compliant_ksis: number;
		non_compliant_ksis: number;
		compliance_rate: number;
		ksi_by_category: Record<
			string,
			{
				category_name: string;
				total: number;
				compliant: number;
				rate: number;
			}
		>;
		last_validation_date: string | null;
	}

	interface OARHistoryItem {
		id: string;
		year: number;
		quarter: number;
		status: string;
		generated_at: string;
		ksi_compliance_rate: number;
		vulnerability_count: number;
		incident_count: number;
	}

	let csoId = $derived($page.params.cso_id);
	let cso = $state<CSODetail | null>(null);
	let compliance = $state<KSICompliance | null>(null);
	let oarHistory = $state<OARHistoryItem[]>([]);
	let loading = $state(true);
	let error = $state('');
	let activeTab = $state<'overview' | 'compliance' | 'history' | 'oscal'>('overview');
	let oscalData = $state<any>(null);
	let oscalLoading = $state(false);

	onMount(async () => {
		await loadCSOData();
	});

	async function loadCSOData() {
		loading = true;
		error = '';

		try {
			const [csoRes, complianceRes, historyRes] = await Promise.all([
				fetch(`${BASE_API_URL}/rmf/trust-center/csos/${csoId}/`),
				fetch(`${BASE_API_URL}/rmf/trust-center/csos/${csoId}/compliance/`),
				fetch(`${BASE_API_URL}/rmf/trust-center/csos/${csoId}/oar-history/`)
			]);

			if (csoRes.ok) {
				cso = await csoRes.json();
			} else {
				throw new Error('CSO not found');
			}

			if (complianceRes.ok) {
				compliance = await complianceRes.json();
			}

			if (historyRes.ok) {
				const data = await historyRes.json();
				oarHistory = data.results || data || [];
			}
		} catch (e: any) {
			error = e.message || 'Failed to load CSO data';
			console.error('CSO load error:', e);
		} finally {
			loading = false;
		}
	}

	async function loadOSCAL() {
		if (oscalData) return;

		oscalLoading = true;
		try {
			const response = await fetch(`${BASE_API_URL}/rmf/trust-center/csos/${csoId}/oscal/`);
			if (response.ok) {
				oscalData = await response.json();
			}
		} catch (e) {
			console.error('Failed to load OSCAL data:', e);
		} finally {
			oscalLoading = false;
		}
	}

	function getStatusBadgeClass(status: string): string {
		switch (status?.toLowerCase()) {
			case 'authorized':
				return 'bg-green-100 text-green-800';
			case 'in_process':
			case 'in process':
				return 'bg-blue-100 text-blue-800';
			case 'ready':
				return 'bg-yellow-100 text-yellow-800';
			case 'revoked':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function getImpactBadgeClass(impact: string): string {
		switch (impact?.toLowerCase()) {
			case 'high':
				return 'bg-red-100 text-red-800';
			case 'moderate':
				return 'bg-yellow-100 text-yellow-800';
			case 'low':
				return 'bg-green-100 text-green-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'N/A';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getComplianceColor(rate: number): string {
		if (rate >= 90) return 'text-green-600';
		if (rate >= 70) return 'text-yellow-600';
		return 'text-red-600';
	}

	function getComplianceBgColor(rate: number): string {
		if (rate >= 90) return 'bg-green-500';
		if (rate >= 70) return 'bg-yellow-500';
		return 'bg-red-500';
	}

	function downloadOSCAL() {
		if (!oscalData) return;

		const blob = new Blob([JSON.stringify(oscalData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${cso?.name?.replace(/\s+/g, '-').toLowerCase()}-oscal-ssp.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	$effect(() => {
		if (activeTab === 'oscal' && !oscalData && !oscalLoading) {
			loadOSCAL();
		}
	});
</script>

<svelte:head>
	<title>{cso?.name || 'CSO Detail'} - FedRAMP Trust Center</title>
</svelte:head>

<div class="mb-6">
	<a
		href="/trust-center"
		class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
	>
		<i class="fa-solid fa-arrow-left mr-2"></i>
		Back to Trust Center
	</a>
</div>

{#if loading}
	<div class="flex items-center justify-center py-20">
		<i class="fa-solid fa-spinner fa-spin text-4xl text-primary-600"></i>
	</div>
{:else if error}
	<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
		<i class="fa-solid fa-circle-exclamation text-3xl text-red-500 mb-4"></i>
		<p class="text-red-700">{error}</p>
		<a href="/trust-center" class="mt-4 inline-block px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
			Return to Trust Center
		</a>
	</div>
{:else if cso}
	<!-- CSO Header -->
	<div class="bg-white rounded-lg shadow p-6 mb-6">
		<div class="flex items-start justify-between">
			<div>
				<div class="flex items-center gap-3 mb-2">
					<h1 class="text-2xl font-bold text-gray-900">{cso.name}</h1>
					<span
						class="px-3 py-1 text-sm font-medium rounded-full {getStatusBadgeClass(
							cso.authorization_status
						)}"
					>
						{cso.authorization_status?.replace('_', ' ') || 'Unknown'}
					</span>
				</div>

				{#if cso.description}
					<p class="text-gray-600 mb-4 max-w-3xl">{cso.description}</p>
				{/if}

				<div class="flex flex-wrap gap-2">
					<span class="px-3 py-1 text-sm rounded-full {getImpactBadgeClass(cso.impact_level)}">
						{cso.impact_level || 'Unknown'} Impact
					</span>
					{#if cso.service_model}
						<span class="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
							{cso.service_model}
						</span>
					{/if}
					{#if cso.deployment_model}
						<span class="px-3 py-1 text-sm rounded-full bg-purple-100 text-purple-800">
							{cso.deployment_model}
						</span>
					{/if}
				</div>
			</div>

			{#if compliance}
				<div class="text-right">
					<div class="text-sm text-gray-500 mb-1">KSI Compliance</div>
					<div class="text-4xl font-bold {getComplianceColor(compliance.compliance_rate)}">
						{compliance.compliance_rate?.toFixed(1)}%
					</div>
					<div class="text-sm text-gray-500 mt-1">
						{compliance.compliant_ksis} / {compliance.total_ksis} KSIs
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Tabs -->
	<div class="bg-white rounded-lg shadow mb-6">
		<div class="border-b">
			<nav class="flex -mb-px">
				<button
					onclick={() => (activeTab = 'overview')}
					class="px-6 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'overview'
						? 'border-primary-600 text-primary-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					<i class="fa-solid fa-info-circle mr-2"></i>
					Overview
				</button>
				<button
					onclick={() => (activeTab = 'compliance')}
					class="px-6 py-3 text-sm font-medium border-b-2 transition-colors {activeTab ===
					'compliance'
						? 'border-primary-600 text-primary-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					<i class="fa-solid fa-chart-pie mr-2"></i>
					KSI Compliance
				</button>
				<button
					onclick={() => (activeTab = 'history')}
					class="px-6 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'history'
						? 'border-primary-600 text-primary-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					<i class="fa-solid fa-history mr-2"></i>
					OAR History
				</button>
				<button
					onclick={() => (activeTab = 'oscal')}
					class="px-6 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'oscal'
						? 'border-primary-600 text-primary-600'
						: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					<i class="fa-solid fa-code mr-2"></i>
					OSCAL Export
				</button>
			</nav>
		</div>

		<div class="p-6">
			<!-- Overview Tab -->
			{#if activeTab === 'overview'}
				<div class="grid grid-cols-2 gap-8">
					<div>
						<h3 class="text-lg font-medium text-gray-900 mb-4">Authorization Details</h3>
						<dl class="space-y-4">
							<div class="flex justify-between py-2 border-b">
								<dt class="text-gray-500">Authorization Date</dt>
								<dd class="font-medium">{formatDate(cso.authorization_date)}</dd>
							</div>
							<div class="flex justify-between py-2 border-b">
								<dt class="text-gray-500">Expiration Date</dt>
								<dd class="font-medium">{formatDate(cso.expiration_date)}</dd>
							</div>
							{#if cso.agency_sponsor}
								<div class="flex justify-between py-2 border-b">
									<dt class="text-gray-500">Agency Sponsor</dt>
									<dd class="font-medium">{cso.agency_sponsor}</dd>
								</div>
							{/if}
							<div class="flex justify-between py-2 border-b">
								<dt class="text-gray-500">Impact Level</dt>
								<dd class="font-medium">{cso.impact_level || 'Not specified'}</dd>
							</div>
							<div class="flex justify-between py-2 border-b">
								<dt class="text-gray-500">Service Model</dt>
								<dd class="font-medium">{cso.service_model || 'Not specified'}</dd>
							</div>
							<div class="flex justify-between py-2 border-b">
								<dt class="text-gray-500">Deployment Model</dt>
								<dd class="font-medium">{cso.deployment_model || 'Not specified'}</dd>
							</div>
						</dl>
					</div>

					<div>
						<h3 class="text-lg font-medium text-gray-900 mb-4">Service Information</h3>

						{#if cso.authorization_boundary}
							<div class="mb-4">
								<h4 class="text-sm font-medium text-gray-700 mb-2">Authorization Boundary</h4>
								<p class="text-gray-600 text-sm">{cso.authorization_boundary}</p>
							</div>
						{/if}

						{#if cso.data_types && cso.data_types.length > 0}
							<div>
								<h4 class="text-sm font-medium text-gray-700 mb-2">Data Types Processed</h4>
								<div class="flex flex-wrap gap-2">
									{#each cso.data_types as dataType}
										<span class="px-2 py-1 text-xs bg-gray-100 rounded">{dataType}</span>
									{/each}
								</div>
							</div>
						{/if}

						{#if cso.published_at}
							<div class="mt-4 text-sm text-gray-500">
								<i class="fa-solid fa-globe mr-1"></i>
								Published to Trust Center: {formatDate(cso.published_at)}
							</div>
						{/if}
					</div>
				</div>

			<!-- Compliance Tab -->
			{:else if activeTab === 'compliance'}
				{#if compliance}
					<!-- Compliance Summary -->
					<div class="grid grid-cols-4 gap-4 mb-6">
						<div class="bg-gray-50 rounded-lg p-4">
							<div class="text-sm text-gray-500">Total KSIs</div>
							<div class="text-2xl font-bold text-gray-900">{compliance.total_ksis}</div>
						</div>
						<div class="bg-green-50 rounded-lg p-4">
							<div class="text-sm text-green-600">Compliant</div>
							<div class="text-2xl font-bold text-green-700">{compliance.compliant_ksis}</div>
						</div>
						<div class="bg-red-50 rounded-lg p-4">
							<div class="text-sm text-red-600">Non-Compliant</div>
							<div class="text-2xl font-bold text-red-700">{compliance.non_compliant_ksis}</div>
						</div>
						<div class="bg-blue-50 rounded-lg p-4">
							<div class="text-sm text-blue-600">Compliance Rate</div>
							<div class="text-2xl font-bold {getComplianceColor(compliance.compliance_rate)}">
								{compliance.compliance_rate?.toFixed(1)}%
							</div>
						</div>
					</div>

					<!-- By Category -->
					{#if compliance.ksi_by_category && Object.keys(compliance.ksi_by_category).length > 0}
						<h3 class="text-lg font-medium text-gray-900 mb-4">Compliance by KSI Category</h3>
						<div class="space-y-4">
							{#each Object.entries(compliance.ksi_by_category) as [categoryId, category]}
								<div class="border rounded-lg p-4">
									<div class="flex items-center justify-between mb-2">
										<span class="font-medium text-gray-900">{category.category_name}</span>
										<span class="{getComplianceColor(category.rate)} font-medium">
											{category.compliant} / {category.total} ({category.rate.toFixed(1)}%)
										</span>
									</div>
									<div class="w-full h-3 bg-gray-200 rounded-full">
										<div
											class="h-3 rounded-full transition-all duration-300 {getComplianceBgColor(
												category.rate
											)}"
											style="width: {Math.min(100, category.rate)}%"
										></div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					{#if compliance.last_validation_date}
						<div class="mt-6 text-sm text-gray-500">
							<i class="fa-solid fa-clock mr-1"></i>
							Last validation: {formatDate(compliance.last_validation_date)}
						</div>
					{/if}
				{:else}
					<div class="text-center py-8 text-gray-500">
						<i class="fa-solid fa-chart-pie text-4xl mb-4 opacity-50"></i>
						<p>No compliance data available</p>
					</div>
				{/if}

			<!-- History Tab -->
			{:else if activeTab === 'history'}
				{#if oarHistory.length > 0}
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead>
								<tr class="border-b bg-gray-50">
									<th class="text-left py-3 px-4 text-sm font-medium text-gray-700">Period</th>
									<th class="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
									<th class="text-right py-3 px-4 text-sm font-medium text-gray-700">KSI Compliance</th>
									<th class="text-right py-3 px-4 text-sm font-medium text-gray-700">Vulnerabilities</th>
									<th class="text-right py-3 px-4 text-sm font-medium text-gray-700">Incidents</th>
									<th class="text-left py-3 px-4 text-sm font-medium text-gray-700">Generated</th>
								</tr>
							</thead>
							<tbody>
								{#each oarHistory as oar}
									<tr class="border-b hover:bg-gray-50">
										<td class="py-3 px-4">
											<span class="font-medium">Q{oar.quarter} {oar.year}</span>
										</td>
										<td class="py-3 px-4">
											<span
												class="px-2 py-1 text-xs rounded-full {oar.status === 'submitted'
													? 'bg-green-100 text-green-800'
													: oar.status === 'generated'
														? 'bg-blue-100 text-blue-800'
														: 'bg-gray-100 text-gray-800'}"
											>
												{oar.status}
											</span>
										</td>
										<td class="py-3 px-4 text-right">
											<span class="{getComplianceColor(oar.ksi_compliance_rate)} font-medium">
												{oar.ksi_compliance_rate?.toFixed(1)}%
											</span>
										</td>
										<td class="py-3 px-4 text-right">
											<span class="{oar.vulnerability_count > 0 ? 'text-red-600' : 'text-green-600'}">
												{oar.vulnerability_count}
											</span>
										</td>
										<td class="py-3 px-4 text-right">
											<span class="{oar.incident_count > 0 ? 'text-yellow-600' : 'text-green-600'}">
												{oar.incident_count}
											</span>
										</td>
										<td class="py-3 px-4 text-gray-500 text-sm">
											{formatDate(oar.generated_at)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="text-center py-8 text-gray-500">
						<i class="fa-solid fa-history text-4xl mb-4 opacity-50"></i>
						<p>No OAR history available</p>
					</div>
				{/if}

			<!-- OSCAL Tab -->
			{:else if activeTab === 'oscal'}
				{#if oscalLoading}
					<div class="flex items-center justify-center py-12">
						<i class="fa-solid fa-spinner fa-spin text-2xl text-primary-600"></i>
					</div>
				{:else if oscalData}
					<div class="mb-4 flex items-center justify-between">
						<div>
							<h3 class="text-lg font-medium text-gray-900">OSCAL SSP Excerpt</h3>
							<p class="text-sm text-gray-500">
								Machine-readable System Security Plan in OSCAL format
							</p>
						</div>
						<button
							onclick={downloadOSCAL}
							class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
						>
							<i class="fa-solid fa-download mr-2"></i>
							Download JSON
						</button>
					</div>
					<div class="bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
						<pre class="text-green-400 text-sm"><code>{JSON.stringify(oscalData, null, 2)}</code></pre>
					</div>
				{:else}
					<div class="text-center py-8 text-gray-500">
						<i class="fa-solid fa-code text-4xl mb-4 opacity-50"></i>
						<p>No OSCAL data available</p>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
