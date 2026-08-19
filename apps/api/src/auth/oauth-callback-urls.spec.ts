import {
  APPLE_SIGN_IN_CALLBACK_ROUTE,
  GOOGLE_LINK_CALLBACK_ROUTE,
  GOOGLE_SIGN_IN_CALLBACK_ROUTE,
  publicCallbackUrl,
} from './oauth-callback-urls';

const BASE_URL = 'https://api.example.com';

describe('publicCallbackUrl', () => {
  let originalBaseUrl: string | undefined;

  beforeEach(() => {
    originalBaseUrl = process.env.API_URL;
    process.env.API_URL = BASE_URL;
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.API_URL;
    } else {
      process.env.API_URL = originalBaseUrl;
    }
  });

  it.each([
    [GOOGLE_SIGN_IN_CALLBACK_ROUTE, `${BASE_URL}/auth/google/callback`],
    [GOOGLE_LINK_CALLBACK_ROUTE, `${BASE_URL}/auth/google/link/callback`],
    [APPLE_SIGN_IN_CALLBACK_ROUTE, `${BASE_URL}/auth/apple/callback`],
  ])('derives %s as %s', (route, expected) => {
    expect(publicCallbackUrl(route)).toBe(expected);
  });

  it('keeps a path prefix on the base, as a reverse proxy mount needs', () => {
    process.env.API_URL = 'https://linklater.example/api';

    expect(publicCallbackUrl(GOOGLE_SIGN_IN_CALLBACK_ROUTE)).toBe(
      'https://linklater.example/api/auth/google/callback',
    );
  });

  it.each(['/', '///'])(
    'trims a trailing %j from the base so the URL never doubles its slash',
    (suffix) => {
      process.env.API_URL = `${BASE_URL}${suffix}`;

      expect(publicCallbackUrl(GOOGLE_SIGN_IN_CALLBACK_ROUTE)).toBe(
        `${BASE_URL}/auth/google/callback`,
      );
    },
  );

  it('throws when API_URL is not set', () => {
    delete process.env.API_URL;

    expect(() => publicCallbackUrl(GOOGLE_SIGN_IN_CALLBACK_ROUTE)).toThrow(
      'API_URL must be set',
    );
  });
});
