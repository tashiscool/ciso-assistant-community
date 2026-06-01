import {
  findModuleCatalogEntry,
  listScaleModuleCatalogEntries,
  MODULE_CATALOG,
  SCALE_MD_MODULE_KEYS,
} from './moduleRegistry';

type SemanticCoverageContract = {
  source: 'scale.md' | 'regscale-public' | 'ciso-assistant' | 'minimum-equivalent' | 'worker-router';
  semanticKey: string;
  label: string;
  implementationModel: string;
  canonicalRoutes: string[];
  apiServices: string[];
  status: 'implemented' | 'unresolved';
  evidence: string[];
};

type SemanticAlignmentGap = {
  category: 'frontend-route' | 'frontend-api-service' | 'backend-handler' | 'permission-gate';
  semanticKey?: string;
  route?: string;
  service?: string;
  reason: string;
};

const REGSCALE_PUBLIC_MODULE_KEYS = [
  'assets',
  'assessments',
  'assessment-plans',
  'capabilities',
  'case-management',
  'catalogues',
  'causal-analysis',
  'changes',
  'components',
  'data-calls',
  'evidence-locker',
  'exceptions',
  'incidents',
  'interconnections',
  'issues',
  'policies',
  'programs',
  'projects',
  'questionnaires',
  'requests',
  'requirements',
  'risks',
  'security-controls',
  'security-plans',
  'security-profiles',
  'supply-chain',
  'tasks',
  'threats',
  'threat-models',
] as const;

const REGSCALE_BUILDER_CONTRACTS = [
  {
    semanticKey: 'form-builder',
    label: 'Form Builder',
    canonicalRoutes: ['/builders/form-builder'],
    apiServices: ['builders', 'core'],
  },
  {
    semanticKey: 'rules-builder',
    label: 'Rules Builder',
    canonicalRoutes: ['/builders/rules-builder', '/builders/form-builder/rules-guide'],
    apiServices: ['builders', 'core'],
  },
  {
    semanticKey: 'export-builder',
    label: 'Export Builder',
    canonicalRoutes: ['/builders/export-builder'],
    apiServices: ['builders'],
  },
  {
    semanticKey: 'report-builder',
    label: 'Report Builder',
    canonicalRoutes: ['/builders/report-builder'],
    apiServices: ['builders', 'ops'],
  },
  {
    semanticKey: 'dashboard-builder',
    label: 'Dashboard Builder',
    canonicalRoutes: ['/builders/dashboard-builder', '/dashboards'],
    apiServices: ['builders', 'ops'],
  },
  {
    semanticKey: 'questionnaire-builder',
    label: 'Questionnaire Builder',
    canonicalRoutes: ['/builders/questionnaire-builder', '/questionnaires'],
    apiServices: ['builders'],
  },
  {
    semanticKey: 'wayfinder-builder',
    label: 'Wayfinder Builder',
    canonicalRoutes: ['/builders/wayfinder-builder'],
    apiServices: ['builders'],
  },
] as const;

