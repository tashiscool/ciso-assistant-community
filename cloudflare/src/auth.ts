import type { WorkerRequestContext } from './router';
import {
  getSessionById,
  getSessionIdFromRequest,
  isSessionValid,
} from './session';

function getBearerIdentity(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export async function withAuth(baseCtx: WorkerRequestContext): Promise<WorkerRequestContext> {
  if (baseCtx.url.pathname === '/_api/core/session/exchange') {
    const headerCtx = resolveHeaderAuth(baseCtx);
    if (headerCtx.authStrategy === 'headers') {
      return headerCtx;
    }
  }

  const sessionId = getSessionIdFromRequest(baseCtx.request);
  if (!sessionId) {
    return resolveHeaderAuth(baseCtx);
  }

  try {
    const session = await getSessionById(baseCtx.env, sessionId);

    if (!session || !isSessionValid(session)) {
      return resolveHeaderAuth(baseCtx);
    }

    return {
      ...baseCtx,
      tenantId: session.tenant_id,
      userId: session.user_id,
      authStrategy: 'd1-session',
    };
  } catch (error) {
    console.warn('Session lookup failed', error);
    return resolveHeaderAuth(baseCtx);
  }
}

function resolveHeaderAuth(baseCtx: WorkerRequestContext): WorkerRequestContext {
  const tenantIdHeader = baseCtx.request.headers.get('x-tenant-id');
  const userIdHeader = baseCtx.request.headers.get('x-user-id');
  const bearerUserId = getBearerIdentity(baseCtx.request);
  const allowHeaderAuth =
    baseCtx.env.APP_ENV !== 'production' ||
    baseCtx.url.pathname === '/_api/core/session/exchange';

  if (allowHeaderAuth && tenantIdHeader && (userIdHeader || bearerUserId)) {
    return {
      ...baseCtx,
      tenantId: tenantIdHeader,
      userId: userIdHeader ?? bearerUserId,
      authStrategy: 'headers',
    };
  }

  return baseCtx;
}
