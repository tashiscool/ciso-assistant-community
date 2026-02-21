<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import {
    Database,
    Plus,
    RefreshCw,
    Play,
    Pause,
    Edit,
    Trash2,
    Wifi,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Cloud,
    Shield,
    Activity,
    Zap
  } from 'lucide-svelte';
  import { evidenceSourceApi } from '$lib/services/evidence-automation/api';
  import type { EvidenceSource } from '$lib/services/evidence-automation/api';

  let { data } = $props();

  let sources: EvidenceSource[] = $state(data.sources ?? []);
  let loading = $state(false);
  let refreshing = $state(false);
  let testingId = $state<string | null>(null);
  let testResult = $state<{ id: string; success: boolean; message: string } | null>(null);
  let deletingId = $state<string | null>(null);
  let togglingId = $state<string | null>(null);

  const totalSources = $derived(sources.length);
  const activeSources = $derived(sources.filter((s) => s.status === 'active').length);
  const errorSources = $derived(sources.filter((s) => s.status === 'error').length);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
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

  async function loadSources() {
    loading = true;
    try {
      const res = await evidenceSourceApi.list();
      if (res.success) {
        sources = res.data?.results ?? [];
      }
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    refreshing = true;
    await loadSources();
    refreshing = false;
  }

  async function testConnection(source: EvidenceSource) {
    testingId = source.id;
    testResult = null;
    try {
      const res = await evidenceSourceApi.testConnection(source.id);
      testResult = {
        id: source.id,
        success: res.data?.success ?? false,
        message: res.data?.error ?? (res.data?.success ? 'Connection successful' : 'Connection failed'),
      };
    } catch (error) {
      testResult = { id: source.id, success: false, message: 'Connection test failed' };
    } finally {
      testingId = null;
    }
  }

  async function toggleSource(source: EvidenceSource) {
    togglingId = source.id;
    try {
      if (source.status === 'active') {
        await evidenceSourceApi.deactivate(source.id);
      } else {
        await evidenceSourceApi.activate(source.id);
      }
      await loadSources();
    } catch (error) {
      console.error('Error toggling source:', error);
    } finally {
      togglingId = null;
    }
  }

  async function deleteSource(source: EvidenceSource) {
    if (!confirm(`Delete source "${source.name}"? This cannot be undone.`)) return;
    deletingId = source.id;
    try {
      await evidenceSourceApi.delete(source.id);
      sources = sources.filter((s) => s.id !== source.id);
    } catch (error) {
      console.error('Error deleting source:', error);
    } finally {
      deletingId = null;
    }
  }

  function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }
</script>

<svelte:head>
  <title>Evidence Sources - CISO Assistant</title>
</svelte:head>

