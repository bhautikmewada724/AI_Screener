export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

interface RequestOptions extends RequestInit {
  token?: string;
  skipJson?: boolean;
}

const inferErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    return payload?.message || response.statusText;
  } catch {
    return response.statusText;
  }
};

export const apiRequest = async <T = unknown>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { token, skipJson, headers, body, ...rest } = options;
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(headers || {})
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    ...rest,
    headers: requestHeaders,
    body
  });

  if (!response.ok) {
    const message = await inferErrorMessage(response);
    throw new Error(message || 'Request failed');
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


