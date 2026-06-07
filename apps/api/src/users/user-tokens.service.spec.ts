import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { PrismaService } from '../prisma/prisma.service';
import { UserTokensService } from './user-tokens.service';

const USER_ID = 'user-1';
const PENDING_EMAIL = 'pending.email@addy.com';
const PENDING_EMAIL_TOKEN = 'pending-email-token-abc';

describe('UserTokensService', () => {
  let service: UserTokensService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserTokensService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<UserTokensService>(UserTokensService);
    jest.clearAllMocks();
  });

  describe('updateVerificationToken', () => {
    it('stores verification token hash and expiry on the user', async () => {
      const token = 'verification-token-hash';
      const expiresAt = new Date(Date.now() + 86400000);
      await service.updateVerificationToken(USER_ID, token, expiresAt);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          verificationToken: token,
          verificationTokenExpiresAt: expiresAt,
        },
      });
    });
  });

  describe('clearVerificationToken', () => {
    it('sets emailVerifiedAt and clears the token fields', async () => {
      await service.clearVerificationToken(USER_ID);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          emailVerifiedAt: expect.any(Date),
          verificationToken: null,
          verificationTokenExpiresAt: null,
        },
      });
    });
  });

  describe('updateResetToken', () => {
    it('stores reset token hash and expiry on the user', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      await service.updateResetToken(USER_ID, 'hash', expiresAt);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { resetToken: 'hash', resetTokenExpiresAt: expiresAt },
      });
    });
  });

  describe('updateMagicLinkToken', () => {
    it('stores magic link token hash and expiry on the user', async () => {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await service.updateMagicLinkToken(USER_ID, 'hash', expiresAt);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { magicLinkToken: 'hash', magicLinkTokenExpiresAt: expiresAt },
      });
    });
  });

  describe('clearMagicLinkToken', () => {
    it('nullifies the magic link token and expiry on the user', async () => {
      await service.clearMagicLinkToken(USER_ID);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { magicLinkToken: null, magicLinkTokenExpiresAt: null },
      });
    });
  });

  describe('updatePendingEmail', () => {
    it('stores pending email, token hash, and expiry on the user', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      await service.updatePendingEmail(
        USER_ID,
        PENDING_EMAIL,
        PENDING_EMAIL_TOKEN,
        expiresAt,
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          pendingEmail: PENDING_EMAIL,
          pendingEmailToken: PENDING_EMAIL_TOKEN,
          pendingEmailTokenExpiresAt: expiresAt,
        },
      });
    });
  });

  describe('updateAccountDeletionToken', () => {
    it('stores account deletion token hash and expiry on the user', async () => {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await service.updateAccountDeletionToken(USER_ID, 'hash', expiresAt);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          accountDeletionToken: 'hash',
          accountDeletionTokenExpiresAt: expiresAt,
        },
      });
    });
  });

  describe('consumeAccountDeletionToken', () => {
    it('atomically clears the token only when both id and token match', async () => {
      (
        prismaMock.user.updateMany as jest.Mock<
          () => Promise<{ count: number }>
        >
      ).mockResolvedValue({ count: 1 });
      const consumed = await service.consumeAccountDeletionToken(
        USER_ID,
        'hash',
      );
      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: { id: USER_ID, accountDeletionToken: 'hash' },
        data: {
          accountDeletionToken: null,
          accountDeletionTokenExpiresAt: null,
        },
      });
      expect(consumed).toBe(true);
    });

    it('returns false when no row matched (parallel consume already won)', async () => {
      (
        prismaMock.user.updateMany as jest.Mock<
          () => Promise<{ count: number }>
        >
      ).mockResolvedValue({ count: 0 });
      const consumed = await service.consumeAccountDeletionToken(
        USER_ID,
        'hash',
      );
      expect(consumed).toBe(false);
    });
  });

  describe('clearAccountDeletionToken', () => {
    it('nullifies the account deletion token and expiry on the user', async () => {
      await service.clearAccountDeletionToken(USER_ID);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          accountDeletionToken: null,
          accountDeletionTokenExpiresAt: null,
        },
      });
    });
  });
});
