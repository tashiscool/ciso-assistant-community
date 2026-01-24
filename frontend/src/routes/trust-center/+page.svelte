<script lang="ts">
	import { onMount } from 'svelte';
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
				summary = await summaryRes.json();
			}

			if (csosRes.ok) {
				const data = await csosRes.json();
				csos = data.results || data || [];
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
	<title>FedRAMP Trust Center - Authorization Status</title>
</svelte:head>

{#if loading}
	<div class="flex items-center justify-center py-20">
		<i class="fa-solid fa-spinner fa-spin text-4xl text-primary-600"></i>
	</div>
{:else if error}
	<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
		<i class="fa-solid fa-circle-exclamation text-3xl text-red-500 mb-4"></i>
		<p class="text-red-700">{error}</p>
		<button
			onclick={loadData}
			class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
		>
			Retry
		</button>
	</div>
{:else}
	<!-- Summary Cards -->
	{#if summary}
		<div class="grid grid-cols-4 gap-6 mb-8">
			<div class="bg-white rounded-lg shadow p-6">
				<div class="flex items-center">
					<div class="p-3 rounded-full bg-blue-100">
						<i class="fa-solid fa-cloud text-xl text-blue-600"></i>
					</div>
					<div class="ml-4">
						<p class="text-sm text-gray-500">Published CSOs</p>
						<p class="text-2xl font-bold text-gray-900">{summary.total_published_csos}</p>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow p-6">
				<div class="flex items-center">
					<div class="p-3 rounded-full bg-green-100">
						<i class="fa-solid fa-check-circle text-xl text-green-600"></i>
					</div>
					<div class="ml-4">
						<p class="text-sm text-gray-500">Authorized</p>
						<p class="text-2xl font-bold text-gray-900">{summary.authorized_csos}</p>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow p-6">
				<div class="flex items-center">
					<div class="p-3 rounded-full bg-yellow-100">
						<i class="fa-solid fa-clock text-xl text-yellow-600"></i>
					</div>
					<div class="ml-4">
						<p class="text-sm text-gray-500">In Process</p>
						<p class="text-2xl font-bold text-gray-900">{summary.in_process_csos}</p>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg shadow p-6">
				<div class="flex items-center">
					<div class="p-3 rounded-full bg-purple-100">
						<i class="fa-solid fa-chart-line text-xl text-purple-600"></i>
					</div>
					<div class="ml-4">
						<p class="text-sm text-gray-500">Avg. Compliance</p>
						<p class="text-2xl font-bold {getComplianceColor(summary.average_compliance_rate)}">
							{summary.average_compliance_rate?.toFixed(1)}%
						</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="bg-white rounded-lg shadow p-4 mb-6">
		<div class="flex items-center gap-4">
			<div class="flex-1">
				<div class="relative">
					<i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
					<input
						type="text"
						placeholder="Search cloud service offerings..."
						class="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
						bind:value={searchQuery}
					/>
				</div>
			</div>

			<div>
				<select
					class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
					bind:value={statusFilter}
				>
					<option value="all">All Statuses</option>
					<option value="authorized">Authorized</option>
					<option value="in_process">In Process</option>
					<option value="ready">Ready</option>
				</select>
			</div>

			<div>
				<select
					class="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
					bind:value={impactFilter}
				>
					<option value="all">All Impact Levels</option>
					<option value="high">High</option>
					<option value="moderate">Moderate</option>
					<option value="low">Low</option>
				</select>
			</div>
		</div>
	</div>

	<!-- CSO List -->
	{#if filteredCsos.length === 0}
		<div class="bg-white rounded-lg shadow p-12 text-center">
			<i class="fa-solid fa-cloud-slash text-6xl text-gray-300 mb-4"></i>
			<p class="text-gray-500">No cloud service offerings match your search criteria.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each filteredCsos as cso}
				<a
					href="/trust-center/{cso.id}"
					class="block bg-white rounded-lg shadow hover:shadow-md transition-shadow"
				>
					<div class="p-6">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-3 mb-2">
									<h3 class="text-lg font-semibold text-gray-900">{cso.name}</h3>
									<span
										class="px-2 py-1 text-xs font-medium rounded-full {getStatusBadgeClass(
											cso.authorization_status
										)}"
									>
										{cso.authorization_status?.replace('_', ' ') || 'Unknown'}
									</span>
									<span
										class="px-2 py-1 text-xs font-medium rounded-full {getImpactBadgeClass(
											cso.impact_level
										)}"
									>
										{cso.impact_level || 'Unknown'} Impact
									</span>
									{#if cso.service_model}
										<span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
											{cso.service_model}
										</span>
									{/if}
								</div>

								{#if cso.description}
									<p class="text-gray-600 text-sm mb-4 line-clamp-2">{cso.description}</p>
								{/if}

								<div class="flex items-center gap-6 text-sm text-gray-500">
									{#if cso.authorization_date}
										<div class="flex items-center gap-1">
											<i class="fa-solid fa-calendar-check text-green-500"></i>
											<span>Authorized: {formatDate(cso.authorization_date)}</span>
										</div>
									{/if}

									{#if cso.expiration_date}
										<div class="flex items-center gap-1">
											<i class="fa-solid fa-calendar-xmark text-red-500"></i>
											<span>Expires: {formatDate(cso.expiration_date)}</span>
										</div>
									{/if}

									{#if cso.last_oar_date}
										<div class="flex items-center gap-1">
											<i class="fa-solid fa-file-lines text-blue-500"></i>
											<span>Last OAR: {formatDate(cso.last_oar_date)}</span>
										</div>
									{/if}
								</div>
							</div>

							<div class="text-right ml-6">
								<div class="text-sm text-gray-500 mb-1">KSI Compliance</div>
								<div class="text-2xl font-bold {getComplianceColor(cso.ksi_compliance_rate)}">
									{cso.ksi_compliance_rate?.toFixed(1) || 0}%
								</div>
								<div class="w-32 h-2 bg-gray-200 rounded-full mt-2">
									<div
										class="h-2 rounded-full transition-all duration-300 {cso.ksi_compliance_rate >=
										90
											? 'bg-green-500'
											: cso.ksi_compliance_rate >= 70
												? 'bg-yellow-500'
												: 'bg-red-500'}"
										style="width: {Math.min(100, cso.ksi_compliance_rate || 0)}%"
									></div>
								</div>
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}

	<!-- Last Updated -->
	{#if summary?.last_updated}
		<div class="mt-8 text-center text-sm text-gray-500">
			<i class="fa-solid fa-clock mr-1"></i>
			Last updated: {formatDate(summary.last_updated)}
		</div>
	{/if}
{/if}
