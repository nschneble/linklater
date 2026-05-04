import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_URL_LENGTH,
} from './metadata.constants.js';
import { PrismaService } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';
import type { LinkMetadata } from './metadata.types.js';
import * as cheerio from 'cheerio';

@Injectable()
export class MetadataService implements OnModuleInit {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

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
    } catch (error) {
      this.logger.warn(`Metadata fetch failed for ${url}: ${String(error)}`);
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

  private isPrivateHost(url: string): boolean {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return true;
    }

    if (hostname === 'localhost') return true;

    if (hostname === '::1' || hostname === '[::1]') return true;

    if (/^\[?f[cd]/i.test(hostname)) return true;

    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [, firstOctet, secondOctet] = ipv4.map(Number);
      if (firstOctet === 127) return true;
      if (firstOctet === 10) return true;
      if (firstOctet === 169 && secondOctet === 254) return true;
      if (firstOctet === 192 && secondOctet === 168) return true;
      if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31)
        return true;
    }

    return false;
  }

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

  private async fetchHtml(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
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
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    return response.text();
  }

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
