/**
 * AI Assistant API Client
 *
 * Provides TypeScript interfaces and API functions for AI-powered suggestions.
 */

import { api } from '$lib/api';
import type { ApiResponse } from '$lib/api';

// TypeScript interfaces for AI suggestions
export interface Suggestion {
  type: SuggestionType;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  action_items: string[];
  related_resources: { title: string; url: string }[];
  metadata: Record<string, any>;
}

export type SuggestionType =
  | 'control_recommendation'
  | 'evidence_suggestion'
  | 'remediation_guidance'
  | 'risk_mitigation'
  | 'implementation_guidance'
  | 'compliance_gap';

export interface SuggestionsResponse {
  success: boolean;
  suggestions: Suggestion[];
  count: number;
  summary?: {
    total_gaps: number;
    missing_evidence: number;
  };
}

export interface BulkSuggestionsRequest {
  entities: Array<{
    type: string;
    id: string;
  }>;
}

export interface BulkSuggestionsResponse {
  success: boolean;
  results: Array<{
    entity_type: string;
    entity_id: string;
    suggestions?: Suggestion[];
    count?: number;
    error?: string;
  }>;
  total_entities: number;
}

// API Functions

/**
 * Get AI suggestions for a requirement assessment
 */
export async function getRequirementSuggestions(
  requirementAssessmentId: string,
  suggestionTypes?: SuggestionType[]
): Promise<ApiResponse<SuggestionsResponse>> {
  const params: Record<string, string> = {};
  if (suggestionTypes && suggestionTypes.length > 0) {
    params.suggestion_types = suggestionTypes.join(',');
  }
  return api.get(`/ai/requirement-assessments/${requirementAssessmentId}/suggestions/`, { params });
}

/**
 * Get AI suggestions for a risk scenario
 */
export async function getRiskSuggestions(
  riskScenarioId: string,
  suggestionTypes?: SuggestionType[]
): Promise<ApiResponse<SuggestionsResponse>> {
  const params: Record<string, string> = {};
  if (suggestionTypes && suggestionTypes.length > 0) {
    params.suggestion_types = suggestionTypes.join(',');
  }
  return api.get(`/ai/risk-scenarios/${riskScenarioId}/suggestions/`, { params });
}

/**
 * Get AI suggestions for an applied control
 */
export async function getControlSuggestions(
  appliedControlId: string
): Promise<ApiResponse<SuggestionsResponse>> {
  return api.get(`/ai/applied-controls/${appliedControlId}/suggestions/`);
}

/**
 * Get AI suggestions for evidence collection
 */
export async function getEvidenceSuggestions(
  entityId: string,
  entityType: 'requirement_assessment' | 'applied_control' | 'evidence' = 'requirement_assessment'
): Promise<ApiResponse<SuggestionsResponse>> {
  return api.get(`/ai/entities/${entityId}/evidence-suggestions/`, {
    params: { entity_type: entityType }
  });
}

/**
 * Get compliance gap analysis for a compliance assessment
 */
export async function getComplianceGapAnalysis(
  complianceAssessmentId: string
): Promise<ApiResponse<SuggestionsResponse>> {
  return api.get(`/ai/compliance-assessments/${complianceAssessmentId}/gap-analysis/`);
}

/**
 * Get bulk suggestions for multiple entities
 */
export async function getBulkSuggestions(
  entities: BulkSuggestionsRequest['entities']
): Promise<ApiResponse<BulkSuggestionsResponse>> {
  return api.post('/ai/bulk-suggestions/', { entities });
}

// Export as a namespace for convenience
export const aiApi = {
  getRequirementSuggestions,
  getRiskSuggestions,
  getControlSuggestions,
  getEvidenceSuggestions,
  getComplianceGapAnalysis,
  getBulkSuggestions,
};
