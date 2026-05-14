import { jest } from '@jest/globals';

// Set encryption key before importing the service
process.env.PHONE_ENCRYPTION_KEY = 'b'.repeat(64);

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { SmsSetupService } from './sms-setup.service';
import { SmsService } from './sms.service';
import { UsersService } from '../users/users.service';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';
const PHONE_NUMBER = '+15555550100';
const CODE = '123456';

const makeUser = (overrides = {}) => ({
  id: USER_ID,
  email: USER_EMAIL,
  emailVerifiedAt: new Date(),
  hasPassword: true,
  smsEnabledAt: null,
  phoneNumber: null,
  ...overrides,
});

describe('SmsSetupService', () => {
  let service: SmsSetupService;

  const usersServiceMock = {
    deleteRecoveryCodes: jest.fn(),
    createRecoveryCodes: jest.fn(),
    enableSms: jest.fn(),
    findById: jest.fn(),
    savePhoneNumber: jest.fn(),
  } as unknown as UsersService;

  const smsServiceMock = {
    checkVerification: jest.fn(),
    sendVerification: jest.fn(),
  } as unknown as SmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsSetupService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: SmsService, useValue: smsServiceMock },
      ],
    }).compile();

    service = module.get<SmsSetupService>(SmsSetupService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateSetup', () => {
    it('encrypts the phone number, saves it, and sends a verification', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(makeUser());
      (usersServiceMock.savePhoneNumber as jest.Mock).mockResolvedValue(
        undefined,
      );
      (smsServiceMock.sendVerification as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.initiateSetup(USER_ID, PHONE_NUMBER);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
      const savedPhone = (usersServiceMock.savePhoneNumber as jest.Mock).mock
        .calls[0][1] as string;
      expect(savedPhone).not.toEqual(PHONE_NUMBER);
      expect(typeof savedPhone).toBe('string');
      expect(smsServiceMock.sendVerification).toHaveBeenCalledWith(
        PHONE_NUMBER,
      );
    });

    it('throws BadRequestException when phone number is invalid E.164 format', async () => {
      await expect(
        service.initiateSetup(USER_ID, '5555550100'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when phone number is too short', async () => {
      await expect(service.initiateSetup(USER_ID, '+1234567')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when the account has no password (OAuth-only)', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ hasPassword: false }),
      );

      await expect(
        service.initiateSetup(USER_ID, PHONE_NUMBER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when email is not verified', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ emailVerifiedAt: null }),
      );

      await expect(
        service.initiateSetup(USER_ID, PHONE_NUMBER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when SMS 2FA is already enabled', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ smsEnabledAt: new Date() }),
      );

      await expect(
        service.initiateSetup(USER_ID, PHONE_NUMBER),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifySetup', () => {
    it('verifies the code, enables SMS, and returns 10 recovery codes', async () => {
      // Use the actual encrypt to make a valid ciphertext
      const { encrypt } = await import('../common/crypto.js');
      const encrypted = encrypt(
        PHONE_NUMBER,
        process.env.PHONE_ENCRYPTION_KEY!,
      );

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ phoneNumber: encrypted }),
      );
      (smsServiceMock.checkVerification as jest.Mock).mockResolvedValue(true);
      (usersServiceMock.enableSms as jest.Mock).mockResolvedValue(undefined);
      (usersServiceMock.deleteRecoveryCodes as jest.Mock).mockResolvedValue(
        undefined,
      );
      (usersServiceMock.createRecoveryCodes as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.verifySetup(USER_ID, CODE);

      expect(usersServiceMock.findById).toHaveBeenCalledWith(USER_ID);
      expect(smsServiceMock.checkVerification).toHaveBeenCalledWith(
        PHONE_NUMBER,
        CODE,
      );
      expect(usersServiceMock.enableSms).toHaveBeenCalledWith(USER_ID);
      expect(usersServiceMock.deleteRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(usersServiceMock.createRecoveryCodes).toHaveBeenCalledWith(
        USER_ID,
        expect.arrayContaining([expect.any(String)]),
      );
      expect(result).toHaveLength(10);
      expect(result[0]).toEqual(expect.any(String));
    });

    it('throws BadRequestException when no phone number is stored', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ phoneNumber: null }),
      );

      await expect(service.verifySetup(USER_ID, CODE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the verification code is invalid', async () => {
      const { encrypt } = await import('../common/crypto.js');
      const encrypted = encrypt(
        PHONE_NUMBER,
        process.env.PHONE_ENCRYPTION_KEY!,
      );

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ phoneNumber: encrypted }),
      );
      (smsServiceMock.checkVerification as jest.Mock).mockResolvedValue(false);

      await expect(service.verifySetup(USER_ID, CODE)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('smsResend', () => {
    it('decrypts the stored phone and sends a new verification', async () => {
      const { encrypt } = await import('../common/crypto.js');
      const encrypted = encrypt(
        PHONE_NUMBER,
        process.env.PHONE_ENCRYPTION_KEY!,
      );

      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ phoneNumber: encrypted }),
      );
      (smsServiceMock.sendVerification as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.smsResend(USER_ID);

      expect(smsServiceMock.sendVerification).toHaveBeenCalledWith(
        PHONE_NUMBER,
      );
    });

    it('throws BadRequestException when no phone number is stored', async () => {
      (usersServiceMock.findById as jest.Mock).mockResolvedValue(
        makeUser({ phoneNumber: null }),
      );

      await expect(service.smsResend(USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
