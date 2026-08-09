import * as bcrypt from 'bcryptjs';
import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { PrismaService } from '../prisma/prisma.service';
import { UserEmailVerificationService } from './user-email-verification.service';

const KNOWN_PASSWORD = 'open-sesame';
const KNOWN_PASSWORD_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);
const PENDING_EMAIL = 'pending.email@addy.com';
const SITE_MODE = 'dark';
const THEME_NAME = 'scanner-darkly';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

const makeUser = (overrides = {}) => ({
  cvdMode: false,
  dyslexicFont: false,
  customTheme: null,
  customThemeEnabled: false,
  createdAt: new Date(),
  email: USER_EMAIL,
  emailVerifiedAt: null,
  id: USER_ID,
  mode: SITE_MODE,
  passwordHash: KNOWN_PASSWORD_HASH,
  pendingEmail: null,
  pendingEmailToken: null,
  pendingEmailTokenExpiresAt: null,
  theme: THEME_NAME,
  updatedAt: new Date(),
  ...overrides,
});

describe('UserEmailVerificationService', () => {
  let service: UserEmailVerificationService;

  const prismaMock = {
    user: {
      update: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    extensionAuthCode: {
      deleteMany: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserEmailVerificationService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UserEmailVerificationService>(
      UserEmailVerificationService,
    );
    jest.clearAllMocks();
  });

  describe('markEmailVerified', () => {
    it('sets emailVerifiedAt on the user record', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.markEmailVerified(USER_ID);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { emailVerifiedAt: expect.any(Date) },
      });
    });
  });

  describe('confirmPendingEmail', () => {
    it('moves pendingEmail to email and clears pending fields', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.confirmPendingEmail(USER_ID, PENDING_EMAIL);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          email: PENDING_EMAIL,
          emailVerifiedAt: expect.any(Date),
          pendingEmail: null,
          pendingEmailToken: null,
          pendingEmailTokenExpiresAt: null,
          verificationToken: null,
          verificationTokenExpiresAt: null,
        },
      });
    });
  });

  describe('verifyEmailAndInvalidateStalePassword', () => {
    it('sets emailVerifiedAt, nulls passwordHash, and bumps tokenVersion, atomically with revoking every outstanding session', async () => {
      (prismaMock.user.update as jest.Mock).mockReturnValue(
        Promise.resolve(makeUser()),
      );
      (prismaMock.refreshToken.deleteMany as jest.Mock).mockReturnValue(
        Promise.resolve({ count: 1 }),
      );
      (prismaMock.extensionAuthCode.deleteMany as jest.Mock).mockReturnValue(
        Promise.resolve({ count: 0 }),
      );

      await service.verifyEmailAndInvalidateStalePassword(USER_ID);

      // all three writes share one $transaction, else refresh() races the revoke
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          emailVerifiedAt: expect.any(Date),
          passwordHash: null,
          tokenVersion: { increment: 1 },
        },
      });
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(prismaMock.extensionAuthCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
    });
  });
});
