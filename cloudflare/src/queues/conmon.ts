import type { EnvBindings, ConMonJobMessage } from '../types/env';
import {
  buildConMonReasonablenessArtifact,
  summarizeConMonMetrics,
} from '../services/assurance/conmonReasonableness';
import {
  loadEvaluationArtifacts,
  loadNormalizedBundle,
  loadPackageSummary,
} from '../services/assurance/runtime';
import {
  acquireTenantLease,
  releaseTenantLease,
  updateTenantWorkflowRun,
} from '../utils/workflows';

type ConMonExecutionRow = {
  status: string;
  folder_id: string | null;
};

type ConMonProfileRow = {
  id: string;
  name: string;
  profile_type: string;
};

type ConMonActivityRow = {
  id: string;
  name: string;
  cadence: string;
  theme: string | null;
  control_ref: string | null;
  config_json: string;
};

type LatestEvidenceJobRow = {
  id: string;
};

type PendingReviewRow = {
  pending_count: number | null;
};

function metricId(executionId: string, key: string): string {
  return `${executionId}:${key}`;
}

export async function processConMonExecution(
  payload: ConMonJobMessage,
  env: EnvBindings,
  queueName = 'inline-replay',
): Promise<'success' | 'failed' | 'skipped'> {
  const leaseKey = `conmon:${payload.executionId}`;
  let leaseAcquired = false;

  try {
    const execution = await env.D1_MAIN.prepare(
      `
      SELECT status, folder_id
      FROM conmon_executions
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(payload.executionId, payload.tenantId)
      .first<ConMonExecutionRow>();

    if (!execution || execution.status === 'success') {
      return 'skipped';
    }

    const lease = await acquireTenantLease(env, payload.tenantId, leaseKey, {
      queue: queueName,
      executionId: payload.executionId,
    });

    if (!lease.acquired) {
      return 'skipped';
    }
    leaseAcquired = true;

    await env.D1_MAIN.prepare(
      `
      UPDATE conmon_executions
      SET status = 'running',
          status_detail = ?,
          raw_stats_json = ?,
          normalization_status = 'running',
          error_summary_json = '{}'
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(
        'Continuous monitoring execution is running in the queue consumer.',
        JSON.stringify({
          requestedBy: payload.requestedBy,
          queue: queueName,
        }),
        payload.executionId,
        payload.tenantId,
      )
      .run();
    await updateTenantWorkflowRun(env, payload.tenantId, {
      runId: payload.executionId,
      status: 'Running',
      detail: 'Continuous monitoring execution is running in the queue consumer.',
      metadata: {
        profileId: payload.profileId,
        activityId: payload.activityId,
        queue: queueName,
      },
    }).catch((error) => {
      console.warn('Failed to update ConMon workflow run to running', error);
    });

    const [profile, activity] = await Promise.all([
      env.D1_MAIN.prepare(
        `
        SELECT id, name, profile_type
        FROM conmon_profiles
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(payload.tenantId, payload.profileId)
        .first<ConMonProfileRow>(),
      env.D1_MAIN.prepare(
        `
        SELECT id, name, cadence, theme, control_ref, config_json
        FROM conmon_activity_configs
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
        `,
      )
        .bind(payload.tenantId, payload.activityId)
        .first<ConMonActivityRow>(),
    ]);

    if (!profile || !activity) {
      throw new Error('The selected ConMon profile or activity configuration could not be found.');
    }

    const latestEvidenceJob = await env.D1_MAIN.prepare(
      `
      SELECT id
      FROM evidence_jobs
      WHERE tenant_id = ? AND status = 'success'
      ORDER BY COALESCE(finished_at, updated_at, scheduled_for) DESC
      LIMIT 1
      `,
    )
      .bind(payload.tenantId)
      .first<LatestEvidenceJobRow>();

    const bundle = latestEvidenceJob ? await loadNormalizedBundle(env, latestEvidenceJob.id) : null;
    const assurance = latestEvidenceJob ? await loadEvaluationArtifacts(env, latestEvidenceJob.id) : null;
    const latestPackageId = latestEvidenceJob
      ? (
          await env.D1_MAIN.prepare(
            `
            SELECT id
            FROM ai_compliance_export_jobs
            WHERE tenant_id = ? AND source_record = ? AND run_family = 'assurance_package'
            ORDER BY created_at DESC
            LIMIT 1
            `,
          )
            .bind(payload.tenantId, latestEvidenceJob.id)
            .first<{ id: string }>()
        )?.id ?? null
      : null;
    const packageState = latestPackageId ? await loadPackageSummary(env, payload.tenantId, latestPackageId) : null;
    const pendingReviewCount =
      (
        await env.D1_MAIN.prepare(
          `
          SELECT COUNT(*) AS pending_count
          FROM assurance_review_recommendations
          WHERE tenant_id = ? AND status = 'pending'
          `,
        )
          .bind(payload.tenantId)
          .first<PendingReviewRow>()
      )?.pending_count ?? 0;

    const reasonablenessArtifact = buildConMonReasonablenessArtifact({
      profileId: profile.id,
      profileName: profile.name,
      activityId: activity.id,
      activityName: activity.name,
      cadence: activity.cadence,
      theme: activity.theme,
      controlRef: activity.control_ref,
      bundle,
      artifacts: assurance,
      packageJobId: latestPackageId,
      reconciliation: packageState?.reconciliation ?? null,
      reviewBacklogCount: Number(pendingReviewCount),
    });

    const metricsSummary = summarizeConMonMetrics(reasonablenessArtifact);
    const metrics = Object.entries(metricsSummary).map(([key, value]) => ({
      key,
      value,
    }));

    for (const metric of metrics) {
      await env.D1_MAIN.prepare(
        `
        INSERT OR REPLACE INTO conmon_metrics (
          id,
          tenant_id,
          profile_id,
          execution_id,
          metric_key,
          metric_value,
          recorded_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
        .bind(
          metricId(payload.executionId, metric.key),
          payload.tenantId,
          payload.profileId,
          payload.executionId,
          metric.key,
          metric.value,
          new Date().toISOString(),
        )
        .run();
    }

    const reasonablenessArtifactKey = `${payload.tenantId}/conmon/${payload.profileId}/${payload.executionId}/reasonableness.json`;
    const manifestKey = `${payload.tenantId}/conmon/${payload.profileId}/${payload.executionId}/manifest.json`;

    await Promise.all([
      env.R2_EVIDENCE.put(reasonablenessArtifactKey, JSON.stringify(reasonablenessArtifact, null, 2), {
        httpMetadata: {
          contentType: 'application/json',
        },
      }),
      env.R2_EVIDENCE.put(
        manifestKey,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            families: [{ family: 'reasonableness_findings', path: reasonablenessArtifactKey }],
          },
          null,
          2,
        ),
        {
          httpMetadata: {
            contentType: 'application/json',
          },
        },
      ),
    ]);

    await env.D1_MAIN.prepare(
      `
      UPDATE conmon_executions
      SET status = 'success',
          status_detail = ?,
          finished_at = ?,
          metrics_json = ?,
          raw_stats_json = ?,
          manifest_key = ?,
          normalization_status = 'ready',
          coverage_json = ?,
          error_summary_json = '{}'
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(
        reasonablenessArtifact.findings.length > 0
          ? 'Execution completed with reasonableness findings that still require review.'
          : 'Execution completed successfully in the Cloudflare queue consumer.',
        new Date().toISOString(),
        JSON.stringify(metricsSummary),
        JSON.stringify({
          cadence: 'queue',
          activityId: payload.activityId,
          requestedBy: payload.requestedBy,
          linkedEvidenceJobId: reasonablenessArtifact.linkedEvidenceJobId,
          linkedPackageJobId: reasonablenessArtifact.linkedPackageJobId,
        }),
        manifestKey,
        JSON.stringify({
          executionMetrics: metricsSummary,
          reasonablenessStatus: reasonablenessArtifact.findings.length > 0 ? 'PARTIAL' : 'PASS',
          linkedEvidenceJobId: reasonablenessArtifact.linkedEvidenceJobId,
          linkedPackageJobId: reasonablenessArtifact.linkedPackageJobId,
        }),
        payload.executionId,
        payload.tenantId,
      )
      .run();
    await updateTenantWorkflowRun(env, payload.tenantId, {
      runId: payload.executionId,
      status: reasonablenessArtifact.findings.length > 0 ? 'Awaiting Review' : 'Done',
      detail: `ConMon execution evaluated ${reasonablenessArtifact.summary.obligations} obligation(s) with ${reasonablenessArtifact.findings.length} reasonableness finding(s).`,
      metadata: {
        profileId: payload.profileId,
        activityId: payload.activityId,
        reasonablenessStatus: reasonablenessArtifact.findings.length > 0 ? 'PARTIAL' : 'PASS',
        linkedEvidenceJobId: reasonablenessArtifact.linkedEvidenceJobId,
        linkedPackageJobId: reasonablenessArtifact.linkedPackageJobId,
      },
    }).catch((error) => {
      console.warn('Failed to update ConMon workflow run to done', error);
    });

    return 'success';
  } catch (error) {
    console.error('ConMon queue execution failed', error);

    await env.D1_MAIN.prepare(
      `
      UPDATE conmon_executions
      SET status = 'failed',
          status_detail = ?,
          finished_at = ?,
          normalization_status = 'failed',
          error_summary_json = ?
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(
        error instanceof Error ? error.message : 'Unknown queue consumer failure',
        new Date().toISOString(),
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown queue consumer failure',
        }),
        payload.executionId,
        payload.tenantId,
      )
      .run();
    await updateTenantWorkflowRun(env, payload.tenantId, {
      runId: payload.executionId,
      status: 'Failed',
      detail: error instanceof Error ? error.message : 'Unknown queue consumer failure',
      metadata: {
        profileId: payload.profileId,
        activityId: payload.activityId,
      },
    }).catch((workflowError) => {
      console.warn('Failed to update ConMon workflow run to failed', workflowError);
    });

    return 'failed';
  } finally {
    if (leaseAcquired) {
      await releaseTenantLease(env, payload.tenantId, leaseKey).catch((leaseError) => {
        console.warn('Failed to release ConMon lease', leaseError);
      });
    }
  }
}

export async function consumeConMonQueue(
  batch: MessageBatch<ConMonJobMessage>,
  env: EnvBindings,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const result = await processConMonExecution(message.body, env, batch.queue);
    if (result === 'failed') {
      message.retry();
      continue;
    }
    message.ack();
  }
}
