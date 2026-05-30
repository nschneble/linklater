import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService, Prisma } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';
import { LinksQueryService, type LinksQuery } from './links-query.service.js';

/** Minimum fields required to create a link. */
export interface CreateLinkInput {
  url: string;
}

export type UpdateLinkInput = object;

export type { LinksQuery } from './links-query.service.js';

/**
 * All business logic for saving, fetching, marking read/unread, and deleting links.
 * Every method is scoped to a specific `userId` — the service never
 * operates on links belonging to a different user.
 *
 * Read operations are delegated to `LinksQueryService`. This service retains
 * write operations: creating, updating, marking read/unread, and deleting.
 */
@Injectable()
export class LinksService {
  private readonly logger = new Logger(LinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly linksQuery: LinksQueryService,
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

    let link;
    try {
      link = await this.prisma.link.create({
        data: { userId, url: input.url },
        include: { meta: true },
      });
    } catch (error) {
      // Concurrent POST /links for the same URL: a parallel request won
      // the unique-constraint race and the row now exists. Fall back to
      // the resurface path so the user gets a consistent response.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const racedExisting = await this.prisma.link.findFirst({
          where: { userId, url: input.url },
          include: { meta: true },
        });
        if (racedExisting) {
          return this.prisma.link.update({
            where: { id: racedExisting.id },
            data: { readAt: null, createdAt: new Date() },
            include: { meta: true },
          });
        }
      }
      throw error;
    }

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
   * provided, delegates to PostgreSQL full-text search for relevance ranking.
   * Otherwise uses a simple `ORDER BY createdAt DESC` query.
   *
   * @param userId - The UUID of the authenticated user.
   * @param query - Filtering, pagination, and search parameters.
   * @returns `{ data, total, page, limit }` where `data` is the current page of results.
   */
  async findAll(userId: string, query: LinksQuery) {
    return this.linksQuery.findAll(userId, query);
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
    return this.linksQuery.findOne(userId, id);
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
   * @returns `{ url }` when a link is found and marked read, or `null`
   *   when the user has no unread links.
   */
  async stumble(userId: string): Promise<{ url: string } | null> {
    return this.linksQuery.stumble(userId);
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
    return this.linksQuery.getRandom(userId, read);
  }
}
