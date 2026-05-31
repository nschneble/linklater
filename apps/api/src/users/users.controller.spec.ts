import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { CustomThrottlerGuard } from '../auth/custom-throttler.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    findById: jest.fn(),
    updateMe: jest.fn(),
  } as unknown as UsersService;

  const authServiceMock = {
    deleteAccount: jest.fn(),
  } as unknown as AuthService;

  const makeRequest = (userId = USER_ID) => ({ user: { userId } }) as never;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getMe delegates to UsersService.findById with userId from request', async () => {
    const user = { email: USER_EMAIL, id: USER_ID };
    (usersServiceMock.findById as jest.Mock).mockResolvedValue(user);

    const result = await controller.getMe(makeRequest());

    expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
    expect(result).toBe(user);
  });

  it('updateMe delegates to UsersService.updateMe with userId from request', async () => {
    const updated = { email: USER_EMAIL, id: USER_ID };
    (usersServiceMock.updateMe as jest.Mock).mockResolvedValue(updated);

    const result = await controller.updateMe(makeRequest(), {
      email: USER_EMAIL,
    } as never);

    expect(usersServiceMock.updateMe).toHaveBeenCalledWith(USER_ID, {
      email: USER_EMAIL,
    });
    expect(result).toBe(updated);
  });

  describe('deleteMe', () => {
    it('delegates to AuthService.deleteAccount with the credentials from the body', async () => {
      (authServiceMock.deleteAccount as jest.Mock).mockResolvedValue({
        deleted: true,
      });

      const result = await controller.deleteMe(makeRequest(), {
        currentPassword: 'pw',
      } as never);

      expect(authServiceMock.deleteAccount).toHaveBeenCalledWith(
        USER_ID,
        'pw',
        undefined,
      );
      expect(result).toEqual({ success: true });
    });

    it('forwards an OTP/recovery code when supplied', async () => {
      (authServiceMock.deleteAccount as jest.Mock).mockResolvedValue({
        deleted: true,
      });

      await controller.deleteMe(makeRequest(), {
        code: '123456',
      } as never);

      expect(authServiceMock.deleteAccount).toHaveBeenCalledWith(
        USER_ID,
        undefined,
        '123456',
      );
    });

    it('returns requiresEmailConfirmation on the email-confirm path', async () => {
      (authServiceMock.deleteAccount as jest.Mock).mockResolvedValue({
        requiresEmailConfirmation: true,
      });

      const result = await controller.deleteMe(makeRequest(), {} as never);

      expect(result).toEqual({
        success: true,
        requiresEmailConfirmation: true,
      });
    });

    it('accepts an empty body (magic-link-only branch sends no creds)', async () => {
      (authServiceMock.deleteAccount as jest.Mock).mockResolvedValue({
        requiresEmailConfirmation: true,
      });

      await controller.deleteMe(makeRequest(), {} as never);

      expect(authServiceMock.deleteAccount).toHaveBeenCalledWith(
        USER_ID,
        undefined,
        undefined,
      );
    });

    it('applies JwtAuthGuard and CustomThrottlerGuard with auth-reauth bucket', () => {
      const guards: unknown[] = Reflect.getMetadata(
        '__guards__',
        UsersController.prototype.deleteMe,
      );
      expect(guards).toContain(CustomThrottlerGuard);

      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLauth-reauth',
        UsersController.prototype.deleteMe,
      );
      const limit = Reflect.getMetadata(
        'THROTTLER:LIMITauth-reauth',
        UsersController.prototype.deleteMe,
      );
      expect(ttl).toBe(900000);
      expect(limit).toBe(5);
    });

    it('applies JwtAuthGuard at class level', () => {
      const classGuards: unknown[] = Reflect.getMetadata(
        '__guards__',
        UsersController,
      );
      expect(classGuards).toContain(JwtAuthGuard);
    });
  });
});
