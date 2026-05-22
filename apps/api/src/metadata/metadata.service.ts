import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_HTML_BYTES,
  MAX_URL_LENGTH,
} from './metadata.constants.js';
import { PrismaService } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';
import type { LinkMetadata } from './metadata.types.js';
import * as cheerio from 'cheerio';

/**
 * Fetches and stores Open Graph / Twitter Card metadata for saved links.
 * Runs as a pg-boss queue worker so that metadata fetching is decoupled from
 * the HTTP request that creates the link — the link creation endpoint returns
 * immediately, and metadata appears asynchronously.
 *
 * Security: all outgoing fetch requests are guarded by `isPrivateHost` to
 * prevent Server-Side Request Forgery (SSRF) attacks where a malicious URL
 * could cause the server to make requests to internal services.
 */
@Injectable()
export class MetadataService implements OnModuleInit {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
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
   * @param linkId - The UUID of the Link row to attach metadata to.
   * @param url - The URL to fetch and parse.
   */
  async fetchAndStore(linkId: string, url: string): Promise<void> {
    try {
      const metadata = await this.fetchMetadata(url);

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

  /**
   * Returns `true` for any host that should not be fetched — localhost,
   * loopback addresses, and RFC 1918 private IP ranges.
   *
   * GOTCHA: This check runs on the raw URL string, not on any resolved
   * redirect target. A redirect chain that ends at a private host would bypass
   * this guard. Fetch is configured without `redirect: 'follow'` so that the
   * default redirect handling is used, but the initial host is always validated.
   *
   * @param url - The URL string to check.
   * @returns `true` when the host is private and the fetch should be blocked.
   */
  private isPrivateHost(url: string): boolean {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return true;
    }

    if (hostname === 'localhost') return true;

    if (hostname === '::1' || hostname === '[::1]') return true;

    // IPv6 unique-local and link-local prefixes (fc00::/7 and fe80::/10)
    if (/^\[?f[cd]/i.test(hostname)) return true;

    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [, firstOctet, secondOctet] = ipv4.map(Number);
      if (firstOctet === 127) return true; // 127.0.0.0/8 loopback
      if (firstOctet === 10) return true; // 10.0.0.0/8 private
      if (firstOctet === 169 && secondOctet === 254) return true; // 169.254.0.0/16 link-local
      if (firstOctet === 192 && secondOctet === 168) return true; // 192.168.0.0/16 private
      if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31)
        return true; // 172.16.0.0/12 private
    }

    return false;
  }

  /**
   * Orchestrates fetching HTML and extracting metadata. If the host is private
   * or the fetch fails, returns `emptyMetadata`. Falls back to
   * `<origin>/favicon.ico` when no `<link rel="icon">` is found in the HTML.
   *
   * @param url - The public URL to fetch.
   * @returns Extracted metadata, or an empty metadata object on failure.
   */
  private async fetchMetadata(url: string): Promise<LinkMetadata> {
    if (this.isPrivateHost(url)) {
      this.logger.warn(`Blocked SSRF attempt to private host: ${url}`);
      return this.emptyMetadata();
    }

    const html = await this.fetchHtml(url);
    let metadata = html ? this.extractMeta(html, url) : this.emptyMetadata();
    const source = html ?? null;

    if (!metadata.faviconUrl) {
      const faviconFallback = new URL('/favicon.ico', url).toString();
      metadata = { ...metadata, faviconUrl: faviconFallback };
    }

    return { ...metadata, source };
  }

  /**
   * Fetches the HTML of a URL with a 10-second timeout and a desktop
   * User-Agent string. Returns `null` if the response status is not OK,
   * the `Content-Type` is not `text/html`, the declared `Content-Length`
   * exceeds `MAX_HTML_BYTES`, or the streamed body crosses that cap.
   *
   * NOTE: The desktop User-Agent is used because many sites return minimal
   * or bot-blocked HTML for non-browser user agents.
   *
   * @param url - The URL to fetch.
   * @returns The HTML string, or `null` on failure.
   */
  private async fetchHtml(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response | undefined;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) return null;

      const declaredLength = response.headers.get('content-length');
      if (declaredLength && Number(declaredLength) > MAX_HTML_BYTES) {
        this.logger.warn(
          `Refused oversize HTML (declared ${declaredLength} bytes) from ${url}`,
        );
        return null;
      }

      return await this.readBodyWithCap(response, url);
    } finally {
      clearTimeout(timeout);
      // Abort guarantees the socket is released even when we bailed early
      // (oversize body, unsupported content type, etc.).
      controller.abort();
    }
  }

  /**
   * Streams the response body and aborts once cumulative bytes exceed
   * `MAX_HTML_BYTES`. Returns `null` when the cap is crossed so that the
   * caller falls back to empty metadata instead of buffering a hostile body.
   */
  private async readBodyWithCap(
    response: Response,
    url: string,
  ): Promise<string | null> {
    if (!response.body) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let received = 0;
    let html = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_HTML_BYTES) {
        await reader.cancel();
        this.logger.warn(
          `Aborted oversize HTML stream (>${MAX_HTML_BYTES} bytes) from ${url}`,
        );
        return null;
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return html;
  }

  /**
   * Parses metadata from an HTML string using Cheerio. Checks Open Graph,
   * Twitter Card, and standard HTML tags in order of preference.
   * All extracted URL values are resolved to absolute URLs via `resolveUrl`.
   *
   * @param html - The raw HTML string to parse.
   * @param pageUrl - The original URL of the page, used to resolve relative URLs.
   * @returns Extracted metadata with all fields that could not be found set to `null`.
   */
  private extractMeta(html: string, pageUrl: string): LinkMetadata {
    const $ = cheerio.load(html);

    const rawDescription =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[property="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;

    const rawFaviconUrl =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      null;

    const rawImageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="twitter:image"]').attr('content') ||
      null;

    const rawSiteName =
      $('meta[property="og:site_name"]').attr('content') || null;

    const rawTitle =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[property="twitter:title"]').attr('content') ||
      $('title').text() ||
      null;

    return {
      description: rawDescription
        ? rawDescription.slice(0, MAX_DESCRIPTION_LENGTH)
        : null,
      faviconUrl: rawFaviconUrl
        ? this.resolveUrl(rawFaviconUrl, pageUrl)
        : null,
      imageUrl: rawImageUrl ? this.resolveUrl(rawImageUrl, pageUrl) : null,
      siteName: rawSiteName || null,
      source: null,
      title: rawTitle ? rawTitle.trim() || null : null,
    };
  }

  /** Returns a `LinkMetadata` object with all fields set to `null`. */
  private emptyMetadata(): LinkMetadata {
    return {
      description: null,
      faviconUrl: null,
      imageUrl: null,
      siteName: null,
      source: null,
      title: null,
    };
  }

  /**
   * Resolves a raw URL (which may be relative) against the page URL and
   * truncates it to `MAX_URL_LENGTH`. Absolute URLs pass through unchanged
   * (after truncation). Relative URLs are resolved using the `URL` constructor.
   * Returns an empty string if resolution fails.
   *
   * @param rawUrl - The raw href/src string extracted from the HTML.
   * @param pageUrl - The base URL for resolving relative paths.
   * @returns The resolved, truncated URL string.
   */
  private resolveUrl(rawUrl: string, pageUrl: string): string {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl.slice(0, MAX_URL_LENGTH);
    }

    try {
      const resolved = new URL(rawUrl, pageUrl).toString();
      return resolved.slice(0, MAX_URL_LENGTH);
    } catch {
      return '';
    }
  }
}
