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

const OAUTH_PROVIDER = 'google';
const OAUTH_PROVIDER_ID = 'google-uid-123';
const OAUTH_ACCOUNT_ID = 'oauth-account-1';
const PENDING_EMAIL = 'pending.email@addy.com';
const PENDING_EMAIL_TOKEN = 'pending-email-token-abc';

const makeUser = (overrides = {}) => ({
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
    oAuthAccount: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
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

    it('throws ConflictException when email is already in use', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await expect(service.create(USER_EMAIL, USER_PASSWORD)).rejects.toThrow(
        ConflictException,
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

  describe('updateVerificationToken', () => {
    it('stores verification token and expiry on the user', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());
      const token = 'verification-token-abc';
      const expiresAt = new Date(Date.now() + 86400000);

      await service.updateVerificationToken(USER_ID, token, expiresAt);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          verificationToken: token,
          verificationTokenExpiresAt: expiresAt,
        },
      });
    });
  });

  describe('findByVerificationToken', () => {
    it('looks up user by verificationToken field', async () => {
      const token = 'verification-token-abc';
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await service.findByVerificationToken(token);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { verificationToken: token },
      });
    });
  });

  describe('clearVerificationToken', () => {
    it('sets emailVerifiedAt and clears the token fields', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.clearVerificationToken(USER_ID);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          emailVerifiedAt: expect.any(Date),
          verificationToken: null,
          verificationTokenExpiresAt: null,
        },
      });
    });
  });

  describe('updateResetToken', () => {
    it('stores password reset token and expiry on the user', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());
      const token = 'reset-token-xyz';
      const expiresAt = new Date(Date.now() + 3600000);

      await service.updateResetToken(USER_ID, token, expiresAt);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          resetToken: token,
          resetTokenExpiresAt: expiresAt,
        },
      });
    });
  });

  describe('findByResetToken', () => {
    it('looks up user by resetToken field', async () => {
      const token = 'reset-token-xyz';
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await service.findByResetToken(token);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { resetToken: token },
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
  });

  describe('updatePendingEmail', () => {
    it('stores pending email, token, and expiry on the user', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());
      const expiresAt = new Date(Date.now() + 86400000);

      await service.updatePendingEmail(
        USER_ID,
        PENDING_EMAIL,
        PENDING_EMAIL_TOKEN,
        expiresAt,
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          pendingEmail: PENDING_EMAIL,
          pendingEmailToken: PENDING_EMAIL_TOKEN,
          pendingEmailTokenExpiresAt: expiresAt,
        },
      });
    });
  });

  describe('findByPendingEmailToken', () => {
    it('looks up user by pendingEmailToken field', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      await service.findByPendingEmailToken(PENDING_EMAIL_TOKEN);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { pendingEmailToken: PENDING_EMAIL_TOKEN },
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

  describe('listOAuthAccounts', () => {
    it('returns provider and connectedAt for each linked account', async () => {
      const now = new Date();
      (prismaMock.oAuthAccount.findMany as jest.Mock).mockResolvedValue([
        { provider: OAUTH_PROVIDER, createdAt: now },
      ]);

      const result = await service.listOAuthAccounts(USER_ID);

      expect(prismaMock.oAuthAccount.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: { provider: true, createdAt: true },
      });
      expect(result).toEqual([{ provider: OAUTH_PROVIDER, connectedAt: now }]);
    });

    it('returns an empty array when no providers are linked', async () => {
      (prismaMock.oAuthAccount.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.listOAuthAccounts(USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('unlinkOAuthAccount', () => {
    it('calls oAuthAccount.deleteMany with the correct where clause', async () => {
      (prismaMock.oAuthAccount.deleteMany as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.unlinkOAuthAccount(USER_ID, OAUTH_PROVIDER);

      expect(prismaMock.oAuthAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, provider: OAUTH_PROVIDER },
      });
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

  describe('createOAuthUser', () => {
    it('creates a user with null passwordHash and verified email', async () => {
      (prismaMock.user.create as jest.Mock).mockResolvedValue(
        makeUser({ passwordHash: null, emailVerifiedAt: new Date() }),
      );

      const result = await service.createOAuthUser(USER_EMAIL);

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: USER_EMAIL,
            passwordHash: null,
            emailVerifiedAt: expect.any(Date),
          }),
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('findOAuthAccount', () => {
    it('looks up OAuth account by provider and providerId', async () => {
      const account = {
        id: OAUTH_ACCOUNT_ID,
        userId: USER_ID,
        provider: OAUTH_PROVIDER,
        providerId: OAUTH_PROVIDER_ID,
        user: makeUser(),
      };
      (prismaMock.oAuthAccount.findUnique as jest.Mock).mockResolvedValue(
        account,
      );

      const result = await service.findOAuthAccount(
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
      );

      expect(prismaMock.oAuthAccount.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerId: {
            provider: OAUTH_PROVIDER,
            providerId: OAUTH_PROVIDER_ID,
          },
        },
        include: { user: true },
      });
      expect(result).not.toBeNull();
    });

    it('returns null when no matching account exists', async () => {
      (prismaMock.oAuthAccount.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findOAuthAccount(
        OAUTH_PROVIDER,
        'unknown-id',
      );

      expect(result).toBeNull();
    });
  });

  describe('linkOAuthAccount', () => {
    it('creates an OAuthAccount record linking user to provider', async () => {
      (prismaMock.oAuthAccount.create as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.linkOAuthAccount(
        USER_ID,
        OAUTH_PROVIDER,
        OAUTH_PROVIDER_ID,
      );

      expect(prismaMock.oAuthAccount.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          provider: OAUTH_PROVIDER,
          providerId: OAUTH_PROVIDER_ID,
        },
      });
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

  describe('createWithoutPassword', () => {
    it('creates a user with passwordHash null and returns user without passwordHash when email is new', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null);
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

    it('returns null when the email is already registered', async () => {
      (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

      const result = await service.createWithoutPassword(USER_EMAIL);

      expect(result).toBeNull();
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });
});
