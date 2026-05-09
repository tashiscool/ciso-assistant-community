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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForStableHealth() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const health = await request('/_api/core/health');
      if (health?.data?.ok === true) {
        return;
      }
    } catch {
      // Ignore and retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Worker did not reach a stable healthy state in time.');
}

function agentEvalStatusCount(evaluations, status) {
  return evaluations.filter((item) => item?.status === status).length;
}

async function findParityPackage(packages) {
  for (const item of packages.slice(0, 8)) {
    const packageJson = await request(`/_api/assurance/packages/${item.id}/artifacts/package_json`, {
      headers,
    });
    const preview = packageJson?.data?.preview;
    if (
      preview?.metadata?.bundle_kind === 'threat-hunt' &&
      preview?.metadata?.agent_run_id &&
      preview?.agent_security_summary
    ) {
      return {
        listItem: item,
        packageDocument: preview,
      };
    }
  }
  throw new Error('Could not find a threat-hunt package with embedded agent security.');
}

async function main() {
  console.log(`Running observable parity verifier against ${baseUrl}`);
  await waitForStableHealth();

  const overview = await request('/_api/assurance/overview', { headers });
  const overviewData = overview?.data;
  assert(overviewData?.summary?.packageCount >= 1, 'Assurance overview did not report any packages.');
  assert(overviewData?.summary?.agentRunCount >= 1, 'Assurance overview did not report any agent runs.');
  assert(overviewData?.summary?.agentBackedPackageCount >= 1, 'Assurance overview did not report any agent-backed packages.');
  assert(overviewData?.summary?.observableParityReadyPackageCount >= 1, 'Assurance overview did not report any parity-ready packages.');
  assert(Array.isArray(overviewData?.packages) && overviewData.packages.length >= 1, 'Assurance overview did not return recent package records.');
  assert(Array.isArray(overviewData?.parityReadyPackages) && overviewData.parityReadyPackages.length >= 1, 'Assurance overview did not return parity-ready package records.');
  assert(Array.isArray(overviewData?.agentRuns) && overviewData.agentRuns.length >= 1, 'Assurance overview did not return recent agent runs.');

  const parityStatus = await request('/_api/assurance/parity/status', { headers });
  const parityData = parityStatus?.data;
  assert(parityData?.status === 'pass', `Observable parity status is not passing: ${parityData?.status ?? 'missing'}.`);
  assert(Array.isArray(parityData?.checks) && parityData.checks.length >= 8, 'Observable parity status did not return the expected checklist.');
  const requiredParityChecks = [
    'parity_package',
    'package_contract',
    'reconciliation',
    'agent_embedding',
    'report_bundle',
    'evidence_artifacts',
    'tracker_artifacts',
  ];
  for (const checkId of requiredParityChecks) {
    assert(
      parityData.checks.some((item) => item.id === checkId && item.status === 'pass'),
      `Observable parity status is missing a passing ${checkId} check.`,
    );
  }

  const packages = await request('/_api/assurance/packages', { headers });
  assert(Array.isArray(packages?.data) && packages.data.length >= 1, 'Package list is empty.');
  const { listItem: parityPackage, packageDocument } = await findParityPackage(packages.data);
  const packageId = parityPackage.id;
  const evidenceJobId = packageDocument.metadata.evidence_job_id;
  const agentRunId = packageDocument.metadata.agent_run_id;
  const agentSummary = packageDocument.agent_security_summary;
  assert(
    overviewData.parityReadyPackages.some((item) => item.id === packageId),
    'Assurance overview parity-ready slice did not include the selected parity package.',
  );

  assert(agentSummary?.run_id === agentRunId, 'Package agent security summary does not preserve the linked agent run id.');
  assert(agentSummary?.evaluation_count >= 1, 'Package agent security summary does not report any agent evaluations.');

  const packageDetail = await request(`/_api/assurance/packages/${packageId}`, { headers });
  assert(packageDetail?.data?.summary?.evidenceJobId === evidenceJobId, 'Package detail did not preserve evidence lineage.');

  const packageValidation = await request(`/_api/assurance/packages/${packageId}/artifacts/validation_report`, {
    headers,
  });
  const validationChecks = packageValidation?.data?.preview?.checks ?? [];
  const requiredValidationChecks = [
    'agent_eval_embedding',
    'agent_security_summary_alignment',
    'agent_finding_lineage',
    'agent_poam_alignment',
    'agent_report_embedding',
  ];
  for (const checkId of requiredValidationChecks) {
    assert(
      validationChecks.some((item) => item.id === checkId && item.status === 'pass'),
      `Package validation report is missing a passing ${checkId} check.`,
    );
  }

  const assessorReport = await request(`/_api/assurance/packages/${packageId}/artifacts/assessor`, {
    headers,
  });
  const executiveReport = await request(`/_api/assurance/packages/${packageId}/artifacts/executive`, {
    headers,
  });
  const aoReport = await request(`/_api/assurance/packages/${packageId}/artifacts/ao`, {
    headers,
  });
  const assessorPoamReport = await request(`/_api/assurance/packages/${packageId}/artifacts/assessor_poam_md`, {
    headers,
  });
  assert(
    typeof assessorReport?.data?.preview === 'string' &&
      assessorReport.data.preview.includes('## Embedded Agent Security') &&
      assessorReport.data.preview.includes(agentRunId),
    'Assessor report is missing the embedded agent security section.',
  );
  assert(
    typeof executiveReport?.data?.preview === 'string' &&
      executiveReport.data.preview.includes('## Agent Governance') &&
      executiveReport.data.preview.includes(agentRunId),
    'Executive report is missing the agent governance section.',
  );
  assert(
    typeof aoReport?.data?.preview === 'string' &&
      aoReport.data.preview.includes('## Agent Residual Risk') &&
      aoReport.data.preview.includes(agentRunId),
    'AO report is missing the agent residual-risk section.',
  );
  assert(
    typeof assessorPoamReport?.data?.preview === 'string' &&
      assessorPoamReport.data.preview.includes('Agent POA&M rows:'),
    'Assessor POA&M report is missing the agent POA&M summary line.',
  );

  const agentRun = await request(`/_api/agent/runs/${agentRunId}`, { headers });
  assert(agentRun?.data?.id === agentRunId, 'Agent run detail did not return the selected run id.');
  const agentTrace = await request(`/_api/agent/runs/${agentRunId}/trace`, { headers });
  assert(agentTrace?.data?.runId === agentRunId, 'Agent trace endpoint did not return the selected run id.');
  const agentEvalResults = await request(`/_api/agent/runs/${agentRunId}/artifacts/agent_eval_results`, {
    headers,
  });
  const agentEvaluations = agentEvalResults?.data?.preview?.evaluations ?? [];
  assert(Array.isArray(agentEvaluations) && agentEvaluations.length >= 1, 'Agent eval artifact is empty.');
  assert(
    agentSummary.evaluation_count === agentEvaluations.length &&
      agentSummary.pass_count === agentEvalStatusCount(agentEvaluations, 'PASS') &&
      agentSummary.partial_count === agentEvalStatusCount(agentEvaluations, 'PARTIAL') &&
      agentSummary.fail_count === agentEvalStatusCount(agentEvaluations, 'FAIL'),
    'Package agent security summary does not align with the agent eval artifact.',
  );
  const packageAgentFindings = Array.isArray(packageDocument.findings)
    ? packageDocument.findings.filter((item) => String(item?.source_eval_code ?? '').startsWith('AGENT_'))
    : [];
  const packageAgentPoam = Array.isArray(packageDocument.poam_items)
    ? packageDocument.poam_items.filter((item) => String(item?.sourceEvalCode ?? '').startsWith('AGENT_'))
    : [];
  assert(
    agentSummary.gap_count === packageAgentFindings.length &&
      agentSummary.poam_count === packageAgentPoam.length,
    'Package agent security summary does not align with embedded agent findings or agent POA&M rows.',
  );

  const evidenceJob = await request(`/_api/evidence/jobs/${evidenceJobId}`, { headers });
  const evidenceFamilies = new Set((evidenceJob?.data?.artifacts ?? []).map((item) => item.artifactFamily));
  for (const family of ['validation_report', 'threat_hunt_findings', 'threat_hunt_timeline', 'threat_hunt_queries']) {
    assert(evidenceFamilies.has(family), `Evidence job is missing the ${family} artifact family.`);
  }

  const trackerImports = await request('/_api/assurance/tracker/imports', { headers });
  assert(Array.isArray(trackerImports?.data) && trackerImports.data.length >= 1, 'Tracker import list is empty.');
  const trackerImportId = trackerImports.data[0].id;
  const trackerGapMatrix = await request(`/_api/assurance/tracker/imports/${trackerImportId}/artifacts/tracker_gap_matrix`, {
    headers,
  });
  const trackerPlan = await request(`/_api/assurance/tracker/imports/${trackerImportId}/artifacts/tracker_instrumentation_plan`, {
    headers,
  });
  assert(
    typeof trackerGapMatrix?.data?.preview === 'string' &&
      trackerGapMatrix.data.preview.includes('"row_index"') &&
      trackerGapMatrix.data.preview.includes('"row_status"'),
    'Tracker gap matrix artifact is missing expected CSV content.',
  );
  assert(
    typeof trackerPlan?.data?.preview === 'string' &&
      trackerPlan.data.preview.includes('Tracker Instrumentation Plan'),
    'Tracker instrumentation plan artifact is missing expected markdown content.',
  );

  const workflowSearch = new URLSearchParams();
  for (const recordId of [packageId, evidenceJobId, agentRunId]) {
    workflowSearch.append('linkedRecordId', recordId);
  }
  workflowSearch.set('limit', '20');
  const workflows = await request(`/_api/assurance/workflows?${workflowSearch.toString()}`, { headers });
  const workflowTypes = new Set((workflows?.data ?? []).map((item) => item.runType));
  for (const workflowType of ['assurance_package', 'assurance_agent']) {
    assert(workflowTypes.has(workflowType), `Workflow feed is missing ${workflowType} for the parity package.`);
  }

  const overviewPendingWritebacks = overviewData.pendingWritebacks ?? [];
  const overviewAgentRuns = overviewData.agentRuns ?? [];
  assert(
    overviewData.summary.pendingWritebackCount >= 1 && overviewPendingWritebacks.length >= 1,
    'Assurance overview did not surface any pending writeback queue entries.',
  );
  assert(
    overviewAgentRuns.some((item) => item.id === agentRunId && item.pendingWritebackCount >= 1),
    'Assurance overview did not include the parity agent run in the recent agent-run slice.',
  );

  console.log(
    'Observable parity verification passed: package, agent, evidence, tracker, workflow, and report contracts are aligned.',
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
