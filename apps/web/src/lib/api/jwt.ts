/**
 * Reads the claims this client can act on out of a JWT it already holds,
 * without a round trip.
 *
 * FOR DETECTION ONLY, NEVER AUTHORIZATION. The payload is unverified: the
 * signature is not checked and could not be, since the key lives on the
 * server. The server remains the only authority on who a token belongs to
 * and whether it is still good. What this buys is the client noticing that
 * the token it is holding is not the one it was rendering, which is a
 * question about this tab's own consistency, and one a forged answer only
 * ever costs the forger.
 *
 * Every malformed shape answers `null` rather than throwing, because every
 * caller reads a value that arrived from storage another tab can write.
 * A non-JWT bearer token (the `ltk_` API tokens) has no dot-delimited
 * payload and lands on the same `null`.
 */

/** Unverified claims. Absent, mistyped, or unreadable each read `null`. */
export interface TokenClaims {
  /** The subject: the user id the issuing server put on the token. */
  sub: string | null;
  /** Expiry in seconds since the epoch, as the JWT spec defines it. */
  exp: number | null;
}

function decodeBase64UrlSegment(segment: string): string | null {
  const base64 = segment.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  } catch {
    // atob rejects anything outside the alphabet; a bad token is not an error
    return null;
  }
}

export function readTokenClaims(
  token: string | null | undefined,
): TokenClaims | null {
  if (typeof token !== 'string') return null;

  const segments = token.split('.');
  if (segments.length !== 3) return null;

  const json = decodeBase64UrlSegment(segments[1] ?? '');
  if (json === null) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }

  // an array is an object, and its numeric keys would read as claims
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload))
    return null;

  const claims = payload as Record<string, unknown>;
  const subject = claims['sub'];
  const expiry = claims['exp'];

  return {
    sub: typeof subject === 'string' ? subject : null,
    // a non-finite expiry wins every comparison a caller could write
    exp: typeof expiry === 'number' && Number.isFinite(expiry) ? expiry : null,
  };
}
