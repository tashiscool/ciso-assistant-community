<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	export interface WorkflowStep {
		id: string;
		title: string;
		description?: string;
		status: 'pending' | 'active' | 'completed' | 'skipped' | 'error';
		optional?: boolean;
		substeps?: WorkflowSubstep[];
		action?: {
			label: string;
			href?: string;
			onClick?: () => void;
		};
		completedAt?: string;
		metadata?: Record<string, any>;
	}

	export interface WorkflowSubstep {
		id: string;
		title: string;
		completed: boolean;
		href?: string;
	}

	interface Props {
		title?: string;
		description?: string;
		steps?: WorkflowStep[];
		currentStepId?: string;
		showProgress?: boolean;
		orientation?: 'horizontal' | 'vertical';
		allowSkip?: boolean;
		onStepClick?: (step: WorkflowStep) => void;
		onStepComplete?: (stepId: string) => void;
		onStepSkip?: (stepId: string) => void;
	}

	let {
		title = 'Workflow',
		description = '',
		steps = [],
		currentStepId = '',
		showProgress = true,
		orientation = 'vertical',
		allowSkip = false,
		onStepClick = () => {},
		onStepComplete = () => {},
		onStepSkip = () => {}
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let expandedSteps = $state<Set<string>>(new Set());

	function toggleStep(stepId: string) {
		const newSet = new Set(expandedSteps);
		if (newSet.has(stepId)) {
			newSet.delete(stepId);
		} else {
			newSet.add(stepId);
		}
		expandedSteps = newSet;
	}

	function handleStepClick(step: WorkflowStep) {
		onStepClick(step);
		dispatch('stepClick', step);
	}

	function handleComplete(stepId: string) {
		onStepComplete(stepId);
		dispatch('stepComplete', stepId);
	}

	function handleSkip(stepId: string) {
		onStepSkip(stepId);
		dispatch('stepSkip', stepId);
	}

	function getCompletedCount(): number {
		return steps.filter(s => s.status === 'completed').length;
	}

	function getProgressPercentage(): number {
		if (steps.length === 0) return 0;
		return Math.round((getCompletedCount() / steps.length) * 100);
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'completed':
				return 'fa-check';
			case 'active':
				return 'fa-circle';
			case 'error':
				return 'fa-exclamation';
			case 'skipped':
				return 'fa-forward';
			default:
				return 'fa-circle-notch';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'completed':
				return 'bg-success-500 text-white';
			case 'active':
				return 'bg-primary-500 text-white animate-pulse';
			case 'error':
				return 'bg-error-500 text-white';
			case 'skipped':
				return 'bg-surface-400 text-white';
			default:
				return 'bg-surface-200 text-surface-500 dark:bg-surface-700';
		}
	}

	function getLineColor(status: string): string {
		switch (status) {
			case 'completed':
				return 'bg-success-500';
			case 'active':
				return 'bg-primary-300';
			default:
				return 'bg-surface-200 dark:bg-surface-700';
		}
	}
</script>

