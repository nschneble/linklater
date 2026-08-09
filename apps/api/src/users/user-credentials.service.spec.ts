import * as bcrypt from 'bcryptjs';
import { jest } from '@jest/globals';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserCredentialsService } from './user-credentials.service';

const KNOWN_PASSWORD = 'open-sesame';
const KNOWN_PASSWORD_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);
const MISSING_USER_ID = 'missing-user';
const SITE_MODE = 'dark';
const THEME_NAME = 'scanner-darkly';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const USER_PASSWORD = 'open-sesame';

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

describe('UserCredentialsService', () => {
  let service: UserCredentialsService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserCredentialsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UserCredentialsService>(UserCredentialsService);
    jest.clearAllMocks();
  });

  describe('resetPasswordWithToken', () => {
    it('updates password hash and clears reset token fields', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());
      const newHash = 'hashed-new-password';

      await service.resetPasswordWithToken(USER_ID, newHash);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          passwordHash: newHash,
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });
    });

    it('includes emailVerifiedAt when markVerified is true', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());
      const newHash = 'hashed-new-password';

      await service.resetPasswordWithToken(USER_ID, newHash, true);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          passwordHash: newHash,
          resetToken: null,
          resetTokenExpiresAt: null,
          emailVerifiedAt: expect.any(Date),
        },
      });
    });
  });

  describe('setFirstPassword', () => {
    it('hashes the password and updates the user record', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(
        makeUser({ passwordHash: null }),
      );
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.setFirstPassword(USER_ID, USER_PASSWORD);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.not.stringMatching(USER_PASSWORD),
          }),
        }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.setFirstPassword(USER_ID, USER_PASSWORD),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the user already has a password', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await expect(
        service.setFirstPassword(USER_ID, USER_PASSWORD),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCredentialState', () => {
    it('reports hasPassword true and maps the linked providers in one query', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
        passwordHash: KNOWN_PASSWORD_HASH,
        oauthAccounts: [{ provider: 'google' }, { provider: 'apple' }],
      });

      const result = await service.getCredentialState(USER_ID);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        select: {
          passwordHash: true,
          oauthAccounts: { select: { provider: true } },
        },
      });
      expect(result).toEqual({
        hasPassword: true,
        oauthProviders: ['google', 'apple'],
      });
    });

    it('reports hasPassword false for a passwordless OAuth-only account', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({
        passwordHash: null,
        oauthAccounts: [{ provider: 'google' }],
      });

      const result = await service.getCredentialState(USER_ID);

      expect(result).toEqual({
        hasPassword: false,
        oauthProviders: ['google'],
      });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getCredentialState(MISSING_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reads through the transaction client when one is supplied', async () => {
      const transactionMock = {
        user: { findUnique: jest.fn() },
      } as unknown as Prisma.TransactionClient;
      (transactionMock.user.findUnique as jest.Mock).mockResolvedValue({
        passwordHash: null,
        oauthAccounts: [{ provider: 'google' }],
      });

      await service.getCredentialState(USER_ID, transactionMock);

      expect(transactionMock.user.findUnique).toHaveBeenCalled();
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('lockUserRow', () => {
    it('issues a FOR UPDATE row lock scoped to the user on the given client', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([{ id: USER_ID }]);

      await service.lockUserRow(
        USER_ID,
        prismaMock as unknown as Prisma.TransactionClient,
      );

      const [strings, ...values] = (prismaMock.$queryRaw as jest.Mock).mock
        .calls[0] as [TemplateStringsArray, ...unknown[]];
      expect(strings.join('')).toMatch(/FOR UPDATE/);
      expect(strings.join('')).toMatch(/"User"/);
      expect(values).toContain(USER_ID);
    });
  });
});
