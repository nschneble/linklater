import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedApi, NormalizedEndpoint } from '../../lib/openapi';

const fetchOpenApiMock = vi.fn();

vi.mock('../../lib/openapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/openapi')>();
  return {
    ...actual,
    fetchOpenApi: (url: string) => fetchOpenApiMock(url),
  };
});

import EndpointList from './EndpointList';

function makeEndpoint(
  overrides: Partial<NormalizedEndpoint> = {},
): NormalizedEndpoint {
  return {
    method: 'get',
    path: '/links',
    summary: 'List links',
    parameters: [],
    responses: [{ statusCode: '204' }],
    ...overrides,
  };
}

function makeApi(endpoints: NormalizedEndpoint[]): NormalizedApi {
  return {
    info: { title: 'Linklater API', version: '1.0.0' },
    serverOrigin: '',
    endpoints,
  };
}

beforeEach(() => {
  fetchOpenApiMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EndpointList', () => {
  it('shows a polite loading status while the spec is in flight', () => {
    fetchOpenApiMock.mockReturnValue(new Promise(() => {}));
    render(<EndpointList apiBaseUrl={undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Loading/);
  });

  it('renders a role=alert on fetch failure', async () => {
    fetchOpenApiMock.mockRejectedValue(
      new Error('Failed to load the API specification (HTTP 500).'),
    );
    render(<EndpointList apiBaseUrl={undefined} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Failed to load the API specification/);
  });

  it('restores list semantics with role="list" (S2)', async () => {
    fetchOpenApiMock.mockResolvedValue(makeApi([makeEndpoint()]));
    render(<EndpointList apiBaseUrl={undefined} />);
    const list = await screen.findByRole('list');
    expect(list.tagName).toBe('UL');
  });

  it('renders one list item per endpoint', async () => {
    fetchOpenApiMock.mockResolvedValue(
      makeApi([
        makeEndpoint({ method: 'get', path: '/links' }),
        makeEndpoint({ method: 'post', path: '/links' }),
        makeEndpoint({ method: 'delete', path: '/links/{id}' }),
      ]),
    );
    render(<EndpointList apiBaseUrl={undefined} />);
    const list = await screen.findByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  it('emits NO duplicate element ids across multiple endpoints (E4)', async () => {
    fetchOpenApiMock.mockResolvedValue(
      makeApi([
        makeEndpoint({ method: 'get', path: '/links' }),
        makeEndpoint({ method: 'post', path: '/links' }),
        makeEndpoint({ method: 'put', path: '/links/{id}' }),
        makeEndpoint({ method: 'delete', path: '/links/{id}' }),
      ]),
    );
    const { container } = render(<EndpointList apiBaseUrl={undefined} />);
    await screen.findByRole('list');

    const ids = Array.from(container.querySelectorAll('[id]')).map(
      (node) => node.id,
    );
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('renders empty-state text when the spec documents no endpoints', async () => {
    fetchOpenApiMock.mockResolvedValue(makeApi([]));
    render(<EndpointList apiBaseUrl={undefined} />);
    expect(
      await screen.findByText(/No endpoints are documented yet\./),
    ).toBeInTheDocument();
  });
});
