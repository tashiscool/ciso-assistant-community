#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '../..');

const SCALE_MD_HEADING_IGNORES = new Set([
  'RegScale Manual Assessments Guide',
  'How to Perform a Manual Assessment in RegScale',
]);

const SCALE_MD_HEADING_TO_MODULE_KEY = new Map([
  ['Assets', 'assets'],
  ['Assessments', 'assessments'],
  ['Assessment Plans', 'assessment-plans'],
  ['Capabilities', 'capabilities'],
  ['Case Management', 'case-management'],
  ['Catalogues', 'catalogues'],
  ['Import Regscale Catalogs', 'import-regscale-catalogs'],
  ['Causal Analysis', 'causal-analysis'],
  ['Changes', 'changes'],
  ['Components', 'components'],
  ['Data Calls', 'data-calls'],
  ['Evidence Locker', 'evidence-locker'],
  ['Exceptions', 'exceptions'],
  ['Incidents', 'incidents'],
  ['Interconnections', 'interconnections'],
  ['Policies', 'policies'],
  ['Programs', 'programs'],
  ['Projects', 'projects'],
  ['Questionnaires', 'questionnaires'],
  ['Requirements', 'requirements'],
  ['Risks', 'risks'],
  ['Security Controls', 'security-controls'],
  ['Security Plans', 'security-plans'],
  ['Supply Chain', 'supply-chain'],
  ['Tasks', 'tasks'],
  ['Threats', 'threats'],
]);

