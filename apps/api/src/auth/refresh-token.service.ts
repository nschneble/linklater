import { expiresInMs, generateHexToken, sha256Hex } from '../common/index.js';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Absolute lifetime of a single refresh token. The refresh token lives in the
 * browser's localStorage (a deliberate bearer-token design), so an XSS-stolen
 * token is usable until it expires. Rotation (see `refresh`) resets this clock
 * on every use, making expiry a *sliding* window: a session used at least once
 * per window never runs the clock out, while a stolen-but-idle token (or a
 * session abandoned for longer than this window) becomes worthless. 14 days
 * keeps the theft window short without nagging anyone who returns every couple
 * of weeks.
 *
 * The window is a promise about the token, not about the session. A client
 * that loses its stored copy is signed out however much of the window is
 * left: WebKit deletes all script-writable storage, localStorage included,
 * after seven days of browser use without a first-party interaction, and iOS
 * can evict under storage pressure. Neither is reachable from here.
 */
const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Why a `refresh` call was turned away. Recorded in the server log so a
 * reported sign-out can be matched against what the server saw around the
 * same time, and deliberately never returned to the caller: telling one of
 * these apart from another hands an attacker an oracle for probing token
 * validity. The line carries no account, so the match is by time window,
 * and only on a deployment quiet enough for that window to name one
 * request.
 *
 * - `unknown-token`: no row matched the presented hash. Covers a token that
 *   was never issued, one already rotated away, one wiped and replaced, and
 *   one revoked outright by `revokeAllRefreshTokens` (signing out
 *   everywhere, a password change, account deletion), which leaves no
 *   replacement behind.
 * - `expired`: the row existed and its window had lapsed, so the session was
 *   genuinely idle for longer than `REFRESH_TOKEN_TTL_MS`.
 * - `rotation-race`: a concurrent request rotated the row between the read
 *   and the delete, so this caller lost a race rather than presenting
 *   anything wrong.
 *
 * A client whose storage was cleared has no token to present and never
 * reaches this service. That rules the three arms above out, but it does
 * not rule the case in: a refresh that succeeded, one never attempted, a
 * request that died earlier, and a user who never signed in all leave the
 * same nothing behind.
 */
type RefreshRejectionReason = 'expired' | 'rotation-race' | 'unknown-token';

/**
 * Owns all refresh-token persistence: issuance, atomic rotation, and bulk
 * revocation. Extracted from `AuthService` so that Prisma refresh-token
 * operations are grouped in one focused provider.
 *
 * `issueTokenPair` is called directly by `AuthService` and `ExtensionAuthService`.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokenPair(userId: string, email: string, tokenVersion: number) {
    const rawRefreshToken = generateHexToken();
    const tokenHash = sha256Hex(rawRefreshToken);
    const expiresAt = expiresInMs(REFRESH_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    const accessToken = this.jwtService.sign({
      subject: userId,
      email,
      tokenVersion,
    });
    return { accessToken, refreshToken: rawRefreshToken };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = sha256Hex(rawRefreshToken);

    // single transaction: crash-safe rotation; race loser 401s not P2025 500
    return this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!stored) {
        this.rejectRefresh('unknown-token');
      }
      if (stored.expiresAt < new Date()) {
        this.rejectRefresh('expired');
      }

      const { count } = await transaction.refreshToken.deleteMany({
        where: { id: stored.id, tokenHash },
      });
      if (count === 0) {
        this.rejectRefresh('rotation-race');
      }

      const rawNewRefreshToken = generateHexToken();
      const newTokenHash = sha256Hex(rawNewRefreshToken);
      const newExpiresAt = expiresInMs(REFRESH_TOKEN_TTL_MS);
      await transaction.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          userId: stored.userId,
          expiresAt: newExpiresAt,
        },
      });
      const accessToken = this.jwtService.sign({
        subject: stored.userId,
        email: stored.user.email,
        tokenVersion: stored.user.tokenVersion,
      });
      return { accessToken, refreshToken: rawNewRefreshToken };
    });
  }

  private rejectRefresh(reason: RefreshRejectionReason): never {
    this.logger.warn(`Refresh rejected: ${reason}`);
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  async revokeAllRefreshTokens(userId: string) {
    await Promise.all([
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.extensionAuthCode.deleteMany({ where: { userId } }),
    ]);
  }
}
