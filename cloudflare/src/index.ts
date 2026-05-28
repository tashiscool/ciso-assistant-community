import { TenantWorkflowCoordinator } from './durable-objects/TenantWorkflowCoordinator';
import { consumeConMonQueue } from './queues/conmon';
import { consumeEvidenceQueue } from './queues/evidence';
import { consumeGrcQueue } from './queues/grc';
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

      if (url.pathname.startsWith('/_api/')) {
        return await handleRequest(request, env, ctx);
      }

      return await serveApplicationAsset(request, env);
    } catch (error) {
      console.error('Unhandled error in Worker', error);
      return json(
        {
          error: 'internal_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  },

  async queue(
    batch: MessageBatch<QueueMessagePayload>,
    env: EnvBindings,
    ctx: ExecutionContext,
  ): Promise<void> {
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
      default:
        console.warn(`No queue consumer registered for ${batch.queue}`);
        batch.ackAll();
    }
  },
};
