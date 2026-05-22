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

  describe('findByVerificationToken', () => {
    it('looks up user by verificationToken field', async () => {
      await service.findByVerificationToken('hash');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { verificationToken: 'hash' },
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

  describe('findByResetToken', () => {
    it('looks up user by resetToken field', async () => {
      await service.findByResetToken('hash');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { resetToken: 'hash' },
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

  describe('findByMagicLinkToken', () => {
    it('looks up user by magicLinkToken field', async () => {
      await service.findByMagicLinkToken('hash');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { magicLinkToken: 'hash' },
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

  describe('findByPendingEmailToken', () => {
    it('looks up user by pendingEmailToken field', async () => {
      await service.findByPendingEmailToken(PENDING_EMAIL_TOKEN);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { pendingEmailToken: PENDING_EMAIL_TOKEN },
      });
    });
  });
});
