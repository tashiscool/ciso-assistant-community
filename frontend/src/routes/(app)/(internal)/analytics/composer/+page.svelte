<script lang="ts">
	import DonutChart from '$lib/components/Chart/DonutChart.svelte';
	import BarChart from '$lib/components/Chart/BarChart.svelte';
	import { m } from '$paraglide/messages';

	interface Props {
		data: any;
	}

	let { data }: Props = $props();

	const seededAssessments = Array.isArray(data?.risk_assessment_objects)
		? data.risk_assessment_objects.map((item: Record<string, any>) => ({ ...item, show: false }))
		: [];

	let riskData = $state({
		...data,
		risk_assessment_objects: seededAssessments
	});

	function reviewBadgeClass(count: number): string {
		return count > 0
			? 'bg-amber-100 text-amber-800'
			: 'bg-emerald-100 text-emerald-800';
	}
</script>

<div class="space-y-5 p-2 lg:p-3">
	<div class="brand-card-dark overflow-hidden px-6 py-7 lg:px-8">
		<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-3xl space-y-4">
				<span class="brand-overline !text-white/70">Composer Analytics</span>
				<div>
					<h1 class="text-3xl font-semibold tracking-tight text-white lg:text-4xl">
						{m.composerTitlePlural({
							number: riskData.risk_assessment_objects?.length || 0
						})}
					</h1>
					<p class="mt-3 max-w-2xl text-sm leading-6 text-slate-300 lg:text-base">
						Combine risk assessments into one Regovise view to compare exposure, treatment
						progress, and review hotspots across the selected scope.
					</p>
				</div>
			</div>

			<div class="grid gap-3 sm:grid-cols-3">
				<div class="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur">
					<div class="text-3xl font-semibold text-white">{riskData.counters?.untreated || 0}</div>
					<div class="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-300">
						Untreated
					</div>
				</div>
				<div class="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur">
					<div class="text-3xl font-semibold text-white">{riskData.counters?.accepted || 0}</div>
					<div class="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-300">
						Accepted
					</div>
				</div>
				<div class="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur">
					<div class="text-3xl font-semibold text-white">
						{riskData.risk_assessment_objects?.length || 0}
					</div>
					<div class="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-slate-300">
						Assessments
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="grid gap-5 xl:grid-cols-3">
		<div class="brand-card p-5 lg:p-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold text-[var(--rv-midnight)]">
						{m.currentRiskLevelPerScenario()}
					</h2>
					<p class="mt-1 text-sm text-slate-500">Current exposure across scoped scenarios.</p>
				</div>
				<span class="brand-chip">Current</span>
			</div>
			<div class="mt-4 h-96">
				<DonutChart
					name="current_risk_level"
					s_label={m.currentRiskLevelPerScenario()}
					values={riskData.current_level}
					colors={riskData.current_level.map((object) => object.color)}
				/>
			</div>
		</div>

		<div class="brand-card p-5 lg:p-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold text-[var(--rv-midnight)]">
						{m.statusOfAssociatedMeasures()}
					</h2>
					<p class="mt-1 text-sm text-slate-500">Execution state of linked controls and actions.</p>
				</div>
				<span class="brand-chip">Controls</span>
			</div>
			<div class="mt-4 h-96">
				<BarChart
					name="composer"
					labels={riskData.applied_control_status.labels}
					values={riskData.applied_control_status.values}
				/>
			</div>
		</div>

		<div class="brand-card p-5 lg:p-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold text-[var(--rv-midnight)]">
						{m.residualRiskLevelPerScenario()}
					</h2>
					<p class="mt-1 text-sm text-slate-500">Residual posture after current treatment plans.</p>
				</div>
				<span class="brand-chip">Residual</span>
			</div>
			<div class="mt-4 h-96">
				<DonutChart
					name="residual_risk_level"
					s_label={m.residualRiskLevelPerScenario()}
					values={riskData.residual_level}
					colors={riskData.residual_level.map((object) => object.color)}
				/>
			</div>
		</div>
	</div>

	<div class="brand-card p-5 lg:p-6">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div>
				<span class="brand-overline">Selection Summary</span>
				<h2 class="mt-3 text-2xl font-semibold text-[var(--rv-midnight)]">
					{m.forTheSelectedScope()}
				</h2>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
					Use this roll-up to quickly identify untreated exposure and accepted scenarios that
					need renewed attention or documentation.
				</p>
			</div>
			<a href="/x-rays" class="brand-chip !bg-[rgba(88,181,255,0.14)] !text-[var(--rv-midnight)]">
				<i class="fa-solid fa-x-ray"></i>
				Review in x-rays
			</a>
		</div>

		<div class="mt-6 grid gap-5 lg:grid-cols-2">
			<div class="rounded-[24px] border border-slate-100 bg-slate-50/80 p-5">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold text-[var(--rv-midnight)]">
						{m.untreatedRiskScenarios({
							count: riskData.counters?.untreated || 0,
							s: (riskData.counters?.untreated || 0) > 1 ? 's' : ''
						})}
					</h3>
					<span class="brand-chip !bg-[rgba(247,181,74,0.16)] !text-[var(--rv-midnight)]">
						{riskData.counters?.untreated || 0}
					</span>
				</div>
				<ul class="mt-4 space-y-3">
					{#each riskData.riskscenarios?.untreated || [] as scenario}
						<li class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
							{scenario.name}
						</li>
					{/each}
				</ul>
			</div>

			<div class="rounded-[24px] border border-slate-100 bg-slate-50/80 p-5">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold text-[var(--rv-midnight)]">
						{m.acceptedRiskScenarios({
							count: riskData.counters?.accepted || 0,
							s: (riskData.counters?.accepted || 0) > 1 ? 's' : ''
						})}
					</h3>
					<span class="brand-chip !bg-[rgba(20,200,181,0.14)] !text-[var(--rv-midnight)]">
						{riskData.counters?.accepted || 0}
					</span>
				</div>
				<ul class="mt-4 space-y-3">
					{#each riskData.riskscenarios?.accepted || [] as scenario}
						<li class="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
							{scenario.name}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<div class="space-y-4">
		{#each riskData.risk_assessment_objects || [] as item}
			<div class="brand-card overflow-hidden">
				<div
					class="flex cursor-pointer flex-col gap-3 px-6 py-5 transition hover:bg-slate-50/80 lg:flex-row lg:items-center lg:justify-between"
					onclick={() => {
						item.show = !item.show;
					}}
					role="button"
					tabindex="0"
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') item.show = !item.show;
					}}
				>
					<div class="flex items-center gap-3">
						<div class="brand-icon-badge h-11 w-11 rounded-[18px] text-base">
							<i class={`fa-solid ${item.show ? 'fa-angle-up' : 'fa-angle-down'}`}></i>
						</div>
						<div>
							<h3 class="text-lg font-semibold text-[var(--rv-midnight)]">
								{item.risk_assessment.perimeter.str}/{item.risk_assessment.name}
							</h3>
							<p class="mt-1 text-sm text-slate-500">Assessment posture and review quality signals</p>
						</div>
					</div>

					<span
						class="inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold {reviewBadgeClass(
							item.risk_assessment.quality_check.count
						)}"
					>
						{#if item.risk_assessment.quality_check.count > 0}
							{m.reviewNeeded()}
						{:else}
							{m.ok()}
						{/if}
					</span>
				</div>

				{#if item.show}
					<div class="border-t border-slate-100 px-6 py-5">
						{#if item.risk_assessment.quality_check.count > 0}
							<div class="mb-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
								<i class="fa-solid fa-lightbulb mr-2"></i>
								{m.inconsistenciesFoundComposer({
									count: item.risk_assessment.quality_check.count,
									s: item.risk_assessment.quality_check.count > 1 ? 's' : '',
									plural: item.risk_assessment.quality_check.count > 1 ? 'ies' : 'y'
								})}
								<a class="ml-2 font-semibold text-amber-900 underline" href="/x-rays">x-rays</a>
							</div>
						{/if}

						<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
							<div class="overflow-x-auto">
								<table class="w-full overflow-hidden rounded-[24px] border border-slate-200 text-sm">
									<thead class="bg-slate-50 text-slate-600">
										<tr>
											<th class="px-4 py-3 text-left font-medium"></th>
											<th class="px-4 py-3 text-center font-medium">{m.current()}</th>
											<th class="px-4 py-3 text-center font-medium">{m.residual()}</th>
										</tr>
									</thead>
									<tbody>
										{#each item.synth_table as lvl}
											<tr class="border-t border-slate-100">
												<td class="px-4 py-3 font-semibold text-[var(--rv-midnight)]">
													<span
														class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
														style="background-color: {lvl.color}; color: #0b1f2a;"
													>
														{lvl.lvl}
													</span>
												</td>
												<td class="px-4 py-3 text-center text-slate-700">{lvl.current}</td>
												<td class="px-4 py-3 text-center text-slate-700">{lvl.residual}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>

							<div class="flex flex-col gap-3">
								<a
									class="btn flex items-center justify-center border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 hover:border-[rgb(88_181_255_/_0.24)] hover:bg-slate-50"
									href="/risk-assessments/{item.risk_assessment.id}/"
								>
									<i class="fa-solid fa-arrow-up-right-from-square mr-2"></i>
									{m.jumpToRiskAssessment()}
								</a>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
