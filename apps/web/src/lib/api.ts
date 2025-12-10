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

export interface Link {
  id: string;
  url: string;
  title: string;
  host: string;
  notes?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getLinks(options?: {
  search?: string;
  archived?: boolean;
}): Promise<Link[]> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.archived !== undefined) {
    params.set('archived', options.archived ? 'true' : 'false');
  }

  const query = params.toString();
  const path = query ? `/links?${query}` : '/links';

  return apiFetch<Link[]>(path);
}

export async function createLink(input: {
  url: string;
  title?: string;
  notes?: string;
}): Promise<Link> {
  return apiFetch<Link>('/links', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateLink(
  id: string,
  input: { title?: string; notes?: string },
): Promise<Link> {
  return apiFetch<Link>(`/links/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function archiveLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/archive`, {
    method: 'POST',
  });
}

export async function deleteLink(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/links/${id}`, {
    method: 'DELETE',
  });
}

export async function getRandomLink(options?: {
  archived?: boolean;
}): Promise<{ link: Link | null }> {
  const params = new URLSearchParams();
  if (options?.archived) params.set('archived', 'true');
  const query = params.toString();
  const path = query ? `/links/random?${query}` : '/links/random';

  return apiFetch<{ link: Link | null }>(path);
}

export async function updateMe(input: {
  email?: string;
  password?: string;
}) {
  return apiFetch<{ id: string; email: string }>(
    '/users/me',
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteMe() {
  return apiFetch<{ success: boolean }>('/users/me', {
    method: 'DELETE',
  });
}
