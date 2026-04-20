import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import * as bcrypt from 'bcryptjs';

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// Use a real bcrypt hash (low rounds for speed) so bcrypt.compare works without mocking
const KNOWN_PASSWORD = 'password123';
const KNOWN_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: KNOWN_HASH,
  theme: 'scanner-darkly',
  mode: 'dark',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('hashes password and creates user', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.user.create as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.create('test@example.com', 'password123');

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            // hash should not be the plain password
            passwordHash: expect.not.stringMatching('password123'),
          }),
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws ConflictException when email is already in use', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await expect(service.create('test@example.com', 'password123')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateMe', () => {
    it('updates email when it is not in use by another user', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser({ email: 'new@example.com' }));

      await service.updateMe('user-1', { email: 'new@example.com' });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'new@example.com' }) }),
      );
    });

    it('throws ConflictException when new email belongs to a different user', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser({ id: 'other-user' }));

      await expect(service.updateMe('user-1', { email: 'taken@example.com' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException when changing password without currentPassword', async () => {
      await expect(
        service.updateMe('user-1', { password: 'newpassword123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException when currentPassword is wrong', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await expect(
        service.updateMe('user-1', { password: 'newpassword123', currentPassword: 'definitelywrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('updates password hash when currentPassword is correct', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe('user-1', { password: 'newpassword123', currentPassword: KNOWN_PASSWORD });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.not.stringMatching('newpassword123'),
          }),
        }),
      );
    });

    it('throws BadRequestException for an invalid theme', async () => {
      await expect(
        service.updateMe('user-1', { theme: 'not-a-real-theme' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for an invalid mode', async () => {
      await expect(
        service.updateMe('user-1', { mode: 'sepia' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('returns user without passwordHash', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.findById('user-1');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
    });

    it('throws NotFoundException when user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteById', () => {
    it('delegates deletion to prisma', async () => {
      (prismaMock.user.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteById('user-1');

      expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });
});
