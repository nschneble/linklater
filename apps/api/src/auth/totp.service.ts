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

    if (user.totpEnabledAt) {
      throw new ConflictException('TOTP is already active for this account');
    }

    if (!user.hasPassword) {
      throw new ForbiddenException(
        '2FA is not available for accounts created via IdP',
      );
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Email must be verified before enabling 2FA',
      );
    }

    // If setup is already pending (secret stored but not yet verified), return
    // the same QR code so concurrent calls don't invalidate a scan in progress.
    if (user.totpSecret && !user.totpEnabledAt) {
      const existingSecret = decrypt(
        user.totpSecret,
        process.env.TOTP_ENCRYPTION_KEY!,
      );
      const existingUri = generateURI({
        secret: existingSecret,
        label: userEmail,
        issuer: 'Linklater',
        strategy: 'totp',
      });
      return {
        qrCodeDataUrl: await QRCode.toDataURL(existingUri),
        secret: existingSecret,
      };
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

    const usedStep = Math.floor(Date.now() / 1000 / 30) + result.delta;

    const codes = generateRecoveryCodes();
    const hashes = await hashRecoveryCodes(codes);
    await this.usersService.enableTotpWithRecoveryCodes(
      userId,
      hashes,
      usedStep,
    );

    return codes;
  }

  async cancelSetup(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (user.totpEnabledAt) {
      throw new ConflictException(
        'TOTP is already active; use the disable endpoint instead',
      );
    }

    await this.usersService.clearPendingTotpSecret(userId);
  }

  async verifyCode(
    user: {
      id: string;
      totpSecret: string | null;
      totpLastUsedStep: number | null;
    },
    code: string,
  ): Promise<boolean> {
    if (!user.totpSecret) {
      throw new BadRequestException('TOTP is not configured for this account');
    }

    const secret = decrypt(user.totpSecret, process.env.TOTP_ENCRYPTION_KEY!);
    const result = await verify({
      token: code,
      secret,
      epochTolerance: 30,
      afterTimeStep: user.totpLastUsedStep ?? undefined,
    });

    if (result.valid) {
      const usedStep = Math.floor(Date.now() / 1000 / 30) + result.delta;
      // Compare-and-swap. Two parallel verify-otp requests inside the same
      // 30-second TOTP step would both pass `verify()` (the otplib check
      // honors `afterTimeStep` but isn't atomic with the DB write). The
      // first to land here advances `totpLastUsedStep`; any subsequent
      // request gets `false` and is rejected as a replay.
      const advanced = await this.usersService.updateTotpLastUsedStep(
        user.id,
        usedStep,
      );
      return advanced;
    }

    return false;
  }
}
