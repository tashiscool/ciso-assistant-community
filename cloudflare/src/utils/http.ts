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
  const text = await request.text();
  if (!text.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid JSON request body');
  }
}

export function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get('origin');

  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.append('vary', 'Origin');
  } else {
    headers.set('access-control-allow-origin', '*');
  }

  headers.set('access-control-allow-headers', API_HEADERS);
  headers.set('access-control-allow-methods', API_METHODS);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflight(request: Request): Response {
  return withCors(
    request,
    new Response(null, {
      status: 204,
    }),
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
