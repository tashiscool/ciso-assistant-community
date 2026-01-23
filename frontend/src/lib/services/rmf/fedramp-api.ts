/**
 * FedRAMP KSI Dashboard API Client
 */

import { api } from '$lib/api';
import type { ApiResponse } from '$lib/api';

// TypeScript interfaces
export interface KSIMetric {
  name: string;
  value: number;
  target: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  trend_value: number;
  description: string;
  category: string;
}

export interface AuthorizationStatus {
  status: 'In Process' | 'Authorized' | 'Ready';
  impact_level: 'Low' | 'Moderate' | 'High';
  authorization_date: string;
  last_assessment_date: string;
  next_assessment_date: string;
  authorization_boundary: {
    cloud_provider: string;
    services_count: number;
    data_centers: string[];
  };
  agency_sponsors: string[];
}

export interface ControlFamily {
  name: string;
  total: number;
  compliant: number;
  partial: number;
  non_compliant: number;
}

export interface ControlCompliance {
  families: Record<string, ControlFamily>;
  summary: {
    total_controls: number;
    compliant: number;
    partial: number;
    non_compliant: number;
    compliance_rate: number;
  };
}

export interface VulnerabilitySeverity {
  open: number;
  remediated: number;
  overdue: number;
}

export interface VulnerabilitySummary {
  by_severity: {
    critical: VulnerabilitySeverity;
    high: VulnerabilitySeverity;
    medium: VulnerabilitySeverity;
    low: VulnerabilitySeverity;
  };
  total_open: number;
  total_remediated_30d: number;
  remediation_rate: number;
  avg_age_days: number;
  by_category: Record<string, number>;
  trend: {
    direction: string;
    change: number;
    period: string;
  };
}

export interface POAMStatus {
  total_items: number;
  by_status: {
    open: number;
    in_progress: number;
    completed: number;
    overdue: number;
  };
  by_risk: {
    high: number;
    moderate: number;
    low: number;
  };
  milestones: {
    total: number;
    completed: number;
    on_track: number;
    at_risk: number;
  };
  avg_age_days: number;
  trend: {
    new_30d: number;
    closed_30d: number;
  };
}

export interface ScanStatus {
  last_run: string;
  frequency: string;
  compliant: boolean;
  coverage?: number;
}

export interface ContinuousMonitoring {
  status: string;
  last_monthly_report: string;
  next_annual_assessment: string;
  scan_status: {
    vulnerability_scan: ScanStatus;
    configuration_scan: ScanStatus;
    penetration_test: ScanStatus;
  };
  deliverables: Record<string, { status: string; date: string | null }>;
}

export interface ScanCompliance {
  vulnerability_scans: ScanStatus & { next_due: string; required_frequency: string };
  configuration_scans: ScanStatus & { next_due: string; required_frequency: string };
  penetration_tests: ScanStatus & { next_due: string; required_frequency: string };
  web_application_scans: ScanStatus & { next_due: string; required_frequency: string };
}

export interface IncidentMetrics {
  total_incidents_ytd: number;
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  by_status: {
    open: number;
    investigating: number;
    contained: number;
    resolved: number;
  };
  avg_response_time_minutes: number;
  avg_resolution_time_hours: number;
  us_cert_reported: number;
  lessons_learned_completed: number;
}

export interface FedRAMPDashboardData {
  authorization_status: AuthorizationStatus;
  ksi_metrics: KSIMetric[];
  control_compliance: ControlCompliance;
  vulnerability_summary: VulnerabilitySummary;
  poam_status: POAMStatus;
  continuous_monitoring: ContinuousMonitoring;
  scan_compliance: ScanCompliance;
  incident_metrics: IncidentMetrics;
}

// API Functions
export const fedrampApi = {
  /**
   * Get complete FedRAMP KSI dashboard data
   */
  async getDashboard(params?: {
    system_group_id?: string;
    compliance_assessment_id?: string;
  }): Promise<ApiResponse<{ data: FedRAMPDashboardData }>> {
    return api.get('/rmf/fedramp/dashboard/', { params });
  },

  /**
   * Get KSI metrics only
   */
  async getKSIMetrics(category?: string): Promise<ApiResponse<{ metrics: KSIMetric[]; count: number }>> {
    const params = category ? { category } : undefined;
    return api.get('/rmf/fedramp/ksi-metrics/', { params });
  },

  /**
   * Get control compliance data
   */
  async getControlCompliance(): Promise<ApiResponse<{ data: ControlCompliance }>> {
    return api.get('/rmf/fedramp/control-compliance/');
  },

  /**
   * Get vulnerability summary
   */
  async getVulnerabilitySummary(): Promise<ApiResponse<{ data: VulnerabilitySummary }>> {
    return api.get('/rmf/fedramp/vulnerability-summary/');
  },

  /**
   * Get POA&M status
   */
  async getPOAMStatus(): Promise<ApiResponse<{ data: POAMStatus }>> {
    return api.get('/rmf/fedramp/poam-status/');
  },

  /**
   * Get continuous monitoring status
   */
  async getContinuousMonitoring(): Promise<ApiResponse<{
    data: {
      continuous_monitoring: ContinuousMonitoring;
      scan_compliance: ScanCompliance;
    };
  }>> {
    return api.get('/rmf/fedramp/continuous-monitoring/');
  },
};
