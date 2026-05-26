import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../prisma/index.js';
import { UsersService } from '../users/index.js';

@Injectable()
export class OAuthAccountService {
  constructor(private readonly usersService: UsersService) {}

  async findOrCreateOAuthUser(
    provider: string,
    providerId: string,
    email: string,
  ): Promise<{ userId: string; email: string }> {
    const account = await this.usersService.findOAuthAccount(
      provider,
      providerId,
    );
    if (account) {
      // The provider may have updated the email between sign-ins. Mirror the
      // current value so the IdPs section in Settings stays truthful without
      // needing a manual refresh. Identity is keyed by (provider, providerId),
      // not email, so this is purely informational.
      if (account.providerEmail !== email) {
        await this.usersService.updateOAuthProviderEmail(
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
      await this.usersService.linkOAuthAccount(
        existingUser.id,
        provider,
        providerId,
        email,
      );
      // Auto-verification here is safe because we matched the user *by* this
      // email — the provider's verified-email assertion applies to the same
      // address. The link-from-Settings path (`linkOAuthAccountToUser` below)
      // gates auto-verify on an equality check for the same reason.
      if (!existingUser.emailVerifiedAt) {
        await this.usersService.markEmailVerified(existingUser.id);
      }
      return { userId: existingUser.id, email: existingUser.email };
    }

    try {
      const newUser = await this.usersService.createOAuthUserAndLink(
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
        const raceAccount = await this.usersService.findOAuthAccount(
          provider,
          providerId,
        );
        if (raceAccount) {
          return { userId: raceAccount.userId, email: raceAccount.user.email };
        }
        const raceUser = await this.usersService.findByEmail(email);
        if (raceUser) {
          return { userId: raceUser.id, email: raceUser.email };
        }
      }
      throw error;
    }
  }

  async unlinkOAuthProvider(userId: string, provider: string): Promise<void> {
    const user = await this.usersService.findByIdWithPasswordHash(userId);
    if (!user.hasPassword) {
      throw new BadRequestException(
        'Add a password before disconnecting all social providers',
      );
    }
    await this.usersService.unlinkOAuthAccount(userId, provider);
  }

  async linkOAuthAccountToUser(
    userId: string,
    provider: string,
    providerId: string,
    providerEmail: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);

    const existing = await this.usersService.findOAuthAccount(
      provider,
      providerId,
    );
    if (existing) {
      if (existing.userId === userId) return;
      throw new ConflictException(
        'This provider account is already linked to a different user',
      );
    }

    await this.usersService.linkOAuthAccount(
      userId,
      provider,
      providerId,
      providerEmail,
    );

    // Auto-verify only when the provider's email matches the account email.
    // Once federation is relaxed to allow mismatched provider emails, a
    // foreign provider email cannot be used as proof that the user controls
    // their own account email. Do NOT delete this conditional — see the
    // identity-federation design notes.
    if (!user.emailVerifiedAt && providerEmail === user.email) {
      await this.usersService.markEmailVerified(userId);
    }
  }
}
