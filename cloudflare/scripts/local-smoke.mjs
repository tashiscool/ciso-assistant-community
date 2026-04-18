const baseUrl = process.env.CLOUDFLARE_LOCAL_URL ?? 'http://127.0.0.1:8787';
const headers = {
  'content-type': 'application/json',
  'x-tenant-id': 'tenant-demo',
  'x-user-id': 'user-demo',
};

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function waitForStableHealth() {
  let consecutiveHealthyResponses = 0;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const health = await request('/_api/core/health');
      if (health?.data?.ok === true) {
        consecutiveHealthyResponses += 1;
        if (consecutiveHealthyResponses >= 2) {
          return;
        }
      } else {
        consecutiveHealthyResponses = 0;
      }
    } catch {
      consecutiveHealthyResponses = 0;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Worker did not reach a stable healthy state in time.');
}

async function poll(path, predicate, attempts = 15, delayMs = 500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const payload = await request(path, { headers });
    if (predicate(payload)) {
      return payload;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Polling ${path} timed out after ${attempts} attempts.`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log(`Running local smoke test against ${baseUrl}`);
  const uniqueSuffix = Date.now();

  await waitForStableHealth();
  const health = await request('/_api/core/health');
  assert(health?.data?.ok === true, 'Health endpoint did not return ok=true.');

  const bootstrap = await request('/_api/core/bootstrap-demo', {
    method: 'POST',
  });
  assert(bootstrap?.data?.tenantId === 'tenant-demo', 'Bootstrap did not return the demo tenant.');

  const overview = await request('/_api/core/overview', { headers });
  assert(overview?.data?.counts?.frameworks >= 1, 'Expected at least one framework.');
  assert(overview?.data?.counts?.domains >= 1, 'Expected at least one domain folder.');
  assert(overview?.data?.counts?.roleAssignments >= 1, 'Expected at least one role assignment.');
  assert(overview?.data?.counts?.entities >= 1, 'Expected at least one third-party entity.');
  assert(overview?.data?.counts?.processings >= 1, 'Expected at least one privacy processing.');
  assert(
    overview?.data?.counts?.businessImpactAnalyses >= 1,
    'Expected at least one business impact analysis.',
  );
  assert(overview?.data?.counts?.reportExports >= 1, 'Expected at least one seeded report export.');
  assert(overview?.data?.counts?.chatSessions >= 1, 'Expected at least one seeded chat session.');
  assert(overview?.data?.counts?.importJobs >= 1, 'Expected at least one seeded import job.');
  assert(overview?.data?.counts?.portalAssignments >= 1, 'Expected at least one portal assignment.');
  assert(overview?.data?.counts?.ebiosStudies >= 1, 'Expected at least one EBIOS study.');
  assert(
    overview?.data?.counts?.quantitativeStudies >= 1,
    'Expected at least one quantitative study.',
  );
  assert(overview?.data?.counts?.riskRegisters >= 1, 'Expected at least one risk register.');
  assert(overview?.data?.counts?.riskScenarios >= 1, 'Expected at least one risk scenario.');
  assert(overview?.data?.counts?.conMonProfiles >= 1, 'Expected at least one ConMon profile.');
  assert(overview?.data?.counts?.evidenceSources >= 1, 'Expected at least one evidence source.');

  const me = await request('/_api/iam/me', { headers });
  assert(me?.data?.profile?.id === 'user-demo', 'IAM me endpoint did not return the demo admin.');
  assert(
    Array.isArray(me?.data?.accessibleDomains) && me.data.accessibleDomains.length >= 1,
    'Expected the demo admin to have accessible domains.',
  );

  const seededFolders = await request('/_api/iam/folders', { headers });
  assert(
    seededFolders?.data?.some((folder) => folder.contentType === 'root'),
    'Expected the seeded workspace root folder.',
  );

  const domainCreate = await request('/_api/iam/folders', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Program Office ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      contentType: 'domain',
    }),
  });
  const domainId = domainCreate?.data?.id;
  assert(domainId, 'Workspace domain creation did not return an id.');

  const userCreate = await request('/_api/iam/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: `operator.${uniqueSuffix}@example.com`,
      displayName: `Operator ${uniqueSuffix}`,
      firstName: 'Operator',
      lastName: `${uniqueSuffix}`,
      locale: 'en',
      keepLocalLogin: true,
    }),
  });
  const scopedUserId = userCreate?.data?.id;
  assert(scopedUserId, 'Workspace user creation did not return an id.');

  const groupCreate = await request('/_api/iam/user-groups', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Program Operators ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      folderId: domainId,
      memberUserIds: [scopedUserId],
    }),
  });
  const groupId = groupCreate?.data?.id;
  assert(groupId, 'Workspace user group creation did not return an id.');

  const roles = await request('/_api/iam/roles', { headers });
  const analystRoleId = roles?.data?.find((role) => role.name === 'Analyst')?.id;
  assert(analystRoleId, 'Could not find the built-in Analyst role.');

  const customRoleCreate = await request('/_api/iam/roles', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Exception Approver ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      permissions: ['approve_exception', 'view_evidence'],
    }),
  });
  const customRoleId = customRoleCreate?.data?.id;
  assert(customRoleId, 'Custom role creation did not return an id.');

  const groupAssignment = await request('/_api/iam/role-assignments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      roleId: analystRoleId,
      groupId,
      scopeFolderId: domainId,
      isRecursive: true,
    }),
  });
  assert(groupAssignment?.data?.id, 'Group role assignment did not return an id.');

  const userAssignment = await request('/_api/iam/role-assignments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      roleId: customRoleId,
      userId: scopedUserId,
      scopeFolderId: domainId,
      isRecursive: true,
    }),
  });
  assert(userAssignment?.data?.id, 'User role assignment did not return an id.');

  const scopedHeaders = {
    ...headers,
    'x-user-id': scopedUserId,
  };
  const scopedMe = await request('/_api/iam/me', { headers: scopedHeaders });
  assert(
    scopedMe?.data?.accessibleDomains?.some((folder) => folder.id === domainId),
    'Scoped user did not inherit access to the created domain.',
  );
  assert(
    scopedMe?.data?.permissions?.includes('approve_exception'),
    'Scoped user did not receive the custom direct role permission.',
  );

  const frameworkCreate = await request('/_api/core/frameworks', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key: `EDGE_FRAMEWORK_${uniqueSuffix}`,
      name: `Edge Framework ${uniqueSuffix}`,
      version: '1.0',
      category: 'governance',
    }),
  });
  assert(frameworkCreate?.data?.id, 'Framework creation did not return an id.');

  const controlCreateOne = await request(`/_api/core/frameworks/${frameworkCreate.data.id}/controls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: 'GOV.1',
      title: `Governance Control ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
    }),
  });
  const controlCreateTwo = await request(`/_api/core/frameworks/${frameworkCreate.data.id}/controls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: 'GOV.2',
      title: `Monitoring Control ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
    }),
  });
  assert(controlCreateOne?.data?.id, 'First framework control creation did not return an id.');
  assert(controlCreateTwo?.data?.id, 'Second framework control creation did not return an id.');

  const registerCreate = await request('/_api/core/risk-registers', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Risk Register ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
    }),
  });
  const registerId = registerCreate?.data?.id;
  assert(registerId, 'Risk register creation did not return an id.');

  const scenarioCreate = await request('/_api/core/risk-scenarios', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      registerId,
      title: `Risk Scenario ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      likelihood: 3.2,
      impact: 4.1,
      status: 'open',
    }),
  });
  const scenarioId = scenarioCreate?.data?.id;
  assert(scenarioId, 'Risk scenario creation did not return an id.');

  const frameworks = await request('/_api/core/frameworks', { headers });
  assert(
    frameworks?.data?.some((item) => item.id === frameworkCreate.data.id),
    'Created framework was not returned by the list endpoint.',
  );

  const libraries = await request('/_api/core/libraries', { headers });
  const seededLibraryId = libraries?.data?.[0]?.id;
  assert(seededLibraryId, 'Expected at least one seeded library after bootstrap.');

  const frameworkDetail = await request(`/_api/core/frameworks/${frameworkCreate.data.id}`, { headers });
  assert(frameworkDetail?.data?.controlCount === 2, 'Framework detail did not return the expected control count.');

  const frameworkTree = await request(`/_api/core/frameworks/${frameworkCreate.data.id}/tree`, { headers });
  assert(Array.isArray(frameworkTree?.data) && frameworkTree.data.length >= 1, 'Framework tree endpoint returned no sections.');

  const libraryDetail = await request(`/_api/core/libraries/${seededLibraryId}`, { headers });
  assert(
    Array.isArray(libraryDetail?.data?.referenceControls) && libraryDetail.data.referenceControls.length >= 1,
    'Library detail did not return reference controls.',
  );

  const registers = await request('/_api/core/risk-registers', { headers });
  assert(
    registers?.data?.some((item) => item.id === registerId),
    'Created risk register was not returned by the list endpoint.',
  );

  const scenarios = await request('/_api/core/risk-scenarios', { headers });
  assert(
    scenarios?.data?.some((item) => item.id === scenarioId),
    'Created risk scenario was not returned by the list endpoint.',
  );

  const perimeterCreate = await request('/_api/core/perimeters', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      refId: `PERIM_${uniqueSuffix}`,
      name: `Perimeter ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      lcStatus: 'in_prod',
    }),
  });
  const perimeterId = perimeterCreate?.data?.id;
  assert(perimeterId, 'Perimeter creation did not return an id.');

  const riskAssessmentCreate = await request('/_api/core/risk-assessments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      perimeterId,
      riskRegisterId: registerId,
      refId: `RA_${uniqueSuffix}`,
      name: `Risk Assessment ${uniqueSuffix}`,
      version: '1.0',
      status: 'in_progress',
      observation: 'Created by the local smoke test.',
    }),
  });
  const riskAssessmentId = riskAssessmentCreate?.data?.id;
  assert(riskAssessmentId, 'Risk assessment creation did not return an id.');

  const complianceAssessmentCreate = await request('/_api/core/compliance-assessments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      perimeterId,
      frameworkId: frameworkCreate.data.id,
      refId: `CA_${uniqueSuffix}`,
      name: `Compliance Assessment ${uniqueSuffix}`,
      version: '1.0',
      status: 'in_review',
      observation: 'Created by the local smoke test.',
      controlsTotal: 24,
      controlsAssessed: 10,
      maturityScore: 3.4,
    }),
  });
  const complianceAssessmentId = complianceAssessmentCreate?.data?.id;
  assert(complianceAssessmentId, 'Compliance assessment creation did not return an id.');

  const perimeters = await request('/_api/core/perimeters', { headers });
  assert(
    perimeters?.data?.some((item) => item.id === perimeterId),
    'Created perimeter was not returned by the list endpoint.',
  );

  const riskAssessments = await request('/_api/core/risk-assessments', { headers });
  assert(
    riskAssessments?.data?.some((item) => item.id === riskAssessmentId),
    'Created risk assessment was not returned by the list endpoint.',
  );

  const riskAssessmentDetail = await request(`/_api/core/risk-assessments/${riskAssessmentId}`, { headers });
  assert(riskAssessmentDetail?.data?.id === riskAssessmentId, 'Risk assessment detail endpoint returned the wrong record.');

  const riskAssessmentScenarios = await request(`/_api/core/risk-assessments/${riskAssessmentId}/scenarios`, {
    headers,
  });
  assert(
    riskAssessmentScenarios?.data?.some((item) => item.id === scenarioId),
    'Risk assessment scenarios endpoint did not include the created scenario.',
  );

  const riskActionPlan = await request(`/_api/core/risk-assessments/${riskAssessmentId}/action-plan`, {
    headers,
  });
  assert(
    Array.isArray(riskActionPlan?.data?.actionPlan) && riskActionPlan.data.actionPlan.length >= 1,
    'Risk action-plan endpoint did not return any treatment items.',
  );

  const riskBudgetOverview = await request(
    `/_api/core/risk-assessments/${riskAssessmentId}/action-plan/budget-overview`,
    { headers },
  );
  assert(
    typeof riskBudgetOverview?.data?.controlsCount === 'number',
    'Risk action-plan budget overview did not return summary metrics.',
  );

  const complianceAssessments = await request('/_api/core/compliance-assessments', { headers });
  assert(
    complianceAssessments?.data?.some((item) => item.id === complianceAssessmentId),
    'Created compliance assessment was not returned by the list endpoint.',
  );

  const complianceAssessmentDetail = await request(`/_api/core/compliance-assessments/${complianceAssessmentId}`, {
    headers,
  });
  assert(
    complianceAssessmentDetail?.data?.controlsTotal === 2,
    'Compliance assessment detail did not derive the expected requirement count.',
  );

  const complianceRequirements = await request(
    `/_api/core/compliance-assessments/${complianceAssessmentId}/requirements`,
    { headers },
  );
  assert(
    Array.isArray(complianceRequirements?.data) && complianceRequirements.data.length === 2,
    'Compliance assessment requirements endpoint did not return the framework requirements.',
  );

  const requirementUpdate = await request(
    `/_api/core/compliance-assessments/${complianceAssessmentId}/requirements/${complianceRequirements.data[0].id}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        result: 'compliant',
        evidenceStatus: 'approved',
        implementationScore: 4.4,
        documentationScore: 4.1,
        observation: 'Updated by the local smoke test.',
      }),
    },
  );
  assert(
    requirementUpdate?.data?.result === 'compliant',
    'Requirement update endpoint did not persist the new result.',
  );

  const actionPlan = await request(`/_api/core/compliance-assessments/${complianceAssessmentId}/action-plan`, {
    headers,
  });
  assert(
    Array.isArray(actionPlan?.data?.appliedControls) && actionPlan.data.appliedControls.length === 2,
    'Compliance action-plan endpoint did not return the generated applied controls.',
  );

  const budgetOverview = await request(
    `/_api/core/compliance-assessments/${complianceAssessmentId}/action-plan/budget-overview`,
    { headers },
  );
  assert(
    budgetOverview?.data?.controlsCount === 2,
    'Action-plan budget overview did not return the expected control count.',
  );

  const appliedControls = await request(
    `/_api/core/applied-controls?complianceAssessmentId=${complianceAssessmentId}`,
    { headers },
  );
  assert(
    Array.isArray(appliedControls?.data) && appliedControls.data.length === 2,
    'Applied-controls list endpoint did not return the assessment controls.',
  );

  const appliedControlUpdate = await request(`/_api/core/applied-controls/${appliedControls.data[0].id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      status: 'in_progress',
      priority: 'P2',
      category: 'governance',
      csfFunction: 'govern',
      ownerName: 'Smoke Test Owner',
      eta: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      controlImpact: 4,
      effort: 'M',
      annualCost: 12500,
      notes: 'Updated by the local smoke test.',
    }),
  });
  assert(
    appliedControlUpdate?.data?.status === 'in_progress',
    'Applied-control update endpoint did not persist the new status.',
  );

  const entities = await request('/_api/core/entities', { headers });
  const seededEntityId = entities?.data?.[0]?.id;
  assert(seededEntityId, 'Expected at least one seeded third-party entity after bootstrap.');

  const entityDetail = await request(`/_api/core/entities/${seededEntityId}`, { headers });
  assert(entityDetail?.data?.entity?.id === seededEntityId, 'Entity detail endpoint returned the wrong record.');
  assert(
    Array.isArray(entityDetail?.data?.contracts) && entityDetail.data.contracts.length >= 1,
    'Entity detail did not return related contracts.',
  );

  const entityCreate = await request('/_api/core/entities', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      refId: `ENTITY_${uniqueSuffix}`,
      name: `Vendor ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      relationship: 'ict_provider',
      country: 'US',
      currency: 'USD',
    }),
  });
  const entityId = entityCreate?.data?.id;
  assert(entityId, 'Third-party entity creation did not return an id.');

  const solutionCreate = await request('/_api/core/solutions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      providerEntityId: entityId,
      refId: `SOLUTION_${uniqueSuffix}`,
      name: `Service ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      criticality: 3,
    }),
  });
  const solutionId = solutionCreate?.data?.id;
  assert(solutionId, 'Third-party solution creation did not return an id.');

  const contractCreate = await request('/_api/core/contracts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      providerEntityId: entityId,
      refId: `CONTRACT_${uniqueSuffix}`,
      name: `Contract ${uniqueSuffix}`,
      status: 'draft',
      currency: 'USD',
      annualExpense: 42000,
      solutions: [{ id: solutionId, name: solutionCreate.data.name }],
    }),
  });
  assert(contractCreate?.data?.id, 'Third-party contract creation did not return an id.');

  const solutions = await request('/_api/core/solutions', { headers });
  assert(
    solutions?.data?.some((item) => item.id === solutionId),
    'Created third-party solution was not returned by the list endpoint.',
  );

  const contracts = await request('/_api/core/contracts', { headers });
  assert(
    contracts?.data?.some((item) => item.id === contractCreate.data.id),
    'Created third-party contract was not returned by the list endpoint.',
  );

  const processings = await request('/_api/core/processings', { headers });
  const seededProcessingId = processings?.data?.find((item) => item.purposeCount >= 1)?.id;
  assert(seededProcessingId, 'Expected at least one seeded privacy processing after bootstrap.');

  const processingDetail = await request(`/_api/core/processings/${seededProcessingId}`, { headers });
  assert(
    Array.isArray(processingDetail?.data?.purposes) && processingDetail.data.purposes.length >= 1,
    'Processing detail did not return its purpose catalog.',
  );

  const processingCreate = await request('/_api/core/processings', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      refId: `PROC_${uniqueSuffix}`,
      name: `Processing ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      status: 'privacy_draft',
      dpiaRequired: false,
    }),
  });
  const processingId = processingCreate?.data?.id;
  assert(processingId, 'Privacy processing creation did not return an id.');

  const requestCreate = await request('/_api/core/right-requests', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      refId: `RR_${uniqueSuffix}`,
      name: `Right Request ${uniqueSuffix}`,
      requestedOn: new Date().toISOString().slice(0, 10),
      requestType: 'access',
      status: 'new',
      processings: [{ id: processingId, name: processingCreate.data.name }],
    }),
  });
  assert(requestCreate?.data?.id, 'Right request creation did not return an id.');

  const breachCreate = await request('/_api/core/data-breaches', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      refId: `DB_${uniqueSuffix}`,
      name: `Breach ${uniqueSuffix}`,
      discoveredOn: new Date().toISOString(),
      breachType: 'privacy_other',
      riskLevel: 'privacy_risk',
      status: 'privacy_discovered',
      affectedProcessings: [{ id: processingId, name: processingCreate.data.name }],
    }),
  });
  assert(breachCreate?.data?.id, 'Data breach creation did not return an id.');

  const rightRequests = await request('/_api/core/right-requests', { headers });
  assert(
    rightRequests?.data?.some((item) => item.id === requestCreate.data.id),
    'Created right request was not returned by the list endpoint.',
  );

  const breaches = await request('/_api/core/data-breaches', { headers });
  assert(
    breaches?.data?.some((item) => item.id === breachCreate.data.id),
    'Created data breach was not returned by the list endpoint.',
  );

  const analyses = await request('/_api/core/business-impact-analyses', { headers });
  const seededAnalysisId = analyses?.data?.find((item) => item.assetCount >= 1)?.id;
  assert(seededAnalysisId, 'Expected at least one seeded business impact analysis after bootstrap.');

  const analysisDetail = await request(`/_api/core/business-impact-analyses/${seededAnalysisId}`, {
    headers,
  });
  assert(
    Array.isArray(analysisDetail?.data?.assetAssessments) &&
      analysisDetail.data.assetAssessments.length >= 1,
    'Business impact analysis detail did not return asset assessments.',
  );

  const analysisCreate = await request('/_api/core/business-impact-analyses', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      perimeterId,
      refId: `BIA_${uniqueSuffix}`,
      name: `BIA ${uniqueSuffix}`,
      description: 'Created by the local smoke test.',
      version: '1.0',
      status: 'planned',
      riskMatrixName: 'Smoke Test Matrix',
    }),
  });
  assert(analysisCreate?.data?.id, 'Business impact analysis creation did not return an id.');

  const reportCatalog = await request('/_api/ops/reports', { headers });
  assert(
    Array.isArray(reportCatalog?.data?.catalog) && reportCatalog.data.catalog.length >= 1,
    'Reports catalog endpoint did not return any report definitions.',
  );

  const doraLint = await request('/_api/ops/reports/dora-roi', { headers });
  assert(
    typeof doraLint?.data?.lintResults?.summary?.warnings === 'number',
    'DORA lint endpoint did not return a summary payload.',
  );

  const reportExportCreate = await request('/_api/ops/reports/exports', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      reportId: 'dora-roi',
      format: 'csv',
      identifierType: 'entity_ref',
      level: 'IND',
      namingConvention: 'eba',
    }),
  });
  const reportExportId = reportExportCreate?.data?.id;
  assert(reportExportId, 'Report export creation did not return an id.');

  const reportDownload = await fetch(`${baseUrl}/_api/ops/reports/exports/${reportExportId}/download`, {
    headers,
  });
  const reportDownloadText = await reportDownload.text();
  assert(reportDownload.ok, 'Report download endpoint did not return a success status.');
  assert(
    reportDownloadText.includes('section') && reportDownloadText.includes('summary'),
    'Report download endpoint did not return the expected CSV payload.',
  );

  const chatStatus = await request('/_api/ops/chat/status', { headers });
  assert(chatStatus?.data?.available === true, 'Chat status endpoint did not report availability.');

  const chatSessions = await request('/_api/ops/chat/sessions', { headers });
  assert(
    Array.isArray(chatSessions?.data) && chatSessions.data.length >= 1,
    'Chat sessions endpoint did not return the seeded session.',
  );

  const chatSessionCreate = await request('/_api/ops/chat/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      title: `Smoke chat ${uniqueSuffix}`,
    }),
  });
  const chatSessionId = chatSessionCreate?.data?.id;
  assert(chatSessionId, 'Chat session creation did not return an id.');

  const chatMessage = await request(`/_api/ops/chat/sessions/${chatSessionId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: 'Give me a quick risk summary.',
    }),
  });
  assert(
    chatMessage?.data?.assistantMessage?.content?.toLowerCase().includes('risk'),
    'Chat message endpoint did not return an assistant response.',
  );

  const importCreate = await request('/_api/ops/imports', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      folderId: domainId,
      name: `Import ${uniqueSuffix}`,
      sourceType: 'spreadsheet',
      targetKind: 'entities',
      rowCount: 2,
    }),
  });
  assert(importCreate?.data?.importedCount >= 1, 'Import pipeline did not create any workspace objects.');

  const portalAssignments = await request('/_api/ops/portal/assignments', { headers });
  const portalAssignmentId = portalAssignments?.data?.[0]?.id;
  assert(portalAssignmentId, 'Portal assignment list did not return a seeded assignment.');

  const portalAssignment = await request(`/_api/ops/portal/assignments/${portalAssignmentId}`, { headers });
  const portalRequirementId = portalAssignment?.data?.requirements?.[0]?.id;
  assert(portalRequirementId, 'Portal assignment detail did not return requirement items.');

  const portalRequirementUpdate = await request(
    `/_api/ops/portal/assignments/${portalAssignmentId}/requirements/${portalRequirementId}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        result: 'compliant',
        response: 'Completed during the local smoke test.',
        observation: 'Reviewed by smoke test.',
        evidenceNote: 'Evidence note',
      }),
    },
  );
  assert(
    portalRequirementUpdate?.data?.assignment?.requirements?.some(
      (item) => item.id === portalRequirementId && item.result === 'compliant',
    ),
    'Portal requirement update did not persist the requirement result.',
  );

  const portalSubmit = await request(`/_api/ops/portal/assignments/${portalAssignmentId}/submit`, {
    method: 'POST',
    headers,
  });
  assert(
    portalSubmit?.data?.status === 'submitted',
    'Portal assignment submit endpoint did not move the assignment into submitted status.',
  );

  const ebiosStudies = await request('/_api/ops/ebios-studies', { headers });
  const seededEbiosId = ebiosStudies?.data?.[0]?.id;
  assert(seededEbiosId, 'EBIOS study list did not return a seeded study.');

  const ebiosDetail = await request(`/_api/ops/ebios-studies/${seededEbiosId}`, { headers });
  const ebiosWorkshop = ebiosDetail?.data?.workshops?.[0];
  const ebiosStep = ebiosWorkshop?.steps?.[0];
  assert(ebiosStep?.id, 'EBIOS study detail did not return workshop steps.');

  const ebiosUpdate = await request(
    `/_api/ops/ebios-studies/${seededEbiosId}/workshops/${ebiosWorkshop.id}/${ebiosStep.id}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'done' }),
    },
  );
  assert(
    ebiosUpdate?.data?.workshops?.[0]?.steps?.some((item) => item.id === ebiosStep.id && item.status === 'done'),
    'EBIOS workshop update did not persist the new step status.',
  );

  const quantStudies = await request('/_api/ops/quantitative-studies', { headers });
  const seededQuantId = quantStudies?.data?.[0]?.id;
  assert(seededQuantId, 'Quantitative study list did not return a seeded study.');

  const quantDetail = await request(`/_api/ops/quantitative-studies/${seededQuantId}`, { headers });
  assert(
    Array.isArray(quantDetail?.data?.scenarios) && quantDetail.data.scenarios.length >= 1,
    'Quantitative study detail did not return scenarios.',
  );

  const quantExecutiveSummary = await request(`/_api/ops/quantitative-studies/${seededQuantId}/executive-summary`, {
    headers,
  });
  assert(
    typeof quantExecutiveSummary?.data?.narrative === 'string' &&
      quantExecutiveSummary.data.narrative.length > 0,
    'Quantitative executive summary endpoint did not return a narrative.',
  );

  const quantMetrics = await request(`/_api/ops/quantitative-studies/${seededQuantId}/key-metrics`, {
    headers,
  });
  assert(
    typeof quantMetrics?.data?.metrics?.currentAleCombined === 'number',
    'Quantitative key-metrics endpoint did not return metrics.',
  );

  const quantActionPlan = await request(`/_api/ops/quantitative-studies/${seededQuantId}/action-plan`, {
    headers,
  });
  assert(
    Array.isArray(quantActionPlan?.data?.actionPlan) && quantActionPlan.data.actionPlan.length >= 1,
    'Quantitative action-plan endpoint did not return any treatment items.',
  );

  const quantScenarioId = quantDetail?.data?.scenarios?.[0]?.id;
  const quantHypothesisId = quantDetail?.data?.scenarios?.[0]?.hypotheses?.[0]?.id;
  assert(quantScenarioId, 'Quantitative study detail did not return a scenario id.');
  assert(quantHypothesisId, 'Quantitative study detail did not return a hypothesis id.');

  const quantScenarioDetail = await request(`/_api/ops/quantitative-scenarios/${quantScenarioId}`, {
    headers,
  });
  assert(
    quantScenarioDetail?.data?.scenario?.id === quantScenarioId,
    'Quantitative scenario detail endpoint returned the wrong record.',
  );

  const quantHypothesisDetail = await request(`/_api/ops/quantitative-hypotheses/${quantHypothesisId}`, {
    headers,
  });
  assert(
    quantHypothesisDetail?.data?.hypothesis?.id === quantHypothesisId,
    'Quantitative hypothesis detail endpoint returned the wrong record.',
  );

  const parityOverview = await request('/_api/ops/parity/overview', { headers });
  assert(Array.isArray(parityOverview?.data?.searchIndex), 'Parity overview did not return a search index.');
  assert(Array.isArray(parityOverview?.data?.assets), 'Parity overview did not return asset parity cards.');
  assert(Array.isArray(parityOverview?.data?.tasks), 'Parity overview did not return task parity cards.');

  const quantRefresh = await request(`/_api/ops/quantitative-studies/${seededQuantId}/retrigger-simulations`, {
    method: 'POST',
    headers,
  });
  assert(
    quantRefresh?.data?.success === true,
    'Quantitative simulation refresh endpoint did not return success.',
  );

  const profiles = await request('/_api/conmon/profiles', { headers });
  const profileId = profiles?.data?.[0]?.id;
  assert(profileId, 'No ConMon profile found after bootstrap.');

  const sources = await request('/_api/evidence/sources', { headers });
  const sourceId = sources?.data?.[0]?.id;
  assert(sourceId, 'No evidence source found after bootstrap.');

  const run = await request(`/_api/conmon/profiles/${profileId}/run`, {
    method: 'POST',
    headers,
  });
  const executionId = run?.data?.executionId;
  assert(executionId, 'ConMon run did not return an execution id.');

  const collect = await request(`/_api/evidence/sources/${sourceId}/collect`, {
    method: 'POST',
    headers,
  });
  const jobId = collect?.data?.jobId;
  assert(jobId, 'Evidence collect did not return a job id.');

  const executions = await poll(
    '/_api/conmon/executions',
    (payload) => payload?.data?.some((item) => item.id === executionId && item.status === 'success'),
  );
  const jobs = await poll(
    '/_api/evidence/jobs',
    (payload) => payload?.data?.some((item) => item.id === jobId && item.status === 'success'),
  );
  const artifacts = await poll(
    '/_api/evidence/artifacts',
    (payload) => payload?.data?.some((item) => item.jobId === jobId),
  );

  assert(executions.data.length >= 1, 'No ConMon executions returned.');
  assert(jobs.data.length >= 1, 'No evidence jobs returned.');
  assert(artifacts.data.length >= 1, 'No evidence artifacts returned.');

  console.log(
    'Health, IAM, governance, reports, chat, imports, portal, advanced risk, third-party, privacy, resilience, queue consumers, and R2 artifact flow all passed.',
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
