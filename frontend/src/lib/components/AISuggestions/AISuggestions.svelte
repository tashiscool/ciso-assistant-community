<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Lightbulb,
    Shield,
    FileCheck,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Sparkles,
    RefreshCw,
    CheckCircle,
    X
  } from 'lucide-svelte';
  import type { Suggestion, SuggestionType } from '$lib/services/ai/api';
  import {
    getRequirementSuggestions,
    getRiskSuggestions,
    getControlSuggestions,
    getComplianceGapAnalysis
  } from '$lib/services/ai/api';

  // Props
  export let entityType: 'requirement_assessment' | 'risk_scenario' | 'applied_control' | 'compliance_assessment';
  export let entityId: string;
  export let autoLoad = true;
  export let collapsible = true;
  export let maxSuggestions = 5;

  // State
  let suggestions: Suggestion[] = [];
  let loading = false;
  let error: string | null = null;
  let expanded = true;
  let dismissedIds = new Set<number>();

  // Icons for suggestion types
  const typeIcons: Record<SuggestionType, typeof Lightbulb> = {
    control_recommendation: Shield,
    evidence_suggestion: FileCheck,
    remediation_guidance: AlertTriangle,
    risk_mitigation: Shield,
    implementation_guidance: Lightbulb,
    compliance_gap: AlertTriangle,
  };

  const typeLabels: Record<SuggestionType, string> = {
    control_recommendation: 'Control Recommendation',
    evidence_suggestion: 'Evidence Suggestion',
    remediation_guidance: 'Remediation Guidance',
    risk_mitigation: 'Risk Mitigation',
    implementation_guidance: 'Implementation Guidance',
    compliance_gap: 'Compliance Gap',
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  };

  async function loadSuggestions() {
    loading = true;
    error = null;

    try {
      let response;

      switch (entityType) {
        case 'requirement_assessment':
          response = await getRequirementSuggestions(entityId);
          break;
        case 'risk_scenario':
          response = await getRiskSuggestions(entityId);
          break;
        case 'applied_control':
          response = await getControlSuggestions(entityId);
          break;
        case 'compliance_assessment':
          response = await getComplianceGapAnalysis(entityId);
          break;
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }

      if (response.success && response.data) {
        suggestions = response.data.suggestions || [];
      } else {
        error = 'Failed to load suggestions';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load suggestions';
    } finally {
      loading = false;
    }
  }

  function dismissSuggestion(index: number) {
    dismissedIds.add(index);
    dismissedIds = dismissedIds;
  }

  function getVisibleSuggestions() {
    return suggestions
      .filter((_, i) => !dismissedIds.has(i))
      .slice(0, maxSuggestions);
  }

  function toggleExpanded() {
    if (collapsible) {
      expanded = !expanded;
    }
  }

  onMount(() => {
    if (autoLoad && entityId) {
      loadSuggestions();
    }
  });

  $: visibleSuggestions = getVisibleSuggestions();
</script>

<div class="ai-suggestions bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
  <!-- Header -->
  <div
    class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200"
    class:cursor-pointer={collapsible}
    on:click={toggleExpanded}
    on:keypress={(e) => e.key === 'Enter' && toggleExpanded()}
    role={collapsible ? 'button' : undefined}
    tabindex={collapsible ? 0 : undefined}
  >
    <div class="flex items-center gap-2">
      <Sparkles class="text-purple-600" size={20} />
      <h3 class="text-sm font-semibold text-gray-900">AI Suggestions</h3>
      {#if suggestions.length > 0}
        <span class="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
          {visibleSuggestions.length}
        </span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <button
        on:click|stopPropagation={loadSuggestions}
        class="p-1 text-gray-500 hover:text-purple-600 transition-colors"
        title="Refresh suggestions"
        disabled={loading}
      >
        <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
      </button>
      {#if collapsible}
        {#if expanded}
          <ChevronUp size={16} class="text-gray-500" />
        {:else}
          <ChevronDown size={16} class="text-gray-500" />
        {/if}
      {/if}
    </div>
  </div>

  <!-- Content -->
  {#if expanded}
    <div class="p-4">
      {#if loading}
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span class="ml-3 text-gray-600 text-sm">Analyzing and generating suggestions...</span>
        </div>
      {:else if error}
        <div class="flex items-center justify-center py-6 text-red-600">
          <AlertTriangle size={20} class="mr-2" />
          <span class="text-sm">{error}</span>
        </div>
      {:else if visibleSuggestions.length === 0}
        <div class="text-center py-6 text-gray-500">
          <Lightbulb size={32} class="mx-auto mb-2 text-gray-400" />
          <p class="text-sm">No suggestions available at this time.</p>
          <p class="text-xs mt-1">Complete more requirements or add context to get personalized recommendations.</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each visibleSuggestions as suggestion, index}
            <div class="suggestion-card border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors relative">
              <!-- Dismiss button -->
              <button
                on:click={() => dismissSuggestion(index)}
                class="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Dismiss suggestion"
              >
                <X size={14} />
              </button>

              <!-- Header -->
              <div class="flex items-start gap-3 mb-2 pr-6">
                <div class="p-1.5 bg-purple-100 rounded-md">
                  <svelte:component this={typeIcons[suggestion.type] || Lightbulb} size={16} class="text-purple-600" />
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-medium text-purple-600">
                      {typeLabels[suggestion.type] || suggestion.type}
                    </span>
                    <span class={`px-1.5 py-0.5 text-xs font-medium rounded border ${priorityColors[suggestion.priority]}`}>
                      {suggestion.priority}
                    </span>
                    <span class="text-xs text-gray-400">
                      {Math.round(suggestion.confidence * 100)}% confidence
                    </span>
                  </div>
                  <h4 class="text-sm font-medium text-gray-900">{suggestion.title}</h4>
                </div>
              </div>

              <!-- Description -->
              <p class="text-sm text-gray-600 mb-3 ml-9">{suggestion.description}</p>

              <!-- Action Items -->
              {#if suggestion.action_items && suggestion.action_items.length > 0}
                <div class="ml-9">
                  <p class="text-xs font-medium text-gray-700 mb-1">Recommended Actions:</p>
                  <ul class="space-y-1">
                    {#each suggestion.action_items.slice(0, 4) as action}
                      <li class="flex items-start gap-2 text-xs text-gray-600">
                        <CheckCircle size={12} class="text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{action}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        {#if suggestions.length > maxSuggestions}
          <div class="mt-3 text-center">
            <button
              on:click={() => maxSuggestions += 5}
              class="text-sm text-purple-600 hover:text-purple-800"
            >
              Show more suggestions ({suggestions.length - maxSuggestions} remaining)
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .suggestion-card:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
</style>
