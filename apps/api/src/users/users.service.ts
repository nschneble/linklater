import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/index.js';
import { withoutPasswordHash } from './users.utils.js';
import { VALID_MODES, VALID_THEMES } from './users.constants.js';
import * as bcrypt from 'bcryptjs';

export { VALID_MODES, VALID_THEMES };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    return withoutPasswordHash(user);
  }

  async updateMe(
    id: string,
    data: {
      password?: string;
      currentPassword?: string;
      theme?: string;
      mode?: string;
    },
  ) {
    const updateData: {
      passwordHash?: string;
      theme?: string;
      mode?: string;
    } = {};

    if (data.password) {
      if (!data.currentPassword) {
        throw new BadRequestException(
          'Current password is required to set a new password',
        );
      }
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('User not found');
      const isValid = await bcrypt.compare(
        data.currentPassword,
        user.passwordHash,
      );
      if (!isValid)
        throw new UnauthorizedException('Current password is incorrect');
      const passwordHash = await bcrypt.hash(data.password, 12);
      updateData.passwordHash = passwordHash;
    }

    if (data.theme !== undefined) {
      if (!(VALID_THEMES as readonly string[]).includes(data.theme)) {
        throw new BadRequestException('Invalid theme');
      }
      updateData.theme = data.theme;
    }

    if (data.mode !== undefined) {
      if (!(VALID_MODES as readonly string[]).includes(data.mode)) {
        throw new BadRequestException('Invalid mode');
      }
      updateData.mode = data.mode;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return withoutPasswordHash(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return withoutPasswordHash(user);
  }

  async deleteById(id: string) {
    await this.prisma.user.delete({ where: { id } });
  }

  async updateVerificationToken(id: string, token: string, expiresAt: Date) {
    await this.prisma.user.update({
      where: { id },
      data: { verificationToken: token, verificationTokenExpiresAt: expiresAt },
    });
  }

  async findByVerificationToken(token: string) {
    return this.prisma.user.findUnique({ where: { verificationToken: token } });
  }

  async clearVerificationToken(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        emailVerifiedAt: new Date(),
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });
  }

  async updateResetToken(id: string, token: string, expiresAt: Date) {
    await this.prisma.user.update({
      where: { id },
      data: { resetToken: token, resetTokenExpiresAt: expiresAt },
    });
  }

  async findByResetToken(token: string) {
    return this.prisma.user.findUnique({ where: { resetToken: token } });
  }

  async resetPasswordWithToken(id: string, newPasswordHash: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: newPasswordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });
  }

  async updatePendingEmail(
    id: string,
    pendingEmail: string,
    token: string,
    expiresAt: Date,
  ) {
    await this.prisma.user.update({
      where: { id },
      data: {
        pendingEmail,
        pendingEmailToken: token,
        pendingEmailTokenExpiresAt: expiresAt,
      },
    });
  }

  async findByPendingEmailToken(token: string) {
    return this.prisma.user.findUnique({ where: { pendingEmailToken: token } });
  }

  async confirmPendingEmail(id: string, newEmail: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        email: newEmail,
        emailVerifiedAt: new Date(),
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailTokenExpiresAt: null,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });
  }
}