export const OPENREGSCALE_ROUTE_COMPATIBILITY = [
  { sourceRoute: '/', canonicalRoute: '/', group: 'shell', required: true, expectAny: ['Regovise', 'Dashboard', 'Workspace'] },
  { sourceRoute: '/builders', canonicalRoute: '/builders', group: 'builders', required: true, expectAny: ['Builder Launcher', 'Form Builder'] },
  { sourceRoute: '/builders/form-builder', canonicalRoute: '/builders/form-builder', group: 'builders', required: true, expectAny: ['Form Builder'] },
  { sourceRoute: '/builders/form-builder/user-guide', canonicalRoute: '/builders/form-builder', group: 'builders', required: true, expectAny: ['Form Builder'] },
  { sourceRoute: '/builders/form-builder/rules-guide', canonicalRoute: '/builders/rules-builder', group: 'builders', required: true, expectAny: ['Rules Builder', 'Rules'] },
  { sourceRoute: '/builders/rules-builder', canonicalRoute: '/builders/rules-builder', group: 'builders', required: true, expectAny: ['Rules Builder', 'Rules'] },
  { sourceRoute: '/builders/export-builder', canonicalRoute: '/builders/export-builder', group: 'builders', required: true, expectAny: ['Export Builder'] },
  { sourceRoute: '/builders/export-builder/docx-template-guide', canonicalRoute: '/builders/export-builder/docx-template', group: 'builders', required: true, expectAny: ['DOCX', 'Template'] },
  { sourceRoute: '/builders/wayfinder-builder', canonicalRoute: '/builders/wayfinder-builder', group: 'builders', required: true, expectAny: ['Wayfinder'] },
  { sourceRoute: '/builders/report-builder', canonicalRoute: '/builders/report-builder', group: 'builders', required: true, expectAny: ['Report Builder'] },
  { sourceRoute: '/builders/dashboard-builder', canonicalRoute: '/builders/dashboard-builder', group: 'builders', required: true, expectAny: ['Dashboard Builder'] },
  { sourceRoute: '/builders/questionnaire-builder', canonicalRoute: '/builders/questionnaire-builder', group: 'builders', required: true, expectAny: ['Questionnaire Builder', 'Questionnaire'] },
  { sourceRoute: '/builders/questionnaire-builder/overview', canonicalRoute: '/builders/questionnaire-builder/overview', group: 'builders', required: true, expectAny: ['Questionnaire', 'Overview'] },
  { sourceRoute: '/builders/questionnaire-builder/rules-engine', canonicalRoute: '/builders/questionnaire-builder/rules-engine', group: 'builders', required: true, expectAny: ['Rules', 'Questionnaire'] },
  { sourceRoute: '/features', canonicalRoute: '/features', group: 'features', required: true, expectAny: ['Feature Launcher', 'RegML'] },
  { sourceRoute: '/features/regml', canonicalRoute: '/features/regml', group: 'features', required: true, expectAny: ['RegML'] },
  { sourceRoute: '/features/regml/control-ai-features', canonicalRoute: '/features/regml/control-ai-features', group: 'features', required: true, expectAny: ['RegML', 'Control'] },
  { sourceRoute: '/features/regml/author', canonicalRoute: '/features/regml/author', group: 'features', required: true, expectAny: ['RegML', 'Author'] },
  { sourceRoute: '/features/regml/explainer', canonicalRoute: '/features/regml/explainer', group: 'features', required: true, expectAny: ['RegML', 'Explainer'] },
  { sourceRoute: '/features/regml/ssp-ai-features', canonicalRoute: '/features/regml/ssp-ai-features', group: 'features', required: true, expectAny: ['RegML', 'SSP'] },
  { sourceRoute: '/features/regml/ssp-author', canonicalRoute: '/features/regml/ssp-author', group: 'features', required: true, expectAny: ['SSP', 'Author'] },
  { sourceRoute: '/features/regml/auditor', canonicalRoute: '/features/regml/auditor', group: 'features', required: true, expectAny: ['Auditor', 'RegML'] },
  { sourceRoute: '/features/regml/ai-generator', canonicalRoute: '/features/regml/ai-generator', group: 'features', required: true, expectAny: ['AI', 'Generator'] },
  { sourceRoute: '/features/response-automation', canonicalRoute: '/features/response-automation', group: 'features', required: true, expectAny: ['Response', 'Automation'] },
  { sourceRoute: '/features/evidence-mapping', canonicalRoute: '/features/evidence-mapping', group: 'features', required: true, expectAny: ['Evidence', 'Mapping'] },
  { sourceRoute: '/features/ai-policy-builder', canonicalRoute: '/features/ai-policy-builder', group: 'features', required: true, expectAny: ['AI', 'Policy'] },
  { sourceRoute: '/features/automation-manager', canonicalRoute: '/features/automation-manager', group: 'features', required: true, expectAny: ['Automation', 'Connector'] },
  { sourceRoute: '/features/automation-manager*', canonicalRoute: '/features/automation-manager', group: 'features', required: true, expectAny: ['Automation', 'Connector'] },
  { sourceRoute: '/features/utilities', canonicalRoute: '/features/utilities', group: 'features', required: true, expectAny: ['Utilities'] },
  { sourceRoute: '/features/utilities*', canonicalRoute: '/features/utilities', group: 'features', required: true, expectAny: ['Utilities'] },
  { sourceRoute: '/features/subsystems', canonicalRoute: '/features/subsystems', group: 'features', required: true, expectAny: ['Subsystems'] },
  { sourceRoute: '/features/subsystems*', canonicalRoute: '/features/subsystems', group: 'features', required: true, expectAny: ['Subsystems'] },
  { sourceRoute: '/features/workflow', canonicalRoute: '/features/workflow', group: 'features', required: true, expectAny: ['Workflow'] },
  { sourceRoute: '/features/news-feed', canonicalRoute: '/features/news-feed', group: 'features', required: true, expectAny: ['News', 'Feed'] },
  { sourceRoute: '/features/workbench', canonicalRoute: '/features/workbench', group: 'features', required: true, expectAny: ['Workbench'] },
  { sourceRoute: '/features/third-party-risk', canonicalRoute: '/features/third-party-risk', group: 'features', required: true, expectAny: ['Third', 'Vendor', 'Entity'] },
  { sourceRoute: '/features/continuous-monitoring', canonicalRoute: '/features/continuous-monitoring', group: 'features', required: true, expectAny: ['ConMon', 'Continuous'] },
  { sourceRoute: '/features/evidence-management', canonicalRoute: '/features/evidence-management', group: 'features', required: true, expectAny: ['Evidence'] },
  { sourceRoute: '/features/rmf', canonicalRoute: '/features/rmf', group: 'features', required: true, expectAny: ['RMF'] },
  { sourceRoute: '/features/app-management', canonicalRoute: '/features/app-management', group: 'features', required: true, expectAny: ['App', 'Management'] },
  { sourceRoute: '/features/compliance-exports', canonicalRoute: '/features/compliance-exports', group: 'features', required: true, expectAny: ['Compliance', 'Export'] },
  { sourceRoute: '/features/compliance-exports/emass', canonicalRoute: '/features/compliance-exports/emass', group: 'features', required: true, expectAny: ['eMASS', 'Export'] },
  { sourceRoute: '/features/compliance-exports/emass/hardware-software-list', canonicalRoute: '/features/compliance-exports/emass/hardware-software-list', group: 'features', required: true, expectAny: ['eMASS', 'Hardware', 'Software'] },
  { sourceRoute: '/features/compliance-exports/emass/poams', canonicalRoute: '/features/compliance-exports/emass/poams', group: 'features', required: true, expectAny: ['eMASS', 'POA'] },
  { sourceRoute: '/features/compliance-exports/emass/ports-protocols', canonicalRoute: '/features/compliance-exports/emass/ports-protocols', group: 'features', required: true, expectAny: ['eMASS', 'Ports', 'Protocols'] },
  { sourceRoute: '/features/compliance-exports/emass/sap-sar', canonicalRoute: '/features/compliance-exports/emass/sap-sar', group: 'features', required: true, expectAny: ['SAP', 'SAR', 'eMASS'] },
  { sourceRoute: '/features/compliance-exports/emass/slcm', canonicalRoute: '/features/compliance-exports/emass/slcm', group: 'features', required: true, expectAny: ['SLCM', 'eMASS'] },
  { sourceRoute: '/features/compliance-exports/fedramp', canonicalRoute: '/features/compliance-exports/fedramp', group: 'features', required: true, expectAny: ['FedRAMP', 'Export'] },
  { sourceRoute: '/features/compliance-exports/fedramp/cis-crm', canonicalRoute: '/features/compliance-exports/fedramp/cis-crm', group: 'features', required: true, expectAny: ['FedRAMP', 'CIS', 'CRM'] },
  { sourceRoute: '/features/compliance-exports/fedramp/inventory', canonicalRoute: '/features/compliance-exports/fedramp/inventory', group: 'features', required: true, expectAny: ['FedRAMP', 'Inventory'] },
  { sourceRoute: '/features/compliance-exports/fedramp/poams', canonicalRoute: '/features/compliance-exports/fedramp/poams', group: 'features', required: true, expectAny: ['FedRAMP', 'POA'] },
  { sourceRoute: '/features/compliance-exports/fedramp/risk-exposure', canonicalRoute: '/features/compliance-exports/fedramp/risk-exposure', group: 'features', required: true, expectAny: ['FedRAMP', 'Risk'] },
  { sourceRoute: '/features/compliance-exports/fedramp/test-case-procedures', canonicalRoute: '/features/compliance-exports/fedramp/test-case-procedures', group: 'features', required: true, expectAny: ['FedRAMP', 'Test'] },
  { sourceRoute: '/setup', canonicalRoute: '/setup', group: 'setup', required: true, expectAny: ['Setup Launcher', 'General'] },
  { sourceRoute: '/setup/general', canonicalRoute: '/setup/general', group: 'setup', required: true, expectAny: ['General', 'Organization'] },
  { sourceRoute: '/setup/compliance-settings', canonicalRoute: '/setup/compliance-settings', group: 'setup', required: true, expectAny: ['Catalog', 'Framework', 'Compliance'] },
  { sourceRoute: '/setup/file-system', canonicalRoute: '/setup/file-system', group: 'setup', required: true, expectAny: ['Evidence', 'Sources', 'File'] },
  { sourceRoute: '/setup/risk-model', canonicalRoute: '/setup/risk-model', group: 'setup', required: true, expectAny: ['Risk Model', 'Risk'] },
  { sourceRoute: '/setup/tags', canonicalRoute: '/setup/tags', group: 'setup', required: true, expectAny: ['Tags'] },
  { sourceRoute: '/setup/service-accounts', canonicalRoute: '/setup/service-accounts', group: 'setup', required: true, expectAny: ['Service Accounts'] },
  { sourceRoute: '/setup/logs-utilization', canonicalRoute: '/setup/logs-utilization', group: 'setup', required: true, expectAny: ['Logs', 'Utilization'] },
  { sourceRoute: '/setup/security', canonicalRoute: '/setup/security', group: 'setup', required: true, expectAny: ['Security'] },
  { sourceRoute: '/setup/modules-features', canonicalRoute: '/setup/modules-features', group: 'setup', required: true, expectAny: ['Modules', 'Features'] },
  { sourceRoute: '/setup/facilities', canonicalRoute: '/setup/facilities', group: 'setup', required: true, expectAny: ['Domains', 'Folders', 'Facilities'] },
  { sourceRoute: '/setup/cause-codes', canonicalRoute: '/setup/cause-codes', group: 'setup', required: true, expectAny: ['Risk Model', 'Cause'] },
  { sourceRoute: '/setup/security-policies', canonicalRoute: '/setup/security-policies', group: 'setup', required: true, expectAny: ['Policies', 'Security'] },
  { sourceRoute: '/setup/user-management-roles/roles', canonicalRoute: '/setup/user-management-roles/roles', group: 'setup', required: true, expectAny: ['Access', 'Roles'] },
  { sourceRoute: '/setup/user-management-roles/mfa', canonicalRoute: '/setup/user-management-roles/mfa', group: 'setup', required: true, expectAny: ['MFA', 'Multi'] },
  { sourceRoute: '/setup/user-management-roles', canonicalRoute: '/setup/user-management-roles', group: 'setup', required: true, expectAny: ['Team', 'Users', 'Roles'] },
  { sourceRoute: '/setup/sso', canonicalRoute: '/setup/sso', group: 'setup', required: true, expectAny: ['SSO', 'Single Sign'] },
  { sourceRoute: '/setup/theming-branding', canonicalRoute: '/setup/theming-branding', group: 'setup', required: true, expectAny: ['Branding'] },
  { sourceRoute: '/setup/functional-roles', canonicalRoute: '/setup/functional-roles', group: 'setup', required: true, expectAny: ['Access', 'Roles'] },
  { sourceRoute: '/setup/email-settings', canonicalRoute: '/setup/email-settings', group: 'setup', required: true, expectAny: ['Email'] },
  { sourceRoute: '/setup/classification', canonicalRoute: '/setup/classification', group: 'setup', required: true, expectAny: ['Classification'] },
  { sourceRoute: '/modules*', canonicalRoute: '/modules', group: 'reference', required: true, expectAny: ['Tenant Module Directory', 'Module Directory'] },
  { sourceRoute: '/cli*', canonicalRoute: '/program', group: 'reference', required: true, expectAny: ['Program', 'Workspace'] },
  { sourceRoute: '/self-hosting*', canonicalRoute: '/setup', group: 'reference', required: true, expectAny: ['Setup Launcher', 'Setup'] },
  { sourceRoute: '/guides*', canonicalRoute: '/features', group: 'reference', required: true, expectAny: ['Feature Launcher', 'Features'] },
  { sourceRoute: '/404', canonicalRoute: null, group: 'reference', required: false, expectAny: ['Not Found'] },
];

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

