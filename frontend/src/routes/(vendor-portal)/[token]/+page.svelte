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
					errorMessage = 'No questionnaire found for this link. It may have been completed already.';
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
					message: 'Your responses have been submitted successfully. Thank you for completing this assessment.'
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

<!-- Loading state -->
{#if loading}
	<div class="flex flex-col items-center justify-center py-20">
		<div
			class="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mb-4"
		></div>
		<p class="text-gray-500">Loading your assessment...</p>
	</div>

<!-- Error state -->
{:else if errorMessage}
	<div class="max-w-lg mx-auto text-center py-20">
		<div
			class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center"
		>
			<i class="fa-solid fa-exclamation-triangle text-2xl text-red-500"></i>
		</div>
		<h2 class="text-xl font-semibold text-gray-900 mb-2">Unable to Load Assessment</h2>
		<p class="text-gray-500 mb-6">{errorMessage}</p>
		<button
			class="px-6 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
			onclick={loadQuestionnaire}
		>
			Try Again
		</button>
	</div>

<!-- Submitted state -->
{:else if submitted}
	<div class="max-w-lg mx-auto text-center py-20">
		<div
			class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center"
		>
			<i class="fa-solid fa-check-circle text-3xl text-green-500"></i>
		</div>
		<h2 class="text-2xl font-bold text-gray-900 mb-2">Assessment Complete</h2>
		<p class="text-gray-500 mb-2">
			Thank you for completing this security assessment.
		</p>
		<p class="text-sm text-gray-400">
			Your responses have been securely submitted. The requesting organization will
			review your submission and may contact you if additional information is needed.
		</p>
		{#if evidenceFiles.length > 0}
			<div class="mt-6 p-4 bg-gray-50 rounded-lg text-left">
				<h3 class="text-sm font-medium text-gray-700 mb-2">
					Uploaded Evidence ({evidenceFiles.length} files)
				</h3>
				{#each evidenceFiles as file}
					<div class="text-xs text-gray-500 flex items-center gap-1 py-1">
						<i class="fa-solid fa-paperclip"></i>
						{file.name}
					</div>
				{/each}
			</div>
		{/if}
	</div>

<!-- Questionnaire form -->
{:else if questionnaire}
	<div class="space-y-6">
		<!-- Questionnaire header -->
		<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
			<h2 class="text-xl font-bold text-gray-900">{questionnaire.title}</h2>
			<p class="text-sm text-gray-500 mt-1">{questionnaire.description}</p>
			{#if questionnaire.vendor}
				<div class="mt-3 flex items-center gap-4 text-xs text-gray-400">
					<span>
						<i class="fa-solid fa-building mr-1"></i>
						{questionnaire.vendor.name}
					</span>
					<span>
						<i class="fa-solid fa-clock mr-1"></i>
						Est. {questionnaire.estimated_duration_minutes} minutes
					</span>
					<span>
						<i class="fa-solid fa-list mr-1"></i>
						{totalQuestions} questions
					</span>
				</div>
			{/if}
		</div>

		<!-- Progress bar -->
		<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
			<div class="flex items-center justify-between text-sm mb-2">
				<span class="font-medium text-gray-700">
					Progress: {answeredCount} of {totalQuestions} questions answered
				</span>
				<span class="text-violet-600 font-semibold">{progressPercent}%</span>
			</div>
			<div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
				<div
					class="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
					style="width: {progressPercent}%"
				></div>
			</div>
		</div>

		<!-- Category navigation -->
		<div class="flex gap-2 overflow-x-auto pb-2">
			{#each categories as category, idx}
				{@const categoryQuestions = category.questions || []}
				{@const categoryAnswered = categoryQuestions.filter(
					(q: any) =>
						answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== ''
				).length}
				<button
					class="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition-colors border
						{idx === currentCategoryIndex
						? 'bg-violet-600 text-white border-violet-600'
						: categoryAnswered === categoryQuestions.length && categoryQuestions.length > 0
							? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
							: 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}"
					onclick={() => goToCategory(idx)}
				>
					{#if categoryAnswered === categoryQuestions.length && categoryQuestions.length > 0}
						<i class="fa-solid fa-check mr-1"></i>
					{/if}
					{category.name}
					<span class="ml-1 opacity-60">({categoryAnswered}/{categoryQuestions.length})</span>
				</button>
			{/each}
		</div>

		<!-- Result banner -->
		{#if submitResult}
			<div
				class="p-4 rounded-lg border {submitResult.success
					? 'bg-green-50 border-green-200 text-green-800'
					: 'bg-red-50 border-red-200 text-red-800'}"
			>
				<div class="flex items-center gap-2 text-sm">
					<i
						class="fa-solid {submitResult.success
							? 'fa-check-circle'
							: 'fa-exclamation-circle'}"
					></i>
					<span>{submitResult.message}</span>
				</div>
			</div>
		{/if}

		<!-- Current category questions -->
		{#if currentCategory}
			<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
				<div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
					<h3 class="text-lg font-semibold text-gray-900">{currentCategory.name}</h3>
					<p class="text-xs text-gray-500 mt-0.5">
						Section {currentCategoryIndex + 1} of {categories.length}
					</p>
				</div>

				<div class="divide-y divide-gray-100">
					{#each currentCategory.questions || [] as question, qIdx}
						<div class="px-6 py-5">
							<div class="flex items-start gap-3">
								<span
									class="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium mt-0.5"
								>
									{qIdx + 1}
								</span>
								<div class="flex-1 space-y-3">
									<div>
										<label
											for="q-{question.id}"
											class="text-sm font-medium text-gray-800"
										>
											{question.text}
											{#if question.required}
												<span class="text-red-500 ml-0.5">*</span>
											{/if}
										</label>
										{#if question.help_text}
											<p class="text-xs text-gray-400 mt-1">{question.help_text}</p>
										{/if}
									</div>

									<!-- Yes/No questions -->
									{#if question.type === 'yes_no'}
										<div class="flex gap-3">
											<button
												class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors
													{answers[question.id] === 'yes'
													? 'bg-green-100 border-green-300 text-green-800'
													: 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}"
												onclick={() => (answers[question.id] = 'yes')}
											>
												<i class="fa-solid fa-check mr-1"></i> Yes
											</button>
											<button
												class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors
													{answers[question.id] === 'no'
													? 'bg-red-100 border-red-300 text-red-800'
													: 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}"
												onclick={() => (answers[question.id] = 'no')}
											>
												<i class="fa-solid fa-xmark mr-1"></i> No
											</button>
										</div>

									<!-- Text/Textarea questions -->
									{:else if question.type === 'text' || question.type === 'textarea'}
										<textarea
											id="q-{question.id}"
											class="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:border-violet-500 focus:ring-violet-500"
											rows="3"
											placeholder="Enter your response..."
											bind:value={answers[question.id]}
										></textarea>

									<!-- Single choice questions -->
									{:else if question.type === 'single_choice' || question.type === 'select'}
										<div class="space-y-2">
											{#each question.options || [] as option}
												<label
													class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
														{answers[question.id] === (option.value || option)
														? 'bg-violet-50 border-violet-300'
														: 'bg-white border-gray-200 hover:bg-gray-50'}"
												>
													<input
														type="radio"
														name="q-{question.id}"
														value={option.value || option}
														class="text-violet-600 focus:ring-violet-500"
														checked={answers[question.id] ===
															(option.value || option)}
														onchange={() =>
															(answers[question.id] =
																option.value || option)}
													/>
													<span class="text-sm text-gray-700">
														{option.label || option}
													</span>
												</label>
											{/each}
										</div>

									<!-- Number questions -->
									{:else if question.type === 'number'}
										<input
											type="number"
											id="q-{question.id}"
											class="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:border-violet-500 focus:ring-violet-500"
											placeholder="Enter a number..."
											bind:value={answers[question.id]}
										/>

									<!-- Date questions -->
									{:else if question.type === 'date'}
										<input
											type="date"
											id="q-{question.id}"
											class="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:border-violet-500 focus:ring-violet-500"
											bind:value={answers[question.id]}
										/>

									<!-- Fallback: text input -->
									{:else}
										<input
											type="text"
											id="q-{question.id}"
											class="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:border-violet-500 focus:ring-violet-500"
											placeholder="Enter your response..."
											bind:value={answers[question.id]}
										/>
									{/if}

									<!-- Evidence upload -->
									<div class="flex items-center gap-2">
										<button
											class="text-xs text-gray-400 hover:text-violet-600 transition-colors"
											onclick={() => uploadEvidence(question.id)}
											disabled={uploadingEvidence}
										>
											<i class="fa-solid fa-paperclip mr-1"></i>
											{uploadingEvidence ? 'Uploading...' : 'Attach evidence'}
										</button>
										{#each evidenceFiles.filter(() => true) as file}
											<!-- Evidence indicators would be filtered by question in production -->
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Navigation buttons -->
		<div class="flex items-center justify-between">
			<button
				class="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors
					{isFirstCategory
					? 'bg-gray-100 text-gray-400 cursor-not-allowed'
					: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}"
				disabled={isFirstCategory}
				onclick={prevCategory}
			>
				<i class="fa-solid fa-arrow-left mr-2"></i>
				Previous Section
			</button>

			<div class="flex items-center gap-3">
				<button
					class="px-5 py-2.5 rounded-lg text-sm font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
					disabled={submitting}
					onclick={saveDraft}
				>
					<i class="fa-solid fa-floppy-disk mr-2"></i>
					Save Draft
				</button>

				{#if isLastCategory}
					<button
						class="px-6 py-2.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 shadow-sm transition-colors"
						disabled={submitting}
						onclick={submitQuestionnaire}
					>
						{#if submitting}
							<i class="fa-solid fa-spinner fa-spin mr-2"></i>
							Submitting...
						{:else}
							<i class="fa-solid fa-paper-plane mr-2"></i>
							Submit Assessment
						{/if}
					</button>
				{:else}
					<button
						class="px-5 py-2.5 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 shadow-sm transition-colors"
						onclick={nextCategory}
					>
						Next Section
						<i class="fa-solid fa-arrow-right ml-2"></i>
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
