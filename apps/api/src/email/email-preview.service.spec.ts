import { NotFoundException } from '@nestjs/common';

import { emailPreviews } from './email-preview.catalog.js';
import { EmailPreviewService } from './email-preview.service.js';

// The heading each template renders; pins every slug to the correct template
// so a mis-wired preview (e.g. magic-link showing the verification body) fails.
const HEADINGS: Record<string, string> = {
  verification: 'Verify your email.',
  'password-reset': 'Reset your password.',
  'email-change': 'Confirm your new email.',
  'magic-link': 'Your login link.',
  'confirm-account-deletion': 'Confirm account deletion.',
  'policy-update': 'Our privacy policy is changing.',
};

describe('EmailPreviewService', () => {
  let service: EmailPreviewService;

  beforeEach(() => {
    service = new EmailPreviewService();
  });

  it('covers exactly the six transactional email templates', () => {
    const slugs = emailPreviews.map((preview) => preview.slug).sort();
    expect(slugs).toEqual(Object.keys(HEADINGS).sort());
  });

  describe('renderIndex', () => {
    it('wraps a link to every catalog entry in the preview document shell', () => {
      const html = service.renderIndex();
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<title>Email previews</title>');
      expect(html).toContain('<h1>Email previews</h1>');
      for (const preview of emailPreviews) {
        expect(html).toContain(
          `<li><a href="/api/email/preview/${preview.slug}">${preview.title}</a></li>`,
        );
      }
    });
  });

  describe('resolvePreview', () => {
    it('returns each template as a full HTML document with its own heading', () => {
      for (const preview of emailPreviews) {
        const html = service.resolvePreview(preview.slug);
        expect(html).toBe(preview.html);
        expect(html).toContain('<!doctype html>');
        expect(html).toContain(HEADINGS[preview.slug]);
      }
    });

    it('throws NotFoundException naming the slug for an unknown template', () => {
      expect(() => service.resolvePreview('does-not-exist')).toThrow(
        new NotFoundException('Unknown email preview: does-not-exist'),
      );
    });
  });
});
