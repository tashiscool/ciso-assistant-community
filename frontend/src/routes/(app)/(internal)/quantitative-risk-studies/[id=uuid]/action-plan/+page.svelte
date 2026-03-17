<script lang="ts">
	import { page } from '$app/state';
	import ModelTable from '$lib/components/ModelTable/ModelTable.svelte';
	import type { TableSource } from '$lib/components/ModelTable/types';
	import { m } from '$paraglide/messages';
	import { getModalStore, type ModalSettings } from '$lib/components/Modals/stores';
	import Anchor from '$lib/components/Anchor/Anchor.svelte';

	let { data } = $props();

	const modalStore = getModalStore();

	const appliedControlsHead = {
		name: 'name',
		status: 'status',
		priority: 'priority',
		category: 'category',
		effort: 'effort',
		annual_cost: 'cost',
		control_impact: 'controlImpact',
		eta: 'eta',
		quantitative_risk_scenarios: 'scenarios'
	};

	const appliedControls: TableSource = {
		head: appliedControlsHead,
		body: [],
		meta: []
	};
</script>

<div class="brand-card mb-4 flex flex-row justify-center space-x-2 p-3">
	<p class="font-semibold text-lg">
		{m.folder()}:
		<a
			class="unstyled cursor-pointer text-[var(--rv-blue)] hover:text-[var(--rv-midnight)]"
			href="/folders/{data.quantitative_risk_study.folder.id}/"
			>{data.quantitative_risk_study.folder.str}</a
		>
	</p>
	<p>/</p>
	<p class="font-semibold text-lg">
		{m.quantitativeRiskStudyLabel()}:
		<a
			class="unstyled cursor-pointer text-[var(--rv-blue)] hover:text-[var(--rv-midnight)]"
			href="/quantitative-risk-studies/{data.quantitative_risk_study.id}/"
			>{data.quantitative_risk_study.name}</a
		>
	</p>
</div>

<div class="brand-card flex flex-col space-y-4 p-5 lg:p-6">
	<div class="flex justify-between items-center w-full">
		<div class="flex-1">
			<span class="brand-overline">Regovise Quantitative Risk</span>
			<p class="mt-3 text-2xl font-extrabold text-[var(--rv-midnight)]">{m.actionPlan()}</p>
			<p class="text-sm text-slate-500">{m.controlsFromQuantitativeRisk()}</p>
		</div>
		<div class="flex gap-2 ml-auto">
			<Anchor
				breadcrumbAction="push"
				href={`/applied-controls/flash-mode?quantitative_risk_studies=${page.params.id}&backUrl=${encodeURIComponent(page.url.pathname)}&backLabel=${encodeURIComponent(m.actionPlan())}`}
				class="btn h-fit border-0 text-white"
				style="background: var(--rv-gradient-accent); box-shadow: var(--rv-shadow-glow);"
				><i class="fa-solid fa-bolt mr-2"></i> {m.flashMode()}</Anchor
			>
		</div>
	</div>

	<div class="">
		<ModelTable
			URLModel="applied-controls"
			source={appliedControls}
			search={true}
			rowsPerPage={true}
			orderBy={{ identifier: 'eta', direction: 'desc' }}
			baseEndpoint="/quantitative-risk-studies/{page.params.id}/action-plan"
			fields={[
				'name',
				'status',
				'priority',
				'category',
				'effort',
				'annual_cost',
				'control_impact',
				'eta',
				'quantitative_risk_scenarios'
			]}
		/>
	</div>
</div>

<!-- Modal component for problematic scenarios -->
<!-- This would be registered as a modal component in your app -->
