import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { requireEnv } from '../common/index.js';
import { Prisma, PrismaService } from '../prisma/index.js';
import { UserOAuthService, UsersService } from '../users/index.js';
import { generateLinkState } from './oauth-link-state.js';

@Injectable()
export class OAuthLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly userOAuthService: UserOAuthService,
  ) {}

  /**
   * Builds the Google OAuth authorization URL for the account-linking flow.
   * Signs a state token with the user's ID so the callback can verify the
   * request originated from this server and was initiated by this user.
   *
   * @param userId - The UUID of the authenticated user initiating the link.
   * @returns An object with `url` – the full Google authorization URL to
   *   navigate to, including the signed state parameter.
   */
  buildGoogleLinkUrl(userId: string): { url: string } {
    const linkState = generateLinkState(userId, requireEnv('JWT_SECRET'));
    const parameters = new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      redirect_uri: requireEnv('GOOGLE_LINK_CALLBACK_URL'),
      response_type: 'code',
      scope: 'email profile',
      state: linkState,
    });
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`,
    };
  }

  /**
   * Disconnects an OAuth provider from the user's account. Refuses when doing
   * so would strand a passwordless account with no remaining login path: a
   * user with no password whose last linked provider is the one being removed
   * would otherwise lock themselves out.
   *
   * The read, guard, and delete run inside one serializing transaction that
   * locks the user's row first. This closes a time-of-check-to-time-of-use
   * race where two concurrent unlinks of different providers on a passwordless
   * two-provider account both see the other provider surviving, both pass the
   * guard, and together strand the account. Serialized, the second unlink
   * observes the first's committed delete and is correctly refused.
   *
   * Because the guard reads after the lock releases, its correctness depends
   * on READ COMMITTED visibility; the transaction pins that isolation level
   * explicitly so a change to the global default cannot silently regress it.
   *
   * @throws {BadRequestException} When the account has no password and this is
   *   its only remaining linked provider.
   */
  async unlinkOAuthProvider(userId: string, provider: string): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        await this.usersService.lockUserRow(userId, transaction);
        const { hasPassword, oauthProviders } =
          await this.usersService.getCredentialState(userId, transaction);
        const remainingProviders = oauthProviders.filter(
          (linked) => linked !== provider,
        );
        if (!hasPassword && remainingProviders.length === 0) {
          throw new BadRequestException('No password set – cannot disconnect.');
        }
        await this.userOAuthService.unlinkOAuthAccount(
          userId,
          provider,
          transaction,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async linkOAuthAccountToUser(
    userId: string,
    provider: string,
    providerId: string,
    providerEmail: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);

    const existing = await this.userOAuthService.findOAuthAccount(
      provider,
      providerId,
    );
    if (existing) {
      if (existing.userId === userId) return;
      throw new ConflictException(
        'This provider account is already linked to a different user',
      );
    }

    await this.userOAuthService.linkOAuthAccount(
      userId,
      provider,
      providerId,
      providerEmail,
    );

    // a foreign provider email is no proof of ownership; keep this guard
    if (!user.emailVerifiedAt && providerEmail === user.email) {
      await this.usersService.markEmailVerified(userId);
    }
  }
}
