import { requireEnv } from './require-env.js';

const TEST_VAR = 'REQUIRE_ENV_TEST_VAR';

describe('requireEnv', () => {
  const originalValue = process.env[TEST_VAR];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[TEST_VAR];
    } else {
      process.env[TEST_VAR] = originalValue;
    }
  });

  it('returns the value when the variable is set', () => {
    process.env[TEST_VAR] = 'present-value';
    expect(requireEnv(TEST_VAR)).toBe('present-value');
  });

  it('throws "<name> must be set" when the variable is unset', () => {
    delete process.env[TEST_VAR];
    expect(() => requireEnv(TEST_VAR)).toThrow(`${TEST_VAR} must be set`);
  });

  it('throws "<name> must be set" when the variable is an empty string', () => {
    process.env[TEST_VAR] = '';
    expect(() => requireEnv(TEST_VAR)).toThrow(`${TEST_VAR} must be set`);
  });
});
