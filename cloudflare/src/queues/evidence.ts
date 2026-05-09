import type { EnvBindings, EvidenceJobMessage } from '../types/env';
import {
  loadTrackerDiagnostics,
  persistNormalizedBundle,
  resolveBundleFromCollection,
  storeBundleArtifacts,
} from '../services/assurance/runtime';
import {
  acquireTenantLease,
  releaseTenantLease,
  updateTenantWorkflowRun,
} from '../utils/workflows';

type EvidenceJobRow = {
  status: string;
  folder_id: string | null;
  input_mode: string;
  bundle_kind: string;
  adapter_hints_json: string;
};

type EvidenceSourceRow = {
  id: string;
  name: string;
  provider: string;
  config_json: string;
};

export async function processEvidenceJob(
  payload: EvidenceJobMessage,
  env: EnvBindings,
  queueName = 'inline-replay',
): Promise<'success' | 'failed' | 'skipped'> {
  const leaseKey = `evidence:${payload.jobId}`;
  const workflowRunId = `evidence:${payload.jobId}`;
  let leaseAcquired = false;

  try {
    const job = await env.D1_MAIN.prepare(
      `
      SELECT status, folder_id, input_mode, bundle_kind, adapter_hints_json
      FROM evidence_jobs
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(payload.jobId, payload.tenantId)
      .first<EvidenceJobRow>();

    if (!job || job.status === 'success') {
      return 'skipped';
    }

    const lease = await acquireTenantLease(env, payload.tenantId, leaseKey, {
      queue: queueName,
      jobId: payload.jobId,
    });

    if (!lease.acquired) {
      return 'skipped';
    }
    leaseAcquired = true;

    await env.D1_MAIN.prepare(
      `
      UPDATE evidence_jobs
      SET status = 'running',
          status_detail = ?,
          started_at = ?,
          normalization_status = 'running',
          error_summary_json = '{}'
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(
        'Evidence collection is running in the queue consumer.',
        new Date().toISOString(),
        payload.jobId,
        payload.tenantId,
      )
      .run();
    await updateTenantWorkflowRun(env, payload.tenantId, {
      runId: workflowRunId,
      status: 'Running',
      detail: 'Evidence collection is running in the queue consumer.',
      metadata: {
        queue: queueName,
        sourceId: payload.sourceId,
      },
    }).catch((error) => {
      console.warn('Failed to update evidence workflow run to running', error);
    });

    const source = await env.D1_MAIN.prepare(
      `
      SELECT id, name, provider, config_json
      FROM evidence_sources
      WHERE id = ? AND tenant_id = ?
      LIMIT 1
      `,
    )
      .bind(payload.sourceId, payload.tenantId)
      .first<EvidenceSourceRow>();

    if (!source) {
      throw new Error(`Evidence source ${payload.sourceId} was not found.`);
    }

    const adapterHints = JSON.parse(job.adapter_hints_json || '{}') as Record<string, unknown>;
    const trackerImportId =
      job.input_mode === 'tracker'
        ? typeof adapterHints.importJobId === 'string'
          ? adapterHints.importJobId
          : null
        : null;
    const trackerDiagnostics = trackerImportId ? await loadTrackerDiagnostics(env, trackerImportId) : undefined;
    const { rawBundle, bundle } = await resolveBundleFromCollection({
      tenantId: payload.tenantId,
      folderId: job.folder_id,
      provider: source.provider,
      sourceName: source.name,
      inputMode: (job.input_mode as 'live' | 'fixture' | 'tracker') || 'live',
      bundleKind: (job.bundle_kind as 'assessment' | 'threat-hunt' | '20x' | 'tracker-to-20x') || 'assessment',
      sourceConfig: JSON.parse(source.config_json || '{}') as Record<string, unknown>,
      adapterHints,
      trackerDiagnostics,
    });

    await persistNormalizedBundle(
      {
        env,
        tenantId: payload.tenantId,
        folderId: job.folder_id,
        evidenceJobId: payload.jobId,
      },
      bundle,
    );
    const artifactState = await storeBundleArtifacts({
      env,
      tenantId: payload.tenantId,
      sourceId: payload.sourceId,
      jobId: payload.jobId,
      rawBundle,
      bundle,
    });

    await env.D1_MAIN.prepare(
      `
      UPDATE evidence_jobs
      SET status = 'success',
          status_detail = ?,
          finished_at = ?,
          manifest_key = ?,
          normalization_status = 'ready',
          coverage_json = ?,
          error_summary_json = ?
      WHERE id = ? AND tenant_id = ?
      `,
    )
      .bind(
        'Evidence collected, normalized, and persisted successfully.',
        new Date().toISOString(),
        artifactState.manifestKey,
        JSON.stringify(artifactState.coverage),
        JSON.stringify({
          trackerDiagnostics: trackerDiagnostics?.length ?? 0,
          inputMode: job.input_mode,
        }),
        payload.jobId,
        payload.tenantId,
      )
      .run();
    await updateTenantWorkflowRun(env, payload.tenantId, {
      runId: workflowRunId,
      status: 'Done',
      detail: `Evidence collection completed with ${artifactState.coverage.discoveredAssetCount} discovered asset(s) and ${artifactState.coverage.scannerFindingCount} finding(s).`,
      metadata: {
        coverage: artifactState.coverage,
        manifestKey: artifactState.manifestKey,
      },
    }).catch((error) => {
      console.warn('Failed to update evidence workflow run to done', error);
    });

    return 'success';
  } catch (error) {
    console.error('Evidence queue execution failed', error);

    await env.D1_MAIN.prepare(
      `
      UPDATE evidence_jobs
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
        payload.jobId,
        payload.tenantId,
      )
      .run();
    await updateTenantWorkflowRun(env, payload.tenantId, {
      runId: workflowRunId,
      status: 'Failed',
      detail: error instanceof Error ? error.message : 'Unknown queue consumer failure',
      metadata: {
        sourceId: payload.sourceId,
      },
    }).catch((workflowError) => {
      console.warn('Failed to update evidence workflow run to failed', workflowError);
    });

    return 'failed';
  } finally {
    if (leaseAcquired) {
      await releaseTenantLease(env, payload.tenantId, leaseKey).catch((leaseError) => {
        console.warn('Failed to release evidence lease', leaseError);
      });
    }
  }
}

export async function consumeEvidenceQueue(
  batch: MessageBatch<EvidenceJobMessage>,
  env: EnvBindings,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const result = await processEvidenceJob(message.body, env, batch.queue);
    if (result === 'failed') {
      message.retry();
      continue;
    }
    message.ack();
  }
}
