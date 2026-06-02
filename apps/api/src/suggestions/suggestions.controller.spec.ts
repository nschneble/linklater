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
import type { AuthRequest } from '../auth/auth-request.type.js';
import type { Suggestion } from './suggestions.types.js';

const TEST_USER_ID = 'user-1';

function aSuggestion(): Suggestion {
  return {
    url: 'https://example.com/article',
    title: 'Title',
    description: null,
    imageUrl: null,
    siteName: null,
  };
}

function authRequest(userId = TEST_USER_ID): AuthRequest {
  return { user: { userId } } as unknown as AuthRequest;
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

    const result = await controller.getSuggestions(authRequest());

    expect(suggestionsServiceMock.getSuggestions).toHaveBeenCalledWith(
      3,
      TEST_USER_ID,
    );
    expect(result.sourceName).toBe('Aeon');
    expect(result.suggestions).toHaveLength(3);
  });

  it('forwards a valid count value through to the service', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce({
      sourceName: 'Wikipedia',
      suggestions: [aSuggestion()],
    });

    await controller.getSuggestions(authRequest(), '1');

    expect(suggestionsServiceMock.getSuggestions).toHaveBeenCalledWith(
      1,
      TEST_USER_ID,
    );
  });

  it('passes the authenticated userId through to the service', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce({
      sourceName: 'Aeon',
      suggestions: [aSuggestion()],
    });

    await controller.getSuggestions(authRequest('user-42'));

    expect(suggestionsServiceMock.getSuggestions).toHaveBeenCalledWith(
      3,
      'user-42',
    );
  });

  it('rejects a count of zero', async () => {
    await expect(
      controller.getSuggestions(authRequest(), '0'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a count above the maximum', async () => {
    await expect(
      controller.getSuggestions(authRequest(), '99'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-numeric count', async () => {
    await expect(
      controller.getSuggestions(authRequest(), 'notanumber'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 503 when the service returns null', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce(null);

    await expect(
      controller.getSuggestions(authRequest()),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
