<script lang="ts">
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Public Header -->
	<header class="bg-white shadow-sm border-b">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<a href="/trust-center" class="flex items-center space-x-3">
						<i class="fa-solid fa-shield-halved text-2xl text-primary-600"></i>
						<div>
							<h1 class="text-xl font-bold text-gray-900">FedRAMP Trust Center</h1>
							<p class="text-sm text-gray-500">Authorization Status Portal</p>
						</div>
					</a>
				</div>
				<div class="flex items-center space-x-4">
					<a
						href="https://www.fedramp.gov"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-gray-500 hover:text-gray-700"
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
	<footer class="bg-white border-t mt-auto">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex items-center justify-between text-sm text-gray-500">
				<p>Powered by CISO Assistant</p>
				<p>FedRAMP 20x Trust Center</p>
			</div>
		</div>
	</footer>
</div>
