<script lang="ts">
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
	<!-- Vendor Portal Header -->
	<header class="bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-3">
					<div
						class="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center"
					>
						<i class="fa-solid fa-shield-halved text-white text-lg"></i>
					</div>
					<div>
						<h1 class="text-lg font-bold text-gray-900">Security Assessment Portal</h1>
						<p class="text-xs text-gray-500">Powered by CISO Assistant</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<span class="text-xs text-gray-400">
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
	<footer class="bg-white border-t border-gray-200 mt-auto">
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex items-center justify-between text-xs text-gray-400">
				<p>This is a secure vendor assessment portal. Your responses are encrypted in transit.</p>
				<p>Powered by CISO Assistant</p>
			</div>
		</div>
	</footer>
</div>
