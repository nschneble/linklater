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
      const user = { id: 'u1', email: 'a@b.com', theme: 'scanner-darkly', mode: 'dark', createdAt: new Date(), updatedAt: new Date() };
      (usersServiceMock.create as jest.Mock).mockResolvedValue(user);

      const result = await controller.register({ email: 'a@b.com', password: 'password123' } as never);

      expect(usersServiceMock.create).toHaveBeenCalledWith('a@b.com', 'password123');
      expect(result).toBe(user);
    });
  });

  describe('login', () => {
    it('delegates to AuthService.login with the request user', async () => {
      const req = { user: { userId: 'u1', email: 'a@b.com' } } as never;
      (authServiceMock.login as jest.Mock).mockResolvedValue({ accessToken: 'token' });

      const result = await controller.login(req);

      expect(authServiceMock.login).toHaveBeenCalledWith(req.user);
      expect(result).toEqual({ accessToken: 'token' });
    });
  });

  describe('me', () => {
    it('returns user with id remapped to userId', async () => {
      const req = { user: { userId: 'u1', email: 'a@b.com' } } as never;
      (usersServiceMock.findById as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        theme: 'scanner-darkly',
        mode: 'dark',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await controller.me(req);

      expect(result).not.toHaveProperty('id');
      expect(result.userId).toBe('u1');
      expect(result.email).toBe('a@b.com');
    });
  });
});
