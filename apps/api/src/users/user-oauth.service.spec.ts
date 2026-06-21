import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UserOAuthService } from './user-oauth.service';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';
const PROVIDER = 'google';
const PROVIDER_ID = 'google-uid-123';
const PROVIDER_EMAIL = 'provider@gmail.com';

const makeUser = (overrides = {}) => ({
  id: USER_ID,
  email: USER_EMAIL,
  passwordHash: null,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('UserOAuthService', () => {
  let service: UserOAuthService;

  const prismaMock = {
    user: {
      create: jest.fn(),
    },
    oAuthAccount: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserOAuthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UserOAuthService>(UserOAuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ──────────────────────────────────────────────
  // createOAuthUser
  // ──────────────────────────────────────────────

  describe('createOAuthUser', () => {
    it('creates a user row with a null passwordHash and pre-verified email', async () => {
      const created = makeUser();
      (prismaMock.user.create as jest.Mock).mockResolvedValue(created);

      const result = await service.createOAuthUser(USER_EMAIL);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: USER_EMAIL,
          passwordHash: null,
          emailVerifiedAt: expect.any(Date),
        }),
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  // ──────────────────────────────────────────────
  // createOAuthUserAndLink
  // ──────────────────────────────────────────────

  describe('createOAuthUserAndLink', () => {
    it('creates the user and OAuth account atomically inside a transaction', async () => {
      const createdUser = makeUser();
      const transactionClient = {
        user: {
          create: jest.fn().mockResolvedValue(createdUser),
        },
        oAuthAccount: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      (prismaMock.$transaction as unknown as jest.Mock).mockImplementation(
        async (
          callback: (transaction: typeof transactionClient) => Promise<unknown>,
        ) => callback(transactionClient),
      );

      const result = await service.createOAuthUserAndLink(
        USER_EMAIL,
        PROVIDER,
        PROVIDER_ID,
        PROVIDER_EMAIL,
      );

      expect(transactionClient.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: USER_EMAIL,
          passwordHash: null,
          emailVerifiedAt: expect.any(Date),
        }),
      });
      expect(transactionClient.oAuthAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_ID,
          provider: PROVIDER,
          providerId: PROVIDER_ID,
          providerEmail: PROVIDER_EMAIL,
        }),
      });
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  // ──────────────────────────────────────────────
  // updateOAuthProviderEmail
  // ──────────────────────────────────────────────

  describe('updateOAuthProviderEmail', () => {
    it('calls updateMany scoped to the userId, provider, and providerId', async () => {
      (prismaMock.oAuthAccount.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.updateOAuthProviderEmail(
        USER_ID,
        PROVIDER,
        PROVIDER_ID,
        'new@gmail.com',
      );

      expect(prismaMock.oAuthAccount.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, provider: PROVIDER, providerId: PROVIDER_ID },
        data: { providerEmail: 'new@gmail.com' },
      });
    });

    it('is a no-op (no error) when the row no longer exists – concurrent unlink safety', async () => {
      // updateMany with count: 0 means no rows matched – this should not throw
      (prismaMock.oAuthAccount.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await expect(
        service.updateOAuthProviderEmail(
          USER_ID,
          PROVIDER,
          PROVIDER_ID,
          'new@gmail.com',
        ),
      ).resolves.toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────
  // listOAuthAccounts
  // ──────────────────────────────────────────────

  describe('listOAuthAccounts', () => {
    it('remaps createdAt to connectedAt on every returned account', async () => {
      const connectedDate = new Date('2026-01-15T00:00:00Z');
      (prismaMock.oAuthAccount.findMany as jest.Mock).mockResolvedValue([
        {
          provider: PROVIDER,
          providerEmail: PROVIDER_EMAIL,
          createdAt: connectedDate,
        },
      ]);

      const result = await service.listOAuthAccounts(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        provider: PROVIDER,
        providerEmail: PROVIDER_EMAIL,
        connectedAt: connectedDate,
      });
      expect(Object.keys(result[0])).not.toContain('createdAt');
    });

    it('returns an empty array when no OAuth accounts are linked', async () => {
      (prismaMock.oAuthAccount.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.listOAuthAccounts(USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // unlinkOAuthAccount
  // ──────────────────────────────────────────────

  describe('unlinkOAuthAccount', () => {
    it('calls deleteMany scoped to the userId and provider', async () => {
      (prismaMock.oAuthAccount.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.unlinkOAuthAccount(USER_ID, PROVIDER);

      expect(prismaMock.oAuthAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, provider: PROVIDER },
      });
    });

    it('resolves without error when no matching row exists (idempotent)', async () => {
      (prismaMock.oAuthAccount.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await expect(
        service.unlinkOAuthAccount(USER_ID, PROVIDER),
      ).resolves.toBeUndefined();
    });
  });
});
