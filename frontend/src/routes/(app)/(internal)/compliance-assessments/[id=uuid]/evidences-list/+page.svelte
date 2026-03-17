<script lang="ts">
	import { page } from '$app/state';
	import ModelTable from '$lib/components/ModelTable/ModelTable.svelte';
	import type { TableSource } from '$lib/components/ModelTable/types';
	import { m } from '$paraglide/messages';
	let { data } = $props();

	const evidencesHead = {
		name: 'name',
		status: 'status',
		last_update: 'updatedAt',
		expiry_date: 'expiryDate',
		owner: 'owner',
		requirement_assessments: 'matchingRequirements'
	};

	const evidences: TableSource = {
		head: evidencesHead,
		body: [],
		meta: []
	};
</script>

<div class="brand-card mb-4 flex flex-row justify-center space-x-2 p-3">
	<p class="font-semibold text-lg">
		{m.perimeter()}:
		<a
			class="unstyled cursor-pointer text-[var(--rv-blue)] hover:text-[var(--rv-midnight)]"
			href="/perimeters/{data.compliance_assessment.perimeter.id}/"
			>{data.compliance_assessment.perimeter.str}</a
		>
	</p>
	<p>/</p>
	<p class="font-semibold text-lg">
		{m.complianceAssessment()}:
		<a
			class="unstyled cursor-pointer text-[var(--rv-blue)] hover:text-[var(--rv-midnight)]"
			href="/compliance-assessments/{data.compliance_assessment.id}/"
			>{data.compliance_assessment.name} - {data.compliance_assessment.version}</a
		>
	</p>
	<p>/</p>
	<p class="font-semibold text-lg">
		{m.framework()}:
		<a
			class="unstyled cursor-pointer text-[var(--rv-blue)] hover:text-[var(--rv-midnight)]"
			href="/frameworks/{data.compliance_assessment.framework.id}/"
			>{data.compliance_assessment.framework.str}</a
		>
	</p>
</div>

<div class="brand-card flex flex-col space-y-4 p-5 lg:p-6">
	<div>
		<span class="brand-overline">Regovise Evidence</span>
		<p class="mt-3 text-2xl font-extrabold text-[var(--rv-midnight)]">{m.associatedEvidences()}</p>
		<p class="text-sm text-slate-500">
			{m.evidencesHelpText()}
		</p>
	</div>
	<div class="">
		<ModelTable
			URLModel="evidences"
			source={evidences}
			search={true}
			rowsPerPage={true}
			orderBy={{ identifier: 'name', direction: 'asc' }}
			baseEndpoint="/compliance-assessments/{page.params.id}/evidences-list"
			fields={['name', 'status', 'last_update', 'expiry_date', 'owner', 'requirement_assessments']}
		/>
	</div>
</div>