async function readIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

function extractRoutePaths(source) {
  const paths = [];
  for (const match of source.matchAll(/<Route\b[^>]*\bpath=(?:\{["']([^"']+)["']\}|["']([^"']+)["'])/g)) {
    paths.push(match[1] || match[2]);
  }
  return uniqueSorted(paths);
}

function extractOpenRegScaleRoutes(source) {
  const paths = [];
  for (const match of source.matchAll(/\bpath=\{\s*["']([^"']+)["']\s*\}/g)) {
    paths.push(match[1]);
  }
  return uniqueSorted(paths);
}

function extractTopLevelObjectBlocks(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return [];
  }
  const assignmentIndex = source.indexOf('=', markerIndex);
  const arrayStart = assignmentIndex === -1 ? -1 : source.indexOf('[', assignmentIndex);
  if (arrayStart === -1) {
    return [];
  }

  const blocks = [];
  let braceDepth = 0;
  let blockStart = -1;

  for (let index = arrayStart + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') {
      if (braceDepth === 0) {
        blockStart = index;
      }
      braceDepth += 1;
    } else if (character === '}') {
      braceDepth -= 1;
      if (braceDepth === 0 && blockStart !== -1) {
        blocks.push(source.slice(blockStart, index + 1));
        blockStart = -1;
      }
    } else if (character === ']' && braceDepth === 0) {
      break;
    }
  }

  return blocks;
}

