import * as bcrypt from 'bcryptjs';

/**
 * Deterministic credentials for the seeded user that every story authenticates
 * with. The fixed UUID is critical: each test run truncates the User table and
 * reinserts this row, and Playwright storage state caches JWTs that encode the
 * user id. Without a stable id the cached state would become invalid every run.
 */
export const TEST_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'testing-ui@linklater.test',
  password: 'testing-ui-correct-horse',
} as const;

const BCRYPT_ROUNDS = 10;

export function hashTestUserPassword(): Promise<string> {
  return bcrypt.hash(TEST_USER.password, BCRYPT_ROUNDS);
}
