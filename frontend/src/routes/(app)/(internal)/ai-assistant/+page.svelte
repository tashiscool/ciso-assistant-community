<script lang="ts">
	import { AIAuthorPanel, DocumentUploader, AuditPanel, ExplainerPanel } from '$lib/components/AIAssistant';

	let activeTab = $state<'author' | 'extractor' | 'auditor' | 'explainer'>('author');

	const tabs = [
		{
			id: 'author',
			label: 'AI Author',
			icon: 'fa-pen-fancy',
			description: 'Draft controls, policies, and SSP narratives'
		},
		{
			id: 'extractor',
			label: 'AI Extractor',
			icon: 'fa-file-import',
			description: 'Extract controls from documents'
		},
		{
			id: 'auditor',
			label: 'AI Auditor',
			icon: 'fa-clipboard-check',
			description: 'Evaluate controls and perform gap analysis'
		},
		{
			id: 'explainer',
			label: 'AI Explainer',
			icon: 'fa-comment-dots',
			description: 'Generate role-appropriate explanations'
		}
	] as const;
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">AI Assistant</h1>
			<p class="text-gray-600 mt-1">
				Leverage AI to accelerate compliance documentation and analysis
			</p>
		</div>
		<div class="flex items-center gap-2 text-sm text-gray-500">
			<i class="fa-solid fa-robot text-primary-600"></i>
			<span>Powered by LLM</span>
		</div>
	</div>

	<!-- Tab Navigation -->
	<div class="bg-white rounded-lg shadow">
		<div class="border-b">
			<nav class="flex -mb-px">
				{#each tabs as tab}
					<button
						onclick={() => (activeTab = tab.id)}
						class="flex-1 px-6 py-4 text-center border-b-2 transition-colors {activeTab === tab.id
							? 'border-primary-600 text-primary-600 bg-primary-50'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'}"
					>
						<i class="fa-solid {tab.icon} text-xl mb-1"></i>
						<div class="font-medium">{tab.label}</div>
						<div class="text-xs text-gray-500 mt-1">{tab.description}</div>
					</button>
				{/each}
			</nav>
		</div>
	</div>

	<!-- AI Features Info Banner -->
	<div class="bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg p-4 border border-primary-100">
		<div class="flex items-start gap-4">
			<div class="p-3 bg-white rounded-lg shadow-sm">
				<i class="fa-solid fa-lightbulb text-2xl text-yellow-500"></i>
			</div>
			<div class="flex-1">
				<h3 class="font-medium text-gray-900">AI-Powered Compliance Assistance</h3>
				<p class="text-sm text-gray-600 mt-1">
					{#if activeTab === 'author'}
						The AI Author helps you draft control implementation statements, policy sections,
						procedures, and SSP narratives based on compliance requirements and best practices.
					{:else if activeTab === 'extractor'}
						The AI Extractor analyzes uploaded documents (PDF, Word) to automatically identify
						and extract controls, requirements, and policy statements that can be imported into your assessments.
					{:else if activeTab === 'auditor'}
						The AI Auditor evaluates your control implementations for effectiveness, identifies
						compliance gaps, and reviews evidence adequacy against requirements.
					{:else if activeTab === 'explainer'}
						The AI Explainer translates complex security concepts and controls into clear,
						role-appropriate explanations for executives, auditors, engineers, or end users.
					{/if}
				</p>
			</div>
			<div class="text-xs text-gray-400">
				<i class="fa-solid fa-info-circle mr-1"></i>
				Results should be reviewed before use
			</div>
		</div>
	</div>

	<!-- Tab Content -->
	<div>
		{#if activeTab === 'author'}
			<AIAuthorPanel />
		{:else if activeTab === 'extractor'}
			<DocumentUploader />
		{:else if activeTab === 'auditor'}
			<AuditPanel />
		{:else if activeTab === 'explainer'}
			<ExplainerPanel />
		{/if}
	</div>

	<!-- Tips Section -->
	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-medium text-gray-900 mb-4">
			<i class="fa-solid fa-graduation-cap mr-2 text-primary-600"></i>
			Tips for Best Results
		</h3>

		<div class="grid grid-cols-2 gap-6">
			<div class="space-y-3">
				<div class="flex items-start gap-3">
					<div class="p-2 bg-green-100 rounded">
						<i class="fa-solid fa-check text-green-600"></i>
					</div>
					<div>
						<h4 class="font-medium text-gray-900">Be Specific</h4>
						<p class="text-sm text-gray-600">
							Provide detailed context and requirements for more accurate results
						</p>
					</div>
				</div>

				<div class="flex items-start gap-3">
					<div class="p-2 bg-green-100 rounded">
						<i class="fa-solid fa-check text-green-600"></i>
					</div>
					<div>
						<h4 class="font-medium text-gray-900">Select the Right Framework</h4>
						<p class="text-sm text-gray-600">
							Choose the framework that matches your compliance requirements
						</p>
					</div>
				</div>

				<div class="flex items-start gap-3">
					<div class="p-2 bg-green-100 rounded">
						<i class="fa-solid fa-check text-green-600"></i>
					</div>
					<div>
						<h4 class="font-medium text-gray-900">Review and Customize</h4>
						<p class="text-sm text-gray-600">
							AI-generated content is a starting point - always review and customize for your environment
						</p>
					</div>
				</div>
			</div>

			<div class="space-y-3">
				<div class="flex items-start gap-3">
					<div class="p-2 bg-blue-100 rounded">
						<i class="fa-solid fa-lightbulb text-blue-600"></i>
					</div>
					<div>
						<h4 class="font-medium text-gray-900">Use for Drafting</h4>
						<p class="text-sm text-gray-600">
							AI excels at creating initial drafts that save time on documentation
						</p>
					</div>
				</div>

				<div class="flex items-start gap-3">
					<div class="p-2 bg-blue-100 rounded">
						<i class="fa-solid fa-lightbulb text-blue-600"></i>
					</div>
					<div>
						<h4 class="font-medium text-gray-900">Iterative Refinement</h4>
						<p class="text-sm text-gray-600">
							Use the improve text feature to refine and enhance existing content
						</p>
					</div>
				</div>

				<div class="flex items-start gap-3">
					<div class="p-2 bg-blue-100 rounded">
						<i class="fa-solid fa-lightbulb text-blue-600"></i>
					</div>
					<div>
						<h4 class="font-medium text-gray-900">Match Your Audience</h4>
						<p class="text-sm text-gray-600">
							Select the appropriate audience for explanations to ensure they resonate
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
