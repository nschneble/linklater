import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { decrypt, encrypt } from '../common/crypto.js';
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
} from '../common/recovery-codes.js';
import { UsersService } from '../users/users.service.js';
import { SmsService } from './sms.service.js';

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Handles the SMS 2FA enrollment flow: verifying phone ownership via a
 * Twilio OTP, enabling SMS on the account, and issuing recovery codes.
 */
@Injectable()
export class SmsSetupService {
  constructor(
    private readonly usersService: UsersService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Begins SMS 2FA setup by storing the encrypted phone number and sending
   * a one-time verification code via Twilio Verify.
   *
   * @param userId - The UUID of the authenticated user.
   * @param phoneNumber - The E.164-formatted phone number to enroll.
   * @throws {BadRequestException} When the phone number format is invalid.
   * @throws {ForbiddenException} When the user's email is not yet verified.
   * @throws {ConflictException} When SMS 2FA is already enabled.
   */
  async initiateSetup(userId: string, phoneNumber: string): Promise<void> {
    if (!E164_REGEX.test(phoneNumber)) {
      throw new BadRequestException('Invalid phone number format');
    }

    const user = await this.usersService.findById(userId);

    if (!user.hasPassword) {
      throw new ForbiddenException(
        '2FA is not available for accounts created via social login',
      );
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Email must be verified before enabling SMS 2FA',
      );
    }

    if (user.smsEnabledAt) {
      throw new ConflictException('SMS 2FA is already enabled');
    }

    const encryptedPhone = encrypt(
      phoneNumber,
      process.env.PHONE_ENCRYPTION_KEY!,
    );

    await this.usersService.savePhoneNumber(userId, encryptedPhone);
    await this.smsService.sendVerification(phoneNumber);
  }

  /**
   * Completes SMS 2FA setup by checking the OTP, enabling SMS on the account,
   * and generating a fresh set of recovery codes.
   *
   * @param userId - The UUID of the authenticated user.
   * @param code - The 6-digit verification code sent to the phone.
   * @returns An array of 10 plaintext recovery codes (shown once, then discarded).
   * @throws {BadRequestException} When no phone number is stored (setup not initiated).
   * @throws {BadRequestException} When the OTP code is invalid or expired.
   */
  async verifySetup(userId: string, code: string): Promise<string[]> {
    const user = await this.usersService.findById(userId);

    if (!user.phoneNumber) {
      throw new BadRequestException(
        'No phone number found — initiate SMS setup first',
      );
    }

    const decryptedPhone = decrypt(
      user.phoneNumber,
      process.env.PHONE_ENCRYPTION_KEY!,
    );

    const isValid = await this.smsService.checkVerification(
      decryptedPhone,
      code,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid or expired code');
    }

    await this.usersService.enableSms(userId);

    const plainCodes = generateRecoveryCodes();
    const codeHashes = await hashRecoveryCodes(plainCodes);

    await this.usersService.deleteRecoveryCodes(userId);
    await this.usersService.createRecoveryCodes(userId, codeHashes);

    return plainCodes;
  }

  /**
   * Resends the SMS verification code to the phone number stored for the user.
   * Called from the MFA challenge screen when the user requests a new code.
   *
   * @param userId - The UUID of the user requesting a resend.
   * @throws {BadRequestException} When no phone number is stored for the user.
   */
  async smsResend(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user.phoneNumber) {
      throw new BadRequestException(
        'No phone number found — initiate SMS setup first',
      );
    }

    const decryptedPhone = decrypt(
      user.phoneNumber,
      process.env.PHONE_ENCRYPTION_KEY!,
    );

    await this.smsService.sendVerification(decryptedPhone);
  }
}
