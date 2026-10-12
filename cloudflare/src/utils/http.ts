import type { EnvBindings } from '../types/env';

const API_HEADERS = 'content-type, x-tenant-id, x-user-id, authorization';
const API_METHODS = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS';

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(data), {
    status: init.status,
    statusText: init.statusText,
    headers,
  });
}

export function methodNotAllowed(methods: string[]): Response {
  return json(
    {
      error: 'method_not_allowed',
      allow: methods,
    },
    {
      status: 405,
      headers: {
        Allow: methods.join(', '),
      },
    },
  );
}

export async function readJson<T>(request: Request): Promise<T> {
  const limit = 1_048_576;
  const reader = request.body?.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false });
  let text = '';
  let bytes = 0;
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > limit) {
          await reader.cancel();
          throw Object.assign(new Error('JSON request body exceeds the size limit.'), { status: 413, code: 'request_body_too_large' });
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) throw error;
    throw Object.assign(new Error('Request body must contain valid UTF-8 JSON.'), { status: 400, code: 'invalid_json' });
  } finally { reader?.releaseLock(); }
  if (!text.trim()) {
    return {} as T;
  }

  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
    return value as T;
  } catch {
    throw Object.assign(new Error('Request body must contain a JSON object.'), { status: 400, code: 'invalid_json' });
  }
}

export function isAllowedMutationOrigin(request: Request, env: Pick<EnvBindings, 'APP_ENV' | 'APP_ORIGIN'>): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';
  if (isAllowedCorsOrigin(request, env)) return true;
  try {
    const target = new URL(request.url);
    return origin === target.origin && (target.protocol === 'https:' || env.APP_ENV === 'development');
  } catch { return false; }
}

export function isAllowedCorsOrigin(request: Request, env: Pick<EnvBindings, 'APP_ENV' | 'APP_ORIGIN'>): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.username || parsed.password) return false;
    if (env.APP_ORIGIN) {
      const configured = new URL(env.APP_ORIGIN);
      if (configured.origin === origin && (env.APP_ENV === 'development' || configured.protocol === 'https:')) return true;
    }
    return env.APP_ENV === 'development' && ['http:', 'https:'].includes(parsed.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  } catch { return false; }
}

export function withCors(request: Request, response: Response, env: Pick<EnvBindings, 'APP_ENV' | 'APP_ORIGIN'>): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get('origin');

  headers.delete('access-control-allow-origin');
  headers.delete('access-control-allow-credentials');
  headers.append('vary', 'Origin');
  if (origin && isAllowedCorsOrigin(request, env)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
  }

  headers.set('access-control-allow-headers', API_HEADERS);
  headers.set('access-control-allow-methods', API_METHODS);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflight(request: Request, env: Pick<EnvBindings, 'APP_ENV' | 'APP_ORIGIN'>): Response {
  return withCors(
    request,
    new Response(null, {
      status: 204,
    }),
    env,
  );
}

export async function serveApplicationAsset(
  request: Request,
  env: EnvBindings,
): Promise<Response> {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  const url = new URL(request.url);
  const looksLikeStaticAsset = /\.[a-zA-Z0-9]+$/.test(url.pathname);
  if (looksLikeStaticAsset) {
    return assetResponse;
  }

  const indexUrl = new URL('/index.html', request.url);
  return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
}
