import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService, Prisma } from '../prisma/index.js';

/** Maximum results per page regardless of what the caller requests. */
export const MAX_LIMIT = 100;

/** Default results per page when the caller omits `limit`. */
export const DEFAULT_LIMIT = 10;

/** Parameters accepted by the `findAll` method. */
export interface LinksQuery {
  /** When `true`, return only read links. When `false`, return only unread links. Omit to return all. */
  read?: boolean;
  /** Results per page (clamped to 1–100). */
  limit?: number;
  /** 1-based page number. */
  page?: number;
  /** Full-text search term. Delegates to PostgreSQL `plainto_tsquery`. */
  search?: string;
}

/**
 * Read-only query operations for links: listing, filtering, full-text
 * search, and random selection. All methods are scoped to a specific
 * `userId` — the service never reads links belonging to a different user.
 *
 * This service owns no mutable state and issues no queue jobs. It is
 * injected by `LinksService`, which delegates all read methods here while
 * retaining write operations itself.
 */
@Injectable()
export class LinksQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a paginated list of links for the given user. When `search` is
   * provided, delegates to `findAllByText` which uses PostgreSQL full-text
   * search for relevance ranking. Otherwise uses a simple `ORDER BY createdAt
   * DESC` query.
   *
   * @param userId - The UUID of the authenticated user.
   * @param query - Filtering, pagination, and search parameters.
   * @returns `{ data, total, page, limit }` where `data` is the current page of results.
   */
  async findAll(userId: string, query: LinksQuery) {
    const { search, read, page = 1, limit = DEFAULT_LIMIT } = query;
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const safePage = Math.max(page, 1);

    const where: Prisma.LinkWhereInput = { userId };

    if (read === true) {
      where.readAt = { not: null };
    } else if (read === false) {
      where.readAt = null;
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

  /**
   * Full-text search implementation using PostgreSQL `tsvector` / `tsquery`.
   * Uses a raw query so that results can be ordered by `ts_rank` (relevance)
   * rather than `createdAt`. A second Prisma query fetches the full Link
   * records including their metadata, then re-sorts them to match the rank
   * order returned by Postgres.
   *
   * GOTCHA: The `total` is derived from `COUNT(*) OVER()` on the raw query
   * result (a window function). When there are no results the array is empty
   * so `total` defaults to 0 rather than reading from a missing first row.
   *
   * @param userId - The UUID of the authenticated user.
   * @param term - The trimmed search string passed to `plainto_tsquery`.
   * @param where - The base `LinkWhereInput` carrying the read filter.
   * @param page - The 1-based page number.
   * @param limit - The number of results per page.
   * @returns `{ data, total, page, limit }` sorted by relevance.
   */
  private async findAllByText(
    userId: string,
    term: string,
    where: Prisma.LinkWhereInput,
    page: number,
    limit: number,
  ) {
    const readFilter =
      where.readAt === null
        ? Prisma.sql`AND l."readAt" IS NULL`
        : where.readAt !== undefined
          ? Prisma.sql`AND l."readAt" IS NOT NULL`
          : Prisma.empty;

    const offset = (page - 1) * limit;

    // Postel's Law: unaccent() is applied to both the stored searchVector
    // (see the unaccent_search migration and MetadataService) and to the
    // incoming term here, so a query for "montréal" matches a link titled
    // "Montreal" and vice versa.
    const rows = await this.prisma.$queryRaw<{ id: string; total: bigint }[]>`
      SELECT l.id, COUNT(*) OVER() AS total
      FROM "Link" l
      WHERE l."userId" = ${userId}
        AND l."searchVector" @@ plainto_tsquery('english', unaccent(${term}))
        ${readFilter}
      ORDER BY ts_rank(l."searchVector", plainto_tsquery('english', unaccent(${term}))) DESC,
               l."createdAt" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    if (rows.length === 0) {
      return { data: [], total: 0, page, limit };
    }

    const ids = rows.map((row) => row.id);
    const total = Number(rows[0].total);

    // Prisma does not guarantee result order when using `id: { in: ids }`, so
    // we re-sort by the rank order captured in the raw query above.
    const links = await this.prisma.link.findMany({
      where: { id: { in: ids } },
      include: { meta: true },
    });

    const orderMap = new Map(ids.map((id, index) => [id, index]));
    links.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    return { data: links, total, page, limit };
  }

  /**
   * Retrieves a single link by its UUID, scoped to the given user.
   *
   * @param userId - The UUID of the authenticated user.
   * @param id - The UUID of the link.
   * @returns The link with its `meta` relation included.
   * @throws {NotFoundException} When no link with that ID belongs to this user.
   */
  async findOne(userId: string, id: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, userId },
      include: { meta: true },
    });

    if (!link) throw new NotFoundException('Link not found');
    return link;
  }

  /**
   * Atomically selects a random unread link and marks it as read. Used by
   * the `/stumble` route to replace the current browser tab with a random
   * link from the user's unread backlog.
   *
   * @param userId - The UUID of the authenticated user.
   * @returns `{ url }` when a link is found and marked read, or `null`
   *   when the user has no unread links.
   */
  async stumble(userId: string): Promise<{ url: string } | null> {
    const result = await this.prisma.$queryRaw<{ id: string; url: string }[]>`
      UPDATE "Link"
      SET "readAt" = NOW()
      WHERE id = (
        SELECT id FROM "Link"
        WHERE "userId" = ${userId} AND "readAt" IS NULL
        ORDER BY RANDOM() LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, url
    `;
    if (result.length === 0) return null;
    return { url: result[0].url };
  }

  /**
   * Returns a single randomly selected link from the user's collection.
   * Uses `ORDER BY RANDOM()` in a raw query for true randomness without
   * loading the full collection into memory.
   *
   * @param userId - The UUID of the authenticated user.
   * @param read - When `true`, picks from read links; when `false` (default), picks from unread links.
   * @returns The randomly selected link with metadata, or `null` if no matching links exist.
   */
  async getRandom(userId: string, read = false) {
    const readFilter = read ? Prisma.sql`IS NOT NULL` : Prisma.sql`IS NULL`;

    const result = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Link"
      WHERE "userId" = ${userId} AND "readAt" ${readFilter}
      ORDER BY RANDOM() LIMIT 1
    `;

    if (result.length === 0) return null;

    return this.prisma.link.findFirst({
      where: { id: result[0].id },
      include: { meta: true },
    });
  }
}
