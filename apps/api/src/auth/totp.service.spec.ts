import { jest } from '@jest/globals';

process.env.TOTP_ENCRYPTION_KEY = 'a'.repeat(64);

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { generate, generateSecret } from 'otplib';

import { TotpService } from './totp.service';
import { UsersService } from '../users/users.service';

const USER_EMAIL = 'user@example.com';
const USER_ID = 'user-1';

const makeUser = (overrides = {}) => ({
  id: USER_ID,
  email: USER_EMAIL,
  emailVerifiedAt: new Date(),
  totpSecret: null,
  totpVerifiedAt: null,
  totpEnabledAt: null,
  ...overrides,
});

describe('TotpService', () => {
  let service: TotpService;

  const usersServiceMock = {
    createRecoveryCodes: jest.fn(),
    deleteRecoveryCodes: jest.fn(),
    enableTotp: jest.fn(),
    findById: jest.fn(),
    saveTotpSecret: jest.fn(),
  } as unknown as UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TotpService,
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    service = module.get<TotpService>(TotpService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateSetup', () => {
    it('returns qrCodeDataUrl and plaintext secret', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(makeUser());
      (usersServiceMock.saveTotpSecret as jest.Mock).mockResolvedValue(undefined);

      const result = await service.generateSetup(USER_ID, USER_EMAIL);

      expect(result.qrCodeDataUrl).toMatch(/^data:image/);
      expect(typeof result.secret).toBe('string');
      expect(result.secret.length).toBeGreaterThan(0);
    });

    it('throws ConflictException when totpVerifiedAt is already set', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpVerifiedAt: new Date() }),
      );

      await expect(service.generateSetup(USER_ID, USER_EMAIL)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ForbiddenException when emailVerifiedAt is null', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ emailVerifiedAt: null }),
      );

      await expect(service.generateSetup(USER_ID, USER_EMAIL)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('verifySetup', () => {
    it('enables TOTP, generates 10 recovery codes, and returns them', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpSecret: encryptedSecret }),
      );
      (usersServiceMock.enableTotp as jest.Mock).mockResolvedValue(undefined);
      (usersServiceMock.deleteRecoveryCodes as jest.Mock).mockResolvedValue(undefined);
      (usersServiceMock.createRecoveryCodes as jest.Mock).mockResolvedValue(undefined);

      const code = await generate({ secret });
      const result = await service.verifySetup(USER_ID, code);

      expect(usersServiceMock.enableTotp).toHaveBeenCalledWith(USER_ID);
      expect(usersServiceMock.deleteRecoveryCodes).toHaveBeenCalledWith(USER_ID);
      expect(usersServiceMock.createRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Array),
      );
      expect(result).toHaveLength(10);
    });

    it('throws BadRequestException on invalid code', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpSecret: encryptedSecret }),
      );

      await expect(service.verifySetup(USER_ID, '000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when no totpSecret is set', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(makeUser());

      await expect(service.verifySetup(USER_ID, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyCode', () => {
    it('returns true for a valid TOTP code', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpSecret: encryptedSecret }),
      );

      const code = await generate({ secret });
      expect(await service.verifyCode(USER_ID, code)).toBe(true);
    });

    it('returns false for an invalid TOTP code', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpSecret: encryptedSecret }),
      );

      expect(await service.verifyCode(USER_ID, '000000')).toBe(false);
    });

    it('throws BadRequestException when no totpSecret is set', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(makeUser());

      await expect(service.verifyCode(USER_ID, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
