import { handleCoreRoutes } from './services/core/http';
import { handleConMonRoutes } from './services/conmon/http';
import { handleEvidenceRoutes } from './services/evidence/http';
import { handleIamRoutes } from './services/iam/http';
import { handleIntegrationRoutes } from './services/integrations/http';
import { handleOpsRoutes } from './services/ops/http';
import { handleBuilderRoutes } from './services/builders/http';
import { handleAiRoutes } from './services/ai/http';
import { handleSetupRoutes } from './services/setup/http';
import { withAuth } from './auth';
import type { AuthStrategy, EnvBindings } from './types/env';
import { corsPreflight, json, withCors } from './utils/http';

export type WorkerRequestContext = {
  env: EnvBindings;
  request: Request;
  url: URL;
  params: Record<string, string>;
  tenantId: string | null;
  userId: string | null;
  authStrategy: AuthStrategy;
};

export async function handleRequest(
  request: Request,
  env: EnvBindings,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return corsPreflight(request);
  }

  const url = new URL(request.url);

  // Basic API prefix check
  if (!url.pathname.startsWith('/_api/')) {
    return withCors(request, new Response('Not Found', { status: 404 }));
  }

  const segments = url.pathname.slice('/_api/'.length).split('/').filter(Boolean);
  const [service, ...rest] = segments;

  const unauthenticatedCtx: WorkerRequestContext = {
    env,
    request,
    url,
    params: {},
    tenantId: null,
    userId: null,
    authStrategy: 'anonymous',
  };

  const baseCtx = await withAuth(unauthenticatedCtx);

  let response: Response;

  try {
    switch (service) {
      case 'core':
        response = await handleCoreRoutes(rest, baseCtx);
        break;
      case 'conmon':
        response = await handleConMonRoutes(rest, baseCtx);
        break;
      case 'evidence':
        response = await handleEvidenceRoutes(rest, baseCtx);
        break;
      case 'iam':
        response = await handleIamRoutes(rest, baseCtx);
        break;
      case 'integrations':
        response = await handleIntegrationRoutes(rest, baseCtx);
        break;
      case 'ops':
        response = await handleOpsRoutes(rest, baseCtx);
        break;
      case 'builders':
        response = await handleBuilderRoutes(rest, baseCtx);
        break;
      case 'ai':
        response = await handleAiRoutes(rest, baseCtx);
        break;
      case 'setup':
        response = await handleSetupRoutes(rest, baseCtx);
        break;
      default:
        response = json({ error: 'unknown_service', service }, { status: 404 });
        break;
    }
  } catch (error) {
    console.error('Worker request failed', error);
    response = json(
      {
        error: 'request_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }

  return withCors(request, response);
}
