import { jest } from '@jest/globals';

jest.mock('../prisma/generated/client', () => ({
  Prisma: {
    TransactionIsolationLevel: { ReadCommitted: 'ReadCommitted' },
  },
}));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../prisma/generated/client';

import { OAuthLinkService } from './oauth-link.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserOAuthService } from '../users/user-oauth.service';
import { UsersService } from '../users/users.service';

const OAUTH_PROVIDER = 'google';
const OAUTH_PROVIDER_ID = 'google-uid-123';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

describe('OAuthLinkService', () => {
  let service: OAuthLinkService;

  const usersServiceMock = {
    findById: jest.fn(),
    getCredentialState: jest.fn(),
    lockUserRow: jest.fn(),
    markEmailVerified: jest.fn(),
  } as unknown as UsersService;

  const userOAuthServiceMock = {
    findOAuthAccount: jest.fn(),
    linkOAuthAccount: jest.fn(),
    unlinkOAuthAccount: jest.fn(),
  } as unknown as UserOAuthService;

  // each interactive transaction gets its own transaction-client sentinel and
  // frees every row lock it holds when it settles, mirroring how Postgres
  // holds a FOR UPDATE lock until the transaction commits or rolls back. The
  // concurrent-unlink test drives serialization from the lock itself, so it
  // fails if the production lock is removed rather than passing on the mock.
  let heldLockReleases: Map<object, () => void>;
  const prismaMock = {
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthLinkService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: UserOAuthService, useValue: userOAuthServiceMock },
      ],
    }).compile();

    service = module.get<OAuthLinkService>(OAuthLinkService);
    jest.clearAllMocks();

    heldLockReleases = new Map();
    (prismaMock.$transaction as jest.Mock).mockImplementation(
      async (callback: (transaction: object) => Promise<unknown>) => {
        const transaction = {};
        try {
          return await callback(transaction);
        } finally {
          // release the row lock this transaction acquired, if any
          heldLockReleases.get(transaction)?.();
          heldLockReleases.delete(transaction);
        }
      },
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      // pinned to READ COMMITTED so a global default change cannot regress the
      // guard's post-lock re-read of the committed delete
      expect(prismaMock.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      );
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
      // shared state stands in for the two OAuth rows the unlinks race over
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

      // the lock, not the mock, is what serializes: lockUserRow grants the row
      // to one transaction at a time and only frees it when that transaction
      // settles (via heldLockReleases). Delete lockUserRow from production and
      // both reads see the stale two-provider set, both pass, both delete, and
      // this test fails, which is the point.
      let rowLock = Promise.resolve();
      (usersServiceMock.lockUserRow as jest.Mock).mockImplementation(
        async (_userId: string, client: object) => {
          const heldByPrior = rowLock;
          let release!: () => void;
          rowLock = new Promise<void>((resolve) => {
            release = resolve;
          });
          heldLockReleases.set(client, release);
          await heldByPrior;
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
