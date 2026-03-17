<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND_NAME, BRAND_TAGLINE } from '$lib/brand';
	import { BASE_API_URL } from '$lib/utils/constants';

	interface CSO {
		id: string;
		name: string;
		description: string;
		impact_level: string;
		authorization_status: string;
		authorization_date: string | null;
		expiration_date: string | null;
		ksi_compliance_rate: number;
		last_oar_date: string | null;
		service_model: string;
	}

	interface TrustCenterSummary {
		total_published_csos: number;
		authorized_csos: number;
		in_process_csos: number;
		average_compliance_rate: number;
		last_updated: string;
	}

	let summary = $state<TrustCenterSummary | null>(null);
	let csos = $state<CSO[]>([]);
	let loading = $state(true);
	let error = $state('');
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let impactFilter = $state('all');

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		error = '';

		try {
			const [summaryRes, csosRes] = await Promise.all([
				fetch(`${BASE_API_URL}/rmf/trust-center/`),
				fetch(`${BASE_API_URL}/rmf/trust-center/csos/`)
			]);

			if (summaryRes.ok) {
				summary = (await summaryRes.json()).data;
			}

			if (csosRes.ok) {
				const data = await csosRes.json();
				csos = data.data?.csos || data.results || [];
			}
		} catch (e: any) {
			error = 'Failed to load trust center data. Please try again later.';
			console.error('Trust center load error:', e);
		} finally {
			loading = false;
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

	function getComplianceBarClass(rate: number): string {
		if (rate >= 90) return 'bg-emerald-500';
		if (rate >= 70) return 'bg-[var(--rv-blue)]';
		return 'bg-amber-500';
	}

	const filteredCsos = $derived(
		csos.filter((cso) => {
			const matchesSearch =
				searchQuery === '' ||
				cso.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				cso.description?.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesStatus =
				statusFilter === 'all' || cso.authorization_status?.toLowerCase() === statusFilter;

			const matchesImpact =
				impactFilter === 'all' || cso.impact_level?.toLowerCase() === impactFilter;

			return matchesSearch && matchesStatus && matchesImpact;
		})
	);
</script>

<svelte:head>
	<title>Regovise Trust Center - FedRAMP Authorization Status</title>
</svelte:head>

<section class="space-y-8">
	<div class="brand-card-dark overflow-hidden px-6 py-8 sm:px-8 lg:px-10">
		<div class="grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
			<div class="space-y-4">
				<span
					class="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[0.72rem] font-semibold tracking-[0.2em] text-white/72 uppercase"
				>
					<i class="fa-solid fa-shield-check text-[var(--rv-teal)]"></i>
					{BRAND_NAME} Trust Center
				</span>
				<div class="space-y-3">
					<h2 class="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
						Enterprise authorization transparency with a governance-first lens.
					</h2>
					<p class="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
						{BRAND_TAGLINE} Review published cloud service offerings, FedRAMP posture, and operational
						assurance signals in one branded trust experience.
					</p>
				</div>
				<div class="flex flex-wrap gap-3 text-xs text-slate-200">
					<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2">
						<i class="fa-solid fa-building-shield mr-2 text-[var(--rv-teal)]"></i>
						Governance-ready disclosures
					</span>
					<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2">
						<i class="fa-solid fa-file-shield mr-2 text-[var(--rv-blue)]"></i>
						FedRAMP-aligned evidence view
					</span>
					<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2">
						<i class="fa-solid fa-wave-square mr-2 text-[var(--rv-teal)]"></i>
						Operational confidence signals
					</span>
				</div>
			</div>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
				<div class="rounded-[24px] border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
					<div class="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
						Published offerings
					</div>
					<div class="mt-2 text-4xl font-semibold text-white">
						{summary?.total_published_csos ?? csos.length}
					</div>
					<p class="mt-2 text-sm text-slate-300">
						Public authorization records currently visible through the Regovise trust layer.
					</p>
				</div>
				<div
					class="rounded-[24px] border border-[rgb(20_200_181_/_0.18)] bg-[rgb(20_200_181_/_0.08)] p-5"
				>
					<div class="text-xs font-semibold tracking-[0.18em] text-[var(--rv-teal)] uppercase">
						Average KSI posture
					</div>
					<div class="mt-2 text-4xl font-semibold text-white">
						{summary?.average_compliance_rate?.toFixed(1) ?? '0.0'}%
					</div>
					<p class="mt-2 text-sm text-slate-200">
						Average Key Security Indicator performance across published offerings.
					</p>
				</div>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="brand-card px-6 py-20 text-center">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[rgb(88_181_255_/_0.12)] text-[var(--rv-blue)]"
			>
				<i class="fa-solid fa-spinner fa-spin text-3xl"></i>
			</div>
			<p class="mt-4 text-sm text-slate-500">Loading trust center records...</p>
		</div>
	{:else if error}
		<div class="brand-card border-rose-200 px-6 py-10 text-center">
			<div
				class="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-rose-100 text-rose-600"
			>
				<i class="fa-solid fa-circle-exclamation text-3xl"></i>
			</div>
			<h2 class="mt-4 text-xl font-semibold text-slate-950">Unable to load the trust center</h2>
			<p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{error}</p>
			<button onclick={loadData} class="btn btn-mini-primary mt-6 px-5 py-2.5"> Retry </button>
		</div>
	{:else}
		{#if summary}
			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div class="brand-card p-5">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
								Published CSOs
							</p>
							<p class="mt-2 text-3xl font-semibold text-slate-950">
								{summary.total_published_csos}
							</p>
						</div>
						<div class="brand-icon-badge h-12 w-12 rounded-[18px] text-lg">
							<i class="fa-solid fa-cloud"></i>
						</div>
					</div>
				</div>
				<div class="brand-card p-5">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
								Authorized
							</p>
							<p class="mt-2 text-3xl font-semibold text-slate-950">{summary.authorized_csos}</p>
						</div>
						<div
							class="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-100 text-lg text-emerald-600"
						>
							<i class="fa-solid fa-check-circle"></i>
						</div>
					</div>
				</div>
				<div class="brand-card p-5">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
								In process
							</p>
							<p class="mt-2 text-3xl font-semibold text-slate-950">{summary.in_process_csos}</p>
						</div>
						<div
							class="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[rgb(88_181_255_/_0.14)] text-lg text-[var(--rv-blue)]"
						>
							<i class="fa-solid fa-clock"></i>
						</div>
					</div>
				</div>
				<div class="brand-card p-5">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
								Avg. compliance
							</p>
							<p
								class="mt-2 text-3xl font-semibold {getComplianceColor(
									summary.average_compliance_rate
								)}"
							>
								{summary.average_compliance_rate?.toFixed(1)}%
							</p>
						</div>
						<div
							class="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[rgb(20_200_181_/_0.12)] text-lg text-[var(--rv-teal)]"
						>
							<i class="fa-solid fa-chart-line"></i>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<div class="brand-card p-5 sm:p-6">
			<div class="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
				<label class="relative block">
					<span class="sr-only">Search cloud service offerings</span>
					<i
						class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
					></i>
					<input
						type="text"
						placeholder="Search cloud service offerings..."
						class="input w-full rounded-[18px] border border-slate-200 py-3 pl-11 pr-4 text-sm"
						bind:value={searchQuery}
					/>
				</label>

				<select
					class="select rounded-[18px] border border-slate-200 px-4 py-3 text-sm"
					bind:value={statusFilter}
				>
					<option value="all">All statuses</option>
					<option value="authorized">Authorized</option>
					<option value="in_process">In process</option>
					<option value="ready">Ready</option>
				</select>

				<select
					class="select rounded-[18px] border border-slate-200 px-4 py-3 text-sm"
					bind:value={impactFilter}
				>
					<option value="all">All impact levels</option>
					<option value="high">High</option>
					<option value="moderate">Moderate</option>
					<option value="low">Low</option>
				</select>
			</div>
		</div>

		{#if filteredCsos.length === 0}
			<div class="brand-card px-6 py-14 text-center">
				<div
					class="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-100 text-slate-400"
				>
					<i class="fa-solid fa-cloud-slash text-3xl"></i>
				</div>
				<h2 class="mt-4 text-xl font-semibold text-slate-950">No matching offerings</h2>
				<p class="mt-2 text-sm text-slate-500">
					No cloud service offerings match the filters you selected.
				</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each filteredCsos as cso}
					<a
						href="/trust-center/{cso.id}"
						class="brand-card block overflow-hidden p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgb(11_31_42_/_0.12)]"
					>
						<div class="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
							<div class="space-y-4">
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="text-xl font-semibold text-slate-950">{cso.name}</h3>
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
									{#if cso.service_model}
										<span
											class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
										>
											{cso.service_model}
										</span>
									{/if}
								</div>

								{#if cso.description}
									<p class="max-w-3xl text-sm leading-6 text-slate-600">{cso.description}</p>
								{/if}

								<div class="flex flex-wrap gap-4 text-sm text-slate-500">
									{#if cso.authorization_date}
										<div class="inline-flex items-center gap-2">
											<i class="fa-solid fa-calendar-check text-emerald-500"></i>
											<span>Authorized {formatDate(cso.authorization_date)}</span>
										</div>
									{/if}

									{#if cso.expiration_date}
										<div class="inline-flex items-center gap-2">
											<i class="fa-solid fa-calendar-xmark text-amber-500"></i>
											<span>Expires {formatDate(cso.expiration_date)}</span>
										</div>
									{/if}

									{#if cso.last_oar_date}
										<div class="inline-flex items-center gap-2">
											<i class="fa-solid fa-file-lines text-[var(--rv-blue)]"></i>
											<span>Last OAR {formatDate(cso.last_oar_date)}</span>
										</div>
									{/if}
								</div>
							</div>

							<div class="min-w-[220px] rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
								<div class="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
									KSI compliance
								</div>
								<div
									class="mt-2 text-3xl font-semibold {getComplianceColor(cso.ksi_compliance_rate)}"
								>
									{cso.ksi_compliance_rate?.toFixed(1) || 0}%
								</div>
								<div class="mt-3 h-2.5 w-full rounded-full bg-white">
									<div
										class={`h-2.5 rounded-full transition-all duration-300 ${getComplianceBarClass(cso.ksi_compliance_rate)}`}
										style={`width: ${Math.min(100, cso.ksi_compliance_rate || 0)}%`}
									></div>
								</div>
								<div class="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-500">
									<i class="fa-solid fa-arrow-right text-[var(--rv-blue)]"></i>
									View authorization detail
								</div>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		{#if summary?.last_updated}
			<div class="flex justify-center">
				<span class="brand-chip">
					<i class="fa-solid fa-clock text-[var(--rv-blue)]"></i>
					Last updated {formatDate(summary.last_updated)}
				</span>
			</div>
		{/if}
	{/if}
</section>
