import { withAuth } from '../auth';
import { loadPermissionContext } from '../authorization';
import type { EnvBindings } from '../types/env';
import { handleServiceGateway, serviceJson, type ServiceEnvironment } from './runtime.mjs';

export function serviceEnvironment(env: EnvBindings): ServiceEnvironment {
  return { ...env, DB: env.D1_MAIN, BLOB: env.R2_EVIDENCE, PRODUCT_COMMANDS: env.QUEUE_EVIDENCE_JOBS,
    PRODUCT_COORDINATOR: env.SERVICE_COORDINATOR, SERVICE_ALLOWED_ORIGINS: 'https://regovise.com,https://www.regovise.com' };
}

export async function handleRegoviseService(request: Request, env: EnvBindings) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/service' && !url.pathname.startsWith('/api/service/')) return null;
  const mapped = serviceEnvironment(env);
  if (request.method === 'OPTIONS' || (request.method === 'GET' && url.pathname === '/api/service') || url.pathname.endsWith('/donations/webhook')) return handleServiceGateway(request, mapped, 'app-014');
  if (mapped.SERVICE_DELIVERY_ENABLED !== 'true') return serviceJson({ error: 'service_not_enabled' }, 503);
  const auth = await withAuth({ env, request, url, params: {}, tenantId: null, userId: null, authStrategy: 'anonymous' });
  if (auth.authStrategy !== 'd1-session' || !auth.userId || !auth.tenantId) return serviceJson({ error: 'verified_session_required' }, 401);
  const root = await env.D1_MAIN.prepare("SELECT id FROM folders WHERE tenant_id = ? AND content_type = 'root' AND parent_folder_id IS NULL LIMIT 1")
    .bind(auth.tenantId).first<{id: string}>();
  const permissions = root ? await loadPermissionContext(auth, { scopeFolderId: root.id }) : null;
  const operator = permissions && !(permissions instanceof Response) && permissions.permissions.includes('change_role');
  return handleServiceGateway(request, mapped, 'app-014', { tenantId: auth.tenantId, actorId: auth.userId, roles: operator ? ['service_operator'] : [] });
}
