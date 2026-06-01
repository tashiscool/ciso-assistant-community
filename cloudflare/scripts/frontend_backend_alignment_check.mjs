#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSemanticGapMatrix } from './semantic_gap_matrix.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, '../..');

const WORKER_HANDLER_BY_SERVICE = {
  agent: 'cloudflare/src/services/agent/http.ts',
  ai: 'cloudflare/src/services/ai/http.ts',
  assurance: 'cloudflare/src/services/assurance/http.ts',
  builders: 'cloudflare/src/services/builders/http.ts',
  ccm: 'cloudflare/src/services/fedramp/http.ts',
  conmon: 'cloudflare/src/services/conmon/http.ts',
  core: 'cloudflare/src/services/core/http.ts',
  crypto: 'cloudflare/src/services/fedramp/http.ts',
  evidence: 'cloudflare/src/services/evidence/http.ts',
  'fedramp-communications': 'cloudflare/src/services/fedramp/http.ts',
  grc: 'cloudflare/src/services/grc-engine/http.ts',
  iam: 'cloudflare/src/services/iam/http.ts',
  integrations: 'cloudflare/src/services/integrations/http.ts',
  ops: 'cloudflare/src/services/ops/http.ts',
  scn: 'cloudflare/src/services/fedramp/http.ts',
  scope: 'cloudflare/src/services/fedramp/http.ts',
  'secure-config': 'cloudflare/src/services/fedramp/http.ts',
  setup: 'cloudflare/src/services/setup/http.ts',
  'trust-center': 'cloudflare/src/services/fedramp/http.ts',
  vdr: 'cloudflare/src/services/fedramp/http.ts',
};

const PUBLIC_FRONTEND_ROUTE_PREFIXES = [
  '/login',
  '/auth/callback',
  '/setup/initialize',
  '/admin/recover',
  '/questionnaires/response',
];

const AUTHENTICATED_BASELINE_ROUTE_PREFIXES = [
  '/my-profile',
  '/workspace/me',
];

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function dedupeObjects(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

async function listSourceFiles(root, predicate) {
  const files = [];

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
        if (['node_modules', 'dist', '.vite'].includes(entry.name)) {
          continue;
        }
        await walk(entryPath);
        continue;
      }
      if (predicate(entryPath)) {
        files.push(entryPath);
      }
    }
  }

  await walk(root);
  return files;
}

function normalizeApiPath(rawPath) {
  if (!rawPath || !rawPath.startsWith('/')) {
    return null;
  }
  const staticPath = rawPath.split('${', 1)[0].split('?', 1)[0];
  const withoutApi = staticPath.startsWith('/_api/') ? staticPath.slice('/_api'.length) : staticPath;
  const collapsed = withoutApi.replace(/\/+/g, '/').replace(/\/$/, '');
  return collapsed || '/';
}

function parseApiCall(rawPath, method, filePath) {
  const normalizedPath = normalizeApiPath(rawPath);
  if (!normalizedPath) {
    return null;
  }
  const segments = normalizedPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  return {
    method,
    rawPath,
    normalizedPath,
    service: segments[0],
    resource: segments[1] ?? null,
    file: filePath,
  };
}

