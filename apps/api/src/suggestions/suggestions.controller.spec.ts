import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { ServiceUnavailableException } from '@nestjs/common';

import { DEFAULT_COUNT } from './dto/suggestions-query.dto.js';
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

  // `count` coercion, defaulting, and range validation now live in
  // SuggestionsQueryDto (see suggestions-query.dto.spec.ts). The controller
  // receives an already-validated DTO, so these tests only prove delegation.
  const makeQuery = (count = DEFAULT_COUNT) => ({ count });

  it('forwards the default count through to the service', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce({
      sourceName: 'Aeon',
      suggestions: [aSuggestion(), aSuggestion(), aSuggestion()],
    });

    const result = await controller.getSuggestions(
      authRequest(),
      makeQuery() as never,
    );

    expect(suggestionsServiceMock.getSuggestions).toHaveBeenCalledWith(
      DEFAULT_COUNT,
      TEST_USER_ID,
    );
    expect(result.sourceName).toBe('Aeon');
    expect(result.suggestions).toHaveLength(3);
  });

  it('forwards a validated count value through to the service', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce({
      sourceName: 'Wikipedia',
      suggestions: [aSuggestion()],
    });

    await controller.getSuggestions(authRequest(), makeQuery(1) as never);

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

    await controller.getSuggestions(
      authRequest('user-42'),
      makeQuery() as never,
    );

    expect(suggestionsServiceMock.getSuggestions).toHaveBeenCalledWith(
      DEFAULT_COUNT,
      'user-42',
    );
  });

  it('throws 503 when the service returns null', async () => {
    suggestionsServiceMock.getSuggestions.mockResolvedValueOnce(null);

    await expect(
      controller.getSuggestions(authRequest(), makeQuery() as never),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
