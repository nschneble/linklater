import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchOpenApi,
  resolveOpenApiUrl,
  resolveServerOrigin,
} from './fetchOpenApi';
import type { OpenAPIV3 } from 'openapi-types';

const MINIMAL_SPEC: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { title: 'Linklater API', version: '0.3.0' },
  paths: {
    '/links': {
      get: {
        summary: 'List links',
        responses: { '200': { description: 'ok' } },
      },
    },
  },
};

describe('resolveOpenApiUrl', () => {
  it('prefixes an absolute API base URL', () => {
    expect(resolveOpenApiUrl('https://api.test')).toBe(
      'https://api.test/openapi.json',
    );
  });

  it('falls back to a relative path when no base URL is set', () => {
    expect(resolveOpenApiUrl(undefined)).toBe('/openapi.json');
    expect(resolveOpenApiUrl('')).toBe('/openapi.json');
  });
});

describe('resolveServerOrigin', () => {
  it('strips the /openapi.json suffix from an absolute URL', () => {
    expect(resolveServerOrigin('https://api.test/openapi.json')).toBe(
      'https://api.test',
    );
  });

  it('derives an empty (same-origin) server from a relative URL', () => {
    expect(resolveServerOrigin('/openapi.json')).toBe('');
  });
});

describe('fetchOpenApi', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches, parses, and resolves the server origin from an absolute URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MINIMAL_SPEC),
    });

    const api = await fetchOpenApi('https://api.test/openapi.json', fetchMock);

    expect(fetchMock).toHaveBeenCalledWith('https://api.test/openapi.json');
    expect(api.info.title).toBe('Linklater API');
    expect(api.serverOrigin).toBe('https://api.test');
    expect(api.endpoints).toHaveLength(1);
  });

  it('derives a same-origin server from a relative spec URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MINIMAL_SPEC),
    });

    const api = await fetchOpenApi('/openapi.json', fetchMock);

    expect(api.serverOrigin).toBe('');
  });

  it('throws when the response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });

    await expect(fetchOpenApi('/openapi.json', fetchMock)).rejects.toThrow(
      '503',
    );
  });
});
