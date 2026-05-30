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
 * Manages TOTP (Time-based One-Time Password) multi-factor authentication
 * setup and verification for user accounts.
 *
 * TOTP secrets are encrypted with AES-256-GCM before storage. The encryption
 * key is provided via the `TOTP_ENCRYPTION_KEY` environment variable as a
 * 64-character hex string (32 bytes).
 */
@Injectable()
export class TotpService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Starts or resumes TOTP enrollment for the given user. Generates a new
   * secret and QR code URI on first call; returns the same QR code on
   * subsequent calls so a scan already in progress is not invalidated.
   *
   * The generated secret is AES-256-GCM encrypted before being written to
   * `user.totpSecret`. `totpEnabledAt` stays `null` until `verifySetup`
   * is called with a matching code.
   *
   * @param userId - UUID of the user enabling MFA.
   * @param userEmail - Shown as the account label inside the authenticator
   *   app (e.g. "user@example.com").
   * @returns `{ qrCodeDataUrl, secret }` — the data-URL for the QR image and
   *   the plaintext base-32 secret for manual entry.
   * @throws {ConflictException} When TOTP is already fully enabled for this
   *   account.
   * @throws {ForbiddenException} When the account was created via an identity
   *   provider and has no password, or when the email is not yet verified.
   */
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
        'MFA is not available for accounts created via IdP',
      );
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Email must be verified before enabling MFA',
      );
    }

    // If setup is already pending (secret stored but not yet verified), return
    // the same QR code so concurrent calls don't invalidate a scan in progress.
    if (user.totpSecret && !user.totpEnabledAt) {
      const existingSecret = decrypt(
        user.totpSecret,
        process.env.TOTP_ENCRYPTION_KEY!,
      );
      return {
        qrCodeDataUrl: await QRCode.toDataURL(
          this.buildTotpUri(existingSecret, userEmail),
        ),
        secret: existingSecret,
      };
    }

    const secret = generateSecret();
    const qrCodeDataUrl = await QRCode.toDataURL(
      this.buildTotpUri(secret, userEmail),
    );

    const encryptedSecret = encrypt(secret, process.env.TOTP_ENCRYPTION_KEY!);
    await this.usersService.saveTotpSecret(userId, encryptedSecret);

    return { qrCodeDataUrl, secret };
  }

  /**
   * Completes TOTP enrollment. Decrypts the pending secret, validates the
   * supplied 6-digit code (±30 s window), then atomically enables TOTP and
   * stores fresh recovery codes.
   *
   * The setup OTP step is recorded as `totpLastUsedStep` so the same code
   * cannot be replayed on the very first login attempt.
   *
   * @param userId - UUID of the user completing setup.
   * @param code - 6-digit TOTP code from the authenticator app.
   * @returns Array of 10 plaintext recovery codes shown once to the user.
   * @throws {BadRequestException} When there is no pending setup or the code
   *   is invalid.
   */
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

  /**
   * Abandons an in-flight TOTP enrollment by clearing the pending secret.
   * Idempotent — calling this when no setup is pending is a no-op. The
   * underlying `clearPendingTotpSecret` filters on `totpEnabledAt: null` at
   * the DB layer, so a fully-enabled account is silently skipped rather than
   * racing a concurrent `verifySetup` call.
   *
   * @param userId - UUID of the user cancelling setup.
   * @throws {ConflictException} When TOTP is already fully enabled; callers
   *   should direct the user to the disable endpoint instead.
   */
  async cancelSetup(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (user.totpEnabledAt) {
      throw new ConflictException(
        'TOTP is already active; use the disable endpoint instead',
      );
    }

    await this.usersService.clearPendingTotpSecret(userId);
  }

  /**
   * Validates a TOTP code during login (not during initial setup). Uses an
   * atomic compare-and-swap on `totpLastUsedStep` to reject replays: two
   * parallel requests with the same valid code inside the same 30-second
   * window both pass the cryptographic check, but only the first one to write
   * `totpLastUsedStep` returns `true`. The second receives `false`.
   *
   * @param user - Partial user record with `id`, `totpSecret`, and
   *   `totpLastUsedStep`. Callers should load these from the database.
   * @param code - 6-digit TOTP code from the authenticator app.
   * @returns `true` when the code is valid and not a replay; `false`
   *   otherwise.
   * @throws {BadRequestException} When TOTP is not configured for this account
   *   (no stored secret).
   */
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

  private buildTotpUri(secret: string, userEmail: string): string {
    return generateURI({
      secret,
      label: userEmail,
      issuer: 'Linklater',
      strategy: 'totp',
    });
  }
}
