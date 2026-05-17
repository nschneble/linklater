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
      return { userId: account.userId, email: account.user.email };
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      await this.usersService.linkOAuthAccount(
        existingUser.id,
        provider,
        providerId,
      );
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

    if (providerEmail !== user.email) {
      throw new BadRequestException(
        'This Google account uses a different email address than your Linklater account.',
      );
    }

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

    await this.usersService.linkOAuthAccount(userId, provider, providerId);

    if (!user.emailVerifiedAt) {
      await this.usersService.markEmailVerified(userId);
    }
  }
}
