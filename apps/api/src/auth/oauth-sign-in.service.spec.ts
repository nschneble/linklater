import { jest } from '@jest/globals';

class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.code = code;
  }
}

jest.mock('../prisma/generated/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../prisma/generated/client';

import { OAuthSignInService } from './oauth-sign-in.service';
import { UserOAuthService } from '../users/user-oauth.service';
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

describe('OAuthSignInService', () => {
  let service: OAuthSignInService;

  const usersServiceMock = {
    findByEmail: jest.fn(),
    markEmailVerified: jest.fn(),
    verifyEmailAndInvalidateStalePassword: jest.fn(),
  } as unknown as UsersService;

  const userOAuthServiceMock = {
    createOAuthUserAndLink: jest.fn(),
    findOAuthAccount: jest.fn(),
    linkOAuthAccount: jest.fn(),
    updateOAuthProviderEmail: jest.fn(),
  } as unknown as UserOAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthSignInService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: UserOAuthService, useValue: userOAuthServiceMock },
      ],
    }).compile();

    service = module.get<OAuthSignInService>(OAuthSignInService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateOAuthUser', () => {
    it('returns existing user when OAuth account already exists', async () => {
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
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
      expect(userOAuthServiceMock.linkOAuthAccount).not.toHaveBeenCalled();
      expect(
        userOAuthServiceMock.createOAuthUserAndLink,
      ).not.toHaveBeenCalled();
      expect(
        userOAuthServiceMock.updateOAuthProviderEmail,
      ).not.toHaveBeenCalled();
    });

    it('refreshes providerEmail when the provider asserts a new value on sign-in', async () => {
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        providerEmail: 'stale@gmail.com',
        user: { id: USER_ID, email: USER_EMAIL },
      });

      await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        'fresh@gmail.com',
      );

      expect(
        userOAuthServiceMock.updateOAuthProviderEmail,
      ).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        'fresh@gmail.com',
      );
    });

    it('auto-links OAuth account to existing user with same email', async () => {
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(
        null,
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (userOAuthServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(userOAuthServiceMock.linkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );
      expect(
        userOAuthServiceMock.createOAuthUserAndLink,
      ).not.toHaveBeenCalled();
      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
      // already-verified account: password survives linking a second provider
      expect(
        usersServiceMock.verifyEmailAndInvalidateStalePassword,
      ).not.toHaveBeenCalled();
    });

    it('invalidates a stale password when auto-linking an unverified account', async () => {
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(
        null,
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (userOAuthServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        usersServiceMock.verifyEmailAndInvalidateStalePassword as jest.Mock
      ).mockResolvedValue(undefined);

      await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(
        usersServiceMock.verifyEmailAndInvalidateStalePassword,
      ).toHaveBeenCalledWith(USER_ID);
      expect(usersServiceMock.markEmailVerified).not.toHaveBeenCalled();
    });

    it('creates a new user and OAuth account atomically when no match exists', async () => {
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(
        null,
      );
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (
        userOAuthServiceMock.createOAuthUserAndLink as jest.Mock
      ).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(userOAuthServiceMock.createOAuthUserAndLink).toHaveBeenCalledWith(
        USER_EMAIL,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );
      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('recovers via OAuth account lookup when concurrent creation causes P2002', async () => {
      (userOAuthServiceMock.findOAuthAccount as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          userId: USER_ID,
          providerEmail: USER_EMAIL,
          user: { id: USER_ID, email: USER_EMAIL },
        });
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (
        userOAuthServiceMock.createOAuthUserAndLink as jest.Mock
      ).mockRejectedValue(makeP2002());

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('recovers via email lookup when OAuth account not yet linked after P2002', async () => {
      (userOAuthServiceMock.findOAuthAccount as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (usersServiceMock.findByEmail as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: USER_ID,
          email: USER_EMAIL,
          emailVerifiedAt: new Date(),
        });
      (
        userOAuthServiceMock.createOAuthUserAndLink as jest.Mock
      ).mockRejectedValue(makeP2002());

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
      expect(
        usersServiceMock.verifyEmailAndInvalidateStalePassword,
      ).not.toHaveBeenCalled();
    });

    it('invalidates a stale password on the P2002 race-recovered user when unverified', async () => {
      (userOAuthServiceMock.findOAuthAccount as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (usersServiceMock.findByEmail as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: USER_ID,
          email: USER_EMAIL,
          emailVerifiedAt: null,
        });
      (
        userOAuthServiceMock.createOAuthUserAndLink as jest.Mock
      ).mockRejectedValue(makeP2002());
      (
        usersServiceMock.verifyEmailAndInvalidateStalePassword as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.findOrCreateOAuthUser(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        USER_EMAIL,
      );

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
      expect(
        usersServiceMock.verifyEmailAndInvalidateStalePassword,
      ).toHaveBeenCalledWith(USER_ID);
    });

    it('re-throws non-P2002 errors from createOAuthUserAndLink', async () => {
      (
        userOAuthServiceMock.findOAuthAccount as jest.Mock
      ).mockResolvedValueOnce(null);
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValueOnce(null);
      (
        userOAuthServiceMock.createOAuthUserAndLink as jest.Mock
      ).mockRejectedValue(new Error('unexpected database error'));

      await expect(
        service.findOrCreateOAuthUser(
          OAUTH_PROVIDER,
          OAUTH_PROVIDER_ID,
          USER_EMAIL,
        ),
      ).rejects.toThrow('unexpected database error');
    });
  });
});
