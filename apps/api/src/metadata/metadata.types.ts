/**
 * The shape of metadata extracted from a saved link's HTML and stored
 * in the `Meta` database record. All fields are nullable because any or
 * all metadata may be absent depending on the page's markup.
 */
export interface LinkMetadata {
  /** The page title from an OG/Twitter tag or `<title>` element. */
  title: string | null;
  /** The page description from an OG/Twitter or `<meta name="description">` tag. Truncated to 500 characters. */
  description: string | null;
  /** The OG or Twitter image URL. Resolved to an absolute URL. Truncated to 2000 characters. */
  imageUrl: string | null;
  /** The OG site name (`og:site_name`). */
  siteName: string | null;
  /** The page's favicon URL. Falls back to `<origin>/favicon.ico` when no `<link rel="icon">` is found. */
  faviconUrl: string | null;
  /** The raw HTML source of the fetched page, stored for debugging purposes. May be `null` if the fetch failed. */
  source: string | null;
}
