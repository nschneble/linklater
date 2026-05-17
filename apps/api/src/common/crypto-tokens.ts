import { createHash, randomBytes } from 'node:crypto';

/**
 * Returns the SHA-256 hash of the given input as a hex string.
 *
 * Used throughout the auth and tokens services to store opaque tokens
 * (refresh tokens, PATs, extension auth codes, magic links) by their hash
 * so the raw value is never persisted.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Returns a cryptographically random 64-character hex string suitable for
 * use as a one-time token (email verification, password reset, refresh
 * tokens, magic links, etc.).
 */
export function generateHexToken(): string {
  return randomBytes(32).toString('hex');
}
