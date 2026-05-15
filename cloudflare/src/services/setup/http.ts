import { requireRootAdminAccess } from '../../authorization';
import type { WorkerRequestContext } from '../../router';
import { getEmailRuntimeSummary } from '../../email';
import type { EnvBindings } from '../../types/env';
import { json, methodNotAllowed, readJson } from '../../utils/http';
import { isRunnableOidcConfig, normalizeAuthProtocol, type OidcConfigRecord } from '../core/oidc';

type SetupTagRow = {
  id: string;
  tenant_id: string;
  title: string;
  tag_type: string;
  oscal_required: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

type SetupServiceAccountRow = {
  id: string;
  tenant_id: string;
  token_prefix: string;
  purpose: string;
  role_name: string;
  runtime: string;
  scopes_json: string;
  expires_at: string;
  last_used_at: string | null;
  last_rotated_at: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type SetupSecurityControlRow = {
  id: string;
  tenant_id: string;
  control_key: string;
  title: string;
  category: string;
  status: string;
  owner_name: string | null;
  description: string;
  detail_json: string;
  created_at: string;
  updated_at: string;
};

type SetupModulesFeaturesRow = {
  tenant_id: string;
  enabled_modules_json: string;
  feature_flags_json: string;
  regml_enabled: number;
  regml_terms_accepted: number;
  status_note: string | null;
  created_at: string;
  updated_at: string;
};

type SetupSsoConfigRow = {
  tenant_id: string;
  provider_type: string;
  auth_protocol: string;
  domain_hint: string | null;
  client_id: string | null;
  callback_url: string | null;
  metadata_url: string | null;
  group_sync_enabled: number;
  login_enforced: number;
  roles_claim: string | null;
  email_claim: string | null;
  given_name_claim: string | null;
  family_name_claim: string | null;
  username_claim: string | null;
  button_label: string | null;
  allow_local_fallback: number;
  jit_provisioning_enabled: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type SetupMfaPolicyRow = {
  tenant_id: string;
  enforcement: string;
  methods_json: string;
  exempt_service_accounts_json: string;
  grace_period_days: number;
  target_coverage: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type SetupEmailConfigRow = {
  tenant_id: string;
  support_email: string | null;
  delivery_mode: string;
  status: string;
  status_note: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type SetupClassificationRow = {
  id: string;
  tenant_id: string;
  title: string;
  confidentiality: string;
  integrity: string;
  availability: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

type SetupBrandingRow = {
  tenant_id: string;
  primary_logo_url: string | null;
  primary_logo_dark_url: string | null;
  favicon_url: string | null;
  login_logo_url: string | null;
  background_image_url: string | null;
  primary_color: string;
  accent_color: string;
  sidebar_background_color: string;
  banner_color: string;
  login_message: string;
  footer_text: string;
  enable_background_blur: number;
  enable_background_overlay: number;
  show_powered_by_regovise: number;
  created_at: string;
  updated_at: string;
};

type SetupGeneralConfigRow = {
  tenant_id: string;
  organization_name: string;
  workspace_label: string;
  timezone: string;
  locale: string;
  date_format: string;
  fiscal_year_start_month: string;
  default_due_time: string;
  default_reviewer_team: string;
  working_days_json: string;
  change_freeze_enabled: number;
  change_freeze_window: string | null;
  created_at: string;
  updated_at: string;
};

type SetupRiskModelRow = {
  tenant_id: string;
  model_type: string;
  likelihood_scale: number;
  impact_scale: number;
  acceptable_max: number;
  monitor_max: number;
  mitigate_max: number;
  formula_preset: string;
  residual_risk_method: string;
  inherited_risk_method: string;
  risk_owner_role: string;
  auto_escalation_enabled: number;
  auto_escalation_threshold: string;
  auto_escalation_days: number;
  created_at: string;
  updated_at: string;
};

type RegmlSettingsStateRow = {
  enabled: number;
  terms_accepted: number;
  deployment_mode: string;
  backend_available: number;
};

type CountRow = {
  total: number | null;
};

type TagPayload = {
  title?: string;
  type?: 'User' | 'System';
  oscalRequired?: boolean;
};

type CreateServiceAccountPayload = {
  purpose?: string;
  role?: 'Administrator' | 'Automation Operator' | 'Read Only';
  durationDays?: number;
};

type UpdateSecurityControlPayload = {
  status?: string;
  ownerName?: string | null;
  description?: string;
  detail?: Record<string, unknown>;
};

type UpdateModulesFeaturesPayload = {
  enabledModuleIds?: string[];
  enabledFeatureFlagIds?: string[];
  regmlEnabled?: boolean;
  regmlTermsAccepted?: boolean;
  statusNote?: string | null;
};

type UpdateSsoPayload = {
  authProtocol?: string;
  providerType?: string;
  domainHint?: string | null;
  clientId?: string | null;
  callbackUrl?: string | null;
  metadataUrl?: string | null;
  rolesClaim?: string | null;
  emailClaim?: string | null;
  givenNameClaim?: string | null;
  familyNameClaim?: string | null;
  usernameClaim?: string | null;
  buttonLabel?: string | null;
  groupSyncEnabled?: boolean;
  loginEnforced?: boolean;
  allowLocalFallback?: boolean;
  jitProvisioningEnabled?: boolean;
  status?: string;
};

type UpdateMfaPayload = {
  enforcement?: string;
  methods?: Record<string, boolean>;
  exemptServiceAccounts?: string[];
  gracePeriodDays?: number;
  targetCoverage?: number;
  status?: string;
};

type UpdateEmailPayload = {
  supportEmail?: string | null;
  deliveryMode?: string;
  status?: string;
  statusNote?: string | null;
};

type ClassificationPayload = {
  title?: string;
  confidentiality?: string;
  integrity?: string;
  availability?: string;
};

type UpdateBrandingPayload = {
  primaryLogoUrl?: string | null;
  primaryLogoDarkUrl?: string | null;
  faviconUrl?: string | null;
  loginLogoUrl?: string | null;
  backgroundImageUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  sidebarBackgroundColor?: string;
  bannerColor?: string;
  loginMessage?: string;
  footerText?: string;
  enableBackgroundBlur?: boolean;
  enableBackgroundOverlay?: boolean;
  showPoweredByRegovise?: boolean;
};

type UpdateGeneralPayload = {
  organizationName?: string;
  workspaceLabel?: string;
  timezone?: string;
  locale?: string;
  dateFormat?: string;
  fiscalYearStartMonth?: string;
  defaultDueTime?: string;
  defaultReviewerTeam?: string;
  workingDays?: string[];
  changeFreezeEnabled?: boolean;
  changeFreezeWindow?: string | null;
};

type UpdateRiskModelPayload = {
  modelType?: string;
  likelihoodScale?: number;
  impactScale?: number;
  acceptableMax?: number;
  monitorMax?: number;
  mitigateMax?: number;
  formulaPreset?: string;
  residualRiskMethod?: string;
  inheritedRiskMethod?: string;
  riskOwnerRole?: string;
  autoEscalationEnabled?: boolean;
  autoEscalationThreshold?: string;
  autoEscalationDays?: number;
};

type RecentAccessLogRow = {
  user_email: string | null;
  user_name: string | null;
  created_at: string;
  expires_at: string;
};

type CountByValueRow = {
  value: string | null;
  count: number;
};

const moduleCatalog = [
  {
    id: 'security-plans',
    name: 'Security Plans',
    category: 'Governance',
    description: 'Plan management, control implementations, and SSP-adjacent tooling.',
  },
  {
    id: 'libraries',
    name: 'Libraries',
    category: 'Governance',
    description: 'Catalogues, policies, and reference material used across compliance workflows.',
  },
  {
    id: 'assessments',
    name: 'Assessments',
    category: 'Governance',
    description: 'Compliance and risk assessments, action plans, and review history.',
  },
  {
    id: 'evidence',
    name: 'Evidence',
    category: 'Operations',
    description: 'Evidence sources, jobs, mapping, and artifact management.',
  },
  {
    id: 'conmon',
    name: 'Continuous Monitoring',
    category: 'Operations',
    description: 'Profiles, executions, and recurring verification workflows.',
  },
  {
    id: 'portal',
    name: 'Auditee Portal',
    category: 'Operations',
    description: 'Assignment intake and external collaboration experiences.',
  },
  {
    id: 'reports',
    name: 'Reports',
    category: 'Operations',
    description: 'Report rendering, export, and distribution capabilities.',
  },
  {
    id: 'third-party',
    name: 'Third Party',
    category: 'Risk',
    description: 'Third-party inventory, due diligence, and contract review flows.',
  },
  {
    id: 'privacy',
    name: 'Privacy',
    category: 'Risk',
    description: 'Processing activities, rights requests, and privacy program management.',
  },
  {
    id: 'resilience',
    name: 'Resilience',
    category: 'Risk',
    description: 'Business impact analysis, resilience planning, and recovery readiness.',
  },
];

const featureFlagCatalog = [
  {
    id: 'regml',
    name: 'RegML',
    description: 'AI-assisted authoring, explainability, and plan-level analysis workflows.',
  },
  {
    id: 'response-automation',
    name: 'Response Automation',
    description: 'Grounded questionnaire answering from approved internal content.',
  },
  {
    id: 'evidence-mapping',
    name: 'Evidence Mapping',
    description: 'Map evidence to plans, controls, and components with recommendations.',
  },
  {
    id: 'ai-policy-builder',
    name: 'AI Policy Builder',
    description: 'Generate policy requirements from profiles and catalogue inputs.',
  },
];

const classificationLevels = ['Low', 'Moderate', 'High'] as const;

const defaultClassificationRecords = [
  {
    id: 'classification-low-impact',
    title: 'Low Impact System',
    confidentiality: 'Low',
    integrity: 'Low',
    availability: 'Low',
    usageCount: 6,
  },
  {
    id: 'classification-moderate-impact',
    title: 'Moderate Impact System',
    confidentiality: 'Moderate',
    integrity: 'Moderate',
    availability: 'Moderate',
    usageCount: 11,
  },
  {
    id: 'classification-high-confidentiality',
    title: 'High Confidential Processing',
    confidentiality: 'High',
    integrity: 'Moderate',
    availability: 'Moderate',
    usageCount: 4,
  },
  {
    id: 'classification-mission-critical',
    title: 'Mission Critical Operations',
    confidentiality: 'Moderate',
    integrity: 'High',
    availability: 'High',
    usageCount: 8,
  },
] as const;

const defaultBrandingConfig = {
  primaryLogoUrl: '',
  primaryLogoDarkUrl: '',
  faviconUrl: '',
  loginLogoUrl: '',
  backgroundImageUrl: '',
  primaryColor: '#0F766E',
  accentColor: '#22D3EE',
  sidebarBackgroundColor: '#0B1324',
  bannerColor: '#155E75',
  loginMessage: 'Welcome to Regovise. Sign in to manage governance, evidence, and compliance workflows.',
  footerText: 'Regovise | Cloudflare-native GRC platform',
  enableBackgroundBlur: true,
  enableBackgroundOverlay: true,
  showPoweredByRegovise: true,
} as const;

const defaultGeneralConfig = {
  organizationName: 'Regovise',
  workspaceLabel: 'Corporate Governance',
  timezone: 'America/New_York',
  locale: 'en-US',
  dateFormat: 'MMM d, yyyy',
  fiscalYearStartMonth: 'January',
  defaultDueTime: '17:00',
  defaultReviewerTeam: 'Security Operations',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  changeFreezeEnabled: false,
  changeFreezeWindow: 'Friday 18:00 - Sunday 18:00 ET',
} as const;

const defaultRiskModelConfig = {
  modelType: 'Semi-Quantitative',
  likelihoodScale: 5,
  impactScale: 5,
  acceptableMax: 6,
  monitorMax: 10,
  mitigateMax: 16,
  formulaPreset: 'Likelihood x Impact',
  residualRiskMethod: 'Recalculate from adjusted likelihood and impact',
  inheritedRiskMethod: 'Blend inherited and local controls',
  riskOwnerRole: 'System Owner',
  autoEscalationEnabled: true,
  autoEscalationThreshold: 'Avoid',
  autoEscalationDays: 14,
} as const;

function nowIso() {
  return new Date().toISOString();
}

function asJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function defaultSsoCallbackUrl(env: EnvBindings): string {
  return `${env.APP_ORIGIN?.trim() || 'https://regovise.com'}/auth/callback`;
}

function toSsoRuntimeConfig(
  env: EnvBindings,
  tenantId: string,
  row: SetupSsoConfigRow | null | undefined,
): OidcConfigRecord | null {
  if (!row) {
    return null;
  }

  return {
    tenantId,
    tenantSlug: '',
    tenantName: '',
    providerType: row.provider_type?.trim() || null,
    authProtocol: normalizeAuthProtocol(row.auth_protocol ?? row.provider_type),
    clientId: row.client_id?.trim() || null,
    callbackUrl: row.callback_url?.trim() || defaultSsoCallbackUrl(env),
    metadataUrl: row.metadata_url?.trim() || null,
    domainHint: row.domain_hint?.trim() || null,
    buttonLabel: row.button_label?.trim() || null,
    rolesClaim: row.roles_claim?.trim() || 'roles',
    emailClaim: row.email_claim?.trim() || 'email',
    givenNameClaim: row.given_name_claim?.trim() || 'given_name',
    familyNameClaim: row.family_name_claim?.trim() || 'family_name',
    usernameClaim: row.username_claim?.trim() || 'preferred_username',
    groupSyncEnabled: row.group_sync_enabled === 1,
    loginEnforced: row.login_enforced === 1,
    allowLocalFallback: row.allow_local_fallback !== 0,
    jitProvisioningEnabled: row.jit_provisioning_enabled === 1,
  };
}

function getSsoRuntimeStatus(config: OidcConfigRecord | null) {
  if (!config) {
    return {
      ready: false,
      active: false,
      message: 'No SSO provider is configured for this workspace yet.',
    };
  }

  if (config.authProtocol === 'saml') {
    return {
      ready: false,
      active: false,
      message: 'SAML metadata can be documented here, but interactive SAML sign-in is not active in this worker yet.',
    };
  }

  if (config.authProtocol === 'cloudflare-access') {
    return {
      ready: false,
      active: false,
      message: 'Cloudflare Access can protect the front door, but it is not the workspace session provider.',
    };
  }

  if (!isRunnableOidcConfig(config)) {
    return {
      ready: false,
      active: false,
      message: 'OIDC is selected, but discovery, client id, or callback settings are still incomplete.',
    };
  }

  return {
    ready: true,
    active: true,
    message: config.loginEnforced
      ? 'OIDC is active and tenant sign-in is enforced through the configured identity provider.'
      : 'OIDC is active and available for tenant sign-in alongside recovery paths.',
  };
}

function requireTenant(ctx: WorkerRequestContext): string | Response {
  if (!ctx.tenantId) {
    return json({ error: 'missing_tenant', message: 'x-tenant-id is required' }, { status: 401 });
  }

  return ctx.tenantId;
}

function requireUser(ctx: WorkerRequestContext): string | Response {
  if (!ctx.userId) {
    return json({ error: 'missing_user', message: 'x-user-id is required' }, { status: 401 });
  }

  return ctx.userId;
}

function getServiceAccountRuntime(roleName: string) {
  if (roleName === 'Administrator') {
    return {
      runtime: 'Workers Admin',
      scopes: ['d1:admin', 'r2:admin', 'queue:admin', 'do:inspect'],
    };
  }

  if (roleName === 'Automation Operator') {
    return {
      runtime: 'Workers + Queues',
      scopes: ['queue:produce', 'd1:write', 'r2:read'],
    };
  }

  return {
    runtime: 'Workers + R2',
    scopes: ['d1:read', 'r2:write-export'],
  };
}

function buildServiceAccountSecret(prefix: string) {
  const tokenValue = `rgv_${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  return {
    tokenValue,
    tokenPrefix: prefix,
    revealedPreview: `${tokenValue.slice(0, 18)}...`,
  };
}

function toTagRecord(row: SetupTagRow) {
  return {
    id: row.id,
    title: row.title,
    type: row.tag_type === 'System' ? 'System' : 'User',
    oscalRequired: row.oscal_required === 1,
    usageCount: row.usage_count,
    updatedAt: row.updated_at,
  };
}

function toServiceAccountRecord(row: SetupServiceAccountRow) {
  return {
    id: row.id,
    tokenPrefix: row.token_prefix,
    expirationDate: row.expires_at,
    purpose: row.purpose,
    role: row.role_name,
    runtime: row.runtime,
    scopes: asJson<string[]>(row.scopes_json, []).join(', '),
    isActive: row.is_active === 1,
    lastUsedAt: row.last_used_at,
    lastRotatedAt: row.last_rotated_at,
    updatedAt: row.updated_at,
  };
}

function toSecurityControlRecord(row: SetupSecurityControlRow) {
  return {
    id: row.id,
    key: row.control_key,
    title: row.title,
    category: row.category,
    status: row.status,
    ownerName: row.owner_name,
    description: row.description,
    detail: asJson<Record<string, unknown>>(row.detail_json, {}),
    updatedAt: row.updated_at,
  };
}

async function ensureSeedTags(env: EnvBindings, tenantId: string, userId: string | null) {
  const countRow = await env.D1_MAIN.prepare(
    `SELECT COUNT(1) AS total FROM setup_tags WHERE tenant_id = ?`,
  )
    .bind(tenantId)
    .first<CountRow>();

  if (Number(countRow?.total ?? 0) > 0) {
    return;
  }

  const now = nowIso();
  const seeds = [
    {
      id: 'setup-tag-fedramp-export',
      title: 'FedRAMP Export',
      type: 'System',
      oscalRequired: 1,
      usageCount: 12,
    },
    {
      id: 'setup-tag-assessment-evidence',
      title: 'Assessment Evidence',
      type: 'User',
      oscalRequired: 0,
      usageCount: 7,
    },
    {
      id: 'setup-tag-oscal-attachment',
      title: 'OSCAL Attachment',
      type: 'System',
      oscalRequired: 1,
      usageCount: 9,
    },
  ];

  for (const seed of seeds) {
    await env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO setup_tags (
        id, tenant_id, title, tag_type, oscal_required, usage_count, created_by_user_id, updated_by_user_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        seed.id,
        tenantId,
        seed.title,
        seed.type,
        seed.oscalRequired,
        seed.usageCount,
        userId,
        userId,
        now,
        now,
      )
      .run();
  }
}

async function ensureSeedServiceAccounts(env: EnvBindings, tenantId: string, userId: string | null) {
  const countRow = await env.D1_MAIN.prepare(
    `SELECT COUNT(1) AS total FROM setup_service_accounts WHERE tenant_id = ?`,
  )
    .bind(tenantId)
    .first<CountRow>();

  if (Number(countRow?.total ?? 0) > 0) {
    return;
  }

  const now = nowIso();
  const seeds = [
    {
      id: 'svc-nightly-import-demo',
      tokenPrefix: 'PAT-1001',
      purpose: 'Nightly vulnerability import',
      roleName: 'Automation Operator',
      runtime: 'Workers + Queues',
      scopes: ['queue:produce', 'd1:write', 'r2:read'],
      expiresAt: '2026-07-10T00:00:00.000Z',
      lastUsedAt: '2026-04-12T03:14:00.000Z',
    },
    {
      id: 'svc-ssp-export-demo',
      tokenPrefix: 'PAT-1002',
      purpose: 'Managed SSP export pipeline',
      roleName: 'Read Only',
      runtime: 'Workers + R2',
      scopes: ['d1:read', 'r2:write-export'],
      expiresAt: '2026-05-20T00:00:00.000Z',
      lastUsedAt: '2026-04-11T22:41:00.000Z',
    },
  ];

  for (const seed of seeds) {
    await env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO setup_service_accounts (
        id, tenant_id, token_prefix, purpose, role_name, runtime, scopes_json, expires_at, last_used_at, last_rotated_at,
        created_by_user_id, updated_by_user_id, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
    )
      .bind(
        seed.id,
        tenantId,
        seed.tokenPrefix,
        seed.purpose,
        seed.roleName,
        seed.runtime,
        JSON.stringify(seed.scopes),
        seed.expiresAt,
        seed.lastUsedAt,
        now,
        userId,
        userId,
        now,
        now,
      )
      .run();
  }
}

async function ensureSeedSecurityControls(env: EnvBindings, tenantId: string, userId: string | null) {
  const countRow = await env.D1_MAIN.prepare(
    `SELECT COUNT(1) AS total FROM setup_security_controls WHERE tenant_id = ?`,
  )
    .bind(tenantId)
    .first<CountRow>();

  if (Number(countRow?.total ?? 0) > 0) {
    return;
  }

  const now = nowIso();
  const seeds = [
    {
      id: 'setup-security-sso',
      key: 'sso',
      title: 'Single Sign-On',
      category: 'identity',
      status: 'Managed',
      ownerName: 'Identity Team',
      description: 'OIDC and session boundaries protect operator entry points across tenants.',
      detail: {
        provider: 'Google OIDC',
        adminBoundary: 'Cloudflare Access',
      },
    },
    {
      id: 'setup-security-mfa',
      key: 'mfa',
      title: 'Multi-Factor Authentication',
      category: 'identity',
      status: 'Enforced',
      ownerName: 'Workspace Admin',
      description: 'Privileged routes require MFA-backed upstream identity before session issue.',
      detail: {
        coverage: 'privileged operators',
        recovery: 'break-glass runbook required',
      },
    },
    {
      id: 'setup-security-storage',
      key: 'storage',
      title: 'Storage Mediation',
      category: 'platform',
      status: 'Hardened',
      ownerName: 'Platform Engineering',
      description: 'All D1 and R2 access is mediated through Workers with tenant scoping and object boundaries.',
      detail: {
        d1: 'tenant-scoped queries',
        r2: 'signed URL mediation',
      },
    },
    {
      id: 'setup-security-queues',
      key: 'queues',
      title: 'Queue and Workflow Controls',
      category: 'platform',
      status: 'Managed',
      ownerName: 'Operations',
      description: 'Async jobs run through explicit queue producers and coordination-safe workflow boundaries.',
      detail: {
        queues: 'evidence + conmon',
        coordination: 'durable objects',
      },
    },
    {
      id: 'setup-security-observability',
      key: 'observability',
      title: 'Observability and Audit',
      category: 'monitoring',
      status: 'Monitored',
      ownerName: 'Security Operations',
      description: 'Operational events, email deliveries, and access sessions are recorded for review and triage.',
      detail: {
        logs: 'transactional email + sessions + workload metrics',
      },
    },
  ];

  for (const seed of seeds) {
    await env.D1_MAIN.prepare(
      `
      INSERT OR IGNORE INTO setup_security_controls (
        id, tenant_id, control_key, title, category, status, owner_name, description, detail_json,
        created_by_user_id, updated_by_user_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        seed.id,
        tenantId,
        seed.key,
        seed.title,
        seed.category,
        seed.status,
        seed.ownerName,
        seed.description,
        JSON.stringify(seed.detail),
        userId,
        userId,
        now,
        now,
      )
      .run();
  }
}

async function ensureSeedModulesFeatures(env: EnvBindings, tenantId: string, userId: string | null) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id
    FROM setup_modules_features
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ tenant_id: string }>();

  if (existing) {
    return;
  }

  const now = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO setup_modules_features (
      tenant_id,
      enabled_modules_json,
      feature_flags_json,
      regml_enabled,
      regml_terms_accepted,
      status_note,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      tenantId,
      JSON.stringify(moduleCatalog.map((module) => module.id)),
      JSON.stringify(featureFlagCatalog.map((feature) => feature.id)),
      'Canonical module toggles seeded for the tenant. Review before changing production availability.',
      userId,
      userId,
      now,
      now,
    )
    .run();
}

async function ensureSeedSsoConfig(env: EnvBindings, tenantId: string, userId: string | null) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id
    FROM setup_sso_configs
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ tenant_id: string }>();

  if (existing) {
    return;
  }

  const now = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO setup_sso_configs (
      tenant_id,
      auth_protocol,
      provider_type,
      domain_hint,
      client_id,
      callback_url,
      metadata_url,
      roles_claim,
      email_claim,
      given_name_claim,
      family_name_claim,
      username_claim,
      button_label,
      group_sync_enabled,
      login_enforced,
      allow_local_fallback,
      jit_provisioning_enabled,
      status,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, 'oidc', 'Google Workspace', '', '', ?, 'https://accounts.google.com/.well-known/openid-configuration', 'roles', 'email', 'given_name', 'family_name', 'preferred_username', 'Continue with Google', 1, 0, 1, 0, 'Review', ?, ?, ?, ?)
    `,
  )
    .bind(tenantId, defaultSsoCallbackUrl(env), userId, userId, now, now)
    .run();
}

async function ensureSeedMfaPolicy(env: EnvBindings, tenantId: string, userId: string | null) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id
    FROM setup_mfa_policies
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ tenant_id: string }>();

  if (existing) {
    return;
  }

  const now = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO setup_mfa_policies (
      tenant_id,
      enforcement,
      methods_json,
      exempt_service_accounts_json,
      grace_period_days,
      target_coverage,
      status,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, 'Required for privileged users', ?, ?, 14, 90, 'Rollout', ?, ?, ?, ?)
    `,
  )
    .bind(
      tenantId,
      JSON.stringify({
        totp: true,
        webauthn: true,
        sms: false,
        email: false,
      }),
      JSON.stringify(['svc-nightly-import-demo']),
      userId,
      userId,
      now,
      now,
    )
    .run();
}

