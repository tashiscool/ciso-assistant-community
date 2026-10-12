import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const iaPath = path.join(appRoot, 'src/shell/iaNavigation.ts');
const appLayoutPath = path.join(appRoot, 'src/shell/AppLayout.tsx');
const sidebarPath = path.join(appRoot, 'src/shell/Sidebar.tsx');
const shellAccessPath = path.join(appRoot, 'src/shell/shellAccess.ts');
const moduleTypesPath = path.join(appRoot, 'src/features/modules/types.ts');
const legacyBridgePath = path.join(appRoot, 'src/features/parity/LegacyRouteBridgePage.tsx');

const iaSource = fs.readFileSync(iaPath, 'utf8');
const appLayoutSource = fs.readFileSync(appLayoutPath, 'utf8');
const sidebarSource = fs.readFileSync(sidebarPath, 'utf8');
const shellAccessSource = fs.readFileSync(shellAccessPath, 'utf8');
const moduleTypesSource = fs.readFileSync(moduleTypesPath, 'utf8');
const legacyBridgeSource = fs.readFileSync(legacyBridgePath, 'utf8');

const expectedGroups = [
  'Home',
  'Starter Guide',
  'Work Queue',
  'Compliance',
  'Risk',
  'Evidence and Assurance',
  'Vendors and Trust',
  'Assets and Systems',
  'People and Access',
  'Privacy and Resilience',
  'Reports and Exports',
  'Automation and Builders',
  'Admin',
];

const allowedPreservationStates = [
  'primary-nav',
  'secondary-nav',
  'local-tab',
  'contextual-action',
  'search-alias',
  'legacy-route',
  'admin-only',
  'internal-only',
];

const allowedAudiences = ['standard', 'admin', 'internal'];

function unique(values) {
  return [...new Set(values)];
}

function extractArrayObjectBlocks(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) {
    return [];
  }

  const equals = source.indexOf('=', start);
  const open = source.indexOf('[', equals === -1 ? start : equals);
  if (open === -1) {
    return [];
  }

  let depth = 0;
  let close = -1;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (character === '[') {
      depth += 1;
    } else if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        close = index;
        break;
      }
    }
  }

  if (close === -1) {
    return [];
  }

  return [...source.slice(open + 1, close).matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]);
}

