<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    Database,
    Plus,
    RefreshCw,
    Play,
    Pause,
    Settings,
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    ChevronRight,
    Cloud,
    Shield,
    FileCheck,
    Zap
  } from 'lucide-svelte';
  import { evidenceSourceApi, evidenceRuleApi, evidenceRunApi } from '$lib/services/evidence-automation/api';
  import type { EvidenceSource, EvidenceCollectionRule, EvidenceCollectionRun } from '$lib/services/evidence-automation/api';

  let sources: EvidenceSource[] = [];
  let rules: EvidenceCollectionRule[] = [];
  let recentRuns: EvidenceCollectionRun[] = [];
  let loading = true;
  let refreshing = false;

  // Statistics
  $: activeSources = sources.filter(s => s.status === 'active').length;
  $: enabledRules = rules.filter(r => r.enabled).length;
  $: successfulRuns = recentRuns.filter(r => r.status === 'success').length;

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
    api: Database,
  };

  async function loadData() {
    loading = true;
    try {
      const [sourcesRes, rulesRes, runsRes] = await Promise.all([
        evidenceSourceApi.list(),
        evidenceRuleApi.list(),
        evidenceRunApi.list({ limit: 10 }),
      ]);

      if (sourcesRes.success) {
        sources = sourcesRes.data?.results || [];
      }
      if (rulesRes.success) {
        rules = rulesRes.data?.results || [];
      }
      if (runsRes.success) {
        recentRuns = runsRes.data?.results || [];
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    refreshing = true;
    await loadData();
    refreshing = false;
  }

  async function toggleSource(source: EvidenceSource) {
    try {
      if (source.status === 'active') {
        await evidenceSourceApi.deactivate(source.id);
      } else {
        await evidenceSourceApi.activate(source.id);
      }
      await loadData();
    } catch (error) {
      console.error('Error toggling source:', error);
    }
  }

  async function runCollection(rule: EvidenceCollectionRule) {
    try {
      await evidenceRuleApi.run(rule.id);
      await loadData();
    } catch (error) {
      console.error('Error running collection:', error);
    }
  }

  function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  }

  onMount(() => {
    loadData();
  });
</script>

<svelte:head>
  <title>Evidence Automation - CISO Assistant</title>
</svelte:head>

<div class="evidence-automation">
  <!-- Header -->
  <div class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Zap class="text-amber-500" size={28} />
              Evidence Automation
            </h1>
            <p class="mt-1 text-sm text-gray-600">
              Configure and manage automated evidence collection from various sources
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              on:click={refresh}
              disabled={refreshing}
              class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={16} class="mr-2 {refreshing ? 'animate-spin' : ''}" />
              Refresh
            </button>
            <button
              on:click={() => goto('/evidence-automation/sources/new')}
              class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
            >
              <Plus size={16} class="mr-2" />
              Add Source
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-24">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      <span class="ml-3 text-gray-600">Loading automation data...</span>
    </div>
  {:else}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <!-- Statistics Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Total Sources</p>
              <p class="mt-2 text-3xl font-bold text-gray-900">{sources.length}</p>
            </div>
            <div class="p-3 bg-blue-100 rounded-full">
              <Database class="text-blue-600" size={24} />
            </div>
          </div>
          <div class="mt-2 text-sm text-green-600">
            {activeSources} active
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Collection Rules</p>
              <p class="mt-2 text-3xl font-bold text-gray-900">{rules.length}</p>
            </div>
            <div class="p-3 bg-purple-100 rounded-full">
              <Settings class="text-purple-600" size={24} />
            </div>
          </div>
          <div class="mt-2 text-sm text-green-600">
            {enabledRules} enabled
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Recent Runs</p>
              <p class="mt-2 text-3xl font-bold text-gray-900">{recentRuns.length}</p>
            </div>
            <div class="p-3 bg-green-100 rounded-full">
              <Play class="text-green-600" size={24} />
            </div>
          </div>
          <div class="mt-2 text-sm text-green-600">
            {successfulRuns} successful
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Evidence Collected</p>
              <p class="mt-2 text-3xl font-bold text-gray-900">
                {recentRuns.reduce((sum, r) => sum + r.items_collected, 0)}
              </p>
            </div>
            <div class="p-3 bg-amber-100 rounded-full">
              <FileCheck class="text-amber-600" size={24} />
            </div>
          </div>
          <div class="mt-2 text-sm text-gray-500">
            Last 10 runs
          </div>
        </div>
      </div>

      <!-- Sources Section -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Evidence Sources</h2>
          <button
            on:click={() => goto('/evidence-automation/sources')}
            class="text-sm text-amber-600 hover:text-amber-800 flex items-center"
          >
            View all <ChevronRight size={16} class="ml-1" />
          </button>
        </div>
        <div class="divide-y divide-gray-200">
          {#if sources.length === 0}
            <div class="px-6 py-12 text-center text-gray-500">
              <Database size={48} class="mx-auto mb-4 text-gray-300" />
              <p class="text-lg font-medium">No evidence sources configured</p>
              <p class="text-sm mt-1">Add a source to start collecting evidence automatically</p>
              <button
                on:click={() => goto('/evidence-automation/sources/new')}
                class="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
              >
                <Plus size={16} class="mr-2" />
                Add Your First Source
              </button>
            </div>
          {:else}
            {#each sources.slice(0, 5) as source}
              <div class="px-6 py-4 hover:bg-gray-50 flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="p-2 bg-gray-100 rounded-lg">
                    <svelte:component this={sourceIcons[source.source_type] || Database} size={20} class="text-gray-600" />
                  </div>
                  <div>
                    <p class="font-medium text-gray-900">{source.name}</p>
                    <p class="text-sm text-gray-500">{source.source_type_display}</p>
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  <span class={`px-2 py-1 text-xs font-medium rounded ${statusColors[source.status]}`}>
                    {source.status_display}
                  </span>
                  <span class="text-sm text-gray-500">
                    {source.rules_count} rules
                  </span>
                  <button
                    on:click={() => toggleSource(source)}
                    class="p-2 hover:bg-gray-100 rounded"
                    title={source.status === 'active' ? 'Deactivate' : 'Activate'}
                  >
                    {#if source.status === 'active'}
                      <Pause size={16} class="text-gray-600" />
                    {:else}
                      <Play size={16} class="text-green-600" />
                    {/if}
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Collection Rules Section -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Collection Rules</h2>
          <button
            on:click={() => goto('/evidence-automation/rules')}
            class="text-sm text-amber-600 hover:text-amber-800 flex items-center"
          >
            View all <ChevronRight size={16} class="ml-1" />
          </button>
        </div>
        <div class="divide-y divide-gray-200">
          {#if rules.length === 0}
            <div class="px-6 py-8 text-center text-gray-500">
              <p>No collection rules configured</p>
              <p class="text-sm mt-1">Create rules to define what evidence to collect</p>
            </div>
          {:else}
            {#each rules.slice(0, 5) as rule}
              <div class="px-6 py-4 hover:bg-gray-50 flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900">{rule.name}</p>
                  <p class="text-sm text-gray-500">
                    {rule.source_name} • {rule.collection_type_display}
                  </p>
                </div>
                <div class="flex items-center gap-4">
                  {#if rule.enabled}
                    <span class="flex items-center text-green-600 text-sm">
                      <CheckCircle size={14} class="mr-1" /> Enabled
                    </span>
                  {:else}
                    <span class="flex items-center text-gray-500 text-sm">
                      <XCircle size={14} class="mr-1" /> Disabled
                    </span>
                  {/if}
                  {#if rule.last_run}
                    <span class={`px-2 py-1 text-xs font-medium rounded ${runStatusColors[rule.last_run.status]}`}>
                      {rule.last_run.status}
                    </span>
                  {/if}
                  <button
                    on:click={() => runCollection(rule)}
                    class="p-2 hover:bg-gray-100 rounded text-amber-600"
                    title="Run now"
                  >
                    <Play size={16} />
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Recent Runs Section -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Recent Collection Runs</h2>
          <button
            on:click={() => goto('/evidence-automation/runs')}
            class="text-sm text-amber-600 hover:text-amber-800 flex items-center"
          >
            View all <ChevronRight size={16} class="ml-1" />
          </button>
        </div>
        <div class="divide-y divide-gray-200">
          {#if recentRuns.length === 0}
            <div class="px-6 py-8 text-center text-gray-500">
              <Clock size={32} class="mx-auto mb-2 text-gray-400" />
              <p>No collection runs yet</p>
            </div>
          {:else}
            {#each recentRuns as run}
              <div class="px-6 py-4 hover:bg-gray-50">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-medium text-gray-900">{run.rule_name}</p>
                    <p class="text-sm text-gray-500">
                      Started: {formatDate(run.started_at)}
                    </p>
                  </div>
                  <div class="flex items-center gap-4">
                    <span class={`px-2 py-1 text-xs font-medium rounded ${runStatusColors[run.status]}`}>
                      {run.status_display}
                    </span>
                    <span class="text-sm text-gray-600">
                      {run.items_collected} items
                    </span>
                  </div>
                </div>
                {#if run.error_message}
                  <div class="mt-2 text-sm text-red-600 flex items-center">
                    <AlertTriangle size={14} class="mr-1" />
                    {run.error_message}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