async function ensureSeedEmailConfig(env: EnvBindings, tenantId: string, userId: string | null) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id
    FROM setup_email_configs
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ tenant_id: string }>();

  if (existing) {
    return;
  }

  const runtime = getEmailRuntimeSummary(env);
  const now = nowIso();
  const deliveryMode =
    runtime.provider === 'mailchannels'
      ? 'Mailchannels'
      : runtime.provider === 'webhook'
        ? 'Webhook'
        : 'Disabled';

  await env.D1_MAIN.prepare(
    `
    INSERT INTO setup_email_configs (
      tenant_id,
      support_email,
      delivery_mode,
      status,
      status_note,
      last_verified_at,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      tenantId,
      runtime.fromEmail,
      deliveryMode,
      runtime.sendingEnabled ? 'Configured' : 'Review',
      runtime.sendingEnabled
        ? 'Runtime email delivery is configured. Review sender identity and operational verification before live use.'
        : 'Email delivery is disabled in the runtime. Configure provider secrets before enabling production notifications.',
      null,
      userId,
      userId,
      now,
      now,
    )
    .run();
}

async function ensureSeedClassifications(env: EnvBindings, tenantId: string, userId: string | null) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT COUNT(1) AS total
    FROM setup_classifications
    WHERE tenant_id = ?
    `,
  )
    .bind(tenantId)
    .first<CountRow>();

  if (Number(existing?.total ?? 0) > 0) {
    return;
  }

  const now = nowIso();
  for (const item of defaultClassificationRecords) {
    await env.D1_MAIN.prepare(
      `
      INSERT INTO setup_classifications (
        id,
        tenant_id,
        title,
        confidentiality,
        integrity,
        availability,
        usage_count,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        item.id,
        tenantId,
        item.title,
        item.confidentiality,
        item.integrity,
        item.availability,
        item.usageCount,
        userId,
        userId,
        now,
        now,
      )
      .run();
  }
}

async function ensureSeedBrandingConfig(env: EnvBindings, tenantId: string, userId: string | null) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id
    FROM setup_branding_configs
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ tenant_id: string }>();

  if (existing) {
    return;
  }

  const now = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO setup_branding_configs (
      tenant_id,
      primary_logo_url,
      primary_logo_dark_url,
      favicon_url,
      login_logo_url,
      background_image_url,
      primary_color,
      accent_color,
      sidebar_background_color,
      banner_color,
      login_message,
      footer_text,
      enable_background_blur,
      enable_background_overlay,
      show_powered_by_regovise,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      tenantId,
      defaultBrandingConfig.primaryLogoUrl,
      defaultBrandingConfig.primaryLogoDarkUrl,
      defaultBrandingConfig.faviconUrl,
      defaultBrandingConfig.loginLogoUrl,
      defaultBrandingConfig.backgroundImageUrl,
      defaultBrandingConfig.primaryColor,
      defaultBrandingConfig.accentColor,
      defaultBrandingConfig.sidebarBackgroundColor,
      defaultBrandingConfig.bannerColor,
      defaultBrandingConfig.loginMessage,
      defaultBrandingConfig.footerText,
      defaultBrandingConfig.enableBackgroundBlur ? 1 : 0,
      defaultBrandingConfig.enableBackgroundOverlay ? 1 : 0,
      defaultBrandingConfig.showPoweredByRegovise ? 1 : 0,
      userId,
      userId,
      now,
      now,
    )
    .run();
}

async function ensureSeedGeneralConfig(env: EnvBindings, tenantId: string, userId: string | null) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id
    FROM setup_general_configs
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ tenant_id: string }>();

  if (existing) {
    return;
  }

  const now = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO setup_general_configs (
      tenant_id,
      organization_name,
      workspace_label,
      timezone,
      locale,
      date_format,
      fiscal_year_start_month,
      default_due_time,
      default_reviewer_team,
      working_days_json,
      change_freeze_enabled,
      change_freeze_window,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      tenantId,
      defaultGeneralConfig.organizationName,
      defaultGeneralConfig.workspaceLabel,
      defaultGeneralConfig.timezone,
      defaultGeneralConfig.locale,
      defaultGeneralConfig.dateFormat,
      defaultGeneralConfig.fiscalYearStartMonth,
      defaultGeneralConfig.defaultDueTime,
      defaultGeneralConfig.defaultReviewerTeam,
      JSON.stringify(defaultGeneralConfig.workingDays),
      defaultGeneralConfig.changeFreezeEnabled ? 1 : 0,
      defaultGeneralConfig.changeFreezeWindow,
      userId,
      userId,
      now,
      now,
    )
    .run();
}

async function ensureSeedRiskModel(env: EnvBindings, tenantId: string, userId: string | null) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id
    FROM setup_risk_models
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<{ tenant_id: string }>();

  if (existing) {
    return;
  }

  const now = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO setup_risk_models (
      tenant_id,
      model_type,
      likelihood_scale,
      impact_scale,
      acceptable_max,
      monitor_max,
      mitigate_max,
      formula_preset,
      residual_risk_method,
      inherited_risk_method,
      risk_owner_role,
      auto_escalation_enabled,
      auto_escalation_threshold,
      auto_escalation_days,
      created_by_user_id,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      tenantId,
      defaultRiskModelConfig.modelType,
      defaultRiskModelConfig.likelihoodScale,
      defaultRiskModelConfig.impactScale,
      defaultRiskModelConfig.acceptableMax,
      defaultRiskModelConfig.monitorMax,
      defaultRiskModelConfig.mitigateMax,
      defaultRiskModelConfig.formulaPreset,
      defaultRiskModelConfig.residualRiskMethod,
      defaultRiskModelConfig.inheritedRiskMethod,
      defaultRiskModelConfig.riskOwnerRole,
      defaultRiskModelConfig.autoEscalationEnabled ? 1 : 0,
      defaultRiskModelConfig.autoEscalationThreshold,
      defaultRiskModelConfig.autoEscalationDays,
      userId,
      userId,
      now,
      now,
    )
    .run();
}

async function ensureSeedSetupWorkspace(env: EnvBindings, tenantId: string, userId: string | null) {
  await ensureSeedTags(env, tenantId, userId);
  await ensureSeedServiceAccounts(env, tenantId, userId);
  await ensureSeedSecurityControls(env, tenantId, userId);
  await ensureSeedModulesFeatures(env, tenantId, userId);
  await ensureSeedSsoConfig(env, tenantId, userId);
  await ensureSeedMfaPolicy(env, tenantId, userId);
  await ensureSeedEmailConfig(env, tenantId, userId);
  await ensureSeedClassifications(env, tenantId, userId);
  await ensureSeedBrandingConfig(env, tenantId, userId);
  await ensureSeedGeneralConfig(env, tenantId, userId);
  await ensureSeedRiskModel(env, tenantId, userId);
}

async function listTags(env: EnvBindings, tenantId: string) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, title, tag_type, oscal_required, usage_count, created_at, updated_at
    FROM setup_tags
    WHERE tenant_id = ?
    ORDER BY tag_type DESC, title ASC
    `,
  )
    .bind(tenantId)
    .all<SetupTagRow>();

  const tags = (rows.results ?? []).map(toTagRecord);
  return {
    tags,
    metrics: {
      totalTags: tags.length,
      systemTags: tags.filter((tag) => tag.type === 'System').length,
      oscalRequired: tags.filter((tag) => tag.oscalRequired).length,
      totalUsage: tags.reduce((sum, tag) => sum + tag.usageCount, 0),
    },
  };
}

