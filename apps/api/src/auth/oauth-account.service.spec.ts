import { jest } from '@jest/globals';

class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.code = code;
  }
}

jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../prisma/generated/client';

import { OAuthAccountService } from './oauth-account.service';
import { UsersService } from '../users/users.service';

const makeP2002 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
  });

const OAUTH_PROVIDER = 'google';
const OAUTH_PROVIDER_ID = 'google-uid-123';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

describe('OAuthAccountService', () => {
  let service: OAuthAccountService;

  const usersServiceMock = {
    createOAuthUserAndLink: jest.fn(),
    findByEmail: jest.fn(),
    findByIdWithPasswordHash: jest.fn(),
    findById: jest.fn(),
    findOAuthAccount: jest.fn(),
    linkOAuthAccount: jest.fn(),
    markEmailVerified: jest.fn(),
    unlinkOAuthAccount: jest.fn(),
    updateOAuthProviderEmail: jest.fn(),
  } as unknown as UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthAccountService,
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    service = module.get<OAuthAccountService>(OAuthAccountService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateOAuthUser', () => {
    it('returns existing user when OAuth account already exists', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        providerEmail: USER_EMAIL,
        user: { id: USER_ID, email: USER_EMAIL },
      });

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
      expect(usersServiceMock.linkOAuthAccount).not.toHaveBeenCalled();
      expect(usersServiceMock.createOAuthUserAndLink).not.toHaveBeenCalled();
      expect(usersServiceMock.updateOAuthProviderEmail).not.toHaveBeenCalled();
    });

    it('refreshes providerEmail when the provider asserts a new value on sign-in', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        providerEmail: 'stale@gmail.com',
        user: { id: USER_ID, email: USER_EMAIL },
      });

      await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        'fresh@gmail.com',
      );

      expect(usersServiceMock.updateOAuthProviderEmail).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        'fresh@gmail.com',
      );
    });

    it('auto-links OAuth account to existing user with same email', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.linkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );
      expect(usersServiceMock.createOAuthUserAndLink).not.toHaveBeenCalled();
      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('sets emailVerifiedAt when auto-linking an unverified account', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.markEmailVerified as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.markEmailVerified).toHaveBeenCalledWith(USER_ID);
    });

    it('creates a new user and OAuth account atomically when no match exists', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.createOAuthUserAndLink as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.createOAuthUserAndLink).toHaveBeenCalledWith(
        USER_EMAIL,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );
      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('recovers via OAuth account lookup when concurrent creation causes P2002', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          userId: USER_ID,
          providerEmail: USER_EMAIL,
          user: { id: USER_ID, email: USER_EMAIL },
        });
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.createOAuthUserAndLink as jest.Mock).mockRejectedValue(
        makeP2002(),
      );

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('recovers via email lookup when OAuth account not yet linked after P2002', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (usersServiceMock.findByEmail as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: USER_ID, email: USER_EMAIL });
      (usersServiceMock.createOAuthUserAndLink as jest.Mock).mockRejectedValue(
        makeP2002(),
      );

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('re-throws non-P2002 errors from createOAuthUserAndLink', async () => {
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValueOnce(null);
      (usersServiceMock.createOAuthUserAndLink as jest.Mock).mockRejectedValue(
        new Error('unexpected database error'),
      );

      await expect(
        service.findOrCreateOAuthUser(
          OAUTH_PROVIDER,
          OAUTH_PROVIDER_ID,
          USER_EMAIL,
        ),
      ).rejects.toThrow('unexpected database error');
    });
  });

  describe('unlinkOAuthProvider', () => {
    it('throws BadRequestException when the user has no password', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        hasPassword: false,
        passwordHash: null,
      });

      await expect(
        service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls unlinkOAuthAccount when the user has a password', async () => {
      (
        usersServiceMock.findByIdWithPasswordHash as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        hasPassword: true,
        passwordHash: 'hash',
      });
      (usersServiceMock.unlinkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER);

      expect(usersServiceMock.unlinkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
      );
    });
  });

  describe('linkOAuthAccountToUser', () => {
    it('links the provider even when the provider email differs from the account email', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        'other@example.com',
      );

      expect(usersServiceMock.linkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        'other@example.com',
      );
    });

    it('links the provider when no existing account is found', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.linkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );
    });

    it('marks email verified when linking an unverified user with matching emails', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.markEmailVerified as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.markEmailVerified).toHaveBeenCalledWith(USER_ID);
    });

    it('does NOT mark email verified when the provider email differs from the account email', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        'foreign@example.com',
      );

      expect(usersServiceMock.markEmailVerified).not.toHaveBeenCalled();
    });

    it('does not mark email verified when it is already verified', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.markEmailVerified).not.toHaveBeenCalled();
    });

    it('is idempotent when the provider is already linked to the same user', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        provider: OAUTH_PROVIDER,
        providerId: OAUTH_PROVIDER_ID,
      });

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(usersServiceMock.linkOAuthAccount).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the provider is linked to a different user', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (usersServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
        userId: 'different-user-id',
        provider: OAUTH_PROVIDER,
        providerId: OAUTH_PROVIDER_ID,
      });

      await expect(
        service.linkOAuthAccountToUser(
          USER_ID,
          OAUTH_PROVIDER,
          OAUTH_PROVIDER_ID,
          USER_EMAIL,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('buildGoogleLinkUrl', () => {
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_LINK_CALLBACK_URL =
        'https://api.example.com/auth/google/link/callback';
      process.env.JWT_SECRET = 'test-secret';
    });

    it('returns a URL pointing to the Google OAuth v2 authorization endpoint', () => {
      const { url } = service.buildGoogleLinkUrl(USER_ID);
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    });

    it('includes required OAuth query parameters', () => {
      const { url } = service.buildGoogleLinkUrl(USER_ID);
      const parsed = new URL(url);
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        'https://api.example.com/auth/google/link/callback',
      );
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBeTruthy();
      expect(parsed.searchParams.get('state')).toBeTruthy();
    });
  });
});
