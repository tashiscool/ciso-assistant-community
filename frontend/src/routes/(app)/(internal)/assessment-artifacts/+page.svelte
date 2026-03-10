	<script lang="ts">
		import { goto } from '$app/navigation';
		import {
			artifactPackageApi,
			type ArtifactPackage
		} from '$lib/services/assessment-artifacts/api';
		import { parseTsvPreview } from '$lib/services/assessment-artifacts/builder';

	let { data } = $props();
	let packages = $state<ArtifactPackage[]>(data.packages ?? []);

	// Creation mode: 'template' | 'import' | null
	let createMode = $state<'template' | 'import' | null>(null);

	// Template state
	let templates = $state<Array<{
		key: string;
		name: string;
		description: string;
		framework: string;
		platforms: string[];
		item_count: number;
	}>>([]);
	let selectedTemplate = $state('');
	let templateName = $state('');
	let templateSystemName = $state('');
	let generating = $state(false);
	let generateError = $state('');

	// Import form state
	let importName = $state('');
	let importSystemName = $state('');
	let importPackageType = $state('fedramp');
	let importFile: File | null = $state(null);
	let importing = $state(false);
	let importError = $state('');

	// TSV preview
	let previewStats = $state<{
		total_requests: number;
		unique_controls: number;
		unique_platform_tags: number;
		periodicity_breakdown: Record<string, number>;
	} | null>(null);

		async function loadTemplates() {
			try {
				const response = await artifactPackageApi.listTemplates();
				templates = response.success ? response.data?.templates ?? [] : [];
			} catch {
				templates = [];
			}
		}

	function openCreateMode(mode: 'template' | 'import') {
		createMode = mode;
		if (mode === 'template' && templates.length === 0) {
			loadTemplates();
		}
	}

		async function generateFromTemplate() {
			if (!selectedTemplate) return;
			generating = true;
			generateError = '';

			try {
				const response = await artifactPackageApi.generateFromTemplate({
					template_key: selectedTemplate,
					name: templateName || undefined,
					system_name: templateSystemName || undefined,
					generate_schedules: true
				});

				if (!response.success || !response.data?.id) {
					generateError = response.message || 'Generation failed';
					return;
				}

				goto(`/assessment-artifacts/${response.data.id}`);
			} catch (e: any) {
				generateError = e.message || 'Generation failed';
			} finally {
			generating = false;
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		importFile = file;
		importError = '';

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			try {
				const parsed = parseTsvPreview(content);
				previewStats = parsed.stats;
			} catch {
				previewStats = null;
			}
		};
		reader.readAsText(file);
	}

		async function importPackage() {
			if (!importFile || !importName) return;
			importing = true;
			importError = '';

			try {
				const formData = new FormData();
				formData.append('file', importFile);
				formData.append('name', importName);
				formData.append('package_type', importPackageType);
				formData.append('system_name', importSystemName);
				formData.append('generate_schedules', 'true');

				const response = await artifactPackageApi.importTsv(formData);
				if (!response.success || !response.data?.id) {
					importError = response.message || 'Import failed';
					return;
				}

				goto(`/assessment-artifacts/${response.data.id}`);
			} catch (e: any) {
				importError = e.message || 'Import failed';
			} finally {
			importing = false;
		}
	}

		async function deletePackage(id: string) {
			if (!confirm('Delete this artifact package and all its items?')) return;
			const response = await artifactPackageApi.delete(id);
			if (response.success) {
				packages = packages.filter((p) => p.id !== id);
			}
		}

	const statusColors: Record<string, string> = {
		draft: 'bg-yellow-100 text-yellow-800',
		active: 'bg-green-100 text-green-800',
		archived: 'bg-gray-100 text-gray-800'
	};

	const periodicityLabels: Record<string, string> = {
		weekly: 'Weekly',
		monthly: 'Monthly',
		quarterly: 'Quarterly',
		semi_annual: 'Semi-Annual',
		annual: 'Annual',
		on_demand: 'On Demand',
		event_driven: 'Event-Driven',
		continuous: 'Continuous'
	};
</script>

