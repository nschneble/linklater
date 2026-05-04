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
}

export type UpdateLinkInput = object;

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

export interface LinksQuery {
  archived?: boolean;
  limit?: number;
  page?: number;
  search?: string;
}

@Injectable()
export class LinksService {
  private readonly logger = new Logger(LinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async create(userId: string, input: CreateLinkInput) {
    try {
      new URL(input.url);
    } catch {
      throw new BadRequestException('Invalid url');
    }

    const existing = await this.prisma.link.findFirst({
      where: { userId, url: input.url },
      include: { meta: true },
    });

    if (existing) {
      const link = await this.prisma.link.update({
        where: { id: existing.id },
        data: { archivedAt: null, createdAt: new Date() },
        include: { meta: true },
      });

      if (!existing.meta?.fetchedAt) {
        void this.queueService
          .send(QUEUES.METADATA_FETCH, { linkId: link.id, url: link.url })
          .catch((error: unknown) => {
            this.logger.error(
              `Failed to enqueue metadata fetch for link ${link.id}: ${String(error)}`,
            );
          });
      }

      return link;
    }

    const link = await this.prisma.link.create({
      data: { userId, url: input.url },
      include: { meta: true },
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

    const where: Prisma.LinkWhereInput = { userId };

    if (archived === true) {
      where.archivedAt = { not: null };
    } else if (archived === false) {
      where.archivedAt = null;
    }

    if (search && search.trim() !== '') {
      return this.findAllByText(
        userId,
        search.trim(),
        where,
        safePage,
        safeLimit,
      );
    }

    const [data, total] = await Promise.all([
      this.prisma.link.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip: (safePage - 1) * safeLimit,
        include: { meta: true },
      }),
      this.prisma.link.count({ where }),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
  }

  private async findAllByText(
    userId: string,
    term: string,
    where: Prisma.LinkWhereInput,
    page: number,
    limit: number,
  ) {
    const archivedFilter =
      where.archivedAt === null
        ? Prisma.sql`AND l."archivedAt" IS NULL`
        : where.archivedAt !== undefined
          ? Prisma.sql`AND l."archivedAt" IS NOT NULL`
          : Prisma.empty;

    const offset = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<{ id: string; total: bigint }[]>`
      SELECT l.id, COUNT(*) OVER() AS total
      FROM "Link" l
      WHERE l."userId" = ${userId}
        AND l."searchVector" @@ plainto_tsquery('english', ${term})
        ${archivedFilter}
      ORDER BY ts_rank(l."searchVector", plainto_tsquery('english', ${term})) DESC,
               l."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    if (rows.length === 0) {
      return { data: [], total: 0, page, limit };
    }

    const ids = rows.map((row) => row.id);
    const total = Number(rows[0].total);

    const links = await this.prisma.link.findMany({
      where: { id: { in: ids } },
      include: { meta: true },
    });

    const orderMap = new Map(ids.map((id, index) => [id, index]));
    links.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    return { data: links, total, page, limit };
  }

  async findOne(userId: string, id: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, userId },
      include: { meta: true },
    });

    if (!link) throw new NotFoundException('Link not found');
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

  async update(userId: string, id: string, _input: UpdateLinkInput) {
    try {
      return await this.prisma.link.update({
        where: { id, userId },
        data: {},
        include: { meta: true },
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
        include: { meta: true },
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
        include: { meta: true },
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

  async removeAllArchived(userId: string) {
    const result = await this.prisma.link.deleteMany({
      where: { userId, archivedAt: { not: null } },
    });
    return { count: result.count };
  }

  async getRandom(userId: string, archived = false) {
    let result: { id: string }[];

    if (archived) {
      result = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Link"
        WHERE "userId" = ${userId} AND "archivedAt" IS NOT NULL
        ORDER BY RANDOM() LIMIT 1
      `;
    } else {
      result = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Link"
        WHERE "userId" = ${userId} AND "archivedAt" IS NULL
        ORDER BY RANDOM() LIMIT 1
      `;
    }

    if (result.length === 0) return null;

    return this.prisma.link.findFirst({
      where: { id: result[0].id },
      include: { meta: true },
    });
  }
}
