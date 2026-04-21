import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn().mockResolvedValue({ accessToken: 'token' }),
  } as unknown as AuthService;

  const usersServiceMock = {
    create: jest.fn(),
    findById: jest.fn(),
  } as unknown as UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('delegates to UsersService.create', async () => {
      const user = {
        id: '032361A0-C019-4B27-B573-E56D93A9CE62',
        email: 'kirk.ventures@starlore.fic',
        theme: 'scanner-darkly',
        mode: 'dark',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (usersServiceMock.create as jest.Mock).mockResolvedValue(user);

      const result = await controller.register({
        email: 'kirk.ventures@starlore.fic',
        password: 'redshirts are snacks',
      } as never);

      expect(usersServiceMock.create).toHaveBeenCalledWith(
        'kirk.ventures@starlore.fic',
        'redshirts are snacks',
      );
      expect(result).toBe(user);
    });
  });

  describe('login', () => {
    it('delegates to AuthService.login with the request user', async () => {
      const request = {
        user: {
          userId: 'E074972A-53C5-4703-B9A4-18363D8577EC',
          email: 'spock.logic@starlore.space',
        },
      } as never;
      (authServiceMock.login as jest.Mock).mockResolvedValue({
        accessToken: 'token',
      });

      const result = await controller.login(request);

      expect(authServiceMock.login).toHaveBeenCalledWith(request.user);
      expect(result).toEqual({ accessToken: 'token' });
    });
  });

  describe('me', () => {
    it('returns user with id remapped to userId', async () => {
      const request = {
        user: {
          userId: '1F3D88F8-2050-461C-A099-F1454BC6FD20',
          email: 'picard.captain@starlore.gal',
        },
      } as never;
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: '1F3D88F8-2050-461C-A099-F1454BC6FD20',
        email: 'picard.captain@starlore.gal',
        theme: 'scanner-darkly',
        mode: 'dark',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await controller.me(request);

      expect(result).not.toHaveProperty('id');
      expect(result.userId).toBe('1F3D88F8-2050-461C-A099-F1454BC6FD20');
      expect(result.email).toBe('picard.captain@starlore.gal');
    });
  });
});
