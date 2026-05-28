#!/usr/bin/env node

const BASE_URL = (process.env.REGOVISE_PROD_BASE_URL || 'https://regovise.com').replace(/\/$/, '');
const TENANT_SLUG = process.env.REGOVISE_VERIFY_TENANT_SLUG || 'regovise';
const ADMIN_EMAIL = process.env.REGOVISE_VERIFY_EMAIL || 'admin@regovise.com';
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SETUP_SECRET || '';
const ALLOW_MUTATIONS = process.env.LIVE_VALIDATION_ALLOW_MUTATIONS === '1';
const SUFFIX = `codex-${Date.now()}`;

const EXPECTED_SCALE_MODULE_KEYS = [
  'assets',
  'assessments',
  'assessment-plans',
  'capabilities',
  'case-management',
  'catalogues',
  'import-regscale-catalogs',
  'causal-analysis',
  'changes',
  'components',
  'data-calls',
  'evidence-locker',
  'exceptions',
  'incidents',
  'interconnections',
  'policies',
  'programs',
  'projects',
  'questionnaires',
  'requirements',
  'risks',
  'security-controls',
  'security-plans',
  'supply-chain',
  'tasks',
  'threats',
];

const NON_SCALE_ALIAS_KEYS = ['issues', 'requests', 'security-profiles', 'threat-models'];

const EXTRA_TENANT_ROUTES = [
  '/',
  '/modules',
  '/assessments',
  '/assessment-plans',
  '/questionnaires',
  '/frameworks',
  '/framework-library',
  '/issues',
  '/requests',
  '/security-profiles',
  '/threat-models',
  '/builders/form-builder',
  '/builders/export-builder',
  '/builders/report-builder',
  '/builders/dashboard-builder',
  '/builders/questionnaire-builder',
  '/builders/wayfinder-builder',
  '/workspace/access',
  '/workspace/team',
  '/workbench',
  '/reports',
];