function readStringProperty(block, property) {
  const match = block.match(new RegExp(`${property}:\\s*'([^']*)'`));
  return match?.[1] ?? null;
}

function extractModuleCatalog(source) {
  return extractTopLevelObjectBlocks(source, 'MODULE_CATALOG').map((block) => ({
    moduleKey: readStringProperty(block, 'moduleKey'),
    moduleName: readStringProperty(block, 'moduleName'),
    pluralName: readStringProperty(block, 'pluralName'),
    implementationType: readStringProperty(block, 'implementationType'),
    canonicalRoute: readStringProperty(block, 'canonicalRoute'),
    directRoute: readStringProperty(block, 'directRoute'),
    primaryAction: readStringProperty(block, 'primaryAction'),
  })).filter((entry) => entry.moduleKey);
}

function extractScaleMdModules(source) {
  const headings = [...source.matchAll(/^#\s+(.+)$/gm)].map((match) => match[1].trim());
  const unmappedHeadings = [];
  const ignoredHeadings = [];
  const headingToModule = [];

  for (const heading of headings) {
    if (SCALE_MD_HEADING_IGNORES.has(heading)) {
      ignoredHeadings.push(heading);
      continue;
    }
    const moduleKey = SCALE_MD_HEADING_TO_MODULE_KEY.get(heading);
    if (!moduleKey) {
      unmappedHeadings.push(heading);
      continue;
    }
    headingToModule.push({ heading, moduleKey });
  }

  return {
    headings,
    ignoredHeadings,
    unmappedHeadings,
    moduleKeys: uniqueSorted(headingToModule.map((entry) => entry.moduleKey)),
    headingToModule,
  };
}

function extractE2eRouteChecks(source) {
  const paths = [];
  for (const match of source.matchAll(/\bpath:\s*'([^']+)'/g)) {
    paths.push(match[1]);
  }
  return uniqueSorted(paths);
}

function extractSharedAliasRoutes(source) {
  const routes = [];
  for (const match of source.matchAll(/route:\s*'([^']+)'/g)) {
    routes.push(match[1]);
  }
  return uniqueSorted(routes);
}

