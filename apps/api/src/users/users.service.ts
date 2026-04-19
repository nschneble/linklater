import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';
import { withoutPasswordHash } from './users.utils.js';

export const VALID_THEMES = [
  'scanner-darkly',
  'before-sunrise',
  'before-sunset',
  'before-midnight',
  'boyhood',
  'dazed-and-confused',
  'hit-man',
  'school-of-rock',
] as const;

export const VALID_MODES = ['light', 'dark'] as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    return withoutPasswordHash(user);
  }

  async updateMe(id: string, data: { email?: string; password?: string; theme?: string; mode?: string }) {
    const updateData: { email?: string; passwordHash?: string; theme?: string; mode?: string } = {};

    if (data.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already in use');
      }
      updateData.email = data.email;
    }

    if (data.password) {
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
}
