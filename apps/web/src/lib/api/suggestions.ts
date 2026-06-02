import { apiFetch } from './core';

export interface Suggestion {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export interface SuggestionsResponse {
  sourceName: string;
  suggestions: Suggestion[];
}

export function getSuggestions(count: number): Promise<SuggestionsResponse> {
  return apiFetch<SuggestionsResponse>(`/suggestions?count=${count}`);
}
