<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    Shield,
    TrendingUp,
    TrendingDown,
    Minus,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    FileText,
    Activity,
    BarChart3,
    Target,
    Calendar,
    Users
  } from 'lucide-svelte';
  import DonutChart from '$lib/components/Chart/DonutChart.svelte';
  import { fedrampApi } from '$lib/services/rmf/fedramp-api';
  import type { FedRAMPDashboardData, KSIMetric } from '$lib/services/rmf/fedramp-api';

  let dashboardData: FedRAMPDashboardData | null = null;
  let loading = true;
  let refreshing = false;
  let activeTab: 'overview' | 'ksi' | 'controls' | 'vulns' | 'poam' | 'conmon' = 'overview';

  const statusColors = {
    good: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };

  const trendIcons = {
    up: TrendingUp,
    down: TrendingDown,
    stable: Minus,
  };

  const impactColors = {
    Low: 'bg-green-500',
    Moderate: 'bg-yellow-500',
    High: 'bg-red-500',
  };

  async function loadDashboard() {
    loading = true;
    try {
      const response = await fedrampApi.getDashboard();
      if (response.success && response.data) {
        dashboardData = response.data.data;
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      loading = false;
    }
  }

  async function refresh() {
    refreshing = true;
    await loadDashboard();
    refreshing = false;
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  }

  function getMetricTrendColor(metric: KSIMetric): string {
    if (metric.status === 'good') {
      return metric.trend === 'down' ? 'text-green-600' : 'text-gray-500';
    }
    return metric.trend === 'down' ? 'text-green-600' : 'text-red-600';
  }

  onMount(() => {
    loadDashboard();
  });
</script>

<svelte:head>
  <title>FedRAMP KSI Dashboard - CISO Assistant</title>
</svelte:head>

<div class="fedramp-dashboard">
  <!-- Header -->
  <div class="bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold flex items-center gap-2">
              <Shield size={28} />
              FedRAMP KSI Dashboard
            </h1>
            <p class="mt-1 text-blue-100">
              Key Security Indicators for Continuous Monitoring
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              on:click={refresh}
              disabled={refreshing}
              class="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              <RefreshCw size={16} class="mr-2 {refreshing ? 'animate-spin' : ''}" />
              Refresh
            </button>
            <button
              on:click={() => goto('/rmf/ssp-generator')}
              class="inline-flex items-center px-4 py-2 bg-white text-blue-700 rounded-md shadow-sm text-sm font-medium hover:bg-blue-50"
            >
              <FileText size={16} class="mr-2" />
              Generate SSP
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <nav class="flex space-x-8">
        {#each [
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'ksi', label: 'KSI Metrics', icon: Target },
          { id: 'controls', label: 'Control Compliance', icon: Shield },
          { id: 'vulns', label: 'Vulnerabilities', icon: AlertTriangle },
          { id: 'poam', label: 'POA&M', icon: FileText },
          { id: 'conmon', label: 'ConMon Status', icon: Activity },
        ] as tab}
          <button
            on:click={() => activeTab = tab.id}
            class="flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors {activeTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          >
            <svelte:component this={tab.icon} size={16} />
            {tab.label}
          </button>
        {/each}
      </nav>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-24">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-gray-600">Loading FedRAMP dashboard...</span>
    </div>
  {:else if dashboardData}
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Overview Tab -->
      {#if activeTab === 'overview'}
        <!-- Authorization Status Card -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Authorization Status</h2>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Status</p>
                <p class="mt-1 text-2xl font-bold text-green-600">
                  {dashboardData.authorization_status.status}
                </p>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Impact Level</p>
                <div class="mt-1 flex items-center justify-center gap-2">
                  <span class={`w-3 h-3 rounded-full ${impactColors[dashboardData.authorization_status.impact_level]}`}></span>
                  <span class="text-2xl font-bold text-gray-900">
                    {dashboardData.authorization_status.impact_level}
                  </span>
                </div>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Last Assessment</p>
                <p class="mt-1 text-lg font-semibold text-gray-900">
                  {formatDate(dashboardData.authorization_status.last_assessment_date)}
                </p>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Next Assessment</p>
                <p class="mt-1 text-lg font-semibold text-gray-900">
                  {formatDate(dashboardData.authorization_status.next_assessment_date)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- KSI Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {#each dashboardData.ksi_metrics.slice(0, 4) as metric}
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-500">{metric.category.replace('_', ' ')}</span>
                <span class={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[metric.status]}`}>
                  {metric.status}
                </span>
              </div>
              <p class="text-sm font-medium text-gray-900 truncate" title={metric.name}>
                {metric.name}
              </p>
              <div class="mt-2 flex items-end justify-between">
                <p class="text-3xl font-bold text-gray-900">
                  {metric.value}{metric.unit === '%' ? '%' : ''}
                  {#if metric.unit !== '%'}
                    <span class="text-sm font-normal text-gray-500">{metric.unit}</span>
                  {/if}
                </p>
                <div class={`flex items-center ${getMetricTrendColor(metric)}`}>
                  <svelte:component this={trendIcons[metric.trend]} size={16} />
                  <span class="text-sm ml-1">{Math.abs(metric.trend_value)}</span>
                </div>
              </div>
              <div class="mt-2">
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>Target: {metric.target}{metric.unit === '%' ? '%' : ` ${metric.unit}`}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="h-2 rounded-full {metric.status === 'good' ? 'bg-green-500' : metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}"
                    style="width: {Math.min(100, (metric.value / metric.target) * 100)}%"
                  ></div>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Control Compliance Summary -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Control Compliance</h3>
            <div class="text-center mb-4">
              <p class="text-4xl font-bold text-gray-900">
                {dashboardData.control_compliance.summary.compliance_rate}%
              </p>
              <p class="text-sm text-gray-500">Overall Compliance</p>
            </div>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="flex items-center text-sm text-gray-600">
                  <CheckCircle size={14} class="text-green-500 mr-2" />
                  Compliant
                </span>
                <span class="font-medium">{dashboardData.control_compliance.summary.compliant}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="flex items-center text-sm text-gray-600">
                  <AlertTriangle size={14} class="text-yellow-500 mr-2" />
                  Partial
                </span>
                <span class="font-medium">{dashboardData.control_compliance.summary.partial}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="flex items-center text-sm text-gray-600">
                  <XCircle size={14} class="text-red-500 mr-2" />
                  Non-Compliant
                </span>
                <span class="font-medium">{dashboardData.control_compliance.summary.non_compliant}</span>
              </div>
            </div>
          </div>

          <!-- Vulnerability Summary -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Vulnerabilities</h3>
            <div class="text-center mb-4">
              <p class="text-4xl font-bold text-gray-900">
                {dashboardData.vulnerability_summary.total_open}
              </p>
              <p class="text-sm text-gray-500">Open Vulnerabilities</p>
            </div>
            <div class="grid grid-cols-4 gap-2">
              <div class="text-center p-2 bg-red-50 rounded">
                <p class="text-lg font-bold text-red-600">{dashboardData.vulnerability_summary.by_severity.critical.open}</p>
                <p class="text-xs text-red-700">Critical</p>
              </div>
              <div class="text-center p-2 bg-orange-50 rounded">
                <p class="text-lg font-bold text-orange-600">{dashboardData.vulnerability_summary.by_severity.high.open}</p>
                <p class="text-xs text-orange-700">High</p>
              </div>
              <div class="text-center p-2 bg-yellow-50 rounded">
                <p class="text-lg font-bold text-yellow-600">{dashboardData.vulnerability_summary.by_severity.medium.open}</p>
                <p class="text-xs text-yellow-700">Medium</p>
              </div>
              <div class="text-center p-2 bg-green-50 rounded">
                <p class="text-lg font-bold text-green-600">{dashboardData.vulnerability_summary.by_severity.low.open}</p>
                <p class="text-xs text-green-700">Low</p>
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between text-sm">
              <span class="text-gray-500">Remediation Rate</span>
              <span class="font-medium text-green-600">{dashboardData.vulnerability_summary.remediation_rate}%</span>
            </div>
          </div>

          <!-- POA&M Summary -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">POA&M Status</h3>
            <div class="text-center mb-4">
              <p class="text-4xl font-bold text-gray-900">
                {dashboardData.poam_status.total_items}
              </p>
              <p class="text-sm text-gray-500">Total POA&M Items</p>
            </div>
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">Open</span>
                <span class="font-medium">{dashboardData.poam_status.by_status.open}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">In Progress</span>
                <span class="font-medium">{dashboardData.poam_status.by_status.in_progress}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">Overdue</span>
                <span class="font-medium text-red-600">{dashboardData.poam_status.by_status.overdue}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">Completed</span>
                <span class="font-medium text-green-600">{dashboardData.poam_status.by_status.completed}</span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- KSI Metrics Tab -->
      {#if activeTab === 'ksi'}
        <div class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-900">Key Security Indicators</h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {#each dashboardData.ksi_metrics as metric}
              <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex items-start justify-between mb-4">
                  <div>
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[metric.status]}`}>
                      {metric.status}
                    </span>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">{metric.name}</h3>
                    <p class="text-sm text-gray-500">{metric.description}</p>
                  </div>
                  <div class={`flex items-center ${getMetricTrendColor(metric)}`}>
                    <svelte:component this={trendIcons[metric.trend]} size={20} />
                    <span class="ml-1 text-sm font-medium">{Math.abs(metric.trend_value)}</span>
                  </div>
                </div>

                <div class="flex items-end justify-between">
                  <div>
                    <p class="text-3xl font-bold text-gray-900">
                      {metric.value}
                      <span class="text-lg font-normal text-gray-500">{metric.unit}</span>
                    </p>
                    <p class="text-sm text-gray-500">Target: {metric.target} {metric.unit}</p>
                  </div>
                  <span class="text-xs text-gray-400 uppercase">{metric.category.replace('_', ' ')}</span>
                </div>

                <div class="mt-4">
                  <div class="w-full bg-gray-200 rounded-full h-3">
                    <div
                      class="h-3 rounded-full transition-all duration-500 {metric.status === 'good' ? 'bg-green-500' : metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}"
                      style="width: {Math.min(100, (metric.value / metric.target) * 100)}%"
                    ></div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Control Compliance Tab -->
      {#if activeTab === 'controls'}
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-gray-900">Control Compliance by Family</h2>
            <div class="text-right">
              <p class="text-3xl font-bold text-gray-900">{dashboardData.control_compliance.summary.compliance_rate}%</p>
              <p class="text-sm text-gray-500">Overall Compliance</p>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Family</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Compliant</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Partial</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Non-Compliant</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {#each Object.entries(dashboardData.control_compliance.families) as [code, family]}
                  {@const rate = Math.round((family.compliant / family.total) * 100)}
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <span class="font-medium text-gray-900">{code}</span>
                        <span class="ml-2 text-sm text-gray-500">{family.name}</span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-center text-sm text-gray-900">{family.total}</td>
                    <td class="px-6 py-4 text-center">
                      <span class="text-green-600 font-medium">{family.compliant}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="text-yellow-600 font-medium">{family.partial}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class="text-red-600 font-medium">{family.non_compliant}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <span class={`font-medium ${rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {rate}%
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div
                          class="h-2 rounded-full {rate >= 90 ? 'bg-green-500' : rate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}"
                          style="width: {rate}%"
                        ></div>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <!-- Vulnerabilities Tab -->
      {#if activeTab === 'vulns'}
        <div class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-900">Vulnerability Management</h2>

          <!-- Summary Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p class="text-sm text-gray-500">Total Open</p>
              <p class="mt-2 text-3xl font-bold text-gray-900">{dashboardData.vulnerability_summary.total_open}</p>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p class="text-sm text-gray-500">Remediated (30d)</p>
              <p class="mt-2 text-3xl font-bold text-green-600">{dashboardData.vulnerability_summary.total_remediated_30d}</p>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p class="text-sm text-gray-500">Remediation Rate</p>
              <p class="mt-2 text-3xl font-bold text-blue-600">{dashboardData.vulnerability_summary.remediation_rate}%</p>
            </div>
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p class="text-sm text-gray-500">Avg Age</p>
              <p class="mt-2 text-3xl font-bold text-gray-900">{dashboardData.vulnerability_summary.avg_age_days} <span class="text-lg font-normal">days</span></p>
            </div>
          </div>

          <!-- By Severity -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">By Severity</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              {#each [
                { name: 'Critical', data: dashboardData.vulnerability_summary.by_severity.critical, color: 'red' },
                { name: 'High', data: dashboardData.vulnerability_summary.by_severity.high, color: 'orange' },
                { name: 'Medium', data: dashboardData.vulnerability_summary.by_severity.medium, color: 'yellow' },
                { name: 'Low', data: dashboardData.vulnerability_summary.by_severity.low, color: 'green' },
              ] as item}
                <div class={`p-4 bg-${item.color}-50 rounded-lg border border-${item.color}-200`}>
                  <p class={`text-lg font-bold text-${item.color}-600`}>{item.name}</p>
                  <div class="mt-2 space-y-1 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-600">Open</span>
                      <span class="font-medium">{item.data.open}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Remediated</span>
                      <span class="font-medium text-green-600">{item.data.remediated}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Overdue</span>
                      <span class="font-medium text-red-600">{item.data.overdue}</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- By Category -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">By Category</h3>
            <div class="space-y-3">
              {#each Object.entries(dashboardData.vulnerability_summary.by_category) as [category, count]}
                <div class="flex items-center">
                  <span class="w-32 text-sm text-gray-600">{category}</span>
                  <div class="flex-1 mx-4">
                    <div class="w-full bg-gray-200 rounded-full h-4">
                      <div
                        class="h-4 rounded-full bg-blue-500"
                        style="width: {(count / dashboardData.vulnerability_summary.total_open) * 100}%"
                      ></div>
                    </div>
                  </div>
                  <span class="font-medium text-gray-900">{count}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <!-- POA&M Tab -->
      {#if activeTab === 'poam'}
        <div class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-900">Plan of Action & Milestones</h2>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Status Summary -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Status Summary</h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="text-center p-4 bg-blue-50 rounded-lg">
                  <p class="text-3xl font-bold text-blue-600">{dashboardData.poam_status.by_status.open}</p>
                  <p class="text-sm text-blue-700">Open</p>
                </div>
                <div class="text-center p-4 bg-yellow-50 rounded-lg">
                  <p class="text-3xl font-bold text-yellow-600">{dashboardData.poam_status.by_status.in_progress}</p>
                  <p class="text-sm text-yellow-700">In Progress</p>
                </div>
                <div class="text-center p-4 bg-red-50 rounded-lg">
                  <p class="text-3xl font-bold text-red-600">{dashboardData.poam_status.by_status.overdue}</p>
                  <p class="text-sm text-red-700">Overdue</p>
                </div>
                <div class="text-center p-4 bg-green-50 rounded-lg">
                  <p class="text-3xl font-bold text-green-600">{dashboardData.poam_status.by_status.completed}</p>
                  <p class="text-sm text-green-700">Completed</p>
                </div>
              </div>
            </div>

            <!-- Risk Distribution -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">By Risk Level</h3>
              <div class="space-y-4">
                {#each [
                  { label: 'High Risk', value: dashboardData.poam_status.by_risk.high, color: 'red' },
                  { label: 'Moderate Risk', value: dashboardData.poam_status.by_risk.moderate, color: 'yellow' },
                  { label: 'Low Risk', value: dashboardData.poam_status.by_risk.low, color: 'green' },
                ] as item}
                  <div>
                    <div class="flex justify-between mb-1">
                      <span class="text-sm text-gray-600">{item.label}</span>
                      <span class="font-medium">{item.value}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div
                        class={`h-2 rounded-full bg-${item.color}-500`}
                        style="width: {(item.value / dashboardData.poam_status.total_items) * 100}%"
                      ></div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Milestones -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Milestone Tracking</h3>
              <div class="text-center mb-4">
                <p class="text-4xl font-bold text-gray-900">
                  {Math.round((dashboardData.poam_status.milestones.completed / dashboardData.poam_status.milestones.total) * 100)}%
                </p>
                <p class="text-sm text-gray-500">Milestone Completion</p>
              </div>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Total</span>
                  <span class="font-medium">{dashboardData.poam_status.milestones.total}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Completed</span>
                  <span class="font-medium text-green-600">{dashboardData.poam_status.milestones.completed}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">On Track</span>
                  <span class="font-medium text-blue-600">{dashboardData.poam_status.milestones.on_track}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">At Risk</span>
                  <span class="font-medium text-red-600">{dashboardData.poam_status.milestones.at_risk}</span>
                </div>
              </div>
            </div>

            <!-- Trend -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">30-Day Trend</h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="text-center p-4 bg-red-50 rounded-lg">
                  <p class="text-2xl font-bold text-red-600">+{dashboardData.poam_status.trend.new_30d}</p>
                  <p class="text-sm text-red-700">New Items</p>
                </div>
                <div class="text-center p-4 bg-green-50 rounded-lg">
                  <p class="text-2xl font-bold text-green-600">-{dashboardData.poam_status.trend.closed_30d}</p>
                  <p class="text-sm text-green-700">Closed Items</p>
                </div>
              </div>
              <div class="mt-4 text-center">
                <p class="text-sm text-gray-500">Average Age</p>
                <p class="text-xl font-bold text-gray-900">{dashboardData.poam_status.avg_age_days} days</p>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Continuous Monitoring Tab -->
      {#if activeTab === 'conmon'}
        <div class="space-y-6">
          <h2 class="text-xl font-semibold text-gray-900">Continuous Monitoring Status</h2>

          <!-- ConMon Status -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-lg font-semibold text-gray-900">Program Status</h3>
                <p class="text-sm text-gray-500">FedRAMP Continuous Monitoring Program</p>
              </div>
              <span class="px-4 py-2 bg-green-100 text-green-800 rounded-full font-medium">
                {dashboardData.continuous_monitoring.status}
              </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Last Monthly Report</p>
                <p class="mt-1 text-lg font-semibold text-gray-900">
                  {formatDate(dashboardData.continuous_monitoring.last_monthly_report)}
                </p>
              </div>
              <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Next Annual Assessment</p>
                <p class="mt-1 text-lg font-semibold text-gray-900">
                  {formatDate(dashboardData.continuous_monitoring.next_annual_assessment)}
                </p>
              </div>
              <div class="p-4 bg-gray-50 rounded-lg">
                <p class="text-sm text-gray-500">Deliverables Status</p>
                <p class="mt-1 text-lg font-semibold text-green-600">On Track</p>
              </div>
            </div>
          </div>

          <!-- Scan Compliance -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Scan Compliance</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {#each [
                { name: 'Vulnerability Scans', data: dashboardData.scan_compliance.vulnerability_scans },
                { name: 'Configuration Scans', data: dashboardData.scan_compliance.configuration_scans },
                { name: 'Penetration Tests', data: dashboardData.scan_compliance.penetration_tests },
                { name: 'Web Application Scans', data: dashboardData.scan_compliance.web_application_scans },
              ] as scan}
                <div class="p-4 border border-gray-200 rounded-lg">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="font-medium text-gray-900">{scan.name}</h4>
                    {#if scan.data.compliant}
                      <span class="flex items-center text-green-600 text-sm">
                        <CheckCircle size={16} class="mr-1" />
                        Compliant
                      </span>
                    {:else}
                      <span class="flex items-center text-red-600 text-sm">
                        <XCircle size={16} class="mr-1" />
                        Non-Compliant
                      </span>
                    {/if}
                  </div>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-500">Frequency</span>
                      <span class="text-gray-900">{scan.data.required_frequency}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">Last Run</span>
                      <span class="text-gray-900">{formatDate(scan.data.last_run)}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">Next Due</span>
                      <span class="text-gray-900">{formatDate(scan.data.next_due)}</span>
                    </div>
                    {#if scan.data.coverage !== undefined}
                      <div class="flex justify-between">
                        <span class="text-gray-500">Coverage</span>
                        <span class="text-gray-900">{scan.data.coverage}%</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Incident Metrics -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Incident Metrics (YTD)</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-3xl font-bold text-gray-900">{dashboardData.incident_metrics.total_incidents_ytd}</p>
                <p class="text-sm text-gray-500">Total Incidents</p>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-3xl font-bold text-blue-600">{dashboardData.incident_metrics.avg_response_time_minutes}</p>
                <p class="text-sm text-gray-500">Avg Response (min)</p>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-3xl font-bold text-green-600">{dashboardData.incident_metrics.avg_resolution_time_hours}</p>
                <p class="text-sm text-gray-500">Avg Resolution (hrs)</p>
              </div>
              <div class="text-center p-4 bg-gray-50 rounded-lg">
                <p class="text-3xl font-bold text-purple-600">{dashboardData.incident_metrics.us_cert_reported}</p>
                <p class="text-sm text-gray-500">US-CERT Reported</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="flex items-center justify-center py-24 text-gray-500">
      <AlertTriangle size={24} class="mr-2" />
      <span>Failed to load dashboard data. Please try again.</span>
    </div>
  {/if}
</div>
