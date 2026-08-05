import { BadRequestException } from '@nestjs/common';
import { generateLinkState } from './oauth-link-state';
import { jest } from '@jest/globals';

// set env before GoogleLinkStrategy import; constructor reads it eagerly
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_LINK_CALLBACK_URL =
  'http://localhost/auth/google/link/callback';
process.env.JWT_SECRET = 'test-jwt-secret-for-link-strategy';

import { GoogleLinkStrategy } from './google-link.strategy';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const USER_ID = 'user-abc-123';
const GOOGLE_PROFILE_ID = 'google-profile-456';
const PROVIDER_EMAIL = 'test@example.com';

function makeProfile(email: string | null = PROVIDER_EMAIL) {
  return {
    id: GOOGLE_PROFILE_ID,
    emails: email !== null ? [{ value: email }] : [],
    provider: 'google',
    displayName: 'Test User',
  };
}

describe('GoogleLinkStrategy', () => {
  let strategy: GoogleLinkStrategy;

  beforeEach(() => {
    strategy = new GoogleLinkStrategy();
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
        expect(() => new GoogleLinkStrategy()).toThrow(
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
        expect(() => new GoogleLinkStrategy()).toThrow(
          'GOOGLE_CLIENT_SECRET must be set',
        );
      } finally {
        process.env.GOOGLE_CLIENT_SECRET = original;
      }
    });

    it('throws when GOOGLE_LINK_CALLBACK_URL is not set', () => {
      const original = process.env.GOOGLE_LINK_CALLBACK_URL;
      delete process.env.GOOGLE_LINK_CALLBACK_URL;

      try {
        expect(() => new GoogleLinkStrategy()).toThrow(
          'GOOGLE_LINK_CALLBACK_URL must be set',
        );
      } finally {
        process.env.GOOGLE_LINK_CALLBACK_URL = original;
      }
    });
  });

  describe('validate', () => {
    it('returns userId, providerId, and providerEmail for a valid state', async () => {
      const state = generateLinkState(USER_ID, process.env.JWT_SECRET!);
      const request = { query: { state } };

      const result = await strategy.validate(
        request,
        'ignored-access-token',
        'ignored-refresh-token',
        makeProfile(),
      );

      expect(result).toEqual({
        userId: USER_ID,
        providerId: GOOGLE_PROFILE_ID,
        providerEmail: PROVIDER_EMAIL,
      });
    });

    it('returns empty string for providerEmail when profile has no emails', async () => {
      const state = generateLinkState(USER_ID, process.env.JWT_SECRET!);
      const request = { query: { state } };

      const result = await strategy.validate(
        request,
        'ignored-access-token',
        'ignored-refresh-token',
        makeProfile(null),
      );

      expect(result).toEqual({
        userId: USER_ID,
        providerId: GOOGLE_PROFILE_ID,
        providerEmail: '',
      });
    });

    it('throws BadRequestException when state is expired', async () => {
      const state = generateLinkState(USER_ID, process.env.JWT_SECRET!);
      // simulate expiry by pushing Date.now past FIVE_MINUTES_MS at validate time
      const originalNow = Date.now;
      Date.now = () => originalNow() + FIVE_MINUTES_MS + 1000;

      try {
        await expect(
          strategy.validate(
            { query: { state } },
            'ignored-access-token',
            'ignored-refresh-token',
            makeProfile(),
          ),
        ).rejects.toThrow(BadRequestException);
      } finally {
        Date.now = originalNow;
      }
    });

    it('throws BadRequestException when state is tampered with', async () => {
      const state = generateLinkState(USER_ID, process.env.JWT_SECRET!);
      const tampered = state.slice(0, -4) + 'aaaa';

      await expect(
        strategy.validate(
          { query: { state: tampered } },
          'ignored-access-token',
          'ignored-refresh-token',
          makeProfile(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when state is missing from query', async () => {
      await expect(
        strategy.validate(
          { query: {} },
          'ignored-access-token',
          'ignored-refresh-token',
          makeProfile(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when request has no query', async () => {
      await expect(
        strategy.validate(
          {},
          'ignored-access-token',
          'ignored-refresh-token',
          makeProfile(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws "JWT_SECRET must be set" when the secret is unset at verify time', async () => {
      // the state was signed while the secret was present; validate must still
      // fail loud rather than feed `undefined` into the HMAC verify
      const state = generateLinkState(USER_ID, process.env.JWT_SECRET!);
      const original = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      try {
        await expect(
          strategy.validate(
            { query: { state } },
            'ignored-access-token',
            'ignored-refresh-token',
            makeProfile(),
          ),
        ).rejects.toThrow('JWT_SECRET must be set');
      } finally {
        process.env.JWT_SECRET = original;
      }
    });
  });
});
