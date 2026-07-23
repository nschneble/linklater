import { ConflictException, Injectable } from '@nestjs/common';
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
      // The provider may have updated the email between sign-ins. Mirror the
      // current value so the IdPs section in Settings stays truthful without
      // needing a manual refresh. Identity is keyed by (provider, providerId),
      // not email, so this is purely informational.
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
      // Auto-verification here is safe because we matched the user *by* this
      // email – the provider's verified-email assertion applies to the same
      // address. The link-from-Settings path (`linkOAuthAccountToUser` below)
      // gates auto-verify on an equality check for the same reason. A
      // password set on this row before now was never proven to belong to
      // this email's real owner, so it's invalidated in the same breath as
      // marking verified (account-pre-hijacking closure – see
      // `UsersService.verifyEmailAndInvalidateStalePassword`).
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
          // Same pre-hijack window as the merge branch above, reached via
          // the narrow concurrent-registration race instead of a normal
          // lookup – same closure applies.
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

  async unlinkOAuthProvider(userId: string, provider: string): Promise<void> {
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

    // Auto-verify only when the provider's email matches the account email.
    // Once federation is relaxed to allow mismatched provider emails, a
    // foreign provider email cannot be used as proof that the user controls
    // their own account email. Do NOT delete this conditional – see the
    // identity-federation design notes.
    if (!user.emailVerifiedAt && providerEmail === user.email) {
      await this.usersService.markEmailVerified(userId);
    }
  }
}