async function listServiceAccounts(env: EnvBindings, tenantId: string) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, token_prefix, purpose, role_name, runtime, scopes_json, expires_at, last_used_at, last_rotated_at,
           is_active, created_at, updated_at
    FROM setup_service_accounts
    WHERE tenant_id = ?
    ORDER BY updated_at DESC
    `,
  )
    .bind(tenantId)
    .all<SetupServiceAccountRow>();

  const accounts = (rows.results ?? []).map(toServiceAccountRecord);
  const nowMs = Date.now();
  return {
    accounts,
    metrics: {
      activeTokens: accounts.filter((account) => account.isActive).length,
      expiringSoon: accounts.filter((account) => Date.parse(account.expirationDate) - nowMs <= 30 * 24 * 60 * 60 * 1000).length,
      adminTokens: accounts.filter((account) => account.role === 'Administrator').length,
      longestTtlDays: accounts.length
        ? Math.max(
            ...accounts.map((account) =>
              Math.max(0, Math.round((Date.parse(account.expirationDate) - nowMs) / (24 * 60 * 60 * 1000))),
            ),
          )
        : 0,
    },
  };
}

async function buildLogsUtilizationSnapshot(env: EnvBindings, tenantId: string) {
  const [
    sessionCountRow,
    emailCountRow,
    failedEmailRow,
    importCountRow,
    exportCountRow,
    evidenceArtifactRow,
    accessRows,
    importStatusRows,
    exportStatusRows,
  ] = await Promise.all([
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS total FROM sessions WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(1) AS total
      FROM transactional_email_delivery_log
      WHERE email_normalized LIKE ?
      `,
    )
      .bind('%')
      .first<CountRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(1) AS total
      FROM transactional_email_delivery_log
      WHERE delivery_status NOT IN ('delivered', 'skipped')
      `,
    ).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS total FROM import_jobs WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS total FROM report_exports WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS total FROM evidence_artifacts WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT session.created_at, session.expires_at, user.email AS user_email, user.display_name AS user_name
      FROM sessions AS session
      LEFT JOIN users AS user
        ON user.id = session.user_id
      WHERE session.tenant_id = ?
      ORDER BY session.created_at DESC
      LIMIT 5
      `,
    )
      .bind(tenantId)
      .all<RecentAccessLogRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT status AS value, COUNT(1) AS count
      FROM import_jobs
      WHERE tenant_id = ?
      GROUP BY status
      ORDER BY count DESC
      `,
    )
      .bind(tenantId)
      .all<CountByValueRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT status AS value, COUNT(1) AS count
      FROM report_exports
      WHERE tenant_id = ?
      GROUP BY status
      ORDER BY count DESC
      `,
    )
      .bind(tenantId)
      .all<CountByValueRow>(),
  ]);

  const sessionCount = Number(sessionCountRow?.total ?? 0);
  const emailCount = Number(emailCountRow?.total ?? 0);
  const failedEmailCount = Number(failedEmailRow?.total ?? 0);
  const importCount = Number(importCountRow?.total ?? 0);
  const exportCount = Number(exportCountRow?.total ?? 0);
  const evidenceArtifactCount = Number(evidenceArtifactRow?.total ?? 0);

  const errorRows = [
    ...(importStatusRows.results ?? [])
      .filter((row) => (row.value ?? '').toLowerCase() !== 'completed')
      .map((row) => ({
        timestamp: nowIso(),
        system: 'Import Jobs',
        summary: `${row.count} import job(s) currently ${row.value ?? 'unknown'}.`,
        count: row.count,
      })),
    ...(exportStatusRows.results ?? [])
      .filter((row) => (row.value ?? '').toLowerCase() !== 'ready')
      .map((row) => ({
        timestamp: nowIso(),
        system: 'Report Exports',
        summary: `${row.count} export(s) currently ${row.value ?? 'unknown'}.`,
        count: row.count,
      })),
  ];

  if (failedEmailCount > 0) {
    errorRows.push({
      timestamp: nowIso(),
      system: 'Transactional Email',
      summary: `${failedEmailCount} email delivery event(s) need operator review.`,
      count: failedEmailCount,
    });
  }

  return {
    metrics: {
      d1Metadata: `${(sessionCount + importCount + exportCount + evidenceArtifactCount + emailCount).toFixed(0)} rows indexed`,
      r2Objects: `${evidenceArtifactCount} artifacts`,
      queueBacklog: `${Math.max(0, errorRows.reduce((sum, row) => sum + row.count, 0))}`,
      durableObjectSessions: `${Math.max(1, Math.min(9, Math.ceil(sessionCount / 2)))} active`,
      monthlyErrorVolume: errorRows.reduce((sum, row) => sum + row.count, 0),
      monthlyLogins: sessionCount,
      systemEvents: importCount + exportCount + emailCount,
      activeUsers: new Set((accessRows.results ?? []).map((row) => row.user_email ?? row.user_name ?? 'unknown')).size,
    },
    filters: {
      startDate: '2026-04-01',
      endDate: '2026-04-13',
      last24HoursOnly: false,
      viewMode: 'chart' as const,
    },
    records: {
      errorRows: errorRows.length
        ? errorRows
        : [
            {
              timestamp: nowIso(),
              system: 'Platform',
              summary: 'No elevated operational errors detected for the current tenant snapshot.',
              count: 0,
            },
          ],
      accessLogs: (accessRows.results ?? []).map((row) => {
        const expiresAt = Date.parse(row.expires_at);
        return {
          user: row.user_name?.trim() || row.user_email?.trim() || 'Unknown user',
          loginTime: row.created_at,
          active: Number.isFinite(expiresAt) && expiresAt > Date.now() ? 'Yes' : 'No',
          admin: row.user_email?.includes('admin') ? 'Yes' : 'No',
        };
      }),
    },
  };
}

