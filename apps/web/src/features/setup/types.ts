export type SetupTagRecord = {
  id: string;
  title: string;
  type: 'User' | 'System';
  oscalRequired: boolean;
  usageCount: number;
  updatedAt: string;
};

export type SetupTagsSnapshot = {
  tags: SetupTagRecord[];
  metrics: {
    totalTags: number;
    systemTags: number;
    oscalRequired: number;
    totalUsage: number;
  };
};

export type SetupServiceAccountRecord = {
  id: string;
  tokenPrefix: string;
  expirationDate: string;
  purpose: string;
  role: string;
  runtime: string;
  scopes: string;
  isActive: boolean;
  lastUsedAt: string | null;
  lastRotatedAt: string;
  updatedAt: string;
};

export type SetupServiceAccountsSnapshot = {
  accounts: SetupServiceAccountRecord[];
  metrics: {
    activeTokens: number;
    expiringSoon: number;
    adminTokens: number;
    longestTtlDays: number;
  };
  newlyIssuedToken?: {
    accountId: string;
    tokenValue: string;
    tokenPreview: string;
  };
};

export type SetupLogsUtilizationSnapshot = {
  metrics: {
    d1Metadata: string;
    r2Objects: string;
    queueBacklog: string;
    durableObjectSessions: string;
    monthlyErrorVolume: number;
    monthlyLogins: number;
    systemEvents: number;
    activeUsers: number;
  };
  filters: {
    startDate: string;
    endDate: string;
    last24HoursOnly: boolean;
    viewMode: 'chart' | 'table';
  };
  records: {
    errorRows: Array<{
      timestamp: string;
      system: string;
      summary: string;
      count: number;
    }>;
    accessLogs: Array<{
      user: string;
      loginTime: string;
      active: string;
      admin: string;
    }>;
  };
};

export type SetupSecurityControl = {
  id: string;
  key: string;
  title: string;
  category: string;
  status: string;
  ownerName: string | null;
  description: string;
  detail: Record<string, unknown>;
  updatedAt: string;
};

export type SetupSecuritySnapshot = {
  metrics: {
    managedControls: number;
    hardenedControls: number;
    queueBacklog: number;
    evidenceArtifacts: number;
  };
  securityStatuses: [string, string, string][];
  records: {
    cloudflareControls: Array<{
      title: string;
      description: string;
    }>;
    accessLayers: Array<{
      title: string;
      description: string;
    }>;
    architecture: string[];
    controls: SetupSecurityControl[];
  };
};

export type SetupModuleRecord = {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
};

export type SetupFeatureFlagRecord = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type SetupModulesFeaturesSnapshot = {
  metrics: {
    enabledModules: number;
    disabledModules: number;
    enabledFeatureFlags: number;
    regmlReady: boolean;
  };
  readiness: {
    regmlEnabled: boolean;
    regmlTermsAccepted: boolean;
    ssoConfigured: boolean;
    mfaConfigured: boolean;
  };
  modules: SetupModuleRecord[];
  featureFlags: SetupFeatureFlagRecord[];
  statusNote: string;
  updatedAt: string;
};

export type SetupSsoSnapshot = {
  metrics: {
    configuredProviders: number;
    loginEnforced: boolean;
    groupSyncEnabled: boolean;
    callbackConfigured: boolean;
  };
  config: {
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
    runtimeReady: boolean;
    runtimeMessage: string;
    updatedAt: string;
  };
  providerCards: Array<{
    name: string;
    description: string;
    ready: boolean;
  }>;
  checklist: string[];
};

export type SetupMfaSnapshot = {
  metrics: {
    methodsEnabled: number;
    exemptAccounts: number;
    targetCoverage: number;
    enrollmentStatus: string;
  };
  policy: {
    enforcement: string;
    methods: Record<string, boolean>;
    exemptServiceAccounts: string[];
    gracePeriodDays: number;
    targetCoverage: number;
    status: string;
    updatedAt: string;
  };
  recommendations: string[];
};

export type SetupEmailSnapshot = {
  metrics: {
    provider: string;
    sendingEnabled: boolean;
    configuredSender: boolean;
    totalEvents: number;
    failedEvents: number;
  };
  config: {
    supportEmail: string;
    deliveryMode: string;
    status: string;
    statusNote: string;
    lastVerifiedAt: string | null;
    provider: string;
    fromEmail: string;
    fromName: string;
    dkimDomain: string;
    dkimSelector: string;
    webhookConfigured: boolean;
    mailchannelsConfigured: boolean;
    sendingEnabled: boolean;
    updatedAt: string;
  };
  recentEvents: Array<{
    eventType: string;
    status: string;
    provider: string;
    timestamp: string;
  }>;
  guidance: string[];
};

export type SetupClassificationRecord = {
  id: string;
  title: string;
  confidentiality: string;
  integrity: string;
  availability: string;
  usageCount: number;
  updatedAt: string;
};

export type SetupClassificationSnapshot = {
  metrics: {
    totalProfiles: number;
    highImpact: number;
    moderateImpact: number;
    lowImpact: number;
  };
  coverage: Array<{
    level: string;
    count: number;
  }>;
  records: SetupClassificationRecord[];
};

export type SetupBrandingSnapshot = {
  metrics: {
    uploadedAssets: number;
    customizedColors: number;
    loginExperience: string;
    reportBrandingReady: boolean;
  };
  config: {
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
    updatedAt: string;
  };
  records: {
    visualReadiness: Array<{
      title: string;
      status: string;
      detail: string;
    }>;
    surfaceCoverage: Array<{
      title: string;
      description: string;
    }>;
    runtimeContracts: string[];
  };
};

export type SetupGeneralSnapshot = {
  metrics: {
    workingDays: number;
    changeFreezeEnabled: boolean;
    reviewerTeamConfigured: boolean;
    locale: string;
  };
  config: {
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
    updatedAt: string;
  };
  records: {
    operatingDefaults: Array<{
      label: string;
      value: string;
      hint: string;
    }>;
    coordinationSignals: Array<{
      title: string;
      status: string;
      detail: string;
    }>;
    downstreamEffects: string[];
  };
};

export type SetupRiskModelSnapshot = {
  metrics: {
    modelType: string;
    scaleSize: string;
    escalationEnabled: boolean;
    threshold: string;
  };
  config: {
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
    updatedAt: string;
  };
  records: {
    governanceSignals: Array<{
      title: string;
      status: string;
      detail: string;
    }>;
    thresholdBands: Array<{
      label: string;
      value: string;
      hint: string;
    }>;
    runtimeContracts: string[];
  };
};
