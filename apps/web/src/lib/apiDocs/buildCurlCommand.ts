/**
 * Builds the copy-ready `curl` command shown in each endpoint's "Example
 * request (cURL)" block. Kept UI-free in `lib/` (not write-gated) so the
 * string-assembly + token-placeholder rules can be unit-tested directly.
 *
 * The token is ALWAYS rendered as the `ltk_…` placeholder, NEVER a real token:
 * the cURL block is static documentation a reader copies and fills in
 * themselves, so a real credential must never reach the rendered page.
 */

interface BuildCurlCommandInput {
  /** HTTP method, any case (rendered uppercased). */
  method: string;
  /** Full request URL including any `{param}` path template. */
  url: string;
  /** Pretty-printed JSON request body, or `null` for no body (GET/DELETE). */
  body: string | null;
}

/** Placeholder the reader replaces with their own `ltk_` token. */
const TOKEN_PLACEHOLDER = 'YOUR_BEARER_TOKEN';

export function buildCurlCommand({
  method,
  url,
  body,
}: BuildCurlCommandInput): string {
  const lines = [
    `curl -X ${method.toUpperCase()} '${url}'`,
    `  -H 'Authorization: Bearer ${TOKEN_PLACEHOLDER}'`,
  ];

  if (body !== null) {
    lines.push(`  -H 'Content-Type: application/json'`);
    lines.push(`  -d '${body}'`);
  }

  // Join with a trailing backslash + newline so the command pastes into a
  // shell as one multi-line invocation.
  return lines.join(' \\\n');
}