async function buildSecuritySnapshot(env: EnvBindings, tenantId: string) {
  const [controlsResult, queuePendingRow, evidenceCountRow] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT id, tenant_id, control_key, title, category, status, owner_name, description, detail_json, created_at, updated_at
      FROM setup_security_controls
      WHERE tenant_id = ?
      ORDER BY category ASC, title ASC
      `,
    )
      .bind(tenantId)
      .all<SetupSecurityControlRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT
        (
          SELECT COUNT(1) FROM import_jobs WHERE tenant_id = ? AND status NOT IN ('completed')
        ) +
        (
          SELECT COUNT(1) FROM report_exports WHERE tenant_id = ? AND status NOT IN ('ready')
        ) +
        (
          SELECT COUNT(1) FROM conmon_executions WHERE tenant_id = ? AND status NOT IN ('completed')
        ) AS total
      `,
    )
      .bind(tenantId, tenantId, tenantId)
      .first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(1) AS total FROM evidence_artifacts WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
  ]);

  const controls = (controlsResult.results ?? []).map(toSecurityControlRecord);
  const hardenedStatuses = new Set(['Hardened', 'Enforced', 'Managed']);

  return {
    metrics: {
      managedControls: controls.length,
      hardenedControls: controls.filter((control) => hardenedStatuses.has(control.status)).length,
      queueBacklog: Number(queuePendingRow?.total ?? 0),
      evidenceArtifacts: Number(evidenceCountRow?.total ?? 0),
    },
    securityStatuses: controls.map((control) => [control.title, control.status, control.description] as [string, string, string]),
    records: {
      cloudflareControls: [
        {
          title: 'R2 Signed URLs',
          description: 'Issue short-lived upload and download URLs rather than broad object-store credentials.',
        },
        {
          title: 'D1 Tenant Filters',
          description: 'Every query enforces tenant ownership for setup state, exports, evidence, and admin telemetry.',
        },
        {
          title: 'Queue Producers',
          description: 'Async evidence, monitoring, and export jobs remain bounded behind explicit worker producers.',
        },
        {
          title: 'DO Lease Guards',
          description: 'Coordination-sensitive workflows are isolated behind Durable Object session boundaries.',
        },
      ],
      accessLayers: [
        {
          title: 'Tenant-Level Access',
          description: 'Establish the top-level tenant boundary, organization membership, and app-level access partitioning.',
        },
        {
          title: 'Role-Based Access',
          description: 'Apply module and action permissions through roles, groups, and delegated responsibilities.',
        },
        {
          title: 'Record-Level Access',
          description: 'Restrict sensitive records, evidence, and exports using ownership and scoped authorization.',
        },
      ],
      architecture: [
        'Identity and SSO establish who can enter the tenant.',
        'MFA, service-account controls, and secrets management protect privileged operations.',
        'Module permissions and record-level access determine what users can see and change.',
        'R2, D1, Queues, and Durable Objects each enforce least-privilege runtime boundaries.',
        'Scanning, logging, and utilization telemetry provide continuous verification.',
      ],
      controls,
    },
  };
}

async function buildModulesFeaturesSnapshot(env: EnvBindings, tenantId: string) {
  const [modulesRow, regmlRow, ssoRow, mfaRow] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT tenant_id, enabled_modules_json, feature_flags_json, regml_enabled, regml_terms_accepted, status_note, created_at, updated_at
      FROM setup_modules_features
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<SetupModulesFeaturesRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT enabled, terms_accepted, deployment_mode, backend_available
      FROM regml_settings
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<RegmlSettingsStateRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT tenant_id, provider_type, auth_protocol, domain_hint, client_id, callback_url, metadata_url, roles_claim, email_claim, given_name_claim, family_name_claim, username_claim, button_label, group_sync_enabled, login_enforced, allow_local_fallback, jit_provisioning_enabled, status, created_at, updated_at
      FROM setup_sso_configs
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<SetupSsoConfigRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT tenant_id, enforcement, methods_json, exempt_service_accounts_json, grace_period_days, target_coverage, status, created_at, updated_at
      FROM setup_mfa_policies
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<SetupMfaPolicyRow>(),
  ]);

  const enabledModules = new Set(asJson<string[]>(modulesRow?.enabled_modules_json, moduleCatalog.map((module) => module.id)));
  const enabledFeatureFlags = new Set(
    asJson<string[]>(modulesRow?.feature_flags_json, featureFlagCatalog.map((feature) => feature.id)),
  );
  const regmlEnabled = regmlRow ? regmlRow.enabled === 1 : modulesRow?.regml_enabled === 1;
  const regmlTermsAccepted = regmlRow ? regmlRow.terms_accepted === 1 : modulesRow?.regml_terms_accepted === 1;
  const ssoConfigured = isRunnableOidcConfig(toSsoRuntimeConfig(env, tenantId, ssoRow));
  const mfaMethods = asJson<Record<string, boolean>>(mfaRow?.methods_json, {});
  const mfaConfigured = Object.values(mfaMethods).some(Boolean);

  return {
    metrics: {
      enabledModules: moduleCatalog.filter((module) => enabledModules.has(module.id)).length,
      disabledModules: moduleCatalog.filter((module) => !enabledModules.has(module.id)).length,
      enabledFeatureFlags: featureFlagCatalog.filter((feature) => enabledFeatureFlags.has(feature.id)).length,
      regmlReady: regmlEnabled && regmlTermsAccepted,
    },
    readiness: {
      regmlEnabled,
      regmlTermsAccepted,
      ssoConfigured,
      mfaConfigured,
    },
    modules: moduleCatalog.map((module) => ({
      ...module,
      enabled: enabledModules.has(module.id),
    })),
    featureFlags: featureFlagCatalog.map((feature) => ({
      ...feature,
      enabled:
        feature.id === 'regml'
          ? regmlEnabled
          : enabledFeatureFlags.has(feature.id),
    })),
    statusNote:
      modulesRow?.status_note ??
      'Module enablement, identity, and AI capabilities should be reviewed together before exposing features to production users.',
    updatedAt: modulesRow?.updated_at ?? nowIso(),
  };
}

async function buildSsoSnapshot(env: EnvBindings, tenantId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id, provider_type, auth_protocol, domain_hint, client_id, callback_url, metadata_url, roles_claim, email_claim, given_name_claim, family_name_claim, username_claim, button_label, group_sync_enabled, login_enforced, allow_local_fallback, jit_provisioning_enabled, status, created_at, updated_at
    FROM setup_sso_configs
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<SetupSsoConfigRow>();

  const config = toSsoRuntimeConfig(env, tenantId, row);
  const runtime = getSsoRuntimeStatus(config);

  const providerCards = [
    {
      name: 'Microsoft Entra / Generic OIDC',
      description: 'Public-client OIDC with PKCE for Entra, Okta, Google, and similar identity providers.',
      ready: config?.authProtocol === 'oidc' && runtime.ready,
    },
    {
      name: 'SAML / Enterprise IdP',
      description: 'Metadata can be captured for planning, but interactive SAML sign-in is not active in this worker yet.',
      ready: config?.authProtocol === 'saml' && Boolean(config.metadataUrl),
    },
    {
      name: 'Cloudflare Access',
      description: 'Zero Trust front-door protection for admin or internal surfaces, separate from workspace sessions.',
      ready: config?.authProtocol === 'cloudflare-access',
    },
  ];

  return {
    metrics: {
      configuredProviders: config?.providerType ? 1 : 0,
      loginEnforced: Boolean(config?.loginEnforced && runtime.ready),
      groupSyncEnabled: config?.groupSyncEnabled === true,
      callbackConfigured: Boolean(config?.callbackUrl),
    },
    config: {
      authProtocol: config?.authProtocol ?? 'oidc',
      providerType: config?.providerType ?? 'Generic OIDC',
      domainHint: config?.domainHint ?? '',
      clientId: config?.clientId ?? '',
      callbackUrl: config?.callbackUrl ?? defaultSsoCallbackUrl(env),
      metadataUrl: config?.metadataUrl ?? '',
      rolesClaim: config?.rolesClaim ?? 'roles',
      emailClaim: config?.emailClaim ?? 'email',
      givenNameClaim: config?.givenNameClaim ?? 'given_name',
      familyNameClaim: config?.familyNameClaim ?? 'family_name',
      usernameClaim: config?.usernameClaim ?? 'preferred_username',
      buttonLabel: config?.buttonLabel ?? '',
      groupSyncEnabled: config?.groupSyncEnabled === true,
      loginEnforced: Boolean(config?.loginEnforced && runtime.ready),
      allowLocalFallback: config?.allowLocalFallback !== false,
      jitProvisioningEnabled: config?.jitProvisioningEnabled === true,
      status: row?.status ?? 'Review',
      runtimeReady: runtime.ready,
      runtimeMessage: runtime.message,
      updatedAt: row?.updated_at ?? nowIso(),
    },
    providerCards,
    checklist: [
      'Register the callback URI on the provider exactly as shown here before testing sign-in.',
      'Use a public-client OIDC app with PKCE. No client secret is required for the current worker flow.',
      'Map the roles claim to existing Regovise role names before enabling JIT provisioning or group sync.',
      'Test sign-in and sign-out with a non-admin account before enforcing tenant-wide access.',
    ],
  };
}

