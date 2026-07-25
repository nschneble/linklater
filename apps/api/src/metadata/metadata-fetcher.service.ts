import { Injectable, Logger } from '@nestjs/common';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_HTML_BYTES,
  MAX_URL_LENGTH,
} from './metadata.constants.js';
import * as cheerio from 'cheerio/slim';
import { isPrivateHost, safeFetch } from '../common/index.js';
import type { LinkMetadata } from './metadata.types.js';

/**
 * Fetches and parses Open Graph / Twitter Card metadata from a public URL.
 *
 * Responsibilities:
 * - SSRF protection: `safeFetch` resolves the host to its IP(s) and validates
 *   every resolved address against the private ranges before connecting,
 *   follows redirects manually (re-resolving + re-validating each hop), and
 *   pins the connection to a validated address to defeat DNS rebinding. A
 *   cheap `isPrivateHost` literal pre-check also short-circuits obviously
 *   private literal hosts. This defeats both the DNS-record and the redirect
 *   SSRF bypasses, not just the original hostname string.
 * - HTTP fetching: 10-second timeout, desktop User-Agent, Content-Type guard,
 *   and a hard cap on body size to protect against hostile payloads
 *   (`fetchMetadata`, `fetchHtml`, `readBodyWithCap`).
 * - HTML parsing: extracts Open Graph, Twitter Card, and standard HTML
 *   meta tags via Cheerio, resolves relative URLs, and truncates field
 *   values to their column limits (`extractMeta`, `resolveUrl`).
 *
 * This service has no Prisma or queue dependency – it is a pure I/O +
 * data-transformation collaborator for `MetadataService`.
 */
@Injectable()
export class MetadataFetcherService {
  private readonly logger = new Logger(MetadataFetcherService.name);

  /**
   * Orchestrates fetching HTML and extracting metadata. If the host is private
   * or the fetch fails, returns `emptyMetadata`. Falls back to
   * `<origin>/favicon.ico` when no `<link rel="icon">` is found in the HTML.
   *
   * @param url - The public URL to fetch.
   * @returns Extracted metadata, or an empty metadata object on failure.
   */
  async fetchMetadata(url: string): Promise<LinkMetadata> {
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      // Malformed URL reaching the fetcher is itself a signal – log so ops
      // alerts catch the bypass attempt instead of silently dropping it.
      this.logger.warn(`Blocked SSRF attempt – invalid URL: ${url}`);
      return this.emptyMetadata();
    }

    // Cheap literal fast-fail: an obviously-private literal host (loopback,
    // RFC 1918, etc.) is refused outright and returns pure empty metadata (no
    // favicon fallback that would point at a private address). DNS-resolving
    // and redirect-following hosts are additionally guarded inside `fetchHtml`
    // via `safeFetch`.
    if (isPrivateHost(hostname)) {
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
   * User-Agent string. Returns `null` if the SSRF guard blocks the request
   * (private host at any hop, non-http(s) scheme, redirect cap exceeded), the
   * network fetch fails, the response status is not OK, the `Content-Type` is
   * not `text/html`, the declared `Content-Length` exceeds `MAX_HTML_BYTES`,
   * or the streamed body crosses that cap.
   *
   * Redirects are followed by `safeFetch` manually so every hop is re-resolved
   * and re-validated against the private ranges before connecting.
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

    try {
      const response = await safeFetch(url, {
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
    } catch (error) {
      // An SSRF block (private host / bad scheme / redirect cap) or a network
      // failure lands here – log and fall back to empty metadata rather than
      // surfacing the error to the queue worker.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Metadata fetch blocked or failed for ${url}: ${message}`,
      );
      return null;
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
