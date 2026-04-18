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

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;

  const parts = cookie.split(/; */);
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (key === name && rest.length > 0) {
      return decodeURIComponent(rest.join('='));
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
  return env.D1_MAIN.prepare(
    `
    SELECT id, user_id, tenant_id, created_at, expires_at, ip_address, user_agent
    FROM sessions
    WHERE id = ?
    LIMIT 1
    `,
  )
    .bind(sessionId)
    .first<SessionRow>();
}

export async function createSession(
  env: EnvBindings,
  request: Request,
  input: {
    tenantId: string;
    userId: string;
    ttlMs?: number;
  },
): Promise<SessionRow> {
  const ttlMs = input.ttlMs ?? SESSION_TTL_MS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  const sessionId = crypto.randomUUID();
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      sessionId,
      input.userId,
      input.tenantId,
      now.toISOString(),
      expiresAt,
      ipAddress,
      userAgent,
    )
    .run();

  return {
    id: sessionId,
    user_id: input.userId,
    tenant_id: input.tenantId,
    created_at: now.toISOString(),
    expires_at: expiresAt,
    ip_address: ipAddress,
    user_agent: userAgent,
  };
}

export async function deleteSession(env: EnvBindings, sessionId: string): Promise<void> {
  await env.D1_MAIN.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
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
