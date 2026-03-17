<script lang="ts">
	import AutocompleteSelect from '$lib/components/Forms/AutocompleteSelect.svelte';
	import SuperForm from '$lib/components/Forms/Form.svelte';
	import { goto } from '$lib/utils/breadcrumbs';
	import { getSecureRedirect } from '$lib/utils/helpers';
	import { defaults, superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zod } from 'sveltekit-superforms/adapters';

	import * as m from '$paraglide/messages';
	import TextField from '$lib/components/Forms/TextField.svelte';
	import Checkbox from '$lib/components/Forms/Checkbox.svelte';
	import { quickStartSchema } from '$lib/utils/schemas';
	import { getLocale } from '$paraglide/runtime';
	import { getModalStore, type ModalStore } from '$lib/components/Modals/stores';
	import { BRAND_NAME } from '$lib/brand';

	const modalStore: ModalStore = getModalStore();

	interface Props {
		/** Exposes parent props to this component. */
		parent: any;
		invalidateAll?: boolean; // set to false to keep form data using muliple forms on a page
		formAction?: string;
		additionalInitialData?: any;
		suggestions?: { [key: string]: any };
		debug?: boolean;
		[key: string]: any;
	}

	let {
		parent,
		invalidateAll = true,
		formAction = '/quick-start?/create',
		additionalInitialData = {},
		suggestions = {},
		debug = false,
		...rest
	}: Props = $props();

	const cBase = 'brand-card w-full max-w-4xl space-y-6 p-6 lg:p-8';
	const cHeader = 'brand-title-gradient text-3xl font-bold leading-tight tracking-tight';

	const form = defaults(
		{
			framework: 'urn:ciso:risk:library:iso27001-2022',
			risk_matrix: 'urn:ciso:risk:library:critical_risk_matrix_5x5',
			audit_name: `Quick start audit ${new Date().toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
			risk_assessment_name: `Quick start risk assessment ${new Date().toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
		},
		zod(quickStartSchema)
	);

	const _form = superForm(form, {
		dataType: 'json',
		invalidateAll,
		applyAction: rest.applyAction ?? true,
		resetForm: rest.resetForm ?? false,
		validators: zod(quickStartSchema),
		taintedMessage: m.taintedFormMessage(),
		validationMethod: 'auto',
		onUpdated: async ({ form }) => {
			if (form.message?.redirect) {
				goto(getSecureRedirect(form.message.redirect));
			}
			if (form.valid) {
				parent.onConfirm();
			}
		}
	});
</script>

{#if $modalStore[0]}
	<div class="modal-example-form {cBase}">
		<div class="flex items-start justify-between gap-6">
			<div class="space-y-4">
				<span class="brand-overline">Quick Start</span>
				<div class="flex items-start gap-4">
					<div class="brand-icon-badge h-14 w-14 rounded-[20px] text-xl">
						<i class="fa-solid fa-compass-drafting"></i>
					</div>
					<div class="space-y-2">
						<header class={cHeader} data-testid="modal-title">
							{$modalStore[0].title ?? `Launch ${BRAND_NAME}`}
						</header>
						<p class="max-w-2xl text-sm leading-6 text-slate-600">
							Stand up a starter Regovise workspace with a seeded framework, a baseline audit,
							and an optional risk assessment in one guided flow.
						</p>
					</div>
				</div>
			</div>
			<div
				role="button"
				tabindex="0"
				class="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition hover:-translate-y-0.5 hover:border-[rgb(88_181_255_/_0.32)] hover:text-[var(--rv-midnight)]"
				onclick={parent.onClose}
				onkeydown={parent.onClose}
			>
				<i class="fa-solid fa-xmark"></i>
			</div>
		</div>
		<div class="brand-card-dark rounded-[28px] px-5 py-4">
			<div class="flex flex-wrap items-center gap-3 text-sm">
				<span class="brand-chip !border-white/15 !bg-white/10 !text-white">
					<i class="fa-solid fa-shield-halved"></i>
					Governance baseline
				</span>
				<span class="brand-chip !border-white/15 !bg-white/10 !text-white">
					<i class="fa-solid fa-list-check"></i>
					Framework import
				</span>
				<span class="brand-chip !border-white/15 !bg-white/10 !text-white">
					<i class="fa-solid fa-wave-square"></i>
					Optional risk setup
				</span>
			</div>
		</div>
		<SuperForm
			class="space-y-5"
			dataType="json"
			enctype="application/x-www-form-urlencoded"
			data={form}
			{_form}
			{invalidateAll}
			validators={zod(quickStartSchema)}
			action={formAction}
			{...rest}
		>
			{#snippet children({ form, data, initialData })}
				<div class="grid gap-4 lg:grid-cols-2">
					<div class="brand-card rounded-[24px] p-4">
						<div class="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
							Framework Setup
						</div>
						<div class="space-y-4">
							<AutocompleteSelect
								{form}
								field="framework"
								label={m.framework()}
								optionsEndpoint="stored-libraries"
								optionsDetailedUrlParameters={[['object_type', 'framework']]}
								optionsValueField="urn"
							/>
							<TextField {form} field="audit_name" label={m.auditName()} />
						</div>
					</div>
					<div class="brand-card rounded-[24px] p-4">
						<div class="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
							Risk Layer
						</div>
						<div class="space-y-4">
							<Checkbox {form} field="create_risk_assessment" label={m.createRiskAssessment()} />
							<TextField
								{form}
								field="risk_assessment_name"
								label={m.riskAssessmentName()}
								disabled={!data.create_risk_assessment}
							/>
							<AutocompleteSelect
								{form}
								field="risk_matrix"
								label={m.riskMatrix()}
								optionsEndpoint="stored-libraries"
								optionsDetailedUrlParameters={[['object_type', 'risk_matrix']]}
								optionsValueField="urn"
								disabled={!data.create_risk_assessment}
							/>
						</div>
					</div>
				</div>
				<div class="flex flex-row justify-between space-x-4">
					<button
						class="btn w-full border border-slate-200 bg-white font-semibold text-slate-700 hover:border-[rgb(88_181_255_/_0.3)] hover:bg-slate-50"
						data-testid="cancel-button"
						type="button"
						onclick={(event) => {
							parent.onClose(event);
						}}>{m.cancel()}</button
					>

					<button
						class="btn w-full font-semibold text-white shadow-[0_18px_34px_rgb(11_31_42_/_0.18)]"
						style="background: var(--rv-gradient-accent);"
						data-testid="save-button"
						type="submit">{m.save()}</button
					>
				</div>
			{/snippet}
		</SuperForm>
	</div>
{/if}
