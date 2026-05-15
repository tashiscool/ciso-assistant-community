import { ApiClient } from '../../shared/api/client';
import type {
  SetupBrandingSnapshot,
  SetupClassificationSnapshot,
  SetupEmailSnapshot,
  SetupGeneralSnapshot,
  SetupLogsUtilizationSnapshot,
  SetupMfaSnapshot,
  SetupModulesFeaturesSnapshot,
  SetupRiskModelSnapshot,
  SetupSecuritySnapshot,
  SetupServiceAccountsSnapshot,
  SetupSsoSnapshot,
  SetupTagsSnapshot,
} from './types';

const client = new ApiClient();

export async function getSetupTags(): Promise<SetupTagsSnapshot> {
  const response = await client.get<{ data: SetupTagsSnapshot }>('/setup/tags');
  return response.data;
}

export async function createSetupTag(body: {
  title: string;
  type: 'User' | 'System';
  oscalRequired: boolean;
}): Promise<SetupTagsSnapshot> {
  const response = await client.post<{ data: SetupTagsSnapshot }>('/setup/tags', body);
  return response.data;
}

export async function updateSetupTag(
  tagId: string,
  body: {
    title: string;
    type: 'User' | 'System';
    oscalRequired: boolean;
  },
): Promise<SetupTagsSnapshot> {
  const response = await client.put<{ data: SetupTagsSnapshot }>(`/setup/tags/${tagId}`, body);
  return response.data;
}

export async function deleteSetupTag(tagId: string): Promise<SetupTagsSnapshot> {
  const response = await client.delete<{ data: SetupTagsSnapshot }>(`/setup/tags/${tagId}`);
  return response.data;
}

export async function getSetupServiceAccounts(): Promise<SetupServiceAccountsSnapshot> {
  const response = await client.get<{ data: SetupServiceAccountsSnapshot }>('/setup/service-accounts');
  return response.data;
}

export async function createSetupServiceAccount(body: {
  purpose: string;
  role: 'Administrator' | 'Automation Operator' | 'Read Only';
  durationDays: number;
}): Promise<SetupServiceAccountsSnapshot> {
  const response = await client.post<{ data: SetupServiceAccountsSnapshot }>('/setup/service-accounts', body);
  return response.data;
}

export async function rotateSetupServiceAccount(
  accountId: string,
  body?: {
    durationDays?: number;
  },
): Promise<SetupServiceAccountsSnapshot> {
  const response = await client.post<{ data: SetupServiceAccountsSnapshot }>(
    `/setup/service-accounts/${accountId}/rotate`,
    body,
  );
  return response.data;
}

export async function deleteSetupServiceAccount(accountId: string): Promise<SetupServiceAccountsSnapshot> {
  const response = await client.delete<{ data: SetupServiceAccountsSnapshot }>(
    `/setup/service-accounts/${accountId}`,
  );
  return response.data;
}

export async function getSetupLogsUtilization(): Promise<SetupLogsUtilizationSnapshot> {
  const response = await client.get<{ data: SetupLogsUtilizationSnapshot }>('/setup/logs-utilization');
  return response.data;
}

export async function getSetupSecurity(): Promise<SetupSecuritySnapshot> {
  const response = await client.get<{ data: SetupSecuritySnapshot }>('/setup/security');
  return response.data;
}

export async function updateSetupSecurityControl(
  controlId: string,
  body: {
    status?: string;
    ownerName?: string | null;
    description?: string;
    detail?: Record<string, unknown>;
  },
): Promise<SetupSecuritySnapshot> {
  const response = await client.put<{ data: SetupSecuritySnapshot }>(`/setup/security/${controlId}`, body);
  return response.data;
}

export async function getSetupModulesFeatures(): Promise<SetupModulesFeaturesSnapshot> {
  const response = await client.get<{ data: SetupModulesFeaturesSnapshot }>('/setup/modules-features');
  return response.data;
}

export async function updateSetupModulesFeatures(body: {
  enabledModuleIds: string[];
  enabledFeatureFlagIds: string[];
  regmlEnabled: boolean;
  regmlTermsAccepted: boolean;
  statusNote?: string | null;
}): Promise<SetupModulesFeaturesSnapshot> {
  const response = await client.put<{ data: SetupModulesFeaturesSnapshot }>('/setup/modules-features', body);
  return response.data;
}

export async function getSetupSso(): Promise<SetupSsoSnapshot> {
  const response = await client.get<{ data: SetupSsoSnapshot }>('/setup/sso');
  return response.data;
}

export async function updateSetupSso(body: {
  authProtocol: string;
  providerType: string;
  domainHint: string;
  clientId: string;
  callbackUrl: string;
  metadataUrl: string;
  rolesClaim: string;
  emailClaim: string;
  givenNameClaim: string;
  familyNameClaim: string;
  usernameClaim: string;
  buttonLabel: string;
  groupSyncEnabled: boolean;
  loginEnforced: boolean;
  allowLocalFallback: boolean;
  jitProvisioningEnabled: boolean;
  jitDefaultRoleNames: string[];
  status: string;
}): Promise<SetupSsoSnapshot> {
  const response = await client.put<{ data: SetupSsoSnapshot }>('/setup/sso', body);
  return response.data;
}

