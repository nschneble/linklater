import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateLinkInput {
  url: string;
  title?: string;
  notes?: string;
}

export interface UpdateLinkInput {
  title?: string;
  notes?: string;
}

export interface LinksQuery {
  search?: string;
  archived?: boolean;
}

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  private parseHost(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.host;
    } catch {
      throw new BadRequestException('Invalid URL');
    }
  }

  async create(userId: string, input: CreateLinkInput) {
    const host = this.parseHost(input.url);

    const link = await this.prisma.link.create({
      data: {
        userId,
        url: input.url,
        title: input.title ?? input.url,
        host,
        notes: input.notes ?? null,
      },
    });

    return link;
  }

  async findAll(userId: string, query: LinksQuery) {
    const { search, archived } = query;

    const where: any = {
      userId,
    };

    if (archived !== undefined) {
      where.archivedAt = archived ? { not: null } : null;
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { url: { contains: term, mode: 'insensitive' } },
        { host: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    return this.prisma.link.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, userId },
    });

    if (!link) {
      throw new NotFoundException('Link not found');
    }

    return link;
  }

  async update(userId: string, id: string, input: UpdateLinkInput) {
    await this.findOne(userId, id);

    const link = await this.prisma.link.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    return link;
  }

  async archive(userId: string, id: string) {
    await this.findOne(userId, id);

    const link = await this.prisma.link.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return link;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.link.delete({
      where: { id },
    });

    return { success: true };
  }

  async getRandom(userId: string, archived = false) {
    const where: any = {
      userId,
      archivedAt: archived ? { not: null } : null,
    };

    const count = await this.prisma.link.count({ where });

    if (count === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * count);

    const [link] = await this.prisma.link.findMany({
      where,
      skip: randomIndex,
      take: 1,
      orderBy: { createdAt: 'asc' },
    });

    return link ?? null;
  }
}
