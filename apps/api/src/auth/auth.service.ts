import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { generateHexToken, sha256Hex } from '../common/crypto-tokens.js';
import { expiresInMs } from '../common/dates.js';
import {
  generateRecoveryCodes,
  hashRecoveryCodes,
  normalizeRecoveryCode,
} from '../common/recovery-codes.js';
import { EmailService } from '../email/email.service.js';
import {
  UserMfaService,
  UserOAuthService,
  UserTokensService,
  UsersService,
  withoutPasswordHash,
} from '../users/index.js';
import { EmailVerificationService } from './email-verification.service.js';
import { MagicLinkService } from './magic-link.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { TotpService } from './totp.service.js';

const ACCOUNT_DELETION_TOKEN_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userMfaService: UserMfaService,
    private readonly userOAuthService: UserOAuthService,
    private readonly jwtService: JwtService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly magicLinkService: MagicLinkService,
    private readonly totpService: TotpService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly userTokensService: UserTokensService,
    private readonly emailService: EmailService,
  ) {}

  async register(email: string, password: string) {
    const user = await this.usersService.create(email, password);
    await this.emailVerificationService.sendVerificationEmail(user.id);
    return user;
  }

  async me(userId: string) {
    const [
      {
        id,
        totpSecret,
        totpEnabledAt,
        totpVerifiedAt: _totpVerifiedAt,
        magicLinkToken: _magicLinkToken,
        magicLinkTokenExpiresAt: _magicLinkTokenExpiresAt,
        ...rest
      },
      oauthAccounts,
    ] = await Promise.all([
      this.usersService.findById(userId),
      this.userOAuthService.listOAuthAccounts(userId),
    ]);

    const multiFactorMethod: 'totp' | null = totpEnabledAt ? 'totp' : null;
    const connectedProviders = oauthAccounts.map((account) => ({
      provider: account.provider,
      providerEmail: account.providerEmail,
      connectedAt: account.connectedAt,
    }));

    return {
      userId: id,
      ...rest,
      multiFactorMethod,
      multiFactorPending: !!totpSecret && !totpEnabledAt,
      connectedProviders,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    return withoutPasswordHash(user);
  }

  /**
   * Issues a session for the given user. Fetches the user record internally
   * so all login paths (password, OAuth, magic-link) share a single MFA gate
   * — callers cannot accidentally bypass MFA by passing a stale user object.
   *
   * When the user has TOTP enabled, generates a fresh `mfaNonce` and writes
   * it to the user row before signing the MFA challenge JWT with the same
   * nonce. verifyOtp later checks the JWT's nonce against the column and
   * clears it on success, giving the MFA token single-use semantics and
   * an implicit revocation handle (rotating the column invalidates any
   * outstanding token).
   */
  async login(userId: string) {
    const user = await this.usersService.findById(userId);

    if (user.totpEnabledAt) {
      const nonce = generateHexToken();
      await this.userMfaService.setMfaNonce(userId, nonce);
      const mfaToken = this.jwtService.sign(
        { subject: userId, mfaPending: true, nonce },
        { expiresIn: '5m' },
      );
      return { mfaToken, mfaMethod: 'totp' as const };
    }
    return this.refreshTokenService.issueTokenPair(userId, user.email);
  }

  async refresh(rawRefreshToken: string) {
    return this.refreshTokenService.refresh(rawRefreshToken);
  }

  async revokeAllRefreshTokens(userId: string) {
    await this.refreshTokenService.revokeAllRefreshTokens(userId);
  }

  async requestMagicLink(email: string): Promise<void> {
    await this.magicLinkService.requestLogin(email);
  }

  async registerMagicLink(email: string): Promise<void> {
    await this.magicLinkService.requestSignup(email);
  }

  async verifyMagicLink(token: string) {
    const user = await this.magicLinkService.verifyToken(token);
    // Route through login() so TOTP-enrolled accounts hit the MFA gate
    // instead of getting a session directly from a magic-link click.
    const result = await this.login(user.id);
    // Surface the resolved userId on the non-MFA branch so the SPA can
    // detect a cross-account click (logged into B, link is for A) and
    // revoke B's sessions before swapping. MFA path stays unchanged —
    // the userId is bound to the mfaToken via the nonce and surfaced
    // after verifyOtp resolves.
    if ('accessToken' in result) {
      return { ...result, userId: user.id };
    }
    return result;
  }

  async verifyOtp(
    userId: string,
    code: string,
    method: 'totp' | 'recovery',
    nonce?: string,
  ) {
    const user = await this.usersService.findById(userId);
    const enrolledMethod = user.totpEnabledAt ? 'totp' : null;

    if (method !== 'recovery' && enrolledMethod !== method) {
      throw new UnauthorizedException('Invalid OTP method');
    }

    // Bind the MFA challenge JWT to the per-user nonce stored when login()
    // issued the token. A token with a mismatched (or missing) nonce is
    // either replayed against a row whose nonce has rotated, or forged with
    // a stale challenge, or has already been consumed.
    if (!nonce || nonce !== user.mfaNonce) {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    if (method === 'totp') {
      const isValid = await this.totpService.verifyCode(user, code);
      if (!isValid) throw new UnauthorizedException('Invalid TOTP code');
      await this.userMfaService.clearMfaNonce(userId);
      return this.refreshTokenService.issueTokenPair(userId, user.email);
    }

    if (method === 'recovery') {
      if (!enrolledMethod)
        throw new UnauthorizedException('No MFA method enrolled');

      await this.userMfaService.verifyAndConsumeRecoveryCode(userId, code);
      await this.userMfaService.clearMfaNonce(userId);
      return this.refreshTokenService.issueTokenPair(userId, user.email);
    }

    throw new UnauthorizedException('Invalid OTP');
  }

  async disableMfa(userId: string, currentPassword?: string, code?: string) {
    await this.reauthenticate(userId, currentPassword, code);
    await this.userMfaService.disableMultiFactor(userId);
  }

  async regenerateRecoveryCodes(
    userId: string,
    currentPassword?: string,
    code?: string,
  ) {
    await this.reauthenticate(userId, currentPassword, code);
    return this.issueRecoveryCodes(userId);
  }

  async setFirstPassword(userId: string, password: string): Promise<void> {
    await this.usersService.setFirstPassword(userId, password);
  }

  async markWelcomed(userId: string): Promise<void> {
    await this.usersService.markWelcomed(userId);
  }

  // Shared re-auth guard used by disableMfa and regenerateRecoveryCodes.
  // Accepts password OR OTP/recovery code — verifies exactly one.
  private async reauthenticate(
    userId: string,
    currentPassword?: string,
    code?: string,
  ) {
    if (!currentPassword && !code) {
      throw new BadRequestException(
        'Provide either currentPassword or a valid OTP code',
      );
    }

    const user = await this.usersService.findByIdWithPasswordHash(userId);

    if (currentPassword) {
      if (!user.hasPassword) {
        throw new UnauthorizedException(
          'Password authentication is not available for this account',
        );
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash!);
      if (!valid) throw new UnauthorizedException('Invalid password');
      return;
    }

    if (code) {
      if (normalizeRecoveryCode(code) !== null) {
        if (!user.totpEnabledAt)
          throw new UnauthorizedException('No MFA method enrolled');

        await this.userMfaService.verifyAndConsumeRecoveryCode(userId, code);
        return;
      }

      if (user.totpEnabledAt) {
        const valid = await this.totpService.verifyCode(user, code);
        if (!valid) throw new UnauthorizedException('Invalid OTP code');
        return;
      }

      throw new UnauthorizedException('No MFA method enrolled');
    }
  }

  private async issueRecoveryCodes(userId: string): Promise<string[]> {
    const codes = generateRecoveryCodes();
    const hashes = await hashRecoveryCodes(codes);
    await this.userMfaService.reissueRecoveryCodes(userId, hashes);
    return codes;
  }

  /**
   * Step-up authenticated account deletion. Routes to one of two paths based
   * on what credentials the user actually has on file:
   *
   * - **Credentialed path** — when the account has a password or TOTP, the
   *   caller must supply `currentPassword` OR `code` (TOTP or recovery
   *   code). Same `reauthenticate()` semantics as `disableMfa`. On success
   *   the account is deleted immediately.
   * - **Email-confirm path** — when the account has neither a password nor
   *   TOTP (magic-link-only accounts that never enrolled MFA), credentials
   *   cannot be checked against anything other than the email address. A
   *   confirmation token is persisted and emailed; deletion happens only
   *   when the user clicks the link via `confirmAccountDeletion`.
   *
   * Any `currentPassword` / `code` arguments on the email-confirm path are
   * silently ignored: there is nothing to verify them against.
   */
  async deleteAccount(
    userId: string,
    currentPassword?: string,
    code?: string,
  ): Promise<{ deleted: true } | { requiresEmailConfirmation: true }> {
    const user = await this.usersService.findByIdWithPasswordHash(userId);

    if (!user.hasPassword && !user.totpEnabledAt) {
      const rawToken = generateHexToken();
      const tokenHash = sha256Hex(rawToken);
      const expiresAt = expiresInMs(ACCOUNT_DELETION_TOKEN_TTL_MS);

      await this.userTokensService.updateAccountDeletionToken(
        userId,
        tokenHash,
        expiresAt,
      );
      await this.emailService.sendAccountDeletionConfirmation(
        user.email,
        rawToken,
        user.theme,
      );
      return { requiresEmailConfirmation: true };
    }

    await this.reauthenticate(userId, currentPassword, code);
    await this.usersService.deleteById(userId);
    return { deleted: true };
  }

  /**
   * Consumes an account-deletion confirmation token and deletes the user.
   * Used by the email-confirm path of `deleteAccount`. The raw token from
   * the URL is hashed before lookup; an atomic compare-and-swap on the
   * token column prevents replay.
   */
  async confirmAccountDeletion(rawToken: string): Promise<void> {
    const tokenHash = sha256Hex(rawToken);
    const user =
      await this.userTokensService.findByAccountDeletionToken(tokenHash);

    if (!user || !user.accountDeletionTokenExpiresAt) {
      throw new UnauthorizedException('Invalid or expired confirmation token');
    }
    if (user.accountDeletionTokenExpiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired confirmation token');
    }

    const consumed = await this.userTokensService.consumeAccountDeletionToken(
      user.id,
      tokenHash,
    );
    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired confirmation token');
    }

    await this.usersService.deleteById(user.id);
  }

  /**
   * Clears any outstanding account-deletion confirmation token for the user.
   * Backs the "Never mind, keep my account" action on the email-sent panel.
   * Idempotent — clearing already-clear columns is a no-op.
   */
  async cancelPendingAccountDeletion(userId: string): Promise<void> {
    await this.userTokensService.clearAccountDeletionToken(userId);
  }
}