async function buildMfaSnapshot(env: EnvBindings, tenantId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id, enforcement, methods_json, exempt_service_accounts_json, grace_period_days, target_coverage, status, created_at, updated_at
    FROM setup_mfa_policies
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<SetupMfaPolicyRow>();

  const methods = asJson<Record<string, boolean>>(row?.methods_json, {
    totp: true,
    webauthn: true,
    sms: false,
    email: false,
  });
  const exemptServiceAccounts = asJson<string[]>(row?.exempt_service_accounts_json, []);

  return {
    metrics: {
      methodsEnabled: Object.values(methods).filter(Boolean).length,
      exemptAccounts: exemptServiceAccounts.length,
      targetCoverage: row?.target_coverage ?? 80,
      enrollmentStatus: row?.status ?? 'Planned',
    },
    policy: {
      enforcement: row?.enforcement ?? 'Optional',
      methods,
      exemptServiceAccounts,
      gracePeriodDays: row?.grace_period_days ?? 14,
      targetCoverage: row?.target_coverage ?? 80,
      status: row?.status ?? 'Planned',
      updatedAt: row?.updated_at ?? nowIso(),
    },
    recommendations: [
      'Require MFA for privileged users before enforcing tenant-wide rollouts.',
      'Prefer phishing-resistant methods such as WebAuthn where possible.',
      'Document service-account exceptions separately and keep them time-bounded.',
    ],
  };
}

async function buildEmailSnapshot(env: EnvBindings, tenantId: string) {
  const runtime = getEmailRuntimeSummary(env);
  const [configRow, totalRow, failedRow, recentRows] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT tenant_id, support_email, delivery_mode, status, status_note, last_verified_at, created_at, updated_at
      FROM setup_email_configs
      WHERE tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<SetupEmailConfigRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(1) AS total
      FROM transactional_email_delivery_log
      `,
    ).first<CountRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT COUNT(1) AS total
      FROM transactional_email_delivery_log
      WHERE delivery_status = 'failed'
      `,
    ).first<CountRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT event_type, delivery_status, provider, created_at_ms
      FROM transactional_email_delivery_log
      ORDER BY created_at_ms DESC
      LIMIT 5
      `,
    ).all<{
      event_type: string;
      delivery_status: string;
      provider: string;
      created_at_ms: number;
    }>(),
  ]);

  return {
    metrics: {
      provider: runtime.provider,
      sendingEnabled: runtime.sendingEnabled,
      configuredSender: Boolean(runtime.fromEmail),
      totalEvents: Number(totalRow?.total ?? 0),
      failedEvents: Number(failedRow?.total ?? 0),
    },
    config: {
      supportEmail: configRow?.support_email ?? runtime.fromEmail ?? '',
      deliveryMode: configRow?.delivery_mode ?? (runtime.sendingEnabled ? runtime.provider : 'Disabled'),
      status: configRow?.status ?? (runtime.sendingEnabled ? 'Configured' : 'Review'),
      statusNote:
        configRow?.status_note ??
        'Keep sender identity, DKIM posture, and delivery-provider secrets aligned with the production domain.',
      lastVerifiedAt: configRow?.last_verified_at,
      provider: runtime.provider,
      fromEmail: runtime.fromEmail ?? '',
      fromName: runtime.fromName,
      dkimDomain: runtime.dkimDomain ?? '',
      dkimSelector: runtime.dkimSelector ?? '',
      webhookConfigured: runtime.webhookConfigured,
      mailchannelsConfigured: runtime.mailchannelsConfigured,
      sendingEnabled: runtime.sendingEnabled,
      updatedAt: configRow?.updated_at ?? nowIso(),
    },
    recentEvents: (recentRows.results ?? []).map((row) => ({
      eventType: row.event_type,
      status: row.delivery_status,
      provider: row.provider,
      timestamp: new Date(row.created_at_ms).toISOString(),
    })),
    guidance: [
      'Use runtime secrets for provider credentials; do not store delivery secrets in tenant-editable setup state.',
      'Verify DKIM and sender identity against regovise.com before enabling customer-facing notifications.',
      'Review failed delivery events after every production rollout that affects auth, portal, or exports.',
    ],
  };
}

async function buildClassificationSnapshot(env: EnvBindings, tenantId: string) {
  const rows = await env.D1_MAIN.prepare(
    `
    SELECT id, tenant_id, title, confidentiality, integrity, availability, usage_count, created_at, updated_at
    FROM setup_classifications
    WHERE tenant_id = ?
    ORDER BY title ASC
    `,
  )
    .bind(tenantId)
    .all<SetupClassificationRow>();

  const records = (rows.results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    confidentiality: row.confidentiality,
    integrity: row.integrity,
    availability: row.availability,
    usageCount: row.usage_count,
    updatedAt: row.updated_at,
  }));

  const highImpact = records.filter((record) =>
    [record.confidentiality, record.integrity, record.availability].includes('High'),
  ).length;
  const moderateImpact = records.filter(
    (record) =>
      ![record.confidentiality, record.integrity, record.availability].includes('High') &&
      [record.confidentiality, record.integrity, record.availability].includes('Moderate'),
  ).length;

  return {
    metrics: {
      totalProfiles: records.length,
      highImpact,
      moderateImpact,
      lowImpact: records.length - highImpact - moderateImpact,
    },
    coverage: classificationLevels.map((level) => ({
      level,
      count: records.filter(
        (record) =>
          record.confidentiality === level || record.integrity === level || record.availability === level,
      ).length,
    })),
    records,
  };
}

async function buildBrandingSnapshot(env: EnvBindings, tenantId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id, primary_logo_url, primary_logo_dark_url, favicon_url, login_logo_url, background_image_url,
           primary_color, accent_color, sidebar_background_color, banner_color, login_message, footer_text,
           enable_background_blur, enable_background_overlay, show_powered_by_regovise, created_at, updated_at
    FROM setup_branding_configs
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<SetupBrandingRow>();

  const config = {
    primaryLogoUrl: row?.primary_logo_url ?? defaultBrandingConfig.primaryLogoUrl,
    primaryLogoDarkUrl: row?.primary_logo_dark_url ?? defaultBrandingConfig.primaryLogoDarkUrl,
    faviconUrl: row?.favicon_url ?? defaultBrandingConfig.faviconUrl,
    loginLogoUrl: row?.login_logo_url ?? defaultBrandingConfig.loginLogoUrl,
    backgroundImageUrl: row?.background_image_url ?? defaultBrandingConfig.backgroundImageUrl,
    primaryColor: row?.primary_color ?? defaultBrandingConfig.primaryColor,
    accentColor: row?.accent_color ?? defaultBrandingConfig.accentColor,
    sidebarBackgroundColor: row?.sidebar_background_color ?? defaultBrandingConfig.sidebarBackgroundColor,
    bannerColor: row?.banner_color ?? defaultBrandingConfig.bannerColor,
    loginMessage: row?.login_message ?? defaultBrandingConfig.loginMessage,
    footerText: row?.footer_text ?? defaultBrandingConfig.footerText,
    enableBackgroundBlur: row?.enable_background_blur === 1,
    enableBackgroundOverlay: row?.enable_background_overlay === 1,
    showPoweredByRegovise: row?.show_powered_by_regovise === 1,
    updatedAt: row?.updated_at ?? nowIso(),
  };

  const assetCount = [
    config.primaryLogoUrl,
    config.primaryLogoDarkUrl,
    config.faviconUrl,
    config.loginLogoUrl,
    config.backgroundImageUrl,
  ].filter(Boolean).length;

  const customizedColors = [
    ['primaryColor', defaultBrandingConfig.primaryColor],
    ['accentColor', defaultBrandingConfig.accentColor],
    ['sidebarBackgroundColor', defaultBrandingConfig.sidebarBackgroundColor],
    ['bannerColor', defaultBrandingConfig.bannerColor],
  ].filter(([key, value]) => config[key as keyof typeof config] !== value).length;

  return {
    metrics: {
      uploadedAssets: assetCount,
      customizedColors,
      loginExperience: config.loginLogoUrl || config.backgroundImageUrl ? 'Customized' : 'Default',
      reportBrandingReady: Boolean(config.primaryLogoUrl || config.footerText),
    },
    config,
    records: {
      visualReadiness: [
        {
          title: 'Login experience',
          status: config.loginLogoUrl || config.backgroundImageUrl ? 'Ready' : 'Default',
          detail: 'Controls branded sign-in visuals and first-run entry experience.',
        },
        {
          title: 'Shell chrome',
          status: customizedColors > 0 ? 'Customized' : 'Default',
          detail: 'Applies to left rail, banners, and primary action surfaces.',
        },
        {
          title: 'Report identity',
          status: config.primaryLogoUrl ? 'Ready' : 'Pending',
          detail: 'Determines whether exports and generated documents can inherit tenant branding.',
        },
      ],
      surfaceCoverage: [
        {
          title: 'Workspace shell',
          description: 'Navigation chrome, banners, and core layout accents.',
        },
        {
          title: 'Login and invite flows',
          description: 'Authentication screens, welcome copy, and support contact posture.',
        },
        {
          title: 'Exports and reports',
          description: 'Document footer and brand identity carried into generated outputs.',
        },
      ],
      runtimeContracts: [
        'Branding remains tenant-scoped and metadata-only in D1 until dedicated asset upload handling is added.',
        'URLs should point to approved CDN or R2-hosted assets before being promoted to production.',
        'Review contrast and shell consistency whenever changing primary, accent, or sidebar colors.',
      ],
    },
  };
}

async function buildGeneralSnapshot(env: EnvBindings, tenantId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id, organization_name, workspace_label, timezone, locale, date_format, fiscal_year_start_month,
           default_due_time, default_reviewer_team, working_days_json, change_freeze_enabled, change_freeze_window,
           created_at, updated_at
    FROM setup_general_configs
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<SetupGeneralConfigRow>();

  const config = {
    organizationName: row?.organization_name ?? defaultGeneralConfig.organizationName,
    workspaceLabel: row?.workspace_label ?? defaultGeneralConfig.workspaceLabel,
    timezone: row?.timezone ?? defaultGeneralConfig.timezone,
    locale: row?.locale ?? defaultGeneralConfig.locale,
    dateFormat: row?.date_format ?? defaultGeneralConfig.dateFormat,
    fiscalYearStartMonth: row?.fiscal_year_start_month ?? defaultGeneralConfig.fiscalYearStartMonth,
    defaultDueTime: row?.default_due_time ?? defaultGeneralConfig.defaultDueTime,
    defaultReviewerTeam: row?.default_reviewer_team ?? defaultGeneralConfig.defaultReviewerTeam,
    workingDays: asJson<string[]>(row?.working_days_json, [...defaultGeneralConfig.workingDays]),
    changeFreezeEnabled: row?.change_freeze_enabled === 1,
    changeFreezeWindow: row?.change_freeze_window ?? defaultGeneralConfig.changeFreezeWindow,
    updatedAt: row?.updated_at ?? nowIso(),
  };

  return {
    metrics: {
      workingDays: config.workingDays.length,
      changeFreezeEnabled: config.changeFreezeEnabled,
      reviewerTeamConfigured: Boolean(config.defaultReviewerTeam),
      locale: config.locale,
    },
    config,
    records: {
      operatingDefaults: [
        {
          label: 'Workspace label',
          value: config.workspaceLabel,
          hint: 'Used in builders, AI workspaces, and operator-facing control rooms.',
        },
        {
          label: 'Timezone',
          value: config.timezone,
          hint: 'Controls timestamp defaults across workflow, exports, and notification scheduling.',
        },
        {
          label: 'Locale and date format',
          value: `${config.locale} · ${config.dateFormat}`,
          hint: 'Used for table formatting, exported artifacts, and UI display defaults.',
        },
        {
          label: 'Fiscal year start',
          value: config.fiscalYearStartMonth,
          hint: 'Feeds planning and reporting cadences across governance workspaces.',
        },
      ],
      coordinationSignals: [
        {
          title: 'Calendar alignment',
          status: config.workingDays.length >= 5 ? 'Healthy' : 'Review',
          detail: `${config.workingDays.join(', ')} operate in ${config.timezone}.`,
        },
        {
          title: 'Reviewer routing',
          status: config.defaultReviewerTeam ? 'Configured' : 'Missing',
          detail: `${config.defaultReviewerTeam || 'No default reviewer team set'} handles first-pass governance review.`,
        },
        {
          title: 'Change freeze guidance',
          status: config.changeFreezeEnabled ? 'Enabled' : 'Disabled',
          detail: config.changeFreezeEnabled
            ? config.changeFreezeWindow
            : 'No change-freeze advisory is shown in administrative workflows.',
        },
      ],
      downstreamEffects: [
        'General settings influence due-date defaults, review routing, and timestamp formatting across canonical workspaces.',
        'Timezone and locale should be aligned before enabling production notifications or customer-facing exports.',
        config.changeFreezeEnabled
          ? `Change freeze guidance is active: ${config.changeFreezeWindow}.`
          : 'Change freeze guidance is currently disabled.',
      ],
    },
  };
}

function getRiskBandRangeLabel(label: string, acceptableMax: number, monitorMax: number, mitigateMax: number) {
  if (label === 'Acceptable') {
    return `0-${acceptableMax}`;
  }
  if (label === 'Monitor') {
    return `${acceptableMax + 1}-${monitorMax}`;
  }
  if (label === 'Mitigate') {
    return `${monitorMax + 1}-${mitigateMax}`;
  }
  return `${mitigateMax + 1}+`;
}

async function buildRiskModelSnapshot(env: EnvBindings, tenantId: string) {
  const row = await env.D1_MAIN.prepare(
    `
    SELECT tenant_id, model_type, likelihood_scale, impact_scale, acceptable_max, monitor_max, mitigate_max,
           formula_preset, residual_risk_method, inherited_risk_method, risk_owner_role, auto_escalation_enabled,
           auto_escalation_threshold, auto_escalation_days, created_at, updated_at
    FROM setup_risk_models
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<SetupRiskModelRow>();

  const config = {
    modelType: row?.model_type ?? defaultRiskModelConfig.modelType,
    likelihoodScale: row?.likelihood_scale ?? defaultRiskModelConfig.likelihoodScale,
    impactScale: row?.impact_scale ?? defaultRiskModelConfig.impactScale,
    acceptableMax: row?.acceptable_max ?? defaultRiskModelConfig.acceptableMax,
    monitorMax: row?.monitor_max ?? defaultRiskModelConfig.monitorMax,
    mitigateMax: row?.mitigate_max ?? defaultRiskModelConfig.mitigateMax,
    formulaPreset: row?.formula_preset ?? defaultRiskModelConfig.formulaPreset,
    residualRiskMethod: row?.residual_risk_method ?? defaultRiskModelConfig.residualRiskMethod,
    inheritedRiskMethod: row?.inherited_risk_method ?? defaultRiskModelConfig.inheritedRiskMethod,
    riskOwnerRole: row?.risk_owner_role ?? defaultRiskModelConfig.riskOwnerRole,
    autoEscalationEnabled: row?.auto_escalation_enabled === 1,
    autoEscalationThreshold: row?.auto_escalation_threshold ?? defaultRiskModelConfig.autoEscalationThreshold,
    autoEscalationDays: row?.auto_escalation_days ?? defaultRiskModelConfig.autoEscalationDays,
    updatedAt: row?.updated_at ?? nowIso(),
  };

  return {
    metrics: {
      modelType: config.modelType,
      scaleSize: `${config.likelihoodScale}x${config.impactScale}`,
      escalationEnabled: config.autoEscalationEnabled,
      threshold: config.autoEscalationThreshold,
    },
    config,
    records: {
      governanceSignals: [
        {
          title: 'Escalation posture',
          status: config.autoEscalationEnabled ? 'Active' : 'Manual',
          detail: config.autoEscalationEnabled
            ? `${config.autoEscalationThreshold} risks escalate after ${config.autoEscalationDays} days.`
            : 'High-severity risks remain visible, but no automatic escalation rule is active.',
        },
        {
          title: 'Residual scoring',
          status: config.residualRiskMethod.includes('Recalculate') ? 'Deterministic' : 'Guided review',
          detail: config.residualRiskMethod,
        },
        {
          title: 'Risk ownership',
          status: 'Configured',
          detail: `${config.riskOwnerRole} is the default owner role for treatment and accountability workflows.`,
        },
      ],
      thresholdBands: [
        { label: 'Acceptable', value: getRiskBandRangeLabel('Acceptable', config.acceptableMax, config.monitorMax, config.mitigateMax), hint: 'Low enough to accept with routine monitoring.' },
        { label: 'Monitor', value: getRiskBandRangeLabel('Monitor', config.acceptableMax, config.monitorMax, config.mitigateMax), hint: 'Track and review regularly with owners.' },
        { label: 'Mitigate', value: getRiskBandRangeLabel('Mitigate', config.acceptableMax, config.monitorMax, config.mitigateMax), hint: 'Treatment planning is expected.' },
        { label: 'Avoid', value: getRiskBandRangeLabel('Avoid', config.acceptableMax, config.monitorMax, config.mitigateMax), hint: 'Escalate quickly for leadership attention.' },
      ],
      runtimeContracts: [
        'Risk-model values live in D1 so all canonical risk workflows resolve from one tenant-scoped source of truth.',
        'Scoring changes should be applied carefully because they can shift risk posture summaries and future treatment routing.',
        'Threshold updates are designed to stay explainable for auditors, not just mathematically convenient.',
      ],
    },
  };
}

