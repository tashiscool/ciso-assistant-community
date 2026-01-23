<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import Breadcrumbs from '$lib/components/Breadcrumbs/Breadcrumbs.svelte';
	import type { PageData } from './$types';
	import { m } from '$paraglide/messages';

	export let data: PageData;

	let selectedProfileId: string = '';

	$: breadcrumbs = [
		{ label: m.continuousMonitoring?.() || 'Continuous Monitoring', href: `${base}/continuous-monitoring` }
	];

	// Helper functions for styling
	const getHealthColor = (score: number) => {
		if (score >= 90) return 'text-green-600 bg-green-100';
		if (score >= 70) return 'text-yellow-600 bg-yellow-100';
		return 'text-red-600 bg-red-100';
	};

	const getStatusColor = (status: string) => {
		const colors: Record<string, string> = {
			'good': 'bg-green-100 text-green-800',
			'warning': 'bg-yellow-100 text-yellow-800',
			'critical': 'bg-red-100 text-red-800',
			'unknown': 'bg-gray-100 text-gray-800'
		};
		return colors[status] || 'bg-gray-100 text-gray-800';
	};

	const getTrendIcon = (trend: string) => {
		switch (trend) {
			case 'up':
				return { icon: 'fa-arrow-up', class: 'text-green-600' };
			case 'down':
				return { icon: 'fa-arrow-down', class: 'text-red-600' };
			default:
				return { icon: 'fa-minus', class: 'text-gray-600' };
		}
	};

	const getActivityStatusIcon = (status: string) => {
		switch (status) {
			case 'on_track':
				return { icon: 'fa-check-circle', class: 'text-green-500' };
			case 'due_soon':
				return { icon: 'fa-clock', class: 'text-yellow-500' };
			case 'overdue':
				return { icon: 'fa-exclamation-circle', class: 'text-red-500' };
			case 'completed':
				return { icon: 'fa-check-double', class: 'text-blue-500' };
			default:
				return { icon: 'fa-question-circle', class: 'text-gray-500' };
		}
	};

	const formatDate = (dateString: string) => {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString();
	};

	// Handle profile selection
	async function handleProfileChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		selectedProfileId = select.value;
		// Reload data with selected profile (client-side navigation)
		if (selectedProfileId) {
			await goto(`${base}/continuous-monitoring?profile=${selectedProfileId}`, { replaceState: true });
		} else {
			await goto(`${base}/continuous-monitoring`, { replaceState: true });
		}
	}
</script>

<svelte:head>
	<title>{m.continuousMonitoring?.() || 'Continuous Monitoring'}</title>
</svelte:head>