<div class="wayfinder-workflow" class:horizontal={orientation === 'horizontal'}>
	<!-- Header -->
	<div class="workflow-header mb-6">
		<h2 class="text-xl font-semibold">{title}</h2>
		{#if description}
			<p class="text-surface-500 mt-1">{description}</p>
		{/if}

		<!-- Progress Bar -->
		{#if showProgress}
			<div class="progress-bar mt-4">
				<div class="flex justify-between text-sm mb-1">
					<span class="text-surface-500">Progress</span>
					<span class="font-medium">{getCompletedCount()}/{steps.length} completed ({getProgressPercentage()}%)</span>
				</div>
				<div class="h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
					<div
						class="h-full bg-primary-500 transition-all duration-300"
						style="width: {getProgressPercentage()}%"
					></div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Steps -->
	<div class="workflow-steps" class:flex={orientation === 'horizontal'} class:gap-4={orientation === 'horizontal'}>
		{#each steps as step, index (step.id)}
			<div
				class="workflow-step relative"
				class:flex-1={orientation === 'horizontal'}
				transition:fade
			>
				<!-- Connector Line (vertical) -->
				{#if orientation === 'vertical' && index > 0}
					<div
						class="connector-line absolute left-4 -top-2 w-0.5 h-4 {getLineColor(steps[index - 1].status)}"
					></div>
				{/if}

				<!-- Step Content -->
				<div
					class="step-content flex gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md {step.id === currentStepId ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-surface-200 dark:border-surface-700'}"
					onclick={() => handleStepClick(step)}
					onkeydown={(e) => e.key === 'Enter' && handleStepClick(step)}
					role="button"
					tabindex="0"
				>
					<!-- Step Number/Icon -->
					<div class="flex-shrink-0">
						<div
							class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium {getStatusColor(step.status)}"
						>
							{#if step.status === 'completed' || step.status === 'error' || step.status === 'skipped'}
								<i class="fa-solid {getStatusIcon(step.status)}"></i>
							{:else}
								{index + 1}
							{/if}
						</div>
					</div>

					<!-- Step Info -->
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<h3 class="font-medium">{step.title}</h3>
							{#if step.optional}
								<span class="text-xs px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-surface-500">
									Optional
								</span>
							{/if}
						</div>

						{#if step.description}
							<p class="text-sm text-surface-500 mt-1">{step.description}</p>
						{/if}

						<!-- Substeps -->
						{#if step.substeps && step.substeps.length > 0}
							<button
								class="text-sm text-primary-500 mt-2 flex items-center gap-1"
								onclick={(e) => { e.stopPropagation(); toggleStep(step.id); }}
							>
								<i class="fa-solid fa-chevron-{expandedSteps.has(step.id) ? 'up' : 'down'}"></i>
								{step.substeps.filter(s => s.completed).length}/{step.substeps.length} tasks
							</button>

							{#if expandedSteps.has(step.id)}
								<div class="substeps mt-2 ml-2 space-y-1" transition:slide>
									{#each step.substeps as substep (substep.id)}
										<div class="flex items-center gap-2 text-sm">
											<i
												class="fa-{substep.completed ? 'solid fa-check-circle text-success-500' : 'regular fa-circle text-surface-400'}"
											></i>
											{#if substep.href}
												<a href={substep.href} class="text-primary-500 hover:underline">
													{substep.title}
												</a>
											{:else}
												<span class:line-through={substep.completed} class:text-surface-400={substep.completed}>
													{substep.title}
												</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						{/if}

						<!-- Action Button -->
						{#if step.action && step.status !== 'completed'}
							<div class="mt-3">
								{#if step.action.href}
									<a
										href={step.action.href}
										class="btn btn-sm variant-filled-primary"
										onclick={(e) => e.stopPropagation()}
									>
										{step.action.label}
									</a>
								{:else if step.action.onClick}
									<button
										class="btn btn-sm variant-filled-primary"
										onclick={(e) => { e.stopPropagation(); step.action.onClick(); }}
									>
										{step.action.label}
									</button>
								{/if}
							</div>
						{/if}

						<!-- Completed timestamp -->
						{#if step.completedAt}
							<p class="text-xs text-surface-400 mt-2">
								Completed {new Date(step.completedAt).toLocaleString()}
							</p>
						{/if}
					</div>

					<!-- Actions -->
					{#if step.status === 'active' || (step.status === 'pending' && allowSkip)}
						<div class="flex-shrink-0 flex gap-2">
							{#if step.status === 'active'}
								<button
									class="btn btn-sm variant-ghost-success"
									onclick={(e) => { e.stopPropagation(); handleComplete(step.id); }}
									title="Mark as complete"
								>
									<i class="fa-solid fa-check"></i>
								</button>
							{/if}
							{#if allowSkip && step.optional}
								<button
									class="btn btn-sm variant-ghost-surface"
									onclick={(e) => { e.stopPropagation(); handleSkip(step.id); }}
									title="Skip this step"
								>
									<i class="fa-solid fa-forward"></i>
								</button>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Connector Line (horizontal) -->
				{#if orientation === 'horizontal' && index < steps.length - 1}
					<div
						class="connector-horizontal absolute top-1/2 -right-2 w-4 h-0.5 {getLineColor(step.status)}"
					></div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.wayfinder-workflow {
		width: 100%;
	}

	.workflow-step {
		transition: transform 0.2s;
	}

	.step-content:hover {
		transform: translateX(4px);
	}

	.horizontal .step-content:hover {
		transform: translateY(-4px);
	}

	.connector-line {
		z-index: 0;
	}

	.connector-horizontal {
		z-index: 0;
	}

	.substeps {
		border-left: 2px solid rgb(var(--color-surface-300));
		padding-left: 0.5rem;
	}

	:global(.dark) .substeps {
		border-left-color: rgb(var(--color-surface-600));
	}
</style>
