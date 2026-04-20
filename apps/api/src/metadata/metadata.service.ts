import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { QUEUES } from '../queue/queue.constants.js';

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
      const { metaDescription, metaImage } = await this.fetchMetadata(url);
      await this.prisma.link.update({
        where: { id: linkId },
        data: { metaDescription, metaImage, metaFetchedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Metadata fetch failed for ${url}: ${String(error)}`);
      await this.prisma.link
        .update({
          where: { id: linkId },
          data: { metaFetchedAt: new Date() },
        })
        .catch(() => {});
    }
  }

  private isPrivateHost(url: string): boolean {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return true; // unparseable URLs treated as private
    }

    if (hostname === 'localhost') return true;

    // IPv6 loopback
    if (hostname === '::1' || hostname === '[::1]') return true;

    // IPv6 private (fc00::/7 covers fc00:: through fdff::)
    if (/^\[?f[cd]/i.test(hostname)) return true;

    // IPv4 private ranges
    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [, a, b] = ipv4.map(Number);
      if (a === 127) return true; // 127.x.x.x loopback
      if (a === 10) return true; // 10.x.x.x private
      if (a === 169 && b === 254) return true; // 169.254.x.x link-local (AWS metadata)
      if (a === 192 && b === 168) return true; // 192.168.x.x private
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16-31.x.x private
    }

    return false;
  }

  private async fetchMetadata(
    url: string,
  ): Promise<{ metaDescription: string | null; metaImage: string | null }> {
    if (this.isPrivateHost(url)) {
      this.logger.warn(`Blocked SSRF attempt to private host: ${url}`);
      return { metaDescription: null, metaImage: null };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; Linklater/1.0; +https://linklater.app)',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return { metaDescription: null, metaImage: null };
    }

    const html = await response.text();
    return this.extractMeta(html, url);
  }

  private extractMeta(
    html: string,
    pageUrl: string,
  ): { metaDescription: string | null; metaImage: string | null } {
    const $ = cheerio.load(html);

    const rawDescription =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;

    const rawImage = $('meta[property="og:image"]').attr('content') || null;

    const metaDescription = rawDescription
      ? rawDescription.slice(0, 500)
      : null;

    const metaImage = rawImage ? this.resolveUrl(rawImage, pageUrl) : null;

    return { metaDescription, metaImage };
  }

  private resolveUrl(imageUrl: string, pageUrl: string): string {
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl.slice(0, 2000);
    }

    try {
      const resolved = new URL(imageUrl, pageUrl).toString();
      return resolved.slice(0, 2000);
    } catch {
      return '';
    }
  }
}
