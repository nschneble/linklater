import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedEndpoint } from '../../lib/openapi';

// MethodBadge reads auth to pick brand vs themed paint; stub it so the detail
// renders without the auth provider or network.
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import EndpointDetail from './EndpointDetail';
import { endpointHeadingId } from './endpointId';

function makeEndpoint(
  overrides: Partial<NormalizedEndpoint> = {},
): NormalizedEndpoint {
  return {
    method: 'get',
    path: '/links',
    summary: 'List links',
    description: 'Returns every link you have saved.',
    parameters: [],
    responses: [{ statusCode: '200', schema: { type: 'object' } }],
    ...overrides,
  };
}

function renderDetail(endpoint = makeEndpoint(), onStatusMessage = vi.fn()) {
  return render(
    <MemoryRouter>
      <EndpointDetail
        endpoint={endpoint}
        serverOrigin=""
        token=""
        tokenLoading={false}
        tokenError={null}
        onStatusMessage={onStatusMessage}
      />
    </MemoryRouter>,
  );
}

describe('EndpointDetail', () => {
  it('names the heading "GET /links" method-first, focusable but off the tab order', () => {
    renderDetail();
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'GET /links',
    });
    expect(heading).toHaveAttribute('id', endpointHeadingId('get', '/links'));
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('labels its region by the heading', () => {
    renderDetail();
    const region = screen.getByRole('region', { name: 'GET /links' });
    expect(region).toHaveAttribute(
      'aria-labelledby',
      endpointHeadingId('get', '/links'),
    );
  });

  it('renders the summary and description', () => {
    renderDetail();
    expect(screen.getByText('List links')).toBeInTheDocument();
    expect(
      screen.getByText('Returns every link you have saved.'),
    ).toBeInTheDocument();
  });

  it('renders a parameter table when the endpoint has parameters', () => {
    renderDetail(
      makeEndpoint({
        path: '/links/{id}',
        parameters: [{ name: 'id', location: 'path', required: true }],
      }),
    );
    expect(
      screen.getByRole('table', { name: /path & query parameters/i }),
    ).toBeInTheDocument();
  });

  it('states "No response body" for a response without a schema', () => {
    renderDetail(makeEndpoint({ responses: [{ statusCode: '204' }] }));
    expect(screen.getByText(/No response body\./i)).toBeInTheDocument();
  });

  it('embeds the try-it-out form', () => {
    renderDetail();
    expect(
      screen.getByRole('button', { name: /send request/i }),
    ).toBeInTheDocument();
  });

  it('reports the form status upward instead of rendering an inline announcer', () => {
    const onStatusMessage = vi.fn();
    renderDetail(makeEndpoint(), onStatusMessage);
    // Hoisted: the detail does not render its own status region.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onStatusMessage).toHaveBeenCalled();
  });
});
