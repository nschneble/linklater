import { jest } from '@jest/globals';

import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MfaAuthGuard } from './mfa-auth.guard';
import { MultiFactorController } from './multi-factor.controller';
import { TotpService } from './totp.service';
import type { AuthRequest } from './auth-request.type';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

const makeRequest = (
  overrides: Partial<{ userId: string; email: string; nonce: string }> = {},
) =>
  ({
    user: {
      userId: USER_ID,
      email: USER_EMAIL,
      nonce: 'nonce-abc',
      ...overrides,
    },
  }) as AuthRequest;

describe('MultiFactorController', () => {
  let controller: MultiFactorController;

  const authServiceMock = {
    disableMfa: jest.fn(),
    regenerateRecoveryCodes: jest.fn(),
    verifyOtp: jest.fn(),
  } as unknown as AuthService;

  const totpServiceMock = {
    cancelSetup: jest.fn(),
    generateSetup: jest.fn(),
    verifySetup: jest.fn(),
  } as unknown as TotpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MultiFactorController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: TotpService, useValue: totpServiceMock },
      ],
    })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(MfaAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MultiFactorController>(MultiFactorController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('verifyOtp', () => {
    it('delegates to AuthService.verifyOtp and returns the result', async () => {
      const accessToken = { accessToken: 'jwt-abc' };
      (authServiceMock.verifyOtp as jest.Mock).mockResolvedValue(accessToken);

      const result = await controller.verifyOtp(makeRequest(), {
        code: '123456',
        method: 'totp',
      });

      expect(authServiceMock.verifyOtp).toHaveBeenCalledWith(
        USER_ID,
        '123456',
        'totp',
        'nonce-abc',
      );
      expect(result).toBe(accessToken);
    });
  });

  describe('totpSetup', () => {
    it('delegates to TotpService.generateSetup with userId and email', async () => {
      const setup = {
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETXYZ',
      };
      (totpServiceMock.generateSetup as jest.Mock).mockResolvedValue(setup);

      const result = await controller.totpSetup(makeRequest());

      expect(totpServiceMock.generateSetup).toHaveBeenCalledWith(
        USER_ID,
        USER_EMAIL,
      );
      expect(result).toBe(setup);
    });
  });

  describe('totpVerifySetup', () => {
    it('wraps recovery codes in { recoveryCodes } and returns them', async () => {
      const codes = ['code-1', 'code-2'];
      (totpServiceMock.verifySetup as jest.Mock).mockResolvedValue(codes);

      const result = await controller.totpVerifySetup(makeRequest(), {
        code: '654321',
      });

      expect(totpServiceMock.verifySetup).toHaveBeenCalledWith(
        USER_ID,
        '654321',
      );
      expect(result).toEqual({ recoveryCodes: codes });
    });
  });

  describe('totpCancelSetup', () => {
    it('delegates to TotpService.cancelSetup with userId and returns nothing', async () => {
      (totpServiceMock.cancelSetup as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.totpCancelSetup(makeRequest());

      expect(totpServiceMock.cancelSetup).toHaveBeenCalledWith(USER_ID);
      expect(result).toBeUndefined();
    });

    it('lets ConflictException propagate when TOTP is already enabled', async () => {
      (totpServiceMock.cancelSetup as jest.Mock).mockRejectedValue(
        new ConflictException(
          'TOTP is already active; use the disable endpoint instead',
        ),
      );

      await expect(controller.totpCancelSetup(makeRequest())).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('disableMfa', () => {
    it('delegates to AuthService.disableMfa with userId and credentials', async () => {
      (authServiceMock.disableMfa as jest.Mock).mockResolvedValue(undefined);

      await controller.disableMfa(makeRequest(), {
        currentPassword: 'my-password',
        code: undefined,
      });

      expect(authServiceMock.disableMfa).toHaveBeenCalledWith(
        USER_ID,
        'my-password',
        undefined,
      );
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('wraps new codes in { recoveryCodes } and returns them', async () => {
      const codes = ['new-1', 'new-2'];
      (authServiceMock.regenerateRecoveryCodes as jest.Mock).mockResolvedValue(
        codes,
      );

      const result = await controller.regenerateRecoveryCodes(makeRequest(), {
        currentPassword: 'my-password',
        code: undefined,
      });

      expect(authServiceMock.regenerateRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
        'my-password',
        undefined,
      );
      expect(result).toEqual({ recoveryCodes: codes });
    });
  });
});
