import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateHexToken, sha256Hex } from '../common/crypto-tokens.js';
import { expiresInMs } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Absolute lifetime of a single refresh token. The refresh token lives in the
 * browser's localStorage (a deliberate bearer-token design), so an XSS-stolen
 * token is usable until it expires. Rotation (see `refresh`) resets this clock
 * on every use, making expiry a *sliding* window: an actively-used session
 * never logs out, while a stolen-but-idle token (or a session abandoned for
 * longer than this window) becomes worthless. 14 days keeps the theft window
 * short without nagging anyone who returns at least every couple of weeks.
 */
const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Owns all refresh-token persistence: issuance, atomic rotation, and bulk
 * revocation. Extracted from `AuthService` so that Prisma refresh-token
 * operations are grouped in one focused provider.
 *
 * `issueTokenPair` is called directly by `AuthService` and `ExtensionAuthService`.
 */
@Injectable()
export class RefreshTokenService {
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

  async revokeAllRefreshTokens(userId: string) {
    await Promise.all([
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.extensionAuthCode.deleteMany({ where: { userId } }),
    ]);
  }
}
