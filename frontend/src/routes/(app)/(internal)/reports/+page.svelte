<script lang="ts">
	import { m } from '$paraglide/messages';
	import type { PageData } from './$types';
	import ReportTile from './ReportTile.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	interface ReportTileData {
		id: string;
		title: string;
		description: string;
		icon: string;
		category: string;
		onClick?: () => void;
		href?: string;
		tags?: string[];
	}

	// Available report tiles
	const reportTiles: ReportTileData[] = [
		{
			id: 'dora-roi',
			title: 'DORA Register of Information',
			description:
				'Generate DORA-compliant Register of Information (ROI) containing entity data required by the Digital Operational Resilience Act',
			icon: 'fa-solid fa-building-shield',
			category: 'compliance',
			href: '/reports/dora-roi',
			tags: ['DORA', 'Regulation', 'Entities', 'Beta']
		},
		{
			id: 'compliance-summary',
			title: 'Compliance Summary Report',
			description:
				'Generate a comprehensive overview of compliance posture across all frameworks, including assessment statuses, coverage metrics, and gap analysis',
			icon: 'fa-solid fa-certificate',
			category: 'compliance',
			href: '/reports/compliance-summary',
			tags: ['Compliance', 'Summary', 'PDF']
		},
		{
			id: 'risk-register',
			title: 'Risk Register Report',
			description:
				'Export the full risk register with risk scenarios, current ratings, treatment plans, and residual risk levels for management review',
			icon: 'fa-solid fa-magnifying-glass-chart',
			category: 'risk',
			href: '/reports/risk-register',
			tags: ['Risk', 'Register', 'PDF', 'Excel']
		},
		{
			id: 'poam-status',
			title: 'POA&M Status Report',
			description:
				'Generate a Plan of Action & Milestones report showing open findings, remediation progress, scheduled milestones, and overdue items',
			icon: 'fa-solid fa-list-check',
			category: 'compliance',
			href: '/reports/poam-status',
			tags: ['POA&M', 'Remediation', 'PDF', 'Excel']
		},
		{
			id: 'conmon-monthly',
			title: 'ConMon Monthly Report',
			description:
				'Produce a continuous monitoring monthly summary with control effectiveness trends, scan results, and security posture changes',
			icon: 'fa-solid fa-calendar-days',
			category: 'operations',
			href: '/reports/conmon-monthly',
			tags: ['ConMon', 'Monthly', 'PDF']
		},
		{
			id: 'vendor-assessment',
			title: 'Vendor Assessment Summary',
			description:
				'Compile third-party risk assessment results including vendor risk ratings, questionnaire completion status, and outstanding findings',
			icon: 'fa-solid fa-building',
			category: 'risk',
			href: '/reports/vendor-assessment',
			tags: ['TPRM', 'Vendors', 'PDF', 'Excel']
		}
	];

	function handleTileClick(tile: ReportTileData): void {
		if (tile.onClick) {
			tile.onClick();
		}
	}
</script>

<div class="px-4 py-6 space-y-6">
	<!-- Header -->

	<!-- Reports Grid with White Background -->
	<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			{#each reportTiles as tile}
				<ReportTile
					title={tile.title}
					description={tile.description}
					icon={tile.icon}
					category={tile.category}
					href={tile.href}
					tags={tile.tags}
					onclick={tile.href ? undefined : () => handleTileClick(tile)}
				/>
			{/each}
		</div>
	</div>

	<!-- Info Section -->
	<div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6">
		<div class="flex items-start gap-4">
			<div class="flex-shrink-0">
				<i class="fas fa-info-circle text-2xl text-blue-600"></i>
			</div>
			<div>
				<h3 class="text-lg font-semibold text-gray-900 mb-2">
					{m.aboutReports ? m.aboutReports() : 'About Reports'}
				</h3>
				<p class="text-gray-700">
					{m.aboutReportsDescription
						? m.aboutReportsDescription()
						: 'Reports provide a simple tools to generate specialized reports useful for key insights or required by authorities for specific standards.\nMore specialized capabilities will be added as we identify specific cases.'}
				</p>
			</div>
		</div>
	</div>
</div>