function extractFrontendApiCallsFromSource(source, filePath) {
  const calls = [];
  const clientCallPattern = /\b[A-Za-z_$][\w$]*\.(get|post|put|patch|delete)(?:<[^>]*>)?\s*\(\s*([`'"])([\s\S]*?)\2/g;
  for (const match of source.matchAll(clientCallPattern)) {
    const call = parseApiCall(match[3], match[1].toUpperCase(), filePath);
    if (call) {
      calls.push(call);
    }
  }

  const fetchPattern = /\bfetch\s*\(\s*([`'"])([\s\S]*?)\1/g;
  for (const match of source.matchAll(fetchPattern)) {
    const call = parseApiCall(match[2], 'FETCH', filePath);
    if (call) {
      calls.push(call);
    }
  }
  return calls;
}

function extractRoutePaths(source) {
  const routes = [];
  for (const match of source.matchAll(/<Route\b[^>]*\bpath=(?:\{["']([^"']+)["']\}|["']([^"']+)["'])/g)) {
    routes.push(match[1] || match[2]);
  }
  return uniqueSorted(routes);
}

function extractRouteGateSource(source, route) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<Route\\b[^>]*path=["']${escapedRoute}["'][^>]*>`);
  const directMatch = source.match(pattern);
  if (directMatch) {
    return directMatch[0];
  }
  const routeIndex = source.indexOf(`path="${route}"`);
  if (routeIndex === -1) {
    return '';
  }
  return source.slice(routeIndex, Math.min(source.length, routeIndex + 1200));
}

function extractWorkerServices(routerSource) {
  return uniqueSorted([...routerSource.matchAll(/case\s+'([^']+)':/g)].map((match) => match[1]));
}

function extractHandlerResources(source) {
  return new Set([
    ...[...source.matchAll(/resource\s*={2,3}\s*'([^']+)'/g)].map((match) => match[1]),
    ...[...source.matchAll(/\bcase\s+'([^']+)':/g)].map((match) => match[1]),
  ]);
}

function sourceMentionsResource(source, resource) {
  if (!resource) {
    return true;
  }
  const escaped = resource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`]${escaped}['"\`]`).test(source);
}

function extractApiServices(source) {
  const servicesBlock = source.match(/^api_services:\n([\s\S]*?)(?=^[A-Za-z0-9_]+:|(?![\s\S]))/m)?.[1] ?? '';
  const services = [];
  for (const serviceMatch of servicesBlock.matchAll(/^  ([A-Za-z0-9_-]+):\n([\s\S]*?)(?=^  [A-Za-z0-9_-]+:|$(?![\s\S]))/gm)) {
    const service = serviceMatch[1];
    const block = serviceMatch[2];
    const directBasePath = block.match(/^\s{4}base_path:\s+"\/_api\/([^"]+)"/m)?.[1];
    if (directBasePath) {
      services.push(service);
    }
    for (const nestedMatch of block.matchAll(/^\s+base_path:\s+"\/_api\/([^"]+)"/gm)) {
      services.push(nestedMatch[1]);
    }
  }
  return uniqueSorted(services);
}

function extractApiServiceRouteFamilies(source) {
  const result = new Map();
  const servicesBlock = source.match(/^api_services:\n([\s\S]*?)(?=^[A-Za-z0-9_]+:|(?![\s\S]))/m)?.[1] ?? '';
  for (const serviceMatch of servicesBlock.matchAll(/^  ([A-Za-z0-9_-]+):\n([\s\S]*?)(?=^  [A-Za-z0-9_-]+:|$(?![\s\S]))/gm)) {
    const service = serviceMatch[1];
    const block = serviceMatch[2];
    const routes = [...block.matchAll(/^\s{6}[A-Za-z0-9_-]+:\s+"([^"]+)"/gm)]
      .flatMap((match) => match[1].split(','))
      .map((route) => route.trim())
      .filter(Boolean);
    const directBasePath = block.match(/^\s{4}base_path:\s+"\/_api\/([^"]+)"/m)?.[1];
    if (directBasePath) {
      result.set(service, routes);
    }

    for (const nestedMatch of block.matchAll(/^\s{6}([A-Za-z0-9_-]+):\n([\s\S]*?)(?=^\s{6}[A-Za-z0-9_-]+:|^\s{4}[A-Za-z0-9_-]+:|$(?![\s\S]))/gm)) {
      const nestedBlock = nestedMatch[2];
      const nestedBasePath = nestedBlock.match(/^\s{8}base_path:\s+"\/_api\/([^"]+)"/m)?.[1];
      if (!nestedBasePath) {
        continue;
      }
      const nestedRoutes = [...nestedBlock.matchAll(/^\s{10}-\s+"([^"]+)"/gm)]
        .flatMap((match) => match[1].split(','))
        .map((route) => route.trim())
        .filter(Boolean);
      result.set(nestedBasePath, nestedRoutes);
    }
  }
  return result;
}

function extractModuleCatalog(source) {
  return [...source.matchAll(/moduleKey:\s*'([^']+)'[\s\S]*?canonicalRoute:\s*'([^']+)'[\s\S]*?directRoute:\s*'([^']+)'/g)]
    .map((match) => ({
      moduleKey: match[1],
      canonicalRoute: match[2],
      directRoute: match[3],
    }));
}

