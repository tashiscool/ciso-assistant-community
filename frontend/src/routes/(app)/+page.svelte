<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		CloudflareApiError,
		createCommand,
		createSignedUploadUrl,
		getApiCatalog,
		getApiHealth,
		getJob,
		getParityChecklist,
		getParityCoverage,
		readProjection,
		uploadToSignedUrl
	} from '$lib/cloudflare/client';
	import type {
		ApiCatalogResponse,
		JobResponse,
		ParityChecklistCommand,
		ParityChecklistResponse,
		ParityCoverageResponse,
		ProjectionName,
		SignedUploadRequest,
		SupportedCommandType
	} from '$lib/cloudflare/types';

	const BOOLEAN_FIELD_PATTERN = /^(is_|has_|can_|enabled|active|public|required|allow_)/i;
	const NUMBER_FIELD_PATTERN = /(count|score|percent|percentage|minutes|days|hours|size|duration|cost|version)$/i;
	const ID_FIELDS = [
		'record_id',
		'id',
		'entity_id',
		'run_id',
		'assessment_id',
		'snapshot_id',
		'ingest_job_id',
		'execution_id',
		'oscal_job_id',
		'activity_id',
		'poam_item_id',
		'ai_job_id',
		'scoring_id',
		'questionnaire_id',
		'library_job_id',
		'mapping_job_id',
		'sync_job_id',
		'translation_job_id'
	];

	type FieldKind = 'text' | 'number' | 'boolean';
	type FieldValue = string | number | boolean;

	let tenantId = 'tenant-demo';
	let apiHealth: { status: string; service: string } | null = null;
	let catalog: ApiCatalogResponse | null = null;
	let checklist: ParityChecklistResponse | null = null;
	let coverage: ParityCoverageResponse | null = null;
	let selectedFeatureFamily = '';
	let selectedCommandType: SupportedCommandType | '' = '';
	let selectedCommand: ParityChecklistCommand | null = null;
	let initializedCommandType = '';
	let checklistFamilies: ParityChecklistResponse['items'] = [];
	let featureCommands: ParityChecklistCommand[] = [];
	let idempotencyKey = createRandomId();
	let fieldValues: Record<string, FieldValue> = {};
	let isSubmittingCommand = false;
	let commandMessage = '';
	let commandError = '';
	let lastCommandResponse: { command_id: string; job_id: string; status_url: string } | null = null;
	let activeJob: JobResponse | null = null;
	let jobPollTimer: ReturnType<typeof setInterval> | null = null;
	let isLoadingBootstrap = false;
	let bootstrapError = '';

	let selectedProjection: ProjectionName | '' = '';
	let projectionRecordId = '';
	let projectionResult: Record<string, unknown> | null = null;
	let projectionError = '';

	let uploadObjectType: SignedUploadRequest['object_type'] = 'evidence';
	let uploadObjectId = 'artifact-demo';
	let uploadFile: File | null = null;
	let uploadMessage = '';
	let uploadError = '';

	$: checklistFamilies = checklist?.items ?? [];
	$: featureCommands = checklistFamilies.find((item) => item.feature_family === selectedFeatureFamily)?.commands ?? [];
	$: selectedCommand =
		featureCommands.find((command) => command.command_type === selectedCommandType) ?? null;
	$: if (!selectedFeatureFamily && checklistFamilies.length > 0) {
		selectedFeatureFamily = checklistFamilies[0].feature_family;
	}
	$: if (featureCommands.length > 0 && !featureCommands.some((command) => command.command_type === selectedCommandType)) {
		selectedCommandType = featureCommands[0].command_type;
	}
	$: if (selectedCommand && selectedCommand.command_type !== initializedCommandType) {
		fieldValues = buildFieldDefaults(selectedCommand.expected_fields ?? []);
		initializedCommandType = selectedCommand.command_type;
	}
	$: if (!selectedProjection && catalog?.projections?.length) {
		selectedProjection = catalog.projections[0];
	}

	onMount(async () => {
		await refreshBootstrapData();
	});

	onDestroy(() => {
		stopJobPolling();
	});

	async function refreshBootstrapData(): Promise<void> {
		isLoadingBootstrap = true;
		bootstrapError = '';
		try {
			const [health, nextCatalog, nextChecklist, nextCoverage] = await Promise.all([
				getApiHealth(),
				getApiCatalog(),
				getParityChecklist({ include_fields: true }),
				getParityCoverage(tenantId, { include_fields: false })
			]);
			apiHealth = health;
			catalog = nextCatalog;
			checklist = nextChecklist;
			coverage = nextCoverage;
		} catch (error) {
			bootstrapError = formatError(error);
		} finally {
			isLoadingBootstrap = false;
		}
	}

	function createRandomId(): string {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
	}

	function inferFieldKind(fieldName: string): FieldKind {
		if (BOOLEAN_FIELD_PATTERN.test(fieldName)) {
			return 'boolean';
		}
		if (NUMBER_FIELD_PATTERN.test(fieldName)) {
			return 'number';
		}
		return 'text';
	}

	function buildFieldDefaults(fields: string[]): Record<string, FieldValue> {
		const defaults: Record<string, FieldValue> = {};
		for (const field of fields) {
			const kind = inferFieldKind(field);
			if (kind === 'boolean') {
				defaults[field] = false;
				continue;
			}
			if (kind === 'number') {
				defaults[field] = 0;
				continue;
			}
			defaults[field] = '';
		}
		return defaults;
	}

	function handleFieldInput(fieldName: string, fieldKind: FieldKind, rawValue: string | boolean): void {
		if (fieldKind === 'boolean') {
			fieldValues = { ...fieldValues, [fieldName]: Boolean(rawValue) };
			return;
		}

		if (fieldKind === 'number') {
			const parsed = Number(rawValue);
			fieldValues = {
				...fieldValues,
				[fieldName]: Number.isFinite(parsed) ? parsed : 0
			};
			return;
		}

		fieldValues = { ...fieldValues, [fieldName]: String(rawValue) };
	}

	function ensureRecordIdentifier(payload: Record<string, unknown>): void {
		for (const key of ID_FIELDS) {
			if (typeof payload[key] === 'string' && String(payload[key]).trim()) {
				return;
			}
		}
		payload.record_id = createRandomId();
	}

	async function submitCommand(): Promise<void> {
		if (!selectedCommand) {
			return;
		}

		commandError = '';
		commandMessage = '';
		isSubmittingCommand = true;

		try {
			const payload: Record<string, unknown> = { ...fieldValues, model_key: selectedCommand.model_key };
			for (const field of selectedCommand.expected_fields ?? []) {
				if (!(field in payload)) {
					payload[field] = '';
				}
			}
			ensureRecordIdentifier(payload);

			const response = await createCommand(selectedCommand.command_type, {
				idempotency_key: idempotencyKey,
				tenant_id: tenantId,
				payload
			});

			lastCommandResponse = {
				command_id: response.command_id,
				job_id: response.job_id,
				status_url: response.status_url
			};

			commandMessage = `Command accepted (${response.command_id})`;
			idempotencyKey = createRandomId();
			await refreshCoverage();
			await fetchJobStatus(response.job_id);
			startJobPolling(response.job_id);
		} catch (error) {
			commandError = formatError(error);
		} finally {
			isSubmittingCommand = false;
		}
	}

	async function fetchJobStatus(jobId: string): Promise<void> {
		try {
			activeJob = await getJob(jobId);
			if (activeJob.status === 'completed' || activeJob.status === 'failed' || activeJob.status === 'cancelled') {
				stopJobPolling();
			}
		} catch (error) {
			commandError = formatError(error);
			stopJobPolling();
		}
	}

	function startJobPolling(jobId: string): void {
		stopJobPolling();
		jobPollTimer = setInterval(() => {
			void fetchJobStatus(jobId);
		}, 2_500);
	}

	function stopJobPolling(): void {
		if (!jobPollTimer) {
			return;
		}
		clearInterval(jobPollTimer);
		jobPollTimer = null;
	}

	async function refreshCoverage(): Promise<void> {
		try {
			coverage = await getParityCoverage(tenantId, { include_fields: false });
		} catch (error) {
			commandError = formatError(error);
		}
	}

	async function loadProjectionData(): Promise<void> {
		if (!selectedProjection) {
			return;
		}
		projectionError = '';
		try {
			const response = await readProjection(selectedProjection, tenantId, {
				id: projectionRecordId || undefined,
				limit: 25,
				offset: 0
			});
			projectionResult = response as Record<string, unknown>;
		} catch (error) {
			projectionError = formatError(error);
		}
	}

	function handleUploadFileChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		uploadFile = input.files?.[0] ?? null;
	}

	async function uploadArtifact(): Promise<void> {
		uploadMessage = '';
		uploadError = '';
		if (!uploadFile) {
			uploadError = 'Select a file before uploading.';
			return;
		}

		try {
			const signed = await createSignedUploadUrl({
				object_type: uploadObjectType,
				tenant_id: tenantId,
				object_id: uploadObjectId || createRandomId(),
				filename: uploadFile.name,
				content_type: uploadFile.type || 'application/octet-stream'
			});
			await uploadToSignedUrl(signed.upload_url, uploadFile);
			uploadMessage = `Uploaded ${uploadFile.name} to ${signed.object_key}`;
		} catch (error) {
			uploadError = formatError(error);
		}
	}

	function formatError(error: unknown): string {
		if (error instanceof CloudflareApiError) {
			return `${error.message} [${error.status}]`;
		}
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}
</script>