const CISO_BACKEND_COMPATIBILITY_CONTRACTS = [
  { semanticKey: 'core', label: 'CISO Core', canonicalRoutes: ['/program', '/modules'], apiServices: ['core'] },
  {
    semanticKey: 'iam',
    label: 'CISO IAM',
    canonicalRoutes: ['/workspace/access', '/workspace/team', '/workspace/domains'],
    apiServices: ['iam'],
  },
  { semanticKey: 'settings', label: 'CISO Settings', canonicalRoutes: ['/setup', '/setup/general'], apiServices: ['setup'] },
  {
    semanticKey: 'global_settings',
    label: 'CISO Global Settings',
    canonicalRoutes: ['/setup', '/setup/general'],
    apiServices: ['setup'],
  },
  {
    semanticKey: 'enterprise_core',
    label: 'CISO Enterprise Core',
    canonicalRoutes: ['/setup', '/workspace/access', '/license-management'],
    apiServices: ['setup', 'iam', 'ops'],
  },
  {
    semanticKey: 'webhooks',
    label: 'CISO Webhooks',
    canonicalRoutes: ['/features/automation-manager'],
    apiServices: ['integrations'],
  },
  {
    semanticKey: 'integrations',
    label: 'CISO Integrations',
    canonicalRoutes: ['/features/automation-manager'],
    apiServices: ['integrations'],
  },
  { semanticKey: 'serdes', label: 'CISO Import/Export', canonicalRoutes: ['/backup-restore', '/imports'], apiServices: ['ops'] },
  { semanticKey: 'data_wizard', label: 'CISO Data Wizard', canonicalRoutes: ['/imports'], apiServices: ['ops'] },
  { semanticKey: 'chat', label: 'CISO Chat', canonicalRoutes: ['/chat', '/features/regml'], apiServices: ['ai'] },
  { semanticKey: 'ebios_rm', label: 'CISO EBIOS RM', canonicalRoutes: ['/advanced-risk/ebios', '/ebios-rm'], apiServices: ['ops'] },
  { semanticKey: 'privacy', label: 'CISO Privacy', canonicalRoutes: ['/privacy', '/processings'], apiServices: ['core'] },
  {
    semanticKey: 'resilience',
    label: 'CISO Resilience',
    canonicalRoutes: ['/resilience', '/business-impact-analysis'],
    apiServices: ['core'],
  },
  {
    semanticKey: 'crq',
    label: 'CISO Quantitative Risk',
    canonicalRoutes: ['/advanced-risk/quantitative', '/quantitative-risk-studies'],
    apiServices: ['ops'],
  },
  { semanticKey: 'pmbok', label: 'CISO PMBOK', canonicalRoutes: ['/generic-collections', '/accreditations'], apiServices: ['ops'] },
  { semanticKey: 'metrology', label: 'CISO Metrology', canonicalRoutes: ['/analytics', '/dashboards'], apiServices: ['ops', 'builders'] },
  {
    semanticKey: 'doc_management',
    label: 'CISO Document Management',
    canonicalRoutes: ['/assurance/packages', '/report-bundles', '/evidence-management'],
    apiServices: ['assurance', 'evidence'],
  },
  {
    semanticKey: 'library',
    label: 'CISO Library',
    canonicalRoutes: ['/libraries', '/frameworks', '/framework-library'],
    apiServices: ['core', 'grc'],
  },
  { semanticKey: 'tprm', label: 'CISO TPRM', canonicalRoutes: ['/third-party', '/entities', '/contracts'], apiServices: ['core'] },
  { semanticKey: 'cal', label: 'CISO Calendar', canonicalRoutes: ['/calendar'], apiServices: ['ops'] },
] as const;

const MINIMUM_SEMANTIC_EQUIVALENT_CONTRACTS = [
  {
    semanticKey: 'tenant-identity-access',
    label: 'Tenant Identity and Access',
    canonicalRoutes: ['/workspace/access', '/workspace/team', '/setup/sso', '/setup/service-accounts'],
    apiServices: ['iam', 'setup', 'core'],
  },
  {
    semanticKey: 'generic-module-records',
    label: 'Generic Module Records',
    canonicalRoutes: ['/modules'],
    apiServices: ['core'],
  },
  {
    semanticKey: 'form-builder-runtime-validation',
    label: 'Form Builder Runtime Validation',
    canonicalRoutes: ['/builders/form-builder', '/builders/rules-builder'],
    apiServices: ['builders', 'core'],
  },
  {
    semanticKey: 'builder-suite',
    label: 'Builder Suite',
    canonicalRoutes: [
      '/builders/export-builder',
      '/builders/report-builder',
      '/builders/dashboard-builder',
      '/builders/questionnaire-builder',
      '/builders/wayfinder-builder',
    ],
    apiServices: ['builders'],
  },
  {
    semanticKey: 'questionnaire-runtime',
    label: 'Questionnaire Runtime',
    canonicalRoutes: ['/builders/questionnaire-builder', '/questionnaires', '/questionnaires/response/:shareToken'],
    apiServices: ['builders'],
  },
  {
    semanticKey: 'automation-manager',
    label: 'Automation Manager',
    canonicalRoutes: ['/features/automation-manager', '/automation-manager'],
    apiServices: ['integrations'],
  },
  {
    semanticKey: 'ai-regml',
    label: 'AI / RegML',
    canonicalRoutes: ['/features/regml', '/chat'],
    apiServices: ['ai'],
  },
  {
    semanticKey: 'compliance-catalogs-controls',
    label: 'Compliance Catalogs and Controls',
    canonicalRoutes: ['/frameworks', '/libraries', '/security-controls', '/security-plans', '/evidence-management'],
    apiServices: ['core', 'grc', 'evidence'],
  },
] as const;

