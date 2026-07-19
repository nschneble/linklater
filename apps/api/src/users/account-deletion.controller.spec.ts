import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeletionController } from './account-deletion.controller';
import { AuthService } from '../auth/auth.service';
import { CustomThrottlerGuard } from '../auth/custom-throttler.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const USER_ID = 'user-1';
const RAW_TOKEN = 'raw-confirmation-token';

describe('AccountDeletionController', () => {
  let controller: AccountDeletionController;

  const authServiceMock = {
    confirmAccountDeletion: jest.fn(),
    cancelPendingAccountDeletion: jest.fn(),
  } as unknown as AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountDeletionController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AccountDeletionController>(
      AccountDeletionController,
    );
    jest.clearAllMocks();
  });

  describe('confirm', () => {
    it('delegates to AuthService.confirmAccountDeletion with the token', async () => {
      (authServiceMock.confirmAccountDeletion as jest.Mock).mockResolvedValue({
        deleted: true,
      });

      const result = await controller.confirm({ token: RAW_TOKEN });

      expect(authServiceMock.confirmAccountDeletion).toHaveBeenCalledWith(
        RAW_TOKEN,
      );
      expect(result).toEqual({ success: true });
    });

    it('applies CustomThrottlerGuard but NOT JwtAuthGuard (callable while logged out)', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        AccountDeletionController.prototype.confirm,
      );
      expect(guards).toContain(CustomThrottlerGuard);
      expect(guards).not.toContain(JwtAuthGuard);
    });

    it('overrides the default bucket with 5 requests per 15 min', () => {
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLdefault',
        AccountDeletionController.prototype.confirm,
      );
      const limit = Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        AccountDeletionController.prototype.confirm,
      );
      expect(ttl).toBe(900000);
      expect(limit).toBe(5);
    });
  });

  describe('cancelPending', () => {
    it('delegates to AuthService.cancelPendingAccountDeletion with userId from the request', async () => {
      (
        authServiceMock.cancelPendingAccountDeletion as jest.Mock
      ).mockResolvedValue(undefined);

      const request = { user: { userId: USER_ID } } as never;
      await controller.cancelPending(request);

      expect(authServiceMock.cancelPendingAccountDeletion).toHaveBeenCalledWith(
        USER_ID,
      );
    });

    it('applies JwtAuthGuard and CustomThrottlerGuard', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        AccountDeletionController.prototype.cancelPending,
      );
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(CustomThrottlerGuard);
    });

    it('overrides the default bucket with 10 requests per 15 min', () => {
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLdefault',
        AccountDeletionController.prototype.cancelPending,
      );
      const limit = Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        AccountDeletionController.prototype.cancelPending,
      );
      expect(ttl).toBe(900000);
      expect(limit).toBe(10);
    });
  });
});
