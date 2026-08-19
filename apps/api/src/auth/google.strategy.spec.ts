import { jest } from '@jest/globals';

// set env before importing GoogleStrategy; constructor reads it eagerly
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.API_URL = 'http://localhost';

import { GoogleStrategy } from './google.strategy';
import { OAuthSignInService } from './oauth-sign-in.service';

const GOOGLE_PROFILE_ID = 'google-profile-456';
const PROVIDER_EMAIL = 'test@example.com';

function makeProfile(
  email: string | null = PROVIDER_EMAIL,
  verified: unknown = true,
) {
  return {
    id: GOOGLE_PROFILE_ID,
    emails: email !== null ? [{ value: email, verified }] : [],
    provider: 'google',
    displayName: 'Test User',
  };
}

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const oauthSignInServiceMock = {
    findOrCreateOAuthUser: jest.fn(),
  } as unknown as OAuthSignInService;

  beforeEach(() => {
    strategy = new GoogleStrategy(oauthSignInServiceMock);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('constructor env var guards', () => {
    it('throws when GOOGLE_CLIENT_ID is not set', () => {
      const original = process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;

      try {
        expect(() => new GoogleStrategy(oauthSignInServiceMock)).toThrow(
          'GOOGLE_CLIENT_ID must be set',
        );
      } finally {
        process.env.GOOGLE_CLIENT_ID = original;
      }
    });

    it('throws when GOOGLE_CLIENT_SECRET is not set', () => {
      const original = process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_CLIENT_SECRET;

      try {
        expect(() => new GoogleStrategy(oauthSignInServiceMock)).toThrow(
          'GOOGLE_CLIENT_SECRET must be set',
        );
      } finally {
        process.env.GOOGLE_CLIENT_SECRET = original;
      }
    });

    it('throws when API_URL is not set', () => {
      const original = process.env.API_URL;
      delete process.env.API_URL;

      try {
        expect(() => new GoogleStrategy(oauthSignInServiceMock)).toThrow(
          'API_URL must be set',
        );
      } finally {
        process.env.API_URL = original;
      }
    });
  });

  describe('validate', () => {
    it('delegates to findOrCreateOAuthUser with the extracted email for a valid profile', async () => {
      const delegateResult = { userId: 'user-1', email: PROVIDER_EMAIL };
      (
        oauthSignInServiceMock.findOrCreateOAuthUser as jest.Mock
      ).mockResolvedValue(delegateResult);

      const result = await strategy.validate(
        'ignored-access-token',
        'ignored-refresh-token',
        makeProfile(),
      );

      expect(oauthSignInServiceMock.findOrCreateOAuthUser).toHaveBeenCalledWith(
        'google',
        GOOGLE_PROFILE_ID,
        PROVIDER_EMAIL,
        true,
      );
      expect(result).toBe(delegateResult);
    });

    it('throws when the profile has no email and does not call findOrCreateOAuthUser', async () => {
      await expect(
        strategy.validate(
          'ignored-access-token',
          'ignored-refresh-token',
          makeProfile(null),
        ),
      ).rejects.toThrow('No email returned from Google');

      expect(
        oauthSignInServiceMock.findOrCreateOAuthUser,
      ).not.toHaveBeenCalled();
    });

    it.each([
      ['the string "true"', 'true', true],
      ['a boolean false', false, false],
      ['the string "false"', 'false', false],
      ['a null claim', null, false],
    ])('reads %s as %j', async (_label, claim, expected) => {
      (
        oauthSignInServiceMock.findOrCreateOAuthUser as jest.Mock
      ).mockResolvedValue({ userId: 'user-1', email: PROVIDER_EMAIL });

      await strategy.validate(
        'ignored-access-token',
        'ignored-refresh-token',
        makeProfile(PROVIDER_EMAIL, claim),
      );

      expect(oauthSignInServiceMock.findOrCreateOAuthUser).toHaveBeenCalledWith(
        'google',
        GOOGLE_PROFILE_ID,
        PROVIDER_EMAIL,
        expected,
      );
    });

    it('reads a profile with no verified key at all as unverified', async () => {
      (
        oauthSignInServiceMock.findOrCreateOAuthUser as jest.Mock
      ).mockResolvedValue({ userId: 'user-1', email: PROVIDER_EMAIL });

      await strategy.validate('ignored-access-token', 'ignored-refresh-token', {
        id: GOOGLE_PROFILE_ID,
        emails: [{ value: PROVIDER_EMAIL }],
        provider: 'google',
        displayName: 'Test User',
      });

      expect(oauthSignInServiceMock.findOrCreateOAuthUser).toHaveBeenCalledWith(
        'google',
        GOOGLE_PROFILE_ID,
        PROVIDER_EMAIL,
        false,
      );
    });
  });
});
