export {
  ApiError,
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredToken,
} from './storage';
export type { LoginResponse } from './storage';

import {
  ApiError,
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredToken,
} from './storage';
import { API_BASE_URL } from './storage';

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text();
  let message = text || `Request failed with ${response.status}`;
  try {
    const body = JSON.parse(text) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // Body is not JSON — use the raw text as the error message.
  }
  return new ApiError(message, response.status);
}

let inFlightRefresh: Promise<boolean> | null = null;

async function performTokenRefresh(): Promise<boolean> {
  if (!getStoredRefreshToken()) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getStoredRefreshToken() }),
    });

    if (!response.ok) {
      clearStoredToken();
      return false;
    }

    const data = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    setStoredToken(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearStoredToken();
    return false;
  }
}

// Dedup concurrent refreshes so N parallel 401s share one /auth/refresh call.
async function attemptTokenRefresh(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = performTokenRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  includeAuth: boolean | string = true,
): Promise<T> {
  let token: string | null = null;
  if (typeof includeAuth === 'string') {
    token = includeAuth;
  } else if (includeAuth) {
    token = getStoredToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      includeAuth === true &&
      path !== '/auth/refresh'
    ) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${getStoredToken()}`,
        };
        const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: retryHeaders,
        });
        if (retryResponse.ok) {
          return parseResponse<T>(retryResponse);
        }
        throw await parseError(retryResponse);
      }
    }

    throw await parseError(response);
  }

  return parseResponse<T>(response);
}
