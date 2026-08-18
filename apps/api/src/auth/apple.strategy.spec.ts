import { jest } from '@jest/globals';

// env must be set before AppleStrategy import; constructor reads eagerly
process.env.API_URL = 'http://localhost';
process.env.APPLE_CLIENT_ID = 'test-client-id';
process.env.APPLE_KEY_ID = 'test-key-id';
process.env.APPLE_PRIVATE_KEY = 'test-private-key';
process.env.APPLE_TEAM_ID = 'test-team-id';

import { AppleStrategy } from './apple.strategy';
import { OAuthSignInService } from './oauth-sign-in.service';

const APPLE_PROFILE_ID = 'apple-profile-789';
const PROVIDER_EMAIL = 'test@example.com';

// Apple exposes email as profile.email, not Google's emails[0].value
function makeProfile(email?: string, emailVerified?: boolean) {
  return {
    id: APPLE_PROFILE_ID,
    email,
    emailVerified,
    provider: 'apple',
  };
}

describe('AppleStrategy', () => {
  let strategy: AppleStrategy;

  const oauthSignInServiceMock = {
    findOrCreateOAuthUser: jest.fn(),
  } as unknown as OAuthSignInService;

  beforeEach(() => {
    strategy = new AppleStrategy(oauthSignInServiceMock);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('constructor env var guards', () => {
    it('throws when API_URL is not set', () => {
      const original = process.env.API_URL;
      delete process.env.API_URL;

      try {
        expect(() => new AppleStrategy(oauthSignInServiceMock)).toThrow(
          'API_URL must be set',
        );
      } finally {
        process.env.API_URL = original;
      }
    });

    it('throws when APPLE_CLIENT_ID is not set', () => {
      const original = process.env.APPLE_CLIENT_ID;
      delete process.env.APPLE_CLIENT_ID;

      try {
        expect(() => new AppleStrategy(oauthSignInServiceMock)).toThrow(
          'APPLE_CLIENT_ID must be set',
        );
      } finally {
        process.env.APPLE_CLIENT_ID = original;
      }
    });

    it('throws when APPLE_KEY_ID is not set', () => {
      const original = process.env.APPLE_KEY_ID;
      delete process.env.APPLE_KEY_ID;

      try {
        expect(() => new AppleStrategy(oauthSignInServiceMock)).toThrow(
          'APPLE_KEY_ID must be set',
        );
      } finally {
        process.env.APPLE_KEY_ID = original;
      }
    });

    it('throws when APPLE_PRIVATE_KEY is not set', () => {
      const original = process.env.APPLE_PRIVATE_KEY;
      delete process.env.APPLE_PRIVATE_KEY;

      try {
        expect(() => new AppleStrategy(oauthSignInServiceMock)).toThrow(
          'APPLE_PRIVATE_KEY must be set',
        );
      } finally {
        process.env.APPLE_PRIVATE_KEY = original;
      }
    });

    it('throws when APPLE_TEAM_ID is not set', () => {
      const original = process.env.APPLE_TEAM_ID;
      delete process.env.APPLE_TEAM_ID;

      try {
        expect(() => new AppleStrategy(oauthSignInServiceMock)).toThrow(
          'APPLE_TEAM_ID must be set',
        );
      } finally {
        process.env.APPLE_TEAM_ID = original;
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
        makeProfile(PROVIDER_EMAIL, true),
        'ignored-access-token',
        'ignored-refresh-token',
      );

      expect(oauthSignInServiceMock.findOrCreateOAuthUser).toHaveBeenCalledWith(
        'apple',
        APPLE_PROFILE_ID,
        PROVIDER_EMAIL,
        true,
      );
      expect(result).toBe(delegateResult);
    });

    it('throws when the profile has no email and does not call findOrCreateOAuthUser', async () => {
      await expect(
        strategy.validate(
          makeProfile(undefined),
          'ignored-access-token',
          'ignored-refresh-token',
        ),
      ).rejects.toThrow('No email returned from Apple');

      expect(
        oauthSignInServiceMock.findOrCreateOAuthUser,
      ).not.toHaveBeenCalled();
    });

    it.each([
      ['false', false, false],
      ['absent', undefined, false],
    ])(
      'treats an emailVerified claim of %s as unverified',
      async (_label, claim, expected) => {
        (
          oauthSignInServiceMock.findOrCreateOAuthUser as jest.Mock
        ).mockResolvedValue({ userId: 'user-1', email: PROVIDER_EMAIL });

        await strategy.validate(
          makeProfile(PROVIDER_EMAIL, claim),
          'ignored-access-token',
          'ignored-refresh-token',
        );

        expect(
          oauthSignInServiceMock.findOrCreateOAuthUser,
        ).toHaveBeenCalledWith(
          'apple',
          APPLE_PROFILE_ID,
          PROVIDER_EMAIL,
          expected,
        );
      },
    );
  });
});
