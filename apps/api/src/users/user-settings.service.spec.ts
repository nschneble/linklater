import * as bcrypt from 'bcryptjs';
import { jest } from '@jest/globals';

import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { PrismaService } from '../prisma/prisma.service';
import { UserSettingsService } from './user-settings.service';

const KNOWN_PASSWORD = 'open-sesame';
const KNOWN_PASSWORD_HASH = bcrypt.hashSync(KNOWN_PASSWORD, 1);
const NEW_PASSWORD = 'open-toasted-sesame';
const SITE_MODE = 'dark';
const THEME_NAME = 'scanner-darkly';
const UNKNOWN_PASSWORD = 'open-poppy-seed';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

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

describe('UserSettingsService', () => {
  let service: UserSettingsService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSettingsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<UserSettingsService>(UserSettingsService);
    jest.clearAllMocks();
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

    // branding is a real off-book theme (plausible leak); must never persist
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

    it('updates dyslexicFont when provided', async () => {
      (prismaMock.user.update as jest.Mock).mockResolvedValue(makeUser());

      await service.updateMe(USER_ID, { dyslexicFont: true });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dyslexicFont: true }),
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
      // proves only the wiring; rejection branches live in custom-theme.spec.ts
      await expect(
        service.updateMe(USER_ID, {
          customTheme: { dark: { '--not-a-real-token': '#000000' } },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
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
});