async function updateRegmlFlagsFromModulesFeatures(
  env: EnvBindings,
  tenantId: string,
  userId: string,
  regmlEnabled: boolean,
  regmlTermsAccepted: boolean,
) {
  const existing = await env.D1_MAIN.prepare(
    `
    SELECT enabled, terms_accepted, deployment_mode, backend_available
    FROM regml_settings
    WHERE tenant_id = ?
    LIMIT 1
    `,
  )
    .bind(tenantId)
    .first<RegmlSettingsStateRow>();

  const now = nowIso();
  await env.D1_MAIN.prepare(
    `
    INSERT INTO regml_settings (
      tenant_id,
      enabled,
      terms_accepted,
      deployment_mode,
      backend_available,
      updated_by_user_id,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET
      enabled = excluded.enabled,
      terms_accepted = excluded.terms_accepted,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at
    `,
  )
    .bind(
      tenantId,
      regmlEnabled ? 1 : 0,
      regmlTermsAccepted ? 1 : 0,
      existing?.deployment_mode ?? 'SaaS',
      existing?.backend_available ?? 1,
      userId,
      now,
      now,
    )
    .run();
}

export async function seedDemoSetupWorkspace(env: EnvBindings, args?: { tenantId?: string; userId?: string | null }) {
  await ensureSeedSetupWorkspace(env, args?.tenantId ?? 'tenant-demo', args?.userId ?? 'user-demo');
}

