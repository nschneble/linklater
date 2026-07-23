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
// Provide a real class for `instanceof Prisma.PrismaClientKnownRequestError`
// checks so service code can branch on Prisma error codes (P2002 etc.).
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
const NEW_PASSWORD = 'open-toasted-sesame';
const SITE_MODE = 'dark';
const THEME_NAME = 'scanner-darkly';
const UNKNOWN_PASSWORD = 'open-poppy-seed';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const USER_PASSWORD = 'open-sesame';

const PENDING_EMAIL = 'pending.email@addy.com';

const makeUser = (overrides = {}) => ({
  cvdMode: false,
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
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    extensionAuthCode: {
      deleteMany: jest.fn(),
    },
    $transaction: jest
      .fn()
      .mockImplementation(async (operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
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
      // Concurrent registrations race past any preflight existence check, so
      // the service relies on the database constraint and translates P2002
      // into a 409 instead of letting Prisma's error escape as a 500.
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

  describe('updateMe', () => {
    it('throws BadRequestException when changing password without currentPassword', async () => {
      await expect(
        service.updateMe(USER_ID, { password: NEW_PASSWORD }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when user is not found during password change', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateMe(USER_ID, {
          currentPassword: KNOWN_PASSWORD,
          password: NEW_PASSWORD,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when currentPassword is wrong', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await expect(
        service.updateMe(USER_ID, {
          currentPassword: UNKNOWN_PASSWORD,
          password: NEW_PASSWORD,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('updates password hash when currentPassword is correct', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, {
        currentPassword: KNOWN_PASSWORD,
        password: NEW_PASSWORD,
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.not.stringMatching(NEW_PASSWORD),
          }),
        }),
      );
    });

    it('updates theme when a valid theme is provided', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, { theme: THEME_NAME });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ theme: THEME_NAME }),
        }),
      );
    });

    it('updates mode when a valid mode is provided', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, { mode: SITE_MODE });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mode: SITE_MODE }),
        }),
      );
    });

    it('throws BadRequestException for an invalid theme', async () => {
      await expect(
        service.updateMe(USER_ID, { theme: 'not-a-real-theme' }),
      ).rejects.toThrow(BadRequestException);
    });

    // Invisibility contract for the OFF-BOOK `branding` theme. `branding` is a
    // real CSS cascade (web theme/styles/branding.css) the marketing/API-docs
    // chrome activates via `data-theme='branding'` when logged out, but it must
    // NEVER be a persistable user theme. Unlike a random string, it is a
    // plausible leak — a future hand could copy it into VALID_THEMES alongside
    // the film themes. Assert the allow-list rejects it so that mistake throws.
    it('rejects the off-book branding theme (not user-selectable)', async () => {
      await expect(
        service.updateMe(USER_ID, { theme: 'branding' }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for an invalid mode', async () => {
      await expect(
        service.updateMe(USER_ID, { mode: 'sepia' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns user without passwordHash after update', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.updateMe(USER_ID, { theme: THEME_NAME });

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('accepts apollo-10-1-2 as a valid theme', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, { theme: 'apollo-10-1-2' });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ theme: 'apollo-10-1-2' }),
        }),
      );
    });

    it('updates cvdMode when provided', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, { cvdMode: true });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ cvdMode: true }),
        }),
      );
    });

    it('updates customThemeEnabled when provided', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, { customThemeEnabled: true });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customThemeEnabled: true }),
        }),
      );
    });

    it('does not write customThemeEnabled when it is omitted', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, { theme: THEME_NAME });

      const updateArgument = (prismaMock.user.update as jest.Mock).mock
        .calls[0][0] as { data: Record<string, unknown> };
      expect(updateArgument.data).not.toHaveProperty('customThemeEnabled');
    });

    it('persists customTheme verbatim when provided', async () => {
      const customTheme = {
        dark: { '--mount-border': '#102030' },
        light: { '--mount-border': '#fefefe' },
      };
      (prismaMock.user.update as jest.Mock).mockResolvedValue(
        makeUser({ customTheme }),
      );

      await service.updateMe(USER_ID, { customTheme });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customTheme }),
        }),
      );
    });

    it('does not write customTheme when it is omitted', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, { theme: THEME_NAME });

      const updateArgument = (prismaMock.user.update as jest.Mock).mock
        .calls[0][0] as { data: Record<string, unknown> };
      expect(updateArgument.data).not.toHaveProperty('customTheme');
    });

    it('returns the persisted customTheme on the updated user', async () => {
      const customTheme = { dark: { '--base-bg': '#000000' } };
      (prismaMock.user.update as jest.Mock).mockResolvedValue(
        makeUser({ customTheme }),
      );

      const result = await service.updateMe(USER_ID, { customTheme });

      expect(result).toMatchObject({ customTheme });
    });

    it('rejects a customTheme with an unknown token key', async () => {
      // Service-layer test proves only the WIRING: the guard runs and blocks
      // the write. The individual rejection branches (unknown key, oversized,
      // prototype pollution) are owned by custom-theme.spec.ts.
      await expect(
        service.updateMe(USER_ID, {
          customTheme: { dark: { '--not-a-real-token': '#000000' } },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
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

  describe('resetPasswordWithToken', () => {
    it('updates password hash and clears reset token fields', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());
      const newHash = 'hashed-new-password';

      await service.resetPasswordWithToken(USER_ID, newHash);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          passwordHash: newHash,
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });
    });

    it('includes emailVerifiedAt when markVerified is true', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());
      const newHash = 'hashed-new-password';

      await service.resetPasswordWithToken(USER_ID, newHash, true);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          passwordHash: newHash,
          resetToken: null,
          resetTokenExpiresAt: null,
          emailVerifiedAt: expect.any(Date),
        },
      });
    });
  });

  describe('confirmPendingEmail', () => {
    it('moves pendingEmail to email and clears pending fields', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.confirmPendingEmail(USER_ID, PENDING_EMAIL);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          email: PENDING_EMAIL,
          emailVerifiedAt: expect.any(Date),
          pendingEmail: null,
          pendingEmailToken: null,
          pendingEmailTokenExpiresAt: null,
          verificationToken: null,
          verificationTokenExpiresAt: null,
        },
      });
    });
  });

  describe('updateMe (SSO user)', () => {
    it('throws BadRequestException when SSO user attempts to change password', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(
        makeUser({ passwordHash: null }),
      );

      await expect(
        service.updateMe(USER_ID, {
          currentPassword: KNOWN_PASSWORD,
          password: NEW_PASSWORD,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setFirstPassword', () => {
    it('hashes the password and updates the user record', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(
        makeUser({ passwordHash: null }),
      );
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.setFirstPassword(USER_ID, USER_PASSWORD);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: expect.not.stringMatching(USER_PASSWORD),
          }),
        }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.setFirstPassword(USER_ID, USER_PASSWORD),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the user already has a password', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await expect(
        service.setFirstPassword(USER_ID, USER_PASSWORD),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markEmailVerified', () => {
    it('sets emailVerifiedAt on the user record', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.markEmailVerified(USER_ID);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { emailVerifiedAt: expect.any(Date) },
      });
    });
  });

  describe('verifyEmailAndInvalidateStalePassword', () => {
    it('sets emailVerifiedAt, nulls passwordHash, and bumps tokenVersion, atomically with revoking every outstanding session', async () => {
      (prismaMock.user.update as jest.Mock).mockReturnValue(
        Promise.resolve(makeUser()),
      );
      (prismaMock.refreshToken.deleteMany as jest.Mock).mockReturnValue(
        Promise.resolve({ count: 1 }),
      );
      (prismaMock.extensionAuthCode.deleteMany as jest.Mock).mockReturnValue(
        Promise.resolve({ count: 0 }),
      );

      await service.verifyEmailAndInvalidateStalePassword(USER_ID);

      // All three writes must be handed to $transaction together – splitting
      // the tokenVersion bump from the session revocation reopens a race
      // where an in-flight refresh() reads the new version before the old
      // refresh token is deleted (see the method's docstring).
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          emailVerifiedAt: expect.any(Date),
          passwordHash: null,
          tokenVersion: { increment: 1 },
        },
      });
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(prismaMock.extensionAuthCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
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
