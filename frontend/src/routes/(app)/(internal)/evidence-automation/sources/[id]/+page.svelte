<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import {
    Database,
    ArrowLeft,
    RefreshCw,
    Play,
    Pause,
    Save,
    Trash2,
    Wifi,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Activity,
    Cloud,
    Shield,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronUp
  } from 'lucide-svelte';
  import { evidenceSourceApi, evidenceAutomationApi } from '$lib/services/evidence-automation/api';
  import type {
    EvidenceSource,
    SourceTypeInfo,
    ConfigField,
    CollectionStatus
  } from '$lib/services/evidence-automation/api';

  let { data } = $props();

  // --- Source state ---
  let source = $state<EvidenceSource | null>(data.source ?? null);
  let notFound = $derived(source === null);

  // --- Edit form state (synced from source) ---
  let editName = $state(source?.name ?? '');
  let editDescription = $state(source?.description ?? '');
  let editSchedule = $state(source?.collection_schedule ?? '0 */6 * * *');
  let editEnabled = $state(source?.collection_enabled ?? true);
  let editConfigValues = $state<Record<string, string>>({});

  // --- UI state ---
  let saving = $state(false);
  let deleting = $state(false);
  let testing = $state(false);
  let toggling = $state(false);
  let loadingStatus = $state(false);
  let showConfig = $state(false);
  let showPassword = $state<Record<string, boolean>>({});

  let saveError = $state<string | null>(null);
  let saveSuccess = $state(false);
  let testResult = $state<{ success: boolean; message: string; details?: string[] } | null>(null);
  let collectionStatus = $state<CollectionStatus | null>(null);

  // --- Source type info for config fields ---
  let sourceTypeInfo = $state<SourceTypeInfo | null>(null);
  let configFields = $derived(sourceTypeInfo?.config_fields ?? []);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  };

  const runStatusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    running: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    partial: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  };

  const sourceIcons: Record<string, typeof Cloud> = {
    aws: Cloud,
    azure: Cloud,
    gcp: Cloud,
    github: Shield,
    okta: Shield,
    azure_ad: Shield,
    splunk: Activity,
    qualys: Activity,
    tenable: Activity,
    crowdstrike: Shield,
    api: Database,
    jira: Database,
    servicenow: Database,
    file: Database,
    manual: Database,
  };

  function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  function formatDuration(start?: string, end?: string): string {
    if (!start || !end) return '';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  function syncFormFromSource(s: EvidenceSource) {
    editName = s.name;
    editDescription = s.description ?? '';
    editSchedule = s.collection_schedule ?? '0 */6 * * *';
    editEnabled = s.collection_enabled;

    // Populate config values from saved config
    const vals: Record<string, string> = {};
    for (const key of Object.keys(s.config ?? {})) {
      vals[key] = String(s.config[key] ?? '');
    }
    editConfigValues = vals;
  }

  async function loadSourceTypes() {
    try {
      const res = await evidenceAutomationApi.getSourceTypes();
      if (res.success && res.data?.source_types && source) {
        const info = res.data.source_types.find((t) => t.value === source!.source_type);
        if (info) {
          sourceTypeInfo = info;
          // Fill in missing config keys from field definitions
          const merged: Record<string, string> = {};
          for (const f of info.config_fields) {
            merged[f.name] = editConfigValues[f.name] ?? f.default ?? '';
          }
          editConfigValues = merged;

          const vis: Record<string, boolean> = {};
          for (const f of info.config_fields) vis[f.name] = false;
          showPassword = vis;
        }
      }
    } catch (err) {
      console.error('Could not load source types', err);
    }
  }

  async function loadStatus() {
    if (!source) return;
    loadingStatus = true;
    try {
      const res = await evidenceSourceApi.getStatus(source.id);
      if (res.success) {
        collectionStatus = res.data ?? null;
      }
    } catch (err) {
      console.error('Error loading status:', err);
    } finally {
      loadingStatus = false;
    }
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    if (!source) return;
    saving = true;
    saveError = null;
    saveSuccess = false;

    try {
      const res = await evidenceSourceApi.update(source.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        collection_schedule: editSchedule.trim() || undefined,
        collection_enabled: editEnabled,
        config: { ...editConfigValues },
      });

      if (res.success && res.data) {
        source = res.data;
        syncFormFromSource(res.data);
        saveSuccess = true;
        setTimeout(() => (saveSuccess = false), 3000);
      } else {
        saveError = 'Failed to save changes. Please try again.';
      }
    } catch (err) {
      saveError = 'An unexpected error occurred.';
    } finally {
      saving = false;
    }
  }

  async function handleTestConnection() {
    if (!source) return;
    testing = true;
    testResult = null;
    try {
      const res = await evidenceSourceApi.testConnection(source.id);
      const td = res.data;
      testResult = {
        success: td?.success ?? false,
        message: td?.error ?? (td?.success ? 'Connection successful' : 'Connection failed'),
        details: td?.details,
      };
    } catch (err) {
      testResult = { success: false, message: 'Connection test failed unexpectedly.' };
    } finally {
      testing = false;
    }
  }

  async function handleToggle() {
    if (!source) return;
    toggling = true;
    try {
      if (source.status === 'active') {
        const res = await evidenceSourceApi.deactivate(source.id);
        if (res.success && res.data) source = res.data;
      } else {
        const res = await evidenceSourceApi.activate(source.id);
        if (res.success && res.data) source = res.data;
      }
    } catch (err) {
      console.error('Error toggling source:', err);
    } finally {
      toggling = false;
    }
  }

  async function handleDelete() {
    if (!source) return;
    if (!confirm(`Permanently delete source "${source.name}"? All associated rules will also be removed.`)) return;
    deleting = true;
    try {
      await evidenceSourceApi.delete(source.id);
      goto(`${base}/evidence-automation/sources`);
    } catch (err) {
      console.error('Error deleting source:', err);
      deleting = false;
    }
  }

  onMount(async () => {
    if (source) {
      syncFormFromSource(source);
      await Promise.all([loadSourceTypes(), loadStatus()]);
    }
  });