const SHARED_WORKSPACE_EXEMPLARS = [
  'assets',
  'policies',
  'incidents',
  'exceptions',
  'supply-chain',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function joinUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function firstCookie(setCookieHeader) {
  if (!setCookieHeader) {
    return '';
  }
  return setCookieHeader.split(';', 1)[0] || '';
}

async function request(path, options = {}) {
  const response = await fetch(joinUrl(path), {
    redirect: 'follow',
    ...options,
    headers: {
      'user-agent': 'regovise-live-module-validation/1.0',
      accept: options.expectText ? 'text/html,*/*' : 'application/json,*/*',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload.slice(0, 500) : JSON.stringify(payload);
    throw new Error(`${options.method || 'GET'} ${path} failed with ${response.status}: ${detail}`);
  }
  return { response, payload, text };
}

function apiHeaders(cookie) {
  return cookie ? { cookie } : {};
}

async function apiGet(cookie, path) {
  return (await request(path, { headers: apiHeaders(cookie) })).payload;
}

async function apiPost(cookie, path, body) {
  return (
    await request(path, {
      method: 'POST',
      headers: apiHeaders(cookie),
      body: JSON.stringify(body || {}),
    })
  ).payload;
}

async function establishSession() {
  assert(BOOTSTRAP_SECRET, 'BOOTSTRAP_SETUP_SECRET is required for live production validation.');
  const { response, payload } = await request('/_api/core/bootstrap/admin-session', {
    method: 'POST',
    body: JSON.stringify({
      secret: BOOTSTRAP_SECRET,
      tenantSlug: TENANT_SLUG,
      email: ADMIN_EMAIL,
    }),
  });
  const cookie = firstCookie(response.headers.get('set-cookie'));
  assert(cookie, 'Bootstrap admin-session did not return a session cookie.');
  assert(payload?.data || payload?.ok !== false, 'Bootstrap session returned an unexpected payload.');
  return cookie;
}

async function verifyRoutes(catalogModules) {
  const routes = new Set(EXTRA_TENANT_ROUTES);
  for (const entry of catalogModules) {
    if (entry.canonicalRoute) {
      routes.add(entry.canonicalRoute);
    }
    if (entry.directRoute) {
      routes.add(entry.directRoute);
    }
  }

  const checked = [];
  for (const route of [...routes].sort()) {
    const { response, text } = await request(route, { expectText: true });
    assert(response.status === 200, `Route ${route} returned ${response.status}.`);
    assert(text.includes('<html') || text.includes('Regovise') || text.length > 100, `Route ${route} did not look like a UI page.`);
    checked.push(route);
  }
  return checked;
}

async function verifyModuleCatalog(cookie) {
  const catalog = await apiGet(cookie, '/_api/core/modules/catalog');
  const modules = catalog?.data?.modules || [];
  const keys = modules.map((entry) => entry.moduleKey).sort();
  const expected = [...EXPECTED_SCALE_MODULE_KEYS].sort();

  assert(keys.length === expected.length, `Expected ${expected.length} scale modules, found ${keys.length}: ${keys.join(', ')}`);
  for (const key of expected) {
    assert(keys.includes(key), `Missing scale.md module from tenant catalog: ${key}`);
  }
  for (const key of NON_SCALE_ALIAS_KEYS) {
    assert(!keys.includes(key), `${key} should remain outside the scale.md tenant module catalog.`);
  }
  for (const entry of modules) {
    assert(entry.moduleName || entry.label || entry.pluralName, `Module ${entry.moduleKey} is missing a product label.`);
    assert(entry.summary || entry.description, `Module ${entry.moduleKey} is missing landing context.`);
    assert(entry.implementationType, `Module ${entry.moduleKey} is missing implementation type.`);
    assert(entry.primaryActionLabel || entry.primaryAction, `Module ${entry.moduleKey} is missing a primary action.`);
    assert(entry.canonicalRoute, `Module ${entry.moduleKey} is missing a tenant-facing route.`);
  }
  return modules;
}

async function verifyModuleApis(cookie, modules) {
  const seen = [];
  for (const entry of modules) {
    const detail = await apiGet(cookie, `/_api/core/modules/${entry.moduleKey}`);
    assert(detail?.data?.moduleKey === entry.moduleKey, `Module detail mismatch for ${entry.moduleKey}.`);
    if (entry.implementationType === 'shared-workspace') {
      const records = await apiGet(cookie, `/_api/core/modules/${entry.moduleKey}/records`);
      assert(Array.isArray(records?.data?.records), `Shared module ${entry.moduleKey} did not return a records list.`);
    }
    seen.push(entry.moduleKey);
  }
  return seen;
}

function pickFolder(foldersPayload) {
  const folders = Array.isArray(foldersPayload?.data) ? foldersPayload.data : foldersPayload?.data?.folders || [];
  const domainFolder =
    folders.find((folder) => folder.contentType === 'domain' && folder.id) ||
    folders.find((folder) => folder.id && folder.parentId) ||
    folders.find((folder) => folder.id);
  assert(domainFolder?.id, 'No accessible folder was available for live validation writes.');
  return domainFolder;
}

function buildModuleRecordData(moduleKey, title, extra = {}) {
  const base = {
    title,
    validationMarker: SUFFIX,
    description: 'Created by the production scale-module validation smoke.',
    accountabilityStatus: 'Validated',
    ...extra,
  };

  if (moduleKey === 'assets') {
    return {
      ...base,
      asset_id: `asset-${SUFFIX}`,
      name: title,
    };
  }

  if (moduleKey === 'supply-chain') {
    return {
      ...base,
      vendor_name: `Vendor ${SUFFIX}`,
    };
  }

  if (moduleKey === 'exceptions') {
    return {
      ...base,
      requested_at: '2026-05-28',
    };
  }

  return base;
}

async function exerciseSharedModuleRecords(cookie, folderId) {
  const results = [];
  for (const moduleKey of SHARED_WORKSPACE_EXEMPLARS) {
    const title = `Live validation ${moduleKey} ${SUFFIX}`;
    const created = await apiPost(cookie, `/_api/core/modules/${moduleKey}/records`, {
      folderId,
      title,
      status: 'Active',
      startOn: '2026-05-28',
      dueOn: '2026-06-28',
      reviewOn: '2026-07-28',
      expiresOn: '2026-12-31',
      data: buildModuleRecordData(moduleKey, title),
      links: [
        {
          id: crypto.randomUUID(),
          relationType: 'validation',
          targetType: 'module',
          targetId: moduleKey,
          label: 'Module directory',
          route: '/modules',
        },
      ],
      note: 'Created during production live validation.',
    });
    const recordId = created?.data?.id;
    assert(recordId, `Creating a ${moduleKey} shared module record did not return an id.`);

    const detail = await apiGet(cookie, `/_api/core/modules/${moduleKey}/records/${recordId}`);
    assert(detail?.data?.id === recordId, `Created ${moduleKey} record was not readable.`);

    const updated = await apiPost(cookie, `/_api/core/modules/${moduleKey}/records/${recordId}`, {
      folderId,
      title: `${title} updated`,
      status: 'In Review',
      finishOn: '2026-07-15',
      data: buildModuleRecordData(moduleKey, `${title} updated`, { updateValidated: true }),
      note: 'Updated during production live validation.',
    });
    assert(updated?.data?.status === 'In Review', `Updating a ${moduleKey} record did not persist status.`);

    const archived = await apiPost(cookie, `/_api/core/modules/${moduleKey}/records/${recordId}/archive`, {});
    assert(archived?.data?.archived === true, `Archiving a ${moduleKey} record did not mark it archived.`);
    results.push({ moduleKey, recordId });
  }
  return results;
}

async function exerciseIam(cookie, currentUserId, folderId) {
  const roleName = `Codex live validator ${SUFFIX}`;
  const email = `${SUFFIX}@example.invalid`;
  const [users, roles, assignments] = await Promise.all([
    apiGet(cookie, '/_api/iam/users'),
    apiGet(cookie, '/_api/iam/roles'),
    apiGet(cookie, '/_api/iam/role-assignments'),
  ]);
  assert(Array.isArray(users?.data), 'IAM users list did not return an array.');
  assert(Array.isArray(roles?.data), 'IAM roles list did not return an array.');
  assert(Array.isArray(assignments?.data), 'IAM role assignments list did not return an array.');

  const createdUser = await apiPost(cookie, '/_api/iam/users', {
    email,
    displayName: `Codex Live Validator ${SUFFIX}`,
    status: 'active',
  });
  const userId = createdUser?.data?.id;
  assert(userId, 'IAM user creation did not return an id.');

  const createdGroup = await apiPost(cookie, '/_api/iam/user-groups', {
    folderId,
    name: `Codex validators ${SUFFIX}`,
    description: 'Created by live validation.',
    memberUserIds: [userId],
  });
  const groupId = createdGroup?.data?.id;
  assert(groupId, 'IAM user group creation did not return an id.');

  const createdRole = await apiPost(cookie, '/_api/iam/roles', {
    name: roleName,
    description: 'Temporary live validation role.',
    permissions: ['framework:view', 'framework:manage', 'folder:view', 'folder:manage', 'operation:view'],
  });
  const roleId = createdRole?.data?.id || roles.data[0]?.id;
  assert(roleId, 'IAM role creation did not return an id and no fallback role exists.');

  const userAssignment = await apiPost(cookie, '/_api/iam/role-assignments', {
    userId,
    roleId,
    scopeFolderId: folderId,
  });
  assert(userAssignment?.data?.id, 'IAM user role assignment did not return an id.');

  const groupAssignment = await apiPost(cookie, '/_api/iam/role-assignments', {
    groupId,
    roleId,
    scopeFolderId: folderId,
  });
  assert(groupAssignment?.data?.id, 'IAM group role assignment did not return an id.');

  assert(currentUserId, 'Current authenticated user id was not available after IAM validation.');
  return { userId, groupId, roleId };
}

async function importValidationCatalogue(cookie) {
  const imported = await apiPost(cookie, '/_api/core/frameworks/import/file', {
    fileName: `${SUFFIX}-catalogue.json`,
    payload: {
      key: `CODEX_LIVE_${Date.now()}`,
      name: `Codex Live Catalogue ${SUFFIX}`,
      version: '1.0',
      category: 'validation',
      controls: [
        {
          ref: 'CL-1',
          title: 'Live validation control one',
          description: 'Validates manual assessment creation and control-level updates.',
        },
        {
          ref: 'CL-2',
          title: 'Live validation control two',
          description: 'Validates recurring assessment and action-plan generation.',
        },
      ],
    },
  });
  const framework = imported?.data?.framework;
  assert(framework?.id, 'Framework import from file did not create a catalogue.');
  assert(imported.data.importedControlCount >= 2, 'Framework import did not create the expected controls.');

  const controls = await apiGet(cookie, `/_api/core/frameworks/${framework.id}/controls`);
  const controlRows = Array.isArray(controls?.data) ? controls.data : controls?.data?.controls || [];
  assert(controlRows.length >= 2, 'Imported catalogue controls were not readable.');
  return { framework, controls: controlRows };
}

async function createPerimeter(cookie, folderId) {
  const perimeter = await apiPost(cookie, '/_api/core/perimeters', {
    folderId,
    refId: `COD-${SUFFIX}`,
    name: `Codex validation perimeter ${SUFFIX}`,
    description: 'Production validation perimeter.',
    lcStatus: 'operational',
  });
  assert(perimeter?.data?.id, 'Perimeter creation did not return an id.');
  return perimeter.data;
}

async function createQuestionnaireTemplate(cookie, templateKind) {
  const template = await apiPost(cookie, '/_api/builders/questionnaires', {
    name: `${templateKind === 'assessment-plan' ? 'Assessment Plan' : 'Questionnaire'} ${SUFFIX}`,
    description: 'Created by the production module validation smoke.',
    templateKind,
    sourceFramework: 'Codex Live',
    usageNotes: 'Live validation only.',
    questionnaireType: 'Vendor Risk',
    assignmentModel: 'User assignment',
    evidenceCollectionMode: 'Supporting evidence requested',
    exportMode: 'Spreadsheet-ready',
  });
  const templateId = template?.data?.template?.id || template?.data?.id;
  assert(templateId, `Creating ${templateKind} template did not return an id.`);
  const detail = await apiGet(cookie, `/_api/builders/questionnaires/${templateId}`);
  assert(detail?.data?.template?.id === templateId, `${templateKind} template was not readable.`);
  return detail.data.template;
}

async function exerciseAssessments(cookie, args) {
  const { framework, controls, perimeter, currentUserId, assessmentPlanTemplate } = args;
  const firstControlId = controls[0]?.id;
  assert(firstControlId, 'Assessment validation requires an imported control id.');

  const manual = await apiPost(cookie, '/_api/core/compliance-assessments', {
    perimeterId: perimeter.id,
    frameworkId: framework.id,
    assessmentKind: 'manual',
    refId: `COD-MAN-${SUFFIX}`,
    name: `Codex manual assessment ${SUFFIX}`,
    version: '1.0',
    status: 'planned',
    leadAssessorUserId: currentUserId,
    instructions: 'Validate manual creation, scoped controls, observations, gaps, risk input, and follow-up work.',
    plannedStartOn: '2026-05-28',
    plannedFinishOn: '2026-06-28',
    processInfo: 'Production validation manual assessment workflow.',
    assignmentPrincipalType: 'user',
    assignmentPrincipalId: currentUserId,
    controlIds: [firstControlId],
    recurrence: {
      frequency: 'monthly',
      firstPlannedStart: '2026-05-28',
      firstPlannedFinish: '2026-06-28',
      repeatUntil: '2026-08-28',
      assignmentPrincipalType: 'user',
      assignmentPrincipalId: currentUserId,
    },
    observation: 'Initial live-validation observation.',
    maturityScore: 3,
  });
  const manualId = manual?.data?.id;
  assert(manualId, 'Manual assessment creation did not return an id.');
  assert(manual.data.controlsTotal >= 1, 'Manual assessment did not report scoped controls.');

  const requirements = await apiGet(cookie, `/_api/core/compliance-assessments/${manualId}/requirements`);
  const firstRequirement = requirements?.data?.[0];
  assert(firstRequirement?.id, 'Manual assessment did not expose scoped control requirements.');

  const updatedRequirement = await apiPost(
    cookie,
    `/_api/core/compliance-assessments/${manualId}/requirements/${firstRequirement.id}`,
    {
      result: 'non_compliant',
      observation: 'Control-level lightning assessment observation from live validation.',
      evidenceNote: 'Evidence was reviewed and rejected for validation purposes.',
      gapsDifferences: 'Gap: live validation generated a follow-up control.',
      likelihood: 4,
      impact: 4,
      autoGenerateFollowUp: true,
      evidenceStatus: 'rejected',
      implementationScore: 2,
      documentationScore: 2,
    },
  );
  assert(updatedRequirement?.data?.result === 'non_compliant', 'Control-level assessment update did not persist.');

  const actionPlan = await apiGet(cookie, `/_api/core/compliance-assessments/${manualId}/action-plan`);
  assert(actionPlan?.data?.appliedControls?.length >= 1, 'Manual assessment did not auto-generate follow-up work.');

  const planRun = await apiPost(cookie, '/_api/core/compliance-assessments', {
    perimeterId: perimeter.id,
    frameworkId: framework.id,
    assessmentKind: 'manual',
    assessmentPlanTemplateId: assessmentPlanTemplate.id,
    refId: `COD-PLAN-${SUFFIX}`,
    name: `Codex assessment-plan run ${SUFFIX}`,
    version: '1.0',
    status: 'planned',
    leadAssessorUserId: currentUserId,
    instructions: 'Validate assessment-plan line-of-inquiry execution.',
    plannedStartOn: '2026-05-28',
    plannedFinishOn: '2026-06-28',
    processInfo: 'Production validation assessment-plan workflow.',
    assignmentPrincipalType: 'user',
    assignmentPrincipalId: currentUserId,
    observation: 'Initial assessment-plan validation observation.',
  });
  const planAssessmentId = planRun?.data?.id;
  assert(planAssessmentId, 'Assessment-plan run creation did not return an id.');

  const planItems = await apiGet(cookie, `/_api/core/compliance-assessments/${planAssessmentId}/assessment-plan-items`);
  const firstPlanItem = planItems?.data?.[0];
  assert(firstPlanItem?.id, 'Assessment-plan run did not expose lines of inquiry.');

  const updatedPlanItem = await apiPost(
    cookie,
    `/_api/core/compliance-assessments/${planAssessmentId}/assessment-plan-items/${firstPlanItem.id}`,
    {
      result: 'non_compliant',
      observation: 'Line of inquiry validation observation.',
      evidenceNote: 'Line evidence note from live validation.',
      gapsDifferences: 'Line generated a follow-up control.',
      likelihood: 3,
      impact: 4,
      autoGenerateFollowUp: true,
    },
  );
  assert(updatedPlanItem?.data?.result === 'non_compliant', 'Assessment-plan item update did not persist.');

  const planActionPlan = await apiGet(cookie, `/_api/core/compliance-assessments/${planAssessmentId}/action-plan`);
  assert(planActionPlan?.data?.appliedControls?.length >= 1, 'Assessment-plan run did not generate follow-up work.');

  return { manualId, planAssessmentId };
}

async function exerciseOperationalSurfaces(cookie) {
  const [workbench, reports, reportExport] = await Promise.all([
    apiGet(cookie, '/_api/ops/workbench'),
    apiGet(cookie, '/_api/ops/reports'),
    apiPost(cookie, '/_api/ops/reports/exports', {
      reportId: 'codex-live-validation',
      format: 'json',
      level: 'TENANT',
      namingConvention: 'codex',
    }),
  ]);
  assert(workbench?.data, 'Workbench snapshot did not return data.');
  assert(Array.isArray(reports?.data?.catalog), 'Reports catalog did not return data.');
  assert(reportExport?.data?.id, 'Report export creation did not return an id.');

  const exportDetail = await apiGet(cookie, `/_api/ops/reports/exports/${reportExport.data.id}`);
  assert(exportDetail?.data?.id === reportExport.data.id, 'Report export detail was not readable.');
  return { exportId: reportExport.data.id };
}

async function main() {
  if (!ALLOW_MUTATIONS) {
    throw new Error('Set LIVE_VALIDATION_ALLOW_MUTATIONS=1 to run tenant-facing create/update/archive checks.');
  }

  console.log(`Starting live Regovise validation against ${BASE_URL} (${TENANT_SLUG})`);
  const cookie = await establishSession();
  const me = await apiGet(cookie, '/_api/iam/me');
  assert(me?.data?.isAuthenticated !== false, 'Authenticated IAM profile was not returned.');
  const currentUserId = me?.data?.profile?.id || me?.data?.user?.id || me?.data?.id;
  assert(currentUserId, 'Unable to identify the authenticated validation user.');

  const folders = await apiGet(cookie, '/_api/iam/folders');
  const folder = pickFolder(folders);
  const catalogModules = await verifyModuleCatalog(cookie);
  const routes = await verifyRoutes(catalogModules);
  const moduleApis = await verifyModuleApis(cookie, catalogModules);
  const sharedRecords = await exerciseSharedModuleRecords(cookie, folder.id);
  const iam = await exerciseIam(cookie, currentUserId, folder.id);
  const { framework, controls } = await importValidationCatalogue(cookie);
  const perimeter = await createPerimeter(cookie, folder.id);
  const questionnaireTemplate = await createQuestionnaireTemplate(cookie, 'questionnaire');
  const assessmentPlanTemplate = await createQuestionnaireTemplate(cookie, 'assessment-plan');
  const assessments = await exerciseAssessments(cookie, {
    framework,
    controls,
    perimeter,
    currentUserId,
    assessmentPlanTemplate,
  });
  const ops = await exerciseOperationalSurfaces(cookie);

  console.log(
    JSON.stringify(
      {
        ok: true,
        suffix: SUFFIX,
        tenantSlug: TENANT_SLUG,
        folderId: folder.id,
        moduleCatalogCount: catalogModules.length,
        routeCount: routes.length,
        moduleApiCount: moduleApis.length,
        sharedRecordModules: sharedRecords.map((item) => item.moduleKey),
        iam,
        frameworkId: framework.id,
        controlCount: controls.length,
        perimeterId: perimeter.id,
        questionnaireTemplateId: questionnaireTemplate.id,
        assessmentPlanTemplateId: assessmentPlanTemplate.id,
        assessments,
        reportExportId: ops.exportId,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
