import { MemoryRouter } from 'react-router-dom';
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

// The "try it out" forms each consume the API-docs token; stub the hook so
// these list-level tests don't need the auth provider or network.
vi.mock('./useApiDocsToken', () => ({
  useApiDocsToken: () => ({ token: '', loading: false, error: null }),
}));

// EndpointList → EndpointCard → MethodBadge reads `useAuth()` to pick its
// brand/themed paint. Mock it to a logged-out user (brand) — these tests cover
// list structure + announcements, not the badge color branch.
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import EndpointList from './EndpointList';

function renderList(apiBaseUrl: string | undefined) {
  return render(
    <MemoryRouter>
      <EndpointList apiBaseUrl={apiBaseUrl} />
    </MemoryRouter>,
  );
}

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
    renderList(undefined);
    expect(screen.getByRole('status')).toHaveTextContent(/Loading/);
  });

  it('announces the error message in the persistent polite status region on fetch failure', async () => {
    fetchOpenApiMock.mockRejectedValue(
      new Error('Failed to load the API specification (HTTP 500).'),
    );
    renderList(undefined);
    const status = screen.getByRole('status');
    await vi.waitFor(() => {
      expect(status).toHaveTextContent(/Failed to load the API specification/);
    });
    // The region is a stable node: its text changed, it was not swapped out.
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('announces a pluralized endpoint count in the status region on ready', async () => {
    fetchOpenApiMock.mockResolvedValue(
      makeApi([
        makeEndpoint({ method: 'get', path: '/links' }),
        makeEndpoint({ method: 'post', path: '/links' }),
      ]),
    );
    renderList(undefined);
    await screen.findByRole('list');
    // Each "try it out" form also mounts a polite status node, so scope the
    // assertion to the one carrying the list-level count.
    expect(
      screen.getByText('2 endpoints loaded.', { selector: '[role="status"]' }),
    ).toBeInTheDocument();
  });

  it('announces a singular endpoint count for a one-endpoint spec', async () => {
    fetchOpenApiMock.mockResolvedValue(makeApi([makeEndpoint()]));
    renderList(undefined);
    await screen.findByRole('list');
    expect(
      screen.getByText('1 endpoint loaded.', { selector: '[role="status"]' }),
    ).toBeInTheDocument();
  });

  it('restores list semantics with role="list" (S2)', async () => {
    fetchOpenApiMock.mockResolvedValue(makeApi([makeEndpoint()]));
    renderList(undefined);
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
    renderList(undefined);
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
    const { container } = renderList(undefined);
    await screen.findByRole('list');

    const ids = Array.from(container.querySelectorAll('[id]')).map(
      (node) => node.id,
    );
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('emits NO duplicate ids across endpoints whose "try it out" forms are expanded (E4)', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const paramEndpoint = (method: string): NormalizedEndpoint => ({
      method,
      path: '/links/{id}',
      parameters: [
        {
          name: 'id',
          location: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        schema: { type: 'object', properties: { url: { type: 'string' } } },
      },
      responses: [{ statusCode: '200' }],
    });
    fetchOpenApiMock.mockResolvedValue(
      makeApi([paramEndpoint('put'), paramEndpoint('post')]),
    );
    const { container } = renderList(undefined);
    await screen.findByRole('list');

    // Expand every endpoint so all field/error/description ids render.
    for (const toggle of screen.getAllByRole('button', {
      name: /\/links\/\{id\}/i,
    })) {
      await user.click(toggle);
    }

    const ids = Array.from(container.querySelectorAll('[id]')).map(
      (node) => node.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    // Sanity: the deterministic field ids actually rendered.
    expect(ids).toContain('endpoint-put-links-id-param-path-id');
    expect(ids).toContain('endpoint-post-links-id-param-path-id');
  });

  it('renders empty-state text when the spec documents no endpoints', async () => {
    fetchOpenApiMock.mockResolvedValue(makeApi([]));
    renderList(undefined);
    // The text appears in both the sr-only announcer and the visible
    // (aria-hidden) body, so scope the visible assertion to the hidden node.
    await vi.waitFor(() => {
      const visibleEmptyState = screen
        .getAllByText(/No endpoints are documented yet\./)
        .find((node) => node.getAttribute('aria-hidden') === 'true');
      expect(visibleEmptyState).toBeInTheDocument();
    });
  });
});
