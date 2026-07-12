import { jest } from '@jest/globals';
import { validateRequiredEnvVars } from './required-env.js';

describe('validateRequiredEnvVars', () => {
  const REQUIRED_VARS = [
    'DATABASE_URL',
    'JWT_SECRET',
    'TOTP_ENCRYPTION_KEY',
    'APP_URL',
  ];

  const VALID_TOTP_KEY = 'a'.repeat(64);

  const originalEnv: Record<string, string | undefined> = {};

  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.clearAllMocks();

    for (const name of REQUIRED_VARS) {
      originalEnv[name] = process.env[name];
    }

    // A fully-valid baseline environment; individual tests knock out one
    // variable to exercise a single failure branch in isolation.
    process.env.DATABASE_URL = 'postgres://localhost/linklater';
    process.env.JWT_SECRET = 'super-secret';
    process.env.TOTP_ENCRYPTION_KEY = VALID_TOTP_KEY;
    process.env.APP_URL = 'https://linklater.example';

    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: number | string | null) => {
        throw new Error('process.exit called');
      }) as unknown as jest.SpiedFunction<typeof process.exit>;
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const name of REQUIRED_VARS) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('does not exit when every required variable is set and valid', () => {
    expect(() => validateRequiredEnvVars()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits when APP_URL is missing', () => {
    delete process.env.APP_URL;

    expect(() => validateRequiredEnvVars()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('APP_URL'));
  });

  it('exits when TOTP_ENCRYPTION_KEY is not a 64-character hex string', () => {
    process.env.TOTP_ENCRYPTION_KEY = 'not-hex';

    expect(() => validateRequiredEnvVars()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'TOTP_ENCRYPTION_KEY must be a 64-character hex string',
      ),
    );
  });
});