function routePatternMatches(route, pattern) {
  if (!route || !pattern) {
    return false;
  }
  if (route === pattern) {
    return true;
  }
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return route === prefix || route.startsWith(`${prefix}/`);
  }
  if (!pattern.includes(':') && !pattern.includes('*')) {
    return false;
  }

  const routeSegments = route.split('/').filter(Boolean);
  const patternSegments = pattern.split('/').filter(Boolean);
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const routeSegment = routeSegments[index];
    if (patternSegment === '*') {
      return true;
    }
    if (!routeSegment) {
      return false;
    }
    if (patternSegment.startsWith(':')) {
      continue;
    }
    if (patternSegment !== routeSegment) {
      return false;
    }
  }
  return routeSegments.length === patternSegments.length;
}

function routeExists(route, routeSet) {
  if (!route) {
    return false;
  }
  if (routeSet.has(route) || routeSet.has(`${route}/*`) || routeSet.has(`${route}*`)) {
    return true;
  }
  return [...routeSet].some((pattern) => routePatternMatches(route, pattern));
}

function apiCallHasYamlFamily(call, routeFamilies) {
  const families = routeFamilies.get(call.service) ?? [];
  if (families.length === 0 || !call.resource) {
    return true;
  }
  return families.some((family) => {
    const normalizedFamily = family.split(' ', 1)[0].replace(/\/:[^/]+/g, '');
    return normalizedFamily === `/${call.resource}` || normalizedFamily.startsWith(`/${call.resource}/`);
  });
}

