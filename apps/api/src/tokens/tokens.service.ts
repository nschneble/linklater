import { createHash, randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

export const TOKEN_PREFIX = 'ltk_';

const DISPLAY_PREFIX_LENGTH = 12;

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string) {
    const rawToken = TOKEN_PREFIX + randomBytes(24).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const prefix = rawToken.slice(0, DISPLAY_PREFIX_LENGTH);

    const stored = await this.prisma.apiToken.create({
      data: { name, prefix, tokenHash, userId },
    });

    return {
      id: stored.id,
      name: stored.name,
      prefix: stored.prefix,
      createdAt: stored.createdAt,
      lastUsedAt: stored.lastUsedAt,
      rawToken,
    };
  }

  async findAll(userId: string) {
    const tokens = await this.prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map(({ id, name, prefix, createdAt, lastUsedAt }) => ({
      id,
      name,
      prefix,
      createdAt,
      lastUsedAt,
    }));
  }

  async revoke(userId: string, tokenId: string) {
    try {
      await this.prisma.apiToken.delete({
        where: { id: tokenId, userId },
      });
    } catch {
      throw new NotFoundException('API token not found');
    }
  }

  async validateToken(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      return null;
    }

    await this.prisma.apiToken.update({
      where: { tokenHash },
      data: { lastUsedAt: new Date() },
    });

    return stored.user;
  }
}
