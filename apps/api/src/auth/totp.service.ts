import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { decrypt, encrypt } from '../common/crypto.js';
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
} from '../common/recovery-codes.js';
import { UsersService } from '../users/users.service.js';

/**
 * Manages TOTP (Time-based One-Time Password) two-factor authentication setup
 * and verification for user accounts.
 *
 * TOTP secrets are encrypted with AES-256-GCM before storage. The encryption
 * key is provided via the `TOTP_ENCRYPTION_KEY` environment variable as a
 * 64-character hex string (32 bytes).
 */
@Injectable()
export class TotpService {
  constructor(private readonly usersService: UsersService) {}

  async generateSetup(
    userId: string,
    userEmail: string,
  ): Promise<{ qrCodeDataUrl: string; secret: string }> {
    const user = await this.usersService.findById(userId);

    if (user.totpVerifiedAt) {
      throw new ConflictException('TOTP is already active for this account');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email must be verified before enabling 2FA');
    }

    const secret = generateSecret();
    const uri = generateURI({
      secret,
      label: userEmail,
      issuer: 'Linklater',
      strategy: 'totp',
    });
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);
    await this.usersService.saveTotpSecret(userId, encryptedSecret);

    return { qrCodeDataUrl, secret };
  }

  async verifySetup(userId: string, code: string): Promise<string[]> {
    const user = await this.usersService.findById(userId);

    if (!user.totpSecret) {
      throw new BadRequestException('No pending TOTP setup found');
    }

    const secret = decrypt(user.totpSecret, process.env.TOTP_ENCRYPTION_KEY!);
    const result = await verify({ token: code, secret, epochTolerance: 30 });

    if (!result.valid) {
      throw new BadRequestException('Invalid code');
    }

    await this.usersService.enableTotp(userId);

    const codes = generateRecoveryCodes();
    const hashes = await hashRecoveryCodes(codes);
    await this.usersService.deleteRecoveryCodes(userId);
    await this.usersService.createRecoveryCodes(userId, hashes);

    return codes;
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);

    if (!user.totpSecret) {
      throw new BadRequestException('TOTP is not configured for this account');
    }

    const secret = decrypt(user.totpSecret, process.env.TOTP_ENCRYPTION_KEY!);
    const result = await verify({ token: code, secret, epochTolerance: 30 });

    return result.valid;
  }
}
