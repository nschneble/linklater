import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService, Prisma } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';

/** Minimum fields required to create a link. */
export interface CreateLinkInput {
  url: string;
}

/**
 * Input shape for `update`. Currently empty because no user-editable fields
 * exist yet — the type is declared as `object` so the route stays wired for
 * future additions without breaking the call site.
 *
 * // TODO: Add optional fields (e.g. `title`, `tags`) as the feature grows.
 */
export type UpdateLinkInput = Record<string, never>;

/** Maximum results per page regardless of what the caller requests. */
const MAX_LIMIT = 100;

/** Default results per page when the caller omits `limit`. */
const DEFAULT_LIMIT = 10;

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
 * All business logic for saving, fetching, marking read/unread, and deleting links.
 * Every method is scoped to a specific `userId` — the service never
 * operates on links belonging to a different user.
 */
@Injectable()
export class LinksService {
  private readonly logger = new Logger(LinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Saves a URL for the given user. If the URL was previously saved and
   * then marked as read, it is resurfaced (marked unread + new timestamp)
   * rather than creating a duplicate entry. A metadata fetch job is
   * enqueued in both cases.
   *
   * @param userId - The UUID of the authenticated user.
   * @param input - Contains the URL to save.
   * @returns The created or resurfaced link with its `meta` relation included.
   */
  async create(userId: string, input: CreateLinkInput) {
    const existing = await this.prisma.link.findFirst({
      where: { userId, url: input.url },
      include: { meta: true },
    });

    if (existing) {
      // Resurface the link at the top of the list by resetting its timestamps.
      const link = await this.prisma.link.update({
        where: { id: existing.id },
        data: { readAt: null, createdAt: new Date() },
        include: { meta: true },
      });

      // Only re-fetch metadata if it has never been fetched before (e.g. the
      // previous fetch attempt failed before producing a `fetchedAt` timestamp).
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

    // Fire-and-forget: metadata fetching is async and non-critical. Errors are
    // logged but do not affect the HTTP response.
    void this.queueService
      .send(QUEUES.METADATA_FETCH, { linkId: link.id, url: link.url })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to enqueue metadata fetch for link ${link.id}: ${String(error)}`,
        );
      });

    return link;
  }

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

    const rows = await this.prisma.$queryRaw<{ id: string; total: bigint }[]>`
      SELECT l.id, COUNT(*) OVER() AS total
      FROM "Link" l
      WHERE l."userId" = ${userId}
        AND l."searchVector" @@ plainto_tsquery('english', ${term})
        ${readFilter}
      ORDER BY ts_rank(l."searchVector", plainto_tsquery('english', ${term})) DESC,
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
   * Converts Prisma's `P2025` "record not found" error into a NestJS
   * `NotFoundException`. Any other error is re-thrown unchanged.
   *
   * Used by `update`, `read`, `unread`, and `remove` to produce
   * consistent 404 responses when a link does not belong to the current user.
   *
   * @param error - The caught error.
   * @throws {NotFoundException} When `error` is a Prisma P2025 error.
   * @throws The original `error` for any other error type.
   */
  private mapP2025ToNotFound(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Link not found');
    }
    throw error;
  }

  /**
   * Updates a link's editable fields. Currently a no-op — `data: {}` is sent
   * to keep the endpoint wired for future use without skipping the database
   * round-trip (which also validates ownership via the `userId` filter).
   *
   * // TODO: Populate `data` once user-editable fields are added.
   *
   * @param userId - The UUID of the authenticated user.
   * @param id - The UUID of the link.
   * @param _input - The update payload (unused until fields are defined).
   * @returns The link unchanged.
   * @throws {NotFoundException} When the link does not exist for this user.
   */
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

  /**
   * Marks a link as read by setting `readAt` to the current timestamp.
   *
   * @param userId - The UUID of the authenticated user.
   * @param id - The UUID of the link.
   * @returns The updated link with `readAt` set.
   * @throws {NotFoundException} When the link does not exist for this user.
   */
  async read(userId: string, id: string) {
    try {
      return await this.prisma.link.update({
        where: { id, userId },
        data: { readAt: new Date() },
        include: { meta: true },
      });
    } catch (error) {
      this.mapP2025ToNotFound(error);
    }
  }

  /**
   * Removes the read timestamp from a link, returning it to the unread list.
   *
   * @param userId - The UUID of the authenticated user.
   * @param id - The UUID of the link.
   * @returns The updated link with `readAt` cleared to `null`.
   * @throws {NotFoundException} When the link does not exist for this user.
   */
  async unread(userId: string, id: string) {
    try {
      return await this.prisma.link.update({
        where: { id, userId },
        data: { readAt: null },
        include: { meta: true },
      });
    } catch (error) {
      this.mapP2025ToNotFound(error);
    }
  }

  /**
   * Permanently deletes a single link and its associated metadata.
   *
   * @param userId - The UUID of the authenticated user.
   * @param id - The UUID of the link.
   * @returns `{ success: true }` on success.
   * @throws {NotFoundException} When the link does not exist for this user.
   */
  async remove(userId: string, id: string) {
    try {
      await this.prisma.link.delete({ where: { id, userId } });
    } catch (error) {
      this.mapP2025ToNotFound(error);
    }
    return { success: true };
  }

  /**
   * Permanently deletes all read links for a user. Used by the
   * "Remove all read" button in the UI. Not scoped to a date threshold —
   * all read links regardless of age are deleted.
   *
   * @param userId - The UUID of the authenticated user.
   * @returns `{ count: number }` — the number of links deleted.
   */
  async removeAllRead(userId: string) {
    const result = await this.prisma.link.deleteMany({
      where: { userId, readAt: { not: null } },
    });
    return { count: result.count };
  }

  /**
   * Atomically selects a random unread link and marks it as read. Used by
   * the `/stumble` route to replace the current browser tab with a random
   * link from the user's unread backlog.
   *
   * @param userId - The UUID of the authenticated user.
   *
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