<section class="space-y-6">
	<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-slate-900">Cloudflare SPA Control Plane</h1>
				<p class="text-sm text-slate-600">
					Typed UI aligned to `/api/v2` contracts with field-level parity enforcement.
				</p>
			</div>
			<div class="flex items-center gap-3">
				<label class="text-sm font-medium text-slate-700" for="tenant-id">Tenant</label>
				<input
					id="tenant-id"
					class="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
					bind:value={tenantId}
				/>
				<button
					class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
					on:click={refreshBootstrapData}
					disabled={isLoadingBootstrap}
				>
					{isLoadingBootstrap ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
		</div>
		{#if bootstrapError}
			<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{bootstrapError}</p>
		{/if}
		{#if apiHealth}
			<p class="mt-3 text-xs text-slate-500">
				API: {apiHealth.service} ({apiHealth.status}) | commands:
				{catalog?.commands.length ?? 0} | projections: {catalog?.projections.length ?? 0}
			</p>
		{/if}
	</div>

	<div class="grid gap-6 xl:grid-cols-2">
		<div class="space-y-6">
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
				<h2 class="mb-4 text-lg font-semibold text-slate-900">Command Composer (Field Parity)</h2>
				<div class="grid gap-4 md:grid-cols-2">
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="feature-family-select"
							>Feature family</label
						>
						<select
							id="feature-family-select"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							bind:value={selectedFeatureFamily}
						>
							{#each checklistFamilies as family}
								<option value={family.feature_family}>{family.feature_family}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="command-type-select">Command</label>
						<select
							id="command-type-select"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							bind:value={selectedCommandType}
						>
							{#if featureCommands.length === 0}
								<option value="">No commands</option>
							{:else}
								{#each featureCommands as command}
									<option value={command.command_type}>{command.command_type}</option>
								{/each}
							{/if}
						</select>
					</div>
				</div>

				{#if selectedCommand}
					<div class="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
						<div><span class="font-semibold">Model key:</span> {selectedCommand.model_key}</div>
						<div><span class="font-semibold">Expected fields:</span> {selectedCommand.expected_field_count}</div>
						<div><span class="font-semibold">Registry source:</span> {selectedCommand.registry_source}</div>
					</div>

					<div class="mt-4">
						<label class="mb-1 block text-sm font-medium text-slate-700" for="idempotency-key-input"
							>Idempotency key</label
						>
						<input
							id="idempotency-key-input"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
							bind:value={idempotencyKey}
						/>
					</div>

					<div class="mt-4 grid max-h-[26rem] gap-3 overflow-auto rounded-lg border border-slate-200 p-3 md:grid-cols-2">
						{#each selectedCommand.expected_fields ?? [] as fieldName, fieldIndex}
							{@const fieldKind = inferFieldKind(fieldName)}
							{@const fieldInputId = `field-input-${fieldIndex}`}
							<div>
								<label
									class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600"
									for={fieldInputId}
								>
									{fieldName}
								</label>
								{#if fieldKind === 'boolean'}
									<label
										class="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
										for={fieldInputId}
									>
										<input
											id={fieldInputId}
											type="checkbox"
											checked={Boolean(fieldValues[fieldName])}
											on:change={(event) =>
												handleFieldInput(fieldName, fieldKind, (event.currentTarget as HTMLInputElement).checked)}
										/>
										<span>{Boolean(fieldValues[fieldName]) ? 'true' : 'false'}</span>
									</label>
								{:else if fieldKind === 'number'}
									<input
										id={fieldInputId}
										type="number"
										class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
										value={Number(fieldValues[fieldName] ?? 0)}
										on:input={(event) =>
											handleFieldInput(fieldName, fieldKind, (event.currentTarget as HTMLInputElement).value)}
									/>
								{:else}
									<input
										id={fieldInputId}
										type="text"
										class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
										value={String(fieldValues[fieldName] ?? '')}
										on:input={(event) =>
											handleFieldInput(fieldName, fieldKind, (event.currentTarget as HTMLInputElement).value)}
									/>
								{/if}
							</div>
						{/each}
					</div>

					<div class="mt-4 flex items-center gap-3">
						<button
							class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
							on:click={submitCommand}
							disabled={isSubmittingCommand}
						>
							{isSubmittingCommand ? 'Submitting...' : 'Submit command'}
						</button>
						<button
							class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
							on:click={() => (idempotencyKey = createRandomId())}
						>
							New idempotency key
						</button>
					</div>
				{/if}

				{#if commandMessage}
					<p class="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{commandMessage}</p>
				{/if}
				{#if commandError}
					<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{commandError}</p>
				{/if}
			</div>

			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
				<h2 class="mb-3 text-lg font-semibold text-slate-900">Job Monitor</h2>
				{#if activeJob}
					<div class="grid gap-2 text-sm text-slate-700">
						<div><span class="font-semibold">Job id:</span> {activeJob.job_id}</div>
						<div><span class="font-semibold">Type:</span> {activeJob.job_type}</div>
						<div><span class="font-semibold">Status:</span> {activeJob.status}</div>
						<div><span class="font-semibold">Progress:</span> {(activeJob.progress * 100).toFixed(1)}%</div>
						{#if activeJob.result_ref}
							<div><span class="font-semibold">Result:</span> {activeJob.result_ref}</div>
						{/if}
						{#if activeJob.error}
							<div class="text-red-700"><span class="font-semibold">Error:</span> {activeJob.error}</div>
						{/if}
					</div>
				{:else if lastCommandResponse}
					<p class="text-sm text-slate-600">Waiting for job details...</p>
				{:else}
					<p class="text-sm text-slate-600">Submit a command to start job tracking.</p>
				{/if}
			</div>
		</div>

		<div class="space-y-6">
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
				<h2 class="mb-3 text-lg font-semibold text-slate-900">Field Parity Coverage</h2>
				{#if coverage}
					<div class="mb-4 grid gap-3 sm:grid-cols-3">
						<div class="rounded-lg bg-slate-50 p-3">
							<p class="text-xs uppercase tracking-wide text-slate-500">Commands complete</p>
							<p class="text-xl font-bold text-slate-900">{coverage.summary.commands_complete}</p>
						</div>
						<div class="rounded-lg bg-slate-50 p-3">
							<p class="text-xs uppercase tracking-wide text-slate-500">Commands incomplete</p>
							<p class="text-xl font-bold text-amber-600">{coverage.summary.commands_incomplete}</p>
						</div>
						<div class="rounded-lg bg-slate-50 p-3">
							<p class="text-xs uppercase tracking-wide text-slate-500">Coverage ratio</p>
							<p class="text-xl font-bold text-indigo-700">
								{(coverage.summary.overall_coverage_ratio * 100).toFixed(1)}%
							</p>
						</div>
					</div>
					<div class="max-h-[24rem] overflow-auto rounded-lg border border-slate-200">
						<table class="min-w-full text-left text-sm">
							<thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
								<tr>
									<th class="px-3 py-2">Feature family</th>
									<th class="px-3 py-2">Status</th>
									<th class="px-3 py-2">Coverage</th>
									<th class="px-3 py-2">Expected fields</th>
								</tr>
							</thead>
							<tbody>
								{#each coverage.items as family}
									<tr class="border-t border-slate-100">
										<td class="px-3 py-2 font-medium text-slate-900">{family.feature_family}</td>
										<td class="px-3 py-2">{family.status}</td>
										<td class="px-3 py-2">{(family.coverage_ratio * 100).toFixed(1)}%</td>
										<td class="px-3 py-2">{family.expected_field_count}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="text-sm text-slate-600">Load coverage after setting tenant id.</p>
				{/if}
			</div>

			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
				<h2 class="mb-3 text-lg font-semibold text-slate-900">Projection Reader</h2>
				<div class="grid gap-3 md:grid-cols-2">
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="projection-select">Projection</label>
						<select
							id="projection-select"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							bind:value={selectedProjection}
						>
							{#if catalog}
								{#each catalog.projections as projectionName}
									<option value={projectionName}>{projectionName}</option>
								{/each}
							{/if}
						</select>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="projection-record-id"
							>Optional record id</label
						>
						<input
							id="projection-record-id"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							placeholder="leave blank for list"
							bind:value={projectionRecordId}
						/>
					</div>
				</div>
				<div class="mt-3">
					<button
						class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
						on:click={loadProjectionData}
					>
						Load projection
					</button>
				</div>
				{#if projectionError}
					<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{projectionError}</p>
				{/if}
				{#if projectionResult}
					<pre class="mt-3 max-h-[20rem] overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100"
						>{JSON.stringify(projectionResult, null, 2)}</pre
					>
				{/if}
			</div>

			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
				<h2 class="mb-3 text-lg font-semibold text-slate-900">R2 Upload Flow</h2>
				<div class="grid gap-3 md:grid-cols-2">
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="upload-object-type">Object type</label>
						<select
							id="upload-object-type"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							bind:value={uploadObjectType}
						>
							<option value="evidence">evidence</option>
							<option value="import">import</option>
							<option value="export">export</option>
							<option value="snapshot">snapshot</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium text-slate-700" for="upload-object-id">Object id</label>
						<input
							id="upload-object-id"
							class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							bind:value={uploadObjectId}
						/>
					</div>
				</div>
				<div class="mt-3">
					<input type="file" on:change={handleUploadFileChange} class="text-sm" />
				</div>
				<div class="mt-3">
					<button
						class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
						on:click={uploadArtifact}
					>
						Request signed URL and upload
					</button>
				</div>
				{#if uploadMessage}
					<p class="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{uploadMessage}</p>
				{/if}
				{#if uploadError}
					<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p>
				{/if}
			</div>
		</div>
	</div>
</section>
