import { apiFetch } from './core';

export interface LinkMeta {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  faviconUrl?: string | null;
  fetchedAt?: string | null;
}

export interface Link {
  id: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string | null;
  meta?: LinkMeta | null;
}

export interface PaginatedLinks {
  data: Link[];
  limit: number;
  page: number;
  total: number;
}

export function getLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}`);
}

export function getLinks(options?: {
  read?: boolean;
  limit?: number;
  page?: number;
  search?: string;
}): Promise<PaginatedLinks> {
  const queryParameters = new URLSearchParams();

  if (options?.read !== undefined) {
    queryParameters.set('read', String(options.read));
  }
  if (options?.limit !== undefined) {
    queryParameters.set('limit', String(options.limit));
  }
  if (options?.page !== undefined) {
    queryParameters.set('page', String(options.page));
  }
  if (options?.search) {
    queryParameters.set('search', options.search);
  }

  const query = queryParameters.toString();
  const path = query ? `/links?${query}` : '/links';
  return apiFetch<PaginatedLinks>(path);
}

export function createLink(input: { url: string }): Promise<Link> {
  return apiFetch<Link>('/links', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function updateLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}`, {
    body: JSON.stringify({}),
    method: 'PATCH',
  });
}

export function readLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/read`, {
    method: 'POST',
  });
}

export function unreadLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/unread`, {
    method: 'POST',
  });
}

export function stumbleLink(): Promise<{ url: string | null }> {
  return apiFetch<{ url: string | null }>('/links/stumble', { method: 'POST' });
}

export function deleteLink(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/links/${id}`, {
    method: 'DELETE',
  });
}

export function deleteAllReadLinks(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/links/read', {
    method: 'DELETE',
  });
}

export function getRandomLink(): Promise<{
  link: Link | null;
}> {
  return apiFetch<{ link: Link | null }>('/links/random');
}
