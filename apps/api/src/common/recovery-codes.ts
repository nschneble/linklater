import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const CODE_COUNT = 10;
const GROUP_COUNT = 3;
const GROUP_LENGTH = 5;
const BCRYPT_COST = 10;

/**
 * Recognizes any user-typed recovery code that maps to a canonical
 * `XXXXX-XXXXX-XXXXX` form once trivial input variations (whitespace,
 * hyphens) are stripped. Used to keep input forgiving without storing
 * multiple hash variants per code (Postel's Law; see CLAUDE.md).
 */
const RECOVERY_CODE_PAYLOAD = /^[^01IOl]{15}$/;

/**
 * Normalizes a user-supplied recovery code into the canonical
 * `XXXXX-XXXXX-XXXXX` form that matches what was hashed at issue time.
 * Strips surrounding whitespace, internal whitespace, and any hyphens
 * the user may have typed, then re-inserts hyphens after positions 5
 * and 10. Returns `null` when the stripped payload is not 15 valid
 * recovery-charset characters.
 */
export function normalizeRecoveryCode(input: string): string | null {
  const stripped = input.replace(/[\s-]/g, '');
  if (!RECOVERY_CODE_PAYLOAD.test(stripped)) return null;
  return `${stripped.slice(0, 5)}-${stripped.slice(5, 10)}-${stripped.slice(10, 15)}`;
}

/** Characters that are unambiguous to read and type (no 0, O, I, l, 1). */
const CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
/** Largest multiple of CHARSET.length that fits in a uint16; eliminates modulo bias. */
const CHARSET_LIMIT = Math.floor(65536 / CHARSET.length) * CHARSET.length;

function randomChar(): string {
  let value: number;
  do {
    value = randomBytes(2).readUInt16BE(0);
  } while (value >= CHARSET_LIMIT);
  return CHARSET[value % CHARSET.length];
}

function randomGroup(): string {
  return Array.from({ length: GROUP_LENGTH }, randomChar).join('');
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, () =>
    Array.from({ length: GROUP_COUNT }, randomGroup).join('-'),
  );
}

export function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, BCRYPT_COST)));
}

export async function findMatchingRecoveryCode(
  code: string,
  hashes: string[],
): Promise<number | null> {
  const results = await Promise.all(
    hashes.map((hash) => bcrypt.compare(code, hash)),
  );
  const matchIndex = results.indexOf(true);
  return matchIndex === -1 ? null : matchIndex;
}
