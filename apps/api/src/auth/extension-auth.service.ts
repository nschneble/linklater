import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { generateHexToken, sha256Hex } from '../common/crypto-tokens.js';
import { expiresInMs } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Browser-extension PKCE authorization flow. Issues short-lived,
 * hash-stored authorization codes that the extension trades for a
 * full refresh-token pair via the code-verifier exchange.
 */
@Injectable()
export class ExtensionAuthService implements OnModuleInit {
  private readonly logger = new Logger(ExtensionAuthService.name);

  private allowedRedirectUris: ReadonlySet<string> = new Set();

  constructor(
    private readonly refreshTokenService: RefreshTokenService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const raw = process.env.EXTENSION_REDIRECT_URIS;
    if (!raw) {
      this.logger.warn(
        'EXTENSION_REDIRECT_URIS is not set – the browser extension authorization flow will reject all redirect URIs. Set this to a comma-separated list of allowed extension callback URIs.',
      );
      return;
    }
    this.allowedRedirectUris = new Set(raw.split(',').map((uri) => uri.trim()));
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

    if (!this.allowedRedirectUris.has(redirectUri)) {
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
      include: { user: { select: { email: true, tokenVersion: true } } },
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
    return this.refreshTokenService.issueTokenPair(
      stored.userId,
      stored.user.email,
      stored.user.tokenVersion,
    );
  }
}
