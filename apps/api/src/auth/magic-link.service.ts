import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EmailService } from '../email/index.js';
import { UsersService } from '../users/users.service.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

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
    if (!user) return;

    const token = generateToken();
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
    return user;
  }
}
