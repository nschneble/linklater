import { jest } from '@jest/globals';

import { Logger } from '@nestjs/common';

import { WikipediaAdapter } from './wikipedia-adapter.js';

interface WikipediaSummary {
  title: string;
  extract: string;
  content_urls: { desktop: { page: string } };
  thumbnail?: { source: string };
}

function makeSummary(
  overrides: Partial<WikipediaSummary> = {},
): WikipediaSummary {
  return {
    title: 'Example Article',
    extract: 'A snippet of the article body.',
    content_urls: {
      desktop: { page: 'https://en.wikipedia.org/wiki/Example_Article' },
    },
    thumbnail: { source: 'https://example.com/image.png' },
    ...overrides,
  };
}

function jsonResponse(
  body: WikipediaSummary,
  ok = true,
  status = 200,
): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('WikipediaAdapter', () => {
  let adapter: WikipediaAdapter;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    adapter = new WikipediaAdapter();
    fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
    // failure-path tests exercise the warn branch on purpose; keep it quiet
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('exposes the expected key and name', () => {
    expect(adapter.key).toBe('wikipedia');
    expect(adapter.name).toBe('Wikipedia');
  });

  it('returns N suggestions when N parallel fetches succeed', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          makeSummary({
            title: 'A',
            content_urls: { desktop: { page: 'https://wiki/A' } },
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          makeSummary({
            title: 'B',
            content_urls: { desktop: { page: 'https://wiki/B' } },
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          makeSummary({
            title: 'C',
            content_urls: { desktop: { page: 'https://wiki/C' } },
          }),
        ),
      );

    const suggestions = await adapter.fetch(3);

    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((suggestion) => suggestion.title)).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect(suggestions[0].siteName).toBe('Wikipedia');
  });

  it('drops duplicate URLs that come back from the random endpoint', async () => {
    const duplicate = makeSummary({
      title: 'Dup',
      content_urls: { desktop: { page: 'https://wiki/Dup' } },
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(duplicate))
      .mockResolvedValueOnce(jsonResponse(duplicate))
      .mockResolvedValueOnce(
        jsonResponse(
          makeSummary({
            title: 'Other',
            content_urls: { desktop: { page: 'https://wiki/Other' } },
          }),
        ),
      );

    const suggestions = await adapter.fetch(3);

    expect(suggestions.map((suggestion) => suggestion.url)).toEqual([
      'https://wiki/Dup',
      'https://wiki/Other',
    ]);
  });

  it('returns successful results when some requests fail', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeSummary(), false, 500))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(
        jsonResponse(
          makeSummary({
            title: 'Survivor',
            content_urls: { desktop: { page: 'https://wiki/Survivor' } },
          }),
        ),
      );

    const suggestions = await adapter.fetch(3);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].title).toBe('Survivor');
  });

  it('returns an empty array when every request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const suggestions = await adapter.fetch(3);

    expect(suggestions).toEqual([]);
  });

  it('maps the API shape onto the Suggestion shape', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeSummary({
          title: 'Mapped',
          extract: 'Some extract.',
          content_urls: { desktop: { page: 'https://wiki/Mapped' } },
          thumbnail: { source: 'https://thumb/mapped.png' },
        }),
      ),
    );

    const [suggestion] = await adapter.fetch(1);

    expect(suggestion).toEqual({
      url: 'https://wiki/Mapped',
      title: 'Mapped',
      description: 'Some extract.',
      imageUrl: 'https://thumb/mapped.png',
      siteName: 'Wikipedia',
    });
  });

  it('returns a null imageUrl when the API omits a thumbnail', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        makeSummary({
          title: 'NoThumb',
          content_urls: { desktop: { page: 'https://wiki/NoThumb' } },
          thumbnail: undefined,
        }),
      ),
    );

    const [suggestion] = await adapter.fetch(1);

    expect(suggestion.imageUrl).toBeNull();
  });
});
