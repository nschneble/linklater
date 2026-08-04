import { jest } from '@jest/globals';

process.env.TOTP_ENCRYPTION_KEY = 'a'.repeat(64);

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { generate, generateSecret } from 'otplib';
import { Test, TestingModule } from '@nestjs/testing';

import { TotpService } from './totp.service';
import { UserMfaService } from '../users/user-mfa.service';
import { UsersService } from '../users/users.service';

const USER_EMAIL = 'user@example.com';
const USER_ID = 'user-1';

const makeUser = (overrides = {}) => ({
  id: USER_ID,
  email: USER_EMAIL,
  emailVerifiedAt: new Date(),
  hasPassword: true,
  totpSecret: null,
  totpVerifiedAt: null,
  totpEnabledAt: null,
  totpLastUsedStep: null,
  ...overrides,
});

describe('TotpService', () => {
  let service: TotpService;

  const usersServiceMock = {
    findById: jest.fn(),
  } as unknown as UsersService;

  const userMfaServiceMock = {
    clearPendingTotpSecret: jest.fn(),
    enableTotpWithRecoveryCodes: jest.fn(),
    saveTotpSecret: jest.fn(),
    updateTotpLastUsedStep: jest.fn(),
  } as unknown as UserMfaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TotpService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: UserMfaService, useValue: userMfaServiceMock },
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
      (userMfaServiceMock.saveTotpSecret as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.generateSetup(USER_ID, USER_EMAIL);

      expect(result.qrCodeDataUrl).toMatch(/^data:image/);
      expect(typeof result.secret).toBe('string');
      expect(result.secret.length).toBeGreaterThan(0);
    });

    it('allows setup when only totpVerifiedAt is set but totpEnabledAt is null', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpVerifiedAt: new Date(), totpEnabledAt: null }),
      );

      const result = await service.generateSetup(USER_ID, USER_EMAIL);

      expect(result.qrCodeDataUrl).toMatch(/^data:image/);
    });

    it('throws ConflictException when totpEnabledAt is set (prevents silent secret rotation)', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpEnabledAt: new Date() }),
      );

      await expect(service.generateSetup(USER_ID, USER_EMAIL)).rejects.toThrow(
        ConflictException,
      );
    });

    it('allows passwordless accounts (SSO or magic link) to set up MFA', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ hasPassword: false }),
      );

      const result = await service.generateSetup(USER_ID, USER_EMAIL);

      expect(result).toHaveProperty('qrCodeDataUrl');
      expect(result).toHaveProperty('secret');
    });

    it('throws ForbiddenException when emailVerifiedAt is null', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ emailVerifiedAt: null }),
      );

      await expect(service.generateSetup(USER_ID, USER_EMAIL)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the same QR code when setup is already pending (idempotent)', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpSecret: encryptedSecret, totpEnabledAt: null }),
      );

      const result = await service.generateSetup(USER_ID, USER_EMAIL);

      expect(result.qrCodeDataUrl).toMatch(/^data:image/);
      expect(result.secret).toBe(secret);
      expect(userMfaServiceMock.saveTotpSecret).not.toHaveBeenCalled();
    });
  });

  describe('verifySetup', () => {
    it('enables TOTP atomically, generates 10 recovery codes, and returns them', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpSecret: encryptedSecret }),
      );
      (
        userMfaServiceMock.enableTotpWithRecoveryCodes as jest.Mock
      ).mockResolvedValue(undefined);

      const code = await generate({ secret });
      const result = await service.verifySetup(USER_ID, code);

      expect(
        userMfaServiceMock.enableTotpWithRecoveryCodes,
      ).toHaveBeenCalledWith(USER_ID, expect.any(Array), expect.any(Number));
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

  describe('cancelSetup', () => {
    it('clears the pending TOTP secret when setup is not yet enabled', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpSecret: 'encrypted-pending-secret' }),
      );
      (
        userMfaServiceMock.clearPendingTotpSecret as jest.Mock
      ).mockResolvedValue(undefined);

      await service.cancelSetup(USER_ID);

      expect(userMfaServiceMock.clearPendingTotpSecret).toHaveBeenCalledWith(
        USER_ID,
      );
    });

    it('is a no-op (still calls clear) when nothing is pending', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(makeUser());
      (
        userMfaServiceMock.clearPendingTotpSecret as jest.Mock
      ).mockResolvedValue(undefined);

      await service.cancelSetup(USER_ID);

      expect(userMfaServiceMock.clearPendingTotpSecret).toHaveBeenCalledWith(
        USER_ID,
      );
    });

    it('throws ConflictException when TOTP is already enabled', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ totpEnabledAt: new Date() }),
      );

      await expect(service.cancelSetup(USER_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(userMfaServiceMock.clearPendingTotpSecret).not.toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    it('returns true for a valid TOTP code and records the used time step', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      (
        userMfaServiceMock.updateTotpLastUsedStep as jest.Mock
      ).mockResolvedValue(true);

      const user = makeUser({ totpSecret: encryptedSecret });
      const code = await generate({ secret });
      expect(await service.verifyCode(user, code)).toBe(true);
      expect(userMfaServiceMock.updateTotpLastUsedStep).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Number),
      );
    });

    it('returns false when the CAS swap loses to a parallel verify-otp request', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      // first wins the CAS; second (same 30s step) fails the step update
      (
        userMfaServiceMock.updateTotpLastUsedStep as jest.Mock
      ).mockResolvedValue(false);

      const user = makeUser({ totpSecret: encryptedSecret });
      const code = await generate({ secret });
      expect(await service.verifyCode(user, code)).toBe(false);
      expect(userMfaServiceMock.updateTotpLastUsedStep).toHaveBeenCalled();
    });

    it('returns false for an invalid TOTP code and does not update the step', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      const user = makeUser({ totpSecret: encryptedSecret });
      expect(await service.verifyCode(user, '000000')).toBe(false);
      expect(userMfaServiceMock.updateTotpLastUsedStep).not.toHaveBeenCalled();
    });

    it('rejects a valid code whose time step was already used (replay prevention)', async () => {
      const secret = generateSecret();
      const { encrypt } = await import('../common/crypto.js');
      const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);

      // simulate the current 30-second window having already been consumed
      const currentStep = Math.floor(Date.now() / 1000 / 30);
      const user = makeUser({
        totpSecret: encryptedSecret,
        totpLastUsedStep: currentStep,
      });
      const code = await generate({ secret });
      expect(await service.verifyCode(user, code)).toBe(false);
      expect(userMfaServiceMock.updateTotpLastUsedStep).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when no totpSecret is set', async () => {
      await expect(service.verifyCode(makeUser(), '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
