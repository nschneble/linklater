import * as bcrypt from 'bcryptjs';
import { jest } from '@jest/globals';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
// real error class so the service's Prisma error-code branches (P2002) work
jest.mock('../prisma/generated/client', () => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, options: { code: string }) {
      super(message);
      this.code = options.code;
    }
  }
  return {
    Prisma: {
      PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
    },
  };
});

import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const KNOWN_PASSWORD = 'open-sesame';
const KNOWN_PASSWORD_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);
const MISSING_USER_ID = 'missing-user';
const SITE_MODE = 'dark';
const THEME_NAME = 'scanner-darkly';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const USER_PASSWORD = 'open-sesame';

const makeUser = (overrides = {}) => ({
  cvdMode: false,
  dyslexicFont: false,
  customTheme: null,
  customThemeEnabled: false,
  createdAt: new Date(),
  email: USER_EMAIL,
  emailVerifiedAt: null,
  id: USER_ID,
  mode: SITE_MODE,
  passwordHash: KNOWN_PASSWORD_HASH,
  pendingEmail: null,
  pendingEmailToken: null,
  pendingEmailTokenExpiresAt: null,
  theme: THEME_NAME,
  updatedAt: new Date(),
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    user: {
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
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
      (prismaMock.user.create as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.create(USER_EMAIL, USER_PASSWORD);

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: USER_EMAIL,
            passwordHash: expect.not.stringMatching(USER_PASSWORD),
          }),
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws ConflictException when Prisma reports a P2002 unique-constraint violation', async () => {
      // races beat preflight checks, so the DB constraint maps P2002 to a 409
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002' },
      );
      (prismaMock.user.create as jest.Mock).mockRejectedValue(p2002);

      await expect(service.create(USER_EMAIL, USER_PASSWORD)).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws non-P2002 Prisma errors', async () => {
      const otherError = new Prisma.PrismaClientKnownRequestError(
        'Some other Prisma error',
        { code: 'P2010' },
      );
      (prismaMock.user.create as jest.Mock).mockRejectedValue(otherError);

      await expect(service.create(USER_EMAIL, USER_PASSWORD)).rejects.toThrow(
        'Some other Prisma error',
      );
    });
  });

  describe('findByEmail', () => {
    it('looks up user by email field', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.findByEmail(USER_EMAIL);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: USER_EMAIL },
      });
      expect(result).not.toBeNull();
    });

    it('returns null when email is not found', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns user without passwordHash', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.findById(USER_ID);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe(USER_EMAIL);
    });

    it('includes hasPassword: true when passwordHash is set', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.findById(USER_ID);

      expect(result).toHaveProperty('hasPassword', true);
    });

    it('includes hasPassword: false when passwordHash is null', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(
        makeUser({ passwordHash: null }),
      );

      const result = await service.findById(USER_ID);

      expect(result).toHaveProperty('hasPassword', false);
    });

    it('returns the stored customTheme so the front-end can hydrate it', async () => {
      const customTheme = { dark: { '--mount-border': '#102030' } };
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(
        makeUser({ customTheme }),
      );

      const result = await service.findById(USER_ID);

      expect(result).toMatchObject({ customTheme });
    });

    it('returns customTheme: null for a user who has never saved one', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.findById(USER_ID);

      expect(result.customTheme).toBeNull();
    });

    it('throws NotFoundException when user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById(MISSING_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteById', () => {
    it('delegates deletion to prisma', async () => {
      (prismaMock.user.delete as jest.Mock).mockResolvedValue(undefined);

      await service.deleteById(USER_ID);

      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: USER_ID },
      });
    });
  });

  describe('markWelcomed', () => {
    it('sets welcomedAt when it is null', async () => {
      (prismaMock.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.markWelcomed(USER_ID);

      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: { id: USER_ID, welcomedAt: null },
        data: { welcomedAt: expect.any(Date) },
      });
    });
  });

  describe('findByIdWithPasswordHash', () => {
    it('returns the user with hasPassword: true when passwordHash is set', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.findByIdWithPasswordHash(USER_ID);

      expect(result.hasPassword).toBe(true);
      expect(result.passwordHash).toBeDefined();
    });

    it('returns the user with hasPassword: false when passwordHash is null', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(
        makeUser({ passwordHash: null }),
      );

      const result = await service.findByIdWithPasswordHash(USER_ID);

      expect(result.hasPassword).toBe(false);
    });

    it('throws NotFoundException when user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findByIdWithPasswordHash(MISSING_USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createWithoutPassword', () => {
    it('creates a user with passwordHash null and returns user without passwordHash when email is new', async () => {
      (prismaMock.user.create as jest.Mock).mockResolvedValue(
        makeUser({ passwordHash: null }),
      );

      const result = await service.createWithoutPassword(USER_EMAIL);

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: USER_EMAIL,
            passwordHash: null,
          }),
        }),
      );
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('returns null when Prisma reports P2002 (email already registered)', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002' },
      );
      (prismaMock.user.create as jest.Mock).mockRejectedValue(p2002);

      const result = await service.createWithoutPassword(USER_EMAIL);

      expect(result).toBeNull();
    });

    it('re-throws non-P2002 Prisma errors', async () => {
      const otherError = new Prisma.PrismaClientKnownRequestError(
        'Some other Prisma error',
        { code: 'P2010' },
      );
      (prismaMock.user.create as jest.Mock).mockRejectedValue(otherError);

      await expect(service.createWithoutPassword(USER_EMAIL)).rejects.toThrow(
        'Some other Prisma error',
      );
    });
  });
});