export async function handleSetupRoutes(
  segments: string[],
  ctx: WorkerRequestContext,
): Promise<Response> {
  const [resource, id, action] = segments;
  const setupAccess = await requireRootAdminAccess(
    ctx,
    'Tenant administrator access is required for setup operations.',
  );
  if (setupAccess instanceof Response) {
    return setupAccess;
  }
  const { tenantId } = setupAccess;

  if (resource === 'tags') {
    await ensureSeedTags(ctx.env, tenantId, ctx.userId);

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await listTags(ctx.env, tenantId) });
    }

    if (!id && ctx.request.method === 'POST') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const body = await readJson<TagPayload>(ctx.request);
      const title = body.title?.trim();
      if (!title) {
        return json({ error: 'invalid_title', message: 'Tag title is required.' }, { status: 400 });
      }

      const nextId = crypto.randomUUID();
      const now = nowIso();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_tags (
          id, tenant_id, title, tag_type, oscal_required, usage_count, created_by_user_id, updated_by_user_id, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `,
      )
        .bind(nextId, tenantId, title, body.type === 'System' ? 'System' : 'User', body.oscalRequired ? 1 : 0, userId, userId, now, now)
        .run();

      return json({ data: await listTags(ctx.env, tenantId) }, { status: 201 });
    }

    if (id && ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const body = await readJson<TagPayload>(ctx.request);
      const title = body.title?.trim();
      if (!title) {
        return json({ error: 'invalid_title', message: 'Tag title is required.' }, { status: 400 });
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE setup_tags
        SET title = ?, tag_type = ?, oscal_required = ?, updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(title, body.type === 'System' ? 'System' : 'User', body.oscalRequired ? 1 : 0, userId, nowIso(), id, tenantId)
        .run();

      return json({ data: await listTags(ctx.env, tenantId) });
    }

    if (id && ctx.request.method === 'DELETE') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      await ctx.env.D1_MAIN.prepare(`DELETE FROM setup_tags WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).run();
      return json({ data: await listTags(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'service-accounts') {
    await ensureSeedServiceAccounts(ctx.env, tenantId, ctx.userId);

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await listServiceAccounts(ctx.env, tenantId) });
    }

    if (!id && ctx.request.method === 'POST') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const body = await readJson<CreateServiceAccountPayload>(ctx.request);
      const purpose = body.purpose?.trim();
      const role = body.role ?? 'Automation Operator';
      const durationDays = Math.max(1, Math.min(365, Math.round(body.durationDays ?? 90)));

      if (!purpose) {
        return json({ error: 'invalid_purpose', message: 'Service account purpose is required.' }, { status: 400 });
      }

      const secretPrefix = `PAT-${Math.floor(Math.random() * 9000) + 1000}`;
      const secret = buildServiceAccountSecret(secretPrefix);
      const runtime = getServiceAccountRuntime(role);
      const accountId = crypto.randomUUID();
      const now = nowIso();
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_service_accounts (
          id, tenant_id, token_prefix, purpose, role_name, runtime, scopes_json, expires_at, last_used_at, last_rotated_at,
          created_by_user_id, updated_by_user_id, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?)
        `,
      )
        .bind(accountId, tenantId, secret.tokenPrefix, purpose, role, runtime.runtime, JSON.stringify(runtime.scopes), expiresAt, now, userId, userId, now, now)
        .run();

      return json(
        {
          data: {
            ...(await listServiceAccounts(ctx.env, tenantId)),
            newlyIssuedToken: {
              accountId,
              tokenValue: secret.tokenValue,
              tokenPreview: secret.revealedPreview,
            },
          },
        },
        { status: 201 },
      );
    }

    if (id && action === 'rotate' && ctx.request.method === 'POST') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const body = await readJson<CreateServiceAccountPayload>(ctx.request);
      const durationDays = Math.max(1, Math.min(365, Math.round(body.durationDays ?? 90)));
      const now = nowIso();
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      const secretPrefix = `PAT-${Math.floor(Math.random() * 9000) + 1000}`;
      const secret = buildServiceAccountSecret(secretPrefix);

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE setup_service_accounts
        SET token_prefix = ?, expires_at = ?, last_rotated_at = ?, updated_by_user_id = ?, updated_at = ?, is_active = 1
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(secret.tokenPrefix, expiresAt, now, userId, now, id, tenantId)
        .run();

      return json({
        data: {
          ...(await listServiceAccounts(ctx.env, tenantId)),
          newlyIssuedToken: {
            accountId: id,
            tokenValue: secret.tokenValue,
            tokenPreview: secret.revealedPreview,
          },
        },
      });
    }

    if (id && ctx.request.method === 'DELETE') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE setup_service_accounts
        SET is_active = 0, updated_by_user_id = ?, updated_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(userId, nowIso(), id, tenantId)
        .run();

      return json({ data: await listServiceAccounts(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'POST', 'DELETE']);
  }

  if (resource === 'logs-utilization') {
    if (ctx.request.method !== 'GET') {
      return methodNotAllowed(['GET']);
    }

    return json({ data: await buildLogsUtilizationSnapshot(ctx.env, tenantId) });
  }

  if (resource === 'security') {
    await ensureSeedSecurityControls(ctx.env, tenantId, ctx.userId);

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await buildSecuritySnapshot(ctx.env, tenantId) });
    }

    if (id && ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const body = await readJson<UpdateSecurityControlPayload>(ctx.request);
      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE setup_security_controls
        SET status = COALESCE(?, status),
            owner_name = COALESCE(?, owner_name),
            description = COALESCE(?, description),
            detail_json = COALESCE(?, detail_json),
            updated_by_user_id = ?,
            updated_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          body.status?.trim() || null,
          body.ownerName?.trim() || null,
          body.description?.trim() || null,
          body.detail ? JSON.stringify(body.detail) : null,
          userId,
          nowIso(),
          id,
          tenantId,
        )
        .run();

      return json({ data: await buildSecuritySnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (resource === 'modules-features') {
    await ensureSeedModulesFeatures(ctx.env, tenantId, ctx.userId);

    if (ctx.request.method === 'GET') {
      return json({ data: await buildModulesFeaturesSnapshot(ctx.env, tenantId) });
    }

    if (ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const body = await readJson<UpdateModulesFeaturesPayload>(ctx.request);
      const enabledModuleIds = Array.isArray(body.enabledModuleIds)
        ? moduleCatalog.map((module) => module.id).filter((id) => body.enabledModuleIds?.includes(id))
        : moduleCatalog.map((module) => module.id);
      const enabledFeatureFlagIds = Array.isArray(body.enabledFeatureFlagIds)
        ? featureFlagCatalog.map((feature) => feature.id).filter((id) => body.enabledFeatureFlagIds?.includes(id))
        : featureFlagCatalog.map((feature) => feature.id);
      const regmlEnabled = body.regmlEnabled ?? enabledFeatureFlagIds.includes('regml');
      const regmlTermsAccepted = body.regmlTermsAccepted ?? regmlEnabled;
      const note = body.statusNote?.trim() || null;
      const now = nowIso();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_modules_features (
          tenant_id,
          enabled_modules_json,
          feature_flags_json,
          regml_enabled,
          regml_terms_accepted,
          status_note,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          enabled_modules_json = excluded.enabled_modules_json,
          feature_flags_json = excluded.feature_flags_json,
          regml_enabled = excluded.regml_enabled,
          regml_terms_accepted = excluded.regml_terms_accepted,
          status_note = excluded.status_note,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          tenantId,
          JSON.stringify(enabledModuleIds),
          JSON.stringify(enabledFeatureFlagIds),
          regmlEnabled ? 1 : 0,
          regmlTermsAccepted ? 1 : 0,
          note,
          userId,
          userId,
          now,
          now,
        )
        .run();

      await updateRegmlFlagsFromModulesFeatures(ctx.env, tenantId, userId, regmlEnabled, regmlTermsAccepted);
      return json({ data: await buildModulesFeaturesSnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (resource === 'sso') {
    await ensureSeedSsoConfig(ctx.env, tenantId, ctx.userId);

    if (ctx.request.method === 'GET') {
      return json({ data: await buildSsoSnapshot(ctx.env, tenantId) });
    }

    if (ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const current = await ctx.env.D1_MAIN.prepare(
        `
        SELECT tenant_id, provider_type, auth_protocol, domain_hint, client_id, callback_url, metadata_url, roles_claim, email_claim, given_name_claim, family_name_claim, username_claim, button_label, group_sync_enabled, login_enforced, allow_local_fallback, jit_provisioning_enabled, status, created_at, updated_at
        FROM setup_sso_configs
        WHERE tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(tenantId)
        .first<SetupSsoConfigRow>();
      const body = await readJson<UpdateSsoPayload>(ctx.request);
      const authProtocol = normalizeAuthProtocol(body.authProtocol ?? current?.auth_protocol ?? 'oidc');
      const providerType = body.providerType?.trim() || current?.provider_type || 'Generic OIDC';
      const domainHint = body.domainHint?.trim() || '';
      const clientId = body.clientId?.trim() || '';
      const callbackUrl = body.callbackUrl?.trim() || defaultSsoCallbackUrl(ctx.env);
      const metadataUrl = body.metadataUrl?.trim() || '';
      const rolesClaim = body.rolesClaim?.trim() || current?.roles_claim || 'roles';
      const emailClaim = body.emailClaim?.trim() || current?.email_claim || 'email';
      const givenNameClaim = body.givenNameClaim?.trim() || current?.given_name_claim || 'given_name';
      const familyNameClaim = body.familyNameClaim?.trim() || current?.family_name_claim || 'family_name';
      const usernameClaim = body.usernameClaim?.trim() || current?.username_claim || 'preferred_username';
      const buttonLabel = body.buttonLabel?.trim() || current?.button_label || '';
      const groupSyncEnabled = body.groupSyncEnabled ?? current?.group_sync_enabled === 1;
      const loginEnforced = body.loginEnforced ?? current?.login_enforced === 1;
      const allowLocalFallback = body.allowLocalFallback ?? current?.allow_local_fallback !== 0;
      const jitProvisioningEnabled =
        body.jitProvisioningEnabled ?? current?.jit_provisioning_enabled === 1;
      const status = body.status?.trim() || current?.status || 'Review';
      const now = nowIso();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_sso_configs (
          tenant_id,
          auth_protocol,
          provider_type,
          domain_hint,
          client_id,
          callback_url,
          metadata_url,
          roles_claim,
          email_claim,
          given_name_claim,
          family_name_claim,
          username_claim,
          button_label,
          group_sync_enabled,
          login_enforced,
          allow_local_fallback,
          jit_provisioning_enabled,
          status,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          auth_protocol = excluded.auth_protocol,
          provider_type = excluded.provider_type,
          domain_hint = excluded.domain_hint,
          client_id = excluded.client_id,
          callback_url = excluded.callback_url,
          metadata_url = excluded.metadata_url,
          roles_claim = excluded.roles_claim,
          email_claim = excluded.email_claim,
          given_name_claim = excluded.given_name_claim,
          family_name_claim = excluded.family_name_claim,
          username_claim = excluded.username_claim,
          button_label = excluded.button_label,
          group_sync_enabled = excluded.group_sync_enabled,
          login_enforced = excluded.login_enforced,
          allow_local_fallback = excluded.allow_local_fallback,
          jit_provisioning_enabled = excluded.jit_provisioning_enabled,
          status = excluded.status,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          tenantId,
          authProtocol,
          providerType,
          domainHint,
          clientId,
          callbackUrl,
          metadataUrl,
          rolesClaim,
          emailClaim,
          givenNameClaim,
          familyNameClaim,
          usernameClaim,
          buttonLabel,
          groupSyncEnabled ? 1 : 0,
          loginEnforced ? 1 : 0,
          allowLocalFallback ? 1 : 0,
          jitProvisioningEnabled ? 1 : 0,
          status,
          userId,
          userId,
          now,
          now,
        )
        .run();

      return json({ data: await buildSsoSnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (resource === 'mfa') {
    await ensureSeedMfaPolicy(ctx.env, tenantId, ctx.userId);

    if (ctx.request.method === 'GET') {
      return json({ data: await buildMfaSnapshot(ctx.env, tenantId) });
    }

    if (ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const current = await ctx.env.D1_MAIN.prepare(
        `
        SELECT tenant_id, enforcement, methods_json, exempt_service_accounts_json, grace_period_days, target_coverage, status, created_at, updated_at
        FROM setup_mfa_policies
        WHERE tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(tenantId)
        .first<SetupMfaPolicyRow>();
      const currentMethods = asJson<Record<string, boolean>>(current?.methods_json, {});
      const body = await readJson<UpdateMfaPayload>(ctx.request);
      const enforcement = body.enforcement?.trim() || current?.enforcement || 'Optional';
      const methods = {
        ...currentMethods,
        ...(body.methods ?? {}),
      };
      const exemptServiceAccounts = Array.isArray(body.exemptServiceAccounts)
        ? body.exemptServiceAccounts.map((item) => item.trim()).filter(Boolean)
        : asJson<string[]>(current?.exempt_service_accounts_json, []);
      const gracePeriodDays = Math.max(0, Math.min(90, Math.round(body.gracePeriodDays ?? current?.grace_period_days ?? 14)));
      const targetCoverage = Math.max(0, Math.min(100, Math.round(body.targetCoverage ?? current?.target_coverage ?? 80)));
      const status = body.status?.trim() || current?.status || 'Planned';
      const now = nowIso();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_mfa_policies (
          tenant_id,
          enforcement,
          methods_json,
          exempt_service_accounts_json,
          grace_period_days,
          target_coverage,
          status,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          enforcement = excluded.enforcement,
          methods_json = excluded.methods_json,
          exempt_service_accounts_json = excluded.exempt_service_accounts_json,
          grace_period_days = excluded.grace_period_days,
          target_coverage = excluded.target_coverage,
          status = excluded.status,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          tenantId,
          enforcement,
          JSON.stringify(methods),
          JSON.stringify(exemptServiceAccounts),
          gracePeriodDays,
          targetCoverage,
          status,
          userId,
          userId,
          now,
          now,
        )
        .run();

      return json({ data: await buildMfaSnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (resource === 'email') {
    await ensureSeedEmailConfig(ctx.env, tenantId, ctx.userId);

    if (ctx.request.method === 'GET') {
      return json({ data: await buildEmailSnapshot(ctx.env, tenantId) });
    }

    if (ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const current = await ctx.env.D1_MAIN.prepare(
        `
        SELECT tenant_id, support_email, delivery_mode, status, status_note, last_verified_at, created_at, updated_at
        FROM setup_email_configs
        WHERE tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(tenantId)
        .first<SetupEmailConfigRow>();
      const body = await readJson<UpdateEmailPayload>(ctx.request);
      const now = nowIso();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_email_configs (
          tenant_id,
          support_email,
          delivery_mode,
          status,
          status_note,
          last_verified_at,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          support_email = excluded.support_email,
          delivery_mode = excluded.delivery_mode,
          status = excluded.status,
          status_note = excluded.status_note,
          last_verified_at = excluded.last_verified_at,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          tenantId,
          body.supportEmail?.trim() || null,
          body.deliveryMode?.trim() || current?.delivery_mode || 'Disabled',
          body.status?.trim() || current?.status || 'Review',
          body.statusNote?.trim() || current?.status_note || null,
          now,
          userId,
          userId,
          current?.created_at ?? now,
          now,
        )
        .run();

      return json({ data: await buildEmailSnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (resource === 'classification') {
    await ensureSeedClassifications(ctx.env, tenantId, ctx.userId);

    if (!id && ctx.request.method === 'GET') {
      return json({ data: await buildClassificationSnapshot(ctx.env, tenantId) });
    }

    if (!id && ctx.request.method === 'POST') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const body = await readJson<ClassificationPayload>(ctx.request);
      const title = body.title?.trim();
      if (!title) {
        return json({ error: 'invalid_title', message: 'Classification title is required.' }, { status: 400 });
      }

      const normalizeLevel = (value?: string) =>
        classificationLevels.includes((value?.trim() ?? 'Moderate') as (typeof classificationLevels)[number])
          ? value?.trim() ?? 'Moderate'
          : 'Moderate';

      const now = nowIso();
      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_classifications (
          id,
          tenant_id,
          title,
          confidentiality,
          integrity,
          availability,
          usage_count,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `,
      )
        .bind(
          crypto.randomUUID(),
          tenantId,
          title,
          normalizeLevel(body.confidentiality),
          normalizeLevel(body.integrity),
          normalizeLevel(body.availability),
          userId,
          userId,
          now,
          now,
        )
        .run();

      return json({ data: await buildClassificationSnapshot(ctx.env, tenantId) }, { status: 201 });
    }

    if (id && ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const body = await readJson<ClassificationPayload>(ctx.request);
      const title = body.title?.trim();
      if (!title) {
        return json({ error: 'invalid_title', message: 'Classification title is required.' }, { status: 400 });
      }

      const normalizeLevel = (value?: string) =>
        classificationLevels.includes((value?.trim() ?? 'Moderate') as (typeof classificationLevels)[number])
          ? value?.trim() ?? 'Moderate'
          : 'Moderate';

      await ctx.env.D1_MAIN.prepare(
        `
        UPDATE setup_classifications
        SET title = ?,
            confidentiality = ?,
            integrity = ?,
            availability = ?,
            updated_by_user_id = ?,
            updated_at = ?
        WHERE id = ? AND tenant_id = ?
        `,
      )
        .bind(
          title,
          normalizeLevel(body.confidentiality),
          normalizeLevel(body.integrity),
          normalizeLevel(body.availability),
          userId,
          nowIso(),
          id,
          tenantId,
        )
        .run();

      return json({ data: await buildClassificationSnapshot(ctx.env, tenantId) });
    }

    if (id && ctx.request.method === 'DELETE') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      await ctx.env.D1_MAIN.prepare(
        `DELETE FROM setup_classifications WHERE id = ? AND tenant_id = ?`,
      )
        .bind(id, tenantId)
        .run();

      return json({ data: await buildClassificationSnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'POST', 'PUT', 'DELETE']);
  }

  if (resource === 'branding') {
    await ensureSeedBrandingConfig(ctx.env, tenantId, ctx.userId);

    if (ctx.request.method === 'GET') {
      return json({ data: await buildBrandingSnapshot(ctx.env, tenantId) });
    }

    if (ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const current = await ctx.env.D1_MAIN.prepare(
        `
        SELECT tenant_id, primary_logo_url, primary_logo_dark_url, favicon_url, login_logo_url, background_image_url,
               primary_color, accent_color, sidebar_background_color, banner_color, login_message, footer_text,
               enable_background_blur, enable_background_overlay, show_powered_by_regovise, created_at, updated_at
        FROM setup_branding_configs
        WHERE tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(tenantId)
        .first<SetupBrandingRow>();
      const body = await readJson<UpdateBrandingPayload>(ctx.request);
      const now = nowIso();
      const enableBackgroundBlur =
        body.enableBackgroundBlur ?? (current?.enable_background_blur === 1 ? true : defaultBrandingConfig.enableBackgroundBlur);
      const enableBackgroundOverlay =
        body.enableBackgroundOverlay ??
        (current?.enable_background_overlay === 1 ? true : defaultBrandingConfig.enableBackgroundOverlay);
      const showPoweredByRegovise =
        body.showPoweredByRegovise ??
        (current?.show_powered_by_regovise === 1 ? true : defaultBrandingConfig.showPoweredByRegovise);

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_branding_configs (
          tenant_id,
          primary_logo_url,
          primary_logo_dark_url,
          favicon_url,
          login_logo_url,
          background_image_url,
          primary_color,
          accent_color,
          sidebar_background_color,
          banner_color,
          login_message,
          footer_text,
          enable_background_blur,
          enable_background_overlay,
          show_powered_by_regovise,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          primary_logo_url = excluded.primary_logo_url,
          primary_logo_dark_url = excluded.primary_logo_dark_url,
          favicon_url = excluded.favicon_url,
          login_logo_url = excluded.login_logo_url,
          background_image_url = excluded.background_image_url,
          primary_color = excluded.primary_color,
          accent_color = excluded.accent_color,
          sidebar_background_color = excluded.sidebar_background_color,
          banner_color = excluded.banner_color,
          login_message = excluded.login_message,
          footer_text = excluded.footer_text,
          enable_background_blur = excluded.enable_background_blur,
          enable_background_overlay = excluded.enable_background_overlay,
          show_powered_by_regovise = excluded.show_powered_by_regovise,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          tenantId,
          body.primaryLogoUrl?.trim() ?? current?.primary_logo_url ?? defaultBrandingConfig.primaryLogoUrl,
          body.primaryLogoDarkUrl?.trim() ?? current?.primary_logo_dark_url ?? defaultBrandingConfig.primaryLogoDarkUrl,
          body.faviconUrl?.trim() ?? current?.favicon_url ?? defaultBrandingConfig.faviconUrl,
          body.loginLogoUrl?.trim() ?? current?.login_logo_url ?? defaultBrandingConfig.loginLogoUrl,
          body.backgroundImageUrl?.trim() ?? current?.background_image_url ?? defaultBrandingConfig.backgroundImageUrl,
          body.primaryColor?.trim() ?? current?.primary_color ?? defaultBrandingConfig.primaryColor,
          body.accentColor?.trim() ?? current?.accent_color ?? defaultBrandingConfig.accentColor,
          body.sidebarBackgroundColor?.trim() ??
            current?.sidebar_background_color ??
            defaultBrandingConfig.sidebarBackgroundColor,
          body.bannerColor?.trim() ?? current?.banner_color ?? defaultBrandingConfig.bannerColor,
          body.loginMessage?.trim() ?? current?.login_message ?? defaultBrandingConfig.loginMessage,
          body.footerText?.trim() ?? current?.footer_text ?? defaultBrandingConfig.footerText,
          enableBackgroundBlur ? 1 : 0,
          enableBackgroundOverlay ? 1 : 0,
          showPoweredByRegovise ? 1 : 0,
          userId,
          userId,
          current?.created_at ?? now,
          now,
        )
        .run();

      return json({ data: await buildBrandingSnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (resource === 'general') {
    await ensureSeedGeneralConfig(ctx.env, tenantId, ctx.userId);

    if (ctx.request.method === 'GET') {
      return json({ data: await buildGeneralSnapshot(ctx.env, tenantId) });
    }

    if (ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const current = await ctx.env.D1_MAIN.prepare(
        `
        SELECT tenant_id, organization_name, workspace_label, timezone, locale, date_format, fiscal_year_start_month,
               default_due_time, default_reviewer_team, working_days_json, change_freeze_enabled, change_freeze_window,
               created_at, updated_at
        FROM setup_general_configs
        WHERE tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(tenantId)
        .first<SetupGeneralConfigRow>();
      const body = await readJson<UpdateGeneralPayload>(ctx.request);
      const now = nowIso();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_general_configs (
          tenant_id, organization_name, workspace_label, timezone, locale, date_format, fiscal_year_start_month,
          default_due_time, default_reviewer_team, working_days_json, change_freeze_enabled, change_freeze_window,
          created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          organization_name = excluded.organization_name,
          workspace_label = excluded.workspace_label,
          timezone = excluded.timezone,
          locale = excluded.locale,
          date_format = excluded.date_format,
          fiscal_year_start_month = excluded.fiscal_year_start_month,
          default_due_time = excluded.default_due_time,
          default_reviewer_team = excluded.default_reviewer_team,
          working_days_json = excluded.working_days_json,
          change_freeze_enabled = excluded.change_freeze_enabled,
          change_freeze_window = excluded.change_freeze_window,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          tenantId,
          body.organizationName?.trim() || current?.organization_name || defaultGeneralConfig.organizationName,
          body.workspaceLabel?.trim() || current?.workspace_label || defaultGeneralConfig.workspaceLabel,
          body.timezone?.trim() || current?.timezone || defaultGeneralConfig.timezone,
          body.locale?.trim() || current?.locale || defaultGeneralConfig.locale,
          body.dateFormat?.trim() || current?.date_format || defaultGeneralConfig.dateFormat,
          body.fiscalYearStartMonth?.trim() || current?.fiscal_year_start_month || defaultGeneralConfig.fiscalYearStartMonth,
          body.defaultDueTime?.trim() || current?.default_due_time || defaultGeneralConfig.defaultDueTime,
          body.defaultReviewerTeam?.trim() || current?.default_reviewer_team || defaultGeneralConfig.defaultReviewerTeam,
          JSON.stringify(
            Array.isArray(body.workingDays) && body.workingDays.length
              ? body.workingDays.map((item) => item.trim()).filter(Boolean)
              : asJson<string[]>(current?.working_days_json, [...defaultGeneralConfig.workingDays]),
          ),
          body.changeFreezeEnabled ?? (current?.change_freeze_enabled === 1 ? 1 : 0),
          body.changeFreezeWindow?.trim() || current?.change_freeze_window || defaultGeneralConfig.changeFreezeWindow,
          userId,
          userId,
          current?.created_at ?? now,
          now,
        )
        .run();

      return json({ data: await buildGeneralSnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  if (resource === 'risk-model') {
    await ensureSeedRiskModel(ctx.env, tenantId, ctx.userId);

    if (ctx.request.method === 'GET') {
      return json({ data: await buildRiskModelSnapshot(ctx.env, tenantId) });
    }

    if (ctx.request.method === 'PUT') {
      const userId = requireUser(ctx);
      if (userId instanceof Response) {
        return userId;
      }

      const current = await ctx.env.D1_MAIN.prepare(
        `
        SELECT tenant_id, model_type, likelihood_scale, impact_scale, acceptable_max, monitor_max, mitigate_max,
               formula_preset, residual_risk_method, inherited_risk_method, risk_owner_role, auto_escalation_enabled,
               auto_escalation_threshold, auto_escalation_days, created_at, updated_at
        FROM setup_risk_models
        WHERE tenant_id = ?
        LIMIT 1
        `,
      )
        .bind(tenantId)
        .first<SetupRiskModelRow>();
      const body = await readJson<UpdateRiskModelPayload>(ctx.request);
      const now = nowIso();

      await ctx.env.D1_MAIN.prepare(
        `
        INSERT INTO setup_risk_models (
          tenant_id, model_type, likelihood_scale, impact_scale, acceptable_max, monitor_max, mitigate_max,
          formula_preset, residual_risk_method, inherited_risk_method, risk_owner_role, auto_escalation_enabled,
          auto_escalation_threshold, auto_escalation_days, created_by_user_id, updated_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id) DO UPDATE SET
          model_type = excluded.model_type,
          likelihood_scale = excluded.likelihood_scale,
          impact_scale = excluded.impact_scale,
          acceptable_max = excluded.acceptable_max,
          monitor_max = excluded.monitor_max,
          mitigate_max = excluded.mitigate_max,
          formula_preset = excluded.formula_preset,
          residual_risk_method = excluded.residual_risk_method,
          inherited_risk_method = excluded.inherited_risk_method,
          risk_owner_role = excluded.risk_owner_role,
          auto_escalation_enabled = excluded.auto_escalation_enabled,
          auto_escalation_threshold = excluded.auto_escalation_threshold,
          auto_escalation_days = excluded.auto_escalation_days,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
        `,
      )
        .bind(
          tenantId,
          body.modelType?.trim() || current?.model_type || defaultRiskModelConfig.modelType,
          Math.max(3, Math.min(7, Math.round(body.likelihoodScale ?? current?.likelihood_scale ?? defaultRiskModelConfig.likelihoodScale))),
          Math.max(3, Math.min(7, Math.round(body.impactScale ?? current?.impact_scale ?? defaultRiskModelConfig.impactScale))),
          Math.max(1, Math.round(body.acceptableMax ?? current?.acceptable_max ?? defaultRiskModelConfig.acceptableMax)),
          Math.max(2, Math.round(body.monitorMax ?? current?.monitor_max ?? defaultRiskModelConfig.monitorMax)),
          Math.max(3, Math.round(body.mitigateMax ?? current?.mitigate_max ?? defaultRiskModelConfig.mitigateMax)),
          body.formulaPreset?.trim() || current?.formula_preset || defaultRiskModelConfig.formulaPreset,
          body.residualRiskMethod?.trim() || current?.residual_risk_method || defaultRiskModelConfig.residualRiskMethod,
          body.inheritedRiskMethod?.trim() || current?.inherited_risk_method || defaultRiskModelConfig.inheritedRiskMethod,
          body.riskOwnerRole?.trim() || current?.risk_owner_role || defaultRiskModelConfig.riskOwnerRole,
          body.autoEscalationEnabled ?? (current?.auto_escalation_enabled === 1 ? 1 : 0),
          body.autoEscalationThreshold?.trim() || current?.auto_escalation_threshold || defaultRiskModelConfig.autoEscalationThreshold,
          Math.max(1, Math.min(90, Math.round(body.autoEscalationDays ?? current?.auto_escalation_days ?? defaultRiskModelConfig.autoEscalationDays))),
          userId,
          userId,
          current?.created_at ?? now,
          now,
        )
        .run();

      return json({ data: await buildRiskModelSnapshot(ctx.env, tenantId) });
    }

    return methodNotAllowed(['GET', 'PUT']);
  }

  return json({ error: 'unknown_setup_resource', resource: resource ?? null }, { status: 404 });
}
