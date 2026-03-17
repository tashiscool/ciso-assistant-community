<script lang="ts">
	import { page } from '$app/state';
	import ModelTable from '$lib/components/ModelTable/ModelTable.svelte';
	import type { TableSource } from '$lib/components/ModelTable/types';
	import { m } from '$paraglide/messages';
	import Anchor from '$lib/components/Anchor/Anchor.svelte';

	let { data } = $props();

	const appliedControlsHead = {
		ref_id: 'refId',
		name: 'name',
		status: 'status',
		priority: 'priority',
		category: 'category',
		csf_function: 'csfFunction',
		owner: 'owner',
		eta: 'eta',
		expiry_date: 'expiryDate',
		effort: 'effort',
		annual_cost: 'cost',
		risk_scenarios: 'matchingScenarios'
	};

	const appliedControls: TableSource = {
		head: appliedControlsHead,
		body: [],
		meta: []
	};

	let hasAppliedControls = $derived(
		data.scenariosTable.body.some((riskScenario) => riskScenario.applied_controls.length > 0)
	);
</script>

<div class="brand-card mb-4 flex flex-row justify-center space-x-2 p-3">
	<p class="font-semibold text-lg">
		{m.perimeter()}:
		<a
			class="unstyled cursor-pointer text-[var(--rv-blue)] hover:text-[var(--rv-midnight)]"
			href="/perimeters/{data.risk_assessment.perimeter.id}/"
			>{data.risk_assessment.perimeter.str}</a
		>
	</p>
	<p>/</p>
	<p class="font-semibold text-lg">
		{m.riskAssessment()}:
		<a
			class="unstyled cursor-pointer text-[var(--rv-blue)] hover:text-[var(--rv-midnight)]"
			href="/risk-assessments/{data.risk_assessment.id}/"
			>{data.risk_assessment.name} - {data.risk_assessment.version}</a
		>
	</p>
</div>
<div class="brand-card flex flex-col space-y-4 p-5 lg:p-6">
	<div class="flex justify-between items-center w-full">
		<div class="flex-1">
			<span class="brand-overline">Regovise Action Plan</span>
			<p class="mt-3 text-2xl font-extrabold text-[var(--rv-midnight)]">{m.associatedAppliedControls()}</p>
			<p class="text-sm text-slate-500">
				{m.actionPlanHelpText()}
			</p>
		</div>
		{#if hasAppliedControls}
			<div class="flex gap-2 ml-auto">
				<Anchor
					breadcrumbAction="push"
					href={`/applied-controls/flash-mode?risk_assessments=${page.params.id}&backUrl=${encodeURIComponent(page.url.pathname)}&backLabel=${encodeURIComponent(m.actionPlan())}`}
					class="btn h-fit border-0 text-white"
					style="background: var(--rv-gradient-accent); box-shadow: var(--rv-shadow-glow);"
					><i class="fa-solid fa-bolt mr-2"></i> {m.flashMode()}</Anchor
				>
			</div>
		{/if}
	</div>
	<div class="">
		<ModelTable
			URLModel="applied-controls"
			source={appliedControls}
			search={true}
			rowsPerPage={true}
			orderBy={{ identifier: 'eta', direction: 'desc' }}
			baseEndpoint="/risk-assessments/{page.params.id}/action-plan"
			fields={[
				'ref_id',
				'name',
				'status',
				'priority',
				'category',
				'csf_function',
				'owner',
				'eta',
				'expiry_date',
				'effort',
				'annual_cost',
				'risk_scenarios'
			]}
		/>
	</div>
</div>
