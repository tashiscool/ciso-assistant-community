<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import Logo from '$lib/components/Logo/Logo.svelte';
	import Greetings from './Greetings.svelte';
	import FormCard from './FormCard.svelte';
	import { BRAND_NAME } from '$lib/brand';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();
</script>

<svelte:head>
	<title>{BRAND_NAME}</title>
</svelte:head>

<div class="brand-shell relative min-h-screen overflow-hidden">
	<div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(88,181,255,0.18),transparent_28%)]"></div>
	<div class="relative flex min-h-screen flex-col px-6 py-6 lg:px-10 lg:py-8">
		<div class="flex items-start justify-between gap-4">
			<Logo theme="light" width={194} className="h-auto w-[194px]" />
			<span class="hidden lg:inline-flex rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-white/70 uppercase">
				Enterprise Trust Platform
			</span>
		</div>
		<div class="flex flex-1 items-center">
			<div class="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
				<Greetings />
				<div class="flex items-center justify-center">
					<FormCard {data} {form} />
				</div>
			</div>
		</div>
	</div>
</div>