<Breadcrumbs items={breadcrumbs} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-8 flex justify-between items-start">
		<div>
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white">
				{m.conmonDashboard?.() || 'Continuous Monitoring Dashboard'}
			</h1>
			<p class="mt-2 text-lg text-gray-600 dark:text-gray-400">
				{m.conmonDashboardDescription?.() || 'Track and manage continuous monitoring activities across all profiles'}
			</p>
		</div>
		<div class="flex gap-4">
			<!-- Profile Selector -->
			<select
				bind:value={selectedProfileId}
				on:change={handleProfileChange}
				class="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			>
				<option value="">{m.allProfiles?.() || 'All Profiles'}</option>
				{#each data.profiles as profile}
					<option value={profile.id}>{profile.name}</option>
				{/each}
			</select>
			<!-- Quick Actions -->
			<a
				href="{base}/conmon-profiles"
				class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
			>
				<i class="fa-solid fa-sliders mr-2"></i>
				{m.manageProfiles?.() || 'Manage Profiles'}
			</a>
		</div>
	</div>

	<!-- Health Score - Hero Section -->
	<div class="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg shadow-lg mb-8">
		<div class="px-6 py-8 sm:px-8">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-2xl font-bold text-white">{m.conmonHealth?.() || 'ConMon Health Score'}</h2>
					<p class="mt-1 text-teal-100">{m.conmonHealthDescription?.() || 'Overall continuous monitoring compliance posture'}</p>
				</div>
				<div class="text-right">
					<div class="text-6xl font-bold text-white">
						{data.dashboard?.overall_health?.score ?? 0}
					</div>
					<div class="text-teal-100 text-sm">{m.outOf100?.() || 'out of 100'}</div>
				</div>
			</div>
			<div class="mt-6">
				<div class="flex items-center">
					<div class="flex-1 bg-teal-200 rounded-full h-3">
						<div
							class="bg-white rounded-full h-3 transition-all duration-500"
							style="width: {data.dashboard?.overall_health?.score ?? 0}%"
						></div>
					</div>
					<span class="ml-4 text-white font-medium">
						{#if (data.dashboard?.overall_health?.score ?? 0) >= 90}
							{m.excellent?.() || 'Excellent'}
						{:else if (data.dashboard?.overall_health?.score ?? 0) >= 70}
							{m.good?.() || 'Good'}
						{:else if (data.dashboard?.overall_health?.score ?? 0) >= 50}
							{m.needsAttention?.() || 'Needs Attention'}
						{:else}
							{m.critical?.() || 'Critical'}
						{/if}
					</span>
				</div>
			</div>
			<!-- Quick Stats -->
			<div class="mt-6 grid grid-cols-4 gap-4 text-center">
				<div class="bg-white/10 rounded-lg p-3">
					<div class="text-2xl font-bold text-white">{data.dashboard?.overall_health?.total_activities ?? 0}</div>
					<div class="text-teal-100 text-xs">{m.totalActivities?.() || 'Total Activities'}</div>
				</div>
				<div class="bg-white/10 rounded-lg p-3">
					<div class="text-2xl font-bold text-white">{data.dashboard?.overall_health?.completed_activities ?? 0}</div>
					<div class="text-teal-100 text-xs">{m.completed?.() || 'Completed'}</div>
				</div>
				<div class="bg-white/10 rounded-lg p-3">
					<div class="text-2xl font-bold text-white">{data.dashboard?.overall_health?.completion_rate ?? 0}%</div>
					<div class="text-teal-100 text-xs">{m.completionRate?.() || 'Completion Rate'}</div>
				</div>
				<div class="bg-white/10 rounded-lg p-3">
					<div class="text-2xl font-bold text-white">{data.dashboard?.overall_health?.on_time_rate ?? 0}%</div>
					<div class="text-teal-100 text-xs">{m.onTimeRate?.() || 'On-Time Rate'}</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Metrics Cards -->
	{#if data.dashboard?.metrics && data.dashboard.metrics.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
			{#each data.dashboard.metrics as metric}
				<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
					<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
						<div class="flex items-center justify-between">
							<h3 class="text-lg font-medium text-gray-900 dark:text-white">{metric.name}</h3>
							<span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(metric.status)}`}>
								{metric.status}
							</span>
						</div>
					</div>
					<div class="p-6">
						<div class="flex items-end justify-between">
							<div>
								<p class="text-3xl font-semibold text-gray-900 dark:text-white">{metric.value}{metric.unit}</p>
								<p class="text-sm text-gray-500 dark:text-gray-400">Target: {metric.target}{metric.unit}</p>
							</div>
							<div class="flex items-center {getTrendIcon(metric.trend).class}">
								<i class="fa-solid {getTrendIcon(metric.trend).icon} mr-1"></i>
								<span class="text-sm font-medium">{metric.trend_value > 0 ? '+' : ''}{metric.trend_value}{metric.unit}</span>
							</div>
						</div>
						<div class="mt-4">
							<div class="w-full bg-gray-200 rounded-full h-2">
								<div
									class="h-2 rounded-full transition-all duration-500 {metric.status === 'good' ? 'bg-green-500' : metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}"
									style="width: {Math.min((metric.value / metric.target) * 100, 100)}%"
								></div>
							</div>
						</div>
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{metric.description}</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Two Column Layout: Overdue and Upcoming -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
		<!-- Overdue Activities -->
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white flex items-center">
					<i class="fa-solid fa-exclamation-triangle text-red-500 mr-2"></i>
					{m.overdueActivities?.() || 'Overdue Activities'}
				</h3>
				<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
					{data.overdue?.length ?? 0}
				</span>
			</div>
			<div class="p-6">
				{#if data.overdue && data.overdue.length > 0}
					<ul class="divide-y divide-gray-200 dark:divide-gray-700">
						{#each data.overdue.slice(0, 5) as item}
							<li class="py-3">
								<div class="flex items-center justify-between">
									<div>
										<p class="font-medium text-gray-900 dark:text-white">{item.activity_name || item.activity_ref_id}</p>
										<p class="text-sm text-gray-500 dark:text-gray-400">
											{m.dueDate?.() || 'Due'}: {formatDate(item.due_date)}
											<span class="text-red-600 ml-2">({item.days_overdue} {m.daysOverdue?.() || 'days overdue'})</span>
										</p>
									</div>
									<a
										href="{base}/conmon-executions/{item.id}"
										class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
										aria-label="View execution details"
									>
										<i class="fa-solid fa-arrow-right"></i>
									</a>
								</div>
							</li>
						{/each}
					</ul>
					{#if data.overdue.length > 5}
						<a
							href="{base}/conmon-executions?status=overdue"
							class="mt-4 block text-center text-sm text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
						>
							{m.viewAll?.() || 'View all'} ({data.overdue.length})
						</a>
					{/if}
				{:else}
					<div class="text-center py-8 text-gray-500 dark:text-gray-400">
						<i class="fa-solid fa-check-circle text-4xl text-green-500 mb-2"></i>
						<p>{m.noOverdueActivities?.() || 'No overdue activities'}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Upcoming Activities -->
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white flex items-center">
					<i class="fa-solid fa-calendar-alt text-blue-500 mr-2"></i>
					{m.upcomingActivities?.() || 'Upcoming Activities (14 days)'}
				</h3>
				<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
					{data.upcoming?.length ?? 0}
				</span>
			</div>
			<div class="p-6">
				{#if data.upcoming && data.upcoming.length > 0}
					<ul class="divide-y divide-gray-200 dark:divide-gray-700">
						{#each data.upcoming.slice(0, 5) as item}
							<li class="py-3">
								<div class="flex items-center justify-between">
									<div>
										<p class="font-medium text-gray-900 dark:text-white">{item.activity_name || item.activity_ref_id}</p>
										<p class="text-sm text-gray-500 dark:text-gray-400">
											{m.dueDate?.() || 'Due'}: {formatDate(item.due_date)}
											<span class="text-blue-600 ml-2">({item.days_until_due} {m.daysRemaining?.() || 'days remaining'})</span>
										</p>
									</div>
									<a
										href="{base}/conmon-executions/{item.id}"
										class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
										aria-label="View execution details"
									>
										<i class="fa-solid fa-arrow-right"></i>
									</a>
								</div>
							</li>
						{/each}
					</ul>
					{#if data.upcoming.length > 5}
						<a
							href="{base}/conmon-executions?status=pending"
							class="mt-4 block text-center text-sm text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
						>
							{m.viewAll?.() || 'View all'} ({data.upcoming.length})
						</a>
					{/if}
				{:else}
					<div class="text-center py-8 text-gray-500 dark:text-gray-400">
						<i class="fa-solid fa-calendar-check text-4xl text-gray-400 mb-2"></i>
						<p>{m.noUpcomingActivities?.() || 'No upcoming activities in the next 14 days'}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Compliance by Frequency -->
	{#if data.dashboard?.compliance_by_frequency && Object.keys(data.dashboard.compliance_by_frequency).length > 0}
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">
					{m.complianceByFrequency?.() || 'Compliance by Activity Frequency'}
				</h3>
			</div>
			<div class="p-6">
				<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
					{#each Object.entries(data.dashboard.compliance_by_frequency) as [frequency, rate]}
						<div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
							<div class="text-2xl font-bold {rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-600'}">
								{rate}%
							</div>
							<div class="text-sm text-gray-500 dark:text-gray-400 capitalize">{frequency.replace('_', ' ')}</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Active Profiles Summary -->
	{#if data.profiles && data.profiles.length > 0}
		<div class="bg-white dark:bg-gray-800 shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white">
					{m.activeProfiles?.() || 'Active ConMon Profiles'}
				</h3>
				<a
					href="{base}/conmon-profiles"
					class="text-sm text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
				>
					{m.manageAll?.() || 'Manage all'} <i class="fa-solid fa-arrow-right ml-1"></i>
				</a>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-700">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								{m.profile?.() || 'Profile'}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								{m.type?.() || 'Type'}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								{m.status?.() || 'Status'}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								{m.activities?.() || 'Activities'}
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								{m.actions?.() || 'Actions'}
							</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
						{#each data.profiles.filter(p => p.status === 'active').slice(0, 5) as profile}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="font-medium text-gray-900 dark:text-white">{profile.name}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
										{profile.profile_type_display || profile.profile_type}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {profile.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
										{profile.status_display || profile.status}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
									{profile.enabled_activities ?? 0} / {profile.total_activities ?? 0}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm">
									<a
										href="{base}/conmon-profiles/{profile.id}"
										class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 mr-4"
									>
										<i class="fa-solid fa-eye"></i> {m.view?.() || 'View'}
									</a>
									<a
										href="{base}/conmon-profiles/{profile.id}/dashboard"
										class="text-teal-600 hover:text-teal-900 dark:text-teal-400"
									>
										<i class="fa-solid fa-gauge-high"></i> {m.dashboard?.() || 'Dashboard'}
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