<div class="evidence-sources">
  <!-- Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="py-6">
        <div class="flex items-center justify-between">
          <div>
            <nav class="text-sm text-gray-500 mb-1">
              <a href="{base}/evidence-automation" class="hover:text-amber-600">Evidence Automation</a>
              <span class="mx-2">/</span>
              <span class="text-gray-900">Sources</span>
            </nav>
            <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Database class="text-amber-500" size={28} />
              Evidence Sources
            </h1>
            <p class="mt-1 text-sm text-gray-600">
              Manage connections to external systems for automated evidence collection
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              onclick={refresh}
              disabled={refreshing}
              class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={16} class="mr-2 {refreshing ? 'animate-spin' : ''}" />
              Refresh
            </button>
            <a
              href="{base}/evidence-automation/sources/new"
              class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
            >
              <Plus size={16} class="mr-2" />
              Add Source
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Stats Row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">Total Sources</p>
            <p class="mt-2 text-3xl font-bold text-gray-900">{totalSources}</p>
          </div>
          <div class="p-3 bg-blue-100 rounded-full">
            <Database class="text-blue-600" size={24} />
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">Active Sources</p>
            <p class="mt-2 text-3xl font-bold text-green-700">{activeSources}</p>
          </div>
          <div class="p-3 bg-green-100 rounded-full">
            <CheckCircle class="text-green-600" size={24} />
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">Sources with Errors</p>
            <p class="mt-2 text-3xl font-bold text-red-700">{errorSources}</p>
          </div>
          <div class="p-3 bg-red-100 rounded-full">
            <AlertTriangle class="text-red-600" size={24} />
          </div>
        </div>
      </div>
    </div>

    <!-- Test result banner -->
    {#if testResult}
      <div class="rounded-md p-4 {testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
        <div class="flex items-center gap-2">
          {#if testResult.success}
            <CheckCircle size={18} class="text-green-600 flex-shrink-0" />
            <p class="text-sm font-medium text-green-800">{testResult.message}</p>
          {:else}
            <XCircle size={18} class="text-red-600 flex-shrink-0" />
            <p class="text-sm font-medium text-red-800">{testResult.message}</p>
          {/if}
          <button
            onclick={() => (testResult = null)}
            class="ml-auto text-gray-400 hover:text-gray-600"
          >
            <XCircle size={16} />
          </button>
        </div>
      </div>
    {/if}

    <!-- Sources Table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">All Sources</h2>
      </div>

      {#if loading}
        <div class="flex items-center justify-center py-16">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          <span class="ml-3 text-gray-600">Loading sources...</span>
        </div>
      {:else if sources.length === 0}
        <!-- Empty state -->
        <div class="px-6 py-16 text-center">
          <Database size={56} class="mx-auto mb-4 text-gray-300" />
          <p class="text-lg font-medium text-gray-700">No evidence sources configured</p>
          <p class="text-sm text-gray-500 mt-1">
            Add a source to start collecting evidence automatically from external systems
          </p>
          <a
            href="{base}/evidence-automation/sources/new"
            class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
          >
            <Plus size={16} class="mr-2" />
            Add Your First Source
          </a>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Collection
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rules
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each sources as source (source.id)}
                <tr class="hover:bg-gray-50">
                  <!-- Name + description -->
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                        <svelte:component
                          this={sourceIcons[source.source_type] ?? Database}
                          size={18}
                          class="text-gray-600"
                        />
                      </div>
                      <div>
                        <p class="text-sm font-medium text-gray-900">{source.name}</p>
                        {#if source.description}
                          <p class="text-xs text-gray-500 truncate max-w-xs">{source.description}</p>
                        {/if}
                      </div>
                    </div>
                  </td>

                  <!-- Type -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm text-gray-700">{source.source_type_display}</span>
                  </td>

                  <!-- Status badge -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex flex-col gap-1">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {statusColors[source.status] ?? 'bg-gray-100 text-gray-800'}"
                      >
                        {source.status_display}
                      </span>
                      {#if source.last_collection_status && source.last_collection_status !== source.status}
                        <span class="text-xs text-gray-400">
                          Last run: {source.last_collection_status}
                        </span>
                      {/if}
                    </div>
                  </td>

                  <!-- Last collection -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-1 text-sm text-gray-600">
                      <Clock size={14} class="text-gray-400" />
                      {formatDate(source.last_collection_at)}
                    </div>
                    {#if source.last_error}
                      <p class="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        {source.last_error.slice(0, 60)}{source.last_error.length > 60 ? '…' : ''}
                      </p>
                    {/if}
                  </td>

                  <!-- Rules count -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      {source.rules_count} rule{source.rules_count !== 1 ? 's' : ''}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="flex items-center justify-end gap-1">
                      <!-- Test connection -->
                      <button
                        onclick={() => testConnection(source)}
                        disabled={testingId === source.id}
                        class="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 disabled:opacity-40"
                        title="Test Connection"
                      >
                        {#if testingId === source.id}
                          <RefreshCw size={16} class="animate-spin" />
                        {:else}
                          <Wifi size={16} />
                        {/if}
                      </button>

                      <!-- Activate / Deactivate -->
                      <button
                        onclick={() => toggleSource(source)}
                        disabled={togglingId === source.id}
                        class="p-2 rounded hover:bg-gray-100 disabled:opacity-40 {source.status === 'active' ? 'text-green-600 hover:text-orange-600' : 'text-gray-400 hover:text-green-600'}"
                        title={source.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {#if togglingId === source.id}
                          <RefreshCw size={16} class="animate-spin" />
                        {:else if source.status === 'active'}
                          <Pause size={16} />
                        {:else}
                          <Play size={16} />
                        {/if}
                      </button>

                      <!-- Edit -->
                      <a
                        href="{base}/evidence-automation/sources/{source.id}"
                        class="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-amber-600"
                        title="Edit Source"
                      >
                        <Edit size={16} />
                      </a>

                      <!-- Delete -->
                      <button
                        onclick={() => deleteSource(source)}
                        disabled={deletingId === source.id}
                        class="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 disabled:opacity-40"
                        title="Delete Source"
                      >
                        {#if deletingId === source.id}
                          <RefreshCw size={16} class="animate-spin" />
                        {:else}
                          <Trash2 size={16} />
                        {/if}
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
