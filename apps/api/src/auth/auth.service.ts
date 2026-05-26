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
  RECOVERY_CODE_REGEX,
  findMatchingRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCodes,
} from '../common/recovery-codes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService, withoutPasswordHash } from '../users/index.js';
import { EmailVerificationService } from './email-verification.service.js';
import { MagicLinkService } from './magic-link.service.js';
import { TotpService } from './totp.service.js';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly magicLinkService: MagicLinkService,
    private readonly totpService: TotpService,
    private readonly prisma: PrismaService,
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
      this.usersService.listOAuthAccounts(userId),
    ]);

    const twoFactorMethod: 'totp' | null = totpEnabledAt ? 'totp' : null;
    const connectedProviders = oauthAccounts.map((account) => ({
      provider: account.provider,
      providerEmail: account.providerEmail,
      connectedAt: account.connectedAt,
    }));

    return {
      userId: id,
      ...rest,
      twoFactorMethod,
      twoFactorPending: !!totpSecret && !totpEnabledAt,
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
   * so all login paths (password, OAuth, magic-link) share a single 2FA gate
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
      await this.usersService.setMfaNonce(userId, nonce);
      const mfaToken = this.jwtService.sign(
        { subject: userId, mfaPending: true, nonce },
        { expiresIn: '5m' },
      );
      return { mfaToken, mfaMethod: 'totp' as const };
    }
    return this.issueTokenPair(userId, user.email);
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = sha256Hex(rawRefreshToken);

    // Lookup + delete + re-issue in a single transaction so a crash mid-rotation
    // cannot leave the user without a refresh token, and concurrent refresh
    // requests for the same raw token cannot race: the loser's deleteMany
    // returns count === 0 and we map that to a clean 401 rather than letting
    // a Prisma P2025 leak out as a 500.
    return this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!stored || stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const { count } = await transaction.refreshToken.deleteMany({
        where: { id: stored.id, tokenHash },
      });
      if (count === 0) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const rawNewRefreshToken = generateHexToken();
      const newTokenHash = sha256Hex(rawNewRefreshToken);
      const expiresAt = expiresInMs(ONE_YEAR_MS);
      await transaction.refreshToken.create({
        data: { tokenHash: newTokenHash, userId: stored.userId, expiresAt },
      });
      const accessToken = this.jwtService.sign({
        subject: stored.userId,
        email: stored.user.email,
      });
      return { accessToken, refreshToken: rawNewRefreshToken };
    });
  }

  async revokeAllRefreshTokens(userId: string) {
    await Promise.all([
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.extensionAuthCode.deleteMany({ where: { userId } }),
    ]);
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
    return this.login(user.id);
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
      await this.usersService.clearMfaNonce(userId);
      return this.issueTokenPair(userId, user.email);
    }

    if (method === 'recovery') {
      if (!enrolledMethod)
        throw new UnauthorizedException('No 2FA method enrolled');

      const recoveryCodes =
        await this.usersService.findUnusedRecoveryCodes(userId);
      const hashes = recoveryCodes.map((recoveryCode) => recoveryCode.codeHash);
      const matchIndex = await findMatchingRecoveryCode(code, hashes);

      if (matchIndex === null)
        throw new UnauthorizedException('Invalid recovery code');

      // markRecoveryCodeUsed returns false when a parallel verify lost the
      // race to consume the same code — treat that as an invalid code so
      // two concurrent requests cannot both succeed on one recovery code.
      const consumed = await this.usersService.markRecoveryCodeUsed(
        recoveryCodes[matchIndex].id,
      );
      if (!consumed) {
        throw new UnauthorizedException('Invalid recovery code');
      }
      await this.usersService.clearMfaNonce(userId);
      return this.issueTokenPair(userId, user.email);
    }

    throw new UnauthorizedException('Invalid OTP');
  }

  async disable2fa(userId: string, currentPassword?: string, code?: string) {
    await this.reauthenticate(userId, currentPassword, code);
    await this.usersService.disableTwoFactor(userId);
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

  // Shared re-auth guard used by disable2fa and regenerateRecoveryCodes.
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
      const isRecoveryCode = RECOVERY_CODE_REGEX.test(code);

      if (isRecoveryCode) {
        if (!user.totpEnabledAt)
          throw new UnauthorizedException('No 2FA method enrolled');

        const recoveryCodes =
          await this.usersService.findUnusedRecoveryCodes(userId);
        const hashes = recoveryCodes.map(
          (recoveryCode) => recoveryCode.codeHash,
        );
        const matchIndex = await findMatchingRecoveryCode(code, hashes);
        if (matchIndex === null)
          throw new UnauthorizedException('Invalid recovery code');

        // Atomic compare-and-swap — if another request already used this
        // code, reject. See `markRecoveryCodeUsed` for the rationale.
        const consumed = await this.usersService.markRecoveryCodeUsed(
          recoveryCodes[matchIndex].id,
        );
        if (!consumed) {
          throw new UnauthorizedException('Invalid recovery code');
        }
        return;
      }

      if (user.totpEnabledAt) {
        const valid = await this.totpService.verifyCode(user, code);
        if (!valid) throw new UnauthorizedException('Invalid OTP code');
        return;
      }

      throw new UnauthorizedException('No 2FA method enrolled');
    }
  }

  private async issueRecoveryCodes(userId: string): Promise<string[]> {
    const codes = generateRecoveryCodes();
    const hashes = await hashRecoveryCodes(codes);
    await this.usersService.reissueRecoveryCodes(userId, hashes);
    return codes;
  }

  async issueTokenPair(userId: string, email: string) {
    const rawRefreshToken = generateHexToken();
    const tokenHash = sha256Hex(rawRefreshToken);
    const expiresAt = expiresInMs(ONE_YEAR_MS);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    const accessToken = this.jwtService.sign({ subject: userId, email });
    return { accessToken, refreshToken: rawRefreshToken };
  }
}
