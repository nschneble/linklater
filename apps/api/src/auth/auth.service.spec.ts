import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const KNOWN_PASSWORD = 'L4+036MA76pkTpOQm/gu+Ljp';
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
        id: '3079C0DA-0F39-4127-ACE3-F554592C49E8',
        email: 'jake@brooklyn99.com',
        passwordHash: KNOWN_HASH,
      });

      const result = await service.validateUser(
        'jake@brooklyn99.com',
        KNOWN_PASSWORD,
      );

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('passwordHash');
      expect(result?.email).toBe('jake@brooklyn99.com');
    });

    it('returns null when password is wrong', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
        id: '31844487-ECC9-4F3B-BD63-57B58A98FDD2',
        email: 'bruno@bakeoff.ca',
        passwordHash: KNOWN_HASH,
      });

      const result = await service.validateUser(
        'bruno@bakeoff.ca',
        'wrong wrong wrong wrong wrong',
      );

      expect(result).toBeNull();
    });

    it('returns null when user is not found', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser(
        'patrick@sewingbee.co.uk',
        'tweedlover',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns an accessToken when given a user with id', async () => {
      (jwtServiceMock.sign as jest.Mock).mockReturnValue('signed-token');

      const result = await service.login({
        id: 'CD501719-8337-474F-8B34-5DB59BF3A11D',
        email: 'grace@hailmary.gov',
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        subject: 'CD501719-8337-474F-8B34-5DB59BF3A11D',
        email: 'grace@hailmary.gov',
      });
      expect(result.accessToken).toBe('signed-token');
    });

    it('returns an accessToken when given a user with userId', async () => {
      const result = await service.login({
        userId: '9C72FBB7-1C0D-4BBA-A97C-C99BD526DE8A',
        email: 'rocky@hailmary.gov',
      });

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        subject: '9C72FBB7-1C0D-4BBA-A97C-C99BD526DE8A',
        email: 'rocky@hailmary.gov',
      });
      expect(result.accessToken).toBe('signed-token');
    });
  });
});
