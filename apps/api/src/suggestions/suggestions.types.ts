/**
 * The article-shaped payload returned to the frontend. Carries just enough
 * for a `LinkCard` to render (title, description, image, site name) without
 * exposing internal cache rows or source-specific fields.
 */
export interface Suggestion {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

/**
 * Contract every source-specific adapter implements. The
 * `SuggestionsService` picks one of these at random and asks it for `count`
 * suggestions; on failure it falls back to another adapter.
 */
export interface SourceAdapter {
  /** Stable key matching the corresponding `SourceDefinition.key`. */
  key: string;
  /** Human-readable name returned to the frontend so the UI can render "from {name}". */
  name: string;
  /** Returns up to `count` suggestions. May return fewer if the source is sparse. */
  fetch(count: number): Promise<Suggestion[]>;
}
