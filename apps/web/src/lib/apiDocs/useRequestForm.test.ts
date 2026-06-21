/**
 * Direct coverage for the headless `useRequestForm` state machine – branches
 * the `RequestForm` component tests don't reach because that suite only
 * exercises path params + a POST body:
 *
 *   - a `query`-location parameter routes into the URL query string (not the
 *     path substitution), proving the path/query split at submit time;
 *   - a GET request drops its body to `null` even when the editor holds valid
 *     JSON, so the `Content-Type` header is never attached;
 *   - the optional-param-left-blank path submits without a validation error.
 *
 * Lives beside the hook (lib/ is not write-gated) so the submit logic is
 * pinned apart from the brand-locked JSX.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRequestForm } from './useRequestForm';
import type { NormalizedEndpoint } from '../openapi';

function makeEndpoint(
  overrides: Partial<NormalizedEndpoint> = {},
): NormalizedEndpoint {
  return {
    method: 'get',
    path: '/links',
    parameters: [],
    responses: [{ statusCode: '200' }],
    ...overrides,
  };
}

interface RenderOptions {
  endpoint?: NormalizedEndpoint;
  serverOrigin?: string;
  token?: string;
  inert?: boolean;
}

function renderForm(options: RenderOptions = {}) {
  const {
    endpoint = makeEndpoint(),
    serverOrigin = 'https://api.example.com',
    token = 'ltk_secret',
    inert = false,
  } = options;
  return renderHook(() =>
    useRequestForm({
      endpoint,
      headingId: 'endpoint-get-links',
      serverOrigin,
      token,
      inert,
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRequestForm – query parameter routing', () => {
  it('places a query-location parameter in the URL query string, not the path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200, statusText: 'OK' }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderForm({
      endpoint: makeEndpoint({
        path: '/links',
        parameters: [
          {
            name: 'search',
            location: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
      }),
    });

    act(() => {
      result.current.setParamValue('query::search', 'cats');
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://api.example.com/links?search=cats');
  });

  it('submits with no validation error when an optional query param is left blank', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200, statusText: 'OK' }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderForm({
      endpoint: makeEndpoint({
        parameters: [
          {
            name: 'search',
            location: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
      }),
    });

    let invalidFieldId: string | null = 'unset';
    await act(async () => {
      invalidFieldId = await result.current.submit();
    });

    expect(invalidFieldId).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchMock.mock.calls[0];
    // Blank query value is dropped – no trailing `?`.
    expect(calledUrl).toBe('https://api.example.com/links');
  });
});

describe('useRequestForm – GET drops the body', () => {
  it('never sends a body or Content-Type for a GET even with valid JSON in the editor', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200, statusText: 'OK' }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderForm({
      endpoint: makeEndpoint({
        method: 'get',
        requestBody: {
          required: false,
          schema: { type: 'object', properties: { url: { type: 'string' } } },
        },
      }),
    });

    // The editor prefills a valid JSON skeleton from the schema; submitting a
    // GET must still drop it.
    await act(async () => {
      await result.current.submit();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('GET');
    expect(init.body).toBeNull();
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      undefined,
    );
  });
});

describe('useRequestForm – inert guard', () => {
  it('does not fetch and returns null when inert', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderForm({ inert: true, token: '' });

    let outcome: string | null = 'unset';
    await act(async () => {
      outcome = await result.current.submit();
    });

    expect(outcome).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('seeds the body editor from the request-body schema example', async () => {
    const { result } = renderForm({
      endpoint: makeEndpoint({
        method: 'post',
        requestBody: {
          required: true,
          schema: { type: 'object', properties: { url: { type: 'string' } } },
        },
      }),
    });

    await waitFor(() => {
      expect(result.current.bodyValue).toContain('"url"');
    });
  });
});
