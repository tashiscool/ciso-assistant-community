import type { EnvBindings } from '../../types/env';

type CountRow = {
  count: number | string;
};

type NameRow = {
  name: string | null;
};

type ArtifactRow = {
  object_key: string;
};

type AssignmentRow = {
  name: string;
  status: string;
};

export type TenantAiContext = {
  organizationName: string;
  primaryFramework: string;
  domains: string[];
  metrics: {
    riskAssessments: number;
    processings: number;
    rightRequests: number;
    dataBreaches: number;
    entities: number;
    portalAssignments: number;
    ebiosStudies: number;
    quantitativeStudies: number;
    controls: number;
    components: number;
    policies: number;
    questionnaires: number;
    securityPlans: number;
    evidenceArtifacts: number;
    reportExports: number;
    importJobs: number;
    conmonExecutions: number;
  };
  samples: {
    policies: string[];
    questionnaires: string[];
    securityPlans: string[];
    evidenceArtifacts: string[];
    entities: string[];
    portalAssignments: string[];
    riskAssessments: string[];
    processings: string[];
    rightRequests: string[];
    dataBreaches: string[];
  };
};

function toCount(row: CountRow | null | undefined) {
  return Number(row?.count ?? 0);
}

function toNames(rows: Array<NameRow> | undefined | null) {
  return (rows ?? [])
    .map((row) => row.name?.trim() ?? '')
    .filter((value) => value.length > 0);
}

export async function buildTenantAiContext(
  env: EnvBindings,
  tenantId: string,
): Promise<TenantAiContext> {
  const [
    domainRows,
    frameworkRow,
    policyCountRow,
    questionnaireCountRow,
    securityPlanCountRow,
    evidenceCountRow,
    entityCountRow,
    portalAssignmentCountRow,
    riskAssessmentCountRow,
    processingCountRow,
    rightRequestCountRow,
    dataBreachCountRow,
    ebiosCountRow,
    quantitativeCountRow,
    controlsCountRow,
    componentsCountRow,
    reportExportCountRow,
    importJobCountRow,
    conmonExecutionCountRow,
    policyRows,
    questionnaireRows,
    securityPlanRows,
    artifactRows,
    entityRows,
    assignmentRows,
    riskAssessmentRows,
    processingRows,
    rightRequestRows,
    dataBreachRows,
  ] = await Promise.all([
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM folders
      WHERE tenant_id = ? AND content_type = 'domain'
      ORDER BY created_at ASC
      LIMIT 5
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM frameworks
      WHERE tenant_id = ?
      ORDER BY created_at ASC
      LIMIT 1
      `,
    )
      .bind(tenantId)
      .first<NameRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM libraries WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM questionnaire_templates WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM compliance_assessments WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM evidence_artifacts WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM entities WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM portal_assignments WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM risk_assessments WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM processings WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM right_requests WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM data_breaches WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM ebios_studies WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM quantitative_studies WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM applied_controls WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM solutions WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM report_exports WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM import_jobs WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(`SELECT COUNT(*) AS count FROM conmon_executions WHERE tenant_id = ?`).bind(tenantId).first<CountRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM libraries
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM questionnaire_templates
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM compliance_assessments
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT object_key
      FROM evidence_artifacts
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<ArtifactRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM entities
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name, status
      FROM portal_assignments
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<AssignmentRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM risk_assessments
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM processings
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM right_requests
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
    env.D1_MAIN.prepare(
      `
      SELECT name
      FROM data_breaches
      WHERE tenant_id = ?
      ORDER BY updated_at DESC, name ASC
      LIMIT 4
      `,
    )
      .bind(tenantId)
      .all<NameRow>(),
  ]);

  return {
    organizationName: toNames(domainRows.results)[0] ?? 'Workspace',
    primaryFramework: frameworkRow?.name?.trim() || 'Framework not configured',
    domains: toNames(domainRows.results),
    metrics: {
      riskAssessments: toCount(riskAssessmentCountRow),
      processings: toCount(processingCountRow),
      rightRequests: toCount(rightRequestCountRow),
      dataBreaches: toCount(dataBreachCountRow),
      entities: toCount(entityCountRow),
      portalAssignments: toCount(portalAssignmentCountRow),
      ebiosStudies: toCount(ebiosCountRow),
      quantitativeStudies: toCount(quantitativeCountRow),
      controls: toCount(controlsCountRow),
      components: toCount(componentsCountRow),
      policies: toCount(policyCountRow),
      questionnaires: toCount(questionnaireCountRow),
      securityPlans: toCount(securityPlanCountRow),
      evidenceArtifacts: toCount(evidenceCountRow),
      reportExports: toCount(reportExportCountRow),
      importJobs: toCount(importJobCountRow),
      conmonExecutions: toCount(conmonExecutionCountRow),
    },
    samples: {
      policies: toNames(policyRows.results),
      questionnaires: toNames(questionnaireRows.results),
      securityPlans: toNames(securityPlanRows.results),
      evidenceArtifacts: (artifactRows.results ?? []).map((row) => row.object_key.split('/').pop() ?? row.object_key),
      entities: toNames(entityRows.results),
      portalAssignments: (assignmentRows.results ?? []).map((row) => `${row.name} (${row.status})`),
      riskAssessments: toNames(riskAssessmentRows.results),
      processings: toNames(processingRows.results),
      rightRequests: toNames(rightRequestRows.results),
      dataBreaches: toNames(dataBreachRows.results),
    },
  };
}
