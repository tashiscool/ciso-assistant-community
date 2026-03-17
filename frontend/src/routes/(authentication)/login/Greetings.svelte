<script lang="ts">
	import { BRAND_NAME, BRAND_TAGLINE } from '$lib/brand';
	import Typewriter from 'sv-typewriter';
</script>

<div
	id="hellothere"
	class="flex flex-col justify-center px-4 text-white lg:px-0 lg:pr-12"
>
	<span class="brand-overline !text-white/70">Governance, Compliance, Evidence</span>
	<Typewriter mode="loopOnce" cursor={false} interval={25}>
		<div class="unstyled pb-4 text-4xl font-semibold leading-none tracking-tight text-center lg:text-left lg:text-6xl">
			<span>{BRAND_NAME}</span>
		</div>
	</Typewriter>
	<Typewriter mode="cascade" cursor={false} interval={24} delay={900}>
		<div class="unstyled max-w-2xl text-center text-lg leading-relaxed text-slate-200 lg:text-left lg:text-2xl">
			<span class="font-semibold text-white">{BRAND_TAGLINE}</span>
			<span>
				{' '}
				Bring policies, controls, evidence, and operational guidance into one executive-grade
				workspace.
			</span>
		</div>
	</Typewriter>
	<div class="mt-8 grid gap-4 sm:grid-cols-3">
		<div class="brand-card-dark rounded-[24px] p-4 text-left">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Aligned</p>
			<p class="mt-2 text-sm text-slate-200">Map frameworks, controls, and risks without losing context.</p>
		</div>
		<div class="brand-card-dark rounded-[24px] p-4 text-left">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Verifiable</p>
			<p class="mt-2 text-sm text-slate-200">Keep evidence collection and assurance workflows audit ready.</p>
		</div>
		<div class="brand-card-dark rounded-[24px] p-4 text-left">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Clear</p>
			<p class="mt-2 text-sm text-slate-200">Guide stakeholders with a product that feels controlled, not chaotic.</p>
		</div>
	</div>
</div>
