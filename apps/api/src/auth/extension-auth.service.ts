import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { generateHexToken, sha256Hex } from '../common/crypto-tokens.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function expiresInMs(ms: number) {
  return new Date(Date.now() + ms);
}

/**
 * Browser-extension PKCE authorization flow. Issues short-lived,
 * hash-stored authorization codes that the extension trades for a
 * full refresh-token pair via the code-verifier exchange.
 *
 * Extracted from `AuthService` to keep the core auth service focused on
 * password/MFA/OAuth flows; the extension code path has its own lifecycle
 * (allowed redirect URIs, PKCE verifier mechanics, code hashing) that is
 * mechanically independent of normal browser sign-in.
 */
@Injectable()
export class ExtensionAuthService implements OnModuleInit {
  private readonly logger = new Logger(ExtensionAuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (!process.env.EXTENSION_REDIRECT_URIS) {
      this.logger.warn(
        'EXTENSION_REDIRECT_URIS is not set — the browser extension authorization flow will reject all redirect URIs. Set this to a comma-separated list of allowed extension callback URIs.',
      );
    }
  }

  async authorizeExtension(
    userId: string,
    codeChallenge: string,
    redirectUri: string,
  ): Promise<{ code: string; callbackUrl: string }> {
    if (!codeChallenge || !redirectUri) {
      throw new BadRequestException(
        'code_challenge and redirect_uri are required',
      );
    }

    const allowedUris = process.env.EXTENSION_REDIRECT_URIS
      ? process.env.EXTENSION_REDIRECT_URIS.split(',').map((uri) => uri.trim())
      : [];

    if (!allowedUris.includes(redirectUri)) {
      throw new BadRequestException('Invalid redirect_uri');
    }

    const code = await this.createExtensionAuthCode(userId, codeChallenge);
    return { code, callbackUrl: redirectUri };
  }

  async createExtensionAuthCode(
    userId: string,
    codeChallenge: string,
  ): Promise<string> {
    const rawCode = generateHexToken();
    const codeHash = sha256Hex(rawCode);
    const expiresAt = expiresInMs(FIVE_MINUTES_MS);

    await this.prisma.extensionAuthCode.create({
      data: { codeHash, codeChallenge, userId, expiresAt },
    });

    return rawCode;
  }

  async exchangeExtensionCode(rawCode: string, codeVerifier: string) {
    const codeHash = sha256Hex(rawCode);
    const stored = await this.prisma.extensionAuthCode.findUnique({
      where: { codeHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    const computedChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    if (computedChallenge !== stored.codeChallenge) {
      throw new UnauthorizedException('Invalid code verifier');
    }

    await this.prisma.extensionAuthCode.delete({ where: { id: stored.id } });
    return this.issueTokenPair(stored.userId, stored.user.email);
  }

  private async issueTokenPair(userId: string, email: string) {
    const rawRefreshToken = generateHexToken();
    const tokenHash = sha256Hex(rawRefreshToken);
    const expiresAt = new Date(Date.now() + ONE_YEAR_MS);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    const accessToken = this.jwtService.sign({ subject: userId, email });
    return { accessToken, refreshToken: rawRefreshToken };
  }
}
