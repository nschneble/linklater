import { createHmac, timingSafeEqual } from 'crypto';

const PAYLOAD_SEPARATOR = '|';
const STATE_SEPARATOR = '.';

export function generateLinkState(userId: string, secret: string): string {
  const timestamp = Date.now().toString();
  const payload = `${userId}${PAYLOAD_SEPARATOR}${timestamp}`;
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const hmac = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('hex');
  return `${encodedPayload}${STATE_SEPARATOR}${hmac}`;
}

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
