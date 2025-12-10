const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set');
}

export interface LoginResponse {
  accessToken: string;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  includeAuth = true,
): Promise<T> {
  const token = includeAuth ? localStorage.getItem('linklater_token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token && includeAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function register(email: string, password: string) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
}

export async function login(email: string, password: string) {
  const data = await apiFetch<LoginResponse>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false,
  );

  localStorage.setItem('linklater_token', data.accessToken);
  return data;
}

export function logout() {
  localStorage.removeItem('linklater_token');
}

export async function getMe() {
  return apiFetch<{ userId: string; email: string }>('/auth/me', {
    method: 'GET',
  });
}
