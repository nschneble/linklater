import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';
import { MetadataFetcherService } from './metadata-fetcher.service.js';

/**
 * Fetches and stores Open Graph / Twitter Card metadata for saved links.
 * Runs as a pg-boss queue worker so that metadata fetching is decoupled from
 * the HTTP request that creates the link — the link creation endpoint returns
 * immediately, and metadata appears asynchronously.
 *
 * Security: all outgoing fetch requests are guarded by `isPrivateHost` inside
 * `MetadataFetcherService` to prevent Server-Side Request Forgery (SSRF)
 * attacks where a malicious URL could cause the server to make requests to
 * internal services.
 */
@Injectable()
export class MetadataService implements OnModuleInit {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly metadataFetcher: MetadataFetcherService,
  ) {}

  /**
   * Registers the metadata fetch queue worker on application startup.
   * Jobs are processed one at a time in the order they are dequeued.
   */
  async onModuleInit(): Promise<void> {
    await this.queueService.work<{ linkId: string; url: string }>(
      QUEUES.METADATA_FETCH,
      async (jobs) => {
        for (const job of jobs) {
          await this.fetchAndStore(job.data.linkId, job.data.url);
        }
      },
    );
  }

  /**
   * Fetches metadata for a URL and upserts it into the `Meta` table. Also
   * updates the `searchVector` column on the `Link` row so that the new
   * title, description, and site name are immediately searchable.
   *
   * On any fetch or parse error, writes a `Meta` record with just `fetchedAt`
   * set (and all content fields null) so that polling clients know the fetch
   * attempt completed rather than getting stuck in an infinite poll.
   *
   * IDEMPOTENT: safe under pg-boss at-least-once delivery. The `Meta` write
   * is a `upsert` keyed on `linkId`, so a redelivered job overwrites with
   * the same content rather than producing a duplicate row. The searchVector
   * `$executeRaw UPDATE` is similarly idempotent — running it twice produces
   * the same tsvector. Redelivery re-fetches the URL (wasteful but not
   * corrupting); if hot path bandwidth becomes a concern, gate on
   * `meta.fetchedAt` at the start of the handler.
   *
   * @param linkId - The UUID of the Link row to attach metadata to.
   * @param url - The URL to fetch and parse.
   */
  async fetchAndStore(linkId: string, url: string): Promise<void> {
    try {
      const metadata = await this.metadataFetcher.fetchMetadata(url);

      await this.prisma.meta.upsert({
        where: { linkId },
        create: {
          linkId,
          description: metadata.description,
          faviconUrl: metadata.faviconUrl,
          imageUrl: metadata.imageUrl,
          siteName: metadata.siteName,
          source: metadata.source,
          title: metadata.title,
          fetchedAt: new Date(),
        },
        update: {
          description: metadata.description,
          faviconUrl: metadata.faviconUrl,
          imageUrl: metadata.imageUrl,
          siteName: metadata.siteName,
          source: metadata.source,
          title: metadata.title,
          fetchedAt: new Date(),
        },
      });

      // Update the full-text search vector with the newly fetched content so
      // that searches immediately find the link by title, description, or site name.
      // unaccent() collapses diacritics so "Montréal" indexes the same as "Montreal";
      // the search side mirrors this in LinksService.findAllByText (Postel's Law).
      await this.prisma.$executeRaw`
        UPDATE "Link" SET "searchVector" = to_tsvector('english', unaccent(
          coalesce(${metadata.title}, '') || ' ' ||
          coalesce(${metadata.description}, '') || ' ' ||
          coalesce(${metadata.siteName}, '') || ' ' ||
          url))
        WHERE id = ${linkId}
      `;
    } catch (error) {
      this.logger.warn(`Metadata fetch failed for ${url}: ${String(error)}`);
      // Record that a fetch attempt was made (setting fetchedAt) even on failure.
      // Without this, the front-end polling hook would never stop polling.
      await this.prisma.meta
        .upsert({
          where: { linkId },
          create: { linkId, fetchedAt: new Date() },
          update: { fetchedAt: new Date() },
        })
        .catch((upsertError: unknown) => {
          this.logger.warn(
            `Failed to record metadata fetch failure for ${url}: ${String(upsertError)}`,
          );
        });
    }
  }
}
