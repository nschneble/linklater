import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedApi } from '../../lib/openapi';

const fetchOpenApiMock = vi.fn<() => Promise<NormalizedApi>>();

vi.mock('../../lib/openapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/openapi')>();
  return { ...actual, fetchOpenApi: () => fetchOpenApiMock() };
});

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import ApiReference from './ApiReference';

const linksApi: NormalizedApi = {
  info: { title: 'Linklater API', version: '1.0.0' },
  serverOrigin: '',
  endpoints: [
    {
      method: 'get',
      path: '/links',
      summary: 'List links',
      parameters: [],
      responses: [{ statusCode: '200' }],
    },
    {
      method: 'delete',
      path: '/links/{id}',
      summary: 'Delete a link',
      parameters: [{ name: 'id', location: 'path', required: true }],
      responses: [{ statusCode: '204' }],
    },
  ],
};

function renderReference(initialEntry = '/api-docs') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ApiReference apiBaseUrl={undefined} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  fetchOpenApiMock.mockReset();
  fetchOpenApiMock.mockResolvedValue(linksApi);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiReference', () => {
  it('opens on the welcome panel with the endpoint nav alongside it', async () => {
    renderReference();
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: /save, read, and delete links/i,
      }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'API endpoints' });
    expect(
      within(nav).getByRole('button', { name: 'GET /links' }),
    ).toBeInTheDocument();
  });

  it('keeps a single persistent spec-load live region outside the swapping detail', async () => {
    renderReference();
    await screen.findByRole('heading', { level: 3 });
    // Only the spec-load-state region lives at this level now – the live "try
    // it out" form (and the request-status region it fed) has been removed, so
    // no auth-gated announcer remains. The welcome panel carries no status
    // region, so the load-state region is the sole status node here.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('swaps to an endpoint and moves focus to its heading on selection', async () => {
    const user = userEvent.setup();
    renderReference();
    const nav = await screen.findByRole('navigation', {
      name: 'API endpoints',
    });
    await user.click(
      await within(nav).findByRole('button', { name: 'DELETE /links/{id}' }),
    );

    const heading = await screen.findByRole('heading', {
      level: 3,
      name: 'DELETE /links/{id}',
    });
    expect(heading).toHaveFocus();
  });

  it('renders the deep-linked endpoint detail on load', async () => {
    renderReference('/api-docs#get-links');
    expect(
      await screen.findByRole('heading', { level: 3, name: 'GET /links' }),
    ).toBeInTheDocument();
    // Welcome heading is gone – the detail replaced it.
    expect(
      screen.queryByRole('heading', { name: /save, read, and delete links/i }),
    ).not.toBeInTheDocument();
  });

  it('announces the loaded endpoint count', async () => {
    renderReference();
    await screen.findByRole('heading', { level: 3 });
    expect(screen.getByText('2 endpoints loaded.')).toBeInTheDocument();
  });
});
