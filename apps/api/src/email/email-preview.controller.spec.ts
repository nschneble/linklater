import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';

import { emailPreviews } from './email-preview.catalog.js';
import { EmailPreviewController } from './email-preview.controller.js';

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

describe('EmailPreviewController', () => {
  let controller: EmailPreviewController;
  const originalTestingUi = process.env.TESTING_UI;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new EmailPreviewController();
    process.env.TESTING_UI = '1';
  });

  afterEach(() => {
    if (originalTestingUi === undefined) {
      delete process.env.TESTING_UI;
    } else {
      process.env.TESTING_UI = originalTestingUi;
    }
  });

  it('covers exactly the six transactional email templates', () => {
    const slugs = emailPreviews.map((preview) => preview.slug).sort();
    expect(slugs).toEqual(Object.keys(HEADINGS).sort());
  });

  it('renders each template as a full HTML document with its own heading', () => {
    for (const preview of emailPreviews) {
      const html = controller.preview(preview.slug);
      expect(html).toBe(preview.html);
      expect(html).toContain('<!doctype html>');
      expect(html).toContain(HEADINGS[preview.slug]);
    }
  });

  it('lists every preview on the index page', () => {
    const html = controller.index();
    for (const preview of emailPreviews) {
      expect(html).toContain(`/api/email/preview/${preview.slug}`);
      expect(html).toContain(preview.title);
    }
  });

  it('throws NotFoundException for an unknown template', () => {
    expect(() => controller.preview('does-not-exist')).toThrow(
      NotFoundException,
    );
  });

  it('404s every route when testing UI is off (production)', () => {
    delete process.env.TESTING_UI;
    expect(() => controller.index()).toThrow(NotFoundException);
    expect(() => controller.preview('magic-link')).toThrow(NotFoundException);
  });
});
