import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const KNOWN_PASSWORD = 'password123';
const KNOWN_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    findByEmail: jest.fn(),
  } as unknown as UsersService;

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue('signed-token'),
  } as unknown as JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('returns user without passwordHash when credentials are valid', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: KNOWN_HASH,
      });

      const result = await service.validateUser(
        'test@example.com',
        KNOWN_PASSWORD,
      );

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('passwordHash');
      expect(result?.email).toBe('test@example.com');
    });

    it('returns null when password is wrong', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: KNOWN_HASH,
      });

      const result = await service.validateUser(
        'test@example.com',
        'definitelywrongpassword',
      );

      expect(result).toBeNull();
    });

    it('returns null when user is not found', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser(
        'unknown@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns an accessToken when given a user with id', async () => {
      (jwtServiceMock.sign as jest.Mock).mockReturnValue('signed-token');

      const result = await service.login({
        id: 'user-1',
        email: 'test@example.com',
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        subject: 'user-1',
        email: 'test@example.com',
      });
      expect(result.accessToken).toBe('signed-token');
    });

    it('returns an accessToken when given a user with userId', async () => {
      const result = await service.login({
        userId: 'user-1',
        email: 'test@example.com',
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        subject: 'user-1',
        email: 'test@example.com',
      });
      expect(result.accessToken).toBe('signed-token');
    });
  });
});