<div class="space-y-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Assessment Artifact Packages</h1>
			<p class="text-sm text-gray-500">
				Manage evidence request lists organized by NIST 800-53 controls with automated periodic
				collection schedules.
			</p>
		</div>
		<div class="flex gap-2">
			<button
				class="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
				onclick={() => openCreateMode('template')}
			>
				Generate from Template
			</button>
			<button
				class="rounded border border-indigo-600 px-4 py-2 text-indigo-600 hover:bg-indigo-50"
				onclick={() => openCreateMode('import')}
			>
				Import TSV
			</button>
			{#if createMode}
				<button
					class="rounded border px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
					onclick={() => (createMode = null)}
				>
					Cancel
				</button>
			{/if}
		</div>
	</div>

	<!-- Generate from Template -->
	{#if createMode === 'template'}
		<div class="rounded-lg border bg-white p-6 shadow-sm">
			<h2 class="mb-2 text-lg font-semibold">Generate from Built-in Template</h2>
			<p class="mb-4 text-sm text-gray-600">
				Select a pre-built evidence request template. Each template includes hundreds of
				evidence items mapped to specific controls with collection commands, platform tags, and
				periodic schedules already configured.
			</p>

			{#if templates.length === 0}
				<p class="text-sm text-gray-400">Loading templates...</p>
			{:else}
				<div class="space-y-3">
					{#each templates as tpl}
						<label
							class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors
								{selectedTemplate === tpl.key ? 'border-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'}"
						>
							<input
								type="radio"
								name="template"
								value={tpl.key}
								bind:group={selectedTemplate}
								class="mt-1"
							/>
							<div class="flex-1">
								<div class="font-medium">{tpl.name}</div>
								<p class="mt-1 text-sm text-gray-600">{tpl.description}</p>
								<div class="mt-2 flex flex-wrap gap-2 text-xs">
									<span class="rounded bg-blue-100 px-2 py-0.5 text-blue-800">
										{tpl.item_count} evidence items
									</span>
									<span class="rounded bg-purple-100 px-2 py-0.5 text-purple-800">
										{tpl.framework}
									</span>
									{#each tpl.platforms.slice(0, 6) as platform}
										<span class="rounded bg-gray-100 px-2 py-0.5">{platform}</span>
									{/each}
									{#if tpl.platforms.length > 6}
										<span class="text-gray-400">+{tpl.platforms.length - 6} more</span>
									{/if}
								</div>
							</div>
						</label>
					{/each}
				</div>

				{#if selectedTemplate}
					<div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label class="block text-sm font-medium" for="tpl-name">
								Package Name <span class="text-gray-400">(optional — defaults to template name)</span>
							</label>
							<input
								id="tpl-name"
								type="text"
								class="mt-1 w-full rounded border px-3 py-2"
								placeholder="My FedRAMP Assessment 2026"
								bind:value={templateName}
							/>
						</div>
						<div>
							<label class="block text-sm font-medium" for="tpl-system">System Name</label>
							<input
								id="tpl-system"
								type="text"
								class="mt-1 w-full rounded border px-3 py-2"
								placeholder="MyApp on AWS/RHEL 7"
								bind:value={templateSystemName}
							/>
						</div>
					</div>
				{/if}

				{#if generateError}
					<p class="mt-2 text-sm text-red-600">{generateError}</p>
				{/if}

				<div class="mt-4">
					<button
						class="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
						onclick={generateFromTemplate}
						disabled={generating || !selectedTemplate}
					>
						{generating ? 'Generating...' : 'Generate Package & Schedules'}
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Import TSV -->
	{#if createMode === 'import'}
		<div class="rounded-lg border bg-white p-6 shadow-sm">
			<h2 class="mb-2 text-lg font-semibold">Import Assessment Request List</h2>
			<p class="mb-4 text-sm text-gray-600">
				Upload a tab-delimited file with columns: Controls (comma-separated), Category, Artifact
				Request, Date.
			</p>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label class="block text-sm font-medium" for="import-name">Package Name</label>
					<input
						id="import-name"
						type="text"
						class="mt-1 w-full rounded border px-3 py-2"
						placeholder="FedRAMP Moderate Assessment 2026"
						bind:value={importName}
					/>
				</div>
				<div>
					<label class="block text-sm font-medium" for="import-system">System Name</label>
					<input
						id="import-system"
						type="text"
						class="mt-1 w-full rounded border px-3 py-2"
						placeholder="MyApp on AWS/RHEL 7"
						bind:value={importSystemName}
					/>
				</div>
				<div>
					<label class="block text-sm font-medium" for="import-type">Package Type</label>
					<select
						id="import-type"
						class="mt-1 w-full rounded border px-3 py-2"
						bind:value={importPackageType}
					>
						<option value="fedramp">FedRAMP Assessment</option>
						<option value="nist_800_53">NIST 800-53</option>
						<option value="iso_27001">ISO 27001</option>
						<option value="soc_2">SOC 2</option>
						<option value="cmmc">CMMC</option>
						<option value="custom">Custom</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium" for="import-file">TSV File</label>
					<input
						id="import-file"
						type="file"
						accept=".tsv,.txt,.csv"
						class="mt-1 w-full rounded border px-3 py-2"
						onchange={handleFileSelect}
					/>
				</div>
			</div>

			{#if previewStats}
				<div class="mt-4 rounded bg-blue-50 p-3 text-sm">
					<strong>Preview:</strong>
					{previewStats.total_requests} requests, {previewStats.unique_controls} unique controls,
					{previewStats.unique_platform_tags} platform tags
					{#if Object.keys(previewStats.periodicity_breakdown).length > 0}
						<span class="ml-2">|</span>
						{#each Object.entries(previewStats.periodicity_breakdown) as [period, count]}
							<span class="ml-2 rounded bg-blue-100 px-2 py-0.5">
								{periodicityLabels[period] ?? period}: {count}
							</span>
						{/each}
					{/if}
				</div>
			{/if}

			{#if importError}
				<p class="mt-2 text-sm text-red-600">{importError}</p>
			{/if}

			<div class="mt-4">
				<button
					class="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
					onclick={importPackage}
					disabled={importing || !importFile || !importName}
				>
					{importing ? 'Importing...' : 'Import & Generate Schedules'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Package list -->
	{#if packages.length === 0 && !createMode}
		<div class="rounded-lg border bg-white p-12 text-center">
			<h3 class="text-lg font-medium text-gray-700">No artifact packages yet</h3>
			<p class="mt-2 text-sm text-gray-500">
				Get started by generating a package from a built-in template or importing your own
				request list.
			</p>
			<div class="mt-6 flex justify-center gap-3">
				<button
					class="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
					onclick={() => openCreateMode('template')}
				>
					Use a Template
				</button>
				<button
					class="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50"
					onclick={() => openCreateMode('import')}
				>
					Import TSV File
				</button>
			</div>
		</div>
	{:else if packages.length > 0}
		<div class="grid gap-4">
			{#each packages as pkg}
				<div class="rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
					<div class="flex items-start justify-between">
						<div>
							<a
								href="/assessment-artifacts/{pkg.id}"
								class="text-lg font-semibold text-indigo-600 hover:underline"
							>
								{pkg.name}
							</a>
							<div class="mt-1 flex items-center gap-3 text-sm text-gray-500">
								<span
									class="rounded px-2 py-0.5 text-xs font-medium {statusColors[pkg.status] ??
										'bg-gray-100'}"
								>
									{pkg.status_display ?? pkg.status}
								</span>
								<span>{pkg.package_type_display ?? pkg.package_type}</span>
								{#if pkg.system_name}
									<span>| {pkg.system_name}</span>
								{/if}
							</div>
						</div>
						<div class="flex gap-2">
							<a
								href="/assessment-artifacts/{pkg.id}"
								class="rounded border px-3 py-1 text-sm hover:bg-gray-50"
							>
								View
							</a>
							<button
								class="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
								onclick={() => deletePackage(pkg.id)}
							>
								Delete
							</button>
						</div>
					</div>

					<div class="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
						<div>
							<span class="text-gray-500">Items:</span>
							<span class="ml-1 font-medium"
								>{pkg.total_items ?? pkg.stats?.total_requests ?? 0}</span
							>
						</div>
						<div>
							<span class="text-gray-500">Controls:</span>
							<span class="ml-1 font-medium">{pkg.stats?.unique_controls ?? 0}</span>
						</div>
						<div>
							<span class="text-gray-500">Schedules:</span>
							<span class="ml-1 font-medium">{pkg.schedule_count ?? 0}</span>
						</div>
						<div>
							<span class="text-gray-500">Quality:</span>
							<span
								class="ml-1 font-medium {pkg.quality_report?.quality_gate === 'pass'
									? 'text-green-600'
									: 'text-yellow-600'}"
							>
								{pkg.quality_report?.quality_gate ?? 'N/A'}
							</span>
						</div>
					</div>

					{#if pkg.platform_tags?.length}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each pkg.platform_tags as tag}
								<span class="rounded bg-gray-100 px-2 py-0.5 text-xs">{tag}</span>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