export async function getSetupMfa(): Promise<SetupMfaSnapshot> {
  const response = await client.get<{ data: SetupMfaSnapshot }>('/setup/mfa');
  return response.data;
}

export async function updateSetupMfa(body: {
  enforcement: string;
  methods: Record<string, boolean>;
  exemptServiceAccounts: string[];
  gracePeriodDays: number;
  targetCoverage: number;
  status: string;
}): Promise<SetupMfaSnapshot> {
  const response = await client.put<{ data: SetupMfaSnapshot }>('/setup/mfa', body);
  return response.data;
}

export async function getSetupEmail(): Promise<SetupEmailSnapshot> {
  const response = await client.get<{ data: SetupEmailSnapshot }>('/setup/email');
  return response.data;
}

export async function updateSetupEmail(body: {
  supportEmail: string;
  deliveryMode: string;
  status: string;
  statusNote: string;
}): Promise<SetupEmailSnapshot> {
  const response = await client.put<{ data: SetupEmailSnapshot }>('/setup/email', body);
  return response.data;
}

export async function getSetupClassification(): Promise<SetupClassificationSnapshot> {
  const response = await client.get<{ data: SetupClassificationSnapshot }>('/setup/classification');
  return response.data;
}

export async function createSetupClassification(body: {
  title: string;
  confidentiality: string;
  integrity: string;
  availability: string;
}): Promise<SetupClassificationSnapshot> {
  const response = await client.post<{ data: SetupClassificationSnapshot }>('/setup/classification', body);
  return response.data;
}

export async function updateSetupClassification(
  classificationId: string,
  body: {
    title: string;
    confidentiality: string;
    integrity: string;
    availability: string;
  },
): Promise<SetupClassificationSnapshot> {
  const response = await client.put<{ data: SetupClassificationSnapshot }>(
    `/setup/classification/${classificationId}`,
    body,
  );
  return response.data;
}

export async function deleteSetupClassification(classificationId: string): Promise<SetupClassificationSnapshot> {
  const response = await client.delete<{ data: SetupClassificationSnapshot }>(
    `/setup/classification/${classificationId}`,
  );
  return response.data;
}

export async function getSetupBranding(): Promise<SetupBrandingSnapshot> {
  const response = await client.get<{ data: SetupBrandingSnapshot }>('/setup/branding');
  return response.data;
}

export async function updateSetupBranding(body: {
  primaryLogoUrl: string;
  primaryLogoDarkUrl: string;
  faviconUrl: string;
  loginLogoUrl: string;
  backgroundImageUrl: string;
  primaryColor: string;
  accentColor: string;
  sidebarBackgroundColor: string;
  bannerColor: string;
  loginMessage: string;
  footerText: string;
  enableBackgroundBlur: boolean;
  enableBackgroundOverlay: boolean;
  showPoweredByRegovise: boolean;
}): Promise<SetupBrandingSnapshot> {
  const response = await client.put<{ data: SetupBrandingSnapshot }>('/setup/branding', body);
  return response.data;
}

export async function getSetupGeneral(): Promise<SetupGeneralSnapshot> {
  const response = await client.get<{ data: SetupGeneralSnapshot }>('/setup/general');
  return response.data;
}

export async function updateSetupGeneral(body: {
  organizationName: string;
  workspaceLabel: string;
  timezone: string;
  locale: string;
  dateFormat: string;
  fiscalYearStartMonth: string;
  defaultDueTime: string;
  defaultReviewerTeam: string;
  workingDays: string[];
  changeFreezeEnabled: boolean;
  changeFreezeWindow: string;
}): Promise<SetupGeneralSnapshot> {
  const response = await client.put<{ data: SetupGeneralSnapshot }>('/setup/general', body);
  return response.data;
}

export async function getSetupRiskModel(): Promise<SetupRiskModelSnapshot> {
  const response = await client.get<{ data: SetupRiskModelSnapshot }>('/setup/risk-model');
  return response.data;
}

export async function updateSetupRiskModel(body: {
  modelType: string;
  likelihoodScale: number;
  impactScale: number;
  acceptableMax: number;
  monitorMax: number;
  mitigateMax: number;
  formulaPreset: string;
  residualRiskMethod: string;
  inheritedRiskMethod: string;
  riskOwnerRole: string;
  autoEscalationEnabled: boolean;
  autoEscalationThreshold: string;
  autoEscalationDays: number;
}): Promise<SetupRiskModelSnapshot> {
  const response = await client.put<{ data: SetupRiskModelSnapshot }>('/setup/risk-model', body);
  return response.data;
}
