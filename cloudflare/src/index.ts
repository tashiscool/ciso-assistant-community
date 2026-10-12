import { TenantWorkflowCoordinator } from './durable-objects/TenantWorkflowCoordinator';
import { handleRegoviseService, serviceEnvironment } from './service-delivery/adapter';
import { consumeServiceBatch, runServiceSweep } from './service-delivery/runtime.mjs';
export { DonationServiceCoordinator } from './service-delivery/runtime.mjs';
import { consumeConMonQueue } from './queues/conmon';
import { consumeEvidenceQueue } from './queues/evidence';
import { consumeGrcQueue } from './queues/grc';
import { consumeDeadLetterQueue, DEAD_LETTER_QUEUE } from './queues/deadLetter';
import { handleRequest } from './router';
import type {
  ConMonJobMessage,
  EnvBindings,
  EvidenceJobMessage,
  GrcQueueMessage,
  QueueMessagePayload,
} from './types/env';
import { json, serveApplicationAsset } from './utils/http';

export { TenantWorkflowCoordinator };

export default {
  async fetch(request: Request, env: EnvBindings, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const service = await handleRegoviseService(request, env);
      if (service) return service;

      if (url.pathname.startsWith('/_api/')) {
        return await handleRequest(request, env, ctx);
      }

      return await serveApplicationAsset(request, env);
    } catch (error) {
      console.error('Unhandled error in Worker', error);
      return json(
        {
          error: 'internal_error',
          message: env.APP_ENV === 'development' && error instanceof Error ? error.message : 'The request could not be completed.',
        },
        { status: 500, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } },
      );
    }
  },

  async queue(
    batch: MessageBatch<QueueMessagePayload>,
    env: EnvBindings,
    ctx: ExecutionContext,
  ): Promise<void> {
    batch = await consumeServiceBatch(serviceEnvironment(env), 'app-014', batch);
    if (!batch.messages.length) return;
    switch (batch.queue) {
      case 'ciso-assistant-evidence-jobs':
        await consumeEvidenceQueue(batch as MessageBatch<EvidenceJobMessage>, env, ctx);
        return;
      case 'ciso-assistant-conmon-jobs':
        await consumeConMonQueue(batch as MessageBatch<ConMonJobMessage>, env, ctx);
        return;
      case 'ciso-assistant-grc-content-import':
      case 'ciso-assistant-grc-scf-refresh':
      case 'ciso-assistant-grc-finding-ingest':
      case 'ciso-assistant-grc-gap-report':
      case 'ciso-assistant-grc-ai-enrich':
        await consumeGrcQueue(batch as unknown as MessageBatch<GrcQueueMessage>, env, ctx);
        return;
      case DEAD_LETTER_QUEUE:
        await consumeDeadLetterQueue(batch, env);
        return;
      default:
        console.warn(`No queue consumer registered for ${batch.queue}`);
        batch.retryAll();
    }
  },
  async scheduled(_event: ScheduledController, env: EnvBindings): Promise<void> {
    await runServiceSweep(serviceEnvironment(env), 'app-014');
  },
};
