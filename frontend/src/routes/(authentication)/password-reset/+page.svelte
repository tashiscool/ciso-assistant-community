<script lang="ts">
	import type { PageData } from './$types';
	import { emailSchema } from '$lib/utils/schemas';
	import TextField from '$lib/components/Forms/TextField.svelte';
	import SuperForm from '$lib/components/Forms/Form.svelte';

	import { m } from '$paraglide/messages';
	import { zod } from 'sveltekit-superforms/adapters';
	import Logo from '$lib/components/Logo/Logo.svelte';
	import { BRAND_TAGLINE } from '$lib/brand';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<div class="brand-shell relative min-h-screen overflow-hidden px-6 py-6 lg:px-10 lg:py-8">
	<div class="flex items-start justify-between">
		<Logo theme="light" width={194} className="h-auto w-[194px]" />
		<span class="hidden lg:inline-flex rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
			Password Recovery
		</span>
	</div>
	<div class="flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
		<div class="brand-card w-full max-w-md p-8 lg:p-10">
			<div id="password_reset" class="flex flex-col items-center space-y-4">
				<div class="brand-icon-badge text-3xl">
					<i class="fa-solid fa-lock"></i>
				</div>
				<h3 class="brand-title-gradient text-center text-3xl font-bold leading-tight tracking-tight">
					{m.forgtPassword()}
				</h3>
				<p class="text-center text-sm text-slate-600">
					{m.enterYourEmail()}. We will send you a secure link so you can return to Regovise.
				</p>
				<p class="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
					{BRAND_TAGLINE}
				</p>
				<div>
					<!-- SuperForm with dataType 'form' -->
					<SuperForm
						class="flex flex-col space-y-3"
						data={data?.form}
						dataType="form"
						validators={zod(emailSchema)}
					>
						{#snippet children({ form })}
							<TextField type="email" {form} field="email" label={m.email()} />
							<p class="pt-3">
								<button
									class="btn preset-filled-primary-500 font-semibold w-full"
									data-testid="send-btn"
									type="submit">{m.send()}</button
								>
							</p>
						{/snippet}
					</SuperForm>
				</div>
				<a href="/login" class="flex items-center space-x-2 text-primary-800 hover:text-primary-600">
					<i class="fa-solid fa-arrow-left"></i>
					<p class="">{m.goBackToLogin()}</p>
				</a>
			</div>
		</div>
	</div>
</div>
