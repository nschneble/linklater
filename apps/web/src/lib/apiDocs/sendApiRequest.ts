/**
 * URL building + transport for the "try it out" explorer. Kept UI-free in
 * `lib/` (not write-gated) so the security-critical token handling and
 * URL-substitution rules can be unit-tested directly.
 *
 * The token is attached ONLY as an `Authorization: Bearer` header and ONLY when
 * non-empty (CONSTRAINT token-security). It is never placed in the URL, body,
 * or anything the UI renders.
 */

interface BuildRequestUrlInput {
  /** Origin to target; empty string means same-origin (relative path). */
  serverOrigin: string;
  /** Endpoint path template, e.g. `/links/{id}`. */
  path: string;
  /** Path parameter values keyed by name. */
  pathParams: Record<string, string>;
  /** Query parameter values keyed by name; empty values are dropped. */
  queryParams: Record<string, string>;
}

/**
 * Substitutes `{name}` path placeholders and appends non-empty query params.
 * All values are URL-encoded. Returns the path with no query string when every
 * query value is empty.
 */
export function buildRequestUrl({
  serverOrigin,
  path,
  pathParams,
  queryParams,
}: BuildRequestUrlInput): string {
  let substitutedPath = path;
  for (const [name, value] of Object.entries(pathParams)) {
    substitutedPath = substitutedPath.replace(
      `{${name}}`,
      encodeURIComponent(value),
    );
  }

  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(queryParams)) {
    if (value !== '') {
      search.append(name, value);
    }
  }
  const queryString = search.toString();

  const base = `${serverOrigin}${substitutedPath}`;
  return queryString ? `${base}?${queryString}` : base;
}

interface SendApiRequestInput {
  /** Fully-built request URL. */
  url: string;
  /** HTTP method (lowercase as it arrives from the normalized model). */
  method: string;
  /** Raw `ltk_` token; empty string ⇒ no Authorization header is sent. */
  token: string;
  /** Serialized JSON body, or `null` for GET/no-body requests. */
  body: string | null;
}

/** The transport-level outcome the form renders. */
export interface ApiRequestResult {
  /** HTTP status code, e.g. 200. */
  status: number;
  /** HTTP status text, e.g. `OK`. */
  statusText: string;
  /** Whether `status` is 2xx. */
  ok: boolean;
  /** Response body — pretty-printed JSON when parseable, else raw text. */
  body: string;
}

/**
 * Fires the request and normalizes the response into renderable strings.
 * Rejects only on transport failure (network/CORS/offline); the caller catches
 * that and shows "could not reach …". Any HTTP status — including 4xx/5xx —
 * resolves normally so the response panel can render it.
 */
export async function sendApiRequest({
  url,
  method,
  token,
  body,
}: SendApiRequestInput): Promise<ApiRequestResult> {
  const headers: Record<string, string> = {};
  if (token !== '') {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method: method.toUpperCase(),
    headers,
    body,
  });

  const text = await response.text();
  return {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    body: formatBody(text),
  };
}

/** Pretty-prints JSON when the body parses, otherwise returns it verbatim. */
function formatBody(text: string): string {
  if (text === '') return '';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
