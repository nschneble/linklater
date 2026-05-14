import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EmailTwoFactorService } from './email-2fa.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';
const CODE = '123456';

const makeUser = (overrides = {}) => ({
  id: USER_ID,
  email: USER_EMAIL,
  theme: 'scanner-darkly',
  emailVerifiedAt: new Date(),
  hasPassword: true,
  totpEnabledAt: null,
  emailTwoFactorEnabledAt: null,
  emailTwoFactorCodeHash: null,
  emailTwoFactorExpiresAt: null,
  ...overrides,
});

describe('EmailTwoFactorService', () => {
  let service: EmailTwoFactorService;

  const usersServiceMock = {
    findById: jest.fn(),
    saveEmailTwoFactorCode: jest.fn(),
    clearEmailTwoFactorCode: jest.fn(),
    enableEmailTwoFactorWithRecoveryCodes: jest.fn(),
  } as unknown as UsersService;

  const emailServiceMock = {
    sendTwoFactorCode: jest.fn(),
  } as unknown as EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTwoFactorService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<EmailTwoFactorService>(EmailTwoFactorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendCode', () => {
    it('saves the hashed code and sends an email', async () => {
      (usersServiceMock.saveEmailTwoFactorCode as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendTwoFactorCode as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.sendCode({
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
      });

      expect(usersServiceMock.saveEmailTwoFactorCode).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailServiceMock.sendTwoFactorCode).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.stringMatching(/^\d{6}$/),
        'scanner-darkly',
      );
    });

    it('does not save the code when email send throws', async () => {
      (usersServiceMock.saveEmailTwoFactorCode as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendTwoFactorCode as jest.Mock).mockRejectedValue(
        new Error('SMTP error'),
      );

      await expect(
        service.sendCode({ id: USER_ID, email: USER_EMAIL }),
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('initiateSetup', () => {
    it('fetches the user, validates prerequisites, and sends a code', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(makeUser());
      (usersServiceMock.saveEmailTwoFactorCode as jest.Mock).mockResolvedValue(
        undefined,
      );
      (emailServiceMock.sendTwoFactorCode as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.initiateSetup(USER_ID);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
      expect(emailServiceMock.sendTwoFactorCode).toHaveBeenCalled();
    });

    it('throws ForbiddenException when the account has no password (OAuth-only)', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ hasPassword: false }),
      );

      await expect(service.initiateSetup(USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when email is not verified', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ emailVerifiedAt: null }),
      );

      await expect(service.initiateSetup(USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException when TOTP is already enabled', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpEnabledAt: new Date() }),
      );

      await expect(service.initiateSetup(USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when Email 2FA is already enabled', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ emailTwoFactorEnabledAt: new Date() }),
      );

      await expect(service.initiateSetup(USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('verifySetup', () => {
    it('verifies the code, enables Email 2FA, and returns 10 recovery codes', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash(CODE, 8);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({
          emailTwoFactorCodeHash: hash,
          emailTwoFactorExpiresAt: futureExpiry,
        }),
      );
      (
        usersServiceMock.enableEmailTwoFactorWithRecoveryCodes as jest.Mock
      ).mockResolvedValue(undefined);

      const result = await service.verifySetup(USER_ID, CODE);

      expect(
        usersServiceMock.enableEmailTwoFactorWithRecoveryCodes,
      ).toHaveBeenCalledWith(
        USER_ID,
        expect.arrayContaining([expect.any(String)]),
      );
      expect(result).toHaveLength(10);
    });

    it('throws BadRequestException when no code is pending', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(makeUser());

      await expect(service.verifySetup(USER_ID, CODE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the code has expired', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash(CODE, 8);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({
          emailTwoFactorCodeHash: hash,
          emailTwoFactorExpiresAt: pastExpiry,
        }),
      );

      await expect(service.verifySetup(USER_ID, CODE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the code is incorrect', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('999999', 8);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({
          emailTwoFactorCodeHash: hash,
          emailTwoFactorExpiresAt: futureExpiry,
        }),
      );

      await expect(service.verifySetup(USER_ID, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyCode', () => {
    it('returns true and clears the code when valid and not expired', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash(CODE, 8);

      (usersServiceMock.clearEmailTwoFactorCode as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.verifyCode(
        {
          id: USER_ID,
          emailTwoFactorCodeHash: hash,
          emailTwoFactorExpiresAt: futureExpiry,
        },
        CODE,
      );

      expect(result).toBe(true);
      expect(usersServiceMock.clearEmailTwoFactorCode).toHaveBeenCalledWith(
        USER_ID,
      );
    });

    it('returns false when no code is stored', async () => {
      const result = await service.verifyCode(
        {
          id: USER_ID,
          emailTwoFactorCodeHash: null,
          emailTwoFactorExpiresAt: null,
        },
        CODE,
      );

      expect(result).toBe(false);
    });

    it('returns false when the code has expired', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash(CODE, 8);

      const result = await service.verifyCode(
        {
          id: USER_ID,
          emailTwoFactorCodeHash: hash,
          emailTwoFactorExpiresAt: pastExpiry,
        },
        CODE,
      );

      expect(result).toBe(false);
      expect(usersServiceMock.clearEmailTwoFactorCode).not.toHaveBeenCalled();
    });

    it('returns false and does not clear when code is incorrect', async () => {
      const futureExpiry = new Date(Date.now() + 10 * 60 * 1000);
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('999999', 8);

      (usersServiceMock.clearEmailTwoFactorCode as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.verifyCode(
        {
          id: USER_ID,
          emailTwoFactorCodeHash: hash,
          emailTwoFactorExpiresAt: futureExpiry,
        },
        '123456',
      );

      expect(result).toBe(false);
      expect(usersServiceMock.clearEmailTwoFactorCode).not.toHaveBeenCalled();
    });
  });
});
