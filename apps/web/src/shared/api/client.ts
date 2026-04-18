import { getEdgeAuthMode, getEdgeIdentity } from '../session/identity';

export type ApiClientOptions = {
  baseUrl?: string;
};

export class ApiClient {
  private baseUrl: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/_api';
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const identity = getEdgeIdentity();
    const authMode = getEdgeAuthMode();
    const headers: HeadersInit = {
      'content-type': 'application/json',
    };

    if (authMode === 'headers' && identity.tenantId) {
      headers['x-tenant-id'] = identity.tenantId;
    }

    if (authMode === 'headers' && identity.userId) {
      headers['x-user-id'] = identity.userId;
    }

    const res = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (text) {
        let payload: { message?: string; error?: string } | null = null;
        try {
          payload = JSON.parse(text) as { message?: string; error?: string };
        } catch {}

        if (typeof payload?.message === 'string' && payload.message.trim()) {
          throw new Error(payload.message);
        }
        if (typeof payload?.error === 'string' && payload.error.trim()) {
          throw new Error(payload.error);
        }
      }

      throw new Error(text || `Request failed: ${res.status}`);
    }

    return (await res.json()) as T;
  }
}