export async function buildFrontendBackendAlignment(options = {}) {
  const repoRoot = options.cwd ? path.resolve(options.cwd) : defaultRepoRoot;
  const appSrcRoot = path.join(repoRoot, 'apps/web/src');
  const [
    routerSource,
    appLayoutSource,
    shellAccessSource,
    moduleRegistrySource,
    regoviseBackendMapping,
    prodE2eSource,
    semanticMatrix,
  ] = await Promise.all([
    readIfExists(path.join(repoRoot, 'cloudflare/src/router.ts')),
    readIfExists(path.join(repoRoot, 'apps/web/src/shell/AppLayout.tsx')),
    readIfExists(path.join(repoRoot, 'apps/web/src/shell/shellAccess.ts')),
    readIfExists(path.join(repoRoot, 'cloudflare/src/services/core/moduleRegistry.ts')),
    readIfExists(path.join(repoRoot, 'cloudflare/docs/regovise_backend_mapping.yaml')),
    readIfExists(path.join(repoRoot, 'cloudflare/scripts/prod_e2e_validation.mjs')),
    buildSemanticGapMatrix({ cwd: repoRoot }),
  ]);

  const frontendFiles = await listSourceFiles(appSrcRoot, (filePath) => /\.(tsx?|jsx?)$/.test(filePath));
  const frontendApiCalls = [];
  for (const filePath of frontendFiles) {
    const source = await readIfExists(filePath);
    frontendApiCalls.push(...extractFrontendApiCallsFromSource(source, path.relative(repoRoot, filePath)));
  }

  const workerServices = extractWorkerServices(routerSource);
  const workerServiceSet = new Set(workerServices);
  const regoviseApiServices = extractApiServices(regoviseBackendMapping);
  const regoviseApiServiceSet = new Set(regoviseApiServices);
  const routeFamilies = extractApiServiceRouteFamilies(regoviseBackendMapping);
  const handlerSourceByService = new Map();
  const handlerResourcesByService = new Map();
  for (const service of workerServices) {
    const handlerPath = WORKER_HANDLER_BY_SERVICE[service];
    const source = handlerPath ? await readIfExists(path.join(repoRoot, handlerPath)) : '';
    handlerSourceByService.set(service, source);
    handlerResourcesByService.set(service, extractHandlerResources(source));
  }

  const frontendApiCoverage = frontendApiCalls.map((call) => {
    const handlerSource = handlerSourceByService.get(call.service) ?? '';
    const resources = handlerResourcesByService.get(call.service) ?? new Set();
    const serviceExists = workerServiceSet.has(call.service);
    const backendMappingExists = regoviseApiServiceSet.has(call.service);
    const resourceExists = !call.resource || resources.has(call.resource) || sourceMentionsResource(handlerSource, call.resource);
    const yamlRouteFamilyExists = apiCallHasYamlFamily(call, routeFamilies);
    return {
      ...call,
      serviceExists,
      backendMappingExists,
      resourceExists,
      yamlRouteFamilyExists,
      covered: serviceExists && backendMappingExists && resourceExists && yamlRouteFamilyExists,
      unresolved:
        !serviceExists ||
        !backendMappingExists ||
        !resourceExists ||
        !yamlRouteFamilyExists,
    };
  });

  const appRoutes = extractRoutePaths(appLayoutSource);
  const appRouteSet = new Set(appRoutes);
  const e2eRoutes = uniqueSorted([...prodE2eSource.matchAll(/\bpath:\s*'([^']+)'/g)].map((match) => match[1]));
  const e2eRouteSet = new Set(e2eRoutes);
  const moduleCatalog = extractModuleCatalog(moduleRegistrySource);
  const moduleRouteCoverage = moduleCatalog.map((entry) => ({
    moduleKey: entry.moduleKey,
    canonicalRoute: entry.canonicalRoute,
    directRoute: entry.directRoute,
    canonicalRouteExists: routeExists(entry.canonicalRoute, appRouteSet),
    directRouteExists: routeExists(entry.directRoute, appRouteSet),
    e2eCovered: e2eRouteSet.has(entry.canonicalRoute) || e2eRouteSet.has(entry.directRoute),
    unresolved: !routeExists(entry.canonicalRoute, appRouteSet) && !routeExists(entry.directRoute, appRouteSet),
  }));

  const semanticRoutes = uniqueSorted([
    ...semanticMatrix.mappings.regscalePublicInferred.builderDomains.flatMap((entry) => entry.canonicalRoutes ?? []),
    ...semanticMatrix.mappings.regscalePublicInferred.minimumEquivalents.flatMap((entry) => entry.canonicalRoutes ?? []),
    ...semanticMatrix.mappings.cisoAssistantBackend.flatMap((entry) => entry.canonicalRoutes ?? []),
  ]);
  const semanticRouteCoverage = semanticRoutes.map((route) => ({
    route,
    exists: routeExists(route, appRouteSet) || routeExists(route, new Set(moduleCatalog.flatMap((entry) => [entry.canonicalRoute, entry.directRoute]))),
    e2eCovered: e2eRouteSet.has(route),
  }));

  const permissionGateCoverage = appRoutes.map((route) => {
    const source = extractRouteGateSource(appLayoutSource, route);
    const publicRoute = PUBLIC_FRONTEND_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
    const authenticatedRoute = AUTHENTICATED_BASELINE_ROUTE_PREFIXES.some(
      (prefix) => route === prefix || route.startsWith(`${prefix}/`),
    );
    const bridgeRoute =
      (source.includes('ComplianceNavigatorRouteBridgePage') || source.includes('LegacyRouteBridgePage')) &&
      source.includes('access={access}');
    const gated =
      source.includes('adminOnly(') ||
      source.includes('allowedOnly(') ||
      bridgeRoute ||
      publicRoute ||
      authenticatedRoute ||
      route === '*' ||
      route === '/';
    return {
      route,
      publicRoute,
      authenticatedRoute,
      bridgeRoute,
      gated,
      unresolved: !gated,
    };
  });

  const internalOnlyMatches = [
    ...appLayoutSource.matchAll(/\binternalOnly\b/g),
    ...shellAccessSource.matchAll(/\binternalOnly\b/g),
  ];

  const backendMappingCoverage = regoviseApiServices.map((service) => ({
    service,
    routerServiceExists: workerServiceSet.has(service),
    unresolved: !workerServiceSet.has(service),
  }));

  const unresolvedAlignmentGaps = dedupeObjects([
    ...frontendApiCoverage
      .filter((entry) => entry.unresolved)
      .map((entry) => ({
        category: 'frontend-api-call',
        service: entry.service,
        resource: entry.resource,
        path: entry.normalizedPath,
        file: entry.file,
        reason: [
          entry.serviceExists ? null : 'missing Worker service',
          entry.backendMappingExists ? null : 'missing backend mapping service',
          entry.resourceExists ? null : 'missing handler resource',
          entry.yamlRouteFamilyExists ? null : 'missing backend route family',
        ].filter(Boolean).join(', '),
      })),
    ...moduleRouteCoverage
      .filter((entry) => entry.unresolved)
      .map((entry) => ({
        category: 'module-route',
        moduleKey: entry.moduleKey,
        route: entry.canonicalRoute,
        reason: 'module catalog route is not tenant-visible in AppLayout',
      })),
    ...semanticRouteCoverage
      .filter((entry) => !entry.exists)
      .map((entry) => ({
        category: 'semantic-route',
        route: entry.route,
        reason: 'semantic contract route is not tenant-visible',
      })),
    ...permissionGateCoverage
      .filter((entry) => entry.unresolved)
      .map((entry) => ({
        category: 'permission-gate',
        route: entry.route,
        reason: 'route is neither public nor wrapped in an explicit access gate',
      })),
    ...backendMappingCoverage
      .filter((entry) => entry.unresolved)
      .map((entry) => ({
        category: 'backend-mapping',
        service: entry.service,
        reason: 'backend mapping service is not routed by Worker',
      })),
    ...internalOnlyMatches.map(() => ({
      category: 'internal-only',
      reason: 'internalOnly gate remains in tenant route/access code',
    })),
    ...semanticMatrix.unresolvedRequired.map((entry) => ({
      category: 'semantic-matrix',
      semanticKey: entry.semanticKey ?? entry.sourceRoute ?? entry.sourceKey,
      reason: 'semantic gap matrix reports unresolved required mapping',
    })),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    repoRoot,
    ok: unresolvedAlignmentGaps.length === 0,
    summary: {
      frontendApiCalls: frontendApiCoverage.length,
      uniqueFrontendApiPaths: uniqueSorted(frontendApiCoverage.map((entry) => entry.normalizedPath)).length,
      frontendRoutes: appRoutes.length,
      frontendRoutesWithExplicitAccess: permissionGateCoverage.filter((entry) => entry.gated).length,
      workerApiServices: workerServices.length,
      backendMappingServices: regoviseApiServices.length,
      moduleCatalogRoutes: moduleRouteCoverage.length,
      semanticContractRoutes: semanticRouteCoverage.length,
      e2eRoutes: e2eRoutes.length,
      semanticMatrixUnresolved: semanticMatrix.unresolvedRequired.length,
      unresolvedAlignmentGaps: unresolvedAlignmentGaps.length,
    },
    coverage: {
      frontendApiCalls: frontendApiCoverage,
      frontendRoutes: permissionGateCoverage,
      backendMappingServices: backendMappingCoverage,
      moduleRoutes: moduleRouteCoverage,
      semanticRoutes: semanticRouteCoverage,
    },
    alignment: {
      frontendRoutesCovered: permissionGateCoverage.every((entry) => !entry.unresolved),
      frontendApiCallsCovered: frontendApiCoverage.every((entry) => !entry.unresolved),
      backendHandlersCovered: backendMappingCoverage.every((entry) => !entry.unresolved),
      permissionGatesCovered: permissionGateCoverage.every((entry) => !entry.unresolved),
      unresolvedAlignmentGaps,
    },
  };
}

async function main() {
  const outputIndex = process.argv.indexOf('--output');
  const outputPath = outputIndex !== -1 ? process.argv[outputIndex + 1] : null;
  const jsonOnly = process.argv.includes('--json');
  const alignment = await buildFrontendBackendAlignment();

  if (outputPath) {
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(path.resolve(outputPath), JSON.stringify(alignment, null, 2));
  }

  if (jsonOnly || outputPath) {
    console.log(JSON.stringify(alignment, null, 2));
  } else {
    console.log(JSON.stringify({
      ok: alignment.ok,
      summary: alignment.summary,
      unresolvedAlignmentGaps: alignment.alignment.unresolvedAlignmentGaps,
    }, null, 2));
  }

  if (!alignment.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
