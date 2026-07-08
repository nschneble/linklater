import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { META_INCLUDE } from './links.include.js';
import { PrismaService, Prisma } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';

/** Minimum fields required to create a link. */
export interface CreateLinkInput {
  url: string;
}

/**
 * Write operations for links: creating, marking read/unread, and deleting.
 * Every method is scoped to a specific `userId` – the service never
 * operates on links belonging to a different user.
 *
 * Read operations live in `LinksQueryService`. `LinksController` injects
 * both services and routes accordingly.
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
      include: META_INCLUDE,
    });

    if (existing) {
      const link = await this.resurfaceLink(existing.id);

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
        omit: { userId: true },
        include: META_INCLUDE,
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
          include: META_INCLUDE,
        });
        if (racedExisting) {
          return this.resurfaceLink(racedExisting.id);
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
   * Resets a link's timestamps to resurface it at the top of the unread list.
   * Used by both the found-existing path and the P2002 race-condition fallback
   * in `create` – both paths represent the same intent: bring the link back.
   *
   * @param id - The UUID of the link to resurface.
   * @returns The updated link with its `meta` relation included.
   */
  private resurfaceLink(id: string) {
    return this.prisma.link.update({
      where: { id },
      data: { readAt: null, createdAt: new Date() },
      omit: { userId: true },
      include: META_INCLUDE,
    });
  }

  /**
   * Converts Prisma's `P2025` "record not found" error into a NestJS
   * `NotFoundException`. Any other error is re-thrown unchanged.
   *
   * Used by `read`, `unread`, and `remove` to produce consistent 404
   * responses when a link does not belong to the current user.
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
        omit: { userId: true },
        include: META_INCLUDE,
      });
    } catch (error) {
      return this.mapP2025ToNotFound(error);
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
        omit: { userId: true },
        include: META_INCLUDE,
      });
    } catch (error) {
      return this.mapP2025ToNotFound(error);
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
      return this.mapP2025ToNotFound(error);
    }
    return { success: true };
  }

  /**
   * Permanently deletes all read links for a user. Used by the
   * "Remove all read" button in the UI. Not scoped to a date threshold –
   * all read links regardless of age are deleted.
   *
   * @param userId - The UUID of the authenticated user.
   * @returns `{ count: number }` – the number of links deleted.
   */
  async removeAllRead(userId: string) {
    const result = await this.prisma.link.deleteMany({
      where: { userId, readAt: { not: null } },
    });
    return { count: result.count };
  }
}
