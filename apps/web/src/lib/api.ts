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

  if (token && includeAuth) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function register(email: string, password: string) {
  return apiFetch(
    '/auth/register',
    {
      body: JSON.stringify({ email, password }),
      method: 'POST',
    },
    false,
  );
}

export async function login(email: string, password: string) {
  const data = await apiFetch<LoginResponse>(
    '/auth/login',
    {
      body: JSON.stringify({ email, password }),
      method: 'POST',
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
  return apiFetch<{
    email: string;
    mode: string;
    theme: string;
    userId: string;
  }>('/auth/me', {
    method: 'GET',
  });
}

export interface Link {
  createdAt: string;
  host: string;
  id: string;
  title: string;
  updatedAt: string;
  url: string;
  archivedAt?: string | null;
  metaDescription?: string | null;
  metaFetchedAt?: string | null;
  metaImage?: string | null;
  notes?: string | null;
}

export async function getLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}`);
}

export interface PaginatedLinks {
  data: Link[];
  limit: number;
  page: number;
  total: number;
}

export async function getLinks(options?: {
  archived?: boolean;
  limit?: number;
  page?: number;
  search?: string;
}): Promise<PaginatedLinks> {
  const queryParameters = new URLSearchParams();

  if (options?.archived !== undefined)
    queryParameters.set('archived', options.archived ? 'true' : 'false');
  if (options?.limit !== undefined)
    queryParameters.set('limit', String(options.limit));
  if (options?.page !== undefined)
    queryParameters.set('page', String(options.page));
  if (options?.search) queryParameters.set('search', options.search);

  const query = queryParameters.toString();
  const path = query ? `/links?${query}` : '/links';

  return apiFetch<PaginatedLinks>(path);
}

export async function createLink(input: {
  url: string;
  notes?: string;
  title?: string;
}): Promise<Link> {
  return apiFetch<Link>('/links', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export async function updateLink(
  id: string,
  input: { title?: string; notes?: string },
): Promise<Link> {
  return apiFetch<Link>(`/links/${id}`, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

export async function archiveLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/archive`, {
    method: 'POST',
  });
}

export async function unarchiveLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/unarchive`, {
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
  const queryParameters = new URLSearchParams();

  if (options?.archived) queryParameters.set('archived', 'true');

  const query = queryParameters.toString();
  const path = query ? `/links/random?${query}` : '/links/random';

  return apiFetch<{ link: Link | null }>(path);
}

export async function updateMe(input: {
  email?: string;
  mode?: string;
  password?: string;
  theme?: string;
}) {
  return apiFetch<{ id: string; email: string }>('/users/me', {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

export async function deleteMe() {
  return apiFetch<{ success: boolean }>('/users/me', {
    method: 'DELETE',
  });
}
