<script lang="ts">
	import Logo from '$lib/components/Logo/Logo.svelte';
	import { BRAND_NAME, BRAND_TAGLINE } from '$lib/brand';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="brand-shell-light min-h-screen">
	<!-- Vendor Portal Header -->
	<header class="border-b border-white/10 bg-[var(--rv-midnight)] text-white shadow-2xl">
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<Logo theme="light" width={166} className="h-auto w-[166px]" />
					<div>
						<h1 class="text-lg font-semibold text-white">Vendor Trust Portal</h1>
						<p class="text-xs text-slate-300">Secure assessment collection and evidence exchange</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<span class="rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-xs text-slate-200">
						<i class="fa-solid fa-lock mr-1"></i>
						Secure Connection
					</span>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{@render children?.()}
	</main>

	<!-- Footer -->
	<footer class="mt-auto border-t border-slate-200/80 bg-white/86 backdrop-blur-xl">
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex items-center justify-between text-xs text-slate-500">
				<p>This secure portal is powered by {BRAND_NAME}. Your responses are encrypted in transit.</p>
				<p>{BRAND_TAGLINE}</p>
			</div>
		</div>
	</footer>
</div>
