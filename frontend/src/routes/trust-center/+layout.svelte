<script lang="ts">
	import Logo from '$lib/components/Logo/Logo.svelte';
	import { BRAND_NAME, BRAND_TAGLINE } from '$lib/brand';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="brand-shell-light min-h-screen">
	<!-- Public Header -->
	<header class="sticky top-0 z-20 border-b border-slate-200/80 bg-white/88 shadow-[0_20px_45px_rgb(11_31_42_/_0.08)] backdrop-blur-xl">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<a href="/trust-center" class="flex items-center space-x-4">
						<Logo theme="dark" width={158} className="h-auto w-[158px]" />
						<div>
							<h1 class="text-xl font-semibold text-slate-950">{BRAND_NAME} Trust Center</h1>
							<p class="text-sm text-slate-500">FedRAMP authorization transparency</p>
						</div>
					</a>
				</div>
				<div class="flex items-center space-x-4">
					<a
						href="https://www.fedramp.gov"
						target="_blank"
						rel="noopener noreferrer"
						class="brand-chip hover:bg-white"
					>
						<i class="fa-solid fa-external-link mr-1"></i>
						FedRAMP.gov
					</a>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{@render children?.()}
	</main>

	<!-- Footer -->
	<footer class="mt-auto border-t border-slate-200/80 bg-white/86 backdrop-blur-xl">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex items-center justify-between text-sm text-slate-500">
				<p>Powered by {BRAND_NAME}</p>
				<p>{BRAND_TAGLINE}</p>
			</div>
		</div>
	</footer>
</div>
