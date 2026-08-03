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
import { PrismaService } from '../prisma/prisma.service';
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

describe('OAuthAccountService', () => {
  let service: OAuthAccountService;

  const usersServiceMock = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    getCredentialState: jest.fn(),
    lockUserRow: jest.fn(),
    markEmailVerified: jest.fn(),
    verifyEmailAndInvalidateStalePassword: jest.fn(),
  } as unknown as UsersService;

  const userOAuthServiceMock = {
    createOAuthUserAndLink: jest.fn(),
    findOAuthAccount: jest.fn(),
    linkOAuthAccount: jest.fn(),
    unlinkOAuthAccount: jest.fn(),
    updateOAuthProviderEmail: jest.fn(),
  } as unknown as UserOAuthService;

  // Serializes interactive transactions the way a `SELECT ... FOR UPDATE` row
  // lock would: a second `$transaction` blocks until the first fully settles,
  // so overlapping unlinks run one at a time. Each call receives its own
  // transaction-client sentinel, letting tests assert every step shares it.
  let transactionChain: Promise<unknown>;
  let nextTransactionId: number;
  const prismaMock = {
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthAccountService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: UserOAuthService, useValue: userOAuthServiceMock },
      ],
    }).compile();

    service = module.get<OAuthAccountService>(OAuthAccountService);
    jest.clearAllMocks();

    transactionChain = Promise.resolve();
    nextTransactionId = 0;
    (prismaMock.$transaction as jest.Mock).mockImplementation(
      (callback: (transaction: unknown) => Promise<unknown>) => {
        const transaction = { transactionId: (nextTransactionId += 1) };
        const settled = transactionChain.then(() => callback(transaction));
        // keep the next transaction waiting even if this one rejects
        transactionChain = settled.then(
          () => undefined,
          () => undefined,
        );
        return settled;
      },
    );
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

  describe('unlinkOAuthProvider', () => {
    it('unlinks when the account still has a password to fall back on', async () => {
      (usersServiceMock.getCredentialState as jest.Mock).mockResolvedValue({
        hasPassword: true,
        oauthProviders: [OAUTH_PROVIDER],
      });
      (userOAuthServiceMock.unlinkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER);

      expect(userOAuthServiceMock.unlinkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        expect.anything(),
      );
    });

    it('unlinks a passwordless account when another provider stays linked', async () => {
      (usersServiceMock.getCredentialState as jest.Mock).mockResolvedValue({
        hasPassword: false,
        oauthProviders: [OAUTH_PROVIDER, 'apple'],
      });
      (userOAuthServiceMock.unlinkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER);

      expect(userOAuthServiceMock.unlinkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        expect.anything(),
      );
    });

    it('rejects and keeps the account linked when unlinking would strand a passwordless user', async () => {
      (usersServiceMock.getCredentialState as jest.Mock).mockResolvedValue({
        hasPassword: false,
        oauthProviders: [OAUTH_PROVIDER],
      });

      await expect(
        service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER),
      ).rejects.toThrow(BadRequestException);
      expect(userOAuthServiceMock.unlinkOAuthAccount).not.toHaveBeenCalled();
    });

    it('locks the user row, reads, and deletes inside one shared transaction', async () => {
      (usersServiceMock.getCredentialState as jest.Mock).mockResolvedValue({
        hasPassword: true,
        oauthProviders: [OAUTH_PROVIDER],
      });
      (userOAuthServiceMock.unlinkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      const transaction = (usersServiceMock.lockUserRow as jest.Mock).mock
        .calls[0][1];
      // the lock must run before the guard reads state, and every step must
      // share the same transaction client, or the guard is not truly atomic
      expect(usersServiceMock.lockUserRow).toHaveBeenCalledWith(
        USER_ID,
        transaction,
      );
      expect(usersServiceMock.getCredentialState).toHaveBeenCalledWith(
        USER_ID,
        transaction,
      );
      expect(userOAuthServiceMock.unlinkOAuthAccount).toHaveBeenCalledWith(
        USER_ID,
        OAUTH_PROVIDER,
        transaction,
      );
      const lockOrder = (usersServiceMock.lockUserRow as jest.Mock).mock
        .invocationCallOrder[0];
      const readOrder = (usersServiceMock.getCredentialState as jest.Mock).mock
        .invocationCallOrder[0];
      expect(lockOrder).toBeLessThan(readOrder);
    });

    it('closes the concurrent-unlink race: two unlinks of different providers cannot strand a passwordless account', async () => {
      // shared state stands in for the two OAuth rows; the serializing
      // $transaction mock models the FOR UPDATE lock that orders the unlinks
      let linkedProviders = [OAUTH_PROVIDER, 'apple'];
      (usersServiceMock.getCredentialState as jest.Mock).mockImplementation(
        async () => ({
          hasPassword: false,
          oauthProviders: [...linkedProviders],
        }),
      );
      (userOAuthServiceMock.unlinkOAuthAccount as jest.Mock).mockImplementation(
        async (_userId: string, provider: string) => {
          linkedProviders = linkedProviders.filter(
            (linked) => linked !== provider,
          );
        },
      );

      const [first, second] = await Promise.allSettled([
        service.unlinkOAuthProvider(USER_ID, OAUTH_PROVIDER),
        service.unlinkOAuthProvider(USER_ID, 'apple'),
      ]);

      // exactly one unlink lands; the other is refused before it can strand
      expect(first.status).toBe('fulfilled');
      expect(second.status).toBe('rejected');
      expect((second as PromiseRejectedResult).reason).toBeInstanceOf(
        BadRequestException,
      );
      // a login path survives
      expect(linkedProviders).toEqual(['apple']);
      expect(userOAuthServiceMock.unlinkOAuthAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('linkOAuthAccountToUser', () => {
    it('links the provider even when the provider email differs from the account email', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(
        null,
      );
      (userOAuthServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
        'other@example.com',
      );

      expect(userOAuthServiceMock.linkOAuthAccount).toHaveBeenCalledWith(
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
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(
        null,
      );
      (userOAuthServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccountToUser(
        USER_ID,
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
    });

    it('marks email verified when linking an unverified user with matching emails', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: null,
      });
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(
        null,
      );
      (userOAuthServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
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
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(
        null,
      );
      (userOAuthServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
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
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue(
        null,
      );
      (userOAuthServiceMock.linkOAuthAccount as jest.Mock).mockResolvedValue(
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
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
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

      expect(userOAuthServiceMock.linkOAuthAccount).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the provider is linked to a different user', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
        emailVerifiedAt: new Date(),
      });
      (userOAuthServiceMock.findOAuthAccount as jest.Mock).mockResolvedValue({
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
