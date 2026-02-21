<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import {
    Database,
    ArrowLeft,
    Plus,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Eye,
    EyeOff,
    Zap
  } from 'lucide-svelte';
  import { evidenceSourceApi, evidenceAutomationApi } from '$lib/services/evidence-automation/api';
  import type { SourceTypeInfo, ConfigField } from '$lib/services/evidence-automation/api';

  let sourceTypes: SourceTypeInfo[] = $state([]);
  let loadingTypes = $state(true);
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let successMsg = $state<string | null>(null);

  // Form fields
  let selectedType = $state('');
  let name = $state('');
  let description = $state('');
  let collectionEnabled = $state(true);
  let collectionSchedule = $state('0 */6 * * *');
  let configValues = $state<Record<string, string>>({});

  // Password visibility toggle per field
  let showPassword = $state<Record<string, boolean>>({});

  const selectedTypeInfo = $derived(
    sourceTypes.find((t) => t.value === selectedType) ?? null
  );

  const configFields = $derived(selectedTypeInfo?.config_fields ?? []);

  function initConfigValues(fields: ConfigField[]) {
    const vals: Record<string, string> = {};
    const vis: Record<string, boolean> = {};
    for (const f of fields) {
      vals[f.name] = f.default ?? '';
      vis[f.name] = false;
    }
    configValues = vals;
    showPassword = vis;
  }

  $effect(() => {
    if (configFields.length > 0) {
      initConfigValues(configFields);
    }
  });

  async function loadSourceTypes() {
    loadingTypes = true;
    try {
      const res = await evidenceAutomationApi.getSourceTypes();
      if (res.success && res.data?.source_types) {
        sourceTypes = res.data.source_types;
        if (sourceTypes.length > 0) {
          selectedType = sourceTypes[0].value;
        }
      }
    } catch (err) {
      console.error('Error loading source types:', err);
    } finally {
      loadingTypes = false;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!selectedType) {
      error = 'Please select a source type.';
      return;
    }
    if (!name.trim()) {
      error = 'Name is required.';
      return;
    }

    submitting = true;
    error = null;
    successMsg = null;

    try {
      const res = await evidenceSourceApi.create({
        source_type: selectedType as any,
        name: name.trim(),
        description: description.trim() || undefined,
        collection_enabled: collectionEnabled,
        collection_schedule: collectionSchedule.trim() || undefined,
        config: { ...configValues },
      });

      if (res.success) {
        goto(`${base}/evidence-automation/sources`);
      } else {
        error = 'Failed to create source. Please check your inputs and try again.';
      }
    } catch (err) {
      error = 'An unexpected error occurred. Please try again.';
      console.error(err);
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    loadSourceTypes();
  });
</script>