function extractStringsBetween(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) {
    return [];
  }

  const open = source.indexOf('[', start);
  const close = source.indexOf(']', open);
  if (open === -1 || close === -1) {
    return [];
  }

  return unique([...source.slice(open, close).matchAll(/['"`](\/[^'"`]+)['"`]/g)].map((match) => match[1]));
}

function extractQuotedValuesBetween(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) {
    return [];
  }

  const open = source.indexOf('[', start);
  const close = source.indexOf(']', open);
  if (open === -1 || close === -1) {
    return [];
  }

  return unique([...source.slice(open, close).matchAll(/['"`]([^'"`]+)['"`]/g)].map((match) => match[1]));
}

const navRoutes = unique([...iaSource.matchAll(/to:\s*['"`](\/[^'"`]+)['"`]/g)].map((match) => match[1]));
const navItemBlocks = [...iaSource.matchAll(/item\(\{([\s\S]*?)\}\)/g)].map((match) => match[1]);
const routeFamilyBlocks = extractArrayObjectBlocks(iaSource, 'IA_ROUTE_FAMILIES');
const routeFamilies = routeFamilyBlocks.map((block) => ({
  pattern: block.match(/pattern:\s*['"`]([^'"`]+)['"`]/)?.[1],
  group: block.match(/group:\s*['"`]([^'"`]+)['"`]/)?.[1],
  state: block.match(/state:\s*['"`]([^'"`]+)['"`]/)?.[1],
  audience: block.match(/audience:\s*['"`]([^'"`]+)['"`]/)?.[1],
}));
const appRoutes = unique([...appLayoutSource.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((match) => match[1]));
const legacyBridgeModels = unique(
  extractQuotedValuesBetween(appLayoutSource, 'const legacyBridgeModels').map((model) => `/${model}/*`),
);
const legacyRouteConfigModels = unique(
  [
    ...legacyBridgeSource.matchAll(
      /(?:^|\n)\s*(?:['"`]([^'"`]+)['"`]|([A-Za-z0-9_-]+))\s*:\s*\{\s*resolvePath:/g,
    ),
  ].map((match) => `/${match[1] ?? match[2]}/*`),
);
const explicitResolverBridgePatterns = new Set(['/logs']);
const wildcardPrefixes = appRoutes
  .filter((route) => route.endsWith('/*'))
  .map((route) => route.slice(0, -1));
const aliasRoutes = unique([...moduleTypesSource.matchAll(/\{\s*moduleKey:\s*['"`][^'"`]+['"`],\s*route:\s*['"`](\/[^'"`]+)['"`]\s*\}/g)].map((match) => match[1]));
const taskAliasRouteIsDeclared = aliasRoutes.includes('/tasks');
const sharedAliasMapExcludesTasks =
  /SHARED_MODULE_ALIAS_ROUTES\s*\.filter\(\s*\(?\s*entry\s*\)?\s*=>\s*entry\.route\s*!==\s*['"`]\/tasks['"`]\s*\)\s*\.map/.test(
    appLayoutSource,
  );
const taskWorkQueueRouteIsExplicit =
  /<Route\s+path=["']\/tasks["'][\s\S]*?<TaskOperationsControlPage\s+mode=["']work-queue["']/.test(appLayoutSource);
const integrationsRouteIsExplicit =
  /<Route\s+path=["']\/integrations["'][\s\S]*?<AutomationManagerPage\s*\/>/.test(appLayoutSource);
const expectedActiveAliases = [
  ['/features/compliance-exports', '/compliance-exports'],
  ['/features/news-feed', '/news-feed'],
  ['/features/subsystems', '/subsystems'],
  ['/features/utilities', '/utilities'],
  ['/features/workbench', '/workbench'],
  ['/features/workflow', '/workflow'],
  ['/users', '/workspace/team'],
  ['/setup/user-management-roles', '/workspace/team'],
  ['/setup/user-management-roles/roles', '/workspace/access'],
  ['/setup/user-management-roles/mfa', '/setup/mfa'],
];
const expectedActivePrefixAliases = [
  ['/features/compliance-exports/', '/compliance-exports/'],
  ['/features/news-feed/', '/news-feed/'],
  ['/features/subsystems/', '/subsystems/'],
  ['/features/utilities/', '/utilities/'],
  ['/features/workbench/', '/workbench/'],
  ['/features/workflow/', '/workflow/'],
];
const adminExact = extractStringsBetween(shellAccessSource, 'ADMIN_ROUTE_EXACT');
const adminPrefixes = extractStringsBetween(shellAccessSource, 'ADMIN_ROUTE_PREFIXES');
const internalExact = extractStringsBetween(shellAccessSource, 'INTERNAL_ROUTE_EXACT');
const internalPrefixes = extractStringsBetween(shellAccessSource, 'INTERNAL_ROUTE_PREFIXES');
const standardAccessSectionStart = shellAccessSource.indexOf('function canAccessStandardRoute');
const standardAccessSectionEnd = shellAccessSource.indexOf('export function canAccessShellRoute');
const standardAccessSection =
  standardAccessSectionStart === -1 || standardAccessSectionEnd === -1
    ? ''
    : shellAccessSource.slice(standardAccessSectionStart, standardAccessSectionEnd);
const standardAccessPrefixes = unique(
  [...standardAccessSection.matchAll(/['"`](\/[^'"`]+)['"`]/g)].map((match) => match[1]),
);
const alwaysReachableStandardRoutes = new Set(['/', '/workspace/me']);
const explicitReferenceStandardPrefixes = ['/vanta-clone'];

function routeMatchesPattern(route, pattern) {
  if (pattern === route) {
    return true;
  }

  if (!pattern.includes(':')) {
    return false;
  }

  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = `^${escaped.replace(/:([^/]+)/g, '[^/]+')}$`;
  return new RegExp(expression).test(route);
}

function appCovers(route) {
  return (
    appRoutes.includes(route) ||
    aliasRoutes.includes(route) ||
    appRoutes.some((pattern) => routeMatchesPattern(route, pattern)) ||
    wildcardPrefixes.some((prefix) => route.startsWith(prefix))
  );
}

function adminCovers(route) {
  return adminExact.includes(route) || adminPrefixes.some((prefix) => route === prefix || route.startsWith(prefix));
}

function internalCovers(route) {
  return internalExact.includes(route) || internalPrefixes.some((prefix) => route === prefix || route.startsWith(prefix));
}

function standardAccessCovers(route) {
  return standardAccessPrefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

function referenceRouteCovers(route) {
  return explicitReferenceStandardPrefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

function legacyBridgeFamilyCovers(route) {
  const [model] = route.replace(/^\//, '').split('/');
  return legacyBridgeModels.includes(`/${model}/*`);
}

function resolverBridgeCovers(route) {
  return explicitResolverBridgePatterns.has(route);
}

function sampleRouteFromPattern(pattern) {
  return pattern.replace(/\/\*$/, '/__sample__').replace(/:([^/]+)/g, '__sample__');
}

const failures = [];

for (const group of expectedGroups) {
  if (!iaSource.includes(`label: '${group}'`)) {
    failures.push(`Missing canonical IA group: ${group}`);
  }
}

const uncoveredRoutes = navRoutes.filter((route) => !appCovers(route));
if (uncoveredRoutes.length > 0) {
  failures.push(`Promoted nav routes are not covered by AppLayout: ${uncoveredRoutes.join(', ')}`);
}

if (!taskWorkQueueRouteIsExplicit) {
  failures.push('The /tasks route must render TaskOperationsControlPage in work-queue mode.');
}

if (!integrationsRouteIsExplicit) {
  failures.push('The /integrations route must render AutomationManagerPage as the canonical integrations landing.');
}

if (taskAliasRouteIsDeclared && !sharedAliasMapExcludesTasks) {
  failures.push('The /tasks module alias must be excluded from the shared alias map so Work Queue owns /tasks; use /modules/tasks for the legacy module surface.');
}

const missingLegacyBridgeConfigs = legacyBridgeModels.filter((pattern) => !legacyRouteConfigModels.includes(pattern));
if (missingLegacyBridgeConfigs.length > 0) {
  failures.push(
    `Legacy bridge routes are mounted but do not have explicit redirect configs: ${missingLegacyBridgeConfigs.join(', ')}`,
  );
}

const mappedRouteFamilyPatterns = new Set(routeFamilies.map((family) => family.pattern).filter(Boolean));
const missingLegacyRouteFamilies = legacyBridgeModels.filter((pattern) => !mappedRouteFamilyPatterns.has(pattern));
if (missingLegacyRouteFamilies.length > 0) {
  failures.push(
    `Legacy bridge routes are missing IA preservation metadata: ${missingLegacyRouteFamilies.join(', ')}`,
  );
}

const missingActiveAliases = expectedActiveAliases.filter(([alias, canonical]) => {
  const exactAliasPattern = new RegExp(`['"\`]${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]\\s*:\\s*['"\`]${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
  return !exactAliasPattern.test(sidebarSource);
});
if (missingActiveAliases.length > 0) {
  failures.push(
    `Legacy/contextual routes are missing sidebar active-state aliases: ${missingActiveAliases
      .map(([alias, canonical]) => `${alias} -> ${canonical}`)
      .join(', ')}`,
  );
}

const missingActivePrefixAliases = expectedActivePrefixAliases.filter(([alias, canonical]) => {
  const prefixAliasPattern = new RegExp(
    `\\[\\s*['"\`]${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]\\s*,\\s*['"\`]${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]\\s*\\]`,
  );
  return !prefixAliasPattern.test(sidebarSource);
});
if (missingActivePrefixAliases.length > 0) {
  failures.push(
    `Legacy/contextual route prefixes are missing sidebar active-state aliases: ${missingActivePrefixAliases
      .map(([alias, canonical]) => `${alias} -> ${canonical}`)
      .join(', ')}`,
  );
}

const adminNavRoutes = unique(
  navItemBlocks.flatMap((block) => {
    const route = block.match(/to:\s*['"`](\/[^'"`]+)['"`]/)?.[1];
    const audience = block.match(/audience:\s*['"`]([^'"`]+)['"`]/)?.[1];
    return route && audience === 'admin' ? [route] : [];
  }),
);
const unguardedAdminRoutes = adminNavRoutes.filter((route) => !adminCovers(route));
if (unguardedAdminRoutes.length > 0) {
  failures.push(`Admin nav routes are not covered by shellAccess admin gates: ${unguardedAdminRoutes.join(', ')}`);
}

const internalNavRoutes = unique(
  navItemBlocks.flatMap((block) => {
    const route = block.match(/to:\s*['"`](\/[^'"`]+)['"`]/)?.[1];
    const audience = block.match(/audience:\s*['"`]([^'"`]+)['"`]/)?.[1];
    return route && audience === 'internal' ? [route] : [];
  }),
);
const unguardedInternalRoutes = internalNavRoutes.filter((route) => !internalCovers(route) && !adminCovers(route));
if (unguardedInternalRoutes.length > 0) {
  failures.push(`Internal nav routes are not covered by shellAccess gates: ${unguardedInternalRoutes.join(', ')}`);
}

const standardNavRoutes = unique(
  navItemBlocks.flatMap((block) => {
    const route = block.match(/to:\s*['"`](\/[^'"`]+)['"`]/)?.[1];
    const audience = block.match(/audience:\s*['"`]([^'"`]+)['"`]/)?.[1];
    return route && audience === 'standard' ? [route] : [];
  }),
);
const ungatedStandardNavRoutes = standardNavRoutes.filter(
  (route) => !alwaysReachableStandardRoutes.has(route) && !standardAccessCovers(route),
);
if (ungatedStandardNavRoutes.length > 0) {
  failures.push(
    `Standard nav routes would fall through shellAccess instead of an explicit capability gate: ${ungatedStandardNavRoutes.join(
      ', ',
    )}`,
  );
}

const standardRouteFamilies = routeFamilies.filter((family) => family.audience === 'standard' && family.pattern);
const ungatedStandardFamilies = standardRouteFamilies.filter((family) => {
  const route = sampleRouteFromPattern(family.pattern);
  return (
    !alwaysReachableStandardRoutes.has(route) &&
    !standardAccessCovers(route) &&
    !referenceRouteCovers(route) &&
    !legacyBridgeFamilyCovers(route) &&
    !resolverBridgeCovers(route)
  );
});
if (ungatedStandardFamilies.length > 0) {
  failures.push(
    `Standard route preservation families would fall through shellAccess instead of an explicit capability gate or documented reference exception: ${ungatedStandardFamilies
      .map((family) => family.pattern)
      .join(', ')}`,
  );
}

const routeFamilyCount = routeFamilies.length;
if (routeFamilyCount < 10) {
  failures.push('IA route preservation families are too sparse to cover legacy/contextual routes.');
}

const malformedRouteFamilies = routeFamilies
  .map((family, index) => ({ ...family, index: index + 1 }))
  .filter((family) => !family.pattern || !family.group || !family.state || !family.audience);
if (malformedRouteFamilies.length > 0) {
  failures.push(
    `IA route preservation families are missing required metadata: ${malformedRouteFamilies
      .map((family) => `#${family.index}`)
      .join(', ')}`,
  );
}

const invalidRouteFamilyPatterns = routeFamilies.filter((family) => family.pattern && !family.pattern.startsWith('/'));
if (invalidRouteFamilyPatterns.length > 0) {
  failures.push(
    `IA route preservation family patterns must start with /: ${invalidRouteFamilyPatterns
      .map((family) => family.pattern)
      .join(', ')}`,
  );
}

const invalidRouteFamilyGroups = routeFamilies.filter((family) => family.group && !expectedGroups.includes(family.group));
if (invalidRouteFamilyGroups.length > 0) {
  failures.push(
    `IA route preservation families reference non-canonical groups: ${invalidRouteFamilyGroups
      .map((family) => `${family.pattern} -> ${family.group}`)
      .join(', ')}`,
  );
}

const invalidRouteFamilyStates = routeFamilies.filter(
  (family) => family.state && !allowedPreservationStates.includes(family.state),
);
if (invalidRouteFamilyStates.length > 0) {
  failures.push(
    `IA route preservation families use invalid states: ${invalidRouteFamilyStates
      .map((family) => `${family.pattern} -> ${family.state}`)
      .join(', ')}`,
  );
}

const invalidRouteFamilyAudiences = routeFamilies.filter(
  (family) => family.audience && !allowedAudiences.includes(family.audience),
);
if (invalidRouteFamilyAudiences.length > 0) {
  failures.push(
    `IA route preservation families use invalid audiences: ${invalidRouteFamilyAudiences
      .map((family) => `${family.pattern} -> ${family.audience}`)
      .join(', ')}`,
  );
}

const unguardedAdminFamilies = routeFamilies.filter((family) => {
  if (family.state !== 'admin-only' || !family.pattern) {
    return false;
  }
  const route = family.pattern.replace(/\/\*$/, '/');
  return !adminCovers(route) && !legacyBridgeFamilyCovers(route) && !resolverBridgeCovers(route);
});
if (unguardedAdminFamilies.length > 0) {
  failures.push(
    `Admin-only route preservation families are not covered by shellAccess admin gates: ${unguardedAdminFamilies
      .map((family) => family.pattern)
      .join(', ')}`,
  );
}

const unguardedInternalFamilies = routeFamilies.filter((family) => {
  if (family.state !== 'internal-only' || !family.pattern) {
    return false;
  }
  const route = family.pattern.replace(/\/\*$/, '/');
  return !internalCovers(route) && !adminCovers(route) && !legacyBridgeFamilyCovers(route) && !resolverBridgeCovers(route);
});
if (unguardedInternalFamilies.length > 0) {
  failures.push(
    `Internal-only route preservation families are not covered by shellAccess gates: ${unguardedInternalFamilies
      .map((family) => family.pattern)
      .join(', ')}`,
  );
}

if (failures.length > 0) {
  console.error('IA shell verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('IA shell verification passed.');
console.log(`Canonical IA groups: ${expectedGroups.length}`);
console.log(`Promoted nav routes covered: ${navRoutes.length}`);
console.log('Route ownership checked: /tasks, /integrations');
console.log(`Legacy active-state aliases checked: ${expectedActiveAliases.length}`);
console.log(`Legacy active-state prefix aliases checked: ${expectedActivePrefixAliases.length}`);
console.log(`Route preservation families mapped: ${routeFamilyCount}`);
console.log('Route preservation metadata checked: pattern, canonical group, preservation state, audience, and gated admin/internal states');
console.log(`Legacy bridge route configs checked: ${legacyBridgeModels.length}`);
console.log(`Legacy bridge IA families checked: ${legacyBridgeModels.length}`);
console.log(`Admin-gated nav routes checked: ${adminNavRoutes.length}`);
console.log(`Internal-gated nav routes checked: ${internalNavRoutes.length}`);
console.log(`Standard-gated nav routes checked: ${standardNavRoutes.length}`);
console.log(`Standard route-family gates checked: ${standardRouteFamilies.length}`);
