/// <reference types="vite/client" />

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

interface RequestOptions extends RequestInit {
  token?: string;
  skipJson?: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const pickErrorMessage = (status: number, payload: any, fallback: string) => {
  const explicit = payload?.message || payload?.detail?.message || payload?.detail || payload?.error;
  if (explicit) return String(explicit);

  if (status === 400) return 'Invalid request. Please check your input.';
  if (status === 401) return 'You need to sign in to continue.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'Not found.';
  if (status === 429) return 'Too many requests. Please try again later.';
  if (status === 502 || status === 503 || status === 504) return 'Service temporarily unavailable. Please try again.';
  return fallback || 'Request failed.';
};

export const apiRequest = async <T = unknown>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { token, skipJson, headers, body, ...rest } = options;
  const requestHeaders = new Headers(headers);

  // Only set JSON header when the caller isn't sending FormData.
  if (!(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    ...rest,
    headers: requestHeaders,
    body
  });

  if (!response.ok) {
    let payload: any = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    const message = pickErrorMessage(response.status, payload, response.statusText);
    const code = payload?.code || payload?.error;
    throw new ApiError(message, response.status, code, payload);
  }

  if (skipJson || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const withQuery = (path: string, params: Record<string, string | number | undefined>) => {
  const query = Object.entries(params)
    .filter(([, value]) => typeof value !== 'undefined' && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${path}?${query}` : path;
};


