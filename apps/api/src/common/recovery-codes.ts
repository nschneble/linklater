import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const CODE_COUNT = 10;
const GROUP_COUNT = 3;
const GROUP_LENGTH = 5;
const BCRYPT_COST = 10;

/** Characters that are unambiguous to read and type (no 0, O, I, l, 1). */
const CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
/** Largest multiple of CHARSET.length that fits in a uint16 — eliminates modulo bias. */
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

export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, BCRYPT_COST)));
}

export async function findMatchingRecoveryCode(
  code: string,
  hashes: string[],
): Promise<number | null> {
  for (let index = 0; index < hashes.length; index++) {
    if (await bcrypt.compare(code, hashes[index])) {
      return index;
    }
  }
  return null;
}
