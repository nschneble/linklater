import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
} from '@nestjs/common';

import { isTestingUi } from '../common/index.js';
import { emailPreviews } from './email-preview.catalog.js';

/**
 * Dev/test-only surface that renders each transactional email template to a
 * real URL so Tuffgal can screenshot it. Every route 404s unless
 * `TESTING_UI=1` (set by `npm run dev:test`), so the previews never exist in
 * production. The web dev-server proxies `/api/*` to the API, so the browser
 * reaches these at `/api/email/preview/*`.
 */
@Controller('email/preview')
export class EmailPreviewController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(): string {
    this.assertEnabled();
    const items = emailPreviews
      .map(
        (preview) =>
          `<li><a href="/api/email/preview/${preview.slug}">${preview.title}</a></li>`,
      )
      .join('');
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Email previews</title></head><body><h1>Email previews</h1><ul>${items}</ul></body></html>`;
  }

  @Get(':template')
  @Header('Content-Type', 'text/html; charset=utf-8')
  preview(@Param('template') template: string): string {
    this.assertEnabled();
    const match = emailPreviews.find((preview) => preview.slug === template);
    if (match === undefined) {
      throw new NotFoundException(`Unknown email preview: ${template}`);
    }
    return match.html;
  }

  // 404 (not 403) when disabled so the route looks absent in production.
  private assertEnabled(): void {
    if (!isTestingUi()) {
      throw new NotFoundException();
    }
  }
}
