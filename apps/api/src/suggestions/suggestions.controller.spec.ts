import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { SuggestionsController } from './suggestions.controller.js';
import { SuggestionsService } from './suggestions.service.js';
import type { Suggestion } from './suggestions.types.js';

function aSuggestion(): Suggestion {
  return {
    url: 'https://example.com/article',
    title: 'Title',
    description: null,
    imageUrl: null,
    siteName: null,
  };
}

describe('SuggestionsController', () => {
  let controller: SuggestionsController;
  let suggestionsServiceMock: { getSuggestions: jest.Mock };

  beforeEach(() => {
    suggestionsServiceMock = {
      getSuggestions: jest.fn(),
    };
    controller = new SuggestionsController(
      suggestionsServiceMock as unknown as SuggestionsService,
    );
  });

  it('defaults count to 3 when no query string is provided', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce({
      sourceName: 'Aeon',
      suggestions: [aSuggestion(), aSuggestion(), aSuggestion()],
    });

    const result = await controller.getSuggestions();

    expect(suggestionsServiceMock.getSuggestions).toHaveBeenCalledWith(3);
    expect(result.sourceName).toBe('Aeon');
    expect(result.suggestions).toHaveLength(3);
  });

  it('forwards a valid count value through to the service', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce({
      sourceName: 'Wikipedia',
      suggestions: [aSuggestion()],
    });

    await controller.getSuggestions('1');

    expect(suggestionsServiceMock.getSuggestions).toHaveBeenCalledWith(1);
  });

  it('rejects a count of zero', async () => {
    await expect(controller.getSuggestions('0')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a count above the maximum', async () => {
    await expect(controller.getSuggestions('99')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a non-numeric count', async () => {
    await expect(
      controller.getSuggestions('notanumber'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 503 when the service returns null', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce(null);

    await expect(controller.getSuggestions()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
