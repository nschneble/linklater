import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const KNOWN_PASSWORD = 'perfect flake practice';
const KNOWN_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);

const makeUser = (overrides = {}) => ({
  id: '4F925A26-62D5-41AD-8FE3-8A62054FA308',
  email: 'mary.crumbs@bakeverse.co',
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

      const result = await service.create(
        'mary.crumbs@bakeverse.co',
        'perfect flake practice',
      );

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'mary.crumbs@bakeverse.co',
            passwordHash: expect.not.stringMatching('perfect flake practice'),
          }),
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws ConflictException when email is already in use', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await expect(
        service.create('mary.crumbs@bakeverse.co', 'perfect flake practice'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateMe', () => {
    it('updates email when it is not in use by another user', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaMock.user.update as jest.Mock).mockResolvedValue(
        makeUser({ email: 'sue.celebrate@bakeverse.uk' }),
      );

      await service.updateMe('77021635-4F5F-40A5-9696-4E69CC09B32B', {
        email: 'sue.celebrate@bakeverse.uk',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'sue.celebrate@bakeverse.uk',
          }),
        }),
      );
    });

    it('throws ConflictException when new email belongs to a different user', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(
        makeUser({ id: 'frodo-baggins' }),
      );

      await expect(
        service.updateMe('23F4FDAC-B595-4BC1-968B-9A2FBBB9FEB6', {
          email: 'frodo.baggins@mythrealm.shire',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when changing password without currentPassword', async () => {
      await expect(
        service.updateMe('7EE8FF6E-EDD3-49A5-B94F-15E1A9691969', {
          password: 'tenting and triumph',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException when currentPassword is wrong', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await expect(
        service.updateMe('5F05CBAB-464C-4513-9F78-852E81231D70', {
          password: 'tenting and triumph',
          currentPassword: 'definitely extremely wrong',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('updates password hash when currentPassword is correct', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe('A0C7847A-B602-4DFF-9CCF-5B0A53D8CBFB', {
        password: 'tenting and triumph',
        currentPassword: KNOWN_PASSWORD,
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.not.stringMatching('tenting and triumph'),
          }),
        }),
      );
    });

    it('throws BadRequestException for an invalid theme', async () => {
      await expect(
        service.updateMe('5A84A187-3B65-4629-8655-FE8DE3E618CC', {
          theme: 'not-a-real-theme',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for an invalid mode', async () => {
      await expect(
        service.updateMe('5BAB3652-A1D3-44C3-9829-70F3DBCC1C32', {
          mode: 'sepia',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('returns user without passwordHash', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.findById(
        '92C2762D-A22D-4E4A-B324-09B04072984D',
      );

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('mary.crumbs@bakeverse.co');
    });

    it('throws NotFoundException when user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteById', () => {
    it('delegates deletion to prisma', async () => {
      (prismaMock.user.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteById('95B7389C-1218-4287-94E5-F2851D118B69');

      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: '95B7389C-1218-4287-94E5-F2851D118B69' },
      });
    });
  });
});
