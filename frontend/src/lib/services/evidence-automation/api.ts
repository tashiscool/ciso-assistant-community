/**
 * Evidence Automation API Client
 *
 * Provides TypeScript interfaces and API functions for automated evidence collection.
 */

import { api } from '$lib/api';
import type { ApiResponse, PaginatedResponse } from '$lib/api';

// TypeScript interfaces
export type SourceType =
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'okta'
  | 'azure_ad'
  | 'github'
  | 'jira'
  | 'servicenow'
  | 'splunk'
  | 'qualys'
  | 'tenable'
  | 'crowdstrike'
  | 'api'
  | 'file'
  | 'manual';

export type SourceStatus = 'active' | 'inactive' | 'error' | 'pending';

export type CollectionType =
  | 'screenshot'
  | 'configuration'
  | 'log'
  | 'report'
  | 'policy'
  | 'inventory'
  | 'scan_result'
  | 'audit_log'
  | 'user_list'
  | 'certificate';

export type RunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

export interface EvidenceSource {
  id: string;
  name: string;
  description?: string;
  source_type: SourceType;
  source_type_display: string;
  status: SourceStatus;
  status_display: string;
  config: Record<string, any>;
  collection_enabled: boolean;
  collection_schedule?: string;
  last_collection_at?: string;
  last_collection_status?: string;
  last_error?: string;
  rules_count: number;
  created_at: string;
  updated_at: string;
  folder?: string;
}

export interface EvidenceCollectionRule {
  id: string;
  source: string;
  source_name: string;
  name: string;
  description?: string;
  collection_type: CollectionType;
  collection_type_display: string;
  query?: string;
  parameters: Record<string, any>;
  target_controls: string[];
  target_requirements: string[];
  enabled: boolean;
  schedule?: string;
  retention_days: number;
  last_run?: {
    id: string;
    status: RunStatus;
    started_at?: string;
    items_collected: number;
  };
  created_at: string;
  updated_at: string;
  folder?: string;
}

export interface EvidenceCollectionRun {
  id: string;
  rule: string;
  rule_name: string;
  status: RunStatus;
  status_display: string;
  started_at?: string;
  completed_at?: string;
  evidence_created?: string;
  items_collected: number;
  error_message?: string;
  run_log: Array<{ timestamp: string; message?: string; error?: string }>;
  created_at: string;
}

export interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'select';
  required: boolean;
  default?: string;
  options?: string[];
}

export interface SourceTypeInfo {
  value: SourceType;
  label: string;
  config_fields: ConfigField[];
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  details?: string[];
  [key: string]: any;
}

export interface CollectionStatus {
  source: {
    id: string;
    name: string;
    status: SourceStatus;
    last_collection?: string;
    last_status?: string;
    last_error?: string;
  };
  recent_runs: Array<{
    id: string;
    rule: string;
    status: RunStatus;
    started_at?: string;
    completed_at?: string;
    items_collected: number;
    error?: string;
  }>;
}

// API Functions

// Evidence Sources
export const evidenceSourceApi = {
  async list(params?: Record<string, any>): Promise<PaginatedResponse<EvidenceSource>> {
    return api.get('/evidence-automation/sources/', { params });
  },

  async create(data: Partial<EvidenceSource>): Promise<ApiResponse<EvidenceSource>> {
    return api.post('/evidence-automation/sources/', data);
  },

  async retrieve(id: string): Promise<ApiResponse<EvidenceSource>> {
    return api.get(`/evidence-automation/sources/${id}/`);
  },

  async update(id: string, data: Partial<EvidenceSource>): Promise<ApiResponse<EvidenceSource>> {
    return api.patch(`/evidence-automation/sources/${id}/`, data);
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return api.delete(`/evidence-automation/sources/${id}/`);
  },

  async testConnection(id: string): Promise<ApiResponse<ConnectionTestResult>> {
    return api.post(`/evidence-automation/sources/${id}/test_connection/`);
  },

  async getStatus(id: string): Promise<ApiResponse<CollectionStatus>> {
    return api.get(`/evidence-automation/sources/${id}/status/`);
  },

  async activate(id: string): Promise<ApiResponse<EvidenceSource>> {
    return api.post(`/evidence-automation/sources/${id}/activate/`);
  },

  async deactivate(id: string): Promise<ApiResponse<EvidenceSource>> {
    return api.post(`/evidence-automation/sources/${id}/deactivate/`);
  },
};

// Evidence Collection Rules
export const evidenceRuleApi = {
  async list(params?: Record<string, any>): Promise<PaginatedResponse<EvidenceCollectionRule>> {
    return api.get('/evidence-automation/rules/', { params });
  },

  async create(data: Partial<EvidenceCollectionRule>): Promise<ApiResponse<EvidenceCollectionRule>> {
    return api.post('/evidence-automation/rules/', data);
  },

  async retrieve(id: string): Promise<ApiResponse<EvidenceCollectionRule>> {
    return api.get(`/evidence-automation/rules/${id}/`);
  },

  async update(id: string, data: Partial<EvidenceCollectionRule>): Promise<ApiResponse<EvidenceCollectionRule>> {
    return api.patch(`/evidence-automation/rules/${id}/`, data);
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return api.delete(`/evidence-automation/rules/${id}/`);
  },

  async run(id: string, dryRun: boolean = false): Promise<ApiResponse<EvidenceCollectionRun>> {
    return api.post(`/evidence-automation/rules/${id}/run/`, { dry_run: dryRun });
  },

  async enable(id: string): Promise<ApiResponse<EvidenceCollectionRule>> {
    return api.post(`/evidence-automation/rules/${id}/enable/`);
  },

  async disable(id: string): Promise<ApiResponse<EvidenceCollectionRule>> {
    return api.post(`/evidence-automation/rules/${id}/disable/`);
  },
};

// Evidence Collection Runs
export const evidenceRunApi = {
  async list(params?: Record<string, any>): Promise<PaginatedResponse<EvidenceCollectionRun>> {
    return api.get('/evidence-automation/runs/', { params });
  },

  async retrieve(id: string): Promise<ApiResponse<EvidenceCollectionRun>> {
    return api.get(`/evidence-automation/runs/${id}/`);
  },
};

// Utility Functions
export const evidenceAutomationApi = {
  async testConnectionWithConfig(
    sourceType: SourceType,
    config: Record<string, any>
  ): Promise<ApiResponse<ConnectionTestResult>> {
    return api.post('/evidence-automation/test-connection/', {
      source_type: sourceType,
      config,
    });
  },

  async getSourceTypes(): Promise<ApiResponse<{ source_types: SourceTypeInfo[] }>> {
    return api.get('/evidence-automation/source-types/');
  },

  async getCollectionTypes(): Promise<ApiResponse<{
    collection_types: Array<{ value: string; label: string }>;
    source_specific: Record<string, Array<{ type: string; label: string }>>;
  }>> {
    return api.get('/evidence-automation/collection-types/');
  },
};

// Re-export all APIs
export {
  evidenceSourceApi as sources,
  evidenceRuleApi as rules,
  evidenceRunApi as runs,
};
