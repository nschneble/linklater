import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';

import { EmailPreviewController } from './email-preview.controller.js';
import { EmailPreviewService } from './email-preview.service.js';

const INDEX_HTML = '<index-html>';
const PREVIEW_HTML = '<preview-html>';

describe('EmailPreviewController', () => {
  let controller: EmailPreviewController;
  const originalTestingUi = process.env.TESTING_UI;

  const emailPreviewServiceMock = {
    renderIndex: jest.fn(),
    resolvePreview: jest.fn(),
  } as unknown as EmailPreviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    (emailPreviewServiceMock.renderIndex as jest.Mock).mockReturnValue(
      INDEX_HTML,
    );
    (emailPreviewServiceMock.resolvePreview as jest.Mock).mockReturnValue(
      PREVIEW_HTML,
    );
    controller = new EmailPreviewController(emailPreviewServiceMock);
    process.env.TESTING_UI = '1';
  });

  afterEach(() => {
    if (originalTestingUi === undefined) {
      delete process.env.TESTING_UI;
    } else {
      process.env.TESTING_UI = originalTestingUi;
    }
  });

  it('delegates the index page to the service', () => {
    expect(controller.index()).toBe(INDEX_HTML);
    expect(emailPreviewServiceMock.renderIndex).toHaveBeenCalledTimes(1);
  });

  it('delegates a template preview to the service by slug', () => {
    expect(controller.preview('magic-link')).toBe(PREVIEW_HTML);
    expect(emailPreviewServiceMock.resolvePreview).toHaveBeenCalledWith(
      'magic-link',
    );
  });

  it('propagates a service NotFoundException for an unknown template', () => {
    (emailPreviewServiceMock.resolvePreview as jest.Mock).mockImplementation(
      () => {
        throw new NotFoundException('Unknown email preview: does-not-exist');
      },
    );
    expect(() => controller.preview('does-not-exist')).toThrow(
      NotFoundException,
    );
  });

  it('404s every route when testing UI is off (production)', () => {
    delete process.env.TESTING_UI;
    expect(() => controller.index()).toThrow(NotFoundException);
    expect(() => controller.preview('magic-link')).toThrow(NotFoundException);
    expect(emailPreviewServiceMock.renderIndex).not.toHaveBeenCalled();
    expect(emailPreviewServiceMock.resolvePreview).not.toHaveBeenCalled();
  });
});
