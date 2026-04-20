import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, Prisma } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';

export interface CreateLinkInput {
  url: string;
  title?: string;
  notes?: string;
}

export interface UpdateLinkInput {
  title?: string;
  notes?: string;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export interface LinksQuery {
  search?: string;
  archived?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class LinksService {
  private readonly logger = new Logger(LinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

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

    void this.queueService
      .send(QUEUES.METADATA_FETCH, { linkId: link.id, url: link.url })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to enqueue metadata fetch for link ${link.id}: ${String(error)}`,
        );
      });

    return link;
  }

  async findAll(userId: string, query: LinksQuery) {
    const { search, archived, page = 1, limit = DEFAULT_LIMIT } = query;
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const safePage = Math.max(page, 1);

    const where: Prisma.LinkWhereInput = {
      userId,
    };

    if (archived === true) {
      where.archivedAt = { not: null };
    } else if (archived === false) {
      where.archivedAt = null;
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      // NOTE: contains with insensitive mode generates ILIKE '%term%' in PostgreSQL,
      // which cannot use B-tree indexes and does a sequential scan. For large datasets
      // this should be replaced with a full-text search index (tsvector).
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { url: { contains: term, mode: 'insensitive' } },
        { host: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.link.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip: (safePage - 1) * safeLimit,
      }),
      this.prisma.link.count({ where }),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
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

  private mapP2025ToNotFound(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Link not found');
    }
    throw error;
  }

  async update(userId: string, id: string, input: UpdateLinkInput) {
    try {
      return await this.prisma.link.update({
        where: { id, userId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });
    } catch (error) {
      this.mapP2025ToNotFound(error);
    }
  }

  async archive(userId: string, id: string) {
    try {
      return await this.prisma.link.update({
        where: { id, userId },
        data: { archivedAt: new Date() },
      });
    } catch (error) {
      this.mapP2025ToNotFound(error);
    }
  }

  async unarchive(userId: string, id: string) {
    try {
      return await this.prisma.link.update({
        where: { id, userId },
        data: { archivedAt: null },
      });
    } catch (error) {
      this.mapP2025ToNotFound(error);
    }
  }

  async remove(userId: string, id: string) {
    try {
      await this.prisma.link.delete({ where: { id, userId } });
    } catch (error) {
      this.mapP2025ToNotFound(error);
    }
    return { success: true };
  }

  async getRandom(userId: string, archived = false) {
    const where: Prisma.LinkWhereInput = {
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
