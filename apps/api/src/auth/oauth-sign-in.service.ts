import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../prisma/index.js';
import { UserOAuthService, UsersService } from '../users/index.js';

/**
 * Owns the OAuth sign-in identity path: find-or-create the user for a
 * verified provider identity, closing the account-pre-hijack window.
 *
 * Matching an incoming provider identity to a PRE-EXISTING account by email
 * is the one branch that can hand someone another person's account, so it is
 * gated on the provider asserting it verified that email. Callers pass the
 * provider's own claim (`email_verified` / `emails[].verified`); an absent
 * claim must arrive here as `false`.
 */
@Injectable()
export class OAuthSignInService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userOAuthService: UserOAuthService,
  ) {}

  async findOrCreateOAuthUser(
    provider: string,
    providerId: string,
    email: string,
    providerEmailVerified: boolean,
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
      this.assertProviderVerifiedEmail(providerEmailVerified);
      await this.userOAuthService.linkOAuthAccount(
        existingUser.id,
        provider,
        providerId,
        email,
      );
      return this.resolveExistingIdentity(existingUser);
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
          this.assertProviderVerifiedEmail(providerEmailVerified);
          return this.resolveExistingIdentity(raceUser);
        }
      }
      throw error;
    }
  }

  /**
   * Refuses to adopt an existing account when the provider will not vouch for
   * the email it just handed us. Runs before any write, so a refused sign-in
   * leaves no half-linked account behind.
   */
  private assertProviderVerifiedEmail(providerEmailVerified: boolean): void {
    if (!providerEmailVerified) {
      throw new UnauthorizedException(
        'Your provider has not verified this email address.',
      );
    }
  }

  /**
   * Finalizes sign-in for an account matched by email. Auto-verify is safe
   * because the match is by this email AND the provider vouched for it; any
   * stale password is invalidated to close the account-pre-hijack window.
   */
  private async resolveExistingIdentity(user: {
    id: string;
    email: string;
    emailVerifiedAt: Date | null;
  }): Promise<{ userId: string; email: string }> {
    if (!user.emailVerifiedAt) {
      await this.usersService.verifyEmailAndInvalidateStalePassword(user.id);
    }
    return { userId: user.id, email: user.email };
  }
}