</script>

<svelte:head>
  <title>{source?.name ?? 'Evidence Source'} - Regovise</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
  <!-- Back link -->
  <div>
    <a
      href="{base}/evidence-automation/sources"
      class="inline-flex items-center text-sm text-gray-500 hover:text-amber-600"
    >
      <ArrowLeft size={16} class="mr-1" />
      Back to Evidence Sources
    </a>
  </div>

  {#if notFound}
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <AlertTriangle size={48} class="mx-auto mb-4 text-amber-400" />
      <h2 class="text-xl font-semibold text-gray-800">Source Not Found</h2>
      <p class="text-gray-500 mt-2">The requested evidence source could not be loaded.</p>
      <a
        href="{base}/evidence-automation/sources"
        class="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
      >
        Back to Sources
      </a>
    </div>
  {:else if source}
    <!-- Source Header Card -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="p-3 bg-gray-100 rounded-xl">
            <svelte:component
              this={sourceIcons[source.source_type] ?? Database}
              size={28}
              class="text-gray-600"
            />
          </div>
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{source.name}</h1>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-sm text-gray-500">{source.source_type_display}</span>
              <span
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {statusColors[source.status] ?? 'bg-gray-100 text-gray-800'}"
              >
                {source.status_display}
              </span>
            </div>
            {#if source.description}
              <p class="text-sm text-gray-500 mt-1">{source.description}</p>
            {/if}
          </div>
        </div>

        <!-- Activate / Deactivate -->
        <button
          onclick={handleToggle}
          disabled={toggling}
          class="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium border disabled:opacity-50 {source.status === 'active'
            ? 'border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100'
            : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'}"
        >
          {#if toggling}
            <RefreshCw size={15} class="mr-2 animate-spin" />
            Updating...
          {:else if source.status === 'active'}
            <Pause size={15} class="mr-2" />
            Deactivate
          {:else}
            <Play size={15} class="mr-2" />
            Activate
          {/if}
        </button>
      </div>

      <!-- Meta row -->
      <div class="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-6 text-sm text-gray-500">
        <div class="flex items-center gap-1.5">
          <Clock size={14} />
          <span>Last collection: <strong class="text-gray-700">{formatDate(source.last_collection_at)}</strong></span>
        </div>
        <div class="flex items-center gap-1.5">
          <Activity size={14} />
          <span>Rules: <strong class="text-gray-700">{source.rules_count}</strong></span>
        </div>
        <div class="flex items-center gap-1.5">
          <Clock size={14} />
          <span>Created: <strong class="text-gray-700">{formatDate(source.created_at)}</strong></span>
        </div>
      </div>
    </div>

    <!-- Status / Error Card -->
    {#if source.last_error || source.last_collection_status}
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Activity size={18} class="text-gray-500" />
          Last Collection Status
        </h2>
        {#if source.last_collection_status}
          <div class="flex items-center gap-2 mb-2">
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {runStatusColors[source.last_collection_status] ?? 'bg-gray-100 text-gray-800'}"
            >
              {source.last_collection_status}
            </span>
            <span class="text-sm text-gray-500">{formatDate(source.last_collection_at)}</span>
          </div>
        {/if}
        {#if source.last_error}
          <div class="mt-2 rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <AlertTriangle size={16} class="text-red-500 flex-shrink-0 mt-0.5" />
            <pre class="text-xs text-red-700 whitespace-pre-wrap break-all font-mono">{source.last_error}</pre>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Test Connection Card -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Wifi size={18} class="text-gray-500" />
          Connection Test
        </h2>
        <button
          onclick={handleTestConnection}
          disabled={testing}
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {#if testing}
            <RefreshCw size={15} class="mr-2 animate-spin" />
            Testing...
          {:else}
            <Wifi size={15} class="mr-2" />
            Test Connection
          {/if}
        </button>
      </div>

      {#if testResult}
        <div
          class="rounded-md p-4 border {testResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'}"
        >
          <div class="flex items-center gap-2 mb-1">
            {#if testResult.success}
              <CheckCircle size={18} class="text-green-600 flex-shrink-0" />
              <p class="text-sm font-medium text-green-800">{testResult.message}</p>
            {:else}
              <XCircle size={18} class="text-red-600 flex-shrink-0" />
              <p class="text-sm font-medium text-red-800">{testResult.message}</p>
            {/if}
          </div>
          {#if testResult.details && testResult.details.length > 0}
            <ul class="mt-2 space-y-1 pl-6">
              {#each testResult.details as detail}
                <li class="text-xs {testResult.success ? 'text-green-700' : 'text-red-700'}">
                  {detail}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {:else}
        <p class="text-sm text-gray-500">
          Verify that the credentials and endpoint configuration are valid by testing the connection.
        </p>
      {/if}
    </div>

    <!-- Edit Form Card -->
    <form onsubmit={handleSave}>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
        <h2 class="text-base font-semibold text-gray-900 border-b border-gray-100 pb-3">
          Edit Source
        </h2>

        {#if saveError}
          <div class="rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <AlertTriangle size={16} class="text-red-500 flex-shrink-0 mt-0.5" />
            <p class="text-sm text-red-700">{saveError}</p>
          </div>
        {/if}

        {#if saveSuccess}
          <div class="rounded-md bg-green-50 border border-green-200 p-3 flex items-center gap-2">
            <CheckCircle size={16} class="text-green-600 flex-shrink-0" />
            <p class="text-sm text-green-700">Changes saved successfully.</p>
          </div>
        {/if}

        <!-- Name -->
        <div>
          <label for="edit_name" class="block text-sm font-medium text-gray-700 mb-1">
            Name <span class="text-red-500">*</span>
          </label>
          <input
            id="edit_name"
            type="text"
            bind:value={editName}
            required
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <!-- Description -->
        <div>
          <label for="edit_description" class="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="edit_description"
            bind:value={editDescription}
            rows={3}
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 resize-none"
          ></textarea>
        </div>

        <!-- Collection Enabled -->
        <div class="flex items-center justify-between">
          <div>
            <label for="edit_enabled" class="text-sm font-medium text-gray-700">
              Enable Automatic Collection
            </label>
            <p class="text-xs text-gray-500 mt-0.5">
              Automatically collect evidence on the specified schedule.
            </p>
          </div>
          <button
            type="button"
            id="edit_enabled"
            onclick={() => (editEnabled = !editEnabled)}
            class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 {editEnabled ? 'bg-amber-600' : 'bg-gray-200'}"
            role="switch"
            aria-checked={editEnabled}
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {editEnabled ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>

        <!-- Schedule -->
        <div>
          <label for="edit_schedule" class="block text-sm font-medium text-gray-700 mb-1">
            Collection Schedule (cron)
          </label>
          <input
            id="edit_schedule"
            type="text"
            bind:value={editSchedule}
            placeholder="0 */6 * * *"
            class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-mono focus:outline-none focus:ring-amber-500 focus:border-amber-500"
          />
          <p class="mt-1 text-xs text-gray-500">
            e.g., <code class="bg-gray-100 px-1 rounded">0 */6 * * *</code> = every 6 hours
          </p>
        </div>

        <!-- Config Fields (collapsible) -->
        {#if configFields.length > 0}
          <div class="border border-gray-200 rounded-md">
            <button
              type="button"
              onclick={() => (showConfig = !showConfig)}
              class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
            >
              <span>Connection Configuration</span>
              {#if showConfig}
                <ChevronUp size={16} class="text-gray-400" />
              {:else}
                <ChevronDown size={16} class="text-gray-400" />
              {/if}
            </button>

            {#if showConfig}
              <div class="px-4 pb-4 pt-2 space-y-4 border-t border-gray-200">
                {#each configFields as field (field.name)}
                  <div>
                    <label for="edit_cfg_{field.name}" class="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {#if field.required}<span class="text-red-500">*</span>{/if}
                    </label>

                    {#if field.type === 'select' && field.options}
                      <select
                        id="edit_cfg_{field.name}"
                        bind:value={editConfigValues[field.name]}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 bg-white"
                      >
                        {#each field.options as opt}
                          <option value={opt}>{opt}</option>
                        {/each}
                      </select>
                    {:else if field.type === 'password'}
                      <div class="relative">
                        <input
                          id="edit_cfg_{field.name}"
                          type={showPassword[field.name] ? 'text' : 'password'}
                          bind:value={editConfigValues[field.name]}
                          class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm text-sm font-mono focus:outline-none focus:ring-amber-500 focus:border-amber-500"
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
                        id="edit_cfg_{field.name}"
                        type={field.type}
                        bind:value={editConfigValues[field.name]}
                        class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500"
                      />
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Save button -->
        <div class="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            class="inline-flex items-center px-5 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if saving}
              <RefreshCw size={15} class="mr-2 animate-spin" />
              Saving...
            {:else}
              <Save size={15} class="mr-2" />
              Save Changes
            {/if}
          </button>
        </div>
      </div>
    </form>

    <!-- Recent Runs Card -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Clock size={18} class="text-gray-500" />
          Recent Collection Runs
        </h2>
        <button
          onclick={loadStatus}
          disabled={loadingStatus}
          class="inline-flex items-center text-sm text-amber-600 hover:text-amber-800 disabled:opacity-50"
        >
          <RefreshCw size={14} class="mr-1 {loadingStatus ? 'animate-spin' : ''}" />
          Refresh
        </button>
      </div>

      {#if loadingStatus}
        <div class="flex items-center gap-2 text-sm text-gray-500 py-4">
          <RefreshCw size={14} class="animate-spin" />
          Loading run history...
        </div>
      {:else if collectionStatus?.recent_runs && collectionStatus.recent_runs.length > 0}
        <div class="divide-y divide-gray-100">
          {#each collectionStatus.recent_runs as run (run.id)}
            <div class="py-3 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {runStatusColors[run.status] ?? 'bg-gray-100 text-gray-800'}"
                >
                  {run.status}
                </span>
                <span class="text-sm text-gray-600">{formatDate(run.started_at)}</span>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <span>{run.items_collected} items</span>
                {#if run.started_at && run.completed_at}
                  <span class="text-gray-400">{formatDuration(run.started_at, run.completed_at)}</span>
                {/if}
                {#if run.error}
                  <span class="text-red-500 flex items-center gap-1">
                    <AlertTriangle size={13} />
                    {run.error.slice(0, 50)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-8 text-gray-500">
          <Clock size={32} class="mx-auto mb-2 text-gray-300" />
          <p class="text-sm">No collection runs recorded yet.</p>
        </div>
      {/if}
    </div>

    <!-- Danger Zone -->
    <div class="bg-white rounded-lg shadow-sm border border-red-200 p-6">
      <h2 class="text-base font-semibold text-red-700 mb-1 flex items-center gap-2">
        <AlertTriangle size={18} />
        Danger Zone
      </h2>
      <p class="text-sm text-gray-600 mb-4">
        Permanently delete this evidence source. All associated collection rules will also be removed.
        This action cannot be undone.
      </p>
      <button
        onclick={handleDelete}
        disabled={deleting}
        class="inline-flex items-center px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
      >
        {#if deleting}
          <RefreshCw size={15} class="mr-2 animate-spin" />
          Deleting...
        {:else}
          <Trash2 size={15} class="mr-2" />
          Delete Source
        {/if}
      </button>
    </div>
  {/if}
</div>
