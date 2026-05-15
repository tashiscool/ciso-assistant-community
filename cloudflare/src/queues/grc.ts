import type { EnvBindings, GrcQueueMessage } from '../types/env';
import { resolveAiBackend } from '../services/grc-engine/aiBackend';
import {
  buildInternalContext,
  completeJobRun,
  createEvidencePackage,
  createExecutiveReport,
  createReportBundle,
  failJobRun,
  ingestFindingsCore,
  markJobRunRunning,
  runGrcNativeCollector,
} from '../services/grc-engine/http';
import { importCuratedSnapshot } from '../services/grc-engine/snapshot';
import { refreshScfCrosswalks } from '../services/grc-engine/scf';

type IngestPayloadRow = {
  payload_json: string;
};

type BundleRow = {
  id: string;
  title: string;
  manifest_json: string;
  narrative_summary: string | null;
  ai_provider: string | null;
};

function asJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function consumeGrcQueue(
  batch: MessageBatch<GrcQueueMessage>,
  env: EnvBindings,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const body = message.body;
    const userId = body.requestedBy ?? 'system';
    const tenantId = body.tenantId;
    const ctx = buildInternalContext(env);
    ctx.tenantId = tenantId;
    ctx.userId = userId;
    ctx.authStrategy = 'headers';

    try {
      if (body.jobId) {
        await markJobRunRunning(env, body.jobId);
      }
      switch (body.type) {
        case 'grc.content.import': {
          const imported = await importCuratedSnapshot(env);
          if (body.jobId) {
            await completeJobRun(env, body.jobId, {
              imported,
            });
          }
          break;
        }
        case 'grc.scf.refresh': {
          const refreshed = await refreshScfCrosswalks(env, body.frameworkIds);
          if (body.jobId) {
            await completeJobRun(env, body.jobId, refreshed);
          }
          break;
        }
        case 'grc.finding.ingest': {
          const payloadRow = await env.D1_MAIN.prepare(
            `
            SELECT payload_json
            FROM grc_ingest_payloads
            WHERE id = ? AND tenant_id = ?
            LIMIT 1
            `,
          )
            .bind(body.payloadId, tenantId)
            .first<IngestPayloadRow>();

          if (!payloadRow) {
            throw new Error(`GRC ingest payload ${body.payloadId} not found.`);
          }

          const ingested = await ingestFindingsCore(
            ctx,
            tenantId,
            userId,
            asJson(payloadRow.payload_json, {}),
            { persistPayload: false },
          );
          if (!ingested.ok) {
            const errorText = await ingested.response.text();
            throw new Error(errorText || 'Queued finding ingest failed.');
          }
          await env.D1_MAIN.prepare(
            `
            UPDATE grc_ingest_payloads
            SET status = 'completed',
                updated_at = ?
            WHERE id = ? AND tenant_id = ?
            `,
          )
            .bind(new Date().toISOString(), body.payloadId, tenantId)
            .run();
          if (body.jobId) {
            await completeJobRun(env, body.jobId, {
              payloadId: body.payloadId,
              insertedFindings: ingested.result.insertedFindings,
              connectorRuns: ingested.result.connectorRuns,
            });
          }
          break;
        }
        case 'grc.gap.report': {
          if (body.reportKind && body.reportKind !== 'gap-assessment') {
            const report = await createExecutiveReport(
              ctx,
              tenantId,
              userId,
              body.reportKind as 'exec-summary' | 'board-brief' | 'program-health' | 'automation-coverage',
              { assessmentId: body.assessmentId },
            );
            if (report instanceof Response) {
              const text = await report.text();
              throw new Error(text || 'Queued GRC report snapshot generation failed.');
            }
            const jobId = body.jobId;
            if (jobId) {
              await completeJobRun(
                env,
                jobId,
                {
                  reportId: report.id,
                  reportKind: report.reportKind,
                  title: report.title,
                },
                `grc-report-bundles/${tenantId}/${report.id}/${report.reportKind}.json`,
              );
            }
          } else {
            if (!body.assessmentId) {
              throw new Error('assessmentId is required for queued gap report generation.');
            }
            const bundle = await createReportBundle(ctx, tenantId, userId, body.assessmentId);
            if (!bundle) {
              throw new Error(`Gap assessment ${body.assessmentId} not found.`);
            }
            if (body.jobId) {
              await completeJobRun(
                env,
                body.jobId,
                {
                  reportBundleId: bundle.id,
                  title: bundle.title,
                },
                `grc-report-bundles/${tenantId}/${bundle.id}/manifest.json`,
              );
            }
          }
          break;
        }
        case 'grc.evidence.package': {
          const evidencePackage = await createEvidencePackage(ctx, tenantId, userId, body.assessmentId);
          if (!evidencePackage) {
            throw new Error(`Gap assessment ${body.assessmentId} not found.`);
          }
          if (body.jobId) {
            await completeJobRun(
              env,
              body.jobId,
              {
                assessmentId: body.assessmentId,
                evidencePackageId: evidencePackage.id,
                title: evidencePackage.title,
              },
              `grc-evidence-raw/${tenantId}/${evidencePackage.id}/manifest.json`,
            );
          }
          break;
        }
        case 'grc.ai.enrich': {
          const bundle = await env.D1_MAIN.prepare(
            `
            SELECT id, title, manifest_json, narrative_summary, ai_provider
            FROM grc_report_bundles
            WHERE tenant_id = ? AND id = ?
            LIMIT 1
            `,
          )
            .bind(tenantId, body.bundleId)
            .first<BundleRow>();
          if (!bundle) {
            throw new Error(`GRC report bundle ${body.bundleId} not found.`);
          }
          const aiBackend = await resolveAiBackend(env, tenantId);
          const manifest = asJson<Record<string, unknown>>(bundle.manifest_json, {});
          const enrichedNarrative =
            (await aiBackend.generateText({
              systemPrompt:
                'You enrich a compliance report bundle with a concise operator-ready narrative. Return markdown only.',
              userPrompt: JSON.stringify(manifest),
              maxTokens: 800,
            })) ??
            bundle.narrative_summary ??
            `# ${bundle.title}\n\nThe bundle is ready for downstream assurance, reporting, and compliance export workflows.`;
          await env.D1_MAIN.prepare(
            `
            UPDATE grc_report_bundles
            SET narrative_summary = ?,
                ai_provider = ?,
                updated_at = ?
            WHERE tenant_id = ? AND id = ?
            `,
          )
            .bind(enrichedNarrative, aiBackend.provider, new Date().toISOString(), tenantId, body.bundleId)
            .run();
          if (body.jobId) {
            await completeJobRun(env, body.jobId, {
              bundleId: body.bundleId,
              aiProvider: aiBackend.provider,
            });
          }
          break;
        }
        case 'grc.connector.collect': {
          const result = await runGrcNativeCollector(env, tenantId, userId, body.source, body.jobId);
          if (body.jobId) {
            await completeJobRun(env, body.jobId, result.run);
          }
          break;
        }
        default: {
          console.info('Unhandled GRC queue message acknowledged', {
            queue: batch.queue,
            type: (body as { type: string }).type,
          });
        }
      }

      message.ack();
    } catch (error) {
      if (body.type === 'grc.finding.ingest') {
        await env.D1_MAIN.prepare(
          `
          UPDATE grc_ingest_payloads
          SET status = 'failed',
              updated_at = ?
          WHERE id = ? AND tenant_id = ?
          `,
        )
          .bind(new Date().toISOString(), body.payloadId, tenantId)
          .run();
      }
      if (body.jobId) {
        await failJobRun(env, body.jobId, error instanceof Error ? error.message : 'GRC queue job failed.');
      }
      console.error('GRC queue message failed', {
        queue: batch.queue,
        type: body.type,
        error: error instanceof Error ? error.message : String(error),
      });
      message.ack();
    }
  }
}