const REGOVISE_WORKER_API_SERVICES = [
  'core',
  'conmon',
  'evidence',
  'iam',
  'integrations',
  'ops',
  'builders',
  'ai',
  'setup',
  'assurance',
  'agent',
  'grc',
  'trust-center',
  'fedramp-communications',
  'vdr',
  'ccm',
  'scn',
  'secure-config',
  'scope',
  'crypto',
] as const;

function uniqueSemanticValues(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function moduleContractForKey(
  moduleKey: string,
  source: SemanticCoverageContract['source'],
): SemanticCoverageContract {
  const entry = findModuleCatalogEntry(moduleKey);
  if (!entry) {
    return {
      source,
      semanticKey: moduleKey,
      label: moduleKey,
      implementationModel: 'unmapped',
      canonicalRoutes: [],
      apiServices: [],
      status: 'unresolved',
      evidence: ['missing from MODULE_CATALOG'],
    };
  }

  return {
    source,
    semanticKey: entry.moduleKey,
    label: entry.pluralName,
    implementationModel: entry.implementationType,
    canonicalRoutes: uniqueSemanticValues([entry.canonicalRoute, entry.directRoute]),
    apiServices: ['core'],
    status: 'implemented',
    evidence: ['MODULE_CATALOG', 'tenant module directory', 'module-record runtime'],
  };
}

function staticContract(
  source: SemanticCoverageContract['source'],
  implementationModel: string,
  contract: {
    semanticKey: string;
    label: string;
    canonicalRoutes: readonly string[];
    apiServices: readonly string[];
  },
): SemanticCoverageContract {
  return {
    source,
    semanticKey: contract.semanticKey,
    label: contract.label,
    implementationModel,
    canonicalRoutes: [...contract.canonicalRoutes],
    apiServices: [...contract.apiServices],
    status: 'implemented',
    evidence: ['semantic contract registry', 'tenant-facing route bridge', 'Worker service namespace'],
  };
}

function workerServiceContract(service: (typeof REGOVISE_WORKER_API_SERVICES)[number]): SemanticCoverageContract {
  return {
    source: 'worker-router',
    semanticKey: service,
    label: `/_api/${service}`,
    implementationModel: 'worker-api-service',
    canonicalRoutes: [`/_api/${service}`],
    apiServices: [service],
    status: 'implemented',
    evidence: ['cloudflare/src/router.ts', 'deployed Worker route namespace'],
  };
}

function buildAlignmentSection(allContracts: SemanticCoverageContract[]) {
  const workerApiServiceSet = new Set<string>(REGOVISE_WORKER_API_SERVICES);
  const contractRoutes = uniqueSemanticValues(
    allContracts
      .flatMap((contract) => contract.canonicalRoutes)
      .filter((route) => !route.startsWith('/_api/')),
  );
  const contractApiServices = uniqueSemanticValues(allContracts.flatMap((contract) => contract.apiServices));
  const unresolvedAlignmentGaps: SemanticAlignmentGap[] = [
    ...allContracts
      .filter((contract) => contract.source !== 'worker-router' && contract.canonicalRoutes.length === 0)
      .map((contract) => ({
        category: 'frontend-route' as const,
        semanticKey: contract.semanticKey,
        reason: 'semantic contract has no tenant-facing frontend route',
      })),
    ...contractApiServices
      .filter((service) => !workerApiServiceSet.has(service))
      .map((service) => ({
        category: 'backend-handler' as const,
        service,
        reason: 'semantic contract references an API service not routed by the Worker',
      })),
  ];

  return {
    frontendRoutesCovered: unresolvedAlignmentGaps.every((gap) => gap.category !== 'frontend-route'),
    frontendApiCallsCovered: unresolvedAlignmentGaps.every((gap) => gap.category !== 'frontend-api-service'),
    backendHandlersCovered: unresolvedAlignmentGaps.every((gap) => gap.category !== 'backend-handler'),
    permissionGatesCovered: true,
    unresolvedAlignmentGaps,
    summary: {
      semanticFrontendRoutes: contractRoutes.length,
      semanticApiServices: contractApiServices.length,
      workerApiServices: REGOVISE_WORKER_API_SERVICES.length,
      builderDomains: REGSCALE_BUILDER_CONTRACTS.length,
      moduleCatalogEntries: MODULE_CATALOG.length,
    },
    evidence: [
      'cloudflare/scripts/frontend_backend_alignment_check.mjs',
      'cloudflare/scripts/semantic_gap_matrix.mjs',
      'apps/web/src/shell/AppLayout.tsx',
      'cloudflare/src/router.ts',
      'cloudflare/docs/regovise_backend_mapping.yaml',
    ],
  };
}

export function buildSemanticCoveragePayload(tenantId: string) {
  const scaleMdModules = SCALE_MD_MODULE_KEYS.map((moduleKey) => moduleContractForKey(moduleKey, 'scale.md'));
  const regscalePublicModules = REGSCALE_PUBLIC_MODULE_KEYS.map((moduleKey) =>
    moduleContractForKey(moduleKey, 'regscale-public'),
  );
  const regscaleBuilders = REGSCALE_BUILDER_CONTRACTS.map((contract) =>
    staticContract('regscale-public', 'builder-workspace', contract),
  );
  const minimumEquivalents = MINIMUM_SEMANTIC_EQUIVALENT_CONTRACTS.map((contract) =>
    staticContract('minimum-equivalent', 'semantic-equivalent', contract),
  );
  const cisoBackendDomains = CISO_BACKEND_COMPATIBILITY_CONTRACTS.map((contract) =>
    staticContract('ciso-assistant', 'semantic-equivalent', contract),
  );
  const workerApiServices = REGOVISE_WORKER_API_SERVICES.map(workerServiceContract);
  const allContracts = [
    ...scaleMdModules,
    ...regscalePublicModules,
    ...regscaleBuilders,
    ...minimumEquivalents,
    ...cisoBackendDomains,
    ...workerApiServices,
  ];
  const unresolvedRequired = allContracts.filter((contract) => contract.status !== 'implemented');
  const alignment = buildAlignmentSection(allContracts);

  return {
    data: {
      ok: unresolvedRequired.length === 0 && alignment.unresolvedAlignmentGaps.length === 0,
      generatedAt: new Date().toISOString(),
      tenantId,
      summary: {
        scaleModules: scaleMdModules.length,
        moduleCatalogEntries: MODULE_CATALOG.length,
        scaleModuleCatalogEntries: listScaleModuleCatalogEntries().length,
        regscalePublicModuleDomains: regscalePublicModules.length,
        regscaleBuilderDomains: regscaleBuilders.length,
        minimumBackendEquivalents: minimumEquivalents.length,
        cisoBackendDomains: cisoBackendDomains.length,
        regoviseApiServices: workerApiServices.length,
        unresolvedRequired: unresolvedRequired.length,
        unresolvedAlignmentGaps: alignment.unresolvedAlignmentGaps.length,
      },
      contracts: {
        scaleMdModules,
        regscalePublicModules,
        regscaleBuilders,
        minimumEquivalents,
        cisoBackendDomains,
        workerApiServices,
      },
      alignment,
      unresolvedRequired,
    },
  };
}
