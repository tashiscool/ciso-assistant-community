<script lang="ts">
	import { page } from '$app/stores';
	import { BRAND_NAME } from '$lib/brand';
	import { BASE_API_URL } from '$lib/utils/constants';
	import { onMount } from 'svelte';

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
				cso = (await csoRes.json()).data;
			} else {
				throw new Error('CSO not found');
			}

			if (complianceRes.ok) {
				compliance = (await complianceRes.json()).data;
			}

			if (historyRes.ok) {
				const data = await historyRes.json();
				oarHistory = data.data?.oar_history || data.results || [];
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
				oscalData = (await response.json()).data;
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
				return 'bg-[rgb(20_200_181_/_0.14)] text-[var(--rv-midnight)] border-[rgb(20_200_181_/_0.2)]';
			case 'in_process':
			case 'in process':
				return 'bg-[rgb(88_181_255_/_0.14)] text-[var(--rv-midnight)] border-[rgb(88_181_255_/_0.2)]';
			case 'ready':
				return 'bg-amber-100 text-amber-900 border-amber-200';
			case 'revoked':
				return 'bg-rose-100 text-rose-900 border-rose-200';
			default:
				return 'bg-slate-100 text-slate-700 border-slate-200';
		}
	}

	function getImpactBadgeClass(impact: string): string {
		switch (impact?.toLowerCase()) {
			case 'high':
				return 'bg-rose-100 text-rose-900 border-rose-200';
			case 'moderate':
				return 'bg-amber-100 text-amber-900 border-amber-200';
			case 'low':
				return 'bg-emerald-100 text-emerald-900 border-emerald-200';
			default:
				return 'bg-slate-100 text-slate-700 border-slate-200';
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
		if (rate >= 90) return 'text-emerald-600';
		if (rate >= 70) return 'text-[var(--rv-blue)]';
		return 'text-amber-700';
	}

	function getComplianceBgColor(rate: number): string {
		if (rate >= 90) return 'bg-emerald-500';
		if (rate >= 70) return 'bg-[var(--rv-blue)]';
		return 'bg-amber-500';
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
	<title>{cso?.name || 'CSO Detail'} - Regovise Trust Center</title>
</svelte:head>

<section class="space-y-6">
	<div>
		<a href="/trust-center" class="brand-chip !bg-white inline-flex">
			<i class="fa-solid fa-arrow-left text-[var(--rv-blue)]"></i>
			Back to Trust Center
		</a>
	</div>

	{#if loading}
		<div class="brand-card px-6 py-20 text-center">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[rgb(88_181_255_/_0.12)] text-[var(--rv-blue)]"
			>
				<i class="fa-solid fa-spinner fa-spin text-3xl"></i>
			</div>
			<p class="mt-4 text-sm text-slate-500">Loading authorization detail...</p>
		</div>
	{:else if error}
		<div class="brand-card border-rose-200 px-6 py-12 text-center">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-rose-100 text-rose-600"
			>
				<i class="fa-solid fa-circle-exclamation text-3xl"></i>
			</div>
			<h2 class="mt-4 text-xl font-semibold text-slate-950">Unable to load this offering</h2>
			<p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{error}</p>
			<a href="/trust-center" class="btn btn-mini-secondary mt-6 px-5 py-2.5"
				>Return to Trust Center</a
			>
		</div>
	{:else if cso}
		<div class="brand-card-dark overflow-hidden px-6 py-8 sm:px-8">
			<div class="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
				<div class="space-y-4">
					<p class="text-xs font-semibold tracking-[0.2em] text-white/60 uppercase">
						{BRAND_NAME} authorization record
					</p>
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-3xl font-semibold tracking-tight text-white">{cso.name}</h1>
						<span
							class={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusBadgeClass(cso.authorization_status)}`}
						>
							{cso.authorization_status?.replace('_', ' ') || 'Unknown'}
						</span>
						<span
							class={`rounded-full border px-3 py-1 text-xs font-semibold ${getImpactBadgeClass(cso.impact_level)}`}
						>
							{cso.impact_level || 'Unknown'} impact
						</span>
					</div>
					{#if cso.description}
						<p class="max-w-3xl text-sm leading-6 text-slate-300">{cso.description}</p>
					{/if}
					<div class="flex flex-wrap gap-3 text-xs text-slate-200">
						{#if cso.service_model}
							<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2"
								>{cso.service_model}</span
							>
						{/if}
						{#if cso.deployment_model}
							<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2"
								>{cso.deployment_model}</span
							>
						{/if}
						{#if cso.agency_sponsor}
							<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2">
								Sponsored by {cso.agency_sponsor}
							</span>
						{/if}
					</div>
				</div>

				{#if compliance}
					<div class="rounded-[28px] border border-white/12 bg-white/8 p-6 backdrop-blur-sm">
						<div class="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
							KSI compliance
						</div>
						<div class="mt-3 text-5xl font-semibold text-white">
							{compliance.compliance_rate?.toFixed(1)}%
						</div>
						<div class="mt-2 text-sm text-slate-300">
							{compliance.compliant_ksis} of {compliance.total_ksis} KSIs currently compliant
						</div>
						<div class="mt-5 h-2.5 w-full rounded-full bg-white/12">
							<div
								class={`h-2.5 rounded-full ${getComplianceBgColor(compliance.compliance_rate)}`}
								style={`width: ${Math.min(100, compliance.compliance_rate)}%`}
							></div>
						</div>
						<div class="mt-4 grid gap-3 sm:grid-cols-2">
							<div class="rounded-[20px] border border-white/10 bg-white/6 p-4">
								<div class="text-xs uppercase tracking-[0.14em] text-white/55">Authorized</div>
								<div class="mt-2 text-lg font-semibold text-white">
									{formatDate(cso.authorization_date)}
								</div>
							</div>
							<div class="rounded-[20px] border border-white/10 bg-white/6 p-4">
								<div class="text-xs uppercase tracking-[0.14em] text-white/55">Expires</div>
								<div class="mt-2 text-lg font-semibold text-white">
									{formatDate(cso.expiration_date)}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="brand-card overflow-hidden">
			<div class="border-b border-slate-200 px-3 py-2 sm:px-4">
				<nav class="flex flex-wrap gap-2">
					<button
						onclick={() => (activeTab = 'overview')}
						class={`rounded-full px-4 py-2 text-sm font-semibold transition ${
							activeTab === 'overview'
								? 'bg-[var(--rv-midnight)] text-white shadow-[var(--rv-shadow-glow)]'
								: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
						}`}
					>
						<i class="fa-solid fa-circle-info mr-2"></i>
						Overview
					</button>
					<button
						onclick={() => (activeTab = 'compliance')}
						class={`rounded-full px-4 py-2 text-sm font-semibold transition ${
							activeTab === 'compliance'
								? 'bg-[var(--rv-midnight)] text-white shadow-[var(--rv-shadow-glow)]'
								: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
						}`}
					>
						<i class="fa-solid fa-chart-pie mr-2"></i>
						KSI Compliance
					</button>
					<button
						onclick={() => (activeTab = 'history')}
						class={`rounded-full px-4 py-2 text-sm font-semibold transition ${
							activeTab === 'history'
								? 'bg-[var(--rv-midnight)] text-white shadow-[var(--rv-shadow-glow)]'
								: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
						}`}
					>
						<i class="fa-solid fa-clock-rotate-left mr-2"></i>
						OAR History
					</button>
					<button
						onclick={() => (activeTab = 'oscal')}
						class={`rounded-full px-4 py-2 text-sm font-semibold transition ${
							activeTab === 'oscal'
								? 'bg-[var(--rv-midnight)] text-white shadow-[var(--rv-shadow-glow)]'
								: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
						}`}
					>
						<i class="fa-solid fa-code mr-2"></i>
						OSCAL Export
					</button>
				</nav>
			</div>

			<div class="p-6 sm:p-8">
				{#if activeTab === 'overview'}
					<div class="grid gap-6 lg:grid-cols-2">
						<div class="rounded-[24px] border border-slate-200 bg-white p-6">
							<h2 class="text-lg font-semibold text-slate-950">Authorization details</h2>
							<dl class="mt-5 space-y-4">
								<div class="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
									<dt class="text-sm text-slate-500">Authorization date</dt>
									<dd class="text-sm font-semibold text-slate-950">
										{formatDate(cso.authorization_date)}
									</dd>
								</div>
								<div class="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
									<dt class="text-sm text-slate-500">Expiration date</dt>
									<dd class="text-sm font-semibold text-slate-950">
										{formatDate(cso.expiration_date)}
									</dd>
								</div>
								{#if cso.agency_sponsor}
									<div
										class="flex items-center justify-between gap-4 border-b border-slate-100 pb-3"
									>
										<dt class="text-sm text-slate-500">Agency sponsor</dt>
										<dd class="text-sm font-semibold text-slate-950">{cso.agency_sponsor}</dd>
									</div>
								{/if}
								<div class="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
									<dt class="text-sm text-slate-500">Impact level</dt>
									<dd class="text-sm font-semibold text-slate-950">
										{cso.impact_level || 'Not specified'}
									</dd>
								</div>
								<div class="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
									<dt class="text-sm text-slate-500">Service model</dt>
									<dd class="text-sm font-semibold text-slate-950">
										{cso.service_model || 'Not specified'}
									</dd>
								</div>
								<div class="flex items-center justify-between gap-4">
									<dt class="text-sm text-slate-500">Deployment model</dt>
									<dd class="text-sm font-semibold text-slate-950">
										{cso.deployment_model || 'Not specified'}
									</dd>
								</div>
							</dl>
						</div>

						<div class="rounded-[24px] border border-slate-200 bg-slate-50/70 p-6">
							<h2 class="text-lg font-semibold text-slate-950">Service information</h2>
							{#if cso.authorization_boundary}
								<div class="mt-5">
									<h3 class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
										Authorization boundary
									</h3>
									<p class="mt-2 text-sm leading-6 text-slate-600">{cso.authorization_boundary}</p>
								</div>
							{/if}

							{#if cso.data_types && cso.data_types.length > 0}
								<div class="mt-6">
									<h3 class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
										Data types processed
									</h3>
									<div class="mt-3 flex flex-wrap gap-2">
										{#each cso.data_types as dataType}
											<span
												class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
											>
												{dataType}
											</span>
										{/each}
									</div>
								</div>
							{/if}

							{#if cso.published_at}
								<div
									class="mt-6 inline-flex items-center gap-2 rounded-full border border-[rgb(88_181_255_/_0.16)] bg-white px-4 py-2 text-sm text-slate-500"
								>
									<i class="fa-solid fa-globe text-[var(--rv-blue)]"></i>
									Published {formatDate(cso.published_at)}
								</div>
							{/if}
						</div>
					</div>
				{:else if activeTab === 'compliance'}
					{#if compliance}
						<div class="space-y-6">
							<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
								<div class="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
									<div class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
										Total KSIs
									</div>
									<div class="mt-2 text-3xl font-semibold text-slate-950">
										{compliance.total_ksis}
									</div>
								</div>
								<div class="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
									<div class="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase">
										Compliant
									</div>
									<div class="mt-2 text-3xl font-semibold text-emerald-700">
										{compliance.compliant_ksis}
									</div>
								</div>
								<div class="rounded-[24px] border border-rose-200 bg-rose-50 p-5">
									<div class="text-xs font-semibold tracking-[0.16em] text-rose-700 uppercase">
										Non-compliant
									</div>
									<div class="mt-2 text-3xl font-semibold text-rose-700">
										{compliance.non_compliant_ksis}
									</div>
								</div>
								<div
									class="rounded-[24px] border border-[rgb(88_181_255_/_0.18)] bg-[rgb(88_181_255_/_0.08)] p-5"
								>
									<div
										class="text-xs font-semibold tracking-[0.16em] text-[var(--rv-blue)] uppercase"
									>
										Compliance rate
									</div>
									<div
										class="mt-2 text-3xl font-semibold {getComplianceColor(
											compliance.compliance_rate
										)}"
									>
										{compliance.compliance_rate?.toFixed(1)}%
									</div>
								</div>
							</div>

							{#if compliance.ksi_by_category && Object.keys(compliance.ksi_by_category).length > 0}
								<div class="space-y-4">
									<h2 class="text-lg font-semibold text-slate-950">Compliance by KSI category</h2>
									{#each Object.entries(compliance.ksi_by_category) as [categoryId, category]}
										<div class="rounded-[24px] border border-slate-200 bg-white p-5">
											<div
												class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
											>
												<span class="text-sm font-semibold text-slate-950"
													>{category.category_name}</span
												>
												<span class="text-sm font-semibold {getComplianceColor(category.rate)}">
													{category.compliant} / {category.total} ({category.rate.toFixed(1)}%)
												</span>
											</div>
											<div class="h-3 w-full rounded-full bg-slate-100">
												<div
													class={`h-3 rounded-full transition-all duration-300 ${getComplianceBgColor(category.rate)}`}
													style={`width: ${Math.min(100, category.rate)}%`}
												></div>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							{#if compliance.last_validation_date}
								<div
									class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500"
								>
									<i class="fa-solid fa-clock text-[var(--rv-blue)]"></i>
									Last validation {formatDate(compliance.last_validation_date)}
								</div>
							{/if}
						</div>
					{:else}
						<div class="py-8 text-center text-slate-500">
							<i class="fa-solid fa-chart-pie mb-4 text-4xl opacity-40"></i>
							<p>No compliance data available</p>
						</div>
					{/if}
				{:else if activeTab === 'history'}
					{#if oarHistory.length > 0}
						<div class="overflow-hidden rounded-[24px] border border-slate-200">
							<div class="overflow-x-auto">
								<table class="w-full min-w-[720px] bg-white">
									<thead>
										<tr class="bg-slate-50 text-left">
											<th
												class="px-4 py-3 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
												>Period</th
											>
											<th
												class="px-4 py-3 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
												>Status</th
											>
											<th
												class="px-4 py-3 text-right text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
												>KSI compliance</th
											>
											<th
												class="px-4 py-3 text-right text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
												>Vulnerabilities</th
											>
											<th
												class="px-4 py-3 text-right text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
												>Incidents</th
											>
											<th
												class="px-4 py-3 text-left text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase"
												>Generated</th
											>
										</tr>
									</thead>
									<tbody>
										{#each oarHistory as oar}
											<tr class="border-t border-slate-100 hover:bg-slate-50/70">
												<td class="px-4 py-3 text-sm font-semibold text-slate-950"
													>Q{oar.quarter} {oar.year}</td
												>
												<td class="px-4 py-3">
													<span
														class={`rounded-full px-3 py-1 text-xs font-semibold ${
															oar.status === 'submitted'
																? 'bg-emerald-100 text-emerald-900'
																: oar.status === 'generated'
																	? 'bg-[rgb(88_181_255_/_0.14)] text-[var(--rv-midnight)]'
																	: 'bg-slate-100 text-slate-700'
														}`}
													>
														{oar.status}
													</span>
												</td>
												<td
													class="px-4 py-3 text-right text-sm font-semibold {getComplianceColor(
														oar.ksi_compliance_rate
													)}"
												>
													{oar.ksi_compliance_rate?.toFixed(1)}%
												</td>
												<td
													class={`px-4 py-3 text-right text-sm font-semibold ${oar.vulnerability_count > 0 ? 'text-rose-600' : 'text-emerald-600'}`}
												>
													{oar.vulnerability_count}
												</td>
												<td
													class={`px-4 py-3 text-right text-sm font-semibold ${oar.incident_count > 0 ? 'text-amber-700' : 'text-emerald-600'}`}
												>
													{oar.incident_count}
												</td>
												<td class="px-4 py-3 text-sm text-slate-500"
													>{formatDate(oar.generated_at)}</td
												>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{:else}
						<div class="py-8 text-center text-slate-500">
							<i class="fa-solid fa-clock-rotate-left mb-4 text-4xl opacity-40"></i>
							<p>No OAR history available</p>
						</div>
					{/if}
				{:else if activeTab === 'oscal'}
					{#if oscalLoading}
						<div class="py-12 text-center">
							<i class="fa-solid fa-spinner fa-spin text-3xl text-[var(--rv-blue)]"></i>
						</div>
					{:else if oscalData}
						<div class="space-y-4">
							<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 class="text-lg font-semibold text-slate-950">OSCAL SSP excerpt</h2>
									<p class="text-sm text-slate-500">
										Machine-readable System Security Plan for interoperability and evidence review.
									</p>
								</div>
								<button onclick={downloadOSCAL} class="btn btn-mini-primary px-4 py-2.5">
									<i class="fa-solid fa-download mr-2"></i>
									Download JSON
								</button>
							</div>
							<div
								class="overflow-auto rounded-[24px] bg-[var(--rv-midnight)] p-5 shadow-[var(--rv-shadow-glow)]"
							>
								<pre class="text-sm text-emerald-300"><code
										>{JSON.stringify(oscalData, null, 2)}</code
									></pre>
							</div>
						</div>
					{:else}
						<div class="py-8 text-center text-slate-500">
							<i class="fa-solid fa-code mb-4 text-4xl opacity-40"></i>
							<p>No OSCAL data available</p>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</section>
