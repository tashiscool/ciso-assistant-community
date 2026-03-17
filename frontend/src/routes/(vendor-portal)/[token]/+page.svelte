<script lang="ts">
	import { page } from '$app/stores';

	// State
	let loading = $state(true);
	let errorMessage = $state('');
	let questionnaire: any = $state(null);
	let answers: Record<string, any> = $state({});
	let currentCategoryIndex = $state(0);
	let submitting = $state(false);
	let submitted = $state(false);
	let submitResult: any = $state(null);
	let uploadingEvidence = $state(false);
	let evidenceFiles: Array<{ name: string; id: string }> = $state([]);

	const token = $derived($page.params.token);
	const categories = $derived(questionnaire?.categories || []);
	const currentCategory = $derived(categories[currentCategoryIndex] || null);
	const totalQuestions = $derived(questionnaire?.total_questions || 0);

	const answeredCount = $derived(
		Object.values(answers).filter((v) => v !== null && v !== undefined && v !== '').length
	);

	const progressPercent = $derived(
		totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
	);

	const isLastCategory = $derived(currentCategoryIndex >= categories.length - 1);
	const isFirstCategory = $derived(currentCategoryIndex === 0);

	// Load questionnaire on mount
	$effect(() => {
		if (token) {
			loadQuestionnaire();
		}
	});

	async function loadQuestionnaire() {
		loading = true;
		errorMessage = '';

		try {
			const response = await fetch(`/api/vendor-portal/${token}/questionnaire/`);

			if (!response.ok) {
				if (response.status === 401 || response.status === 403) {
					errorMessage =
						'This link has expired or is no longer valid. Please contact your assessment manager for a new link.';
				} else if (response.status === 404) {
					errorMessage =
						'No questionnaire found for this link. It may have been completed already.';
				} else {
					errorMessage = 'Unable to load the questionnaire. Please try again later.';
				}
				return;
			}

			questionnaire = await response.json();

			// Initialize answers for all questions
			for (const category of questionnaire.categories || []) {
				for (const question of category.questions || []) {
					if (answers[question.id] === undefined) {
						answers[question.id] = null;
					}
				}
			}
		} catch {
			errorMessage = 'Network error. Please check your connection and try again.';
		} finally {
			loading = false;
		}
	}

	function nextCategory() {
		if (currentCategoryIndex < categories.length - 1) {
			currentCategoryIndex++;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function prevCategory() {
		if (currentCategoryIndex > 0) {
			currentCategoryIndex--;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function goToCategory(index: number) {
		currentCategoryIndex = index;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function saveDraft() {
		submitting = true;
		try {
			const response = await fetch(`/api/vendor-portal/${token}/questionnaire/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					answers: answers,
					is_partial: true
				})
			});

			if (response.ok) {
				submitResult = { success: true, message: 'Draft saved successfully.' };
			}
		} catch {
			submitResult = { success: false, message: 'Failed to save draft.' };
		} finally {
			submitting = false;
		}
	}

	async function submitQuestionnaire() {
		// Validate required questions
		const unansweredRequired: string[] = [];
		for (const category of categories) {
			for (const question of category.questions || []) {
				if (
					question.required &&
					(answers[question.id] === null ||
						answers[question.id] === undefined ||
						answers[question.id] === '')
				) {
					unansweredRequired.push(question.text);
				}
			}
		}

		if (unansweredRequired.length > 0) {
			submitResult = {
				success: false,
				message: `Please answer all required questions. ${unansweredRequired.length} required question(s) remain unanswered.`
			};
			return;
		}

		submitting = true;
		submitResult = null;

		try {
			const response = await fetch(`/api/vendor-portal/${token}/questionnaire/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					answers: answers,
					is_partial: false
				})
			});

			const data = await response.json();

			if (response.ok && data.is_completed) {
				submitted = true;
				submitResult = {
					success: true,
					message:
						'Your responses have been submitted successfully. Thank you for completing this assessment.'
				};
			} else if (data.validation_errors) {
				const errorCount = Object.keys(data.validation_errors).length;
				submitResult = {
					success: false,
					message: `Submission has ${errorCount} validation error(s). Please review and correct your responses.`
				};
			} else {
				submitResult = {
					success: false,
					message: 'Submission failed. Please try again.'
				};
			}
		} catch {
			submitResult = {
				success: false,
				message: 'Network error during submission. Please try again.'
			};
		} finally {
			submitting = false;
		}
	}

	async function uploadEvidence(questionId: string) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.pdf,.doc,.docx,.xlsx,.xls,.csv,.txt,.png,.jpg,.zip';

		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;

			uploadingEvidence = true;
			const formData = new FormData();
			formData.append('file', file);
			formData.append('question_id', questionId);
			formData.append('description', `Evidence for question: ${questionId}`);

			try {
				const response = await fetch(`/api/vendor-portal/${token}/evidence/`, {
					method: 'POST',
					body: formData
				});

				if (response.ok) {
					const result = await response.json();
					evidenceFiles = [
						...evidenceFiles,
						{ name: file.name, id: result.evidence?.id || 'uploaded' }
					];
				}
			} catch {
				// Silently fail for evidence upload
			} finally {
				uploadingEvidence = false;
			}
		};

		input.click();
	}
