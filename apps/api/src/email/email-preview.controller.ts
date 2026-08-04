import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
} from '@nestjs/common';

import { EmailPreviewService } from './email-preview.service.js';
import { isTestingUi } from '../common/index.js';

/**
 * Dev/test-only surface that exposes each transactional email template at a
 * real URL so Tuffgal can screenshot it. Every route 404s unless
 * `TESTING_UI=1` (set by `npm run dev:test`), so the previews never exist in
 * production. The web dev-server proxies `/api/*` to the API, so the browser
 * reaches these at `/api/email/preview/*`. Markup lives in
 * `EmailPreviewService`; the controller only routes, gates, and delegates.
 */
@Controller('email/preview')
export class EmailPreviewController {
  constructor(private readonly emailPreviewService: EmailPreviewService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(): string {
    this.assertEnabled();
    return this.emailPreviewService.renderIndex();
  }

  @Get(':template')
  @Header('Content-Type', 'text/html; charset=utf-8')
  preview(@Param('template') template: string): string {
    this.assertEnabled();
    return this.emailPreviewService.resolvePreview(template);
  }

  // 404 (not 403) when disabled so the route looks absent in production.
  private assertEnabled(): void {
    if (!isTestingUi()) {
      throw new NotFoundException();
    }
  }
}
