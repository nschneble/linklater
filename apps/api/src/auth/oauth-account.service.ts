import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../prisma/index.js';
import { UserOAuthService, UsersService } from '../users/index.js';
import { generateLinkState } from './oauth-link-state.js';

@Injectable()
export class OAuthAccountService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userOAuthService: UserOAuthService,
  ) {}

  async findOrCreateOAuthUser(
    provider: string,
    providerId: string,
    email: string,
  ): Promise<{ userId: string; email: string }> {
    const account = await this.userOAuthService.findOAuthAccount(
      provider,
      providerId,
    );
    if (account) {
      // mirror provider email; identity keys on (provider, providerId), not email
      if (account.providerEmail !== email) {
        await this.userOAuthService.updateOAuthProviderEmail(
          account.userId,
          provider,
          providerId,
          email,
        );
      }
      return { userId: account.userId, email: account.user.email };
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      await this.userOAuthService.linkOAuthAccount(
        existingUser.id,
        provider,
        providerId,
        email,
      );
      // matched by this email, so auto-verify is safe; invalidate any stale
      // password to close the account-pre-hijack window
      if (!existingUser.emailVerifiedAt) {
        await this.usersService.verifyEmailAndInvalidateStalePassword(
          existingUser.id,
        );
      }
      return { userId: existingUser.id, email: existingUser.email };
    }

    try {
      const newUser = await this.userOAuthService.createOAuthUserAndLink(
        email,
        provider,
        providerId,
        email,
      );
      return { userId: newUser.id, email };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raceAccount = await this.userOAuthService.findOAuthAccount(
          provider,
          providerId,
        );
        if (raceAccount) {
          return { userId: raceAccount.userId, email: raceAccount.user.email };
        }
        const raceUser = await this.usersService.findByEmail(email);
        if (raceUser) {
          // same pre-hijack closure as above, reached via the registration race
          if (!raceUser.emailVerifiedAt) {
            await this.usersService.verifyEmailAndInvalidateStalePassword(
              raceUser.id,
            );
          }
          return { userId: raceUser.id, email: raceUser.email };
        }
      }
      throw error;
    }
  }

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
    const linkState = generateLinkState(userId, process.env.JWT_SECRET!);
    const parameters = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_LINK_CALLBACK_URL!,
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
   * @throws {BadRequestException} When the account has no password and this is
   *   its only remaining linked provider.
   */
  async unlinkOAuthProvider(userId: string, provider: string): Promise<void> {
    const { hasPassword, oauthProviders } =
      await this.usersService.getCredentialState(userId);
    const remainingProviders = oauthProviders.filter(
      (linked) => linked !== provider,
    );
    if (!hasPassword && remainingProviders.length === 0) {
      throw new BadRequestException('No password set – cannot disconnect.');
    }
    await this.userOAuthService.unlinkOAuthAccount(userId, provider);
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