</script>

{#if loading}
	<div class="brand-card px-6 py-20 text-center">
		<div
			class="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[rgb(88_181_255_/_0.12)] text-[var(--rv-blue)]"
		>
			<i class="fa-solid fa-spinner fa-spin text-3xl"></i>
		</div>
		<p class="mt-4 text-sm text-slate-500">Loading your assessment...</p>
	</div>
{:else if errorMessage}
	<div class="brand-card mx-auto max-w-2xl px-6 py-16 text-center">
		<div
			class="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-rose-100 text-rose-600"
		>
			<i class="fa-solid fa-exclamation-triangle text-2xl"></i>
		</div>
		<h2 class="mt-4 text-2xl font-semibold text-slate-950">Unable to load assessment</h2>
		<p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{errorMessage}</p>
		<button class="btn btn-mini-primary mt-6 px-6 py-2.5" onclick={loadQuestionnaire}>
			Try Again
		</button>
	</div>
{:else if submitted}
	<div class="brand-card mx-auto max-w-2xl px-6 py-16 text-center">
		<div class="brand-icon-badge mx-auto h-16 w-16 rounded-[20px] text-2xl">
			<i class="fa-solid fa-check"></i>
		</div>
		<h2 class="mt-5 text-3xl font-semibold text-slate-950">Assessment complete</h2>
		<p class="mt-3 text-sm leading-6 text-slate-600">
			Thank you for completing this security assessment. Your responses have been securely submitted
			and routed back through the Regovise evidence workflow.
		</p>
		<p class="mt-2 text-sm leading-6 text-slate-500">
			The requesting organization will review your submission and may contact you if additional
			information is needed.
		</p>
		{#if evidenceFiles.length > 0}
			<div class="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-left">
				<h3 class="text-sm font-semibold text-slate-900">
					Uploaded evidence ({evidenceFiles.length} files)
				</h3>
				<div class="mt-3 space-y-2">
					{#each evidenceFiles as file}
						<div class="flex items-center gap-2 text-sm text-slate-500">
							<i class="fa-solid fa-paperclip text-[var(--rv-blue)]"></i>
							{file.name}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{:else if questionnaire}
	<div class="space-y-6">
		<div class="brand-card-dark overflow-hidden px-6 py-8 sm:px-8">
			<div class="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
				<div>
					<p class="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
						Vendor trust workflow
					</p>
					<h2 class="mt-3 text-3xl font-semibold tracking-tight text-white">
						{questionnaire.title}
					</h2>
					<p class="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
						{questionnaire.description}
					</p>
					{#if questionnaire.vendor}
						<div class="mt-5 flex flex-wrap gap-3 text-xs text-slate-200">
							<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2">
								<i class="fa-solid fa-building mr-2 text-[var(--rv-teal)]"></i>
								{questionnaire.vendor.name}
							</span>
							<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2">
								<i class="fa-solid fa-clock mr-2 text-[var(--rv-blue)]"></i>
								Est. {questionnaire.estimated_duration_minutes} minutes
							</span>
							<span class="rounded-full border border-white/10 bg-white/8 px-3 py-2">
								<i class="fa-solid fa-list-check mr-2 text-[var(--rv-teal)]"></i>
								{totalQuestions} questions
							</span>
						</div>
					{/if}
				</div>
				<div class="rounded-[28px] border border-white/12 bg-white/8 p-6">
					<div class="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
						Completion
					</div>
					<div class="mt-3 text-5xl font-semibold text-white">{progressPercent}%</div>
					<p class="mt-2 text-sm text-slate-300">
						{answeredCount} of {totalQuestions} questions answered so far.
					</p>
					<div class="mt-5 h-2.5 w-full rounded-full bg-white/12">
						<div
							class="h-2.5 rounded-full bg-[linear-gradient(90deg,var(--rv-teal),var(--rv-blue))] transition-all duration-500"
							style={`width: ${progressPercent}%`}
						></div>
					</div>
				</div>
			</div>
		</div>

		<div class="brand-card p-5">
			<div class="flex items-center justify-between gap-4">
				<div class="text-sm font-medium text-slate-600">
					Progress: {answeredCount} of {totalQuestions} questions answered
				</div>
				<div class="text-sm font-semibold text-[var(--rv-blue)]">{progressPercent}% complete</div>
			</div>
			<div class="mt-3 h-3 w-full rounded-full bg-slate-100">
				<div
					class="h-3 rounded-full bg-[linear-gradient(90deg,var(--rv-teal),var(--rv-blue))] transition-all duration-500"
					style={`width: ${progressPercent}%`}
				></div>
			</div>
		</div>

		<div class="flex gap-2 overflow-x-auto pb-2">
			{#each categories as category, idx}
				{@const categoryQuestions = category.questions || []}
				{@const categoryAnswered = categoryQuestions.filter(
					(q: any) => answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== ''
				).length}
				<button
					class={`flex-shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${
						idx === currentCategoryIndex
							? 'border-[var(--rv-midnight)] bg-[var(--rv-midnight)] text-white shadow-[var(--rv-shadow-glow)]'
							: categoryAnswered === categoryQuestions.length && categoryQuestions.length > 0
								? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
					}`}
					onclick={() => goToCategory(idx)}
				>
					{#if categoryAnswered === categoryQuestions.length && categoryQuestions.length > 0}
						<i class="fa-solid fa-check mr-1"></i>
					{/if}
					{category.name}
					<span class="ml-1 opacity-65">({categoryAnswered}/{categoryQuestions.length})</span>
				</button>
			{/each}
		</div>

		{#if submitResult}
			<div
				class={`rounded-[20px] border p-4 ${
					submitResult.success
						? 'border-emerald-200 bg-emerald-50 text-emerald-800'
						: 'border-rose-200 bg-rose-50 text-rose-800'
				}`}
			>
				<div class="flex items-center gap-2 text-sm">
					<i
						class={`fa-solid ${submitResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`}
					></i>
					<span>{submitResult.message}</span>
				</div>
			</div>
		{/if}

		{#if currentCategory}
			<div class="brand-card overflow-hidden">
				<div class="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
					<h3 class="text-lg font-semibold text-slate-950">{currentCategory.name}</h3>
					<p class="mt-1 text-xs text-slate-500">
						Section {currentCategoryIndex + 1} of {categories.length}
					</p>
				</div>

				<div class="divide-y divide-slate-100">
					{#each currentCategory.questions || [] as question, qIdx}
						<div class="px-6 py-5">
							<div class="flex items-start gap-4">
								<span
									class="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500"
								>
									{qIdx + 1}
								</span>
								<div class="flex-1 space-y-3">
									<div>
										<label for="q-{question.id}" class="text-sm font-semibold text-slate-900">
											{question.text}
											{#if question.required}
												<span class="ml-0.5 text-rose-500">*</span>
											{/if}
										</label>
										{#if question.help_text}
											<p class="mt-1 text-xs leading-5 text-slate-400">{question.help_text}</p>
										{/if}
									</div>

									{#if question.type === 'yes_no'}
										<div class="flex flex-wrap gap-3">
											<button
												class={`rounded-[16px] border px-4 py-2 text-sm font-semibold transition ${
													answers[question.id] === 'yes'
														? 'border-emerald-300 bg-emerald-100 text-emerald-900'
														: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
												}`}
												onclick={() => (answers[question.id] = 'yes')}
											>
												<i class="fa-solid fa-check mr-1"></i> Yes
											</button>
											<button
												class={`rounded-[16px] border px-4 py-2 text-sm font-semibold transition ${
													answers[question.id] === 'no'
														? 'border-rose-300 bg-rose-100 text-rose-900'
														: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
												}`}
												onclick={() => (answers[question.id] = 'no')}
											>
												<i class="fa-solid fa-xmark mr-1"></i> No
											</button>
										</div>
									{:else if question.type === 'text' || question.type === 'textarea'}
										<textarea
											id="q-{question.id}"
											class="textarea w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm"
											rows="3"
											placeholder="Enter your response..."
											bind:value={answers[question.id]}
										></textarea>
									{:else if question.type === 'single_choice' || question.type === 'select'}
										<div class="space-y-2">
											{#each question.options || [] as option}
												<label
													class={`flex cursor-pointer items-center gap-3 rounded-[18px] border p-3 transition ${
														answers[question.id] === (option.value || option)
															? 'border-[rgb(88_181_255_/_0.24)] bg-[rgb(88_181_255_/_0.08)]'
															: 'border-slate-200 bg-white hover:bg-slate-50'
													}`}
												>
													<input
														type="radio"
														name="q-{question.id}"
														value={option.value || option}
														class="text-[var(--rv-blue)] focus:ring-[var(--rv-blue)]"
														checked={answers[question.id] === (option.value || option)}
														onchange={() => (answers[question.id] = option.value || option)}
													/>
													<span class="text-sm text-slate-700">{option.label || option}</span>
												</label>
											{/each}
										</div>
									{:else if question.type === 'number'}
										<input
											type="number"
											id="q-{question.id}"
											class="input w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm"
											placeholder="Enter a number..."
											bind:value={answers[question.id]}
										/>
									{:else if question.type === 'date'}
										<input
											type="date"
											id="q-{question.id}"
											class="input w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm"
											bind:value={answers[question.id]}
										/>
									{:else}
										<input
											type="text"
											id="q-{question.id}"
											class="input w-full rounded-[18px] border border-slate-200 px-4 py-3 text-sm"
											placeholder="Enter your response..."
											bind:value={answers[question.id]}
										/>
									{/if}

									<div class="flex items-center gap-2">
										<button
											class="text-xs font-medium text-slate-400 transition hover:text-[var(--rv-blue)]"
											onclick={() => uploadEvidence(question.id)}
											disabled={uploadingEvidence}
										>
											<i class="fa-solid fa-paperclip mr-1"></i>
											{uploadingEvidence ? 'Uploading...' : 'Attach evidence'}
										</button>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<button
				class={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
					isFirstCategory
						? 'cursor-not-allowed bg-slate-100 text-slate-400'
						: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
				}`}
				disabled={isFirstCategory}
				onclick={prevCategory}
			>
				<i class="fa-solid fa-arrow-left mr-2"></i>
				Previous section
			</button>

			<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
				<button
					class="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					disabled={submitting}
					onclick={saveDraft}
				>
					<i class="fa-solid fa-floppy-disk mr-2"></i>
					Save draft
				</button>

				{#if isLastCategory}
					<button
						class="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
						disabled={submitting}
						onclick={submitQuestionnaire}
					>
						{#if submitting}
							<i class="fa-solid fa-spinner fa-spin mr-2"></i>
							Submitting...
						{:else}
							<i class="fa-solid fa-paper-plane mr-2"></i>
							Submit assessment
						{/if}
					</button>
				{:else}
					<button
						class="rounded-full bg-[var(--rv-midnight)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--rv-shadow-glow)] transition hover:-translate-y-0.5"
						onclick={nextCategory}
					>
						Next section
						<i class="fa-solid fa-arrow-right ml-2"></i>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
