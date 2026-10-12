import type { EnvBindings } from './types/env';

export type SessionRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  created_at?: string;
  expires_at: string;
  ip_address?: string | null;
  user_agent?: string | null;
};

const SESSION_COOKIE_NAME = 'ca_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SESSION_DIGEST_PREFIX = 'sha256:';

export type CreatedSession = SessionRow & { token: string };

async function storedSessionId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return SESSION_DIGEST_PREFIX + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;

  const parts = cookie.split(/; */);
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (key === name && rest.length > 0) {
      try { return decodeURIComponent(rest.join('=')); }
      catch { return null; }
    }
  }

  return null;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getSessionIdFromRequest(request: Request): string | null {
  return getCookie(request, SESSION_COOKIE_NAME) ?? getCookie(request, 'session_id');
}

export function isSessionValid(session: Pick<SessionRow, 'expires_at'>): boolean {
  const expiresAt = Date.parse(session.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export async function getSessionById(
  env: EnvBindings,
  sessionId: string,
): Promise<SessionRow | null> {
  if (!sessionId || sessionId.length > 512 || sessionId.startsWith(SESSION_DIGEST_PREFIX)) return null;
  const digestId = await storedSessionId(sessionId);
  const lookup = async (id: string) => env.D1_MAIN.prepare(
    `
    SELECT session.id, session.user_id, session.tenant_id, session.created_at,
           session.expires_at, session.ip_address, session.user_agent
    FROM sessions AS session
    INNER JOIN users AS principal
      ON principal.id = session.user_id AND principal.tenant_id = session.tenant_id
    WHERE session.id = ? AND principal.is_active = 1
    LIMIT 1
    `,
  )
    .bind(id)
    .first<SessionRow>();
  const current = await lookup(digestId);
  if (current) return isSessionValid(current) ? current : null;

  // Keep existing cookies usable while removing their raw token from storage.
  const legacy = await lookup(sessionId);
  if (!legacy || !isSessionValid(legacy)) return null;
  await env.D1_MAIN.prepare(
    'UPDATE sessions SET id = ? WHERE id = ? AND user_id = ? AND tenant_id = ?',
  ).bind(digestId, sessionId, legacy.user_id, legacy.tenant_id).run();
  const migrated = await lookup(digestId);
  return migrated && isSessionValid(migrated) ? migrated : null;
}

export async function createSession(
  env: EnvBindings,
  request: Request,
  input: {
    tenantId: string;
    userId: string;
    ttlMs?: number;
    expectedPasswordHash?: string;
  },
): Promise<CreatedSession> {
  const ttlMs = input.ttlMs ?? SESSION_TTL_MS;
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > SESSION_TTL_MS) throw new RangeError('Invalid session lifetime.');
  if (input.expectedPasswordHash !== undefined && !/^[a-f0-9]{64}$/.test(input.expectedPasswordHash)) throw new RangeError('Invalid credential snapshot.');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  const sessionId = await storedSessionId(token);
  const ipAddress =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for') ??
    null;
  const userAgent = request.headers.get('user-agent');

  await env.D1_MAIN.prepare(
    `
    INSERT INTO sessions (
      id,
      user_id,
      tenant_id,
      created_at,
      expires_at,
      ip_address,
      user_agent
    ) SELECT ?, principal.id, principal.tenant_id, ?, ?, ?, ?
      FROM users AS principal
      WHERE principal.id = ? AND principal.tenant_id = ? AND principal.is_active = 1
      ${input.expectedPasswordHash ? 'AND EXISTS (SELECT 1 FROM local_password_credentials AS credential WHERE credential.user_id = principal.id AND credential.tenant_id = principal.tenant_id AND credential.password_hash = ?)' : ''}
    `,
  )
    .bind(
      sessionId,
      now.toISOString(),
      expiresAt,
      ipAddress,
      userAgent,
      input.userId,
      input.tenantId,
      ...(input.expectedPasswordHash ? [input.expectedPasswordHash] : []),
    )
    .run();

  const inserted = await env.D1_MAIN.prepare('SELECT id FROM sessions WHERE id = ? LIMIT 1').bind(sessionId).first<{ id: string }>();
  if (!inserted) throw Object.assign(new Error('The account or credential changed. Sign in again.'), { status: 401, code: 'session_principal_unavailable' });

  return {
    id: sessionId,
    token,
    user_id: input.userId,
    tenant_id: input.tenantId,
    created_at: now.toISOString(),
    expires_at: expiresAt,
    ip_address: ipAddress,
    user_agent: userAgent,
  };
}

export async function deleteSession(env: EnvBindings, sessionId: string): Promise<void> {
  if (!sessionId || sessionId.length > 512 || sessionId.startsWith(SESSION_DIGEST_PREFIX)) return;
  await env.D1_MAIN.prepare('DELETE FROM sessions WHERE id IN (?, ?)').bind(await storedSessionId(sessionId), sessionId).run();
}

export async function revokeUserSessions(env: EnvBindings, tenantId: string, userId: string): Promise<void> {
  await env.D1_MAIN.prepare('DELETE FROM sessions WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId).run();
}

export function buildSessionCookieHeader(
  sessionId: string,
  expiresAt: string,
  secure: boolean,
): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ];

  if (secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function buildClearedSessionCookieHeader(secure: boolean): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ];

  if (secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}
