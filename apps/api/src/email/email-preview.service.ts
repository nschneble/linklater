import { Injectable, NotFoundException } from '@nestjs/common';

import { emailPreviews } from './email-preview.catalog.js';

/**
 * Builds the dev/test-only email-preview HTML: the catalog index page and
 * each template's rendered document. The controller owns the HTTP surface
 * and the `TESTING_UI` gate; this service owns the markup.
 */
@Injectable()
export class EmailPreviewService {
  renderIndex(): string {
    const items = emailPreviews
      .map(
        (preview) =>
          `<li><a href="/api/email/preview/${preview.slug}">${preview.title}</a></li>`,
      )
      .join('');
    return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Email previews</title></head><body><h1>Email previews</h1><ul>${items}</ul></body></html>`;
  }

  resolvePreview(template: string): string {
    const match = emailPreviews.find((preview) => preview.slug === template);
    if (match === undefined) {
      throw new NotFoundException(`Unknown email preview: ${template}`);
    }
    return match.html;
  }
}
