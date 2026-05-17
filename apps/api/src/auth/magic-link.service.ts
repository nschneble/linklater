import { BadRequestException, Injectable } from '@nestjs/common';
import { generateHexToken } from '../common/crypto-tokens.js';
import { EmailService } from '../email/index.js';
import { UsersService } from '../users/users.service.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Manages password-less email login via one-time magic link tokens.
 * Tokens are 64-character hex strings stored unhashed for fast direct lookup,
 * matching the pattern used by verification and password-reset tokens.
 * Each token expires after 15 minutes and is cleared on first use.
 */
@Injectable()
export class MagicLinkService {
  constructor(
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
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

    const token = generateHexToken();
    const expiresAt = new Date(Date.now() + FIFTEEN_MINUTES_MS);

    await this.usersService.updateMagicLinkToken(user.id, token, expiresAt);
    await this.emailService.sendMagicLink(user.email, token, user.theme);
  }

  /**
   * Validates a magic link token. Clears the token on success to prevent reuse.
   *
   * @param token - The 64-character hex token from the login link.
   * @returns The user record associated with the token.
   * @throws {BadRequestException} When the token is not found or has expired.
   */
  async verifyToken(token: string) {
    const user = await this.usersService.findByMagicLinkToken(token);

    if (!user || !user.magicLinkTokenExpiresAt) {
      throw new BadRequestException('Invalid or expired login link');
    }

    if (user.magicLinkTokenExpiresAt < new Date()) {
      throw new BadRequestException('This login link has expired');
    }

    await this.usersService.clearMagicLinkToken(user.id);
    if (!user.emailVerifiedAt) {
      await this.usersService.markEmailVerified(user.id);
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

    const token = generateHexToken();
    const expiresAt = new Date(Date.now() + FIFTEEN_MINUTES_MS);
    await this.usersService.updateMagicLinkToken(user.id, token, expiresAt);
    await this.emailService.sendMagicLink(email, token, user.theme);
  }
}
