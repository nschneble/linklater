import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const CODE_COUNT = 10;
const GROUP_LENGTH = 5;
const BCRYPT_COST = 10;

/** Characters that are unambiguous to read and type (no 0, O, I, l, 1). */
const CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomChar(): string {
  return CHARSET[randomBytes(1)[0] % CHARSET.length];
}

function randomGroup(): string {
  return Array.from({ length: GROUP_LENGTH }, randomChar).join('');
}

export function generateRecoveryCodes(): string[] {
  return Array.from(
    { length: CODE_COUNT },
    () => `${randomGroup()}-${randomGroup()}`,
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
