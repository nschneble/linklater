import { BadRequestException, Injectable } from '@nestjs/common';
import { expiresInMs, generateHexToken, sha256Hex } from '../common/index.js';
import { EmailQueueService } from '../email/index.js';
import { UserTokensService } from '../users/user-tokens.service.js';
import { UsersService } from '../users/users.service.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Manages password-less email login via one-time magic link tokens.
 * The raw 64-character hex token is sent via email; only its SHA-256 hash is
 * persisted, so a database read cannot impersonate a user. Each token expires
 * after 15 minutes and is cleared on first use.
 */
@Injectable()
export class MagicLinkService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userTokensService: UserTokensService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  /**
   * Generates a magic link token for the given email and sends it. Silently
   * returns when no account exists for the address to prevent enumeration.
   *
   * @param email - The email address to send the magic link to.
   */
  async requestLogin(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    const rawToken = generateHexToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = expiresInMs(FIFTEEN_MINUTES_MS);

    await this.userTokensService.updateMagicLinkToken(
      user.id,
      tokenHash,
      expiresAt,
    );
    await this.emailQueueService.enqueueMagicLink(
      user.email,
      rawToken,
      user.theme,
    );
  }

  /**
   * Validates a magic link token. Clears the token on success to prevent reuse.
   *
   * @param rawToken - The 64-character hex token from the login link.
   * @returns The user record associated with the token.
   * @throws {BadRequestException} When the token is not found or has expired.
   */
  async verifyToken(rawToken: string) {
    const tokenHash = sha256Hex(rawToken);
    const user = await this.userTokensService.findByMagicLinkToken(tokenHash);

    if (!user || !user.magicLinkTokenExpiresAt) {
      throw new BadRequestException('Invalid or expired login link');
    }

    if (user.magicLinkTokenExpiresAt < new Date()) {
      throw new BadRequestException('This login link has expired');
    }

    const consumed = await this.userTokensService.consumeMagicLinkToken(
      user.id,
      tokenHash,
    );
    if (!consumed) {
      throw new BadRequestException('This login link has already been used');
    }
    if (!user.emailVerifiedAt) {
      // Possessing the token proves control of the inbox, but a password may
      // have been set on this row by someone else before that proof existed
      // (account-pre-hijacking) – invalidate it, and every session it could
      // have minted, in the same breath as marking verified. See
      // `UsersService.verifyEmailAndInvalidateStalePassword`.
      await this.usersService.verifyEmailAndInvalidateStalePassword(user.id);
    }
    return user;
  }

  /**
   * Creates an account (if none exists) and sends a magic link. When the
   * email is already registered, silently sends a login magic link so the
   * caller always gets a 200 response regardless of whether the address exists.
   *
   * @param email - The email address to register and send a magic link to.
   */
  async requestSignup(email: string): Promise<void> {
    const existingUser = await this.usersService.findByEmail(email);
    const user =
      existingUser ?? (await this.usersService.createWithoutPassword(email));
    if (!user) {
      return; // race-condition guard when createWithoutPassword loses the race
    }

    const rawToken = generateHexToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = expiresInMs(FIFTEEN_MINUTES_MS);
    await this.userTokensService.updateMagicLinkToken(
      user.id,
      tokenHash,
      expiresAt,
    );
    await this.emailQueueService.enqueueMagicLink(email, rawToken, user.theme);
  }
}