function extractLegacyBridgeModels(source) {
  const match = source.match(/const\s+legacyBridgeModels\s*=\s*\[([\s\S]*?)\]\s+as\s+const/);
  if (!match) {
    return [];
  }
  return uniqueSorted([...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]));
}

async function extractBackendModelClasses(repoRoot) {
  const backendRoot = path.join(repoRoot, 'backend');
  const classes = [];

  async function walk(directory) {
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (entry.name !== 'models.py') {
        continue;
      }
      const source = await readIfExists(entryPath);
      for (const match of source.matchAll(/^class\s+([A-Za-z_][A-Za-z0-9_]*)\(/gm)) {
        classes.push({
          app: path.relative(backendRoot, path.dirname(entryPath)),
          className: match[1],
        });
      }
    }
  }

  await walk(backendRoot);
  return classes;
}

function canonicalExists(route, routeSet) {
  if (!route) {
    return false;
  }
  return routeSet.has(route) || routeSet.has(`${route}/*`) || routeSet.has(`${route}*`);
}

export async function buildSemanticGapMatrix(options = {}) {
  const repoRoot = options.cwd ? path.resolve(options.cwd) : defaultRepoRoot;
  const [
    scaleMd,
    moduleRegistry,
    appLayout,
    moduleTypes,
    openRegScaleApp,
    prodE2e,
    backendModelClasses,
  ] = await Promise.all([
    readIfExists(path.join(repoRoot, 'features/scale.md')),
    readIfExists(path.join(repoRoot, 'cloudflare/src/services/core/moduleRegistry.ts')),
    readIfExists(path.join(repoRoot, 'apps/web/src/shell/AppLayout.tsx')),
    readIfExists(path.join(repoRoot, 'apps/web/src/features/modules/types.ts')),
    readIfExists(path.join(repoRoot, 'openregscale/client/src/App.tsx')),
    readIfExists(path.join(repoRoot, 'cloudflare/scripts/prod_e2e_validation.mjs')),
    extractBackendModelClasses(repoRoot),
  ]);

  const scaleInventory = extractScaleMdModules(scaleMd);
  const moduleCatalog = extractModuleCatalog(moduleRegistry);
  const appRoutes = extractRoutePaths(appLayout);
  const sharedAliasRoutes = extractSharedAliasRoutes(moduleTypes);
  const openRegScaleRoutes = extractOpenRegScaleRoutes(openRegScaleApp);
  const e2eRoutes = extractE2eRouteChecks(prodE2e);
  const legacyBridgeModels = extractLegacyBridgeModels(appLayout);
  const routeSet = new Set([...appRoutes, ...sharedAliasRoutes, ...moduleCatalog.flatMap((entry) => [entry.canonicalRoute, entry.directRoute])]);
  const e2eRouteSet = new Set(e2eRoutes);

  const scaleMappings = scaleInventory.moduleKeys.map((moduleKey) => {
    const catalogEntry = moduleCatalog.find((entry) => entry.moduleKey === moduleKey) ?? null;
    const canonicalRoute = catalogEntry?.canonicalRoute ?? null;
    return {
      source: 'features/scale.md',
      semanticKey: moduleKey,
      canonicalRoute,
      implementationModel: catalogEntry?.implementationType ?? null,
      primaryAction: catalogEntry?.primaryAction ?? null,
      tenantDestinationExists: Boolean(canonicalRoute && canonicalExists(canonicalRoute, routeSet)),
      testCovered: Boolean(canonicalRoute && e2eRouteSet.has(canonicalRoute)),
      unresolved: !catalogEntry || !canonicalRoute || !canonicalExists(canonicalRoute, routeSet),
    };
  });

  const openRouteBySource = new Map(OPENREGSCALE_ROUTE_COMPATIBILITY.map((entry) => [entry.sourceRoute, entry]));
  const openRegScaleMappings = uniqueSorted([
    ...openRegScaleRoutes,
    ...OPENREGSCALE_ROUTE_COMPATIBILITY.map((entry) => entry.sourceRoute),
  ]).map((sourceRoute) => {
    const declared = openRouteBySource.get(sourceRoute);
    const canonicalRoute = declared?.canonicalRoute ?? (canonicalExists(sourceRoute, routeSet) ? sourceRoute : null);
    const required = declared?.required ?? true;
    return {
      source: 'openregscale/client/src/App.tsx',
      sourceRoute,
      canonicalRoute,
      group: declared?.group ?? 'unclassified',
      required,
      tenantDestinationExists: Boolean(canonicalRoute && canonicalExists(canonicalRoute, routeSet)),
      testCovered: Boolean(
        canonicalRoute &&
        (e2eRouteSet.has(canonicalRoute) || e2eRouteSet.has(sourceRoute.replace(/\*$/, '')) || sourceRoute.endsWith('*')),
      ),
      unresolved: required && (!canonicalRoute || !canonicalExists(canonicalRoute, routeSet)),
    };
  });

  const legacyMappings = legacyBridgeModels.map((model) => ({
    source: 'legacyBridgeModels',
    semanticKey: model,
    canonicalRoute: `/${model}`,
    tenantDestinationExists: canonicalExists(`/${model}`, routeSet) || canonicalExists(`/${model}/*`, routeSet),
    testCovered: e2eRouteSet.has(`/${model}`),
  }));

  const unresolvedRequired = [
    ...scaleMappings.filter((entry) => entry.unresolved),
    ...openRegScaleMappings.filter((entry) => entry.unresolved),
  ];

  return {
    generatedAt: new Date().toISOString(),
    repoRoot,
    summary: {
      scaleModules: scaleMappings.length,
      openRegScaleRoutes: openRegScaleMappings.length,
      legacyBridgeModels: legacyMappings.length,
      backendModelClasses: backendModelClasses.length,
      appRoutes: appRoutes.length,
      e2eRoutes: e2eRoutes.length,
      unresolvedRequired: unresolvedRequired.length,
      scaleMdUnmappedHeadings: scaleInventory.unmappedHeadings.length,
    },
    sources: {
      scaleMd: {
        moduleKeys: scaleInventory.moduleKeys,
        ignoredHeadings: scaleInventory.ignoredHeadings,
        unmappedHeadings: scaleInventory.unmappedHeadings,
      },
      appRoutes,
      sharedAliasRoutes,
      openRegScaleRoutes,
      e2eRoutes,
      legacyBridgeModels,
      backendModelClasses,
    },
    mappings: {
      scaleMd: scaleMappings,
      openRegScale: openRegScaleMappings,
      legacy: legacyMappings,
    },
    unresolvedRequired,
  };
}

async function main() {
  const outputIndex = process.argv.indexOf('--output');
  const outputPath = outputIndex !== -1 ? process.argv[outputIndex + 1] : null;
  const jsonOnly = process.argv.includes('--json');
  const matrix = await buildSemanticGapMatrix();

  if (outputPath) {
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(path.resolve(outputPath), JSON.stringify(matrix, null, 2));
  }

  if (jsonOnly || outputPath) {
    console.log(JSON.stringify(matrix, null, 2));
  } else {
    console.log(JSON.stringify({
      ok: matrix.unresolvedRequired.length === 0,
      summary: matrix.summary,
      unresolvedRequired: matrix.unresolvedRequired,
    }, null, 2));
  }

  if (matrix.summary.scaleMdUnmappedHeadings > 0 || matrix.unresolvedRequired.length > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
