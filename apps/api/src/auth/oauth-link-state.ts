import { createHmac, timingSafeEqual } from 'crypto';

const PAYLOAD_SEPARATOR = '|';
const STATE_SEPARATOR = '.';

/**
 * Generates a signed, time-stamped state token for the Google account-linking
 * OAuth flow. The state encodes the authenticated user's ID and the current
 * timestamp, then appends an HMAC-SHA256 signature so the callback can verify
 * it was issued by this server and has not expired.
 *
 * Format (base64url-encoded payload + '.' + hex HMAC):
 * `<base64url(userId|timestamp)>.<hmac-sha256-hex>`
 *
 * @param userId - The UUID of the Linklater user initiating the link.
 * @param secret - The JWT secret used as the HMAC key.
 * @returns An opaque state string to pass as the `state` query parameter
 *   in the Google OAuth redirect.
 */
export function generateLinkState(userId: string, secret: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}${PAYLOAD_SEPARATOR}${timestamp}`;
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const hmac = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('hex');
  return `${encodedPayload}${STATE_SEPARATOR}${hmac}`;
}

/**
 * Verifies a state token produced by `generateLinkState` and extracts the
 * user ID. Returns `null` when the token is invalid, tampered with, or older
 * than `maxAgeMs` milliseconds.
 *
 * The HMAC comparison is performed with `timingSafeEqual` to prevent
 * timing attacks. The timestamp check prevents replay attacks by rejecting
 * state tokens that are too old.
 *
 * @param state - The state string received in the OAuth callback query.
 * @param secret - The HMAC key – must match the key used in `generateLinkState`.
 * @param maxAgeMs - Maximum age of the token in milliseconds.
 * @returns The user UUID encoded in the state, or `null` on any failure.
 */
export function verifyLinkState(
  state: string,
  secret: string,
  maxAgeMs: number,
): string | null {
  try {
    const lastDotIndex = state.lastIndexOf(STATE_SEPARATOR);
    if (lastDotIndex === -1) return null;

    const encodedPayload = state.slice(0, lastDotIndex);
    const receivedHmac = state.slice(lastDotIndex + 1);

    const expectedHmac = createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedHmac);
    const receivedBuffer = Buffer.from(receivedHmac);

    if (expectedBuffer.length !== receivedBuffer.length) return null;
    if (!timingSafeEqual(expectedBuffer, receivedBuffer)) return null;

    const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const separatorIndex = payload.indexOf(PAYLOAD_SEPARATOR);
    if (separatorIndex === -1) return null;

    const userId = payload.slice(0, separatorIndex);
    const timestamp = parseInt(payload.slice(separatorIndex + 1), 10);

    if (isNaN(timestamp)) return null;
    if (Date.now() - timestamp > maxAgeMs) return null;

    return userId;
  } catch {
    return null;
  }
}
