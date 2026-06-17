import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRequestUrl, sendApiRequest } from './sendApiRequest';

describe('buildRequestUrl', () => {
  it('substitutes path params and appends query params', () => {
    const url = buildRequestUrl({
      serverOrigin: 'https://api.example.com',
      path: '/links/{id}',
      pathParams: { id: 'abc123' },
      queryParams: { search: 'cats', empty: '' },
    });
    expect(url).toBe('https://api.example.com/links/abc123?search=cats');
  });

  it('omits the query string entirely when all query values are empty', () => {
    const url = buildRequestUrl({
      serverOrigin: '',
      path: '/links',
      pathParams: {},
      queryParams: { search: '' },
    });
    expect(url).toBe('/links');
  });

  it('url-encodes path and query values', () => {
    const url = buildRequestUrl({
      serverOrigin: '',
      path: '/links/{id}',
      pathParams: { id: 'a b/c' },
      queryParams: { q: 'a&b' },
    });
    expect(url).toBe('/links/a%20b%2Fc?q=a%26b');
  });
});

describe('sendApiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches the Bearer header only when a token is provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendApiRequest({
      url: '/links',
      method: 'get',
      token: 'ltk_secret',
      body: null,
    });

    const headers = fetchMock.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe('Bearer ltk_secret');
  });

  it('does NOT attach an Authorization header when the token is empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendApiRequest({
      url: '/links',
      method: 'get',
      token: '',
      body: null,
    });

    const headers = fetchMock.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends a JSON body and content-type for a non-GET request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendApiRequest({
      url: '/links',
      method: 'post',
      token: 'ltk_x',
      body: '{"url":"https://x.com"}',
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"url":"https://x.com"}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });
});