<svelte:head>
  <title>Add Evidence Source - CISO Assistant</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Back link + heading -->
  <div class="mb-6">
    <a
      href="{base}/evidence-automation/sources"
      class="inline-flex items-center text-sm text-gray-500 hover:text-amber-600 mb-4"
    >
      <ArrowLeft size={16} class="mr-1" />
      Back to Evidence Sources
    </a>
    <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
      <Plus class="text-amber-500" size={26} />
      Add Evidence Source
    </h1>
    <p class="mt-1 text-sm text-gray-600">
      Connect an external system so CISO Assistant can collect evidence automatically.
    </p>
  </div>

  {#if error}
    <div class="mb-4 rounded-md bg-red-50 border border-red-200 p-4 flex items-start gap-2">
      <AlertTriangle size={18} class="text-red-500 flex-shrink-0 mt-0.5" />
      <p class="text-sm text-red-700">{error}</p>
    </div>
  {/if}

  {#if successMsg}
    <div class="mb-4 rounded-md bg-green-50 border border-green-200 p-4 flex items-start gap-2">
      <CheckCircle size={18} class="text-green-600 flex-shrink-0 mt-0.5" />
      <p class="text-sm text-green-700">{successMsg}</p>
    </div>
  {/if}

  <form onsubmit={handleSubmit} class="space-y-6">
    <!-- Card: Basic Info -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
      <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
        Basic Information
      </h2>

      <!-- Source Type -->
      <div>
        <label for="source_type" class="block text-sm font-medium text-gray-700 mb-1">
          Source Type <span class="text-red-500">*</span>
        </label>
        {#if loadingTypes}
          <div class="flex items-center gap-2 text-sm text-gray-500 py-2">
            <RefreshCw size={14} class="animate-spin" />
            Loading source types...
          </div>
        {:else}
          <select
            id="source_type"
            bind:value={selectedType}
            required
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white"
          >
            <option value="" disabled>Select a source type...</option>
            {#each sourceTypes as st (st.value)}
              <option value={st.value}>{st.label}</option>
            {/each}
          </select>
        {/if}
      </div>

      <!-- Name -->
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
          Name <span class="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          bind:value={name}
          required
          placeholder="e.g., Production AWS Account"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
        />
      </div>

      <!-- Description -->
      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          bind:value={description}
          rows={3}
          placeholder="Optional description of this evidence source..."
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 resize-none"
        ></textarea>
      </div>
    </div>

    <!-- Card: Configuration (dynamic based on source type) -->
    {#if configFields.length > 0}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Connection Configuration
          {#if selectedTypeInfo}
            <span class="ml-2 text-sm font-normal text-gray-500">for {selectedTypeInfo.label}</span>
          {/if}
        </h2>

        {#each configFields as field (field.name)}
          <div>
            <label for="cfg_{field.name}" class="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {#if field.required}
                <span class="text-red-500">*</span>
              {/if}
            </label>

            {#if field.type === 'select' && field.options}
              <select
                id="cfg_{field.name}"
                bind:value={configValues[field.name]}
                required={field.required}
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white"
              >
                <option value="">Select...</option>
                {#each field.options as opt}
                  <option value={opt}>{opt}</option>
                {/each}
              </select>
            {:else if field.type === 'password'}
              <div class="relative">
                <input
                  id="cfg_{field.name}"
                  type={showPassword[field.name] ? 'text' : 'password'}
                  bind:value={configValues[field.name]}
                  required={field.required}
                  placeholder={field.label}
                  class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 font-mono"
                />
                <button
                  type="button"
                  onclick={() => (showPassword[field.name] = !showPassword[field.name])}
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {#if showPassword[field.name]}
                    <EyeOff size={16} />
                  {:else}
                    <Eye size={16} />
                  {/if}
                </button>
              </div>
            {:else}
              <input
                id="cfg_{field.name}"
                type={field.type}
                bind:value={configValues[field.name]}
                required={field.required}
                placeholder={field.label}
                class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
              />
            {/if}
          </div>
        {/each}
      </div>
    {:else if selectedType && !loadingTypes}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p class="text-sm text-gray-500">No additional configuration required for this source type.</p>
      </div>
    {/if}

    <!-- Card: Collection Settings -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
      <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
        Collection Settings
      </h2>

      <!-- Collection Enabled toggle -->
      <div class="flex items-center justify-between">
        <div>
          <label for="collection_enabled" class="text-sm font-medium text-gray-700">
            Enable Automatic Collection
          </label>
          <p class="text-xs text-gray-500 mt-0.5">
            When enabled, evidence will be collected automatically on the specified schedule.
          </p>
        </div>
        <button
          type="button"
          id="collection_enabled"
          onclick={() => (collectionEnabled = !collectionEnabled)}
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 {collectionEnabled ? 'bg-amber-600' : 'bg-gray-200'}"
          role="switch"
          aria-checked={collectionEnabled}
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {collectionEnabled ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>

      <!-- Collection Schedule -->
      <div>
        <label for="schedule" class="block text-sm font-medium text-gray-700 mb-1">
          Collection Schedule (cron)
        </label>
        <input
          id="schedule"
          type="text"
          bind:value={collectionSchedule}
          placeholder="0 */6 * * *"
          class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-mono focus:outline-none focus:ring-amber-500 focus:border-amber-500"
        />
        <p class="mt-1 text-xs text-gray-500">
          Cron expression — e.g., <code class="bg-gray-100 px-1 rounded">0 */6 * * *</code> = every 6 hours,
          <code class="bg-gray-100 px-1 rounded">0 0 * * *</code> = daily at midnight.
        </p>
      </div>
    </div>

    <!-- Form actions -->
    <div class="flex items-center justify-end gap-3">
      <a
        href="{base}/evidence-automation/sources"
        class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={submitting || loadingTypes}
        class="inline-flex items-center px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if submitting}
          <RefreshCw size={16} class="mr-2 animate-spin" />
          Creating...
        {:else}
          <Plus size={16} class="mr-2" />
          Create Source
        {/if}
      </button>
    </div>
  </form>
</div>
