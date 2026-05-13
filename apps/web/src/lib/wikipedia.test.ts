import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WIKIPEDIA_FAVICON_URL,
  WIKIPEDIA_IMAGE_URL,
  articleToLink,
  fetchRandomWikipediaArticle,
} from './wikipedia';

const WIKIPEDIA_ARTICLE = {
  title: 'Interesting Topic',
  extract: 'A fascinating subject.',
  content_urls: {
    desktop: { page: 'https://en.wikipedia.org/wiki/Interesting_Topic' },
  },
};

function makeOkResponse(body = WIKIPEDIA_ARTICLE) {
  return { ok: true, json: () => Promise.resolve(body) } as Response;
}

describe('fetchRandomWikipediaArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a WikipediaArticle on a successful fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse()));
    const controller = new AbortController();

    const article = await fetchRandomWikipediaArticle(controller.signal);

    expect(article).toEqual({
      title: 'Interesting Topic',
      extract: 'A fascinating subject.',
      url: 'https://en.wikipedia.org/wiki/Interesting_Topic',
    });
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false } as Response),
    );
    const controller = new AbortController();

    const article = await fetchRandomWikipediaArticle(controller.signal);

    expect(article).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure')),
    );
    const controller = new AbortController();

    const article = await fetchRandomWikipediaArticle(controller.signal);

    expect(article).toBeNull();
  });

  it('passes the signal to fetch', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(makeOkResponse()) as typeof fetch;
    vi.stubGlobal('fetch', mockFetch);
    const controller = new AbortController();

    await fetchRandomWikipediaArticle(controller.signal);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('returns null when the request is aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')),
    );
    const controller = new AbortController();
    controller.abort();

    const article = await fetchRandomWikipediaArticle(controller.signal);

    expect(article).toBeNull();
  });
});

describe('articleToLink', () => {
  it('maps title and extract onto link meta', () => {
    const article = {
      title: 'Test Title',
      extract: 'Test extract.',
      url: 'https://en.wikipedia.org/wiki/Test',
    };

    const link = articleToLink(article);

    expect(link.meta?.title).toBe('Test Title');
    expect(link.meta?.description).toBe('Test extract.');
  });

  it('uses the article url as the link id and url', () => {
    const article = {
      title: 'Test',
      extract: 'Extract.',
      url: 'https://en.wikipedia.org/wiki/Test',
    };

    const link = articleToLink(article);

    expect(link.id).toBe(article.url);
    expect(link.url).toBe(article.url);
  });

  it('sets readAt to null', () => {
    const article = {
      title: 'Test',
      extract: 'Extract.',
      url: 'https://en.wikipedia.org/wiki/Test',
    };

    const link = articleToLink(article);

    expect(link.readAt).toBeNull();
  });

  it('uses the Wikipedia image and favicon constants', () => {
    const article = {
      title: 'Test',
      extract: 'Extract.',
      url: 'https://en.wikipedia.org/wiki/Test',
    };

    const link = articleToLink(article);

    expect(link.meta?.imageUrl).toBe(WIKIPEDIA_IMAGE_URL);
    expect(link.meta?.faviconUrl).toBe(WIKIPEDIA_FAVICON_URL);
  });
});
