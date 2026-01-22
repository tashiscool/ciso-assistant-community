/**
 * API Client Wrapper
 *
 * Provides a simple fetch-based API client for making HTTP requests.
 * Used by the service modules for DDD bounded context API calls.
 */

import { base } from '$app/paths';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    results: T[];
    count: number;
    next: string | null;
    previous: string | null;
  };
  message?: string;
}

interface RequestConfig {
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      data: errorData as T,
      message: errorData.detail || errorData.message || `HTTP ${response.status}: ${response.statusText}`
    };
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {
      success: true,
      data: null as T
    };
  }

  const data = await response.json();
  return {
    success: true,
    data
  };
}

function buildUrl(path: string, params?: Record<string, any>): string {
  const url = new URL(`${base}/api${path}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

function getDefaultHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json'
  };
}

export const api = {
  async get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const url = buildUrl(path, config?.params);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...getDefaultHeaders(),
        ...config?.headers
      },
      credentials: 'include'
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const url = buildUrl(path, config?.params);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getDefaultHeaders(),
        ...config?.headers
      },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const url = buildUrl(path, config?.params);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...getDefaultHeaders(),
        ...config?.headers
      },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const url = buildUrl(path, config?.params);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...getDefaultHeaders(),
        ...config?.headers
      },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const url = buildUrl(path, config?.params);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...getDefaultHeaders(),
        ...config?.headers
      },
      credentials: 'include'
    });
    return handleResponse<T>(response);
  },

  async upload<T>(path: string, formData: FormData, config?: RequestConfig): Promise<ApiResponse<T>> {
    const url = buildUrl(path, config?.params);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData - browser will set it with boundary
        ...config?.headers
      },
      credentials: 'include',
      body: formData
    });
    return handleResponse<T>(response);
  }
};
